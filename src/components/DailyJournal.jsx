import React, { useState, useEffect, useCallback } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import { useMemo } from 'react';
import { useLocation } from 'react-router-dom';
import StarterKit from '@tiptap/starter-kit';
import Underline from '@tiptap/extension-underline';
import Placeholder from '@tiptap/extension-placeholder';
import TextAlign from '@tiptap/extension-text-align';
import Typography from '@tiptap/extension-typography';
import CodeBlockLowlight from '@tiptap/extension-code-block-lowlight';
import { common, createLowlight } from 'lowlight';
import boldIcon from '../assets/icons/bold.svg';
import italicIcon from '../assets/icons/italic.svg';
import underlineIcon from '../assets/icons/underline.svg';
import strikethroughIcon from '../assets/icons/strikethrough.svg';
import heading1Icon from '../assets/icons/heading1.svg';
import heading2Icon from '../assets/icons/heading2.svg';
import listIcon from '../assets/icons/list.svg';
import listOrderedIcon from '../assets/icons/list-ordered.svg';
import quoteIcon from '../assets/icons/quote.svg';
import codeIcon from '../assets/icons/hash.svg';

import alignLeftIcon from '../assets/icons/align-left.svg';
import alignCenterIcon from '../assets/icons/align-center.svg';
import alignRightIcon from '../assets/icons/align-right.svg';
import fileTextIcon from '../assets/icons/journal.svg';
import plusIcon from '../assets/icons/plus.svg';
import trashIcon from '../assets/icons/delete.svg';
import calendarIcon from '../assets/icons/calendar.svg';
import searchIcon from '../assets/icons/search.svg';
import panelLeftCloseIcon from '../assets/icons/panel-left-close.svg';
import panelLeftOpenIcon from '../assets/icons/panel-left-open.svg';
import moveVerticalIcon from '../assets/icons/move-vertical.svg';
import leftIcon from '../assets/icons/chevron-left.svg';
import { useNavigate } from 'react-router-dom';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import Navbar from './Navbar';

// Helper for conditional classes
function cn(...inputs) {
    return twMerge(clsx(inputs));
}

// Helper for word count
const countWords = (html) => {
    if (!html) return 0;
    // Strip HTML tags and normalize spaces
    const text = html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
    return text ? text.split(/\s+/).length : 0;
};

// File System Configuration
const path = window.require('path');
const fs = window.require('fs');
const fsPromises = fs.promises;

const DB_PATH = 'C:\\Users\\PC\\Desktop\\database\\DailyJournal';

// Ensure directory exists
if (!fs.existsSync(DB_PATH)) {
    fs.mkdirSync(DB_PATH, { recursive: true });
}

const MenuBar = ({ editor, spacing, setSpacing, navActions }) => {
    if (!editor) {
        return null;
    }

    return (
        <div className="flex flex-wrap items-center justify-center gap-1 p-2 border-b border-neutral-200 dark:border-zinc-800 bg-zinc-100 dark:bg-zinc-800/90 backdrop-blur-sm sticky top-0 z-10 transition-colors duration-300">
            <button
                onClick={() => editor.chain().focus().toggleBold().run()}
                disabled={!editor.can().chain().focus().toggleBold().run()}
                className={cn("p-2 rounded hover:bg-neutral-200 dark:hover:bg-neutral-700 transition-colors cursor-pointer", editor.isActive('bold') ? 'bg-neutral-200 dark:bg-neutral-700 text-black dark:text-white' : 'text-neutral-500 dark:text-neutral-400')}
                title="Bold (Ctrl+B)"
            >
                <img src={boldIcon} className="w-[18px] h-[18px] transition-all" style={{ filter: editor.isActive('bold') ? 'brightness(0) invert(1)' : 'brightness(0) invert(1) opacity(0.4)' }} />
            </button>
            <button
                onClick={() => editor.chain().focus().toggleItalic().run()}
                disabled={!editor.can().chain().focus().toggleItalic().run()}
                className={cn("p-2 rounded hover:bg-neutral-200 dark:hover:bg-neutral-700 transition-colors cursor-pointer", editor.isActive('italic') ? 'bg-neutral-200 dark:bg-neutral-700 text-black dark:text-white' : 'text-neutral-500 dark:text-neutral-400')}
                title="Italic (Ctrl+I)"
            >
                <img src={italicIcon} className="w-[18px] h-[18px] transition-all" style={{ filter: editor.isActive('italic') ? 'brightness(0) invert(1)' : 'brightness(0) invert(1) opacity(0.4)' }} />
            </button>
            <button
                onClick={() => editor.chain().focus().toggleUnderline().run()}
                disabled={!editor.can().chain().focus().toggleUnderline().run()}
                className={cn("p-2 rounded hover:bg-neutral-200 dark:hover:bg-neutral-700 transition-colors cursor-pointer", editor.isActive('underline') ? 'bg-neutral-200 dark:bg-neutral-700 text-black dark:text-white' : 'text-neutral-500 dark:text-neutral-400')}
                title="Underline (Ctrl+U)"
            >
                <img src={underlineIcon} className="w-[18px] h-[18px] transition-all" style={{ filter: editor.isActive('underline') ? 'brightness(0) invert(1)' : 'brightness(0) invert(1) opacity(0.4)' }} />
            </button>
            <button
                onClick={() => editor.chain().focus().toggleStrike().run()}
                disabled={!editor.can().chain().focus().toggleStrike().run()}
                className={cn("p-2 rounded hover:bg-neutral-200 dark:hover:bg-neutral-700 transition-colors cursor-pointer", editor.isActive('strike') ? 'bg-neutral-200 dark:bg-neutral-700 text-black dark:text-white' : 'text-neutral-500 dark:text-neutral-400')}
                title="Strikethrough (Ctrl+Shift+X)"
            >
                <img src={strikethroughIcon} className="w-[18px] h-[18px] transition-all" style={{ filter: editor.isActive('strike') ? 'brightness(0) invert(1)' : 'brightness(0) invert(1) opacity(0.4)' }} />
            </button>

            <div className="w-px h-6 bg-neutral-300 dark:bg-neutral-700 mx-1"></div>

            <button
                onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
                className={cn("p-2 rounded hover:bg-neutral-200 dark:hover:bg-neutral-700 transition-colors cursor-pointer", editor.isActive('heading', { level: 1 }) ? 'bg-neutral-200 dark:bg-neutral-700 text-black dark:text-white' : 'text-neutral-500 dark:text-neutral-400')}
                title="Heading 1 (Ctrl+Alt+1)"
            >
                <img src={heading1Icon} className="w-[18px] h-[18px] transition-all" style={{ filter: editor.isActive('heading', { level: 1 }) ? 'brightness(0) invert(1)' : 'brightness(0) invert(1) opacity(0.4)' }} />
            </button>
            <button
                onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
                className={cn("p-2 rounded hover:bg-neutral-200 dark:hover:bg-neutral-700 transition-colors cursor-pointer", editor.isActive('heading', { level: 2 }) ? 'bg-neutral-200 dark:bg-neutral-700 text-black dark:text-white' : 'text-neutral-500 dark:text-neutral-400')}
                title="Heading 2 (Ctrl+Alt+2)"
            >
                <img src={heading2Icon} className="w-[18px] h-[18px] transition-all" style={{ filter: editor.isActive('heading', { level: 2 }) ? 'brightness(0) invert(1)' : 'brightness(0) invert(1) opacity(0.4)' }} />
            </button>

            <div className="w-px h-6 bg-neutral-300 dark:bg-neutral-700 mx-1"></div>

            <button
                onClick={() => editor.chain().focus().toggleBulletList().run()}
                className={cn("p-2 rounded hover:bg-neutral-200 dark:hover:bg-neutral-700 transition-colors cursor-pointer", editor.isActive('bulletList') ? 'bg-neutral-200 dark:bg-neutral-700 text-black dark:text-white' : 'text-neutral-500 dark:text-neutral-400')}
                title="Bullet List (Ctrl+Shift+8)"
            >
                <img src={listIcon} className="w-[18px] h-[18px] transition-all" style={{ filter: editor.isActive('bulletList') ? 'brightness(0) invert(1)' : 'brightness(0) invert(1) opacity(0.4)' }} />
            </button>
            <button
                onClick={() => editor.chain().focus().toggleOrderedList().run()}
                className={cn("p-2 rounded hover:bg-neutral-200 dark:hover:bg-neutral-700 transition-colors cursor-pointer", editor.isActive('orderedList') ? 'bg-neutral-200 dark:bg-neutral-700 text-black dark:text-white' : 'text-neutral-500 dark:text-neutral-400')}
                title="Ordered List (Ctrl+Shift+7)"
            >
                <img src={listOrderedIcon} className="w-[18px] h-[18px] transition-all" style={{ filter: editor.isActive('orderedList') ? 'brightness(0) invert(1)' : 'brightness(0) invert(1) opacity(0.4)' }} />
            </button>
            <button
                onClick={() => editor.chain().focus().toggleBlockquote().run()}
                className={cn("p-2 rounded hover:bg-neutral-200 dark:hover:bg-neutral-700 transition-colors cursor-pointer", editor.isActive('blockquote') ? 'bg-neutral-200 dark:bg-neutral-700 text-black dark:text-white' : 'text-neutral-500 dark:text-neutral-400')}
                title="Blockquote (Ctrl+Shift+B)"
            >
                <img src={quoteIcon} className="w-[18px] h-[18px] transition-all" style={{ filter: editor.isActive('blockquote') ? 'brightness(0) invert(1)' : 'brightness(0) invert(1) opacity(0.4)' }} />
            </button>

            <button
                onClick={() => editor.chain().focus().toggleCodeBlock().run()}
                className={cn("p-2 rounded hover:bg-neutral-200 dark:hover:bg-neutral-700 transition-colors cursor-pointer", editor.isActive('codeBlock') ? 'bg-neutral-200 dark:bg-neutral-700 text-black dark:text-white' : 'text-neutral-500 dark:text-neutral-400')}
                title="Code Block (Ctrl+Alt+C)"
            >
                <img src={codeIcon} className="w-[18px] h-[18px] transition-all" style={{ filter: editor.isActive('codeBlock') ? 'brightness(0) invert(1)' : 'brightness(0) invert(1) opacity(0.4)' }} />
            </button>

            <button
                onClick={() => editor.chain().focus().toggleCode().run()}
                className={cn("p-2 rounded hover:bg-neutral-200 dark:hover:bg-neutral-700 transition-colors cursor-pointer", editor.isActive('code') ? 'bg-neutral-200 dark:bg-neutral-700 text-black dark:text-white' : 'text-neutral-500 dark:text-neutral-400')}
                title="Inline Code (Ctrl+E)"
            >
                <img src={codeIcon} className="w-[18px] h-[18px] transition-all" style={{ filter: editor.isActive('code') ? 'brightness(0) invert(1)' : 'brightness(0) invert(1) opacity(0.4)' }} />
            </button>

            <div className="w-px h-6 bg-neutral-300 dark:bg-neutral-700 mx-1"></div>

            <button
                onClick={() => editor.chain().focus().setTextAlign('left').run()}
                className={cn("p-2 rounded hover:bg-neutral-200 dark:hover:bg-neutral-700 transition-colors cursor-pointer", editor.isActive({ textAlign: 'left' }) ? 'bg-neutral-200 dark:bg-neutral-700 text-black dark:text-white' : 'text-neutral-500 dark:text-neutral-400')}
                title="Align Left (Ctrl+Shift+L)"
            >
                <img src={alignLeftIcon} className="w-[18px] h-[18px] transition-all" style={{ filter: editor.isActive({ textAlign: 'left' }) ? 'brightness(0) invert(1)' : 'brightness(0) invert(1) opacity(0.4)' }} />
            </button>
            <button
                onClick={() => editor.chain().focus().setTextAlign('center').run()}
                className={cn("p-2 rounded hover:bg-neutral-200 dark:hover:bg-neutral-700 transition-colors cursor-pointer", editor.isActive({ textAlign: 'center' }) ? 'bg-neutral-200 dark:bg-neutral-700 text-black dark:text-white' : 'text-neutral-500 dark:text-neutral-400')}
                title="Align Center (Ctrl+Shift+E)"
            >
                <img src={alignCenterIcon} className="w-[18px] h-[18px] transition-all" style={{ filter: editor.isActive({ textAlign: 'center' }) ? 'brightness(0) invert(1)' : 'brightness(0) invert(1) opacity(0.4)' }} />
            </button>
            <button
                onClick={() => editor.chain().focus().setTextAlign('right').run()}
                className={cn("p-2 rounded hover:bg-neutral-200 dark:hover:bg-neutral-700 transition-colors cursor-pointer", editor.isActive({ textAlign: 'right' }) ? 'bg-neutral-200 dark:bg-neutral-700 text-black dark:text-white' : 'text-neutral-500 dark:text-neutral-400')}
                title="Align Right (Ctrl+Shift+R)"
            >
                <img src={alignRightIcon} className="w-[18px] h-[18px] transition-all" style={{ filter: editor.isActive({ textAlign: 'right' }) ? 'brightness(0) invert(1)' : 'brightness(0) invert(1) opacity(0.4)' }} />
            </button>

            <div className="w-px h-6 bg-neutral-300 dark:bg-neutral-700 mx-1"></div>

            <button
                onClick={() => {
                    const next = { compact: 'normal', normal: 'relaxed', relaxed: 'compact' };
                    setSpacing(next[spacing]);
                }}
                className="p-2 rounded hover:bg-neutral-200 dark:hover:bg-neutral-700 transition-colors text-neutral-500 dark:text-neutral-400 cursor-pointer"
                title={`Line Spacing: ${spacing.charAt(0).toUpperCase() + spacing.slice(1)}`}
            >
                <img src={moveVerticalIcon} className="w-[18px] h-[18px] transition-all group-hover:opacity-100" style={{ filter: 'brightness(0) invert(1) opacity(0.4)' }} />
                <span className="sr-only">Spacing</span>
            </button>

            {navActions && (
                <div className="flex items-center gap-1 border-l border-neutral-300 dark:border-neutral-700 pl-2 ml-1">
                    <button
                        onClick={navActions.backToGoals}
                        className="px-2.5 py-1.5 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 rounded-md text-[10px] font-bold uppercase tracking-widest transition-all cursor-pointer border border-emerald-500/20"
                    >
                        Goals
                    </button>
                    {navActions.roadmapId && (
                        <button
                            onClick={navActions.goToRoadmap}
                            className="px-2.5 py-1.5 bg-blue-500/10 hover:bg-blue-500/20 text-blue-600 dark:text-blue-400 rounded-md text-[10px] font-bold uppercase tracking-widest transition-all cursor-pointer border border-blue-500/20"
                        >
                            Map
                        </button>
                    )}
                    {navActions.skillId && (
                        <button
                            onClick={navActions.goToSkills}
                            className="px-2.5 py-1.5 bg-amber-500/10 hover:bg-amber-500/20 text-amber-600 dark:text-amber-400 rounded-md text-[10px] font-bold uppercase tracking-widest transition-all cursor-pointer border border-amber-500/20"
                        >
                            Skills
                        </button>
                    )}
                </div>
            )}
        </div>
    );
};

const DailyJournal = () => {
    const location = useLocation();
    const navigate = useNavigate();
    const [entries, setEntries] = useState([]);
    const [activeEntry, setActiveEntry] = useState(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [isSidebarOpen, setIsSidebarOpen] = useState(true);
    const [isLargeScreen, setIsLargeScreen] = useState(() => typeof window !== 'undefined' && window.innerWidth >= 1200);
    const [sortBy, setSortBy] = useState('newest'); // 'newest' | 'oldest' | 'wordCount'
    const [showTJournalOnly, setShowTJournalOnly] = useState(false);
    const [showGoalsOnly, setShowGoalsOnly] = useState(false);
    const [goalJournalIds, setGoalJournalIds] = useState(new Set());

    useEffect(() => {
        const handleResize = () => {
            const large = window.innerWidth >= 1200;
            setIsLargeScreen(large);
            if (large) {
                setIsSidebarOpen(true);
            }
        };
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    // Load entries on mount
    useEffect(() => {
        loadEntries();
        loadGoalJournalIds();
    }, []);

    const loadGoalJournalIds = async () => {
        try {
            const goalsDir = 'C:\\Users\\PC\\Desktop\\database\\Goals';
            if (!fs.existsSync(goalsDir)) return;
            const files = await fsPromises.readdir(goalsDir);
            const ids = new Set();
            for (const file of files.filter(f => f.endsWith('.json'))) {
                try {
                    const content = await fsPromises.readFile(path.join(goalsDir, file), 'utf-8');
                    const goal = JSON.parse(content);
                    if (goal.journalId) ids.add(goal.journalId);
                } catch (e) { }
            }
            setGoalJournalIds(ids);
        } catch (e) { }
    };

    useEffect(() => {
        // If we have goal context but it doesn't match the current entry, clear it
        if (location.state?.fromGoal && activeEntry && activeEntry.title !== location.state?.targetTitle) {
            navigate('/DailyJournal', { replace: true, state: {} });
        }
    }, [activeEntry, location.state, navigate]);

    const loadEntries = async () => {
        try {
            if (!fs.existsSync(DB_PATH)) {
                await fsPromises.mkdir(DB_PATH, { recursive: true });
                setEntries([]);
                return;
            }

            const files = await fsPromises.readdir(DB_PATH);
            const jsonFiles = files.filter(file => file.endsWith('.json'));

            const loadedEntries = await Promise.all(jsonFiles.map(async (file) => {
                const content = await fsPromises.readFile(path.join(DB_PATH, file), 'utf-8');
                try {
                    return JSON.parse(content);
                } catch (e) {
                    console.error(`Error parsing ${file}`, e);
                    return null;
                }
            }));

            const validEntries = loadedEntries.filter(e => e !== null);
            // Sort by last edited (updatedAt) descending
            validEntries.sort((a, b) => new Date(b.updatedAt || b.createdAt) - new Date(a.updatedAt || a.createdAt));

            setEntries(validEntries);

            // Check if we were navigated here with a target title
            const stateTitle = location.state?.targetTitle;
            if (stateTitle) {
                const matchingEntry = validEntries.find(e => e.title === stateTitle);
                if (matchingEntry) {
                    setActiveEntry(matchingEntry);
                    if (!isLargeScreen && isSidebarOpen) setIsSidebarOpen(false);
                } else if (validEntries.length > 0 && !activeEntry) {
                    setActiveEntry(validEntries[0]);
                }
            } else if (validEntries.length > 0 && !activeEntry) {
                setActiveEntry(validEntries[0]);
            }
        } catch (err) {
            console.error("Failed to load entries", err);
        }
    };

    const createNewEntry = async () => {
        const id = crypto.randomUUID();
        const newEntry = {
            id,
            title: 'New Entry',
            content: '',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
        };

        await saveEntryToDisk(newEntry);
        setEntries([newEntry, ...entries]);
        setActiveEntry(newEntry);
        // Ensure sidebar is open when creating new entry so user sees it
        if (!isSidebarOpen) setIsSidebarOpen(true);
    };

    const deleteEntry = async (e, id) => {
        e.stopPropagation();

        try {
            await fsPromises.unlink(path.join(DB_PATH, `${id}.json`));
            const newEntries = entries.filter(entry => entry.id !== id);
            setEntries(newEntries);
            if (activeEntry?.id === id) {
                setActiveEntry(newEntries.length > 0 ? newEntries[0] : null);
            }
        } catch (err) {
            console.error("Failed to delete entry", err);
        }
    };

    const saveEntryToDisk = async (entry) => {
        try {
            await fsPromises.writeFile(path.join(DB_PATH, `${entry.id}.json`), JSON.stringify(entry, null, 2));
        } catch (err) {
            console.error("Failed to save entry", err);
        }
    };

    const updateEntry = useCallback(async (updates) => {
        if (!activeEntry) return;

        // Auto-retract sidebar on typing/update only on smaller screens
        if (!isLargeScreen && isSidebarOpen) setIsSidebarOpen(false);

        const updatedEntry = { ...activeEntry, ...updates, updatedAt: new Date().toISOString() };

        // Update local state
        setActiveEntry(updatedEntry);
        setEntries(prev => prev.map(e => e.id === updatedEntry.id ? updatedEntry : e));

        // Save to disk
        await saveEntryToDisk(updatedEntry);
    }, [activeEntry, isLargeScreen, isSidebarOpen]);

    const filteredEntries = useMemo(() => {
        return entries
            .filter(entry => {
                const matchesSearch = entry.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
                    new Date(entry.createdAt).toLocaleDateString().includes(searchQuery);

                if (showTJournalOnly) {
                    // Match date format created by TimeTracker: "February 11, 2026"
                    const datePattern = /^[A-Z][a-z]+ \d{1,2}, \d{4}$/;
                    return matchesSearch && datePattern.test(entry.title);
                }
                if (showGoalsOnly) {
                    return matchesSearch && goalJournalIds.has(entry.id);
                }
                return matchesSearch;
            })
            .sort((a, b) => {
                if (sortBy === 'newest') return new Date(b.updatedAt || b.createdAt) - new Date(a.updatedAt || a.createdAt);
                if (sortBy === 'oldest') return new Date(a.updatedAt || a.createdAt) - new Date(b.updatedAt || b.createdAt);
                if (sortBy === 'wordCount') {
                    const countA = countWords(a.content);
                    const countB = countWords(b.content);
                    return countB - countA;
                }
                return 0;
            });
    }, [entries, searchQuery, sortBy, showTJournalOnly, showGoalsOnly, goalJournalIds]);

    return (
        <div className="flex h-screen bg-neutral-100 dark:bg-black text-neutral-900 dark:text-neutral-100 overflow-hidden font-sans relative pl-12">
            {/* Navbar */}
            <Navbar />

            {/* Sidebar Toggle Button (when sidebar is closed on smaller screens) */}
            {!isLargeScreen && !isSidebarOpen && (
                <button
                    onClick={() => setIsSidebarOpen(true)}
                    className="absolute top-4 left-12 z-20 p-2 bg-white dark:bg-neutral-800 rounded-full shadow-md text-neutral-500 hover:text-blue-600 dark:text-neutral-400 transition-all border border-neutral-200 dark:border-neutral-700 hover:scale-105 cursor-pointer flex items-center justify-center"
                    title="Open Sidebar"
                >
                    <img src={panelLeftOpenIcon} className="w-5 h-5 dark:invert opacity-70" />
                </button>
            )}

            {/* Sidebar */}
            <aside
                className={cn(
                    "bg-white/95 dark:bg-neutral-950/95 backdrop-blur-md border-r border-neutral-200 dark:border-neutral-800 flex flex-col shrink-0 transition-all duration-300 ease-in-out h-full z-30",
                    isLargeScreen
                        ? "relative w-64 md:w-72 translate-x-0 opacity-100 shadow-none pointer-events-auto"
                        : (isSidebarOpen ? "absolute w-60 md:w-72 translate-x-0 opacity-100 shadow-2xl" : "absolute w-0 -translate-x-full opacity-0 pointer-events-none")
                )}
            >
                <div className="p-3 border-b border-neutral-200 dark:border-neutral-800 flex items-center justify-between overflow-hidden">
                    <h2 className="text-base font-bold flex items-center gap-2 overflow-hidden">
                        <span className="text-blue-600 dark:text-blue-400 shrink-0"><img src={fileTextIcon} className="w-[18px] h-[18px] brightness-0 invert sepia(1) saturate(5) hue-rotate(190deg)" style={{ filter: 'invert(32%) sepia(97%) saturate(1836%) hue-rotate(200deg) brightness(97%) contrast(101%)' }} /></span>
                        <span className="whitespace-nowrap truncate">Journal</span>
                    </h2>
                    <div className="flex items-center gap-1">
                        <button
                            onClick={createNewEntry}
                            className="p-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-full transition-all shadow-sm shrink-0 cursor-pointer flex items-center justify-center"
                            title="New Entry"
                        >
                            <img src={plusIcon} className="w-4 h-4 brightness-0 invert" />
                        </button>
                        {!isLargeScreen && (
                            <button
                                onClick={() => setIsSidebarOpen(false)}
                                className="p-1.5 hover:bg-neutral-100 dark:hover:bg-neutral-800 text-neutral-500 rounded-full transition-all shrink-0 cursor-pointer flex items-center justify-center"
                                title="Close Sidebar"
                            >
                                <img src={panelLeftCloseIcon} className="w-4 h-4 opacity-50 dark:invert" />
                            </button>
                        )}
                    </div>
                </div>

                <div className="p-4 border-b border-neutral-200 dark:border-neutral-800 space-y-3">
                    <div className="relative">
                        <img src={searchIcon} className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 opacity-40 dark:invert" />
                        <input
                            type="text"
                            placeholder="Search entries..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full pl-9 pr-4 py-2 bg-neutral-100 dark:bg-neutral-800 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500 transition-all text-neutral-900 dark:text-white"
                        />
                    </div>

                    <div className="flex items-center justify-between gap-2 overflow-hidden px-1">
                        <div className="flex items-center gap-2">
                            <input
                                type="checkbox"
                                id="tjournal"
                                checked={showTJournalOnly}
                                onChange={(e) => { setShowTJournalOnly(e.target.checked); if (e.target.checked) setShowGoalsOnly(false); }}
                                className="w-3.5 h-3.5 rounded border-neutral-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                            />
                            <label htmlFor="tjournal" className="text-[10px] font-bold uppercase tracking-wider text-neutral-500 cursor-pointer hover:text-neutral-900 dark:hover:text-neutral-100 whitespace-nowrap">
                                TJournal
                            </label>
                        </div>
                        <div className="flex items-center gap-2">
                            <input
                                type="checkbox"
                                id="goalsonly"
                                checked={showGoalsOnly}
                                onChange={(e) => { setShowGoalsOnly(e.target.checked); if (e.target.checked) setShowTJournalOnly(false); }}
                                className="w-3.5 h-3.5 rounded border-neutral-300 text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                            />
                            <label htmlFor="goalsonly" className="text-[10px] font-bold uppercase tracking-wider text-neutral-500 cursor-pointer hover:text-neutral-900 dark:hover:text-neutral-100 whitespace-nowrap">
                                Goals
                            </label>
                        </div>

                        <select
                            value={sortBy}
                            onChange={(e) => setSortBy(e.target.value)}
                            className="bg-neutral-100 dark:bg-neutral-800 px-2 py-1 rounded text-[10px] font-bold uppercase tracking-wider text-neutral-600 dark:text-neutral-400 outline-none cursor-pointer hover:text-neutral-900 dark:hover:text-neutral-100 border-none"
                        >
                            <option value="newest">Newest</option>
                            <option value="oldest">Oldest</option>
                            <option value="wordCount">Words</option>
                        </select>
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto p-2 space-y-1 w-full">
                    {filteredEntries.length === 0 ? (
                        <div className="text-center p-8 text-neutral-400 text-sm">No entries found</div>
                    ) : (
                        filteredEntries.map(entry => (
                            <div
                                key={entry.id}
                                onClick={() => {
                                    setActiveEntry(entry);
                                    if (!isLargeScreen) setIsSidebarOpen(false);
                                    navigate('/DailyJournal', { replace: true, state: {} });
                                }}
                                className={cn(
                                    "group p-3 rounded-lg cursor-pointer transition-all border relative",
                                    activeEntry?.id === entry.id
                                        ? "bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800 shadow-sm"
                                        : "bg-transparent border-transparent hover:bg-neutral-100 dark:hover:bg-neutral-800"
                                )}
                            >
                                <div className="pr-6">
                                    <h3 className={cn("font-medium truncate text-sm mb-1", activeEntry?.id === entry.id ? "text-blue-700 dark:text-blue-400" : "text-neutral-700 dark:text-neutral-300")}>
                                        {entry.title || "Untitled"}
                                    </h3>
                                    <div className="flex items-center justify-between text-xs text-neutral-400">
                                        <div className="flex items-center gap-2">
                                            <img src={calendarIcon} className="w-3 h-3 opacity-60" style={{ filter: 'brightness(0) invert(1)' }} />
                                            <span>{new Date(entry.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}</span>
                                        </div>
                                        {sortBy === 'wordCount' && (
                                            <span className="bg-neutral-200 dark:bg-neutral-800 px-1.5 py-0.5 rounded text-[10px] font-medium">
                                                {countWords(entry.content)} w
                                            </span>
                                        )}
                                    </div>
                                </div>
                                <button
                                    onClick={(e) => deleteEntry(e, entry.id)}
                                    className="absolute top-2 right-2 p-1.5 rounded-full text-neutral-400 hover:text-white hover:bg-white/10 opacity-0 group-hover:opacity-100 transition-all cursor-pointer flex items-center justify-center"
                                >
                                    <img src={trashIcon} className="w-3.5 h-3.5 opacity-70 hover:opacity-100" style={{ filter: 'brightness(0) invert(1)' }} />
                                </button>
                            </div>
                        ))
                    )}
                </div>
            </aside>

            {/* Main Area */}
            <main className="flex-1 flex flex-col h-full bg-white dark:bg-black relative transition-all duration-300 ease-in-out min-w-0">
                {activeEntry ? (
                    <EditorArea
                        key={activeEntry.id}
                        entry={activeEntry}
                        onUpdate={updateEntry}
                        isSidebarOpen={isSidebarOpen}
                        setIsSidebarOpen={setIsSidebarOpen}
                        isLargeScreen={isLargeScreen}
                        navActions={location.state?.fromGoal && activeEntry.title === location.state?.targetTitle ? {
                            backToGoals: () => navigate('/Growth/goals'),
                            goalId: location.state?.goalId,
                            roadmapId: location.state?.roadmapId,
                            skillId: location.state?.skillId,
                            goToRoadmap: () => navigate('/Growth/roadmap', {
                                state: {
                                    roadmapId: location.state.roadmapId,
                                    fromGoal: true,
                                    journalId: activeEntry.id, // active journal
                                    goalName: location.state.targetTitle,
                                    goalId: location.state.goalId,
                                    skillId: location.state.skillId
                                }
                            }),
                            goToSkills: () => navigate('/Growth/skills', {
                                state: {
                                    skillId: location.state.skillId,
                                    fromGoal: true,
                                    goalName: location.state.targetTitle,
                                    goalId: location.state.goalId,
                                    roadmapId: location.state.roadmapId,
                                    journalId: activeEntry.id
                                }
                            })
                        } : null}
                    />
                ) : (
                    <div className="flex-1 flex flex-col items-center justify-center text-neutral-400">
                        <img src={fileTextIcon} className="w-12 h-12 mb-4 opacity-20 dark:invert" />
                        <p>Select an entry to start writing</p>
                    </div>
                )}
            </main>
        </div>
    );
};

const EditorArea = ({ entry, onUpdate, isSidebarOpen, setIsSidebarOpen, isLargeScreen, navActions }) => {
    const [title, setTitle] = useState(entry.title);
    const [spacing, setSpacing] = useState('compact'); // compact | normal | relaxed

    const spacingStyles = {
        compact: { pMargin: '0.15em', lineHeight: '1.25' },
        normal: { pMargin: '0.5em', lineHeight: '1.6' },
        relaxed: { pMargin: '1.0em', lineHeight: '1.8' }
    };

    const currentStyle = spacingStyles[spacing];

    const lowlight = useMemo(() => createLowlight(common), []);

    const [, setSelectionUpdate] = useState(0);

    const editor = useEditor({
        extensions: [
            StarterKit.configure({
                codeBlock: false,
            }),
            CodeBlockLowlight.configure({
                lowlight,
            }),
            Underline,
            Typography,
            TextAlign.configure({
                types: ['heading', 'paragraph'],
            }),
            Placeholder.configure({
                placeholder: 'Write quickly, freely, and without judgment...',
            }),
        ],
        content: entry.content,
        onUpdate: ({ editor }) => {
            onUpdate({ content: editor.getHTML() });
        },
        onSelectionUpdate: () => {
            // Force a re-render to update the MenuBar highlights
            setSelectionUpdate(s => s + 1);
        },
        onFocus: () => {
            if (!isLargeScreen && isSidebarOpen) setIsSidebarOpen(false);
        },
        editorProps: {
            attributes: {
                class: 'prose prose-lg dark:prose-invert max-w-none focus:outline-none min-h-[500px] py-2 first:mt-0 prose-p:my-0 prose-headings:my-1 prose-ul:my-0 prose-ol:my-0 prose-li:my-0 break-words text-left ltr',
                dir: 'ltr'
            },
            handleTextInput(view, from, to, text) {
                const { state, dispatch } = view;
                const { selection } = state;
                const $pos = selection.$from;
                const textBefore = $pos.parent.textContent.slice(0, $pos.parentOffset);

                // Autocorrect isolated 'i' to 'I' when followed by a space
                if (text === ' ') {
                    if (/(^|\s)i$/.test(textBefore)) {
                        const tr = state.tr
                            .delete(from - 1, to)
                            .insertText('I ', from - 1);
                        dispatch(tr);
                        return true;
                    }
                }

                // Only handle single character inputs that are lowercase letters
                if (text.length !== 1 || !/[a-z]/.test(text)) {
                    return false;
                }

                // 1. Check if we are at the very beginning of a block (like a new paragraph)
                const isStartOfBlock = $pos.parentOffset === 0;

                // 2. Check if we follow a sentence ender (. ! ?) and at least one space
                let isAfterSentenceEnd = false;
                if (!isStartOfBlock) {
                    // Match a sentence ender followed by spaces
                    if (/[.!?]\s+$/.test(textBefore)) {
                        isAfterSentenceEnd = true;
                    }
                }

                if (isStartOfBlock || isAfterSentenceEnd) {
                    const tr = state.tr.insertText(text.toUpperCase(), from, to);
                    dispatch(tr);
                    return true;
                }

                return false;
            }
        },
    });

    const handleTitleChange = (e) => {
        const newTitle = e.target.value;
        setTitle(newTitle);
        onUpdate({ title: newTitle });
    };

    return (
        <div className="flex flex-col h-full" style={{
            '--p-margin': currentStyle.pMargin,
            '--line-height': currentStyle.lineHeight
        }}>
            <MenuBar editor={editor} spacing={spacing} setSpacing={setSpacing} navActions={navActions} />

            {/* Custom Styles for editor content */}
            <style>{`
                .journal-editor-content .ProseMirror {
                    padding: 0;
                    min-height: 500px;
                    outline: none;
                }
                .journal-editor-content {
                    word-break: normal !important;
                    overflow-wrap: break-word !important;
                    hyphens: none !important;
                }
                /* Headings 25% smaller */
                .journal-editor-content .ProseMirror h1 { font-size: 2em !important; line-height: 1.2 !important; }
                .journal-editor-content .ProseMirror h2 { font-size: 1.5em !important; line-height: 1.3 !important; }
                .journal-editor-content .ProseMirror h3 { font-size: 1.125em !important; line-height: 1.4 !important; }
                
                /* Standard Paragraph Spacing */
                .journal-editor-content .ProseMirror p {
                    margin-bottom: var(--p-margin) !important;
                    line-height: var(--line-height) !important;
                }
                
                /* Vertical Spacing: Text & Lists */
                .journal-editor-content .ProseMirror ul, 
                .journal-editor-content .ProseMirror ol {
                    padding-left: 0 !important;
                    margin-left: 0 !important;
                    list-style: none !important;
                    margin-top: 0 !important;
                    margin-bottom: var(--p-margin) !important;
                }
                
                /* Ensure paragraphs immediately before lists don't push them away */
                .journal-editor-content .ProseMirror p + ul, 
                .journal-editor-content .ProseMirror p + ol {
                    margin-top: calc(var(--p-margin) * -0.5) !important;
                }
                
                /* List Item Horizontal Spacing (Tight) */
                .journal-editor-content .ProseMirror li {
                    display: flex !important;
                    align-items: baseline !important;
                    padding: 0 !important; /* Kill all padding */
                    gap: 0.4em !important;
                    margin-top: 0 !important; 
                    margin-bottom: -0.1em !important; /* Extremely tight vertical packing */
                    width: 100% !important;
                }
                .journal-editor-content .ProseMirror ul li, 
                .journal-editor-content .ProseMirror ol li {
                     margin-left: 1em !important; /* Tiny indent */
                }
                .journal-editor-content .ProseMirror li::before {
                    content: '•';
                    position: static !important;
                    width: auto !important;
                    color: #9ca3af;
                    font-weight: bold;
                    flex-shrink: 0 !important;
                }
                
                /* Kill margins for paragraphs inside lists to prevent double spacing */
                .journal-editor-content .ProseMirror li p,
                .journal-editor-content .ProseMirror li * {
                    margin: 0 !important;
                    padding: 0 !important;
                    line-height: 1.1 !important;
                    display: block !important;
                    flex-grow: 1 !important;
                    text-align: left !important;
                }

                /* Code Block Styling */
                .journal-editor-content .ProseMirror pre {
                    background: #1e1e1e;
                    color: #d4d4d4;
                    font-family: 'JetBrains Mono', 'Fira Code', 'Courier New', monospace;
                    padding: 0.75rem 1rem;
                    border-radius: 0.5rem;
                    margin: 0.5rem 0 !important;
                }

                .journal-editor-content .ProseMirror pre code {
                    color: inherit;
                    padding: 0;
                    background: none;
                    font-size: 0.8rem;
                }

                /* VS Code Syntax Highlighting */
                .hljs-comment, .hljs-quote { color: #6a9955; font-style: italic; }
                .hljs-keyword, .hljs-selector-tag, .hljs-literal, .hljs-section { color: #569cd6; }
                .hljs-string, .hljs-doctag, .hljs-type { color: #ce9178; }
                .hljs-number, .hljs-deletion, .hljs-attr { color: #b5cea8; }
                .hljs-function, .hljs-title { color: #dcdcaa; }
                .hljs-variable, .hljs-template-variable, .hljs-tag, .hljs-name, .hljs-selector-id, .hljs-selector-class, .hljs-regexp { color: #9cdcfe; }
                .hljs-symbol, .hljs-bullet, .hljs-link, .hljs-meta, .hljs-selector-attr, .hljs-selector-pseudo { color: #c586c0; }
                .hljs-built_in, .hljs-class { color: #4ec9b0; }
                .hljs-params { color: #9cdcfe; }
                .hljs-addition { color: #b5cea8; }
                .hljs-emphasis { font-style: italic; }
                .hljs-strong { font-weight: bold; }

                .journal-editor-content .ProseMirror code {
                    background-color: rgba(110, 118, 129, 0.4);
                    padding: 0.2em 0.4em;
                    border-radius: 6px;
                    font-size: 85%;
                    font-family: ui-monospace, SFMono-Regular, SF Mono, Menlo, Consolas, Liberation Mono, monospace;
                }
            `}</style>

            <div className="flex-1 overflow-y-auto">
                <div className={cn(
                    "py-8 transition-all duration-200",
                    isLargeScreen
                        ? "w-full max-w-none mx-0 pl-5 pr-4"
                        : "max-w-4xl mx-auto px-4 md:px-8"
                )}>
                    <input
                        type="text"
                        value={title}
                        onChange={handleTitleChange}
                        onFocus={() => { if (!isLargeScreen && isSidebarOpen) setIsSidebarOpen(false); }}
                        placeholder="Title"
                        className="w-full text-4xl font-bold bg-transparent border-none outline-none text-neutral-900 dark:text-neutral-100 placeholder-neutral-300 dark:placeholder-neutral-700 mb-2"
                    />
                    <div className="text-xs text-neutral-400 mb-2 flex items-center gap-2">
                        {new Date(entry.createdAt).toLocaleString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                    </div>

                    <div className="journal-editor-content">
                        <EditorContent editor={editor} className="min-h-[60vh] pb-20 prose prose-lg dark:prose-invert max-w-none" />
                    </div>
                </div>
            </div>
        </div>
    );
};

export default DailyJournal;
