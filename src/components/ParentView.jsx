import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import ClockIcon from '../assets/icons/clock.svg';
import LayoutIcon from '../assets/icons/dayplanner.svg';
import PieChartIcon from '../assets/icons/chart.svg';
import ChevronRightIcon from '../assets/icons/chevron-right.svg';
import TimeTracker from './TimeTracker';
import DayPlanner from './DayPlanner';
import TimeAllocator from './TimeAllocator';
import Navbar from './Navbar';
import Todos from './Todos';

const STORAGE_KEY = 'axo_parentview_last_view';

const ParentView = () => {
  const { view } = useParams();
  const [currentView, setCurrentView] = useState(() => {
    if (view === 'dayplanner' || view === 'timetracker' || view === 'allocator') return view;
    try { return localStorage.getItem(STORAGE_KEY) || 'timetracker'; } catch { return 'timetracker'; }
  });
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [showTodos, setShowTodos] = useState(view === 'todos');

  useEffect(() => {
    if (view === 'todos') {
      setShowTodos(true);
    } else if (view === 'dayplanner' || view === 'timetracker' || view === 'allocator') {
      if (currentView !== view) {
        switchView(view);
      }
    }
  }, [view]);

  const switchView = (newView) => {
    if (isTransitioning || currentView === newView) return;

    setIsTransitioning(true);
    setTimeout(() => {
      setCurrentView(newView);
      setIsTransitioning(false);
      try { localStorage.setItem(STORAGE_KEY, newView); } catch { }
    }, 300);
  };

  return (
    <>
      {/* FIXED NAVBAR - WILL NOT SCROLL */}
      <div className="fixed top-0 left-0 z-[150]">
        <Navbar />
      </div>

      {/* BOTTOM NAVIGATION SWITCHER - Smart Segmented Control */}
      <div className="fixed bottom-6 left-[calc(50%+24px)] -translate-x-1/2 z-[200] flex items-center bg-black/80 backdrop-blur-xl border border-white/10 p-1 rounded-full shadow-2xl">
        <button
          onClick={() => switchView('timetracker')}
          className={`flex items-center gap-2 px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider transition-all duration-300 cursor-pointer ${currentView === 'timetracker'
            ? 'bg-white text-black shadow-lg scale-100'
            : 'text-zinc-500 hover:text-zinc-300 hover:bg-white/5'
            }`}
        >
          <img src={ClockIcon} className={`w-3.5 h-3.5 ${currentView === 'timetracker' ? 'invert' : ''}`} alt="" />
          <span>Tracker</span>
        </button>
        <div className="w-[1px] h-3 bg-white/10 mx-1"></div>
        <button
          onClick={() => switchView('dayplanner')}
          className={`flex items-center gap-2 px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider transition-all duration-300 cursor-pointer ${currentView === 'dayplanner'
            ? 'bg-white text-black shadow-lg scale-100'
            : 'text-zinc-500 hover:text-zinc-300 hover:bg-white/5'
            }`}
        >
          <img src={LayoutIcon} className={`w-3.5 h-3.5 ${currentView === 'dayplanner' ? 'invert' : ''}`} alt="" />
          <span>Planner</span>
        </button>
        <div className="w-[1px] h-3 bg-white/10 mx-1"></div>
        <button
          onClick={() => switchView('allocator')}
          className={`flex items-center gap-2 px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider transition-all duration-300 cursor-pointer ${currentView === 'allocator'
            ? 'bg-white text-black shadow-lg scale-100'
            : 'text-zinc-500 hover:text-zinc-300 hover:bg-white/5'
            }`}
        >
          <img src={PieChartIcon} className={`w-3.5 h-3.5 ${currentView === 'allocator' ? 'invert' : ''}`} alt="" />
          <span>Allocator</span>
        </button>
      </div>

      {/* REFINED TASKS BUTTON - Minimalist Black */}
      <button
        onClick={() => setShowTodos(true)}
        className="fixed bottom-4 right-4 z-[160] bg-zinc-950 hover:bg-white hover:text-black text-white border border-white/10 px-5 py-2 rounded-lg text-[10px] font-bold uppercase tracking-[0.2em] shadow-2xl transition-all duration-300 hover:scale-105 group cursor-pointer"
      >
        <span className="flex items-center gap-2">
          <img src={ChevronRightIcon} className="w-3.5 h-3.5 opacity-50 group-hover:invert group-hover:brightness-0 transition-all" alt="" />
          Tasks
        </span>
      </button>

      {/* Main Container - True Black */}
      <div className="fixed inset-0 bg-black">
        {/* Scrollable Content Area */}
        <div className="absolute inset-0 overflow-y-auto overflow-x-hidden pt-0 custom-scrollbar">
          <div
            className={`min-h-screen ${isTransitioning
              ? 'transition-all duration-500 ease-in-out opacity-0 scale-[0.98] blur-sm'
              : 'opacity-100'
              }`}
          >
            {currentView === 'timetracker' ? (
              <TimeTracker />
            ) : currentView === 'allocator' ? (
              <TimeAllocator showNavbar={false} />
            ) : (
              <DayPlanner />
            )}
          </div>
        </div>
      </div>

      {/* Todos Modal */}
      {showTodos && (
        <>
          <div
            className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[250] animate-in fade-in duration-300"
            onMouseDown={(e) => { if (e.target === e.currentTarget) { setShowTodos(false) } }}
          />
          <div className="fixed inset-0 z-[260] flex items-center justify-center p-4 pointer-events-none">
            <div
              className="pointer-events-auto max-w-[340px] w-full max-h-[500px] overflow-auto rounded-2xl shadow-[0_0_50px_rgba(0,0,0,1)] border border-white/5 bg-[#0f1115] animate-in zoom-in-95 fade-in duration-200"
              onClick={(e) => e.stopPropagation()}
            >
              <Todos />
            </div>
          </div>
        </>
      )}
    </>
  );
};

export default ParentView;