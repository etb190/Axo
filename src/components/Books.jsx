// src/components/Books.jsx

import React, { useState } from 'react';
import { useData } from '../contexts/DataContext';
import BookShelf from './bookComponenets/BookShelf';
import BookNotesModal from './bookComponenets/BookNotesModal';

const path = window.require('path');
const fs = window.require('fs');
const { shell } = window.require('electron');

import ReadingGoal from './bookComponenets/ReadingGoal';
import UnifiedActivityTracker from './bookComponenets/UnifiedActivityTracker';
import BookStats from './bookComponenets/BookStats';

import PlusIcon from '../assets/icons/plus.svg';
import TrashIcon from '../assets/icons/delete.svg';

const BASE_BOOKS = 'C:\\Users\\PC\\Desktop\\database\\Books';
const SHELF_KEYS = ['Reading', 'WanttoRead', 'Read'];

const Books = ({ onBookClick, onFastReaderClick }) => {
  const { data, refreshData } = useData();
  const [selectedBookForNotes, setSelectedBookForNotes] = useState(null);
  const [showCatManager, setShowCatManager] = useState(false);
  const [newCatName, setNewCatName] = useState('');
  const [editingCat, setEditingCat] = useState(null);
  const [editCatValue, setEditCatValue] = useState('');

  const categories = data.reading?.categories || [];

  const shelves = [
    { title: 'Currently Reading', key: 'Reading' },
    { title: 'Want to Read', key: 'WanttoRead' },
    { title: 'Read', key: 'Read' },
  ];

  const openNotes = (book) => {
    setSelectedBookForNotes(book);
  };

  const closeNotes = () => {
    setSelectedBookForNotes(null);
  };

  const createCategory = () => {
    const name = newCatName.trim();
    if (!name) return;

    // Create subfolder in each shelf
    SHELF_KEYS.forEach((key) => {
      const catPath = path.join(BASE_BOOKS, key, name);
      if (!fs.existsSync(catPath)) {
        fs.mkdirSync(catPath, { recursive: true });
      }
    });

    setNewCatName('');
    refreshData();
  };

  const deleteCategory = (catName) => {
    SHELF_KEYS.forEach((key) => {
      const catPath = path.join(BASE_BOOKS, key, catName);
      if (fs.existsSync(catPath)) {
        try {
          const files = fs.readdirSync(catPath);
          files.forEach(file => {
            const oldPath = path.join(catPath, file);
            const newPath = path.join(BASE_BOOKS, key, file);
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
      const oldCatPath = path.join(BASE_BOOKS, key, oldName);
      const newCatPath = path.join(BASE_BOOKS, key, newName);
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
    <div className="min-h-screen bg-[#050505] text-white font-sans selection:bg-blue-500/30">
      <div className="max-w-[1600px] mx-auto p-8 pl-18">

        {/* Categories / Shelves */}
        <div className="space-y-4">
          <BookStats />
          <UnifiedActivityTracker 
              logs={data.reading?.readingLogs || []}
              books={data.reading?.shelves?.Read || []} 
              articles={data.articles?.shelves?.Read || []} 
          />

          {shelves.map((shelf, index) => (
            <React.Fragment key={shelf.title}>
              <section>
                <BookShelf
                  title={shelf.title}
                  shelfKey={shelf.key}
                  books={data.reading?.shelves?.[shelf.key] || []}
                  onNotesClick={openNotes}
                  onBookClick={onBookClick}
                  onFastReaderClick={onFastReaderClick}
                  categories={categories}
                  onManageCategories={() => setShowCatManager(true)}
                />
              </section>

              {/* Insert ReadingGoal after Currently Reading */}
              {index === 0 && (
                <div className="py-0 flex flex-col gap-4">
                  <ReadingGoal />
                </div>
              )}
            </React.Fragment>
          ))}
        </div>

        {/* Notes Modal */}
        {selectedBookForNotes && (
          <BookNotesModal
            bookPath={selectedBookForNotes.fullPath}
            bookName={selectedBookForNotes.name}
            onClose={closeNotes}
          />
        )}

        {/* Category Manager Modal */}
        {showCatManager && (
          <div
            className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center z-[300] p-4 animate-in fade-in duration-300"
            onMouseDown={(e) => { if (e.target === e.currentTarget) { setShowCatManager(false) } }}
          >
            <div
              className="bg-[#0a0a0a] rounded-2xl p-6 max-w-sm w-full border border-white/[0.08] shadow-[0_32px_64px_rgba(0,0,0,0.8)]"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center gap-3 mb-5">
                <div className="w-9 h-9 rounded-xl bg-blue-500/10 flex items-center justify-center border border-blue-500/15">
                  <svg className="w-4 h-4 text-blue-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" /></svg>
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white tracking-tight">Manage Categories</h3>
                  <p className="text-[10px] text-gray-500 font-medium uppercase tracking-widest">Books Organization</p>
                </div>
              </div>

              <div className="space-y-4">
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={newCatName}
                    onChange={(e) => setNewCatName(e.target.value)}
                    placeholder="New Category..."
                    className="flex-1 bg-white/5 border border-white/10 rounded-xl px-4 py-2 text-xs text-white focus:outline-none focus:border-blue-500/50 transition-all placeholder:text-gray-600"
                  />
                  <button
                    onClick={createCategory}
                    className="p-2.5 rounded-xl bg-blue-500 hover:bg-blue-600 text-white transition-all shadow-lg shadow-blue-500/20 active:scale-95 cursor-pointer"
                  >
                    <img src={PlusIcon} className="w-4 h-4" alt="add" />
                  </button>
                </div>

                <div className="space-y-1 max-h-[300px] overflow-y-auto overflow-x-hidden pr-2 custom-scrollbar w-full">
                  {categories.length === 0 ? (
                    <p className="text-[10px] text-gray-500 text-center py-8">No custom categories yet</p>
                  ) : (
                    categories.map((cat) => (
                      <div key={cat} className="group w-full flex items-center justify-between p-2 rounded-xl hover:bg-white/5 border border-transparent hover:border-white/5 transition-all">
                        {editingCat === cat ? (
                          <div className="flex items-center gap-1.5 w-full">
                            <input
                              type="text"
                              value={editCatValue}
                              onChange={(e) => setEditCatValue(e.target.value)}
                              className="flex-1 w-full min-w-0 bg-white/5 text-white text-xs font-medium rounded-md px-2 py-1 focus:outline-none focus:ring-1 focus:ring-blue-500/50 border border-white/5"
                              autoFocus
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') editCategory(cat, editCatValue.trim());
                                if (e.key === 'Escape') setEditingCat(null);
                              }}
                            />
                            <button
                              onClick={() => editCategory(cat, editCatValue.trim())}
                              className="p-1.5 rounded-md bg-blue-600 hover:bg-blue-500 text-white transition-all flex-shrink-0"
                              title="Save"
                            >
                              <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
                            </button>
                            <button
                              onClick={() => setEditingCat(null)}
                              className="p-1.5 rounded-md bg-white/10 hover:bg-white/20 text-white transition-all flex-shrink-0"
                              title="Cancel"
                            >
                              <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                            </button>
                          </div>
                        ) : (
                          <>
                            <span className="text-xs text-gray-400 group-hover:text-white transition-colors">{cat}</span>
                            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                              <button
                                onClick={() => { setEditingCat(cat); setEditCatValue(cat); }}
                                className="p-1.5 rounded-lg hover:bg-blue-500/10 text-gray-400 hover:text-blue-400 transition-all cursor-pointer"
                                title="Edit"
                              >
                                <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" /><path d="m15 5 4 4" /></svg>
                              </button>
                              <button
                                onClick={() => deleteCategory(cat)}
                                className="p-1.5 rounded-lg hover:bg-red-500/10 text-red-400 transition-all cursor-pointer"
                                title="Delete"
                              >
                                <img src={TrashIcon} className="w-3.5 h-3.5" alt="delete" />
                              </button>
                            </div>
                          </>
                        )}
                      </div>
                    ))
                  )}
                </div>
              </div>

              <button
                onClick={() => setShowCatManager(false)}
                className="w-full mt-6 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white text-[10px] font-bold uppercase tracking-widest transition-all cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Books;