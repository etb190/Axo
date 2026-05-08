import React from 'react';
import { HashRouter, Route, Routes } from 'react-router-dom';
import { createRoot } from 'react-dom/client';
import Home from './components/Home'  // Remove the curly braces
import Timetracker from './components/TimeTracker';
import Books from './components/Books'
import FastReader from './components/fastReading';
import ParentView from './components/ParentView';
import Todos from './components/Todos';
import Goals from './components/Goals';
import BooksParentView from './components/BooksParent'
import LMStudioConnector from "./components/Roleplay/Roleplay"
import TimeAllocator from './components/TimeAllocator'

import SkillPathPlanner from './components/Skills';
import LexiconApp from './components/LexiCon';
import DailyJournal from './components/DailyJournal';
import MusicPlayer from './components/MusicPlayer';
import FinanceTracker from './components/FinanceTracker';
import GrowthParent from './components/GrowthParent';
import Accounts from './components/Accounts';
import MediaParent from './components/MediaParent';
import LanguageLearning from './components/LanguageLearning';
import LanguageParent from './components/LanguageParent';
import LanguageTutor from './components/LanguageTutor';
import Notes from './components/Notes';

import { MusicProvider } from './contexts/MusicContext';
import MiniMusicPlayer from './components/MiniMusicPlayer';

import { DataProvider, useData } from './contexts/DataContext';

const AppContent = () => {
    const { loading } = useData();

    if (loading) {
        return (
            <div className="min-h-screen bg-black flex items-center justify-center">
                <div className="flex flex-col items-center gap-4">
                    <div className="w-8 h-8 border-2 border-emerald-500/30 border-t-emerald-500 rounded-full animate-spin"></div>
                    <p className="text-neutral-500 text-[10px] uppercase font-bold tracking-widest">Starting System...</p>
                </div>
            </div>
        );
    }

    return (
        <HashRouter>
            <MiniMusicPlayer />
            <Routes>
                <Route path='/' element={<Home />} />
                <Route path='/fastReader' element={<FastReader />} />
                <Route path='/Books' element={<BooksParentView />} />
                <Route path='/Books/:view' element={<BooksParentView />} />
                <Route path='/Parentview' element={<ParentView />} />
                <Route path='/Parentview/:view' element={<ParentView />} />
                <Route path='/Todos' element={<Todos />} />
                <Route path='/Goals' element={<Goals />} />
                <Route path='/Roleplay' element={<LMStudioConnector />} />
                <Route path='/Timeallocator' element={<TimeAllocator />} />
                <Route path='/Skills' element={<SkillPathPlanner />} />
                <Route path='/LexiCon' element={<LanguageParent view="lexicon" />} />
                <Route path='/DailyJournal' element={<DailyJournal />} />
                <Route path='/Music' element={<MusicPlayer />} />
                <Route path='/Finances' element={<FinanceTracker />} />
                <Route path='/Growth' element={<GrowthParent />} />
                <Route path='/Growth/:view' element={<GrowthParent />} />
                <Route path='/Language' element={<LanguageParent />} />
                <Route path='/Language/:view' element={<LanguageParent />} />
                <Route path='/Language/:view/:language' element={<LanguageParent />} />
                <Route path='/Language/tutor/:language' element={<LanguageTutor />} />
                <Route path='/LanguageLearning' element={<LanguageParent view="learning" />} />
                <Route path='/LanguageLearning/:language' element={<LanguageParent view="learning" />} />
                <Route path='/Accounts' element={<Accounts />} />
                <Route path='/Media' element={<MediaParent />} />
                <Route path='/Media/:view' element={<MediaParent />} />
                <Route path='/Notes' element={<Notes />} />
            </Routes>
        </HashRouter>
    );
};

const root = createRoot(document.getElementById('root'));
root.render(
    <MusicProvider>
        <DataProvider>
            <AppContent />
        </DataProvider>
    </MusicProvider>
);

