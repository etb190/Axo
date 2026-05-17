import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import Skills from './Skills';
import Goals from './Goals';
import WorkflowCanvas from './WorkflowCanvas';
import GoalsIcon from '../assets/icons/goals.svg';
import BrainIcon from '../assets/icons/brain.svg';
import RoadmapIcon from '../assets/icons/chart.svg';
import TrainingIcon from '../assets/icons/zap.svg';
import Navbar from './Navbar';
import SkillsTraining from './VoiceTraining';
import { useData } from '../contexts/DataContext';

const STORAGE_KEY = 'axo_growth_last_view';

const GrowthParent = () => {
    const { data } = useData();
    const { view } = useParams();
    const [currentView, setCurrentView] = useState(() => {
        if (view) return view;
        try { return localStorage.getItem(STORAGE_KEY) || 'goals'; } catch { return 'goals'; }
    }); // 'goals', 'skills', 'roadmap', 'training'
    const [isTransitioning, setIsTransitioning] = useState(false);

    useEffect(() => {
        if (view && view !== currentView) {
            switchView(view);
        }
    }, [view]);

    const navigate = useNavigate();

    const switchView = (newView) => {
        if (isTransitioning || currentView === newView) return;

        setIsTransitioning(true);
        setTimeout(() => {
            setCurrentView(newView);
            setIsTransitioning(false);
            try { localStorage.setItem(STORAGE_KEY, newView); } catch { }
            // Update URL to match state
            if (view !== newView) {
                navigate(`/Growth/${newView}`);
            }
        }, 300);
    };

    return (
        <div className="fixed inset-0 bg-black">
            <Navbar />

            {/* BOTTOM NAVIGATION SWITCHER - Smart Segmented Control */}
            <div className="absolute bottom-6 left-[calc(50%+24px)] -translate-x-1/2 z-[200] flex items-center bg-black/80 backdrop-blur-xl border border-white/10 p-1 rounded-full shadow-2xl">
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
                    onClick={() => switchView('training')}
                    className={`flex items-center gap-2 px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider transition-all duration-300 cursor-pointer ${currentView === 'training'
                        ? 'bg-white text-black shadow-lg scale-100'
                        : 'text-zinc-500 hover:text-zinc-300 hover:bg-white/5'
                        }`}
                >
                    <img src={TrainingIcon} className={`w-3.5 h-3.5 ${currentView === 'training' ? 'invert' : ''}`} alt="" />
                    <span>Training</span>
                </button>
            </div>

            {/* Main Container - True Black */}
            <div className="fixed inset-0 bg-black -z-10" />

            {/* Content Area */}
            <div className="absolute inset-0 overflow-hidden pt-0">
                <div
                    className={`h-full w-full ${isTransitioning
                        ? 'transition-all duration-500 ease-in-out opacity-0 scale-[0.98] blur-sm'
                        : 'opacity-100'
                        }`}
                >
                    {currentView === 'goals' && <Goals showNavbar={false} />}
                    {currentView === 'skills' && <Skills showNavbar={false} />}
                    {currentView === 'roadmap' && <WorkflowCanvas showNavbar={false} />}
                    {currentView === 'training' && <SkillsTraining />}
                </div>
            </div>
        </div>
    );
};

export default GrowthParent;

