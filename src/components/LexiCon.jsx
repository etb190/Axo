import React, { useState, useEffect, useRef } from 'react';
import { useData } from '../contexts/DataContext';

// --- Electron / Node.js Imports ---
const { readdir, writeFile, readFile, unlink, stat, mkdir } = window.require('fs').promises;
const path = window.require('path');
import Navbar from './Navbar';
import searchIcon from '../assets/icons/search.svg';
import deleteIcon from '../assets/icons/delete.svg';
import editIcon from '../assets/icons/edit.svg';
import plusIcon from '../assets/icons/plus.svg';
import chevronRightIcon from '../assets/icons/chevron-right.svg';
import loaderIcon from '../assets/icons/loader.svg';
import checkIcon from '../assets/icons/check.svg';
import brainIcon from '../assets/icons/brain.svg';
import bookIcon from '../assets/icons/book.svg';

// --- Configuration ---
const DATA_DIR_PATH = path.join('C:\\Users\\PC\\Desktop\\database', 'Words');

// --- Styles ---
// We inject a specific style block to handle 3D transforms reliably across browsers
const flipCardStyles = `
  .perspective-1000 {
    perspective: 1000px;
  }
  .preserve-3d {
    transform-style: preserve-3d;
  }
  .rotate-y-180 {
    transform: rotateY(180deg);
  }
  .backface-hidden {
    backface-visibility: hidden;
    -webkit-backface-visibility: hidden; /* Safari support */
  }
  .card-inner {
    position: relative;
    width: 100%;
    height: 100%;
    text-align: center;
    transition: transform 0.6s cubic-bezier(0.4, 0.0, 0.2, 1);
    transform-style: preserve-3d;
  }
  .card-face {
    position: absolute;
    width: 100%;
    height: 100%;
    -webkit-backface-visibility: hidden; /* Safari */
    backface-visibility: hidden;
    border-radius: 1rem;
    overflow: hidden;
  }
`;

// --- Helper Components ---

const Toast = ({ message, type }) => {
    const bgColors = {
        success: 'bg-emerald-600',
        error: 'bg-rose-600',
        info: 'bg-blue-600'
    };

    return (
        <div className={`fixed bottom-5 right-5 ${bgColors[type]} text-white px-4 py-2 rounded-lg shadow-2xl flex items-center gap-3 transform transition-all duration-300 z-[500] animate-bounce-in`}>
            <img
                src={type === 'success' ? checkIcon : loaderIcon}
                className="w-4 h-4 filter brightness-0 invert"
                alt={type}
            />
            <span className="text-[11px] font-bold uppercase tracking-wider">{message}</span>
        </div>
    );
};

// --- Main Component ---

const LexiconApp = ({ showNavbar = true }) => {
    const { data, refreshData } = useData();
    // -- State --
    const [words, setWords] = useState(data.lexicon.allWords || []);
    const [basicInput, setBasicInput] = useState('');
    const [advancedInput, setAdvancedInput] = useState('');
    const [searchQuery, setSearchQuery] = useState('');
    const [activeTab, setActiveTab] = useState('library');
    const [toast, setToast] = useState(null);

    // Edit Mode State
    const [editingId, setEditingId] = useState(null);
    const [editBasicInput, setEditBasicInput] = useState('');
    const [editAdvancedInput, setEditAdvancedInput] = useState('');

    // Practice Mode State
    const [shuffledWords, setShuffledWords] = useState([]);
    const [currentIndex, setCurrentIndex] = useState(0);
    const [isFlipped, setIsFlipped] = useState(false);
    const [showPracticeSummary, setShowPracticeSummary] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    const [isTransitioning, setIsTransitioning] = useState(false);
    const timeoutRef = useRef(null);

    // -- Database Interaction Functions --

    // -- Database Interaction Functions --

    useEffect(() => {
        if (data.lexicon && data.lexicon.allWords) {
            setWords(data.lexicon.allWords);
            setIsLoading(false);
        }
    }, [data.lexicon]);

    const saveWordToDisk = async (word) => {
        try {
            await mkdir(DATA_DIR_PATH, { recursive: true });
            const fileName = `${word.id}.json`;
            const filePath = path.join(DATA_DIR_PATH, fileName);
            await writeFile(filePath, JSON.stringify(word, null, 2), 'utf8');
            refreshData();
            return true;
        } catch (error) {
            console.error('Error saving word:', error);
            return false;
        }
    };

    const deleteWordFromDisk = async (id) => {
        try {
            const fileName = `${id}.json`;
            const filePath = path.join(DATA_DIR_PATH, fileName);
            await unlink(filePath);
            refreshData();
            return true;
        } catch (error) {
            console.error('Error deleting word:', error);
            return false;
        }
    };

    // -- Handlers --

    const showToast = (message, type = 'info') => {
        setToast({ message, type });
        setTimeout(() => {
            setToast(null);
        }, 3000);
    };

    const addWord = async (e) => {
        e.preventDefault();
        if (!basicInput.trim() || !advancedInput.trim()) {
            showToast('Please fill in both fields.', 'error');
            return;
        }

        const colors = [
            'from-zinc-500 to-zinc-700',
            'from-zinc-600 to-zinc-800',
            'from-zinc-400 to-zinc-600',
            'from-slate-500 to-slate-700',
        ];
        const randomColor = colors[Math.floor(Math.random() * colors.length)];

        const newWord = {
            id: Date.now(),
            basic: basicInput.trim(),
            advanced: advancedInput.trim(),
            color: randomColor
        };

        setWords([...words, newWord]);
        setBasicInput('');
        setAdvancedInput('');

        const success = await saveWordToDisk(newWord);
        if (success) {
            showToast('Word pair added.', 'success');
        } else {
            showToast('Failed to save.', 'error');
        }
    };

    const deleteWord = async (id) => {
        if (!window.confirm('Are you sure you want to remove this entry?')) return;

        setWords(words.filter(w => w.id !== id));
        const success = await deleteWordFromDisk(id);
        if (success) {
            showToast('Word removed.', 'success');
        }
    };

    const handleEditStart = (word) => {
        setEditingId(word.id);
        setEditBasicInput(word.basic);
        setEditAdvancedInput(word.advanced);
    };

    const handleCancelEdit = () => {
        setEditingId(null);
        setEditBasicInput('');
        setEditAdvancedInput('');
    };

    const handleSaveEdit = async () => {
        if (!editBasicInput.trim() || !editAdvancedInput.trim()) {
            showToast('Please fill in both fields.', 'error');
            return;
        }

        const updatedWord = {
            ...words.find(w => w.id === editingId),
            basic: editBasicInput.trim(),
            advanced: editAdvancedInput.trim()
        };

        setWords(words.map(w => w.id === editingId ? updatedWord : w));
        const success = await saveWordToDisk(updatedWord);
        if (success) {
            showToast('Word updated.', 'success');
            setEditingId(null);
        }
    };

    // Practice Logic
    useEffect(() => {
        if (activeTab === 'practice') {
            startPractice();
        }
    }, [activeTab]);

    const startPractice = () => {
        if (timeoutRef.current) clearTimeout(timeoutRef.current);
        const shuffled = [...words].sort(() => 0.5 - Math.random());
        setShuffledWords(shuffled);
        setCurrentIndex(0);
        setIsFlipped(false);
        setIsTransitioning(false);
        setShowPracticeSummary(false);
    };

    const handleNext = () => {
        if (!isFlipped || isTransitioning) return;
        if (currentIndex < shuffledWords.length - 1) {
            setIsTransitioning(true);
            setIsFlipped(false);

            // Wait for the full 0.6s transition to complete before updating content
            timeoutRef.current = setTimeout(() => {
                setCurrentIndex(prev => prev + 1);
                setIsTransitioning(false);
            }, 600);
        } else {
            setShowPracticeSummary(true);
        }
    };

    const copyToClipboard = (text) => {
        navigator.clipboard.writeText(text);
        showToast('Copied.', 'success');
    };

    const filteredWords = words.filter(word => {
        const query = searchQuery.toLowerCase();
        return word.basic.toLowerCase().includes(query) ||
            word.advanced.toLowerCase().includes(query);
    });

    if (isLoading) {
        return (
            <div className="min-h-screen bg-black flex items-center justify-center">
                <img src={loaderIcon} className="w-6 h-6 filter brightness-0 invert opacity-20 animate-spin" alt="Loading" />
            </div>
        );
    }

    return (
        <>
            {showNavbar && <Navbar />}
            <style>{flipCardStyles}</style>
            <div className="min-h-screen pb-10 bg-black pl-12">
                {toast && <Toast message={toast.message} type={toast.type} />}

                {/* Edit Modal */}
                {editingId && (
                    <div className="fixed inset-0 z-[300] flex items-center justify-center bg-black/90 backdrop-blur-sm p-4">
                        <div className="bg-[#0a0a0a] border border-white/5 rounded-xl p-5 w-full max-w-[320px] shadow-2xl">
                            <h2 className="text-[10px] font-bold text-zinc-500 uppercase tracking-[0.2em] mb-4">Edit Entry</h2>
                            <div className="space-y-3">
                                <input
                                    type="text"
                                    value={editBasicInput}
                                    onChange={(e) => setEditBasicInput(e.target.value)}
                                    className="w-full px-3 py-2 bg-black border border-white/5 rounded-lg focus:outline-none focus:border-zinc-700 text-xs text-white transition-all"
                                    placeholder="Basic"
                                />
                                <input
                                    type="text"
                                    value={editAdvancedInput}
                                    onChange={(e) => setEditAdvancedInput(e.target.value)}
                                    className="w-full px-3 py-2 bg-black border border-white/5 rounded-lg focus:outline-none focus:border-zinc-700 text-xs text-white transition-all"
                                    placeholder="Advanced"
                                />
                            </div>
                            <div className="flex gap-2 mt-5">
                                <button onClick={handleCancelEdit} className="flex-1 py-2 bg-transparent text-zinc-600 hover:text-zinc-400 text-[10px] font-bold uppercase tracking-widest transition-all cursor-pointer">Cancel</button>
                                <button onClick={handleSaveEdit} className="flex-1 py-2 bg-zinc-900 hover:bg-white hover:text-black text-white font-bold rounded-lg text-[10px] uppercase tracking-widest transition-all cursor-pointer border border-white/10">Update</button>
                            </div>
                        </div>
                    </div>
                )}

                <main className="max-w-2xl mx-auto px-4 py-2">
                    {/* Compact Tab Switcher */}
                    <div className="flex justify-center mb-3">
                        <div className="bg-zinc-950 p-0.5 rounded-lg flex w-full max-w-[200px] border border-white/5">
                            <button
                                onClick={() => setActiveTab('library')}
                                className={`flex-1 py-1.5 rounded-md text-[10px] font-bold uppercase tracking-widest transition-all cursor-pointer ${activeTab === 'library' ? 'bg-zinc-900 text-white shadow-lg' : 'text-zinc-600 hover:text-zinc-400'}`}
                            >
                                Library
                            </button>
                            <button
                                onClick={() => setActiveTab('practice')}
                                className={`flex-1 py-1.5 rounded-md text-[10px] font-bold uppercase tracking-widest transition-all cursor-pointer ${activeTab === 'practice' ? 'bg-zinc-900 text-white shadow-lg' : 'text-zinc-600 hover:text-zinc-400'}`}
                            >
                                Study
                            </button>
                        </div>
                    </div>

                    {activeTab === 'library' && (
                        <div className="space-y-4 animate-in fade-in duration-500">
                            {/* Input Form - Very Compact */}
                            <form onSubmit={addWord} className="bg-zinc-950/50 rounded-xl p-3 border border-white/5 flex gap-2">
                                <input
                                    type="text"
                                    placeholder="Basic..."
                                    value={basicInput}
                                    onChange={(e) => { const v = e.target.value; setBasicInput(v.charAt(0).toUpperCase() + v.slice(1)); }}
                                    className="flex-1 px-3 py-1.5 bg-black border border-white/5 rounded-lg focus:outline-none focus:border-zinc-800 text-xs text-zinc-300 placeholder-zinc-800 transition-all font-mono"
                                />
                                <div className="flex items-center">
                                    <img src={chevronRightIcon} className="w-3 h-3 filter brightness-0 invert opacity-20" alt="to" />
                                </div>
                                <input
                                    type="text"
                                    placeholder="Advanced..."
                                    value={advancedInput}
                                    onChange={(e) => { const v = e.target.value; setAdvancedInput(v.charAt(0).toUpperCase() + v.slice(1)); }}
                                    className="flex-1 px-3 py-1.5 bg-black border border-white/5 rounded-lg focus:outline-none focus:border-zinc-800 text-xs text-zinc-300 placeholder-zinc-800 transition-all font-mono"
                                />
                                <button type="submit" className="px-4 py-1.5 bg-zinc-900 hover:bg-white hover:text-black text-white text-[10px] font-bold uppercase tracking-widest rounded-lg transition-all border border-white/10 cursor-pointer">Add</button>
                            </form>

                            <div className="relative group">
                                <div className="absolute left-3 top-2.5">
                                    <img src={searchIcon} className="w-3 h-3 filter brightness-0 invert opacity-20 group-focus-within:opacity-50 transition-opacity" alt="search" />
                                </div>
                                <input
                                    type="text"
                                    placeholder="Search library..."
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    className="w-full pl-8 pr-8 py-2 bg-transparent border-b border-white/5 focus:border-zinc-700 text-xs text-zinc-400 placeholder-zinc-800 outline-none transition-all font-mono"
                                />
                            </div>

                            {/* Compact Grid */}
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-2">
                                {filteredWords.map((word) => (
                                    <div key={word.id} className="group relative bg-[#050505] rounded-xl p-3 border border-white/5 hover:border-zinc-800 transition-all">
                                        <div className="flex justify-between items-start">
                                            <div className="space-y-1">
                                                <p className="text-[9px] font-bold text-zinc-600 uppercase tracking-tighter">Don't Say</p>
                                                <p className="text-[14px] text-zinc-500 line-through decoration-zinc-800/50 font-mono">{word.basic}</p>
                                                <div className="h-2"></div>
                                                <p className="text-[9px] font-bold text-zinc-400 uppercase tracking-tighter">Instead</p>
                                                <p onClick={() => copyToClipboard(word.advanced)} className="text-lg font-bold text-zinc-200 cursor-pointer hover:text-white transition-colors tracking-tight font-serif italic">
                                                    {word.advanced}
                                                </p>
                                            </div>
                                            <div className="flex flex-col gap-1 ml-3 opacity-20 group-hover:opacity-100 transition-opacity">
                                                <button
                                                    onClick={() => handleEditStart(word)}
                                                    className="p-2 bg-black/40 border border-white/5 rounded-md text-zinc-600 hover:text-white hover:border-zinc-700 transition-all cursor-pointer flex items-center justify-center"
                                                    title="Edit Entry"
                                                >
                                                    <img src={editIcon} className="w-3 h-3 filter brightness-0 invert opacity-50 hover:opacity-100" alt="edit" />
                                                </button>
                                                <button
                                                    onClick={() => deleteWord(word.id)}
                                                    className="p-2 bg-black/40 border border-white/5 rounded-md text-zinc-600 hover:text-rose-500 hover:border-rose-900/30 transition-all cursor-pointer flex items-center justify-center"
                                                    title="Delete Entry"
                                                >
                                                    <img src={deleteIcon} className="w-3 h-3 filter brightness-0 invert opacity-50 hover:opacity-100 placeholder-rose-500" alt="delete" />
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {activeTab === 'practice' && (
                        <div className="flex flex-col items-center justify-center min-h-[300px] animate-in fade-in duration-700">
                            {words.length < 2 ? (
                                <div className="text-center p-8 bg-zinc-950 rounded-2xl border border-white/5">
                                    <p className="text-[10px] font-bold text-zinc-600 uppercase tracking-widest italic">Add more words to begin.</p>
                                </div>
                            ) : showPracticeSummary ? (
                                <div className="text-center">
                                    <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-[0.3em] mb-4">Complete</p>
                                    <button onClick={startPractice} className="px-6 py-2 bg-white text-black text-[10px] font-bold uppercase tracking-widest rounded-lg hover:bg-zinc-200 transition-all cursor-pointer">Repeat Session</button>
                                </div>
                            ) : (
                                <div className="w-full max-w-[340px] perspective-1000">
                                    <div className="text-center mb-4 text-[9px] font-bold text-zinc-700 uppercase tracking-widest">
                                        Session Progress: {currentIndex + 1} / {shuffledWords.length}
                                    </div>
                                    <div className="relative w-full h-[220px] cursor-pointer" onClick={() => !isTransitioning && setIsFlipped(!isFlipped)}>
                                        <div className={`card-inner ${isFlipped ? 'rotate-y-180' : ''}`}>
                                            <div className="card-face bg-[#050505] rounded-xl shadow-2xl border border-white/5 flex flex-col items-center justify-center p-6">
                                                <span className="text-[9px] font-bold text-zinc-600 uppercase tracking-widest mb-4">Basic</span>
                                                <h2 className="text-3xl font-bold text-zinc-200 text-center font-mono">
                                                    {isTransitioning ? shuffledWords[currentIndex]?.basic : shuffledWords[currentIndex]?.basic}
                                                </h2>
                                                <div className="mt-6 text-zinc-800 text-[9px] uppercase tracking-widest">Click to reveal</div>
                                            </div>
                                            <div className="card-face bg-zinc-950 rounded-xl border border-zinc-800 flex flex-col items-center justify-center p-6 rotate-y-180">
                                                <span className="text-[9px] font-bold text-zinc-400 uppercase tracking-widest mb-4">Advanced</span>
                                                <h2 className="text-4xl font-bold text-white text-center font-serif italic">
                                                    {isTransitioning ? '' : shuffledWords[currentIndex]?.advanced}
                                                </h2>
                                                <button onClick={(e) => { e.stopPropagation(); handleNext(); }} className="mt-8 px-4 py-1.5 bg-black border border-white/10 text-white rounded-lg text-[9px] font-bold uppercase tracking-widest hover:bg-white hover:text-black transition-all">Next Entry</button>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                </main>
            </div>
        </>
    );
};

export default LexiconApp;