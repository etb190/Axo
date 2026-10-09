import React, { useState, useEffect, useRef } from 'react';
import { useData } from '../../contexts/DataContext';
import BookOpenIcon from '../../assets/icons/book.svg';
import MoveIcon from '../../assets/icons/move-vertical.svg';
import TrashIcon from '../../assets/icons/delete.svg';
import CheckIcon from '../../assets/icons/check.svg';
import ZapIcon from '../../assets/icons/zap.svg';
import MessageSquareIcon from '../../assets/icons/message.svg';
import * as pdfjsLib from 'pdfjs-dist';

const isModern = parseInt(pdfjsLib.version.split('.')[0]) >= 4;
pdfjsLib.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.${isModern ? 'mjs' : 'js'}`;

const fs = window.require('fs');
const path = window.require('path');
const { shell } = window.require('electron');

import BookmarkIcon from '../../assets/icons/bookmark.svg';

const BASE_ARTICLES = 'C:\\Users\\PC\\Desktop\\database\\Articles';
const THUMBNAIL_CACHE = 'C:\\Users\\PC\\Desktop\\database\\Articles\\ThumbnailCache';
const ARTICLE_CACHE_FOLDER = 'C:\\Users\\PC\\Desktop\\database\\Articles\\ArticleCache';
const PROGRESS_FOLDER = 'C:\\Users\\PC\\Desktop\\database\\Articles\\Progress';
const NOTES_FOLDER = 'C:\\Users\\PC\\Desktop\\database\\Articles\\Notes';

try { if (!fs.existsSync(THUMBNAIL_CACHE)) fs.mkdirSync(THUMBNAIL_CACHE, { recursive: true }); } catch { }
try { if (!fs.existsSync(ARTICLE_CACHE_FOLDER)) fs.mkdirSync(ARTICLE_CACHE_FOLDER, { recursive: true }); } catch { }
try { if (!fs.existsSync(PROGRESS_FOLDER)) fs.mkdirSync(PROGRESS_FOLDER, { recursive: true }); } catch { }

const ArticleShelf = ({ title, shelfKey, articles = [], categories = [], onManageCategories, onFastReaderClick, onNotesClick }) => {
  const { refreshData } = useData();
  const [thumbnails, setThumbnails] = useState({});
  const [progressData, setProgressData] = useState({});
  const [progressModal, setProgressModal] = useState(null);
  const [contextMenu, setContextMenu] = useState(null);
  const [moveModal, setMoveModal] = useState(null);
  const [moveTargetCat, setMoveTargetCat] = useState('__root__');
  const [categoryModal, setCategoryModal] = useState(null);
  const [deleteModal, setDeleteModal] = useState(null);
  const [renameModal, setRenameModal] = useState(null);
  const [renameValue, setRenameValue] = useState('');
  const [renameError, setRenameError] = useState('');
  const [newCatInput, setNewCatInput] = useState('');
  const [showNewCatInput, setShowNewCatInput] = useState(false);
  const [showCatDropdown, setShowCatDropdown] = useState(false);
  const [editingCategory, setEditingCategory] = useState(null);
  const [editCategoryValue, setEditCategoryValue] = useState('');
  const catRef = useRef(null);
  const isReadingShelf = title === 'Currently Reading';

  const storageKey = `axo_articles_cat_${shelfKey}`;
  const [selectedCat, setSelectedCat] = useState(() => {
    try { return localStorage.getItem(storageKey) || 'all'; } catch { return 'all'; }
  });

  useEffect(() => {
    if (selectedCat !== 'all' && categories.length > 0 && !categories.includes(selectedCat)) {
      setSelectedCat('all');
      try { localStorage.setItem(storageKey, 'all'); } catch { }
    }
  }, [categories, selectedCat]);

  const changeCat = (c) => { setSelectedCat(c); try { localStorage.setItem(storageKey, c); } catch { } setShowCatDropdown(false); };

  useEffect(() => {
    const h = (e) => { if (catRef.current && !catRef.current.contains(e.target)) setShowCatDropdown(false); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);

  const filtered = selectedCat === 'all' ? articles : articles.filter(a => a.category === selectedCat);

  const shelfKeys = [
    { title: 'Currently Reading', key: 'Reading' },
    { title: 'Want to Read', key: 'WanttoRead' },
    { title: 'Read', key: 'Read' },
  ];

  const saveThumbnailCache = (filePath, dataUrl) => {
    try {
      const name = path.basename(filePath).replace(/\.pdf$/i, '') + '.jpg';
      const cachePath = path.join(THUMBNAIL_CACHE, name);
      const base64 = dataUrl.replace(/^data:image\/jpeg;base64,/, '');
      fs.writeFileSync(cachePath, Buffer.from(base64, 'base64'));
    } catch { }
  };

  const saveArticleCache = async (article, totalPages) => {
    try {
      const cacheFileName = article.name + '.json';
      const cachePath = path.join(ARTICLE_CACHE_FOLDER, cacheFileName);

      // Check if cache already exists for this shelf
      const shelfKeyForCache = shelfKey || (title === 'Want to Read' ? 'WanttoRead' : title === 'Read' ? 'Read' : 'Reading');
      if (fs.existsSync(cachePath)) {
        const existing = JSON.parse(fs.readFileSync(cachePath, 'utf8'));
        if (existing.shelf === shelfKeyForCache && existing.lastUpdated) {
          return;
        }
      }

      const tName = path.basename(article.fullPath).replace(/\.pdf$/i, '') + '.jpg';
      const tPath = path.join(THUMBNAIL_CACHE, tName);
      const hasThumbnail = fs.existsSync(tPath);

      const createdIso = article.createdAt ? (article.createdAt instanceof Date ? article.createdAt.toISOString() : article.createdAt) : new Date().toISOString();
      const cacheData = {
        name: article.name,
        totalPages: totalPages || article.progress?.total || 0,
        thumbnailPath: hasThumbnail ? tPath : null,
        originalPath: article.fullPath,
        shelf: shelfKeyForCache,
        cachedAt: new Date().toISOString(),
        addedToShelfAt: createdIso,
        createdAt: createdIso,
        lastUpdated: article.lastUpdated ? (article.lastUpdated instanceof Date ? article.lastUpdated.toISOString() : article.lastUpdated) : new Date().toISOString(),
        category: article.category || null
      };

      fs.writeFileSync(cachePath, JSON.stringify(cacheData, null, 2));
    } catch (err) {
      console.error('Error saving article cache:', err);
    }
  };

  const generateThumbnail = async (article) => {
    try {
      const data = fs.readFileSync(article.fullPath);
      const pdf = await pdfjsLib.getDocument({ data }).promise;
      const page = await pdf.getPage(1);
      const vp = page.getViewport({ scale: 0.5 });
      const canvas = document.createElement('canvas');
      canvas.width = vp.width; canvas.height = vp.height;
      await page.render({ canvasContext: canvas.getContext('2d'), viewport: vp }).promise;
      const url = canvas.toDataURL('image/jpeg', 0.8);
      saveThumbnailCache(article.fullPath, url);
      return { path: article.fullPath, thumbnail: url };
    } catch { return { path: article.fullPath, thumbnail: null }; }
  };

  useEffect(() => {
    const process = async () => {
      // 1. Initialize progress data from articles prop
      const progMap = {};
      articles.forEach(a => { if (a.progress) progMap[a.fullPath] = a.progress; });
      setProgressData(progMap);

      // 2. Identify missing ones
      const needGen = articles.filter(a => !a.cover && !thumbnails[a.fullPath]);

      // 3. Generate missing ones
      if (needGen.length > 0) {
        const results = await Promise.all(needGen.map(a => generateThumbnail(a)));
        const newThumbs = {};
        results.forEach(r => { if (r.thumbnail) newThumbs[r.path] = r.thumbnail; });
        if (Object.keys(newThumbs).length > 0) setThumbnails(prev => ({ ...prev, ...newThumbs }));
      }

      // 4. Auto-cache articles on WanttoRead and Read shelves
      const isCacheableShelf = shelfKey === 'Read' || shelfKey === 'WanttoRead';
      if (isCacheableShelf) {
        for (const article of articles) {
          if (article.cachedOnly) continue;
          try {
            let totalPages = article.progress?.total || 0;
            if (totalPages === 0 && fs.existsSync(article.fullPath)) {
              try {
                const data = fs.readFileSync(article.fullPath);
                const pdf = await pdfjsLib.getDocument({ data }).promise;
                totalPages = pdf.numPages;
              } catch (e) { }
            }
            saveArticleCache(article, totalPages);
          } catch (e) { }
        }
      }

      // 5. HEAL PASS — retroactively fix any article whose stored total is 0 or missing.
      const healUpdates = {};
      for (const article of articles) {
        const storedTotal = (progMap[article.fullPath]?.total) || 0;
        if (storedTotal > 0) continue;

        // Check progress file on disk directly
        const pFile = path.join(PROGRESS_FOLDER, `${article.name}.json`);
        let diskTotal = 0;
        if (fs.existsSync(pFile)) {
          try { diskTotal = JSON.parse(fs.readFileSync(pFile, 'utf-8')).total || 0; } catch { }
        }

        if (diskTotal > 0) {
          healUpdates[article.fullPath] = { ...(progMap[article.fullPath] || {}), total: diskTotal };
          continue;
        }

        // Page count truly unknown — parse the PDF and persist it
        if (fs.existsSync(article.fullPath)) {
          try {
            const data = fs.readFileSync(article.fullPath);
            const pdf = await pdfjsLib.getDocument({ data }).promise;
            const total = pdf.numPages;
            const existing = fs.existsSync(pFile)
              ? (() => { try { return JSON.parse(fs.readFileSync(pFile, 'utf-8')); } catch { return {}; } })()
              : {};
            fs.writeFileSync(pFile, JSON.stringify({ current: existing.current || 0, ...existing, total }, null, 2));
            healUpdates[article.fullPath] = { current: existing.current || 0, ...existing, total };
            console.log(`[ArticleShelf] Healed page count for "${article.name}": ${total} pages`);
          } catch (e) {
            console.error(`[ArticleShelf] Could not heal page count for "${article.name}":`, e);
          }
        }
      }

      if (Object.keys(healUpdates).length > 0) {
        setProgressData(prev => ({ ...prev, ...healUpdates }));
      }
    };
    if (articles.length > 0) process();
  }, [articles]);


  const saveProgress = (article, currentPage) => {
    const pFile = path.join(PROGRESS_FOLDER, `${article.name}.json`);
    let storedTotal = progressData[article.fullPath]?.total || 0;
    if (storedTotal === 0 && fs.existsSync(pFile)) {
      try { storedTotal = JSON.parse(fs.readFileSync(pFile, 'utf-8')).total || 0; } catch { }
    }
    const clamped = storedTotal > 0 ? Math.max(0, Math.min(currentPage, storedTotal)) : Math.max(0, currentPage);
    const previousCurrent = progressData[article.fullPath]?.current || 0;
    const pagesRead = clamped - previousCurrent;

    try { 
        fs.writeFileSync(pFile, JSON.stringify({ current: clamped, total: storedTotal }, null, 2)); 

        if (pagesRead !== 0) {
            const BASE_DB = 'C:\\Users\\PC\\Desktop\\database';
            const LOGS_FILE = path.join(BASE_DB, 'Books', 'reading_logs.json');
            let logs = [];
            if (fs.existsSync(LOGS_FILE)) {
              logs = JSON.parse(fs.readFileSync(LOGS_FILE, 'utf8'));
            }
            logs.push({
              id: crypto.randomUUID(),
              bookName: article.name,
              bookPath: article.fullPath,
              pages: pagesRead,
              date: new Date().toISOString()
            });
            fs.writeFileSync(LOGS_FILE, JSON.stringify(logs, null, 2));
        }

        refreshData(); 
    } catch { }
    setProgressData(prev => ({ ...prev, [article.fullPath]: { ...prev[article.fullPath], current: clamped, total: storedTotal } }));
  };

  const openProgressModal = async (article) => {
    let totalPages = progressData[article.fullPath]?.total || 0;
    if (totalPages === 0) {
      const pf = path.join(PROGRESS_FOLDER, `${article.name}.json`);
      if (fs.existsSync(pf)) { try { totalPages = JSON.parse(fs.readFileSync(pf, 'utf-8')).total || 0; } catch { } }
    }
    if (totalPages === 0) {
      try {
        const d = fs.readFileSync(article.fullPath);
        const pdf = await pdfjsLib.getDocument({ data: d }).promise;
        totalPages = pdf.numPages;
        const pf = path.join(PROGRESS_FOLDER, `${article.name}.json`);
        let ex = { current: 0 };
        if (fs.existsSync(pf)) { try { ex = JSON.parse(fs.readFileSync(pf, 'utf-8')); } catch { } }
        fs.writeFileSync(pf, JSON.stringify({ ...ex, total: totalPages }, null, 2));
        setProgressData(prev => ({ ...prev, [article.fullPath]: { ...prev[article.fullPath], total: totalPages } }));
      } catch { }
    }
    setProgressModal({ article, totalPages });
  };

  const openArticle = (a) => { shell.openPath(a.fullPath); };

  const moveArticle = (article, targetKey, targetCat) => {
    try {
      const cat = targetCat === undefined ? (article.category || null) : (targetCat === '__root__' ? null : targetCat);
      const nowIso = new Date().toISOString();
      if (article.cachedOnly) {
        const cacheFilePath = path.join(ARTICLE_CACHE_FOLDER, article.name + '.json');
        if (fs.existsSync(cacheFilePath)) {
          try {
            const cacheData = JSON.parse(fs.readFileSync(cacheFilePath, 'utf8'));
            cacheData.shelf = targetKey;
            cacheData.category = cat;
            cacheData.addedToShelfAt = nowIso;
            cacheData.createdAt = nowIso;
            fs.writeFileSync(cacheFilePath, JSON.stringify(cacheData, null, 2));
          } catch (e) {}
        }
        refreshData();
        setMoveModal(null);
        setMoveTargetCat(article.category || '__root__');
        if (typeof setContextMenu === 'function') setContextMenu(null);
        return;
      }
      const fileName = path.basename(article.fullPath);
      const targetDir = cat ? path.join(BASE_ARTICLES, targetKey, cat) : path.join(BASE_ARTICLES, targetKey);
      if (!fs.existsSync(targetDir)) fs.mkdirSync(targetDir, { recursive: true });
      const targetPath = path.join(targetDir, fileName);
      if (fs.existsSync(targetPath)) { alert('Article already exists there.'); return; }
      fs.renameSync(article.fullPath, targetPath);

      const cacheFilePath = path.join(ARTICLE_CACHE_FOLDER, article.name + '.json');
      let cacheData = {};
      if (fs.existsSync(cacheFilePath)) {
        try { cacheData = JSON.parse(fs.readFileSync(cacheFilePath, 'utf8')); } catch (e) {}
      }
      cacheData.name = article.name;
      cacheData.shelf = targetKey;
      cacheData.originalPath = targetPath;
      cacheData.category = cat;
      cacheData.addedToShelfAt = nowIso;
      cacheData.createdAt = nowIso;
      cacheData.lastUpdated = nowIso;
      fs.writeFileSync(cacheFilePath, JSON.stringify(cacheData, null, 2));

      refreshData();
      setMoveModal(null);
      setMoveTargetCat(article.category || '__root__');
    } catch (err) { console.error('Error moving article:', err); }
  };

  const deleteCategoryGlobally = (catName) => {
    try {
      const BASE_ARTICLES = 'C:\\Users\\PC\\Desktop\\database\\Articles';
      const shelfKeysList = ['Reading', 'WanttoRead', 'Read'];
      shelfKeysList.forEach((key) => {
        const catPath = path.join(BASE_ARTICLES, key, catName);
        if (fs.existsSync(catPath)) {
          const files = fs.readdirSync(catPath);
          files.forEach(file => {
            const oldPath = path.join(catPath, file);
            const newPath = path.join(BASE_ARTICLES, key, file);
            fs.renameSync(oldPath, newPath);
            if (file.toLowerCase().endsWith('.pdf')) {
              const articleName = path.basename(file, '.pdf');
              const cacheFilePath = path.join(ARTICLE_CACHE_FOLDER, articleName + '.json');
              if (fs.existsSync(cacheFilePath)) {
                try {
                  const cacheData = JSON.parse(fs.readFileSync(cacheFilePath, 'utf8'));
                  cacheData.originalPath = newPath;
                  cacheData.category = null;
                  fs.writeFileSync(cacheFilePath, JSON.stringify(cacheData, null, 2));
                } catch(e){}
              }
            }
          });
          fs.rmdirSync(catPath);
        }
      });
      refreshData();
    } catch (err) {
      console.error('Error deleting category:', err);
    }
  };

  const editCategoryGlobally = (oldCatName, newCatName) => {
    if (!newCatName || newCatName === oldCatName) {
      setEditingCategory(null);
      return;
    }
    try {
      const BASE_ARTICLES = 'C:\\Users\\PC\\Desktop\\database\\Articles';
      const shelfKeysList = ['Reading', 'WanttoRead', 'Read'];
      shelfKeysList.forEach((key) => {
        const oldCatPath = path.join(BASE_ARTICLES, key, oldCatName);
        const newCatPath = path.join(BASE_ARTICLES, key, newCatName);
        if (fs.existsSync(oldCatPath)) {
          if (!fs.existsSync(newCatPath)) fs.mkdirSync(newCatPath, { recursive: true });
          const files = fs.readdirSync(oldCatPath);
          files.forEach(file => {
            const oldPath = path.join(oldCatPath, file);
            const newPath = path.join(newCatPath, file);
            fs.renameSync(oldPath, newPath);
            if (file.toLowerCase().endsWith('.pdf')) {
              const articleName = path.basename(file, '.pdf');
              const cacheFilePath = path.join(ARTICLE_CACHE_FOLDER, articleName + '.json');
              if (fs.existsSync(cacheFilePath)) {
                try {
                  const cacheData = JSON.parse(fs.readFileSync(cacheFilePath, 'utf8'));
                  cacheData.originalPath = newPath;
                  cacheData.category = newCatName;
                  fs.writeFileSync(cacheFilePath, JSON.stringify(cacheData, null, 2));
                } catch(e){}
              }
            }
          });
          fs.rmdirSync(oldCatPath);
        }
      });
      refreshData();
      setEditingCategory(null);
    } catch (err) {
      console.error('Error editing category:', err);
    }
  };

  const changeCategoryForArticle = (article, newCat) => {
    try {
      const cat = newCat === '__root__' ? null : newCat;
      if (article.cachedOnly) {
        const cacheFilePath = path.join(ARTICLE_CACHE_FOLDER, article.name + '.json');
        if (fs.existsSync(cacheFilePath)) {
          try {
            const cacheData = JSON.parse(fs.readFileSync(cacheFilePath, 'utf8'));
            cacheData.category = cat;
            fs.writeFileSync(cacheFilePath, JSON.stringify(cacheData, null, 2));
          } catch (e) {}
        }
        refreshData();
        setCategoryModal(null);
        return;
      }
      const fileName = path.basename(article.fullPath);
      const curShelf = shelfKeys.find(s => article.fullPath.includes(`\\${s.key}\\`) || article.fullPath.includes(`/${s.key}/`))?.key || 'Reading';
      const targetDir = cat ? path.join(BASE_ARTICLES, curShelf, cat) : path.join(BASE_ARTICLES, curShelf);
      if (!fs.existsSync(targetDir)) fs.mkdirSync(targetDir, { recursive: true });
      const targetPath = path.join(targetDir, fileName);
      if (article.fullPath === targetPath) { setCategoryModal(null); return; }
      if (fs.existsSync(targetPath)) { alert('Already exists there.'); return; }
      fs.renameSync(article.fullPath, targetPath);

      const cacheFilePath = path.join(ARTICLE_CACHE_FOLDER, article.name + '.json');
      if (fs.existsSync(cacheFilePath)) {
        try {
          const cacheData = JSON.parse(fs.readFileSync(cacheFilePath, 'utf8'));
          cacheData.originalPath = targetPath;
          cacheData.category = cat;
          fs.writeFileSync(cacheFilePath, JSON.stringify(cacheData, null, 2));
        } catch (e) {}
      }

      refreshData();
      setCategoryModal(null);
    } catch (err) { console.error(err); }
  };

  const deleteArticle = (article) => {
    try { fs.unlinkSync(article.fullPath); refreshData(); setDeleteModal(null); } catch (err) { console.error(err); }
  };

  const openRenameModal = (article) => {
    setRenameValue(article.name);
    setRenameError('');
    setRenameModal(article);
    setContextMenu(null);
  };

  const confirmRename = (article) => {
    const newName = renameValue.trim();
    if (!newName || newName === article.name) {
      setRenameModal(null);
      return;
    }

    try {
      const oldName = article.name;
      const dir = path.dirname(article.fullPath);
      const newFilePath = path.join(dir, newName + '.pdf');

      if (fs.existsSync(newFilePath)) {
        setRenameError('An article with this name already exists in the same folder.');
        return;
      }

      // 1. Rename the actual PDF file
      if (fs.existsSync(article.fullPath)) {
        fs.renameSync(article.fullPath, newFilePath);
      }

      // 2. Rename progress file
      const oldProgPath = path.join(PROGRESS_FOLDER, oldName + '.json');
      const newProgPath = path.join(PROGRESS_FOLDER, newName + '.json');
      if (fs.existsSync(oldProgPath) && !fs.existsSync(newProgPath)) {
        fs.renameSync(oldProgPath, newProgPath);
      }

      // 3. Rename thumbnail cache
      const oldThumbPath = path.join(THUMBNAIL_CACHE, oldName + '.jpg');
      const newThumbPath = path.join(THUMBNAIL_CACHE, newName + '.jpg');
      if (fs.existsSync(oldThumbPath) && !fs.existsSync(newThumbPath)) {
        fs.renameSync(oldThumbPath, newThumbPath);
      }

      // 4. Rename notes file
      const oldNotesPath = path.join(NOTES_FOLDER, oldName + '.json');
      const newNotesPath = path.join(NOTES_FOLDER, newName + '.json');
      if (fs.existsSync(oldNotesPath) && !fs.existsSync(newNotesPath)) {
        fs.renameSync(oldNotesPath, newNotesPath);
      }

      refreshData();
      setRenameModal(null);
    } catch (err) {
      console.error('Error renaming article:', err);
    }
  };

  return (
    <div className="space-y-3">
      {/* Title Row */}
      <div className="flex items-center justify-between group/title">
        <div className="flex items-center gap-3">
          <h3 className="text-xl font-bold text-white tracking-tight">{title}</h3>
          <span className="text-[10px] font-bold text-emerald-400 bg-emerald-500/10 px-2.5 py-1 rounded-full border border-emerald-500/20 uppercase tracking-widest">
            {filtered.length} {filtered.length === 1 ? 'Article' : 'Articles'}
          </span>
        </div>
        <div className="flex items-center gap-3">
          {categories.length > 0 && (
            <div className="relative" ref={catRef}>
              <button onClick={() => setShowCatDropdown(!showCatDropdown)} className="flex items-center gap-2 px-3 py-1.5 bg-white/[0.03] hover:bg-white/[0.06] border border-white/[0.06] rounded-lg text-[11px] font-semibold text-gray-400 hover:text-white transition-all cursor-pointer">
                <svg className="w-3 h-3 opacity-50" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" /></svg>
                <span>{selectedCat === 'all' ? 'All' : selectedCat}</span>
                <svg className={`w-3 h-3 opacity-40 transition-transform duration-200 ${showCatDropdown ? 'rotate-180' : ''}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="6 9 12 15 18 9" /></svg>
              </button>
              {showCatDropdown && (
                <div className="absolute top-full right-0 mt-1.5 w-48 bg-[#0c0c0c]/98 backdrop-blur-2xl border border-white/10 rounded-xl shadow-[0_16px_48px_rgba(0,0,0,0.6)] py-1.5 z-[100]">
                  <div className="overflow-y-auto custom-scrollbar max-h-[140px]">
                    <button onClick={() => changeCat('all')} className={`w-full flex items-center gap-2.5 px-3.5 py-2 text-left text-[11px] font-medium transition-all cursor-pointer ${selectedCat === 'all' ? 'bg-emerald-500/10 text-emerald-400' : 'text-gray-400 hover:bg-white/5 hover:text-white'}`}>
                      <div className={`w-1.5 h-1.5 rounded-full ${selectedCat === 'all' ? 'bg-emerald-400' : 'bg-gray-600'}`} /> All
                    </button>
                    {categories.map(cat => (
                      <button key={cat} onClick={() => changeCat(cat)} className={`w-full flex items-center gap-2.5 px-3.5 py-2 text-left text-[11px] font-medium transition-all cursor-pointer ${selectedCat === cat ? 'bg-emerald-500/10 text-emerald-400' : 'text-gray-400 hover:bg-white/5 hover:text-white'}`}>
                        <div className={`w-1.5 h-1.5 rounded-full ${selectedCat === cat ? 'bg-emerald-400' : 'bg-gray-600'}`} /> {cat}
                        <span className="ml-auto text-[9px] font-bold text-gray-600">{articles.filter(a => a.category === cat).length}</span>
                      </button>
                    ))}
                  </div>
                  <div className="h-px bg-white/5 mx-2.5 my-1 shrink-0" />
                  <button onClick={() => { setShowCatDropdown(false); if (onManageCategories) onManageCategories(); }} className="w-full flex items-center gap-2.5 px-3.5 py-2 text-left text-[10px] font-bold text-gray-500 hover:text-white hover:bg-white/5 transition-all cursor-pointer uppercase tracking-widest">
                    <svg className="w-3 h-3 opacity-40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" /></svg>
                    Manage
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Grid */}
      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 px-4 rounded-3xl border border-dashed border-white/5 bg-white/[0.01]">
          <img src={BookOpenIcon} className="w-10 h-10 mb-4 opacity-20 grayscale" />
          <p className="text-gray-500 text-sm font-medium">{selectedCat !== 'all' ? `No articles in "${selectedCat}"` : 'No articles here yet'}</p>
        </div>
      ) : (
        <div className="grid grid-cols-4 sm:grid-cols-5 md:grid-cols-6 lg:grid-cols-7 xl:grid-cols-8 gap-4">
          {filtered.map(article => {
            const thumb = article.cover || thumbnails[article.fullPath];
            const prog = progressData[article.fullPath] || (article.progress || { current: 0, total: 0 });
            const safeCurrent = Math.max(0, prog.current || 0);
            const safeTotal = Math.max(0, prog.total || 0);
            const pct = safeTotal > 0 ? Math.round((safeCurrent / safeTotal) * 100) : 0;
            return (
              <div key={article.fullPath} className="group relative flex flex-col gap-1 transition-all duration-300" onClick={() => openArticle(article)}>
                <div
                  className="relative aspect-[2.8/4] rounded-lg overflow-hidden bg-[#0c0c0c] border border-white/5 shadow-2xl transition-all duration-500 group-hover:-translate-y-1.5 group-hover:shadow-emerald-500/10 group-hover:border-white/10 cursor-pointer"
                  onContextMenu={(e) => { e.preventDefault(); e.stopPropagation(); setContextMenu({ article, x: e.clientX, y: e.clientY }); }}
                >
                  {thumb ? (
                    <img src={thumb} alt={article.name} className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110" />
                  ) : (
                    <div className="w-full h-full flex flex-col items-center justify-center gap-3 bg-gradient-to-br from-[#111] to-[#050505]">
                      <div className="w-12 h-12 rounded-2xl bg-white/5 flex items-center justify-center border border-white/5">
                        <img src={BookOpenIcon} className="w-6 h-6 opacity-30 invert grayscale" />
                      </div>
                    </div>
                  )}
                  {/* Progress Badge (on card) */}
                  {isReadingShelf && safeTotal > 0 && (
                    <div className="absolute top-3 right-3 px-2 py-1 rounded-lg bg-black/60 backdrop-blur-md border border-white/10 text-[10px] font-bold text-white transition-opacity duration-300 group-hover:opacity-0">
                      {pct}%
                    </div>
                  )}
                  {/* Cached-only badge */}
                  {article.cachedOnly && (
                    <div className="absolute top-3 left-3 px-2 py-1 rounded-lg bg-amber-500/20 backdrop-blur-md border border-amber-500/30 text-[9px] font-bold text-amber-400 transition-opacity duration-300 group-hover:opacity-0 uppercase tracking-wider">
                      Cached
                    </div>
                  )}
                  {/* Progress bar for reading shelf */}
                  {isReadingShelf && safeTotal > 0 && (
                    <div className="absolute bottom-0 left-0 right-0 h-1 bg-black/50">
                      <div className="h-full bg-emerald-400 transition-all duration-500" style={{ width: `${pct}%` }} />
                    </div>
                  )}
                  {/* Hover overlay */}
                  <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-all duration-300 backdrop-blur-[2px] flex flex-col items-center justify-center gap-2">
                    <div className="flex flex-col items-center gap-2 translate-y-4 group-hover:translate-y-0 transition-transform duration-300 delay-75">
                      <div className="flex gap-2">
                        <button onClick={(e) => { e.stopPropagation(); if (onNotesClick) onNotesClick(article); }}
                          className="w-10 h-10 rounded-xl bg-white/10 hover:bg-white/20 border border-white/10 flex items-center justify-center transition-all group/btn cursor-pointer" title="Notes">
                          <img src={MessageSquareIcon} className="w-[18px] h-[18px] transition-transform group-hover/btn:scale-110" style={{ filter: 'brightness(0) invert(1)' }} />
                        </button>
                        {isReadingShelf && (
                          <button onClick={(e) => { e.stopPropagation(); openProgressModal(article); }}
                            className="w-10 h-10 rounded-xl bg-emerald-600/80 hover:bg-emerald-600 border border-white/10 flex items-center justify-center transition-all group/btn cursor-pointer" title="Update Progress">
                            <img src={BookmarkIcon} className="w-[18px] h-[18px] transition-transform group-hover/btn:scale-110" style={{ filter: 'brightness(0) invert(1)' }} />
                          </button>
                        )}
                      </div>

                      {article.fullPath?.toLowerCase().endsWith('.pdf') && (
                        <div className="flex gap-2">
                          {isReadingShelf && onFastReaderClick && (
                            <button onClick={(e) => { e.stopPropagation(); onFastReaderClick(article); }}
                              className="w-10 h-10 rounded-xl bg-amber-500/80 hover:bg-amber-500 border border-white/10 flex items-center justify-center transition-all group/btn cursor-pointer" title="Fast Reader">
                              <img src={ZapIcon} className="w-[18px] h-[18px]" style={{ filter: 'brightness(0) invert(1)' }} />
                            </button>
                          )}
                          <button onClick={(e) => { e.stopPropagation(); shell.showItemInFolder(article.fullPath); }}
                            className="w-10 h-10 rounded-xl bg-white/10 hover:bg-white/20 border border-white/10 flex items-center justify-center transition-all group/btn cursor-pointer" title="Show in Explorer">
                            <svg className="w-[18px] h-[18px] text-white transition-transform group-hover/btn:scale-110" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" /><circle cx="15" cy="15" r="3" /><path d="m21 21-1.5-1.5" />
                            </svg>
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
                <div className="px-1 cursor-pointer space-y-1 relative group/peek">
                  <p className="text-[11px] font-semibold text-gray-300 group-hover:text-white truncate leading-tight">
                    {article.name}
                  </p>
                  
                  {/* Peek Tooltip */}
                  <div className="absolute bottom-full left-0 mb-2 w-max max-w-[200px] pointer-events-none opacity-0 group-hover/peek:opacity-100 translate-y-2 group-hover/peek:translate-y-0 transition-all duration-300 z-[150]">
                    <div className="bg-[#0c0c0c]/95 backdrop-blur-xl border border-white/10 rounded-xl p-2.5 shadow-2xl">
                      <p className="text-[10px] font-medium text-white leading-relaxed break-words">{article.name}</p>
                      <div className="absolute top-full left-4 -mt-1 w-2 h-2 bg-[#0c0c0c] border-r border-b border-white/10 rotate-45" />
                    </div>
                  </div>

                  {isReadingShelf && safeTotal > 0 && (
                    <div className="space-y-1.5 pt-0.5">
                      <div className="w-full h-0.5 bg-white/5 rounded-full overflow-hidden">
                        <div className="h-full bg-emerald-500 transition-all duration-500" style={{ width: `${pct}%` }} />
                      </div>
                      <div className="flex justify-between items-center text-[9px] text-gray-600 font-medium uppercase tracking-tighter">
                        <span>P. {safeCurrent} / {safeTotal}</span>
                        {pct > 0 && <span className="text-emerald-400/60">{pct}%</span>}
                      </div>
                    </div>
                  )}
                  {(shelfKey === 'Read' || shelfKey === 'WanttoRead') && safeTotal > 0 && (
                    <p className="text-[9px] text-gray-600 font-medium uppercase tracking-wider pt-0.5">
                      {safeTotal} pages
                    </p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Context Menu */}
      {contextMenu && (
        <div className="fixed inset-0 z-[200]" onMouseDown={(e) => { if (e.target === e.currentTarget) { setContextMenu(null) } }}>
          <div className="absolute flex flex-col gap-1.5 p-2 bg-[#0c0c0c]/98 backdrop-blur-2xl border border-white/10 rounded-2xl shadow-[0_20px_60px_rgba(0,0,0,0.7)] min-w-[140px]"
            style={{ top: Math.min(contextMenu.y, window.innerHeight - 200), left: Math.min(contextMenu.x, window.innerWidth - 200) }}
            onClick={(e) => e.stopPropagation()}>
            <button onClick={() => { setMoveModal(contextMenu.article); setMoveTargetCat(contextMenu.article.category || '__root__'); setContextMenu(null); }}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/5 text-gray-300 hover:text-white font-bold text-[10px] uppercase tracking-widest transition-all cursor-pointer w-full">
              <img src={MoveIcon} className="w-3.5 h-3.5 opacity-60" style={{ filter: 'brightness(0) invert(1)' }} /> Move
            </button>

            <div className="grid grid-cols-2 gap-1.5">
              <button onClick={() => openRenameModal(contextMenu.article)}
                className="flex items-center justify-center gap-2 px-3 py-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/5 text-gray-300 hover:text-white font-bold text-[10px] uppercase tracking-widest transition-all cursor-pointer">
                <svg className="w-3.5 h-3.5 opacity-60" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ filter: 'brightness(0) invert(1)' }}><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" /><path d="m15 5 4 4" /></svg>
              </button>

              <button onClick={() => { setCategoryModal(contextMenu.article); setContextMenu(null); }}
                className="flex items-center justify-center gap-2 px-3 py-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/5 text-gray-300 hover:text-white font-bold text-[10px] uppercase tracking-widest transition-all cursor-pointer">
                <svg className="w-3.5 h-3.5 opacity-60" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ filter: 'brightness(0) invert(1)' }}><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" /></svg>
              </button>
            </div>

            <button onClick={() => { setDeleteModal(contextMenu.article); setContextMenu(null); }}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 text-red-400 hover:text-red-300 font-bold text-[10px] uppercase tracking-widest transition-all cursor-pointer w-full">
              <img src={TrashIcon} className="w-3.5 h-3.5 opacity-60" style={{ filter: 'invert(37%) sepia(93%) saturate(1352%) hue-rotate(339deg) brightness(103%) contrast(100%)' }} /> Delete
            </button>
          </div>
        </div>
      )}

      {/* Move Modal */}
      {moveModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center z-[400] p-4 animate-in fade-in duration-300" onMouseDown={(e) => { if (e.target === e.currentTarget) { setMoveModal(null); setMoveTargetCat(moveModal?.category || '__root__'); } }}>
          <div className="bg-[#0f0f0f] rounded-[2rem] p-8 max-w-sm w-full border border-white/10 shadow-3xl transform animate-in zoom-in-95 duration-300" onClick={e => e.stopPropagation()}>
            <div className="flex flex-col items-center text-center mb-4">
              <div className="w-8 h-8 rounded-2xl bg-emerald-600/20 flex items-center justify-center border border-emerald-500/20 mb-1">
                <img src={MoveIcon} className="w-4 h-4" style={{ filter: 'brightness(0) invert(1)' }} />
              </div>
              <h3 className="text-xl font-bold text-white mb-2">Move Article</h3>
              <p className="text-sm text-gray-500 max-w-[200px] line-clamp-2">{moveModal.name}</p>
            </div>
            <div className="space-y-3">
              <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest pl-2">Select Shelf</label>
              <div className="grid gap-2">
                {shelfKeys.map(shelf => {
                  const isActive = moveModal.fullPath
                    ? (moveModal.fullPath.includes(`\\${shelf.key}\\`) || moveModal.fullPath.includes(`/${shelf.key}/`))
                    : (moveModal.shelf === shelf.key);
                  return (
                    <button key={shelf.key} disabled={isActive} onClick={() => moveArticle(moveModal, shelf.key, moveModal.category || '__root__')}
                      className={`group flex items-center justify-between p-4 rounded-2xl border transition-all ${isActive ? 'bg-white/5 border-white/10 opacity-50 cursor-not-allowed' : 'bg-white/[0.02] border-white/5 hover:border-emerald-500/40 hover:bg-emerald-500/5 cursor-pointer active:scale-[0.98]'}`}>
                      <div className="flex items-center gap-3">
                        <div className={`w-2 h-2 rounded-full ${isActive ? 'bg-gray-500' : 'bg-emerald-500'}`} />
                        <span className={`text-sm font-semibold ${isActive ? 'text-gray-500' : 'text-white'}`}>{shelf.title}</span>
                      </div>
                      {isActive ? <span className="text-[9px] font-bold text-gray-600 uppercase tracking-tighter">Current</span> : <img src={CheckIcon} className="w-4 h-4 opacity-0 group-hover:opacity-40 transition-opacity invert" />}
                    </button>
                  );
                })}
              </div>
            </div>
            <div className="mt-8">
              <button onClick={() => { setMoveModal(null); setMoveTargetCat(moveModal?.category || '__root__'); }} className="w-full py-4 bg-white/5 hover:bg-white/10 rounded-2xl text-sm font-semibold text-gray-400 cursor-pointer transition-all active:scale-95">Cancel</button>
            </div>
          </div>
        </div>
      )}
        {/* Category Modal */}
      {categoryModal && (
        <div
          className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center z-[400] p-4 animate-in fade-in duration-300"
          onMouseDown={(e) => { if (e.target === e.currentTarget) { setCategoryModal(null) } }}
        >
          <div
            className="bg-[#0f0f0f] rounded-[2rem] p-8 max-w-sm w-full border border-white/10 shadow-3xl transform animate-in zoom-in-95 duration-300"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex flex-col items-center text-center mb-4">
              <h3 className="text-xl font-bold text-white">Change Category</h3>
            </div>

            <div className="space-y-3">
              <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest pl-2">Select Category</label>
              <div className="grid gap-2 max-h-[220px] overflow-y-auto pr-1 custom-scrollbar">
                <button
                  onClick={() => changeCategoryForArticle(categoryModal, '__root__')}
                  disabled={!categoryModal.category}
                  className={`group flex items-center justify-between p-4 rounded-2xl border transition-all ${!categoryModal.category
                    ? 'bg-white/5 border-white/10 opacity-50 cursor-not-allowed'
                    : 'bg-white/[0.02] border-white/5 hover:border-emerald-500/40 hover:bg-emerald-500/5 cursor-pointer active:scale-[0.98]'
                    }`}
                >
                  <div className="flex items-center gap-3">
                    <div className={`w-2 h-2 rounded-full ${!categoryModal.category ? 'bg-gray-500' : 'bg-emerald-400'}`} />
                    <span className={`text-sm font-semibold ${!categoryModal.category ? 'text-gray-500' : 'text-white'}`}>Uncategorized</span>
                  </div>
                  {!categoryModal.category && <span className="text-[9px] font-bold text-gray-600 uppercase tracking-tighter">Current</span>}
                </button>

                {categories.map(cat => {
                  const isCurrent = categoryModal.category === cat;
                  return (
                    <div key={cat} className="group relative w-full">
                      {editingCategory === cat ? (
                        <div className="flex items-center gap-1.5 w-full p-3 rounded-2xl border bg-white/[0.02] border-white/5">
                          <input
                            type="text"
                            value={editCategoryValue}
                            onChange={(e) => setEditCategoryValue(e.target.value)}
                            className="flex-1 w-full min-w-0 bg-white/5 text-white text-xs font-medium rounded-xl px-3 py-2 focus:outline-none focus:ring-1 focus:ring-emerald-500/50 border border-white/5"
                            autoFocus
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') editCategoryGlobally(cat, editCategoryValue.trim());
                              if (e.key === 'Escape') setEditingCategory(null);
                            }}
                          />
                          <button
                            onClick={() => editCategoryGlobally(cat, editCategoryValue.trim())}
                            className="p-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white transition-all cursor-pointer flex-shrink-0"
                            title="Save"
                          >
                            <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
                          </button>
                          <button
                            onClick={() => setEditingCategory(null)}
                            className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-white transition-all cursor-pointer flex-shrink-0"
                            title="Cancel"
                          >
                            <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                          </button>
                        </div>
                      ) : (
                        <div
                          onClick={() => {
                            if (!isCurrent) {
                              changeCategoryForArticle(categoryModal, cat);
                            }
                          }}
                          className={`w-full flex items-center justify-between p-4 rounded-2xl border transition-all ${isCurrent
                            ? 'bg-white/5 border-white/10 opacity-50 cursor-not-allowed'
                            : 'bg-white/[0.02] border-white/5 hover:border-emerald-500/40 hover:bg-emerald-500/5 cursor-pointer active:scale-[0.98]'
                            }`}
                        >
                          <div className="flex items-center gap-3">
                            <div className={`w-2 h-2 rounded-full ${isCurrent ? 'bg-gray-500' : 'bg-emerald-400'}`} />
                            <span className={`text-sm font-semibold ${isCurrent ? 'text-gray-500' : 'text-white'}`}>{cat}</span>
                          </div>

                          <div className="flex items-center gap-1">
                            {isCurrent && <span className="text-[9px] font-bold text-gray-600 uppercase tracking-tighter mr-1 group-hover:hidden">Current</span>}

                            <button
                              onClick={(e) => { e.stopPropagation(); setEditingCategory(cat); setEditCategoryValue(cat); }}
                              className="p-1.5 rounded-lg hover:bg-blue-500/20 text-gray-400 hover:text-blue-400 transition-all opacity-0 group-hover:opacity-100 cursor-pointer"
                              title="Edit"
                            >
                              <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" /><path d="m15 5 4 4" /></svg>
                            </button>
                            <button
                              onClick={(e) => { e.stopPropagation(); deleteCategoryGlobally(cat); }}
                              className="p-1.5 rounded-lg hover:bg-red-500/20 text-gray-400 hover:text-red-400 transition-all opacity-0 group-hover:opacity-100 cursor-pointer"
                              title="Delete"
                            >
                              <img src={TrashIcon} className="w-3.5 h-3.5 opacity-70" style={{ filter: 'brightness(0) invert(1)' }} />
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Create new category */}
              <div className="pt-1">
                {showNewCatInput ? (
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={newCatInput}
                      onChange={(e) => setNewCatInput(e.target.value)}
                      placeholder="Category name..."
                      className="flex-1 bg-white/5 text-white text-xs font-medium rounded-2xl px-4 py-3.5 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 border border-white/5 transition-all placeholder:text-white/20"
                      autoFocus
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && newCatInput.trim()) {
                          changeCategoryForArticle(categoryModal, newCatInput.trim());
                          setNewCatInput('');
                          setShowNewCatInput(false);
                        }
                        if (e.key === 'Escape') {
                          setNewCatInput('');
                          setShowNewCatInput(false);
                        }
                      }}
                    />
                    <button
                      onClick={() => {
                        if (newCatInput.trim()) {
                          changeCategoryForArticle(categoryModal, newCatInput.trim());
                          setNewCatInput('');
                          setShowNewCatInput(false);
                        }
                      }}
                      disabled={!newCatInput.trim()}
                      className="px-4 py-3.5 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white text-[10px] font-bold uppercase tracking-wider transition-all cursor-pointer active:scale-95 disabled:opacity-30 disabled:cursor-not-allowed"
                    >
                      Add
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => setShowNewCatInput(true)}
                    className="group flex items-center gap-3 p-4 rounded-2xl border border-dashed border-white/10 hover:border-emerald-500/40 hover:bg-emerald-500/5 transition-all cursor-pointer active:scale-[0.98] w-full"
                  >
                    <div className="w-5 h-5 rounded-md bg-emerald-500/20 flex items-center justify-center">
                      <svg className="w-3 h-3 text-emerald-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>
                    </div>
                    <span className="text-sm font-semibold text-gray-400 group-hover:text-white transition-colors">New Category</span>
                  </button>
                )}
              </div>
            </div>

            <div className="mt-8">
              <button
                onClick={() => { setCategoryModal(null); setShowNewCatInput(false); setNewCatInput(''); setEditingCategory(null); }}
                className="w-full py-4 bg-white/5 hover:bg-white/10 rounded-2xl text-sm font-semibold text-gray-400 cursor-pointer transition-all active:scale-95"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Modal */}
      {deleteModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center z-[400] p-4" onMouseDown={(e) => { if (e.target === e.currentTarget) { setDeleteModal(null) } }}>
          <div className="bg-[#0f0f0f] rounded-[2rem] p-8 max-w-sm w-full border border-white/10" onClick={e => e.stopPropagation()}>
            <h3 className="text-lg font-bold text-white mb-2 text-center">Delete Article?</h3>
            <p className="text-xs text-gray-500 text-center mb-6">This will permanently delete <span className="text-white font-semibold">"{deleteModal.name}"</span></p>
            <div className="flex gap-3">
              <button onClick={() => setDeleteModal(null)} className="flex-1 py-3.5 bg-white/5 hover:bg-white/10 rounded-2xl text-sm font-semibold text-gray-400 cursor-pointer transition-all">Cancel</button>
              <button onClick={() => deleteArticle(deleteModal)} className="flex-1 py-3.5 bg-red-500/20 hover:bg-red-500/30 border border-red-500/30 rounded-2xl text-sm font-bold text-red-400 cursor-pointer transition-all">Delete</button>
            </div>
          </div>
        </div>
      )}

      {/* Rename Modal */}
      {renameModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center z-[400] p-4 animate-in fade-in duration-300" onMouseDown={(e) => { if (e.target === e.currentTarget) setRenameModal(null) }}>
          <div className="bg-[#0f0f0f] rounded-[2rem] p-8 max-w-sm w-full border border-white/10 shadow-3xl transform animate-in zoom-in-95 duration-300" onClick={e => e.stopPropagation()}>
            <div className="flex flex-col items-center text-center mb-8">
              <div className="w-16 h-16 rounded-2xl bg-cyan-600/20 flex items-center justify-center border border-cyan-500/20 mb-4">
                <svg className="w-8 h-8 text-cyan-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" /><path d="m15 5 4 4" /></svg>
              </div>
              <h3 className="text-xl font-bold text-white mb-2">Rename Article</h3>
              <p className="text-sm text-gray-500 max-w-[200px] line-clamp-2">{renameModal.name}</p>
            </div>
            <div className="space-y-3">
              <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest pl-2">New Name</label>
              <input
                type="text"
                value={renameValue}
                onChange={(e) => setRenameValue(e.target.value)}
                className="w-full bg-white/5 text-white text-sm font-medium rounded-2xl px-5 py-4 focus:outline-none focus:ring-2 focus:ring-cyan-500/50 border border-white/5 transition-all placeholder:text-white/20"
                placeholder="Enter new name..."
                autoFocus
                onKeyDown={(e) => { if (e.key === 'Enter') confirmRename(renameModal); if (e.key === 'Escape') setRenameModal(null); }}
                onFocus={(e) => e.target.select()}
              />
              {renameError && (
                <div className="flex items-center gap-2 px-4 py-2.5 bg-red-500/10 border border-red-500/20 rounded-xl">
                  <svg className="w-3.5 h-3.5 text-red-400 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><line x1="15" y1="9" x2="9" y2="15" /><line x1="9" y1="9" x2="15" y2="15" /></svg>
                  <span className="text-[11px] font-medium text-red-400">{renameError}</span>
                </div>
              )}
            </div>
            <div className="grid grid-cols-2 gap-3 mt-10">
              <button onClick={() => setRenameModal(null)} className="px-6 py-3.5 bg-white/5 hover:bg-white/10 rounded-2xl text-sm font-semibold text-gray-400 cursor-pointer transition-all active:scale-95">Cancel</button>
              <button
                onClick={() => confirmRename(renameModal)}
                disabled={!renameValue.trim() || renameValue.trim() === renameModal.name}
                className="px-6 py-3.5 bg-cyan-600 hover:bg-cyan-500 rounded-2xl text-sm font-bold text-white cursor-pointer transition-all shadow-lg shadow-cyan-600/20 active:scale-95 disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:bg-cyan-600"
              >Rename</button>
            </div>
          </div>
        </div>
      )}

      {/* Progress Modal */}
      {progressModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center z-[400] p-4" onMouseDown={(e) => { if (e.target === e.currentTarget) { setProgressModal(null) } }}>
          <div className="bg-[#0f0f0f] rounded-[2rem] p-8 max-w-sm w-full border border-white/10" onClick={e => e.stopPropagation()}>
            <div className="flex flex-col items-center text-center mb-6">
              <div className="w-14 h-14 rounded-2xl bg-emerald-600/20 flex items-center justify-center border border-emerald-500/20 mb-3">
                <img src={BookmarkIcon} className="w-7 h-7" style={{ filter: 'invert(60%) sepia(90%) saturate(400%) hue-rotate(100deg) brightness(95%) contrast(90%)' }} />
              </div>
              <h3 className="text-lg font-bold text-white mb-1">Update Progress</h3>
              <p className="text-xs text-gray-500 max-w-[200px] line-clamp-2">{progressModal.article.name}</p>
            </div>
            <div className="space-y-4">
              <div className="flex justify-between items-end">
                <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Current Page</label>
                <span className="text-xs text-gray-400">Total: {progressModal.totalPages}</span>
              </div>
              <input type="number" min="0" max={progressModal.totalPages}
                placeholder={`${progressData[progressModal.article.fullPath]?.current || 0}`}
                className="w-full bg-white/5 text-white text-2xl font-bold rounded-2xl px-6 py-4 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 border border-white/5 text-center placeholder:text-white/20"
                id="articleProgressInput" autoFocus
                onKeyDown={(e) => { if (e.key === 'Enter') { saveProgress(progressModal.article, parseInt(e.target.value) || 0); setProgressModal(null); } }} />
              <div className="w-full h-2 bg-white/5 rounded-full overflow-hidden">
                <div className="h-full bg-emerald-500 transition-all" style={{ width: `${Math.round(((progressData[progressModal.article.fullPath]?.current || 0) / (progressModal.totalPages || 1)) * 100)}%` }} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3 mt-8">
              <button onClick={() => setProgressModal(null)} className="py-3.5 bg-white/5 hover:bg-white/10 rounded-2xl text-sm font-semibold text-gray-400 cursor-pointer transition-all">Cancel</button>
              <button onClick={() => { const v = parseInt(document.getElementById('articleProgressInput')?.value) || 0; saveProgress(progressModal.article, v); setProgressModal(null); }}
                className="py-3.5 bg-emerald-600 hover:bg-emerald-500 rounded-2xl text-sm font-bold text-white cursor-pointer transition-all shadow-lg shadow-emerald-600/20">Save</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ArticleShelf;
