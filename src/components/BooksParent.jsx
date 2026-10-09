import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import LibraryIcon from '../assets/icons/booktype.svg';
import BookOpenIcon from '../assets/icons/book.svg';
import FileTextIcon from '../assets/icons/edit.svg';
import Books from './Books';
import FastReader from './fastReading';
import Articles from './Articles';
import Recaller from './Recaller';
import Navbar from './Navbar';
import BrainIcon from '../assets/icons/brain.svg';
import DiscordRpcModal from './bookComponenets/DiscordRpcModal';

const { shell } = window.require('electron');
const path = window.require('path');

const STORAGE_KEY = 'axo_books_last_view';

const BooksParentView = () => {
  const { view } = useParams();
  const [showDiscordModal, setShowDiscordModal] = useState(false);
  const [currentView, setCurrentView] = useState(() => {
    if (['fastreader', 'books', 'articles', 'recaller'].includes(view)) return view;
    try { return localStorage.getItem(STORAGE_KEY) || 'books'; } catch { return 'books'; }
  });

  useEffect(() => {
    if (view && ['books', 'fastreader', 'articles', 'recaller'].includes(view)) {
      setCurrentView(view);
    } else if (!view) {
      try {
        const saved = localStorage.getItem(STORAGE_KEY) || 'books';
        setCurrentView(saved);
      } catch (e) {
        setCurrentView('books');
      }
    }
  }, [view]);

  const navigate = useNavigate();

  const switchView = (newView) => {
    navigate(`/Books/${newView}`);
  };

  const openBook = (book) => {
    shell.openPath(book.fullPath);
  };

  const onFastReaderClick = (book) => {
    try {
      localStorage.setItem('axo_fastreader_active_book', book.fullPath);
      navigate('/Books/fastreader');
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
        ) : currentView === 'fastreader' ? (
          <FastReader />
        ) : (
          <Recaller 
            bookPath={localStorage.getItem('axo_fastreader_active_book') || ''} 
            bookName={path.basename(localStorage.getItem('axo_fastreader_active_book') || '').replace(/\.pdf$/i, '')}
            onClose={() => navigate('/Books/books')}
          />
        )}
      </div>

      {/* BOTTOM NAVIGATION SWITCHER */}
      <div className="fixed bottom-5 left-[calc(50%+24px)] -translate-x-1/2 z-[200] flex items-center bg-[#080808]/90 backdrop-blur-xl border border-white/8 p-1 rounded-full shadow-2xl">
        <button
          onClick={() => switchView('books')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-wider transition-all duration-200 cursor-pointer ${currentView === 'books'
            ? 'bg-white text-black shadow-lg'
            : 'text-zinc-500 hover:text-zinc-300 hover:bg-white/5'
            }`}
        >
          <img src={LibraryIcon} className={`w-3 h-3 ${currentView === 'books' ? 'brightness-0' : 'filter brightness-0 invert opacity-50'}`} alt="" />
          <span>Library</span>
        </button>
        <div className="w-px h-3 bg-white/8 mx-1" />
        <button
          onClick={() => switchView('articles')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-wider transition-all duration-200 cursor-pointer ${currentView === 'articles'
            ? 'bg-white text-black shadow-lg'
            : 'text-zinc-500 hover:text-zinc-300 hover:bg-white/5'
            }`}
        >
          <img src={FileTextIcon} className={`w-3 h-3 ${currentView === 'articles' ? 'brightness-0' : 'filter brightness-0 invert opacity-50'}`} alt="" />
          <span>Articles</span>
        </button>
        <div className="w-px h-3 bg-white/8 mx-1" />
        <button
          onClick={() => switchView('fastreader')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-wider transition-all duration-200 cursor-pointer ${currentView === 'fastreader'
            ? 'bg-white text-black shadow-lg'
            : 'text-zinc-500 hover:text-zinc-300 hover:bg-white/5'
            }`}
        >
          <img src={BookOpenIcon} className={`w-3 h-3 ${currentView === 'fastreader' ? 'brightness-0' : 'filter brightness-0 invert opacity-50'}`} alt="" />
          <span>Reader</span>
        </button>
        <div className="w-px h-3 bg-white/8 mx-1" />
        <button
          onClick={() => switchView('recaller')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-wider transition-all duration-200 cursor-pointer ${currentView === 'recaller'
            ? 'bg-white text-black shadow-lg'
            : 'text-zinc-500 hover:text-zinc-300 hover:bg-white/5'
            }`}
        >
          <img src={BrainIcon} className={`w-3 h-3 ${currentView === 'recaller' ? 'brightness-0' : 'filter brightness-0 invert opacity-50'}`} alt="" />
          <span>Recaller</span>
        </button>
        <div className="w-px h-3 bg-white/8 mx-1" />
        <button
          onClick={() => setShowDiscordModal(true)}
          title="Discord Rich Presence"
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-wider text-zinc-400 hover:text-white hover:bg-white/5 transition-all duration-200 cursor-pointer"
        >
          <svg className="w-3.5 h-3.5 fill-current text-[#5865F2]" viewBox="0 0 127.14 96.36">
            <path d="M107.7,8.07A105.15,105.15,0,0,0,81.47,0a72.06,72.06,0,0,0-3.36,6.83A97.68,97.68,0,0,0,49,6.83,72.37,72.37,0,0,0,45.64,0,105.89,105.89,0,0,0,19.39,8.09C2.79,32.65-1.71,56.6.54,80.21h0A105.73,105.73,0,0,0,32.71,96.36,77.7,77.7,0,0,0,39.6,85.25a68.42,68.42,0,0,1-10.85-5.18c.91-.66,1.8-1.34,2.66-2a75.57,75.57,0,0,0,64.32,0c.87.71,1.76,1.39,2.66,2a68.68,68.68,0,0,1-10.87,5.19,77,77,0,0,0,6.89,11.1A105.25,105.25,0,0,0,126.6,80.22h0C129.24,52.84,122.09,29.11,107.7,8.07ZM42.45,65.69C36.18,65.69,31,60,31,53s5-12.74,11.43-12.74S54,45.91,53.89,53,48.84,65.69,42.45,65.69Zm42.24,0C78.41,65.69,73.25,60,73.25,53s5-12.74,11.44-12.74S96.23,45.91,96.12,53,91.08,65.69,84.69,65.69Z" />
          </svg>
          <span>Discord</span>
        </button>
      </div>

      <DiscordRpcModal
        isOpen={showDiscordModal}
        onClose={() => setShowDiscordModal(false)}
      />
    </div>
  );
};

export default BooksParentView;