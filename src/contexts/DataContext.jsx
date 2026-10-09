import React, { createContext, useContext, useState, useEffect } from 'react';

// --- ELECTRON / NODE.JS IMPORTS ---
const fs = window.require('fs').promises;
const path = window.require('path');

// --- CONSTANTS & PATHS ---
const BASE_DB = 'C:\\Users\\PC\\Desktop\\database';
const PATHS = {
    FINANCE: path.join(BASE_DB, 'Finances', 'data.json'),
    FINANCE_CATEGORIES: path.join(BASE_DB, 'Finances', 'categories.json'),
    PLANNER: path.join(BASE_DB, 'DayPlanner', 'events.json'),
    READING_DIR: path.join(BASE_DB, 'Books', 'Reading'),
    READING_PROGRESS_DIR: path.join(BASE_DB, 'Books', 'Progress'),
    READING_NOTES_DIR: path.join(BASE_DB, 'Books', 'notes'),
    READING_LOGS_FILE: path.join(BASE_DB, 'Books', 'reading_logs.json'),
    BOOK_CACHE_DIR: path.join(BASE_DB, 'Books', 'BookCache'),
    ARTICLE_CACHE_DIR: path.join(BASE_DB, 'Articles', 'ArticleCache'),
    TIME_SESSIONS: path.join(BASE_DB, 'TimeTracker', 'sessions.json'),
    SKILLS_DIR: path.join(BASE_DB, 'Skills'),
    LEXICON_DIR: path.join(BASE_DB, 'Words'),
    GOALS_DIR: path.join(BASE_DB, 'Goals'),
    TODOS: path.join(BASE_DB, 'Todos', 'tasks.json'),
};

const DataContext = createContext();

export const useData = () => useContext(DataContext);

export const DataProvider = ({ children }) => {
    const [data, setData] = useState({
        finance: { balance: 0, income: 0, expenses: 0 },
        planner: { currentTask: null, nextTask: null, tasksToday: 0 },
        reading: { currentBook: null, progress: 0, cover: null, totalBooks: 0 },
        articles: { shelves: { Reading: [], WanttoRead: [], Read: [] }, categories: [], totalArticles: 0 },
        time: { todayLogged: 0, activeSession: false },
        skills: { phases: [] },
        lexicon: { recentWords: [] },
        goals: { activeGoals: 0, topGoals: [] },
        todos: { topTasks: [] },
        rewards: { isBalancedActive: false },
    });
    const [loading, setLoading] = useState(true);

    const fetchAllData = async () => {
        const processInChunks = async (items, fn, chunkSize = 50) => {
            let results = [];
            for (let i = 0; i < items.length; i += chunkSize) {
                const chunk = items.slice(i, i + chunkSize);
                const res = await Promise.all(chunk.map(fn));
                results = results.concat(res);
                await new Promise(r => setTimeout(r, 10)); // Yield to UI thread
            }
            return results;
        };

        try {
            // 1. FINANCE
            let financeData = { balance: 0, income: 0, expenses: 0, fullData: { transactions: [], budgets: [], savingsGoals: [], categories: [] } };
            try {
                const FINANCES_DIR = path.join(BASE_DB, 'Finances');
                const DATA_FILE = path.join(FINANCES_DIR, 'data.json');
                const CATEGORIES_FILE = path.join(FINANCES_DIR, 'categories.json');

                await fs.mkdir(FINANCES_DIR, { recursive: true });

                // Read transaction data
                try {
                    const raw = await fs.readFile(DATA_FILE, 'utf8');
                    const parsed = JSON.parse(raw);
                    financeData.fullData = { ...financeData.fullData, ...parsed };
                } catch (e) { }

                // Read category data separately
                try {
                    const rawCat = await fs.readFile(CATEGORIES_FILE, 'utf8');
                    financeData.fullData.categories = JSON.parse(rawCat);
                } catch (e) {
                    // Fallback to data.json categories if categories.json doesn't exist yet
                    if (financeData.fullData.categories.length === 0 && financeData.fullData.categories) {
                        // Already handled by the merge above if it existed in data.json
                    }
                }



                const isCurrentMonth = (dateStr) => {
                    const date = new Date(dateStr);
                    const now = new Date();
                    return date.getMonth() === now.getMonth() && date.getFullYear() === now.getFullYear();
                };

                const transactions = financeData.fullData.transactions || [];
                financeData.balance = transactions.reduce((acc, t) => acc + (t.type === 'income' ? t.amount : -t.amount), 0);

                financeData.income = transactions
                    .filter(t => t.type === 'income' && isCurrentMonth(t.date))
                    .reduce((acc, t) => acc + t.amount, 0);

                financeData.expenses = transactions
                    .filter(t => t.type === 'expense' && isCurrentMonth(t.date))
                    .reduce((acc, t) => acc + t.amount, 0);

            } catch (e) { }

            // 2. PLANNER
            let plannerData = { currentTask: null, nextTask: null, tasksToday: 0, allEvents: [] };
            try {
                const raw = await fs.readFile(PATHS.PLANNER, 'utf8');
                const events = JSON.parse(raw);
                plannerData.allEvents = events; // Store all events for DayPlanner

                const now = new Date();
                let currentDayIndex = now.getDay() === 0 ? 6 : now.getDay() - 1;
                let currentMinutes = now.getHours() * 60 + now.getMinutes();

                if (now.getHours() < 5) {
                    currentDayIndex = (currentDayIndex - 1 + 7) % 7;
                    currentMinutes += 1440;
                }

                const todayEvents = events.filter(e => e.dayIndex === currentDayIndex).sort((a, b) => a.startMinutes - b.startMinutes);
                plannerData.tasksToday = todayEvents.length;

                const current = todayEvents.find(e => currentMinutes >= e.startMinutes && currentMinutes < e.endMinutes);
                const next = todayEvents.find(e => e.startMinutes > currentMinutes);

                plannerData.currentTask = current || null;
                plannerData.nextTask = next || null;
            } catch (e) { }

            // 3. READING
            let readingData = { currentBook: null, progress: 0, cover: null, totalBooks: 0, shelves: { Reading: [], WanttoRead: [], Read: [] }, categories: [], readingLogs: [] };
            try {
                const baseBookPath = path.join(BASE_DB, 'Books');
                const shelfNames = ['Reading', 'WanttoRead', 'Read'];
                const bookCacheDir = PATHS.BOOK_CACHE_DIR;
                const allCategories = new Set();

                // Ensure BookCache directory exists
                try { await fs.mkdir(bookCacheDir, { recursive: true }); } catch (e) { }

                // Helper: load a single PDF book entry
                const loadBookEntry = async (file, dir, category, currentShelf) => {
                    const name = file.replace('.pdf', '');
                    const fullPath = path.join(dir, file);
                    let createdAt = new Date(0);
                    let lastUpdated = new Date(0);

                    try {
                        const stats = await fs.stat(fullPath);
                        const folderTime = Math.max(
                            stats.ctime ? stats.ctime.getTime() : 0,
                            stats.mtime ? stats.mtime.getTime() : 0
                        );
                        createdAt = new Date(folderTime);
                        lastUpdated = stats.mtime;
                    } catch (e) { }

                    // Check for cover
                    const extensions = ['.jpg', '.jpeg', '.png'];
                    let cover = null;
                    for (const ext of extensions) {
                        const potential = path.join(dir, name + ext);
                        try {
                            await fs.stat(potential);
                            cover = `file://${potential.replace(/\\/g, '/')}`;
                            break;
                        } catch (e) { }
                    }

                    // If no side-car cover, check cache
                    if (!cover) {
                        const cachePath = path.join(baseBookPath, 'ThumbnailCache', name + '.jpg');
                        try {
                            await fs.stat(cachePath);
                            cover = `file://${cachePath.replace(/\\/g, '/')}`;
                        } catch (e) { }
                    }

                    // Check progress
                    let progress = { current: 0, total: 0 };
                    try {
                        const progPath = path.join(PATHS.READING_PROGRESS_DIR, `${name}.json`);
                        const progStats = await fs.stat(progPath);
                        if (progStats.mtime > lastUpdated) lastUpdated = progStats.mtime;

                        const rawProg = await fs.readFile(progPath, 'utf8');
                        progress = JSON.parse(rawProg);
                    } catch (e) { }

                    // Check notes
                    try {
                        const notesPath = path.join(PATHS.READING_NOTES_DIR, `${name}.json`);
                        const notesStats = await fs.stat(notesPath);
                        if (notesStats.mtime > lastUpdated) lastUpdated = notesStats.mtime;
                    } catch (e) { }

                    // For WanttoRead/Read shelves, pull totalPages and addedToShelfAt from BookCache if available
                    let totalPages = progress.total || 0;
                    try {
                        const bookCachePath = path.join(bookCacheDir, `${name}.json`);
                        const rawCache = await fs.readFile(bookCachePath, 'utf8');
                        const cached = JSON.parse(rawCache);
                        if (cached.totalPages) totalPages = cached.totalPages;
                        if (currentShelf && cached.shelf === currentShelf) {
                            const cacheTimeStr = cached.addedToShelfAt || cached.createdAt;
                            if (cacheTimeStr) {
                                const cacheTime = new Date(cacheTimeStr);
                                if (!isNaN(cacheTime.getTime()) && cacheTime.getTime() > 0) {
                                    createdAt = cacheTime;
                                }
                            }
                        }
                    } catch (e) { }

                    return { name, fullPath, cover, progress, createdAt, lastUpdated, cachedOnly: false, totalPages, category };
                };

                for (const shelf of shelfNames) {
                    const shelfPath = path.join(baseBookPath, shelf);
                    try {
                        const entries = await fs.readdir(shelfPath, { withFileTypes: true });
                        const pdfs = entries.filter(e => !e.isDirectory() && e.name.toLowerCase().endsWith('.pdf'));
                        const subdirs = entries.filter(e => e.isDirectory() && !e.name.endsWith(' - Sessions'));

                        // Register categories from subdirectories
                        subdirs.forEach(d => allCategories.add(d.name));

                        // Load root-level books (category = null)
                        const rootBooks = await processInChunks(pdfs, e => loadBookEntry(e.name, shelfPath, null, shelf));

                        // Load books from each subcategory folder
                        let subBooks = [];
                        for (const dir of subdirs) {
                            const catPath = path.join(shelfPath, dir.name);
                            try {
                                const catFiles = await fs.readdir(catPath);
                                const catPdfs = catFiles.filter(f => f.toLowerCase().endsWith('.pdf'));
                                const catBooks = await processInChunks(catPdfs, f => loadBookEntry(f, catPath, dir.name, shelf));
                                subBooks = subBooks.concat(catBooks);
                            } catch (e) { }
                        }

                        const booksForShelf = [...rootBooks, ...subBooks];

                        // For WanttoRead and Read shelves, also load cached-only books
                        let mergedBooks = [...booksForShelf];
                        if (shelf === 'Read') {
                            try {
                                const cacheFiles = await fs.readdir(bookCacheDir);
                                const cacheJsons = cacheFiles.filter(f => f.endsWith('.json'));

                                for (const cacheFile of cacheJsons) {
                                    try {
                                        const raw = await fs.readFile(path.join(bookCacheDir, cacheFile), 'utf8');
                                        const cached = JSON.parse(raw);

                                        // Only include if this cache entry belongs to this shelf
                                        if (cached.shelf !== shelf) continue;

                                        // Skip if a real PDF already exists for this book on this shelf
                                        const alreadyExists = booksForShelf.some(b => b.name === cached.name);
                                        if (alreadyExists) continue;

                                        // Build a book entry from cache
                                        let cover = null;
                                        if (cached.thumbnailPath) {
                                            try {
                                                await fs.stat(cached.thumbnailPath);
                                                cover = `file://${cached.thumbnailPath.replace(/\\/g, '/')}`;
                                            } catch (e) { }
                                        }

                                        // Check progress
                                        let progress = { current: 0, total: cached.totalPages || 0 };
                                        try {
                                            const progPath = path.join(PATHS.READING_PROGRESS_DIR, `${cached.name}.json`);
                                            const rawProg = await fs.readFile(progPath, 'utf8');
                                            progress = JSON.parse(rawProg);
                                        } catch (e) { }

                                        mergedBooks.push({
                                            name: cached.name,
                                            fullPath: cached.originalPath || path.join(shelfPath, cached.name + '.pdf'),
                                            cover,
                                            progress,
                                            createdAt: new Date(cached.addedToShelfAt || cached.createdAt || cached.cachedAt || 0),
                                            lastUpdated: new Date(cached.lastUpdated || cached.cachedAt || 0),
                                            cachedOnly: true,
                                            totalPages: cached.totalPages || 0,
                                            category: cached.category || null,
                                        });
                                    } catch (e) { }
                                }
                            } catch (e) { }
                        }

                        readingData.shelves[shelf] = mergedBooks.sort((a, b) => {
                            const timeA = a.createdAt ? a.createdAt.getTime() : 0;
                            const timeB = b.createdAt ? b.createdAt.getTime() : 0;
                            if (timeB !== timeA) return timeB - timeA;
                            return a.name.localeCompare(b.name);
                        });
                    } catch (e) { }
                }

                readingData.categories = Array.from(allCategories).sort();

                try {
                    const rawLogs = await fs.readFile(PATHS.READING_LOGS_FILE, 'utf8');
                    readingData.readingLogs = JSON.parse(rawLogs);
                } catch (e) {
                    readingData.readingLogs = [];
                }

                // Dashboard Stats
                const readingBooks = readingData.shelves.Reading;
                readingData.totalBooks = Object.values(readingData.shelves).reduce((acc, shelf) => acc + shelf.length, 0);

                if (readingBooks.length > 0) {
                    const activeBook = [...readingBooks].sort((a, b) => {
                        const progressA = a.progress.total > 0 ? (a.progress.current / a.progress.total) : 0;
                        const progressB = b.progress.total > 0 ? (b.progress.current / b.progress.total) : 0;
                        if (progressA !== progressB) return progressB - progressA;
                        return b.lastUpdated - a.lastUpdated;
                    })[0];
                    readingData.currentBook = activeBook.name;
                    readingData.progress = activeBook.progress.total > 0 ? Math.round((activeBook.progress.current / activeBook.progress.total) * 100) : 0;

                    // The cover is already formatted with file:// and normalized paths in the shelf mapping
                    if (activeBook.cover) {
                        readingData.cover = activeBook.cover;
                    } else {
                        // Fallback for cases where shelf mapping somehow missed it (though it shouldn't)
                        const cachePath = path.join(baseBookPath, 'ThumbnailCache', activeBook.name + '.jpg');
                        try {
                            const buffer = await fs.readFile(cachePath);
                            readingData.cover = `data:image/jpeg;base64,${buffer.toString('base64')}`;
                        } catch (e) { }
                    }
                }
            } catch (e) { }

            // 4. TIME TRACKER
            let timeData = { todayLogged: 0, activeSession: false, allSessions: [], workTasks: [] };
            try {
                // Fetch TimeTracker Sessions
                const sessionsRaw = await fs.readFile(PATHS.TIME_SESSIONS, 'utf8');
                const sessions = JSON.parse(sessionsRaw);
                timeData.allSessions = sessions; // Store all sessions

                // Fetch TimeTracker Tasks (independent from DayPlanner)
                try {
                     const TRACKER_TASKS_PATH = path.join(BASE_DB, 'TimeTracker', 'tasks.json');
                     const data = await fs.readFile(TRACKER_TASKS_PATH, 'utf-8');
                     const parsed = data.trim() ? JSON.parse(data) : [];
                     timeData.workTasks = Array.isArray(parsed) ? parsed : [];
                } catch (e) {}

                const todayStr = new Date().getFullYear() + '-' + String(new Date().getMonth() + 1).padStart(2, '0') + '-' + String(new Date().getDate()).padStart(2, '0');
                const todaySessions = sessions.filter(s => s.date === todayStr);
                let totalToday = todaySessions.reduce((acc, s) => acc + (s.durationSeconds || 0), 0);

                const ongoing = sessions.find(s => s.stopTime === null);
                if (ongoing) {
                    timeData.activeSession = true;
                    timeData.activeTaskName = ongoing.taskName;
                    timeData.activeSessionStart = ongoing.startTime;

                    const start = new Date(ongoing.startTime);
                    const elapsed = Math.floor((Date.now() - start.getTime()) / 1000);

                    timeData.activeSessionElapsed = elapsed;

                    // If the ongoing session started today, it might already be partially counted if durationSeconds was set?
                    // Actually, ongoing sessions have durationSeconds = null or 0 usually.
                    // To be safe, if it started before today, add full elapsed. If today, add elapsed.
                    totalToday += elapsed;
                }
                timeData.todayLogged = totalToday;
            } catch (e) { }

            // 5. SKILLS
            let skillsData = { phases: [], allSkills: [] };
            try {
                const files = await fs.readdir(PATHS.SKILLS_DIR);
                const jsonFiles = files.filter(f => f.endsWith('.json'));

                let allPhases = [];
                const allSkills = [];

                for (const f of jsonFiles) {
                    const fullPath = path.join(PATHS.SKILLS_DIR, f);
                    const raw = await fs.readFile(fullPath, 'utf8');
                    const skill = JSON.parse(raw);
                    
                    try {
                        const stats = await fs.stat(fullPath);
                        skill.createdAt = skill.createdAt || stats.birthtimeMs || stats.mtimeMs || 0;
                    } catch (e) {
                        skill.createdAt = skill.createdAt || 0;
                    }

                    allSkills.push(skill);

                    if (skill.phases) {
                        skill.phases.forEach(phase => {
                            // Calculate progress for items in phase
                            let progress = 0;
                            if (phase.items && phase.items.length > 0) {
                                const total = phase.items.reduce((acc, item) => {
                                    if (item.type === 'book' && item.data) {
                                        return acc + (item.data.currentPage / item.data.pages || 0);
                                    }
                                    return acc;
                                }, 0);
                                progress = Math.round((total / phase.items.length) * 100);
                            }
                            allPhases.push({
                                name: phase.name,
                                progress: progress
                            });
                        });
                    }
                }
                skillsData.allSkills = allSkills; // Store all skills
                // Take the most relevant phases (e.g. those with some progress or just the first few)
                skillsData.phases = allPhases.filter(p => p.progress > 0).concat(allPhases.filter(p => p.progress === 0)).slice(0, 4);
            } catch (e) { }

            // 6. LEXICON
            let lexiconData = { recentWords: [], allWords: [] };
            try {
                const files = await fs.readdir(PATHS.LEXICON_DIR);
                const jsonFiles = files.filter(f => f.endsWith('.json'));

                // Sort by ID descending (filename is ID)
                jsonFiles.sort((a, b) => {
                    const idA = parseInt(a.replace('.json', ''));
                    const idB = parseInt(b.replace('.json', ''));
                    return idB - idA;
                });

                const words = [];
                for (const f of jsonFiles) {
                    const raw = await fs.readFile(path.join(PATHS.LEXICON_DIR, f), 'utf8');
                    words.push(JSON.parse(raw));
                }
                lexiconData.allWords = words; // Store all words
                lexiconData.recentWords = words.slice(0, 4);
            } catch (e) { }


            // 7. GOALS
            let goalsData = { activeGoals: 0, topGoals: [], allGoals: [] };
            try {
                const files = await fs.readdir(PATHS.GOALS_DIR);
                const jsonFiles = files.filter(f => f.endsWith('.json') && f !== 'goals.json'); // Skip the legacy file if it exists

                const today = new Date();
                today.setHours(0, 0, 0, 0);

                const loadedGoals = [];
                for (const f of jsonFiles) {
                    try {
                        const raw = await fs.readFile(path.join(PATHS.GOALS_DIR, f), 'utf8');
                        const goal = JSON.parse(raw);

                        // Normalize
                        const normalized = {
                            ...goal,
                            id: goal.id || parseInt(f.replace('.json', ''), 10),
                            startDate: goal.startDate || new Date().toISOString().split('T')[0],
                            progress: goal.progress || 0,
                            currentValue: goal.currentValue || 0,
                            targetValue: goal.targetValue || 0,
                            progressionType: goal.progressionType || 'percentage',
                            status: goal.status || 'ongoing'
                        };
                        loadedGoals.push(normalized);

                    } catch (e) { }
                }

                goalsData.allGoals = loadedGoals.sort((a, b) => b.id - a.id); // Store all goals

                // Dashboard Stats
                const activeGoalsList = loadedGoals.filter(goal => {
                    const startDate = new Date(goal.startDate || goal.createdAt);
                    startDate.setHours(0, 0, 0, 0);
                    return goal.status === 'ongoing' && startDate <= today;
                });

                goalsData.activeGoals = activeGoalsList.length;
                if (activeGoalsList.length > 0) {
                    goalsData.topGoals = activeGoalsList
                        .sort((a, b) => (b.importance || 0) - (a.importance || 0))
                        .slice(0, 3);
                }
            } catch (e) { }

            // 8. TODOS
            let todosData = { topTasks: [], allTasks: [] };
            try {
                const raw = await fs.readFile(PATHS.TODOS, 'utf8');
                const tasks = JSON.parse(raw);
                todosData.allTasks = tasks; // Store all tasks

                const pending = tasks.filter(t => !t.completed);

                // Priority map
                const pMap = { high: 3, medium: 2, low: 1 };

                // Sort by Priority desc, then Due Date asc
                pending.sort((a, b) => {
                    const pA = pMap[a.priority] || 0;
                    const pB = pMap[b.priority] || 0;
                    if (pA !== pB) return pB - pA;
                    return a.id - b.id;
                });

                todosData.topTasks = pending.slice(0, 5);
            } catch (e) { }

            // 9. REWARDS
            let rewardsData = { isBalancedActive: false };
            try {
                const REWARDS_FILE = path.join(BASE_DB, 'Rewards', 'rewards.json');
                const raw = await fs.readFile(REWARDS_FILE, 'utf8');
                const parsed = JSON.parse(raw);
                if (parsed.globalState && parsed.globalState.status === 'active') {
                    rewardsData.isBalancedActive = true;
                }
            } catch (e) { }


            // 10. ARTICLES
            let articlesData = { shelves: { Reading: [], WanttoRead: [], Read: [] }, categories: [], totalArticles: 0 };
            try {
                const baseArticlePath = path.join(BASE_DB, 'Articles');
                const articleShelfNames = ['Reading', 'WanttoRead', 'Read'];
                const articleCategories = new Set();

                const loadArticleEntry = async (file, dir, category, currentShelf) => {
                    const name = file.replace(/\.pdf$/i, '');
                    const fullPath = path.join(dir, file);
                    let createdAt = new Date(0);
                    let lastUpdated = new Date(0);
                    try {
                        const stats = await fs.stat(fullPath);
                        const folderTime = Math.max(
                            stats.ctime ? stats.ctime.getTime() : 0,
                            stats.mtime ? stats.mtime.getTime() : 0
                        );
                        createdAt = new Date(folderTime);
                        lastUpdated = stats.mtime;
                    } catch (e) { }

                    // Cover image
                    const extensions = ['.jpg', '.jpeg', '.png'];
                    let cover = null;
                    for (const ext of extensions) {
                        const potential = path.join(dir, name + ext);
                        try {
                            await fs.stat(potential);
                            cover = `file://${potential.replace(/\\/g, '/')}`;
                            break;
                        } catch (e) { }
                    }

                    // If no side-car cover, check cache
                    if (!cover) {
                        const cachePath = path.join(baseArticlePath, 'ThumbnailCache', name + '.jpg');
                        try {
                            await fs.stat(cachePath);
                            cover = `file://${cachePath.replace(/\\/g, '/')}`;
                        } catch (e) { }
                    }

                    // Check progress
                    let progress = { current: 0, total: 0 };
                    try {
                        const progPath = path.join(baseArticlePath, 'Progress', `${name}.json`);
                        const rawProg = await fs.readFile(progPath, 'utf8');
                        progress = JSON.parse(rawProg);
                    } catch (e) { }

                    // Check ArticleCache for shelf-specific addedToShelfAt or createdAt timestamp
                    try {
                        const articleCacheDir = PATHS.ARTICLE_CACHE_DIR;
                        const articleCachePath = path.join(articleCacheDir, `${name}.json`);
                        const rawCache = await fs.readFile(articleCachePath, 'utf8');
                        const cached = JSON.parse(rawCache);
                        if (currentShelf && cached.shelf === currentShelf) {
                            const cacheTimeStr = cached.addedToShelfAt || cached.createdAt;
                            if (cacheTimeStr) {
                                const cacheTime = new Date(cacheTimeStr);
                                if (!isNaN(cacheTime.getTime()) && cacheTime.getTime() > 0) {
                                    createdAt = cacheTime;
                                }
                            }
                        }
                    } catch (e) { }

                    return { name, fullPath, cover, createdAt, lastUpdated, category, progress };
                };

                for (const shelf of articleShelfNames) {
                    const shelfPath = path.join(baseArticlePath, shelf);
                    try {
                        const entries = await fs.readdir(shelfPath, { withFileTypes: true });
                        const pdfs = entries.filter(e => !e.isDirectory() && e.name.toLowerCase().endsWith('.pdf'));
                        const subdirs = entries.filter(e => e.isDirectory());

                        subdirs.forEach(d => articleCategories.add(d.name));

                        const rootArticles = await processInChunks(pdfs, e => loadArticleEntry(e.name, shelfPath, null, shelf));
                        const articleCacheDir = PATHS.ARTICLE_CACHE_DIR;
                        try { await fs.mkdir(articleCacheDir, { recursive: true }); } catch (e) { }

                        let subArticles = [];
                        for (const dir of subdirs) {
                            const catPath = path.join(shelfPath, dir.name);
                            try {
                                const catFiles = await fs.readdir(catPath);
                                const catPdfs = catFiles.filter(f => f.toLowerCase().endsWith('.pdf'));
                                const catArticles = await processInChunks(catPdfs, f => loadArticleEntry(f, catPath, dir.name, shelf));
                                subArticles = subArticles.concat(catArticles);
                            } catch (e) { }
                        }

                        const articlesForShelf = [...rootArticles, ...subArticles];

                        // Load cached-only articles
                        let mergedArticles = [...articlesForShelf];
                        if (shelf === 'Read') {
                            try {
                                const cacheFiles = await fs.readdir(articleCacheDir);
                                const cacheJsons = cacheFiles.filter(f => f.endsWith('.json'));

                                for (const cacheFile of cacheJsons) {
                                    try {
                                        const raw = await fs.readFile(path.join(articleCacheDir, cacheFile), 'utf8');
                                        const cached = JSON.parse(raw);
                                        if (cached.shelf !== shelf) continue;
                                        const alreadyExists = articlesForShelf.some(a => a.name === cached.name);
                                        if (alreadyExists) continue;

                                    let cover = null;
                                    if (cached.thumbnailPath) {
                                        try {
                                            await fs.stat(cached.thumbnailPath);
                                            cover = `file://${cached.thumbnailPath.replace(/\\/g, '/')}`;
                                        } catch (e) { }
                                    }

                                    let progress = { current: 0, total: cached.totalPages || 0 };
                                    try {
                                        const progPath = path.join(baseArticlePath, 'Progress', `${cached.name}.json`);
                                        const rawProg = await fs.readFile(progPath, 'utf8');
                                        progress = JSON.parse(rawProg);
                                    } catch (e) { }

                                    mergedArticles.push({
                                        name: cached.name,
                                        fullPath: cached.originalPath || path.join(shelfPath, cached.name + '.pdf'),
                                        cover,
                                        progress,
                                        createdAt: new Date(cached.addedToShelfAt || cached.createdAt || cached.cachedAt || 0),
                                        lastUpdated: new Date(cached.lastUpdated || cached.cachedAt || 0),
                                        cachedOnly: true,
                                        category: cached.category || null,
                                    });
                                } catch (e) { }
                            }
                            } catch (e) { }
                        }

                        articlesData.shelves[shelf] = mergedArticles.sort((a, b) => {
                            const timeA = a.createdAt ? a.createdAt.getTime() : 0;
                            const timeB = b.createdAt ? b.createdAt.getTime() : 0;
                            if (timeB !== timeA) return timeB - timeA;
                            return a.name.localeCompare(b.name);
                        });
                    } catch (e) { }
                }

                articlesData.categories = Array.from(articleCategories).sort();
                articlesData.totalArticles = Object.values(articlesData.shelves).reduce((acc, s) => acc + s.length, 0);
            } catch (e) { }


            setData({
                finance: financeData,
                planner: plannerData,
                reading: readingData,
                articles: articlesData,
                time: timeData,
                skills: skillsData,
                lexicon: lexiconData,
                goals: goalsData,
                todos: todosData,
                rewards: rewardsData,
            });
            setLoading(false);
        } catch (err) {
            console.error("Dashboard fetch error:", err);
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchAllData();
        const interval = setInterval(fetchAllData, 30000); // 30s refresh
        return () => clearInterval(interval);
    }, []);

    useEffect(() => {
        const isActive = data.time?.activeSession;
        const updateIcon = () => {
            try {
                const { ipcRenderer } = window.require('electron');
                console.log('Sending update-app-icon:', !!isActive);
                ipcRenderer.send('update-app-icon', !!isActive);
            } catch (e) { }
        };
        updateIcon();
        const t = setTimeout(updateIcon, 1500); // Buffer for app window init
        return () => clearTimeout(t);
    }, [data.time?.activeSession]);

    const refreshData = () => {
        fetchAllData();
    };

    return (
        <DataContext.Provider value={{ data, loading, refreshData }}>
            {children}
        </DataContext.Provider>
    );
};
