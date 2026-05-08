import React, { useState, useEffect, useRef } from 'react';
import { useData } from '../../contexts/DataContext';
import BookOpenIcon from '../../assets/icons/book.svg';
import MoveIcon from '../../assets/icons/move-vertical.svg';
import TrashIcon from '../../assets/icons/delete.svg';
import CheckIcon from '../../assets/icons/check.svg';
import ZapIcon from '../../assets/icons/zap.svg';
import * as pdfjsLib from 'pdfjs-dist';

const isModern = parseInt(pdfjsLib.version.split('.')[0]) >= 4;
pdfjsLib.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.${isModern ? 'mjs' : 'js'}`;

const fs = window.require('fs');
const path = window.require('path');
const { shell } = window.require('electron');

import BookmarkIcon from '../../assets/icons/bookmark.svg';

const BASE_ARTICLES = 'C:\\Users\\PC\\Desktop\\database\\Articles';
const THUMBNAIL_CACHE = 'C:\\Users\\PC\\Desktop\\database\\Articles\\ThumbnailCache';
const PROGRESS_FOLDER = 'C:\\Users\\PC\\Desktop\\database\\Articles\\Progress';

try { if (!fs.existsSync(THUMBNAIL_CACHE)) fs.mkdirSync(THUMBNAIL_CACHE, { recursive: true }); } catch {}
try { if (!fs.existsSync(PROGRESS_FOLDER)) fs.mkdirSync(PROGRESS_FOLDER, { recursive: true }); } catch {}

const ArticleShelf = ({ title, shelfKey, articles = [], categories = [], onManageCategories, onFastReaderClick }) => {
  const { refreshData } = useData();
  const [thumbnails, setThumbnails] = useState({});
  const [progressData, setProgressData] = useState({});
  const [progressModal, setProgressModal] = useState(null);
  const [contextMenu, setContextMenu] = useState(null);
  const [moveModal, setMoveModal] = useState(null);
  const [moveTargetCat, setMoveTargetCat] = useState('__root__');
  const [categoryModal, setCategoryModal] = useState(null);
  const [deleteModal, setDeleteModal] = useState(null);
  const [showCatDropdown, setShowCatDropdown] = useState(false);
  const catRef = useRef(null);
  const isReadingShelf = title === 'Currently Reading';

  const storageKey = `axo_articles_cat_${shelfKey}`;
  const [selectedCat, setSelectedCat] = useState(() => {
    try { return localStorage.getItem(storageKey) || 'all'; } catch { return 'all'; }
  });

  useEffect(() => {
    if (selectedCat !== 'all' && categories.length > 0 && !categories.includes(selectedCat)) {
      setSelectedCat('all');
      try { localStorage.setItem(storageKey, 'all'); } catch {}
    }
  }, [categories, selectedCat]);

  const changeCat = (c) => { setSelectedCat(c); try { localStorage.setItem(storageKey, c); } catch {} setShowCatDropdown(false); };

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
      const name = path.basename(filePath, '.pdf') + '.jpg';
      const cachePath = path.join(THUMBNAIL_CACHE, name);
      const base64 = dataUrl.replace(/^data:image\/jpeg;base64,/, '');
      fs.writeFileSync(cachePath, Buffer.from(base64, 'base64'));
    } catch {}
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
      const loaded = {};
      const needGen = [];
      // 1. Load from disk cache first
      for (const a of articles) {
        if (a.cover || thumbnails[a.fullPath]) continue;
        const cachePath = path.join(THUMBNAIL_CACHE, a.name + '.jpg');
        try {
          if (fs.existsSync(cachePath)) {
            const buf = fs.readFileSync(cachePath);
            loaded[a.fullPath] = `data:image/jpeg;base64,${buf.toString('base64')}`;
          } else {
            needGen.push(a);
          }
        } catch { needGen.push(a); }
      }
      if (Object.keys(loaded).length > 0) setThumbnails(prev => ({ ...prev, ...loaded }));
      // 2. Generate missing ones
      if (needGen.length > 0) {
        const results = await Promise.all(needGen.map(a => generateThumbnail(a)));
        const newThumbs = {};
        results.forEach(r => { if (r.thumbnail) newThumbs[r.path] = r.thumbnail; });
        if (Object.keys(newThumbs).length > 0) setThumbnails(prev => ({ ...prev, ...newThumbs }));
      }
    };
    if (articles.length > 0) process();
  }, [articles]);

  // Init progress data from props
  useEffect(() => {
    const pm = {};
    articles.forEach(a => { if (a.progress) pm[a.fullPath] = a.progress; });
    setProgressData(pm);
  }, [articles]);

  const saveProgress = (article, currentPage) => {
    const pFile = path.join(PROGRESS_FOLDER, `${article.name}.json`);
    let storedTotal = progressData[article.fullPath]?.total || 0;
    if (storedTotal === 0 && fs.existsSync(pFile)) {
      try { storedTotal = JSON.parse(fs.readFileSync(pFile, 'utf-8')).total || 0; } catch {}
    }
    const clamped = storedTotal > 0 ? Math.max(0, Math.min(currentPage, storedTotal)) : Math.max(0, currentPage);
    try { fs.writeFileSync(pFile, JSON.stringify({ current: clamped, total: storedTotal }, null, 2)); refreshData(); } catch {}
    setProgressData(prev => ({ ...prev, [article.fullPath]: { ...prev[article.fullPath], current: clamped, total: storedTotal } }));
  };

  const openProgressModal = async (article) => {
    let totalPages = progressData[article.fullPath]?.total || 0;
    if (totalPages === 0) {
      const pf = path.join(PROGRESS_FOLDER, `${article.name}.json`);
      if (fs.existsSync(pf)) { try { totalPages = JSON.parse(fs.readFileSync(pf, 'utf-8')).total || 0; } catch {} }
    }
    if (totalPages === 0) {
      try {
        const d = fs.readFileSync(article.fullPath);
        const pdf = await pdfjsLib.getDocument({ data: d }).promise;
        totalPages = pdf.numPages;
        const pf = path.join(PROGRESS_FOLDER, `${article.name}.json`);
        let ex = { current: 0 };
        if (fs.existsSync(pf)) { try { ex = JSON.parse(fs.readFileSync(pf, 'utf-8')); } catch {} }
        fs.writeFileSync(pf, JSON.stringify({ ...ex, total: totalPages }, null, 2));
        setProgressData(prev => ({ ...prev, [article.fullPath]: { ...prev[article.fullPath], total: totalPages } }));
      } catch {}
    }
    setProgressModal({ article, totalPages });
  };

  const openArticle = (a) => { shell.openPath(a.fullPath); };

  const moveArticle = (article, targetKey, targetCat) => {
    try {
      const cat = targetCat === '__root__' ? null : targetCat;
      const fileName = path.basename(article.fullPath);
      const targetDir = cat ? path.join(BASE_ARTICLES, targetKey, cat) : path.join(BASE_ARTICLES, targetKey);
      if (!fs.existsSync(targetDir)) fs.mkdirSync(targetDir, { recursive: true });
      const targetPath = path.join(targetDir, fileName);
      if (fs.existsSync(targetPath)) { alert('Article already exists there.'); return; }
      fs.renameSync(article.fullPath, targetPath);
      refreshData();
      setMoveModal(null);
      setMoveTargetCat('__root__');
    } catch (err) { console.error('Error moving article:', err); }
  };

  const changeCategoryForArticle = (article, newCat) => {
    try {
      const cat = newCat === '__root__' ? null : newCat;
      const fileName = path.basename(article.fullPath);
      const curShelf = shelfKeys.find(s => article.fullPath.includes(`\\${s.key}\\`))?.key || 'Reading';
      const targetDir = cat ? path.join(BASE_ARTICLES, curShelf, cat) : path.join(BASE_ARTICLES, curShelf);
      if (!fs.existsSync(targetDir)) fs.mkdirSync(targetDir, { recursive: true });
      const targetPath = path.join(targetDir, fileName);
      if (article.fullPath === targetPath) { setCategoryModal(null); return; }
      if (fs.existsSync(targetPath)) { alert('Already exists there.'); return; }
      fs.renameSync(article.fullPath, targetPath);
      refreshData();
      setCategoryModal(null);
    } catch (err) { console.error(err); }
  };

  const deleteArticle = (article) => {
    try { fs.unlinkSync(article.fullPath); refreshData(); setDeleteModal(null); } catch (err) { console.error(err); }
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
                <svg className="w-3 h-3 opacity-50" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>
                <span>{selectedCat === 'all' ? 'All' : selectedCat}</span>
                <svg className={`w-3 h-3 opacity-40 transition-transform duration-200 ${showCatDropdown ? 'rotate-180' : ''}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="6 9 12 15 18 9"/></svg>
              </button>
              {showCatDropdown && (
                <div className="absolute top-full right-0 mt-1.5 w-48 bg-[#0c0c0c]/98 backdrop-blur-2xl border border-white/10 rounded-xl shadow-[0_16px_48px_rgba(0,0,0,0.6)] py-1.5 z-[100]">
                  <button onClick={() => changeCat('all')} className={`w-full flex items-center gap-2.5 px-3.5 py-2 text-left text-[11px] font-medium transition-all cursor-pointer ${selectedCat === 'all' ? 'bg-emerald-500/10 text-emerald-400' : 'text-gray-400 hover:bg-white/5 hover:text-white'}`}>
                    <div className={`w-1.5 h-1.5 rounded-full ${selectedCat === 'all' ? 'bg-emerald-400' : 'bg-gray-600'}`} /> All
                  </button>
                  {categories.map(cat => (
                    <button key={cat} onClick={() => changeCat(cat)} className={`w-full flex items-center gap-2.5 px-3.5 py-2 text-left text-[11px] font-medium transition-all cursor-pointer ${selectedCat === cat ? 'bg-emerald-500/10 text-emerald-400' : 'text-gray-400 hover:bg-white/5 hover:text-white'}`}>
                      <div className={`w-1.5 h-1.5 rounded-full ${selectedCat === cat ? 'bg-emerald-400' : 'bg-gray-600'}`} /> {cat}
                      <span className="ml-auto text-[9px] font-bold text-gray-600">{articles.filter(a => a.category === cat).length}</span>
                    </button>
                  ))}
                  <div className="h-px bg-white/5 mx-2.5 my-1" />
                  <button onClick={() => { setShowCatDropdown(false); if (onManageCategories) onManageCategories(); }} className="w-full flex items-center gap-2.5 px-3.5 py-2 text-left text-[10px] font-bold text-gray-500 hover:text-white hover:bg-white/5 transition-all cursor-pointer uppercase tracking-widest">
                    <svg className="w-3 h-3 opacity-40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>
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
            const pct = prog.total > 0 ? Math.round((prog.current / prog.total) * 100) : 0;
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
                  {/* Progress bar for reading shelf */}
                  {isReadingShelf && prog.total > 0 && (
                    <div className="absolute bottom-0 left-0 right-0 h-1 bg-black/50">
                      <div className="h-full bg-emerald-400 transition-all duration-500" style={{ width: `${pct}%` }} />
                    </div>
                  )}
                  {/* Hover overlay */}
                  <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-all duration-300 backdrop-blur-[2px] flex flex-col items-center justify-center gap-2">
                    <div className="flex gap-2">
                      <button onClick={(e) => { e.stopPropagation(); shell.showItemInFolder(article.fullPath); }}
                        className="w-10 h-10 rounded-xl bg-white/10 hover:bg-white/20 border border-white/10 flex items-center justify-center transition-all group/btn cursor-pointer" title="Show in Explorer">
                        <svg className="w-[18px] h-[18px] text-white transition-transform group-hover/btn:scale-110" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/><circle cx="15" cy="15" r="3"/><path d="m21 21-1.5-1.5"/>
                        </svg>
                      </button>
                      {isReadingShelf && (
                        <button onClick={(e) => { e.stopPropagation(); openProgressModal(article); }}
                          className="w-10 h-10 rounded-xl bg-emerald-600/80 hover:bg-emerald-600 border border-white/10 flex items-center justify-center transition-all group/btn cursor-pointer" title="Update Progress">
                          <img src={BookmarkIcon} className="w-[18px] h-[18px] transition-transform group-hover/btn:scale-110" style={{ filter: 'brightness(0) invert(1)' }} />
                        </button>
                      )}
                    </div>
                    {article.fullPath?.toLowerCase().endsWith('.pdf') && onFastReaderClick && (
                      <button onClick={(e) => { e.stopPropagation(); onFastReaderClick(article); }}
                        className="w-10 h-10 rounded-xl bg-amber-500/80 hover:bg-amber-500 border border-white/10 flex items-center justify-center transition-all group/btn cursor-pointer" title="Fast Reader">
                        <img src={ZapIcon} className="w-[18px] h-[18px]" style={{ filter: 'brightness(0) invert(1)' }} />
                      </button>
                    )}
                  </div>
                </div>
                <div className="px-1 cursor-pointer">
                  <p className="text-[11px] font-semibold text-gray-300 group-hover:text-white truncate leading-tight">{article.name}</p>
                  {isReadingShelf && prog.total > 0 && <p className="text-[9px] text-gray-600 font-bold">{pct}%</p>}
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
            <button onClick={() => { setMoveModal(contextMenu.article); setMoveTargetCat('__root__'); setContextMenu(null); }}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/5 text-gray-300 hover:text-white font-bold text-[10px] uppercase tracking-widest transition-all cursor-pointer">
              <img src={MoveIcon} className="w-3.5 h-3.5 opacity-60" style={{ filter: 'brightness(0) invert(1)' }} /> Move
            </button>
            {categories.length > 0 && (
              <button onClick={() => { setCategoryModal(contextMenu.article); setContextMenu(null); }}
                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/20 text-emerald-300 font-bold text-[10px] uppercase tracking-widest transition-all cursor-pointer">
                <svg className="w-3.5 h-3.5 text-emerald-400 opacity-70" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>
                Category
              </button>
            )}
            <button onClick={() => { setDeleteModal(contextMenu.article); setContextMenu(null); }}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 text-red-400 font-bold text-[10px] uppercase tracking-widest transition-all cursor-pointer">
              <img src={TrashIcon} className="w-3.5 h-3.5 opacity-80" style={{ filter: 'invert(37%) sepia(93%) saturate(1352%) hue-rotate(339deg) brightness(103%) contrast(100%)' }} /> Delete
            </button>
          </div>
        </div>
      )}

      {/* Move Modal */}
      {moveModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center z-[400] p-4" onMouseDown={(e) => { if (e.target === e.currentTarget) { { setMoveModal(null); setMoveTargetCat('__root__'); } }}}>
          <div className="bg-[#0f0f0f] rounded-[2rem] p-8 max-w-md w-full border border-white/10" onClick={e => e.stopPropagation()}>
            <h3 className="text-lg font-bold text-white mb-1 text-center">Move Article</h3>
            <p className="text-xs text-gray-500 text-center mb-6 truncate max-w-[280px] mx-auto">{moveModal.name}</p>
            <div className="space-y-3">
              <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest pl-2">Select Shelf</label>
              <div className="grid gap-2">
                {shelfKeys.map(shelf => {
                  const isActive = moveModal.fullPath.includes(`\\${shelf.key}\\`) && moveTargetCat === (moveModal.category || '__root__');
                  return (
                    <button key={shelf.key} disabled={isActive} onClick={() => moveArticle(moveModal, shelf.key, moveTargetCat)}
                      className={`group flex items-center justify-between p-4 rounded-2xl border transition-all ${isActive ? 'bg-white/5 border-white/10 opacity-50 cursor-not-allowed' : 'bg-white/[0.02] border-white/5 hover:border-emerald-500/40 hover:bg-emerald-500/5 cursor-pointer active:scale-[0.98]'}`}>
                      <div className="flex items-center gap-3">
                        <div className={`w-2 h-2 rounded-full ${isActive ? 'bg-gray-500' : 'bg-emerald-500'}`} />
                        <span className={`text-sm font-semibold ${isActive ? 'text-gray-500' : 'text-white'}`}>{shelf.title}</span>
                      </div>
                      {isActive ? <span className="text-[9px] font-bold text-gray-600 uppercase">Current</span> : <img src={CheckIcon} className="w-4 h-4 opacity-0 group-hover:opacity-40 transition-opacity invert" />}
                    </button>
                  );
                })}
              </div>
              {categories.length > 0 && (
                <div className="mt-3">
                  <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest pl-2 mb-2 block">Into Category</label>
                  <div className="flex flex-wrap gap-1.5">
                    <button onClick={() => setMoveTargetCat('__root__')} className={`px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all cursor-pointer border ${moveTargetCat === '__root__' ? 'bg-emerald-500/20 border-emerald-500/30 text-emerald-400' : 'bg-white/[0.03] border-white/5 text-gray-500 hover:text-white hover:bg-white/5'}`}>None</button>
                    {categories.map(cat => (
                      <button key={cat} onClick={() => setMoveTargetCat(cat)} className={`px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all cursor-pointer border ${moveTargetCat === cat ? 'bg-emerald-500/20 border-emerald-500/30 text-emerald-300' : 'bg-white/[0.03] border-white/5 text-gray-500 hover:text-white hover:bg-white/5'}`}>{cat}</button>
                    ))}
                  </div>
                </div>
              )}
            </div>
            <div className="mt-8">
              <button onClick={() => { setMoveModal(null); setMoveTargetCat('__root__'); }} className="w-full py-4 bg-white/5 hover:bg-white/10 rounded-2xl text-sm font-semibold text-gray-400 cursor-pointer transition-all active:scale-95">Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* Category Modal */}
      {categoryModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center z-[400] p-4" onMouseDown={(e) => { if (e.target === e.currentTarget) { setCategoryModal(null) } }}>
          <div className="bg-[#0f0f0f] rounded-[2rem] p-8 max-w-sm w-full border border-white/10" onClick={e => e.stopPropagation()}>
            <h3 className="text-lg font-bold text-white mb-1 text-center">Change Category</h3>
            <p className="text-xs text-gray-500 text-center mb-6 truncate max-w-[200px] mx-auto">{categoryModal.name}</p>
            <div className="grid gap-2">
              <button onClick={() => changeCategoryForArticle(categoryModal, '__root__')} disabled={!categoryModal.category}
                className={`group flex items-center justify-between p-3.5 rounded-xl border transition-all ${!categoryModal.category ? 'bg-white/5 border-white/10 opacity-50 cursor-not-allowed' : 'bg-white/[0.02] border-white/5 hover:border-emerald-500/40 hover:bg-emerald-500/5 cursor-pointer active:scale-[0.98]'}`}>
                <div className="flex items-center gap-3"><div className={`w-2 h-2 rounded-full ${!categoryModal.category ? 'bg-gray-500' : 'bg-emerald-400'}`} /><span className={`text-sm font-semibold ${!categoryModal.category ? 'text-gray-500' : 'text-white'}`}>Uncategorized</span></div>
                {!categoryModal.category && <span className="text-[9px] font-bold text-gray-600 uppercase">Current</span>}
              </button>
              {categories.map(cat => (
                <button key={cat} onClick={() => changeCategoryForArticle(categoryModal, cat)} disabled={categoryModal.category === cat}
                  className={`group flex items-center justify-between p-3.5 rounded-xl border transition-all ${categoryModal.category === cat ? 'bg-white/5 border-white/10 opacity-50 cursor-not-allowed' : 'bg-white/[0.02] border-white/5 hover:border-emerald-500/40 hover:bg-emerald-500/5 cursor-pointer active:scale-[0.98]'}`}>
                  <div className="flex items-center gap-3"><div className={`w-2 h-2 rounded-full ${categoryModal.category === cat ? 'bg-gray-500' : 'bg-emerald-400'}`} /><span className={`text-sm font-semibold ${categoryModal.category === cat ? 'text-gray-500' : 'text-white'}`}>{cat}</span></div>
                  {categoryModal.category === cat && <span className="text-[9px] font-bold text-gray-600 uppercase">Current</span>}
                </button>
              ))}
            </div>
            <div className="mt-6"><button onClick={() => setCategoryModal(null)} className="w-full py-3.5 bg-white/5 hover:bg-white/10 rounded-2xl text-sm font-semibold text-gray-400 cursor-pointer transition-all active:scale-95">Cancel</button></div>
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
