import React, { useState, useEffect, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import TVPlayer from './TVPlayer';
import Gallery from './Gallery';
import Navbar from './Navbar';

const STORAGE_KEY = 'axo_media_last_view';

const MediaParent = () => {
    const { view } = useParams();
    const [currentView, setCurrentView] = useState(() => {
        if (view) return view;
        try { return localStorage.getItem(STORAGE_KEY) || 'tv'; } catch { return 'tv'; }
    }); // 'tv' | 'gallery'
    const [isTransitioning, setIsTransitioning] = useState(false);
    const [isViewingMedia, setIsViewingMedia] = useState(false);

    useEffect(() => {
        if (view && view !== currentView) {
            switchView(view);
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

    const handleViewingMedia = useCallback((viewing) => {
        setIsViewingMedia(viewing);
    }, []);

    return (
        <div className="fixed inset-0 bg-black">
            <Navbar />

            {/* BOTTOM NAVIGATION SWITCHER — hidden when viewing media */}
            <div className={`fixed bottom-6 left-[calc(50%+24px)] -translate-x-1/2 z-[200] flex items-center bg-black/80 backdrop-blur-xl border border-white/10 p-1 rounded-full shadow-2xl transition-all duration-300 ${isViewingMedia ? 'opacity-0 pointer-events-none translate-y-4' : 'opacity-100 translate-y-0'}`}>
                <button
                    onClick={() => switchView('tv')}
                    className={`flex items-center gap-2 px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider transition-all duration-300 cursor-pointer ${currentView === 'tv'
                        ? 'bg-white text-black shadow-lg scale-100'
                        : 'text-zinc-500 hover:text-zinc-300 hover:bg-white/5'
                        }`}
                >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={currentView === 'tv' ? 'invert' : ''}><rect x="2" y="7" width="20" height="15" rx="2" ry="2" /><polyline points="17 2 12 7 7 2" /></svg>
                    <span>TV</span>
                </button>
                <div className="w-[1px] h-3 bg-white/10 mx-1"></div>
                <button
                    onClick={() => switchView('gallery')}
                    className={`flex items-center gap-2 px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider transition-all duration-300 cursor-pointer ${currentView === 'gallery'
                        ? 'bg-white text-black shadow-lg scale-100'
                        : 'text-zinc-500 hover:text-zinc-300 hover:bg-white/5'
                        }`}
                >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={currentView === 'gallery' ? 'invert' : ''}><rect x="3" y="3" width="18" height="18" rx="2" ry="2" /><circle cx="8.5" cy="8.5" r="1.5" /><polyline points="21 15 16 10 5 21" /></svg>
                    <span>Gallery</span>
                </button>
            </div>

            {/* Main Container */}
            <div className="fixed top-0 right-0 bottom-0 left-12 bg-black">
                <div className="absolute inset-0 overflow-y-auto overflow-x-hidden pt-0 custom-scrollbar">
                    <div
                        className={`min-h-screen ${isTransitioning
                            ? 'transition-all duration-500 ease-in-out opacity-0 scale-[0.98] blur-sm'
                            : 'opacity-100'
                            }`}
                    >
                        {currentView === 'tv' && <TVPlayer showNavbar={false} onViewingMedia={handleViewingMedia} />}
                        {currentView === 'gallery' && <Gallery showNavbar={false} onViewingMedia={handleViewingMedia} />}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default MediaParent;
