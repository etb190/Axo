import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import Skills from './Skills';
import Goals from './Goals';
import WorkflowCanvas from './WorkflowCanvas';
import RewardProgress from './RewardProgress';
import GoalsIcon from '../assets/icons/goals.svg';
import BrainIcon from '../assets/icons/brain.svg';
import RoadmapIcon from '../assets/icons/chart.svg';
import ZapIcon from '../assets/icons/zap.svg';
import Navbar from './Navbar';
import { useData } from '../contexts/DataContext';

const STORAGE_KEY = 'axo_growth_last_view';

const GrowthParent = () => {
    const { data } = useData();
    const { view } = useParams();
    const [currentView, setCurrentView] = useState(() => {
        if (view) return view;
        try { return localStorage.getItem(STORAGE_KEY) || 'goals'; } catch { return 'goals'; }
    }); // 'goals', 'skills', 'roadmap', 'rewards'
    const [isTransitioning, setIsTransitioning] = useState(false);

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

    return (
        <div className="fixed inset-0 bg-black">
            <Navbar />

            {/* BOTTOM NAVIGATION SWITCHER - Smart Segmented Control */}
            <div className="fixed bottom-6 left-[calc(50%+24px)] -translate-x-1/2 z-[200] flex items-center bg-black/80 backdrop-blur-xl border border-white/10 p-1 rounded-full shadow-2xl">
                <button
                    onClick={() => switchView('goals')}
                    className={`flex items-center gap-2 px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider transition-all duration-300 cursor-pointer ${currentView === 'goals'
                        ? 'bg-white text-black shadow-lg scale-100'
                        : 'text-zinc-500 hover:text-zinc-300 hover:bg-white/5'
                        }`}
                >
                    <img src={GoalsIcon} className={`w-3.5 h-3.5 ${currentView === 'goals' ? 'invert' : ''}`} alt="" />
                    <span>Goals</span>
                </button>
                <div className="w-[1px] h-3 bg-white/10 mx-1"></div>
                <button
                    onClick={() => switchView('skills')}
                    className={`flex items-center gap-2 px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider transition-all duration-300 cursor-pointer ${currentView === 'skills'
                        ? 'bg-white text-black shadow-lg scale-100'
                        : 'text-zinc-500 hover:text-zinc-300 hover:bg-white/5'
                        }`}
                >
                    <img src={BrainIcon} className={`w-3.5 h-3.5 ${currentView === 'skills' ? 'invert' : ''}`} alt="" />
                    <span>Skills</span>
                </button>

                <div className="w-[1px] h-3 bg-white/10 mx-1"></div>
                <button
                    onClick={() => switchView('roadmap')}
                    className={`flex items-center gap-2 px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider transition-all duration-300 cursor-pointer ${currentView === 'roadmap'
                        ? 'bg-white text-black shadow-lg scale-100'
                        : 'text-zinc-500 hover:text-zinc-300 hover:bg-white/5'
                        }`}
                >
                    <img src={RoadmapIcon} className={`w-3.5 h-3.5 ${currentView === 'roadmap' ? 'invert' : ''}`} alt="" />
                    <span>Roadmap</span>
                </button>

                <div className="w-[1px] h-3 bg-white/10 mx-1"></div>
                <button
                    onClick={() => switchView('rewards')}
                    className={`relative flex items-center gap-2 px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider transition-all duration-300 cursor-pointer ${currentView === 'rewards'
                        ? 'bg-white text-black shadow-lg scale-100'
                        : 'text-zinc-500 hover:text-zinc-300 hover:bg-white/5'
                        }`}
                >
                    <img src={ZapIcon} className={`w-3.5 h-3.5 ${currentView === 'rewards' ? 'invert' : ''}`} alt="" />
                    <span>Rewards</span>
                    {data?.rewards?.isBalancedActive && (
                        <div className="absolute top-0 left-0 w-1.5 h-1.5 bg-red-500 rounded-full border border-black shadow-[0_0_5px_rgba(239,68,68,0.5)] animate-pulse" />
                    )}
                </button>
            </div>

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
                        {currentView === 'goals' && <Goals showNavbar={false} />}
                        {currentView === 'skills' && <Skills showNavbar={false} />}
                        {currentView === 'roadmap' && <WorkflowCanvas showNavbar={false} />}
                        {currentView === 'rewards' && <RewardProgress showNavbar={false} />}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default GrowthParent;

