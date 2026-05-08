import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import plusIcon from '../assets/icons/plus.svg';
import trashIcon from '../assets/icons/delete.svg';
import calendarIcon from '../assets/icons/calendar.svg';
import targetIcon from '../assets/icons/goals.svg';
import zapIcon from '../assets/icons/zap.svg';
import clockIcon from '../assets/icons/clock.svg';
import chevronLeftIcon from '../assets/icons/chevron-left.svg';
import chevronRightIcon from '../assets/icons/chevron-right.svg';
import closeIcon from '../assets/icons/close.svg';
import ReactDOM from 'react-dom';
import Navbar from './Navbar'

// --- ELECTRON / NODE.JS IMPORTS ---
const fs = window.require('fs').promises;
const path = window.require('path');

// --- CONFIGURATION ---
const BASE_DB = 'C:\\Users\\PC\\Desktop\\database';
const ALLOCATOR_DIR = path.join(BASE_DB, 'TimeAllocator');
const TRACKER_DIR = path.join(BASE_DB, 'TimeTracker');

const ALLOCATIONS_FILE = path.join(ALLOCATOR_DIR, 'data.json');
const TASKS_FILE = 'C:/Users/PC/Desktop/Database/DayPlanner/tasks.json';
const SESSIONS_FILE = path.join(TRACKER_DIR, 'sessions.json');
const LocalIcon = ({ src, className = "", size = 16 }) => (
    <div
        className={`inline-block bg-current ${className}`}
        style={{
            width: size,
            height: size,
            maskImage: `url("${src}")`,
            maskSize: 'contain',
            maskRepeat: 'no-repeat',
            WebkitMaskImage: `url("${src}")`,
            WebkitMaskSize: 'contain',
            WebkitMaskRepeat: 'no-repeat',
        }}
    />
);

// --- ICONS (SVG Components) ---
const IconPlus = ({ className = "" }) => <LocalIcon src={plusIcon} size={16} className={className} />;
const IconTrash = () => <LocalIcon src={trashIcon} size={16} className="text-zinc-600 hover:text-red-400 transition-colors" />;
const IconCalendar = () => <LocalIcon src={calendarIcon} size={20} className="text-zinc-400 group-hover:text-white transition-colors" />;
const IconTarget = () => <LocalIcon src={targetIcon} size={20} className="text-zinc-400 group-hover:text-white transition-colors" />;
const IconAlert = () => <LocalIcon src={zapIcon} size={16} className="text-yellow-500" />;
const IconClock = () => <LocalIcon src={clockIcon} size={20} className="text-zinc-400 group-hover:text-white transition-colors" />;
const IconChevronLeft = () => <LocalIcon src={chevronLeftIcon} size={20} className="text-zinc-500 hover:text-white transition-colors" />;
const IconChevronRight = () => <LocalIcon src={chevronRightIcon} size={20} className="text-zinc-500 hover:text-white transition-colors" />;
const IconX = () => <LocalIcon src={closeIcon} size={16} className="text-zinc-500 hover:text-white transition-colors" />;

// --- UTILS ---
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const uid = () => Date.now().toString(36) + Math.random().toString(36).substr(2);

// Get current month index (0-11)
const getCurrentMonthIndex = () => new Date().getMonth();

// Calculate remaining work hours in current month
const getRemainingWorkHours = (dailyHours) => {
    const now = new Date();
    const currentDay = now.getDate();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();

    // Get the last day of current month
    const lastDay = new Date(currentYear, currentMonth + 1, 0).getDate();

    let remainingWorkDays = 0;

    // Count remaining work days (Monday-Friday) from today onwards
    for (let day = currentDay; day <= lastDay; day++) {
        const date = new Date(currentYear, currentMonth, day);
        const dayOfWeek = date.getDay();

        // 0 = Sunday, 6 = Saturday, so 1-5 are work days
        if (dayOfWeek >= 1 && dayOfWeek <= 5) {
            remainingWorkDays++;
        }
    }

    return remainingWorkDays * dailyHours;
};

// --- COMPONENTS ---

const Toast = ({ message, type, onClose }) => {
    useEffect(() => {
        const timer = setTimeout(onClose, 3000);
        return () => clearTimeout(timer);
    }, [onClose]);

    const bgColors = {
        success: "bg-emerald-500/20 text-emerald-100 border-emerald-500/50",
        error: "bg-rose-500/20 text-rose-100 border-rose-500/50"
    };

    return (
        <div className={`fixed bottom-6 right-6 px-5 py-3.5 rounded-xl shadow-2xl border flex items-center gap-3 z-50 backdrop-blur-xl ${bgColors[type] || bgColors.success} animate-slideIn`}>
            {type === 'error' && <IconAlert />}
            <span className="text-sm font-medium">{message}</span>
        </div>
    );
};

const SessionTooltip = ({ sessions, targetRect, onClose }) => {
    if (!sessions || sessions.length === 0 || !targetRect) return null;

    // Smart positioning: Check if near top of screen
    const isNearTop = targetRect.top < 200; // Threshold for flipping
    const tooltipStyle = {
        position: 'fixed',
        top: isNearTop ? `${targetRect.bottom}px` : `${targetRect.top}px`,
        left: `${targetRect.left + (targetRect.width / 2)}px`,
        transform: isNearTop ? 'translate(-50%, 10px)' : 'translate(-50%, calc(-100% - 10px))', // Flip down if near top
        zIndex: 9999,
        maxHeight: '300px', // Ensure it fits
    };

    const handleEnter = () => {
        if (targetRect.onMouseEnter) targetRect.onMouseEnter();
    };

    const handleLeave = () => {
        if (targetRect.onMouseLeave) targetRect.onMouseLeave();
    };

    return ReactDOM.createPortal(
        <div
            style={tooltipStyle}
            className="mb-2 w-56 bg-neutral-900 border border-white/10 rounded-xl shadow-[0_20px_50px_rgba(0,0,0,0.5)] p-3 animate-fadeIn backdrop-blur-2xl ring-1 ring-white/5"
            onMouseEnter={handleEnter}
            onMouseLeave={handleLeave}
        >
            <div className="flex items-center justify-between mb-2.5 px-1 border-b border-white/5 pb-2">
                <span className="text-[9px] font-bold uppercase tracking-widest text-neutral-400">Session History</span>
                <span className="text-[8px] font-mono text-neutral-600 bg-white/5 px-1.5 py-0.5 rounded">GMT</span>
            </div>
            <div className="space-y-1.5 max-h-32 overflow-y-auto custom-scrollbar">
                {sessions.map((s, i) => (
                    <div key={i} className="flex items-center justify-between text-[9px] px-1 hover:bg-white/5 rounded transition-colors">
                        <span className="text-neutral-400 font-mono">{s.date.split('-').slice(1).join('/')}</span>
                        <span className="text-emerald-400 font-bold font-mono">{(s.durationSeconds / 3600).toFixed(1)}h</span>
                    </div>
                ))}
            </div>
            <div className="mt-2 pt-1 border-t border-white/5 flex justify-between px-1">
                <span className="text-[8px] uppercase font-bold text-neutral-600">Total</span>
                <span className="text-[10px] font-bold text-white font-mono">
                    {(sessions.reduce((acc, s) => acc + s.durationSeconds, 0) / 3600).toFixed(1)}h
                </span>
            </div>
        </div>,
        document.body
    );
};

const TimeAllocator = ({ showNavbar = true }) => {
    // --- STATE ---
    const [allTasks, setAllTasks] = useState([]); // Pool from tracker
    const [selectedTasks, setSelectedTasks] = useState([]); // Specifically for allocator
    const [sessions, setSessions] = useState([]);
    const [dailyHours, setDailyHours] = useState(5);
    const [isAddModalOpen, setIsAddModalOpen] = useState(false);
    const [toast, setToast] = useState(null);
    const [isLoading, setIsLoading] = useState(true);
    const [monthOffset, setMonthOffset] = useState(0);
    const [hoveredCell, setHoveredCell] = useState(null); // {taskId, monthIdx, year, targetRect}
    const hoverTimeoutRef = useRef(null);

    const onCellEnter = (rect, cellData) => {
        if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current);

        // Manually copy properties since ...rect might fail on DOMRect
        const enhancedRect = {
            top: rect.top,
            bottom: rect.bottom,
            left: rect.left,
            right: rect.right,
            width: rect.width,
            height: rect.height,
            x: rect.x,
            y: rect.y,
            onMouseEnter: () => {
                if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current);
            },
            onMouseLeave: () => {
                hoverTimeoutRef.current = setTimeout(() => setHoveredCell(null), 100);
            }
        };
        setHoveredCell({ ...cellData, targetRect: enhancedRect });
    };

    const onCellLeave = () => {
        hoverTimeoutRef.current = setTimeout(() => setHoveredCell(null), 100);
    };

    // --- FILE SYSTEM PERSISTENCE ---
    const saveData = useCallback(async (currentTasks, currentDailyHours) => {
        try {
            await fs.mkdir(ALLOCATOR_DIR, { recursive: true });
            const dataToSave = {
                selectedTasks: currentTasks.map(t => ({ id: t.id, allocations: t.allocations })),
                dailyHours: currentDailyHours
            };
            const tempPath = ALLOCATIONS_FILE + '.tmp';
            await fs.writeFile(tempPath, JSON.stringify(dataToSave, null, 2), 'utf8');
            await fs.rename(tempPath, ALLOCATIONS_FILE);
        } catch (error) {
            console.error("Error saving Allocator data:", error);
        }
    }, []);

    useEffect(() => {
        const loadAllData = async () => {
            try {
                // 1. Load active tasks from Tracker
                let tasksPool = [];
                try {
                    const tasksData = await fs.readFile(TASKS_FILE, 'utf8');
                    const parsed = (tasksData && tasksData.trim()) ? JSON.parse(tasksData) : [];
                    tasksPool = Array.isArray(parsed) ? parsed.filter(t => t.isWork) : [];
                } catch (e) { console.log("No tasks found in tracker."); }
                setAllTasks(tasksPool);

                // 2. Load sessions from Tracker
                let sessionsPool = [];
                try {
                    const sessionsData = await fs.readFile(SESSIONS_FILE, 'utf8');
                    sessionsPool = (sessionsData && sessionsData.trim()) ? JSON.parse(sessionsData) : [];
                } catch (e) { console.log("No sessions found."); }
                setSessions(sessionsPool);

                // 3. Load selected tasks and allocations
                let savedData = { selectedTasks: [], dailyHours: 5 };
                try {
                    const allocData = await fs.readFile(ALLOCATIONS_FILE, 'utf8');
                    const parsed = (allocData && allocData.trim()) ? JSON.parse(allocData) : { selectedTasks: [], dailyHours: 5 };
                    if (parsed && Array.isArray(parsed.selectedTasks)) {
                        savedData = parsed;
                    } else if (parsed && Array.isArray(parsed.allocations)) {
                        // Migration from previous sync format
                        savedData.selectedTasks = parsed.allocations;
                        savedData.dailyHours = parsed.dailyHours || 5;
                    }
                } catch (e) { console.log("No allocations found or invalid format."); }

                // 4. Merge
                const merged = savedData.selectedTasks.map(saved => {
                    const taskInfo = tasksPool.find(t => t.id === saved.id);
                    if (!taskInfo) return null; // Task deleted in tracker
                    return {
                        ...taskInfo,
                        name: taskInfo.name,
                        allocations: saved.allocations
                    };
                }).filter(Boolean);

                setSelectedTasks(merged);
                setDailyHours(savedData.dailyHours || 5);
            } catch (error) {
                console.error("Critical load error:", error);
            } finally {
                setIsLoading(false);
            }
        };
        loadAllData();
    }, []);

    useEffect(() => {
        if (!isLoading) {
            saveData(selectedTasks, dailyHours);
        }
    }, [selectedTasks, dailyHours, isLoading, saveData]);

    // --- CALCULATIONS ---
    const dailyCapacity = dailyHours;
    const weeklyCapacity = dailyHours * 5;
    const yearlyCapacity = dailyHours * 260;
    const monthlyCapacity = Math.round(yearlyCapacity / 12);
    const remainingHoursThisMonth = getRemainingWorkHours(dailyHours);

    const yearTotal = selectedTasks.reduce((acc, task) => acc + task.allocations.reduce((a, b) => a + b, 0), 0);
    const currentMonthIndex = getCurrentMonthIndex();
    const currentYear = new Date().getFullYear();
    const allocatedThisMonth = selectedTasks.reduce((total, task) => total + task.allocations[currentMonthIndex], 0);

    const calculateLoggedHours = (taskId, monthIndex, year = new Date().getFullYear()) => {
        const totalSeconds = sessions
            .filter(s => s.taskId === taskId && s.durationSeconds)
            .filter(s => {
                if (!s.date) return false;
                const parts = s.date.split('-');
                if (parts.length < 2) return false;
                const sYear = parseInt(parts[0]);
                const sMonth = parseInt(parts[1]) - 1; // 0-indexed
                return sMonth === monthIndex && sYear === year;
            })
            .reduce((acc, s) => acc + (s.durationSeconds || 0), 0);
        return totalSeconds / 3600;
    };

    const getDetailedSessions = (taskId, monthIndex, year = new Date().getFullYear()) => {
        return sessions
            .filter(s => s.taskId === taskId && s.durationSeconds)
            .filter(s => {
                if (!s.date) return false;
                const parts = s.date.split('-');
                if (parts.length < 2) return false;
                const sYear = parseInt(parts[0]);
                const sMonth = parseInt(parts[1]) - 1;
                return sMonth === monthIndex && sYear === year;
            })
            .sort((a, b) => new Date(a.date) - new Date(b.date));
    };

    const getYearTotalLogged = (taskId) => {
        const year = new Date().getFullYear();
        const totalSeconds = sessions
            .filter(s => s.taskId === taskId && s.durationSeconds)
            .filter(s => {
                if (!s.date) return false;
                const parts = s.date.split('-');
                return parseInt(parts[0]) === year;
            })
            .reduce((acc, s) => acc + (s.durationSeconds || 0), 0);
        return totalSeconds / 3600;
    };

    const totalLoggedYearly = selectedTasks.reduce((acc, task) => acc + getYearTotalLogged(task.id), 0);
    const totalLoggedThisMonth = selectedTasks.reduce((acc, task) => acc + calculateLoggedHours(task.id, currentMonthIndex, currentYear), 0);

    const daysLeftCalculations = useMemo(() => {
        const now = new Date();
        const currentYear = now.getFullYear();
        const currentMonth = now.getMonth();
        const currentDay = now.getDate();

        // Month calculations
        const lastDay = new Date(currentYear, currentMonth + 1, 0).getDate();
        let daysLeft = 0;
        let workDaysLeft = 0;

        for (let day = currentDay; day <= lastDay; day++) {
            daysLeft++;
            const date = new Date(currentYear, currentMonth, day);
            const dayOfWeek = date.getDay();
            if (dayOfWeek >= 1 && dayOfWeek <= 5) {
                workDaysLeft++;
            }
        }

        // Year calculations
        const startOfToday = new Date(currentYear, currentMonth, currentDay);
        const endOfYear = new Date(currentYear, 11, 31);
        let daysLeftYear = 0;
        let workDaysLeftYear = 0;

        for (let d = new Date(startOfToday); d <= endOfYear; d.setDate(d.getDate() + 1)) {
            daysLeftYear++;
            const dayOfWeek = d.getDay();
            if (dayOfWeek >= 1 && dayOfWeek <= 5) {
                workDaysLeftYear++;
            }
        }

        const dateOptions = { weekday: 'short', month: 'short', day: 'numeric' };
        let formattedDate = now.toLocaleDateString('en-US', dateOptions);

        return {
            formattedDate,
            currentYear,
            daysLeft,
            workDaysLeft,
            totalHours: daysLeft * 6,
            workHours: workDaysLeft * dailyHours,
            daysLeftYear,
            workDaysLeftYear,
            totalHoursYear: daysLeftYear * 6,
            workHoursYear: workDaysLeftYear * dailyHours
        };
    }, [dailyHours]);

    // --- RESPONSIVE MONTH DISPLAY ---
    const getVisibleMonths = () => {
        const currentMonth = getCurrentMonthIndex();
        return { currentMonth };
    };

    const { currentMonth } = getVisibleMonths();

    // Get visible month indices and their years
    const getMonthIndices = () => {
        const currentYear = new Date().getFullYear();
        return Array.from({ length: 3 }, (_, i) => {
            const absoluteMonth = currentMonth + monthOffset + i;
            const yearOffset = Math.floor(absoluteMonth / 12);
            const monthIdx = ((absoluteMonth % 12) + 12) % 12;
            return { monthIdx, year: currentYear + yearOffset };
        });
    };

    const nextQuarter = () => setMonthOffset(prev => prev + 1);
    const prevQuarter = () => setMonthOffset(prev => prev - 1);

    const updateAllocation = (taskId, monthIndex, value) => {
        const val = parseFloat(value);
        if (isNaN(val) || val < 0) return;

        setSelectedTasks(prev => prev.map(task => {
            if (task.id === taskId) {
                const newAllocations = [...task.allocations];
                newAllocations[monthIndex] = val;
                return { ...task, allocations: newAllocations };
            }
            return task;
        }));
    };

    const addTaskToSelection = (task) => {
        if (selectedTasks.find(t => t.id === task.id)) {
            setToast({ message: "Task already added", type: "error" });
            return;
        }
        setSelectedTasks([...selectedTasks, { ...task, name: task.name, allocations: Array(12).fill(0) }]);
        setIsAddModalOpen(false);
        setToast({ message: "Task added to allocator", type: "success" });
    };

    const removeTaskFromSelection = (taskId) => {
        setSelectedTasks(prev => prev.filter(t => t.id !== taskId));
        setToast({ message: "Task removed from allocator", type: "success" });
    };


    const colorMap = {
        cyan: 'bg-cyan-400',
        blue: 'bg-blue-400',
        emerald: 'bg-emerald-400',
        amber: 'bg-amber-400',
        rose: 'bg-rose-400',
        purple: 'bg-purple-400',
        pink: 'bg-pink-400',
        indigo: 'bg-indigo-400',
    };

    if (isLoading) {
        return (
            <div className="min-h-screen bg-black flex items-center justify-center">
                <div className="flex flex-col items-center gap-4">
                    <div className="w-8 h-8 border-2 border-emerald-500/30 border-t-emerald-500 rounded-full animate-spin"></div>
                    <p className="text-neutral-500 text-[10px] uppercase font-bold tracking-widest">Loading Sync...</p>
                </div>
            </div>
        );
    }

    return (
        <>
            {showNavbar && <Navbar />}
            <div className="pl-12 min-h-screen bg-black text-neutral-200 font-sansSelection">
                <style>{`
                @keyframes slideIn {
                    from { transform: translateX(100%); opacity: 0; }
                    to { transform: translateX(0); opacity: 1; }
                }
                .animate-slideIn { animation: slideIn 0.3s ease-out; }
                
                @keyframes fadeIn {
                    from { opacity: 0; transform: translateY(4px); }
                    to { opacity: 1; transform: translateY(0); }
                }
                .animate-fadeIn { animation: fadeIn 0.3s ease-out forwards; }

                input[type="number"]::-webkit-inner-spin-button,
                input[type="number"]::-webkit-outer-spin-button {
                    -webkit-appearance: none;
                    margin: 0;
                }
                input[type="number"] { -moz-appearance: textfield; }
            `}</style>

                {/* Header */}
                <header className="border-b border-white/5 bg-black/60 backdrop-blur-xl sticky top-0 z-40">
                    <div className="max-w-[1800px] mx-auto px-6 py-3">
                        <div className="flex flex-row items-center justify-between gap-6">
                            <div className="flex items-center gap-4">
                                {/* Daily Hours Config */}
                                <div className="flex items-center gap-2 bg-neutral-900/50 rounded-lg px-3 h-[34px] border border-white/5">
                                    <IconClock />
                                    <div className="flex items-center gap-2">
                                        <label className="text-[10px] font-bold uppercase tracking-wider text-neutral-400">Cap:</label>
                                        <input
                                            type="number"
                                            min="1"
                                            max="24"
                                            value={dailyHours}
                                            onChange={(e) => setDailyHours(Math.max(1, parseInt(e.target.value) || 1))}
                                            className="w-5 bg-transparent text-center font-mono text-xs text-emerald-400 focus:outline-none"
                                        />
                                    </div>
                                </div>
                                {/* Current Date & Days Left (Month & Year) */}
                                <div className="flex items-center gap-3 bg-neutral-900/50 rounded-lg px-3 h-[34px] border border-white/5 hidden sm:flex">
                                    <div className="flex gap-3 items-center">
                                        <span className="text-[10px] font-bold uppercase tracking-widest text-emerald-400">
                                            {daysLeftCalculations.formattedDate}
                                        </span>
                                        <div className="w-px h-3 bg-white/10 hidden sm:block"></div>
                                        <div className="flex items-center gap-2 text-[10px] font-mono text-neutral-400">
                                            <span title="Work days and work hours left in month (excluding weekends, based on daily cap)"><strong className="text-sky-400">{daysLeftCalculations.workDaysLeft}</strong> days left <span className="text-[9px] text-sky-400/50">({daysLeftCalculations.workHours}h)</span></span>

                                            <div className="w-px h-3 bg-white/10 mx-1 hidden sm:block"></div>

                                            <span className="text-neutral-500 font-bold uppercase tracking-widest text-[9px]">Year:</span>
                                            <span title="Work days and work hours left in year (excluding weekends, based on daily cap)"><strong className="text-sky-400">{daysLeftCalculations.workDaysLeftYear}</strong> days left <span className="text-[9px] text-sky-400/50">({daysLeftCalculations.workHoursYear}h)</span></span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                            <button
                                onClick={() => setIsAddModalOpen(true)}
                                className="bg-white text-black font-bold text-[10px] uppercase tracking-widest px-4 h-[34px] rounded-lg transition-all hover:bg-neutral-200 active:scale-95 flex items-center gap-2 cursor-pointer"
                            >
                                <IconPlus />
                                Add Task
                            </button>
                        </div>
                    </div>
                </header>

                {/* Stats Bar */}
                <div className="border-b border-white/5 bg-neutral-900/10">
                    <div className="max-w-[1800px] mx-auto px-6 py-4">
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                            <div className="bg-neutral-900/40 rounded-xl p-3 border border-white/5">
                                <div className="text-neutral-500 text-[9px] font-bold uppercase tracking-widest mb-1">Daily Cap</div>
                                <div className="text-xl font-bold font-mono text-white">{dailyCapacity}h</div>
                            </div>
                            <div className="bg-neutral-900/40 rounded-xl p-3 border border-white/5">
                                <div className="text-neutral-500 text-[9px] font-bold uppercase tracking-widest mb-1">Weekly Cap</div>
                                <div className="text-xl font-bold font-mono text-white">{weeklyCapacity}h</div>
                            </div>

                            <div className="bg-emerald-500/5 rounded-xl p-3 border border-emerald-500/10">
                                <div className="text-emerald-500 text-[9px] font-bold uppercase tracking-widest mb-1 flex items-center gap-1.5">
                                    <IconClock />
                                    Current Month
                                </div>
                                <div className="flex items-baseline gap-2">
                                    <div className="text-xl font-bold font-mono text-emerald-400">{remainingHoursThisMonth}h</div>
                                    <div className="text-[10px] text-emerald-500/60 font-mono">left</div>
                                </div>
                                <div className="text-[10px] text-neutral-500 mt-1 font-mono">
                                    {allocatedThisMonth}h / {monthlyCapacity}h alloc.
                                </div>
                            </div>
                            <div className="bg-neutral-900/40 rounded-xl p-3 border border-white/5">
                                <div className="text-neutral-500 text-[9px] font-bold uppercase tracking-widest mb-1">Yearly Total</div>
                                <div className="flex items-baseline gap-2">
                                    <div className="text-xl font-bold font-mono text-amber-400">{yearTotal.toFixed(1)}h</div>
                                    <div className="text-[9px] text-neutral-600 font-mono">alloc.</div>
                                </div>
                            </div>
                            <div className="bg-neutral-900/40 rounded-xl p-3 border border-white/5">
                                <div className="text-neutral-500 text-[9px] font-bold uppercase tracking-widest mb-1">Yearly Logged</div>
                                <div className="flex items-baseline gap-2">
                                    <div className="text-xl font-bold font-mono text-sky-400">{totalLoggedYearly.toFixed(1)}h</div>
                                    <div className="text-[9px] text-neutral-600 font-mono">actual</div>
                                </div>
                            </div>
                            <div className="bg-emerald-500/10 rounded-xl p-3 border border-emerald-500/20">
                                <div className="text-emerald-400 text-[9px] font-bold uppercase tracking-widest mb-1">MTD Logged</div>
                                <div className="flex items-baseline gap-2">
                                    <div className="text-xl font-bold font-mono text-emerald-400">{totalLoggedThisMonth.toFixed(1)}h</div>
                                    <div className="text-[9px] text-emerald-500/60 font-mono">this month</div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Main Table */}
                <main className="max-w-[1800px] mx-auto px-6 py-6">
                    <div className="bg-black rounded-xl border border-white/5 shadow-2xl">
                        <div className="overflow-x-auto custom-scrollbar pb-32 -mb-32">
                            <table className="w-full text-left border-collapse">
                                <thead>
                                    <tr className="bg-neutral-900/40 border-b border-white/5">
                                        <th className="sticky left-0 z-20 bg-black px-6 py-3 text-[10px] font-bold uppercase tracking-widest text-neutral-500 border-r border-white/5">
                                            Task Name
                                        </th>
                                        <th className="px-4 py-3 text-center text-[10px] font-bold uppercase tracking-widest text-neutral-500" colSpan="3">
                                            <div className="flex items-center justify-center gap-4">
                                                <button onClick={prevQuarter} className="p-1 hover:bg-white/10 rounded transition-colors text-neutral-400 hover:text-white cursor-pointer">
                                                    <IconChevronLeft />
                                                </button>
                                                <span>Monthly Allocation (hours)</span>
                                                <button onClick={nextQuarter} className="p-1 hover:bg-white/10 rounded transition-colors text-neutral-400 hover:text-white cursor-pointer">
                                                    <IconChevronRight />
                                                </button>
                                            </div>
                                        </th>
                                        <th className="px-6 py-3 text-center text-[10px] font-bold uppercase tracking-widest text-neutral-500 border-l border-white/5">
                                            Yearly
                                        </th>
                                        <th className="px-4 py-3 text-center text-[10px] font-bold uppercase tracking-widest text-neutral-500 sm:table-cell">
                                            Status
                                        </th>
                                    </tr>
                                    <tr className="bg-neutral-900/20 border-b border-white/5">
                                        <th className="sticky left-0 z-20 bg-black px-6 py-1.5 border-r border-white/5"></th>
                                        <React.Fragment>
                                            {getMonthIndices().map(({ monthIdx, year }) => {
                                                const monthAllocated = selectedTasks.reduce((total, task) => total + task.allocations[monthIdx], 0);
                                                const isCurrent = monthIdx === currentMonthIndex && year === new Date().getFullYear();
                                                return (
                                                    <th key={`${monthIdx}-${year}`} className="px-2 py-1.5 text-center border-r border-white/5 last:border-r-0">
                                                        <div className={`text-[9px] font-bold uppercase tracking-tighter ${isCurrent ? 'text-emerald-400' : 'text-neutral-600'}`}>
                                                            {MONTHS[monthIdx]} {year !== new Date().getFullYear() && `'${year.toString().slice(-2)}`}
                                                        </div>
                                                        <div className="text-[8px] font-mono text-neutral-700">
                                                            {monthAllocated > 0 ? `${monthAllocated.toFixed(1)}h` : '0'}
                                                        </div>
                                                    </th>
                                                );
                                            })}
                                        </React.Fragment>
                                        <th className="px-6 py-1.5 border-l border-white/5"></th>
                                        <th className="px-4 py-1.5"></th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-white/5">
                                    {selectedTasks.length === 0 ? (
                                        <tr>
                                            <td colSpan="20" className="p-16 text-center text-neutral-600">
                                                <div className="flex flex-col items-center justify-center gap-2 animate-fadeIn">
                                                    <span className="text-xl">No tasks selected.</span>
                                                    <p className="text-[10px] uppercase font-bold tracking-widest opacity-50">Click "Add Task" to bring tasks in from Time Tracker.</p>
                                                </div>
                                            </td>
                                        </tr>
                                    ) : (
                                        selectedTasks.map((task, idx) => {
                                            const taskTotal = task.allocations.reduce((a, b) => a + b, 0);
                                            const avgMonth = taskTotal / 12;

                                            return (
                                                <tr key={task.id} className="hover:bg-white/[0.02] transition-colors group animate-fadeIn" style={{ animationDelay: `${idx * 0.02}s` }}>
                                                    <td className="sticky left-0 z-10 bg-black group-hover:bg-neutral-900/50 px-6 py-2 border-r border-white/5 backdrop-blur-sm">
                                                        <div className="flex items-center gap-2">
                                                            <div className={`w-1.5 h-1.5 rounded-full ${colorMap[task.color] || 'bg-emerald-400'}`}></div>
                                                            <span className="text-[11px] font-bold text-neutral-300 truncate block max-w-[150px]" title={task.name}>
                                                                {task.name}
                                                            </span>
                                                        </div>
                                                    </td>

                                                    {getMonthIndices().map(({ monthIdx, year }) => {
                                                        const hours = task.allocations[monthIdx];
                                                        const logged = calculateLoggedHours(task.id, monthIdx, year);
                                                        const isOver = hours > monthlyCapacity;
                                                        const isCurrent = monthIdx === currentMonth && year === new Date().getFullYear();

                                                        return (
                                                            <td
                                                                key={`${monthIdx}-${year}`}
                                                                className={`px-1 py-2 transition-all relative ${isOver ? 'bg-rose-500/5' : ''} ${isCurrent ? 'bg-emerald-500/5' : ''}
                                                                    ${hoveredCell?.taskId === task.id && hoveredCell?.monthIdx === monthIdx ? 'z-[60]' : 'z-0'}
                                                                `}
                                                                onMouseEnter={(e) => {
                                                                    const rect = e.currentTarget.getBoundingClientRect();
                                                                    onCellEnter(rect, { taskId: task.id, monthIdx, year, taskName: task.name });
                                                                }}
                                                                onMouseLeave={onCellLeave}
                                                            >
                                                                <div className="relative flex flex-col items-center gap-1.5">
                                                                    {hoveredCell?.taskId === task.id && hoveredCell?.monthIdx === monthIdx && hoveredCell?.year === year && (
                                                                        <SessionTooltip
                                                                            sessions={getDetailedSessions(task.id, monthIdx, year)}
                                                                            targetRect={hoveredCell.targetRect}
                                                                        />
                                                                    )}
                                                                    <div className="flex items-center justify-center">
                                                                        <input
                                                                            type="number"
                                                                            min="0"
                                                                            step="0.5"
                                                                            className={`w-12 py-1 text-center bg-transparent text-[11px] font-bold font-mono focus:outline-none transition-all
                                                                                ${isOver ? 'text-rose-400' : 'text-neutral-300'}
                                                                            `}
                                                                            value={hours === 0 ? '' : hours}
                                                                            onChange={(e) => updateAllocation(task.id, monthIdx, e.target.value)}
                                                                            placeholder="0"
                                                                        />
                                                                    </div>

                                                                    {hours > 0 && (
                                                                        <div className="flex flex-col items-center w-full px-1.5 min-w-[60px]">
                                                                            <div className="w-full h-[3px] bg-neutral-900 rounded-full overflow-hidden mb-0.5">
                                                                                <div
                                                                                    className={`h-full transition-all duration-500 ${logged >= hours ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.4)]' : 'bg-amber-500/70'}`}
                                                                                    style={{ width: `${Math.min((logged / hours) * 100, 100)}%` }}
                                                                                />
                                                                            </div>
                                                                            <div className="flex items-center justify-between w-full">
                                                                                <span className={`text-[9px] font-bold font-mono ${logged > 0 ? 'text-white' : 'text-neutral-600'}`}>
                                                                                    {logged.toFixed(1)}h
                                                                                </span>
                                                                                <span className="text-[8px] text-neutral-600 font-mono">
                                                                                    / {hours}h
                                                                                </span>
                                                                            </div>
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            </td>
                                                        );
                                                    })}

                                                    <td className="px-6 py-2 border-l border-white/5 bg-neutral-900/10">
                                                        <div className="flex flex-col items-end">
                                                            <div className="text-xs font-bold font-mono text-emerald-400">
                                                                {taskTotal.toFixed(1)}h <span className="text-[9px] text-neutral-600 font-normal">budget</span>
                                                            </div>
                                                            <div className="text-[11px] font-bold font-mono text-sky-400 mt-1">
                                                                {getYearTotalLogged(task.id).toFixed(1)}h <span className="text-[9px] text-neutral-600 font-normal">logged</span>
                                                            </div>
                                                        </div>
                                                    </td>

                                                    <td className="px-4 py-2 text-center">
                                                        <button
                                                            onClick={() => removeTaskFromSelection(task.id)}
                                                            className="p-2 text-neutral-600 hover:text-rose-500 hover:bg-rose-500/10 rounded-lg transition-all cursor-pointer"
                                                            title="Remove Task"
                                                        >
                                                            <IconTrash />
                                                        </button>
                                                    </td>
                                                </tr>
                                            );
                                        })
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    {/* Mobile View */}
                    {selectedTasks.length > 0 && (
                        <div className="sm:hidden mt-4 space-y-2">
                            {selectedTasks.map(task => (
                                <div key={task.id} className="flex items-center justify-between bg-neutral-900/20 rounded-lg px-4 py-2 border border-white/5">
                                    <div className="flex items-center gap-2">
                                        <div className={`w-1.5 h-1.5 rounded-full ${colorMap[task.color] || 'bg-emerald-400'}`}></div>
                                        <span className="text-[10px] font-bold text-neutral-400">{task.name}</span>
                                    </div>
                                    <button
                                        onClick={() => removeTaskFromSelection(task.id)}
                                        className="text-rose-500 p-1 cursor-pointer"
                                    >
                                        <IconX />
                                    </button>
                                </div>
                            ))}
                        </div>
                    )}
                </main>

                {/* Add Task Modal */}
                {isAddModalOpen && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
                        <div className="bg-neutral-900 rounded-3xl shadow-2xl w-full max-w-sm overflow-hidden transform transition-all border border-white/10">
                            <div className="p-6 border-b border-white/5 flex justify-between items-center bg-black/40">
                                <h3 className="text-sm font-bold uppercase tracking-widest text-white">
                                    Add Task to Allocator
                                </h3>
                                <button
                                    onClick={() => setIsAddModalOpen(false)}
                                    className="text-neutral-500 hover:text-white p-2 rounded-full hover:bg-white/5 transition-colors cursor-pointer"
                                >
                                    <IconX />
                                </button>
                            </div>

                            <div className="p-4 max-h-[400px] overflow-y-auto space-y-2">
                                {allTasks.length === 0 ? (
                                    <p className="text-center p-8 text-neutral-500 text-xs font-bold uppercase tracking-widest">No tasks in Time Tracker pool.</p>
                                ) : (
                                    allTasks.map(task => {
                                        const isSelected = selectedTasks.some(t => t.id === task.id);
                                        return (
                                            <button
                                                key={task.id}
                                                disabled={isSelected}
                                                onClick={() => addTaskToSelection(task)}
                                                className={`w-full flex items-center justify-between p-4 rounded-xl border transition-all cursor-pointer 
                                                    ${isSelected
                                                        ? 'bg-neutral-900/50 border-white/5 opacity-50 cursor-not-allowed'
                                                        : 'bg-black/40 border-white/5 hover:border-emerald-500/50 hover:bg-neutral-800/50 active:scale-[0.98]'
                                                    }
                                                `}
                                            >
                                                <div className="flex items-center gap-3">
                                                    <div className={`w-2 h-2 rounded-full ${colorMap[task.color] || 'bg-emerald-400'}`} />
                                                    <span className={`text-xs font-bold ${isSelected ? 'text-neutral-600' : 'text-neutral-300'}`}>
                                                        {task.name}
                                                    </span>
                                                </div>
                                                {isSelected ? (
                                                    <span className="text-[8px] font-bold uppercase tracking-widest text-emerald-500">Added</span>
                                                ) : (
                                                    <IconPlus className="text-white" />
                                                )}
                                            </button>
                                        );
                                    })
                                )}
                            </div>
                        </div>
                    </div>
                )}

                {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
            </div>
        </>
    );
};

export default TimeAllocator;
