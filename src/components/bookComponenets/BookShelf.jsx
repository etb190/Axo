// src/components/bookComponenets/BookShelf.jsx

import React, { useState, useEffect, useRef } from 'react';
import { useData } from '../../contexts/DataContext';
import BookOpenIcon from '../../assets/icons/book.svg';
import MessageSquareIcon from '../../assets/icons/message.svg';
import BookmarkIcon from '../../assets/icons/bookmark.svg';
import MoveIcon from '../../assets/icons/move-vertical.svg';
import TrashIcon from '../../assets/icons/delete.svg';
import CloseIcon from '../../assets/icons/close.svg';
import CheckIcon from '../../assets/icons/check.svg';
import ZapIcon from '../../assets/icons/zap.svg';

import * as pdfjsLib from 'pdfjs-dist';

// Set worker to match the installed pdfjs-dist version using dynamic CDN
const isModern = parseInt(pdfjsLib.version.split('.')[0]) >= 4;
pdfjsLib.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.${isModern ? 'mjs' : 'js'}`;

const fs = window.require('fs');
const path = window.require('path');
const { shell } = window.require('electron');

const PROGRESS_FOLDER = 'C:\\Users\\PC\\Desktop\\database\\books\\Progress';
const THUMBNAIL_CACHE_FOLDER = 'C:\\Users\\PC\\Desktop\\database\\books\\ThumbnailCache';
const BOOK_CACHE_FOLDER = 'C:\\Users\\PC\\Desktop\\database\\Books\\BookCache';
const SKILLS_FOLDER = 'C:\\Users\\PC\\Desktop\\database\\Skills';

// Create necessary folders
[PROGRESS_FOLDER, THUMBNAIL_CACHE_FOLDER, BOOK_CACHE_FOLDER].forEach(folder => {
  if (!fs.existsSync(folder)) {
    fs.mkdirSync(folder, { recursive: true });
  }
});

const { ipcRenderer } = window.require('electron');

const BookShelf = ({ title, shelfKey, books = [], onNotesClick, onBookClick, onFastReaderClick, categories = [], onManageCategories }) => {
  const { refreshData } = useData();
  const [thumbnails, setThumbnails] = useState({});
  const [progressData, setProgressData] = useState({});
  const [progressModal, setProgressModal] = useState(null);
  const [contextMenuBook, setContextMenuBook] = useState(null);
  const [moveModal, setMoveModal] = useState(null);
  const [moveTargetCategory, setMoveTargetCategory] = useState('__root__');
  const [categoryModal, setCategoryModal] = useState(null);
  const [deleteModal, setDeleteModal] = useState(null);
  const [notFoundModal, setNotFoundModal] = useState(null);
  const [showCatDropdown, setShowCatDropdown] = useState(false);
  const catDropdownRef = useRef(null);

  const storageKey = `axo_bookshelf_cat_${shelfKey || title}`;
  const [selectedCategory, setSelectedCategory] = useState(() => {
    try { return localStorage.getItem(storageKey) || 'all'; } catch { return 'all'; }
  });

  useEffect(() => {
    if (selectedCategory !== 'all' && categories.length > 0 && !categories.includes(selectedCategory)) {
      setSelectedCategory('all');
      try { localStorage.setItem(storageKey, 'all'); } catch {}
    }
  }, [categories, selectedCategory, storageKey]);

  const changeCategory = (cat) => {
    setSelectedCategory(cat);
    try { localStorage.setItem(storageKey, cat); } catch {}
    setShowCatDropdown(false);
  };

  useEffect(() => {
    const handler = (e) => {
      if (catDropdownRef.current && !catDropdownRef.current.contains(e.target)) setShowCatDropdown(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const filteredBooks = selectedCategory === 'all' ? books : books.filter(b => b.category === selectedCategory);

  const shelfKeys = [
    { title: 'Currently Reading', key: 'Reading' },
    { title: 'Want to Read', key: 'WanttoRead' },
    { title: 'Read', key: 'Read' },
  ];

  const isReadingShelf = title === 'Currently Reading';
  const isCacheableShelf = title === 'Read';
  const shelfKeyForCache = title === 'Want to Read' ? 'WanttoRead' : title === 'Read' ? 'Read' : 'Reading';

  // Save thumbnail to disk cache
  const saveThumbnailCache = (bookPath, dataUrl) => {
    try {
      const cacheFileName = path.basename(bookPath, '.pdf') + '.jpg';
      const cachePath = path.join(THUMBNAIL_CACHE_FOLDER, cacheFileName);

      // Convert data URL to buffer and save
      const base64Data = dataUrl.replace(/^data:image\/jpeg;base64,/, '');
      const buffer = Buffer.from(base64Data, 'base64');
      fs.writeFileSync(cachePath, buffer);
      refreshData();
    } catch (err) {
      console.error('Error saving thumbnail cache:', err);
    }
  };

  // Generate thumbnail for a single book
  const generateThumbnail = async (book) => {
    try {
      const data = fs.readFileSync(book.fullPath);
      const loadingTask = pdfjsLib.getDocument({ data });
      const pdf = await loadingTask.promise;
      const page = await pdf.getPage(1);
      const viewport = page.getViewport({ scale: 0.5 });
      const canvas = document.createElement('canvas');
      const context = canvas.getContext('2d');
      canvas.width = viewport.width;
      canvas.height = viewport.height;
      await page.render({ canvasContext: context, viewport }).promise;
      const dataUrl = canvas.toDataURL('image/jpeg', 0.8);

      // Save to cache
      saveThumbnailCache(book.fullPath, dataUrl);

      return { path: book.fullPath, thumbnail: dataUrl };
    } catch (err) {
      console.error(`Thumbnail error for ${book.name}:`, err);
      return { path: book.fullPath, thumbnail: null };
    }
  };

  // Save book cache metadata to BookCache folder
  const saveBookCache = async (book, totalPages) => {
    try {
      const cacheFileName = book.name + '.json';
      const cachePath = path.join(BOOK_CACHE_FOLDER, cacheFileName);

      // Check if cache already exists for this shelf with all required fields
      if (fs.existsSync(cachePath)) {
        const existing = JSON.parse(fs.readFileSync(cachePath, 'utf8'));
        if (existing.shelf === shelfKeyForCache && existing.createdAt && existing.lastUpdated) {
          return; // Already fully cached for this shelf
        }
      }

      const thumbnailPath = path.join(THUMBNAIL_CACHE_FOLDER, book.name + '.jpg');
      const hasThumbnail = fs.existsSync(thumbnailPath);

      const cacheData = {
        name: book.name,
        totalPages: totalPages || book.progress?.total || 0,
        thumbnailPath: hasThumbnail ? thumbnailPath : null,
        originalPath: book.fullPath,
        shelf: shelfKeyForCache,
        cachedAt: new Date().toISOString(),
        createdAt: book.createdAt ? book.createdAt.toISOString() : new Date().toISOString(),
        lastUpdated: book.lastUpdated ? book.lastUpdated.toISOString() : new Date().toISOString(),
      };

      fs.writeFileSync(cachePath, JSON.stringify(cacheData, null, 2));
    } catch (err) {
      console.error('Error saving book cache:', err);
    }
  };

  useEffect(() => {
    const processBooks = async () => {
      // 1. Initialize progress data from books prop
      const progMap = {};
      books.forEach(b => {
        if (b.progress) {
          progMap[b.fullPath] = b.progress;
        }
      });
      setProgressData(progMap);

      // 2. Generate missing thumbnails (only for real files, not cached-only)
      const booksNeedingThumbnails = books.filter(b => !b.cover && !thumbnails[b.fullPath] && !b.cachedOnly);

      if (booksNeedingThumbnails.length > 0) {
        const thumbnailPromises = booksNeedingThumbnails.map(book => generateThumbnail(book));
        const thumbnailResults = await Promise.all(thumbnailPromises);

        const newThumbs = {};
        thumbnailResults.forEach(result => {
          if (result.thumbnail) {
            newThumbs[result.path] = result.thumbnail;
          }
        });

        if (Object.keys(newThumbs).length > 0) {
          setThumbnails(prev => ({ ...prev, ...newThumbs }));
        }
      }

      // 3. Auto-cache books on WanttoRead and Read shelves
      if (isCacheableShelf) {
        for (const book of books) {
          if (book.cachedOnly) continue; // Already a cached entry
          try {
            // Get total pages if not already known
            let totalPages = book.progress?.total || 0;
            if (totalPages === 0 && fs.existsSync(book.fullPath)) {
              try {
                const data = fs.readFileSync(book.fullPath);
                const loadingTask = pdfjsLib.getDocument({ data });
                const pdf = await loadingTask.promise;
                totalPages = pdf.numPages;
              } catch (e) {
                console.error('Failed to get page count for caching:', e);
              }
            }
            saveBookCache(book, totalPages);
          } catch (e) {
            console.error('Book cache error:', e);
          }
        }
      }

      // 4. HEAL PASS — retroactively fix any book whose stored total is 0 or missing.
      //    Runs silently in the background for all real (non-cached) books.
      const healUpdates = {};
      for (const book of books) {
        if (book.cachedOnly || !fs.existsSync(book.fullPath)) continue;
        const storedTotal = progMap[book.fullPath]?.total || 0;
        if (storedTotal > 0) continue; // Already has a valid page count

        // Check progress file on disk directly (data context may not have loaded it)
        const progressFile = path.join(PROGRESS_FOLDER, `${book.name}.json`);
        let diskTotal = 0;
        if (fs.existsSync(progressFile)) {
          try { diskTotal = (JSON.parse(fs.readFileSync(progressFile, 'utf-8')).total) || 0; } catch (e) { /* ignore */ }
        }
        if (diskTotal > 0) {
          healUpdates[book.fullPath] = { ...(progMap[book.fullPath] || {}), total: diskTotal };
          continue;
        }

        // Page count truly unknown — parse the PDF and persist it
        try {
          const data = fs.readFileSync(book.fullPath);
          const pdf = await pdfjsLib.getDocument({ data }).promise;
          const total = pdf.numPages;
          const existing = fs.existsSync(progressFile)
            ? (() => { try { return JSON.parse(fs.readFileSync(progressFile, 'utf-8')); } catch { return {}; } })()
            : {};
          fs.writeFileSync(progressFile, JSON.stringify({ current: existing.current || 0, ...existing, total }, null, 2));
          healUpdates[book.fullPath] = { current: existing.current || 0, ...(progMap[book.fullPath] || {}), total };
          console.log(`[BookShelf] Healed page count for "${book.name}": ${total} pages`);
        } catch (e) {
          console.error(`[BookShelf] Could not heal page count for "${book.name}":`, e);
        }
      }

      if (Object.keys(healUpdates).length > 0) {
        setProgressData(prev => ({ ...prev, ...healUpdates }));
      }
    };

    if (books.length > 0) {
      processBooks();
    }
  }, [books]); // Re-run when books prop changes

  const syncProgressToSkills = (bookName, currentPage) => {
    try {
      if (!fs.existsSync(SKILLS_FOLDER)) return;
      const files = fs.readdirSync(SKILLS_FOLDER).filter(f => f.endsWith('.json'));
      for (const file of files) {
        const filePath = path.join(SKILLS_FOLDER, file);
        try {
          const skill = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
          let modified = false;
          const updatedPhases = (skill.phases || []).map(phase => ({
            ...phase,
            items: (phase.items || []).map(item => {
              if (item.type === 'book' && item.data?.title === bookName) {
                modified = true;
                return { ...item, data: { ...item.data, currentPage } };
              }
              return item;
            })
          }));
          if (modified) {
            fs.writeFileSync(filePath, JSON.stringify({ ...skill, phases: updatedPhases }, null, 2));
          }
        } catch (e) {
          console.error(`Error syncing skill file ${file}:`, e);
        }
      }
    } catch (e) {
      console.error('Error syncing progress to skills:', e);
    }
  };

  const saveProgress = (book, currentPage) => {
    const progressFile = path.join(PROGRESS_FOLDER, `${book.name}.json`);

    // Read existing stored total so we never overwrite it with 0
    let storedTotal = progressData[book.fullPath]?.total || 0;
    if (storedTotal === 0 && fs.existsSync(progressFile)) {
      try {
        const existing = JSON.parse(fs.readFileSync(progressFile, 'utf-8'));
        storedTotal = existing.total || 0;
      } catch (e) { /* ignore */ }
    }

    const clamped = storedTotal > 0 ? Math.max(0, Math.min(currentPage, storedTotal)) : Math.max(0, currentPage);

    try {
      fs.writeFileSync(progressFile, JSON.stringify({ current: clamped, total: storedTotal }, null, 2));
      syncProgressToSkills(book.name, clamped);
      refreshData();
    } catch (e) {
      console.error("Save progress error", e);
    }

    setProgressData(prev => ({
      ...prev,
      [book.fullPath]: { ...prev[book.fullPath], current: clamped, total: storedTotal }
    }));
  };

  const openProgressModal = async (book) => {
    let totalPages = progressData[book.fullPath]?.total || 0;

    // Check progress file for stored total first (avoids PDF parse if already cached)
    if (totalPages === 0) {
      const progressFile = path.join(PROGRESS_FOLDER, `${book.name}.json`);
      if (fs.existsSync(progressFile)) {
        try {
          const stored = JSON.parse(fs.readFileSync(progressFile, 'utf-8'));
          totalPages = stored.total || 0;
        } catch (e) { /* ignore */ }
      }
    }

    // Fall back to parsing the PDF and persist the result immediately
    if (totalPages === 0) {
      try {
        const data = fs.readFileSync(book.fullPath);
        const loadingTask = pdfjsLib.getDocument({ data });
        const pdf = await loadingTask.promise;
        totalPages = pdf.numPages;

        // Persist the discovered total immediately so it's never lost
        const progressFile = path.join(PROGRESS_FOLDER, `${book.name}.json`);
        let existing = { current: 0 };
        if (fs.existsSync(progressFile)) {
          try { existing = JSON.parse(fs.readFileSync(progressFile, 'utf-8')); } catch (e) { /* ignore */ }
        }
        fs.writeFileSync(progressFile, JSON.stringify({ ...existing, total: totalPages }, null, 2));

        setProgressData(prev => ({
          ...prev,
          [book.fullPath]: { ...prev[book.fullPath], total: totalPages }
        }));
      } catch (err) {
        console.error('Failed to load total pages in modal:', err);
      }
    }

    setProgressModal({ book, totalPages });
  };

  const handleBookClick = (book) => {
    if (contextMenuBook) {
      setContextMenuBook(null);
      return;
    }

    // For cached-only books, check the linked originalPath from the cache
    if (book.cachedOnly) {
      const cacheFilePath = path.join(BOOK_CACHE_FOLDER, book.name + '.json');
      if (fs.existsSync(cacheFilePath)) {
        try {
          const cacheData = JSON.parse(fs.readFileSync(cacheFilePath, 'utf8'));
          if (cacheData.originalPath && fs.existsSync(cacheData.originalPath)) {
            // Linked file exists — open it
            shell.openPath(cacheData.originalPath);
            return;
          }
        } catch (e) {
          console.error('Error reading cache for click:', e);
        }
      }
      // File not found — show link dialog
      setNotFoundModal(book);
      return;
    }

    // For real books, check if the file still exists on disk
    if (!fs.existsSync(book.fullPath)) {
      setNotFoundModal(book);
      return;
    }

    onBookClick(book);
  };

  const handleLinkBook = async (book) => {
    try {
      const selectedPath = await ipcRenderer.invoke('select-pdf-file');
      if (!selectedPath) return; // User cancelled

      const oldName = book.name;
      const newName = path.basename(selectedPath, '.pdf');
      const oldCacheFilePath = path.join(BOOK_CACHE_FOLDER, oldName + '.json');

      // 1. Read the new PDF to get page count and generate a fresh thumbnail
      let totalPages = 0;
      let newThumbnailDataUrl = null;
      try {
        const data = fs.readFileSync(selectedPath);
        const loadingTask = pdfjsLib.getDocument({ data });
        const pdf = await loadingTask.promise;
        totalPages = pdf.numPages;

        // Generate thumbnail from the new PDF
        const page = await pdf.getPage(1);
        const viewport = page.getViewport({ scale: 0.5 });
        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d');
        canvas.width = viewport.width;
        canvas.height = viewport.height;
        await page.render({ canvasContext: context, viewport }).promise;
        newThumbnailDataUrl = canvas.toDataURL('image/jpeg', 0.8);
      } catch (err) {
        console.error('Error reading linked PDF:', err);
      }

      // 2. Update/save the thumbnail with the NEW name
      const oldThumbPath = path.join(THUMBNAIL_CACHE_FOLDER, oldName + '.jpg');
      const newThumbPath = path.join(THUMBNAIL_CACHE_FOLDER, newName + '.jpg');

      // Remove old thumbnail if name changed
      if (oldName !== newName && fs.existsSync(oldThumbPath)) {
        fs.unlinkSync(oldThumbPath);
      }

      if (newThumbnailDataUrl) {
        const base64Data = newThumbnailDataUrl.replace(/^data:image\/jpeg;base64,/, '');
        const buffer = Buffer.from(base64Data, 'base64');
        fs.writeFileSync(newThumbPath, buffer);
      }

      // 3. Build the updated cache data
      const cacheData = fs.existsSync(oldCacheFilePath)
        ? JSON.parse(fs.readFileSync(oldCacheFilePath, 'utf8'))
        : { shelf: shelfKeyForCache, cachedAt: new Date().toISOString() };

      cacheData.name = newName;
      cacheData.originalPath = selectedPath;
      cacheData.totalPages = totalPages;
      cacheData.thumbnailPath = newThumbPath;
      cacheData.cachedAt = new Date().toISOString();

      // 4. If the name changed, delete the old cache file and write a new one
      const newCacheFilePath = path.join(BOOK_CACHE_FOLDER, newName + '.json');
      if (oldName !== newName && fs.existsSync(oldCacheFilePath)) {
        fs.unlinkSync(oldCacheFilePath);
      }
      fs.writeFileSync(newCacheFilePath, JSON.stringify(cacheData, null, 2));

      // 5. Rename progress file if name changed
      if (oldName !== newName) {
        const oldProgPath = path.join(PROGRESS_FOLDER, oldName + '.json');
        const newProgPath = path.join(PROGRESS_FOLDER, newName + '.json');
        if (fs.existsSync(oldProgPath) && !fs.existsSync(newProgPath)) {
          fs.renameSync(oldProgPath, newProgPath);
        }
      }

      setNotFoundModal(null);
      refreshData();
    } catch (err) {
      console.error('Error linking book:', err);
    }
  };

  const deleteBook = (book) => {
    setDeleteModal(book);
    setContextMenuBook(null);
  };

  const confirmDelete = (book) => {
    try {
      // 1. Delete the actual file if it exists
      if (!book.cachedOnly && fs.existsSync(book.fullPath)) {
        fs.unlinkSync(book.fullPath);
      }

      // 2. Decide whether to delete the metadata (JSON cache and Thumbnail)
      // Caching only applies to the 'Read' shelf and only when deleting a real file.
      // If we are deleting a book that is already cachedOnly, we remove it completely.
      const isReadShelf = shelfKey === 'Read';
      const shouldKeepCache = isReadShelf && !book.cachedOnly;

      if (!shouldKeepCache) {
        // Delete the cache entry if it exists
        const cacheFilePath = path.join(BOOK_CACHE_FOLDER, book.name + '.json');
        if (fs.existsSync(cacheFilePath)) {
          fs.unlinkSync(cacheFilePath);
        }
        // Delete cached thumbnail
        const thumbPath = path.join(THUMBNAIL_CACHE_FOLDER, book.name + '.jpg');
        if (fs.existsSync(thumbPath)) {
          fs.unlinkSync(thumbPath);
        }
      }

      refreshData();
      setDeleteModal(null);
    } catch (err) {
      console.error('Error deleting book:', err);
    }
  };

  const moveBook = (book, targetKey, targetCategory) => {
    try {
      const cat = targetCategory === '__root__' ? null : targetCategory;

      if (book.cachedOnly) {
        const cacheFilePath = path.join(BOOK_CACHE_FOLDER, book.name + '.json');
        if (fs.existsSync(cacheFilePath)) {
          const cacheData = JSON.parse(fs.readFileSync(cacheFilePath, 'utf8'));
          cacheData.shelf = targetKey;
          cacheData.category = cat;
          fs.writeFileSync(cacheFilePath, JSON.stringify(cacheData, null, 2));
        }
        refreshData();
        setMoveModal(null);
        setMoveTargetCategory('__root__');
        setContextMenuBook(null);
        return;
      }

      const fileName = path.basename(book.fullPath);
      const BASE_BOOKS = 'C:\\Users\\PC\\Desktop\\database\\Books';
      const targetDir = cat ? path.join(BASE_BOOKS, targetKey, cat) : path.join(BASE_BOOKS, targetKey);

      if (!fs.existsSync(targetDir)) fs.mkdirSync(targetDir, { recursive: true });
      const targetPath = path.join(targetDir, fileName);

      if (fs.existsSync(targetPath)) {
        alert('A book with this name already exists in the target location.');
        return;
      }

      fs.renameSync(book.fullPath, targetPath);

      const cacheFilePath = path.join(BOOK_CACHE_FOLDER, book.name + '.json');
      if (fs.existsSync(cacheFilePath)) {
        const cacheData = JSON.parse(fs.readFileSync(cacheFilePath, 'utf8'));
        cacheData.shelf = targetKey;
        cacheData.originalPath = targetPath;
        cacheData.category = cat;
        fs.writeFileSync(cacheFilePath, JSON.stringify(cacheData, null, 2));
      }

      refreshData();
      setMoveModal(null);
      setMoveTargetCategory('__root__');
      setContextMenuBook(null);
    } catch (err) {
      console.error('Error moving book:', err);
    }
  };

  const changeCategoryForBook = (book, newCategory) => {
    try {
      const cat = newCategory === '__root__' ? null : newCategory;
      const fileName = path.basename(book.fullPath);
      const BASE_BOOKS = 'C:\\Users\\PC\\Desktop\\database\\Books';
      // Determine which shelf this book is in
      const currentShelfKey = shelfKeys.find(s => book.fullPath.includes(`\\${s.key}\\`) || book.fullPath.includes(`/${s.key}/`))?.key || 'Reading';
      const targetDir = cat ? path.join(BASE_BOOKS, currentShelfKey, cat) : path.join(BASE_BOOKS, currentShelfKey);

      if (!fs.existsSync(targetDir)) fs.mkdirSync(targetDir, { recursive: true });
      const targetPath = path.join(targetDir, fileName);

      if (book.fullPath === targetPath) { setCategoryModal(null); return; }
      if (fs.existsSync(targetPath)) { alert('Book already exists there.'); return; }

      fs.renameSync(book.fullPath, targetPath);

      const cacheFilePath = path.join(BOOK_CACHE_FOLDER, book.name + '.json');
      if (fs.existsSync(cacheFilePath)) {
        const cacheData = JSON.parse(fs.readFileSync(cacheFilePath, 'utf8'));
        cacheData.originalPath = targetPath;
        cacheData.category = cat;
        fs.writeFileSync(cacheFilePath, JSON.stringify(cacheData, null, 2));
      }

      refreshData();
      setCategoryModal(null);
    } catch (err) {
      console.error('Error changing category:', err);
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between group/title">
        <div className="flex items-center gap-3">
          <h3 className="text-xl font-bold text-white tracking-tight">{title}</h3>
          <span className="text-[10px] font-bold text-blue-400 bg-blue-500/10 px-2.5 py-1 rounded-full border border-blue-500/20 uppercase tracking-widest">
            {filteredBooks.length} {filteredBooks.length === 1 ? 'Book' : 'Books'}
          </span>
        </div>

        <div className="flex items-center gap-3">
          {categories.length > 0 && (
            <div className="relative" ref={catDropdownRef}>
              <button
                onClick={() => setShowCatDropdown(!showCatDropdown)}
                className="flex items-center gap-2 px-3 py-1.5 bg-white/[0.03] hover:bg-white/[0.06] border border-white/[0.06] rounded-lg text-[11px] font-semibold text-gray-400 hover:text-white transition-all duration-200 cursor-pointer"
              >
                <svg className="w-3 h-3 opacity-50" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
                </svg>
                <span>{selectedCategory === 'all' ? 'All' : selectedCategory}</span>
                <svg className={`w-3 h-3 opacity-40 transition-transform duration-200 ${showCatDropdown ? 'rotate-180' : ''}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="6 9 12 15 18 9"/>
                </svg>
              </button>

              {showCatDropdown && (
                <div className="absolute top-full right-0 mt-1.5 w-48 bg-[#0c0c0c]/98 backdrop-blur-2xl border border-white/10 rounded-xl shadow-[0_16px_48px_rgba(0,0,0,0.6)] py-1.5 z-[100] overflow-hidden">
                  <button
                    onClick={() => changeCategory('all')}
                    className={`w-full flex items-center gap-2.5 px-3.5 py-2 text-left text-[11px] font-medium transition-all cursor-pointer ${
                      selectedCategory === 'all' ? 'bg-blue-500/10 text-blue-400' : 'text-gray-400 hover:bg-white/5 hover:text-white'
                    }`}
                  >
                    <div className={`w-1.5 h-1.5 rounded-full ${selectedCategory === 'all' ? 'bg-blue-400' : 'bg-gray-600'}`} />
                    All
                  </button>
                  {categories.map(cat => {
                    const count = books.filter(b => b.category === cat).length;
                    return (
                      <button
                        key={cat}
                        onClick={() => changeCategory(cat)}
                        className={`w-full flex items-center gap-2.5 px-3.5 py-2 text-left text-[11px] font-medium transition-all cursor-pointer ${
                          selectedCategory === cat ? 'bg-blue-500/10 text-blue-400' : 'text-gray-400 hover:bg-white/5 hover:text-white'
                        }`}
                      >
                        <div className={`w-1.5 h-1.5 rounded-full ${selectedCategory === cat ? 'bg-blue-400' : 'bg-gray-600'}`} />
                        {cat}
                        <span className="ml-auto text-[9px] font-bold text-gray-600">{count}</span>
                      </button>
                    );
                  })}
                  <div className="h-px bg-white/5 mx-2.5 my-1" />
                  <button
                    onClick={() => { setShowCatDropdown(false); if (onManageCategories) onManageCategories(); }}
                    className="w-full flex items-center gap-2.5 px-3.5 py-2 text-left text-[10px] font-bold text-gray-500 hover:text-white hover:bg-white/5 transition-all cursor-pointer uppercase tracking-widest"
                  >
                    <svg className="w-3 h-3 opacity-40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/>
                    </svg>
                    Manage
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {filteredBooks.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 px-4 rounded-3xl border border-dashed border-white/5 bg-white/[0.01]">
          <img src={BookOpenIcon} className="w-10 h-10 mb-4 opacity-20 grayscale" />
          <p className="text-gray-500 text-sm font-medium">{selectedCategory !== 'all' ? `No books in "${selectedCategory}"` : 'No books in this collection'}</p>
        </div>
      ) : (
        <div className="grid grid-cols-4 sm:grid-cols-5 md:grid-cols-6 lg:grid-cols-7 xl:grid-cols-8 gap-4">
          {filteredBooks.map((book) => {
            const thumbnail = book.cover || thumbnails[book.fullPath];
            const progress = progressData[book.fullPath] || (book.progress || { current: 0, total: 0 });
            const safeCurrent = Math.max(0, progress.current || 0);
            const safeTotal = Math.max(0, progress.total || 0);
            const percentage = safeTotal > 0 ? Math.round((safeCurrent / safeTotal) * 100) : 0;

            return (
              <div
                key={book.fullPath}
                className="group relative flex flex-col gap-1 transition-all duration-300"
                onClick={() => handleBookClick(book)}
              >
                {/* Book Card Container */}
                <div
                  className="relative aspect-[2.8/4] rounded-lg overflow-hidden bg-[#0c0c0c] border border-white/5 shadow-2xl transition-all duration-500 group-hover:-translate-y-1.5 group-hover:shadow-blue-500/10 group-hover:border-white/10 cursor-pointer"
                  onContextMenu={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setContextMenuBook({ book, x: e.clientX, y: e.clientY });
                  }}
                >
                  {/* Thumbnail */}
                  {thumbnail ? (
                    <img
                      src={thumbnail}
                      alt={book.name}
                      className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
                    />
                  ) : (
                    <div className="w-full h-full flex flex-col items-center justify-center gap-3 bg-gradient-to-br from-[#111111] to-[#050505]">
                      <div className="w-12 h-12 rounded-2xl bg-white/5 flex items-center justify-center border border-white/5">
                        <img src={BookOpenIcon} className="w-6 h-6 opacity-30 invert grayscale" />
                      </div>
                      <span className="text-[10px] text-gray-500 font-medium uppercase tracking-widest px-4 text-center leading-relaxed">
                        No Preview Available
                      </span>
                    </div>
                  )}

                  {/* Hover Overlay */}
                  <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-all duration-300 backdrop-blur-[2px] flex flex-col items-center justify-center gap-2">
                    <div className="flex flex-col items-center gap-2 translate-y-4 group-hover:translate-y-0 transition-transform duration-300 delay-75">
                      <div className="flex gap-2">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onNotesClick(book);
                          }}
                          className="w-10 h-10 rounded-xl bg-white/10 hover:bg-white/20 border border-white/10 flex items-center justify-center transition-all group/btn cursor-pointer"
                          title="Notes"
                        >
                          <img src={MessageSquareIcon} className="w-[18px] h-[18px] invert brightness-0 transition-transform group-hover/btn:scale-110" style={{ filter: 'brightness(0) invert(1)' }} />
                        </button>

                        {isReadingShelf && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              openProgressModal(book);
                            }}
                            className="w-10 h-10 rounded-xl bg-blue-600/80 hover:bg-blue-600 border border-white/10 flex items-center justify-center transition-all group/btn cursor-pointer"
                            title="Progress"
                          >
                            <img src={BookmarkIcon} className="w-[18px] h-[18px] invert brightness-0 transition-transform group-hover/btn:scale-110" style={{ filter: 'brightness(0) invert(1)' }} />
                          </button>
                        )}
                      </div>

                      {book.fullPath?.toLowerCase().endsWith('.pdf') && (
                        <div className="flex gap-2">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              if (onFastReaderClick) onFastReaderClick(book);
                            }}
                            className="w-10 h-10 rounded-xl bg-amber-500/80 hover:bg-amber-500 border border-white/10 flex items-center justify-center transition-all group/btn cursor-pointer"
                            title="Fast Reader"
                          >
                            <img src={ZapIcon} className="w-[18px] h-[18px] invert brightness-0 transition-transform group-hover/btn:scale-110" style={{ filter: 'brightness(0) invert(1)' }} />
                          </button>

                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              shell.showItemInFolder(book.fullPath);
                            }}
                            className="w-10 h-10 rounded-xl bg-white/10 hover:bg-white/20 border border-white/10 flex items-center justify-center transition-all group/btn cursor-pointer"
                            title="Show in Explorer"
                          >
                            <svg className="w-[18px] h-[18px] text-white transition-transform group-hover/btn:scale-110" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>
                              <circle cx="15" cy="15" r="3"/><path d="m21 21-1.5-1.5"/>
                            </svg>
                          </button>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Progress Badge (on card) */}
                  {isReadingShelf && (
                    <div className="absolute top-3 right-3 px-2 py-1 rounded-lg bg-black/60 backdrop-blur-md border border-white/10 text-[10px] font-bold text-white transition-opacity duration-300 group-hover:opacity-0">
                      {percentage}%
                    </div>
                  )}

                  {/* Cached-only badge */}
                  {book.cachedOnly && (
                    <div className="absolute top-3 left-3 px-2 py-1 rounded-lg bg-amber-500/20 backdrop-blur-md border border-amber-500/30 text-[9px] font-bold text-amber-400 transition-opacity duration-300 group-hover:opacity-0 uppercase tracking-wider">
                      Cached
                    </div>
                  )}
                </div>

                {/* Book Info */}
                <div className="px-1 space-y-1 cursor-pointer">
                  <h4 className="text-[11px] font-semibold text-white/90 truncate group-hover:text-blue-400 transition-colors leading-tight">
                    {book.name}
                  </h4>
                  {isReadingShelf && progress && (
                    <div className="space-y-2 pt-1">
                      <div className="w-full h-0.5 bg-white/5 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-blue-500 rounded-full transition-all duration-700 ease-out"
                          style={{ width: `${percentage}%` }}
                        />
                      </div>
                      <div className="flex justify-between items-center text-[9px] text-gray-600 font-medium uppercase tracking-tighter">
                        <span>P. {safeCurrent} / {safeTotal}</span>
                        {percentage > 0 && <span className="text-blue-400/60">{percentage}%</span>}
                      </div>
                    </div>
                  )}
                  {(title === 'Read' || title === 'Want to Read') && (book.totalPages || progress?.total) > 0 && (
                    <p className="text-[9px] text-gray-600 font-medium uppercase tracking-wider pt-0.5">
                      {book.totalPages || progress?.total} pages
                    </p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Floating Context Toolbar */}
      {contextMenuBook && (
        <>
          <div
            className="fixed inset-0 z-[190]"
            onMouseDown={(e) => { if (e.target === e.currentTarget) { setContextMenuBook(null) } }}
            onContextMenu={(e) => { e.preventDefault(); setContextMenuBook(null); }}
          />
          <div
            className="fixed z-[200] bg-[#0c0c0c]/95 backdrop-blur-2xl border border-white/10 rounded-2xl shadow-[0_20px_50px_rgba(0,0,0,0.5)] p-1.5 flex items-center gap-1.5 animate-in fade-in zoom-in-95 duration-200"
            style={{
              left: Math.min(contextMenuBook.x, window.innerWidth - 250),
              top: Math.min(contextMenuBook.y, window.innerHeight - 100),
            }}
          >
            <button
              onClick={() => { setMoveModal(contextMenuBook.book); setMoveTargetCategory('__root__'); setContextMenuBook(null); }}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/5 text-gray-300 hover:text-white font-bold text-[10px] uppercase tracking-widest transition-all cursor-pointer"
            >
              <img src={MoveIcon} className="w-3.5 h-3.5 opacity-60 group-hover:opacity-100" style={{ filter: 'brightness(0) invert(1)' }} />
              Move
            </button>

            {categories.length > 0 && (
              <button
                onClick={() => { setCategoryModal(contextMenuBook.book); setContextMenuBook(null); }}
                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-violet-500/10 hover:bg-violet-500/20 border border-violet-500/20 text-violet-300 font-bold text-[10px] uppercase tracking-widest transition-all cursor-pointer"
              >
                <svg className="w-3.5 h-3.5 text-violet-400 opacity-70" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>
                Category
              </button>
            )}

            <button
              onClick={() => { deleteBook(contextMenuBook.book); setContextMenuBook(null); }}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 text-red-400 font-bold text-[10px] uppercase tracking-widest transition-all cursor-pointer"
            >
              <img src={TrashIcon} className="w-3.5 h-3.5 opacity-80" style={{ filter: 'invert(37%) sepia(93%) saturate(1352%) hue-rotate(339deg) brightness(103%) contrast(100%)' }} />
              Delete
            </button>
          </div>
        </>
      )}

      {/* Progress Modal */}
      {progressModal && (
        <div
          className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center z-[300] p-4 animate-in fade-in duration-300"
          onMouseDown={(e) => { if (e.target === e.currentTarget) { setProgressModal(null) } }}
        >
          <div
            className="bg-[#0f0f0f] rounded-[2rem] p-8 max-w-sm w-full border border-white/10 shadow-3xl transform animate-in zoom-in-95 duration-300"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex flex-col items-center text-center mb-8">
              <div className="w-16 h-16 rounded-2xl bg-blue-600/20 flex items-center justify-center border border-blue-500/20 mb-4">
                <img src={BookmarkIcon} className="w-8 h-8" style={{ filter: 'invert(52%) sepia(91%) saturate(2853%) hue-rotate(200deg) brightness(101%) contrast(92%)' }} />
              </div>
              <h3 className="text-xl font-bold text-white mb-2">Update Progress</h3>
              <p className="text-sm text-gray-500 max-w-[200px] line-clamp-2">{progressModal.book.name}</p>
            </div>

            <div className="space-y-6">
              <div className="space-y-3">
                <div className="flex justify-between items-end">
                  <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Current Page</label>
                  <span className="text-xs text-gray-400">Total: {progressModal.totalPages}</span>
                </div>
                <div className="relative group">
                  <input
                    type="number"
                    min="0"
                    max={progressModal.totalPages}
                    placeholder={`${progressData[progressModal.book.fullPath]?.current || 0}`}
                    className="w-full bg-white/5 text-white text-2xl font-bold rounded-2xl px-6 py-4 focus:outline-none focus:ring-2 focus:ring-blue-500/50 border border-white/5 transition-all text-center placeholder:text-white/20"
                    autoFocus
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        const val = parseInt(e.target.value) || 0;
                        saveProgress(progressModal.book, val);
                        setProgressModal(null);
                      }
                    }}
                  />
                </div>
              </div>

              <div className="w-full h-2 bg-white/5 rounded-full overflow-hidden">
                <div
                  className="h-full bg-blue-500 transition-all duration-300"
                  style={{
                    width: `${Math.round(((parseInt(document.querySelector('input[type="number"]')?.value) || (progressData[progressModal.book.fullPath]?.current || 0)) / progressModal.totalPages) * 100)}%`
                  }}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 mt-10">
              <button
                onClick={() => setProgressModal(null)}
                className="px-6 py-3.5 bg-white/5 hover:bg-white/10 rounded-2xl text-sm font-semibold text-gray-400 cursor-pointer transition-all active:scale-95"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  const input = document.querySelector('input[type="number"]');
                  const val = parseInt(input.value) || 0;
                  saveProgress(progressModal.book, val);
                  setProgressModal(null);
                }}
                className="px-6 py-3.5 bg-blue-600 hover:bg-blue-500 rounded-2xl text-sm font-bold text-white cursor-pointer transition-all shadow-lg shadow-blue-600/20 active:scale-95"
              >
                Save Progress
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Move Book Modal */}
      {moveModal && (
        <div
          className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center z-[300] p-4 animate-in fade-in duration-300"
          onMouseDown={(e) => { if (e.target === e.currentTarget) { setMoveModal(null) } }}
        >
          <div
            className="bg-[#0f0f0f] rounded-[2rem] p-8 max-w-sm w-full border border-white/10 shadow-3xl transform animate-in zoom-in-95 duration-300"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex flex-col items-center text-center mb-8">
              <div className="w-16 h-16 rounded-2xl bg-blue-600/20 flex items-center justify-center border border-blue-500/20 mb-4">
                <img src={MoveIcon} className="w-8 h-8" style={{ filter: 'invert(52%) sepia(91%) saturate(2853%) hue-rotate(200deg) brightness(101%) contrast(92%)' }} />
              </div>
              <h3 className="text-xl font-bold text-white mb-2">Move Book</h3>
              <p className="text-sm text-gray-500 max-w-[200px] line-clamp-2">{moveModal.name}</p>
            </div>

            <div className="space-y-3">
              <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest pl-2">Select Shelf</label>
              <div className="grid gap-2">
                {shelfKeys.map((shelf) => {
                  const isActive = moveModal.fullPath.includes(`\\${shelf.key}\\`) || moveModal.fullPath.includes(`/${shelf.key}/`);

                  return (
                    <button
                      key={shelf.key}
                      disabled={isActive && moveTargetCategory === (moveModal.category || '__root__')}
                      onClick={() => moveBook(moveModal, shelf.key, moveTargetCategory)}
                      className={`group flex items-center justify-between p-4 rounded-2xl border transition-all ${isActive && moveTargetCategory === (moveModal.category || '__root__')
                        ? 'bg-white/5 border-white/10 opacity-50 cursor-not-allowed'
                        : 'bg-white/[0.02] border-white/5 hover:border-blue-500/40 hover:bg-blue-500/5 cursor-pointer active:scale-[0.98]'
                        }`}
                    >
                      <div className="flex items-center gap-3">
                        <div className={`w-2 h-2 rounded-full ${isActive ? 'bg-gray-500' : 'bg-blue-500'}`} />
                        <span className={`text-sm font-semibold ${isActive ? 'text-gray-500' : 'text-white'}`}>
                          {shelf.title}
                        </span>
                      </div>
                      {isActive && moveTargetCategory === (moveModal.category || '__root__') ? (
                        <span className="text-[9px] font-bold text-gray-600 uppercase tracking-tighter">Current</span>
                      ) : (
                        <img src={CheckIcon} className="w-4 h-4 opacity-0 group-hover:opacity-40 transition-opacity invert" />
                      )}
                    </button>
                  );
                })}
              </div>

              {/* Category selection for move */}
              {categories.length > 0 && (
                <div className="mt-3">
                  <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest pl-2 mb-2 block">Into Category</label>
                  <div className="flex flex-wrap gap-1.5">
                    <button
                      onClick={() => setMoveTargetCategory('__root__')}
                      className={`px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all cursor-pointer border ${
                        moveTargetCategory === '__root__'
                          ? 'bg-blue-500/20 border-blue-500/30 text-blue-400'
                          : 'bg-white/[0.03] border-white/5 text-gray-500 hover:text-white hover:bg-white/5'
                      }`}
                    >
                      None
                    </button>
                    {categories.map(cat => (
                      <button
                        key={cat}
                        onClick={() => setMoveTargetCategory(cat)}
                        className={`px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all cursor-pointer border ${
                          moveTargetCategory === cat
                            ? 'bg-violet-500/20 border-violet-500/30 text-violet-300'
                            : 'bg-white/[0.03] border-white/5 text-gray-500 hover:text-white hover:bg-white/5'
                        }`}
                      >
                        {cat}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="mt-8">
              <button
                onClick={() => { setMoveModal(null); setMoveTargetCategory('__root__'); }}
                className="w-full py-4 bg-white/5 hover:bg-white/10 rounded-2xl text-sm font-semibold text-gray-400 cursor-pointer transition-all active:scale-95"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteModal && (
        <div
          className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center z-[400] p-4 animate-in fade-in duration-300"
          onMouseDown={(e) => { if (e.target === e.currentTarget) { setDeleteModal(null) } }}
        >
          <div
            className="bg-[#0f0f0f] rounded-[2rem] p-8 max-w-sm w-full border border-white/10 shadow-3xl transform animate-in zoom-in-95 duration-300"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex flex-col items-center text-center mb-8">
              <div className="w-16 h-16 rounded-2xl bg-red-600/20 flex items-center justify-center border border-red-500/20 mb-4">
                <img src={TrashIcon} className="w-8 h-8" style={{ filter: 'invert(37%) sepia(93%) saturate(1352%) hue-rotate(339deg) brightness(103%) contrast(100%)' }} />
              </div>
              <h3 className="text-xl font-bold text-white mb-2">Delete Book?</h3>
              <p className="text-sm text-gray-500 px-4">
                Are you sure you want to permanently delete <span className="text-white font-bold">"{deleteModal.name}"</span>?
                This action cannot be undone.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => setDeleteModal(null)}
                className="px-6 py-3.5 bg-white/5 hover:bg-white/10 rounded-2xl text-sm font-semibold text-gray-400 cursor-pointer transition-all active:scale-95"
              >
                Cancel
              </button>
              <button
                onClick={() => confirmDelete(deleteModal)}
                className="px-6 py-3.5 bg-red-600 hover:bg-red-500 rounded-2xl text-sm font-bold text-white cursor-pointer transition-all shadow-lg shadow-red-600/20 active:scale-95"
              >
                {shelfKey === 'Read' && !deleteModal.cachedOnly ? 'Cache Book' : 'Delete Permanently'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Book Not Found Modal */}
      {/* Change Category Modal */}
      {categoryModal && (
        <div
          className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center z-[400] p-4 animate-in fade-in duration-300"
          onMouseDown={(e) => { if (e.target === e.currentTarget) { setCategoryModal(null) } }}
        >
          <div
            className="bg-[#0f0f0f] rounded-[2rem] p-8 max-w-sm w-full border border-white/10 shadow-3xl transform animate-in zoom-in-95 duration-300"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex flex-col items-center text-center mb-6">
              <div className="w-14 h-14 rounded-2xl bg-violet-600/20 flex items-center justify-center border border-violet-500/20 mb-4">
                <svg className="w-7 h-7 text-violet-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>
              </div>
              <h3 className="text-lg font-bold text-white mb-1">Change Category</h3>
              <p className="text-xs text-gray-500 max-w-[200px] line-clamp-2">{categoryModal.name}</p>
            </div>

            <div className="grid gap-2">
              <button
                onClick={() => changeCategoryForBook(categoryModal, '__root__')}
                className={`group flex items-center justify-between p-3.5 rounded-xl border transition-all ${
                  !categoryModal.category
                    ? 'bg-white/5 border-white/10 opacity-50 cursor-not-allowed'
                    : 'bg-white/[0.02] border-white/5 hover:border-violet-500/40 hover:bg-violet-500/5 cursor-pointer active:scale-[0.98]'
                }`}
                disabled={!categoryModal.category}
              >
                <div className="flex items-center gap-3">
                  <div className={`w-2 h-2 rounded-full ${!categoryModal.category ? 'bg-gray-500' : 'bg-violet-400'}`} />
                  <span className={`text-sm font-semibold ${!categoryModal.category ? 'text-gray-500' : 'text-white'}`}>Uncategorized</span>
                </div>
                {!categoryModal.category && <span className="text-[9px] font-bold text-gray-600 uppercase">Current</span>}
              </button>
              {categories.map(cat => (
                <button
                  key={cat}
                  onClick={() => changeCategoryForBook(categoryModal, cat)}
                  className={`group flex items-center justify-between p-3.5 rounded-xl border transition-all ${
                    categoryModal.category === cat
                      ? 'bg-white/5 border-white/10 opacity-50 cursor-not-allowed'
                      : 'bg-white/[0.02] border-white/5 hover:border-violet-500/40 hover:bg-violet-500/5 cursor-pointer active:scale-[0.98]'
                  }`}
                  disabled={categoryModal.category === cat}
                >
                  <div className="flex items-center gap-3">
                    <div className={`w-2 h-2 rounded-full ${categoryModal.category === cat ? 'bg-gray-500' : 'bg-violet-400'}`} />
                    <span className={`text-sm font-semibold ${categoryModal.category === cat ? 'text-gray-500' : 'text-white'}`}>{cat}</span>
                  </div>
                  {categoryModal.category === cat && <span className="text-[9px] font-bold text-gray-600 uppercase">Current</span>}
                </button>
              ))}
            </div>

            <div className="mt-6">
              <button
                onClick={() => setCategoryModal(null)}
                className="w-full py-3.5 bg-white/5 hover:bg-white/10 rounded-2xl text-sm font-semibold text-gray-400 cursor-pointer transition-all active:scale-95"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {notFoundModal && (
        <div
          className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center z-[400] p-4 animate-in fade-in duration-300"
          onMouseDown={(e) => { if (e.target === e.currentTarget) { setNotFoundModal(null) } }}
        >
          <div
            className="bg-[#0f0f0f] rounded-[2rem] p-8 max-w-sm w-full border border-white/10 shadow-3xl transform animate-in zoom-in-95 duration-300"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex flex-col items-center text-center mb-8">
              <div className="w-16 h-16 rounded-2xl bg-amber-600/20 flex items-center justify-center border border-amber-500/20 mb-4">
                <svg className="w-8 h-8 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
                </svg>
              </div>
              <h3 className="text-xl font-bold text-white mb-2">Book Not Found</h3>
              <p className="text-sm text-gray-500 px-4">
                The file for <span className="text-white font-bold">"{notFoundModal.name}"</span> could not be found on disk.
              </p>
              <p className="text-xs text-gray-600 mt-2 px-4">
                You can link it to a new PDF file location.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => setNotFoundModal(null)}
                className="px-6 py-3.5 bg-white/5 hover:bg-white/10 rounded-2xl text-sm font-semibold text-gray-400 cursor-pointer transition-all active:scale-95"
              >
                Cancel
              </button>
              <button
                onClick={() => handleLinkBook(notFoundModal)}
                className="px-6 py-3.5 bg-amber-600 hover:bg-amber-500 rounded-2xl text-sm font-bold text-white cursor-pointer transition-all shadow-lg shadow-amber-600/20 active:scale-95 flex items-center justify-center gap-2"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13.19 8.688a4.5 4.5 0 011.242 7.244l-4.5 4.5a4.5 4.5 0 01-6.364-6.364l1.757-1.757m9.86-2.813a4.5 4.5 0 00-1.242-7.244l4.5-4.5a4.5 4.5 0 016.364 6.364l-1.757 1.757" />
                </svg>
                Link Book
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};


export default BookShelf;