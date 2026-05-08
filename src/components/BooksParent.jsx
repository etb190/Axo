import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import LibraryIcon from '../assets/icons/booktype.svg';
import BookOpenIcon from '../assets/icons/book.svg';
import FileTextIcon from '../assets/icons/edit.svg';
import Books from './Books';
import FastReader from './fastReading';
import Articles from './Articles';
import Navbar from './Navbar';

const { shell } = window.require('electron');

const STORAGE_KEY = 'axo_books_last_view';

const BooksParentView = () => {
  const { view } = useParams();
  const [currentView, setCurrentView] = useState(() => {
    if (view === 'fastreader' || view === 'books' || view === 'articles') return view;
    try { return localStorage.getItem(STORAGE_KEY) || 'books'; } catch { return 'books'; }
  });

  useEffect(() => {
    if (view && ['books', 'fastreader', 'articles'].includes(view)) {
      setCurrentView(view);
    }
  }, [view]);

  const switchView = (newView) => {
    setCurrentView(newView);
    try { localStorage.setItem(STORAGE_KEY, newView); } catch { }
  };

  const openBook = (book) => {
    shell.openPath(book.fullPath);
  };

  const onFastReaderClick = (book) => {
    try {
      localStorage.setItem('axo_fastreader_active_book', book.fullPath);
      switchView('fastreader');
    } catch (e) {
      console.error('Error opening fast reader:', e);
    }
  };

  return (
    <div className="min-h-screen bg-black">
      <Navbar />

      {/* Main Content Area */}
      <div className="min-h-screen">
        {currentView === 'books' ? (
          <Books onBookClick={openBook} onFastReaderClick={onFastReaderClick} />
        ) : currentView === 'articles' ? (
          <Articles onFastReaderClick={onFastReaderClick} />
        ) : (
          <FastReader />
        )}
      </div>

      {/* BOTTOM NAVIGATION SWITCHER */}
      <div className="fixed bottom-6 left-[calc(50%+24px)] -translate-x-1/2 z-[200] flex items-center bg-black/80 backdrop-blur-xl border border-white/10 p-1 rounded-full shadow-2xl">
        <button
          onClick={() => switchView('books')}
          className={`flex items-center gap-2 px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider cursor-pointer transition-all duration-300 ${currentView === 'books'
            ? 'bg-white text-black shadow-lg scale-100'
            : 'text-zinc-500 hover:text-zinc-300 hover:bg-white/5'
            }`}
        >
          <img src={LibraryIcon} className={`w-3.5 h-3.5 ${currentView === 'books' ? 'invert' : ''}`} alt="" />
          <span>Library</span>
        </button>
        <div className="w-[1px] h-3 bg-white/10 mx-1"></div>
        <button
          onClick={() => switchView('articles')}
          className={`flex items-center gap-2 px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider cursor-pointer transition-all duration-300 ${currentView === 'articles'
            ? 'bg-white text-black shadow-lg scale-100'
            : 'text-zinc-500 hover:text-zinc-300 hover:bg-white/5'
            }`}
        >
          <img src={FileTextIcon} className={`w-3.5 h-3.5 ${currentView === 'articles' ? 'invert' : ''}`} alt="" />
          <span>Articles</span>
        </button>
        <div className="w-[1px] h-3 bg-white/10 mx-1"></div>
        <button
          onClick={() => switchView('fastreader')}
          className={`flex items-center gap-2 px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider cursor-pointer transition-all duration-300 ${currentView === 'fastreader'
            ? 'bg-white text-black shadow-lg scale-100'
            : 'text-zinc-500 hover:text-zinc-300 hover:bg-white/5'
            }`}
        >
          <img src={BookOpenIcon} className={`w-3.5 h-3.5 ${currentView === 'fastreader' ? 'invert' : ''}`} alt="" />
          <span>Reader</span>
        </button>
      </div>
    </div>
  );
};

export default BooksParentView;