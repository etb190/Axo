import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import BrainIcon from '../assets/icons/brain.svg';
import BookIcon from '../assets/icons/book.svg';
import ConceptsIcon from '../assets/icons/concepts.svg';
import LanguageLearning from './LanguageLearning';
import LexiconApp from './LexiCon';
import Learning from './Learning';
import Navbar from './Navbar';

const STORAGE_KEY = 'axo_language_last_view';

const LanguageParent = () => {
    const { view, language } = useParams();
    const navigate = useNavigate();

    const resolveView = () => {
        if (view === 'lexicon' || view === 'learning' || view === 'tutor') return view;
        try { return localStorage.getItem(STORAGE_KEY) || 'learning'; } catch { return 'learning'; }
    };

    const [currentView, setCurrentView] = useState(resolveView);
    const [isTransitioning, setIsTransitioning] = useState(false);

    useEffect(() => {
        const resolved = resolveView();
        if (currentView !== resolved) switchView(resolved, true);
    }, [view]);

    const switchView = (newView, skipNav = false) => {
        if (isTransitioning || currentView === newView) return;
        setIsTransitioning(true);
        setTimeout(() => {
            setCurrentView(newView);
            setIsTransitioning(false);
            try { localStorage.setItem(STORAGE_KEY, newView); } catch {}
            if (!skipNav) {
                if (newView === 'learning' && language) {
                    navigate(`/Language/learning/${language}`);
                } else {
                    navigate(`/Language/${newView}`);
                }
            }
        }, 250);
    };

    const tabs = [
        { id: 'learning', label: 'Vocab', icon: ConceptsIcon },
        { id: 'tutor', label: 'Learning', icon: BrainIcon },
        { id: 'lexicon', label: 'LexiCon', icon: BookIcon },
    ];

    return (
        <div className="fixed inset-0 bg-black">
            <Navbar />

            {/* Bottom tab bar */}
            <div className="fixed bottom-5 left-[calc(50%+24px)] -translate-x-1/2 z-[200] flex items-center bg-[#080808]/90 backdrop-blur-xl border border-white/8 p-1 rounded-full shadow-2xl">
                {tabs.map((tab, i) => {
                    const active = currentView === tab.id;
                    return (
                        <React.Fragment key={tab.id}>
                            {i > 0 && <div className="w-px h-3 bg-white/8 mx-1" />}
                            <button
                                onClick={() => switchView(tab.id)}
                                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-wider transition-all duration-200 cursor-pointer ${
                                    active
                                        ? 'bg-white text-black shadow-lg'
                                        : 'text-zinc-500 hover:text-zinc-300 hover:bg-white/5'
                                }`}
                            >
                                <img src={tab.icon} className={`w-3 h-3 ${active ? 'brightness-0' : 'filter brightness-0 invert opacity-50'}`} alt="" />
                                <span>{tab.label}</span>
                            </button>
                        </React.Fragment>
                    );
                })}
            </div>

            {/* Content container */}
            <div className="fixed inset-0 bg-black pl-12">
                <div
                    className={`absolute inset-0 overflow-hidden transition-all duration-300 ease-in-out ${
                        isTransitioning ? 'opacity-0 scale-[0.99]' : 'opacity-100 scale-100'
                    }`}
                >
                    {/* Route-based content */}
                    {currentView === 'learning' && (
                        <div className="h-full flex flex-col">
                            <LanguageLearning showNavbar={false} />
                        </div>
                    )}
                    {currentView === 'tutor' && (
                        <div className="h-full flex flex-col">
                            <Learning />
                        </div>
                    )}
                    {currentView === 'lexicon' && (
                        <div className="h-full flex flex-col">
                            <LexiconApp showNavbar={false} />
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default LanguageParent;
