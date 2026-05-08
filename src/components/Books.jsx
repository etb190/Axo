// src/components/Books.jsx

import React, { useState } from 'react';
import { useData } from '../contexts/DataContext';
import BookShelf from './bookComponenets/BookShelf';
import BookStats from './bookComponenets/BookStats';
import ReadingChart from './bookComponenets/ReadingChart';
import BookNotesModal from './bookComponenets/BookNotesModal';

const path = window.require('path');
const fs = window.require('fs');
const { shell } = window.require('electron');

import ReadingGoal from './bookComponenets/ReadingGoal';

import PlusIcon from '../assets/icons/plus.svg';
import TrashIcon from '../assets/icons/delete.svg';

const BASE_BOOKS = 'C:\\Users\\PC\\Desktop\\database\\Books';
const SHELF_KEYS = ['Reading', 'WanttoRead', 'Read'];

const Books = ({ onBookClick, onFastReaderClick }) => {
  const { data, refreshData } = useData();
  const [selectedBookForNotes, setSelectedBookForNotes] = useState(null);
  const [showCatManager, setShowCatManager] = useState(false);
  const [newCatName, setNewCatName] = useState('');

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
    // Only delete if empty in ALL shelves
    let canDelete = true;
    SHELF_KEYS.forEach((key) => {
      const catPath = path.join(BASE_BOOKS, key, catName);
      if (fs.existsSync(catPath)) {
        try {
          const files = fs.readdirSync(catPath).filter(f => f.toLowerCase().endsWith('.pdf'));
          if (files.length > 0) canDelete = false;
        } catch (e) { }
      }
    });

    if (!canDelete) {
      alert(`Cannot delete "${catName}" — it still contains books. Move them first.`);
      return;
    }

    SHELF_KEYS.forEach((key) => {
      const catPath = path.join(BASE_BOOKS, key, catName);
      if (fs.existsSync(catPath)) {
        try { fs.rmdirSync(catPath); } catch (e) { }
      }
    });

    refreshData();
  };

  return (
    <div className="min-h-screen bg-[#050505] text-white font-sans selection:bg-blue-500/30">
      <div className="max-w-[1600px] mx-auto p-8 pl-18">

        {/* Stats & Activity at the Top */}
        <div className="mb-8 space-y-6">
          <BookStats />
          <div className="bg-[#0a0a0a]/40 backdrop-blur-md rounded-3xl border border-white/5 p-5">
            <ReadingChart />
          </div>
        </div>

        {/* Categories / Shelves */}
        <div className="space-y-4">
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

              {/* Insert Reading Goal between Currently Reading (index 0) and Want to Read (index 1) */}
              {index === 0 && (
                <div className="py-0">
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
              className="bg-[#0f0f0f] rounded-[2rem] p-8 max-w-md w-full border border-white/10 shadow-3xl transform animate-in zoom-in-95 duration-300"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex flex-col items-center text-center mb-6">
                <div className="w-16 h-16 rounded-2xl bg-blue-600/20 flex items-center justify-center border border-blue-500/20 mb-4">
                  <svg className="w-8 h-8 text-blue-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
                  </svg>
                </div>
                <h3 className="text-xl font-bold text-white mb-1">Manage Categories</h3>
                <p className="text-sm text-gray-500">Organize your books into subcategories</p>
              </div>

              {/* Create new */}
              <div className="flex gap-2 mb-5">
                <input
                  type="text"
                  value={newCatName}
                  onChange={(e) => setNewCatName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') createCategory();
                    if (e.key === 'Escape') setShowCatManager(false);
                  }}
                  placeholder="New category name..."
                  className="flex-1 bg-white/5 text-white text-sm rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500/50 border border-white/5 placeholder:text-gray-600"
                  autoFocus
                />
                <button
                  onClick={createCategory}
                  className="px-4 py-3 bg-blue-600 hover:bg-blue-500 rounded-xl text-sm font-bold text-white cursor-pointer transition-all shadow-lg shadow-blue-600/20 active:scale-95 flex items-center gap-2"
                >
                  <img src={PlusIcon} className="w-4 h-4 invert" alt="" />
                  Add
                </button>
              </div>

              {/* Existing categories */}
              <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                {categories.length === 0 ? (
                  <div className="text-center py-8 text-gray-600 text-sm">
                    No categories yet. Create one above.
                  </div>
                ) : (
                  categories.map((cat) => {
                    const totalBooks = ['Reading', 'WanttoRead', 'Read'].reduce((sum, key) => {
                      return sum + (data.reading?.shelves?.[key] || []).filter(b => b.category === cat).length;
                    }, 0);

                    return (
                      <div
                        key={cat}
                        className="flex items-center justify-between p-3 bg-white/[0.03] hover:bg-white/[0.05] rounded-xl border border-white/5 transition-all group"
                      >
                        <div className="flex items-center gap-3">
                          <svg className="w-4 h-4 text-gray-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
                          </svg>
                          <span className="text-sm font-semibold text-white">{cat}</span>
                          <span className="text-[10px] font-bold text-gray-600">{totalBooks} books</span>
                        </div>
                        <button
                          onClick={() => deleteCategory(cat)}
                          className="opacity-0 group-hover:opacity-100 w-7 h-7 rounded-lg bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 flex items-center justify-center cursor-pointer transition-all"
                          title={totalBooks > 0 ? 'Move books first to delete' : 'Delete category'}
                        >
                          <img src={TrashIcon} className="w-3.5 h-3.5" style={{ filter: 'invert(37%) sepia(93%) saturate(1352%) hue-rotate(339deg) brightness(103%) contrast(100%)' }} alt="" />
                        </button>
                      </div>
                    );
                  })
                )}
              </div>

              <div className="mt-6">
                <button
                  onClick={() => setShowCatManager(false)}
                  className="w-full py-3.5 bg-white/5 hover:bg-white/10 rounded-2xl text-sm font-semibold text-gray-400 cursor-pointer transition-all active:scale-95"
                >
                  Done
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Books;