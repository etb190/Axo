import fs from 'node:fs';
import path from 'node:path';

const THUMBNAIL_DIR = 'C:\\Users\\PC\\Desktop\\database\\books\\ThumbnailCache';
const CACHE_FILE = 'C:\\Users\\PC\\Desktop\\database\\books\\cover_urls.json';

let urlCache = {};
try {
  if (fs.existsSync(CACHE_FILE)) {
    urlCache = JSON.parse(fs.readFileSync(CACHE_FILE, 'utf8'));
  }
} catch (e) {
  urlCache = {};
}

function saveCache() {
  try {
    fs.writeFileSync(CACHE_FILE, JSON.stringify(urlCache, null, 2), 'utf8');
  } catch (e) {}
}

/**
 * Finds the local thumbnail for the given book and returns a public HTTPS URL.
 * Uploads to an anonymous host once and caches the result locally.
 */
export async function getCoverUrlForBook(bookTitle, pdfName) {
  const cleanTitle = (bookTitle || pdfName || '').replace(/\.pdf$/i, '').trim();
  if (!cleanTitle) return null;

  if (urlCache[cleanTitle]) {
    return urlCache[cleanTitle];
  }

  // 1. Locate local thumbnail
  let localPath = path.join(THUMBNAIL_DIR, `${cleanTitle}.jpg`);

  if (!fs.existsSync(localPath)) {
    // Try matching files in ThumbnailCache
    try {
      if (fs.existsSync(THUMBNAIL_DIR)) {
        const files = fs.readdirSync(THUMBNAIL_DIR);
        const lower = cleanTitle.toLowerCase();
        const matched = files.find((f) => {
          const name = f.replace(/\.jpg$/i, '').toLowerCase();
          return name === lower || lower.includes(name) || name.includes(lower);
        });
        if (matched) {
          localPath = path.join(THUMBNAIL_DIR, matched);
        } else {
          localPath = null;
        }
      } else {
        localPath = null;
      }
    } catch (e) {
      localPath = null;
    }
  }

  if (!localPath || !fs.existsSync(localPath)) {
    return null;
  }

  // 2. Upload to anonymous host (uguu.se)
  try {
    const buffer = fs.readFileSync(localPath);
    const fd = new FormData();
    fd.append('files[]', new Blob([buffer]), 'cover.jpg');

    const res = await fetch('https://uguu.se/upload', {
      method: 'POST',
      body: fd,
    });
    const data = await res.json();
    if (data.success && data.files && data.files[0]?.url) {
      const uploadedUrl = data.files[0].url;
      urlCache[cleanTitle] = uploadedUrl;
      saveCache();
      console.log(`[CoverService] Generated automatic cover URL for "${cleanTitle}":`, uploadedUrl);
      return uploadedUrl;
    }
  } catch (err) {
    console.warn('[CoverService] Failed to upload book thumbnail:', err.message);
  }

  return null;
}

const PERMANENT_KINDLE_BADGE = 'https://cdn.discordapp.com/app-icons/1547881478774595705/9f913825c797ce44d9a79a0ccaeeec5b.png';

export async function getKindleBadgeUrl() {
  return PERMANENT_KINDLE_BADGE;
}
