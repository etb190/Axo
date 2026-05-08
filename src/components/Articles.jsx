import React, { useState } from 'react';
import { useData } from '../contexts/DataContext';
import ArticleShelf from './articleComponents/ArticleShelf';
import ArticleStats from './articleComponents/ArticleStats';

const path = window.require('path');
const fs = window.require('fs');

import PlusIcon from '../assets/icons/plus.svg';
import TrashIcon from '../assets/icons/delete.svg';

const BASE_ARTICLES = 'C:\\Users\\PC\\Desktop\\database\\Articles';
const SHELF_KEYS = ['Reading', 'WanttoRead', 'Read'];

const Articles = ({ onFastReaderClick }) => {
  const { data, refreshData } = useData();
  const [showCatManager, setShowCatManager] = useState(false);
  const [newCatName, setNewCatName] = useState('');

  const categories = data.articles?.categories || [];

  const shelves = [
    { title: 'Currently Reading', key: 'Reading' },
    { title: 'Want to Read', key: 'WanttoRead' },
    { title: 'Read', key: 'Read' },
  ];

  const createCategory = () => {
    const name = newCatName.trim();
    if (!name) return;
    SHELF_KEYS.forEach((key) => {
      const catPath = path.join(BASE_ARTICLES, key, name);
      if (!fs.existsSync(catPath)) fs.mkdirSync(catPath, { recursive: true });
    });
    setNewCatName('');
    refreshData();
  };

  const deleteCategory = (catName) => {
    let canDelete = true;
    SHELF_KEYS.forEach((key) => {
      const catPath = path.join(BASE_ARTICLES, key, catName);
      if (fs.existsSync(catPath)) {
        try {
          const files = fs.readdirSync(catPath).filter(f => f.toLowerCase().endsWith('.pdf'));
          if (files.length > 0) canDelete = false;
        } catch {}
      }
    });
    if (!canDelete) { alert(`Cannot delete "${catName}" — it still contains articles. Move them first.`); return; }
    SHELF_KEYS.forEach((key) => {
      const catPath = path.join(BASE_ARTICLES, key, catName);
      if (fs.existsSync(catPath)) { try { fs.rmdirSync(catPath); } catch {} }
    });
    refreshData();
  };

  return (
    <div className="min-h-screen bg-[#050505] text-white font-sans selection:bg-emerald-500/30">
      <div className="max-w-[1600px] mx-auto p-8 pl-18 pb-28">

        {/* Stats */}
        <div className="mb-8">
          <ArticleStats />
        </div>

        {/* Shelves */}
        <div className="space-y-5">
          {shelves.map((shelf) => (
            <section key={shelf.title}>
              <ArticleShelf
                title={shelf.title}
                shelfKey={shelf.key}
                articles={data.articles?.shelves?.[shelf.key] || []}
                categories={categories}
                onManageCategories={() => setShowCatManager(true)}
                onFastReaderClick={onFastReaderClick}
              />
            </section>
          ))}
        </div>

        {/* Category Manager Modal */}
        {showCatManager && (
          <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center z-[300] p-4" onMouseDown={(e) => { if (e.target === e.currentTarget) { setShowCatManager(false) } }}>
            <div className="bg-[#0a0a0a] rounded-2xl p-6 max-w-sm w-full border border-white/[0.08] shadow-[0_32px_64px_rgba(0,0,0,0.8)]" onClick={e => e.stopPropagation()}>
              <div className="flex items-center gap-3 mb-5">
                <div className="w-9 h-9 rounded-xl bg-emerald-500/10 flex items-center justify-center border border-emerald-500/15">
                  <svg className="w-4 h-4 text-emerald-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white">Manage Categories</h3>
                  <p className="text-[10px] text-gray-500">Creates subfolders across all shelves</p>
                </div>
              </div>

              <div className="flex gap-1.5 mb-4">
                <input type="text" value={newCatName} onChange={e => setNewCatName(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') createCategory(); if (e.key === 'Escape') setShowCatManager(false); }}
                  placeholder="Category name..." autoFocus
                  className="flex-1 bg-white/[0.04] text-white text-xs rounded-lg px-3 py-2.5 focus:outline-none focus:ring-1 focus:ring-emerald-500/40 border border-white/[0.06] placeholder:text-gray-600" />
                <button onClick={createCategory} className="px-3 py-2.5 bg-emerald-600 hover:bg-emerald-500 rounded-lg text-[10px] font-bold text-white cursor-pointer transition-all active:scale-95 flex items-center gap-1.5 uppercase tracking-wider">
                  <img src={PlusIcon} className="w-3 h-3 invert" alt="" /> Add
                </button>
              </div>

              <div className="space-y-1 max-h-52 overflow-y-auto">
                {categories.length === 0 ? (
                  <div className="text-center py-6 text-gray-600 text-[11px]">No categories yet</div>
                ) : categories.map(cat => {
                  const total = SHELF_KEYS.reduce((s, k) => s + (data.articles?.shelves?.[k] || []).filter(a => a.category === cat).length, 0);
                  return (
                    <div key={cat} className="flex items-center justify-between px-3 py-2 bg-white/[0.02] hover:bg-white/[0.04] rounded-lg border border-white/[0.04] transition-all group">
                      <div className="flex items-center gap-2.5">
                        <div className="w-1.5 h-1.5 rounded-full bg-emerald-500/50" />
                        <span className="text-[11px] font-semibold text-gray-300">{cat}</span>
                        <span className="text-[9px] font-bold text-gray-600">{total}</span>
                      </div>
                      <button onClick={() => deleteCategory(cat)} className="opacity-0 group-hover:opacity-100 w-6 h-6 rounded-md bg-red-500/10 hover:bg-red-500/20 border border-red-500/15 flex items-center justify-center cursor-pointer transition-all">
                        <img src={TrashIcon} className="w-3 h-3" style={{ filter: 'invert(37%) sepia(93%) saturate(1352%) hue-rotate(339deg) brightness(103%) contrast(100%)' }} alt="" />
                      </button>
                    </div>
                  );
                })}
              </div>

              <div className="mt-4">
                <button onClick={() => setShowCatManager(false)} className="w-full py-2.5 bg-white/[0.04] hover:bg-white/[0.07] rounded-xl text-[10px] font-bold text-gray-500 hover:text-gray-300 cursor-pointer transition-all uppercase tracking-widest">Done</button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Articles;
