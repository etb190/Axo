import React, { useState } from 'react';
import { useData } from '../contexts/DataContext';
import ArticleShelf from './articleComponents/ArticleShelf';
import ArticleStats from './articleComponents/ArticleStats';
import ArticleNotesModal from './articleComponents/ArticleNotesModal';
import UnifiedActivityTracker from './bookComponenets/UnifiedActivityTracker';

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
  const [editingCat, setEditingCat] = useState(null);
  const [editCatValue, setEditCatValue] = useState('');
  const [selectedNoteArticle, setSelectedNoteArticle] = useState(null);

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
    SHELF_KEYS.forEach((key) => {
      const catPath = path.join(BASE_ARTICLES, key, catName);
      if (fs.existsSync(catPath)) {
        try {
          const files = fs.readdirSync(catPath);
          files.forEach(file => {
            const oldPath = path.join(catPath, file);
            const newPath = path.join(BASE_ARTICLES, key, file);
            fs.renameSync(oldPath, newPath);
          });
          fs.rmdirSync(catPath);
        } catch (e) { }
      }
    });

    refreshData();
  };

  const editCategory = (oldName, newName) => {
    if (!newName || newName === oldName) {
      setEditingCat(null);
      return;
    }
    SHELF_KEYS.forEach((key) => {
      const oldCatPath = path.join(BASE_ARTICLES, key, oldName);
      const newCatPath = path.join(BASE_ARTICLES, key, newName);
      if (fs.existsSync(oldCatPath)) {
        if (!fs.existsSync(newCatPath)) fs.mkdirSync(newCatPath, { recursive: true });
        try {
          const files = fs.readdirSync(oldCatPath);
          files.forEach(file => {
            const oldPath = path.join(oldCatPath, file);
            const newPath = path.join(newCatPath, file);
            fs.renameSync(oldPath, newPath);
          });
          fs.rmdirSync(oldCatPath);
        } catch (e) { }
      }
    });

    setEditingCat(null);
    refreshData();
  };

  return (
    <div className="min-h-screen bg-[#050505] text-white font-sans selection:bg-emerald-500/30">
      <div className="max-w-[1600px] mx-auto p-8 pl-18 pb-28">

        {/* Stats */}
        <div className="mb-4">
          <ArticleStats />
          <UnifiedActivityTracker 
              logs={data.reading?.readingLogs || []}
              books={data.reading?.shelves?.Read || []} 
              articles={data.articles?.shelves?.Read || []} 
          />
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
                onNotesClick={setSelectedNoteArticle}
              />
            </section>
          ))}
        </div>

        {selectedNoteArticle && (
          <ArticleNotesModal
            articlePath={selectedNoteArticle.fullPath}
            articleName={selectedNoteArticle.name}
            onClose={() => setSelectedNoteArticle(null)}
          />
        )}

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

              <div className="space-y-1 max-h-52 overflow-y-auto overflow-x-hidden w-full">
                {categories.length === 0 ? (
                  <div className="text-center py-6 text-gray-600 text-[11px]">No categories yet</div>
                ) : categories.map(cat => {
                  const total = SHELF_KEYS.reduce((s, k) => s + (data.articles?.shelves?.[k] || []).filter(a => a.category === cat).length, 0);
                  return (
                    <div key={cat} className="flex w-full items-center justify-between px-3 py-2 bg-white/[0.02] hover:bg-white/[0.04] rounded-lg border border-white/[0.04] transition-all group">
                      {editingCat === cat ? (
                        <div className="flex items-center gap-1.5 w-full">
                          <input
                            type="text"
                            value={editCatValue}
                            onChange={(e) => setEditCatValue(e.target.value)}
                            className="flex-1 w-full min-w-0 bg-white/5 text-white text-xs font-medium rounded-md px-2 py-1 focus:outline-none focus:ring-1 focus:ring-emerald-500/50 border border-white/5"
                            autoFocus
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') editCategory(cat, editCatValue.trim());
                              if (e.key === 'Escape') setEditingCat(null);
                            }}
                          />
                          <button
                            onClick={() => editCategory(cat, editCatValue.trim())}
                            className="p-1.5 rounded-md bg-emerald-600 hover:bg-emerald-500 text-white transition-all cursor-pointer flex-shrink-0"
                            title="Save"
                          >
                            <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
                          </button>
                          <button
                            onClick={() => setEditingCat(null)}
                            className="p-1.5 rounded-md bg-white/10 hover:bg-white/20 text-white transition-all cursor-pointer flex-shrink-0"
                            title="Cancel"
                          >
                            <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                          </button>
                        </div>
                      ) : (
                        <>
                          <div className="flex items-center gap-2.5">
                            <div className="w-1.5 h-1.5 rounded-full bg-emerald-500/50" />
                            <span className="text-[11px] font-semibold text-gray-300">{cat}</span>
                            <span className="text-[9px] font-bold text-gray-600">{total}</span>
                          </div>
                          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button
                              onClick={() => { setEditingCat(cat); setEditCatValue(cat); }}
                              className="w-6 h-6 rounded-md bg-white/5 hover:bg-blue-500/20 border border-transparent hover:border-blue-500/15 flex items-center justify-center cursor-pointer transition-all"
                              title="Edit"
                            >
                              <svg className="w-3 h-3 text-gray-400 hover:text-blue-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" /><path d="m15 5 4 4" /></svg>
                            </button>
                            <button onClick={() => deleteCategory(cat)} className="w-6 h-6 rounded-md bg-red-500/10 hover:bg-red-500/20 border border-red-500/15 flex items-center justify-center cursor-pointer transition-all">
                              <img src={TrashIcon} className="w-3 h-3" style={{ filter: 'invert(37%) sepia(93%) saturate(1352%) hue-rotate(339deg) brightness(103%) contrast(100%)' }} alt="" />
                            </button>
                          </div>
                        </>
                      )}
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
