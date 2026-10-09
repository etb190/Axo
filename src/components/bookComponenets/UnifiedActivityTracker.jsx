import React, { useState } from 'react';
import PagesLogTracker from './PagesLogTracker';
import CompletedItemsTracker from './CompletedItemsTracker';

const UnifiedActivityTracker = ({ logs = [], books = [], articles = [] }) => {
    const [activeView, setActiveView] = useState(() => localStorage.getItem('trackerView') || 'pages');

    const handleViewChange = (v) => {
        setActiveView(v);
        localStorage.setItem('trackerView', v);
    };

    return (
        <div className="relative z-50 bg-[#0a0a0a]/40 backdrop-blur-md rounded-2xl border border-white/5 p-5 mb-4 group hover:bg-[#0a0a0a]/60 transition-all duration-300">
            {/* Render selected view with integrated toggle */}
            {activeView === 'pages' ? (
                <PagesLogTracker logs={logs} isInner={true} view={activeView} onViewChange={handleViewChange} />
            ) : (
                <CompletedItemsTracker books={books} articles={articles} isInner={true} view={activeView} onViewChange={handleViewChange} />
            )}
        </div>
    );
};

export default UnifiedActivityTracker;
