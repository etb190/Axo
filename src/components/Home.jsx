import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMusic } from '../contexts/MusicContext';
import { useData } from '../contexts/DataContext';
import {
    Wallet, Calendar, BookOpen, Clock, Brain, Globe,
    Target, CheckSquare, Music, List, Play, Pause,
    SkipBack, SkipForward, Book, ArrowUpRight, ArrowDownRight
} from 'lucide-react';
import Navbar from './Navbar';

// --- ELECTRON / NODE.JS IMPORTS ---
// (Imports removed as data is now provided by context)

// --- CONSTANTS & PATHS ---
// (Paths removed as data is now provided by context)

// --- HELPER COMPONENTS ---

const Card = ({ title, icon: Icon, children, className = "", onClick, subValue }) => (
    <div
        onClick={onClick}
        className={`bg-black/40 backdrop-blur-md border border-white/5 rounded-2xl p-5 flex flex-col hover:bg-white/5 transition-all duration-300 group cursor-default min-h-[160px] ${className}`}
    >
        <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
                <div className="p-2 bg-neutral-900 rounded-lg group-hover:bg-neutral-800 transition-colors border border-white/5">
                    <Icon size={16} className="text-neutral-400 group-hover:text-white transition-colors" />
                </div>
                <div>
                    <h3 className="text-xs font-bold uppercase tracking-wider text-neutral-500 group-hover:text-neutral-300 transition-colors">{title}</h3>
                    {subValue && <p className="text-[10px] text-neutral-600 font-mono mt-0.5">{subValue}</p>}
                </div>
            </div>
        </div>
        <div className="flex-1 flex flex-col justify-center">
            {children}
        </div>
    </div>
);

const StatValue = ({ value, label, subtext, trend, color = "text-white" }) => (
    <div>
        <div className={`text-2xl font-bold font-mono tracking-tight ${color}`}>{value}</div>
        <div className="flex items-center gap-2 mt-1">
            <div className="text-[10px] font-bold uppercase tracking-wider text-neutral-500">{label}</div>
            {trend && (
                <div className={`text-[10px] font-bold ${trend > 0 ? 'text-emerald-500' : 'text-rose-500'} flex items-center`}>
                    {trend > 0 ? <ArrowUpRight size={10} /> : <ArrowDownRight size={10} />}
                    {Math.abs(trend)}%
                </div>
            )}
        </div>
        {subtext && <div className="text-[10px] text-neutral-600 mt-1">{subtext}</div>}
    </div>
);

const ProgressBar = ({ progress, color = "bg-emerald-500", trackColor = "bg-neutral-800" }) => (
    <div className={`h-1.5 w-full ${trackColor} rounded-full overflow-hidden`}>
        <div
            className={`h-full ${color} transition-all duration-700 ease-out`}
            style={{ width: `${Math.min(100, Math.max(0, progress))}%` }}
        />
    </div>
);

const Home = () => {
    const navigate = useNavigate();
    const { currentSong, isPlaying, togglePlay, nextSong, prevSong } = useMusic();
    // --- STATE ---
    const { data } = useData();

    const [greeting, setGreeting] = useState('');
    const [currentTime, setCurrentTime] = useState(new Date());


    // --- DATA FETCHING ---
    useEffect(() => {
        const calculateGreeting = () => {
            const hour = new Date().getHours();
            if (hour >= 5 && hour < 12) setGreeting('Good Morning');
            else if (hour >= 12 && hour < 17) setGreeting('Good Afternoon');
            else if (hour >= 17 && hour < 22) setGreeting('Good Evening');
            else setGreeting('Late Night');
        };
        calculateGreeting();

        const timer = setInterval(() => {
            const now = new Date();
            setCurrentTime(now);
        }, 1000); // 1s clock update

        return () => {
            clearInterval(timer);
        };
    }, []);

    // --- AGE CALCULATION ---
    const birthDate = new Date('2003-09-14T00:00:00');
    const getAge = (now) => {
        let years = now.getFullYear() - birthDate.getFullYear();
        let months = now.getMonth() - birthDate.getMonth();
        let days = now.getDate() - birthDate.getDate();

        if (days < 0) {
            months--;
            const lastMonth = new Date(now.getFullYear(), now.getMonth(), 0);
            days += lastMonth.getDate();
        }
        if (months < 0) {
            years--;
            months += 12;
        }

        const currentHours = now.getHours();
        const currentMinutes = now.getMinutes();
        const currentSeconds = now.getSeconds();
        return { years, months, days, hours: currentHours, minutes: currentMinutes, seconds: currentSeconds };
    };

    const age = getAge(currentTime);

    // --- RENDER HELPERS ---
    const formatCurrency = (val) => (
        <>
            {new Intl.NumberFormat('en-US', { style: 'decimal', minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(val)}
            <span className="text-sm text-neutral-500 font-semibold">MAD</span>
        </>
    );
    const formatDate = (date) => date.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
    const formatTime = (date) => date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
    const formatTimeRemaining = (totalMin) => {
        const safeMin = Math.max(0, Math.round(totalMin));
        const h = Math.floor(safeMin / 60);
        const m = safeMin % 60;
        if (h > 0 && m > 0) return `${h}h ${m}m`;
        if (h > 0) return `${h}h`;
        return `${m}m`;
    };



    return (
        <div className="min-h-screen bg-black text-white font-sans selection:bg-emerald-500/30">
            <Navbar />

            <div className="pl-20 pr-8 py-4 max-w-[1920px] mx-auto">
                {/* Header */}
                <header className="flex items-center justify-between mb-4 animate-in fade-in slide-in-from-top-5 duration-700">
                    <div>
                        <h1 className="text-4xl font-bold tracking-tight mb-2">
                            <span className="text-neutral-500 font-light">{greeting}, </span>
                            <span className="text-white">Ahmed</span>
                        </h1>
                        <p className="text-neutral-500 font-mono text-sm flex items-center gap-2">
                            <Calendar size={14} />
                            {formatDate(currentTime)}
                            <span className="w-1 h-1 bg-neutral-700 rounded-full mx-1"></span>
                            <Clock size={14} />
                            {formatTime(currentTime)}
                            <span className="w-1 h-1 bg-neutral-700 rounded-full mx-1"></span>
                            <Brain size={14} className="text-emerald-500/50" />
                            <span className="text-emerald-500 font-bold">
                                {age.years}Y {age.months}M {age.days}D {String(age.hours).padStart(2, '0')}h {String(age.minutes).padStart(2, '0')}m {String(age.seconds).padStart(2, '0')}s
                            </span>
                        </p>
                    </div>
                </header>


                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">

                    {/* 1. MUSIC */}
                    <Card
                        title="Music"
                        icon={Music}
                        className="lg:col-span-1 border-blue-600/10 hover:border-blue-600/30 cursor-pointer"
                        onClick={() => navigate('/Music')}
                    >
                        {currentSong ? (
                            <div className="flex flex-col items-center justify-between h-full py-0">
                                {/* Song Info Detached - Above Cover */}
                                <div className="text-center w-full">
                                    <div className="text-[11px] font-bold text-white truncate uppercase tracking-tight leading-tight">{currentSong.name}</div>
                                    <div className="text-[9px] text-neutral-500 truncate mt-0.5">{currentSong.artist}</div>
                                </div>

                                {/* Cover Art Centered */}
                                <div className="relative w-20 h-20 rounded-xl bg-neutral-900 border border-white/5 overflow-hidden shadow-lg flex-shrink-0 my-1">
                                    {currentSong.thumbnail ? (
                                        <img src={currentSong.thumbnail} alt="Art" className="w-full h-full object-cover" />
                                    ) : (
                                        <div className="w-full h-full flex items-center justify-center bg-neutral-800">
                                            <Music size={24} className="text-neutral-600" />
                                        </div>
                                    )}
                                </div>

                                {/* Controls Below Cover */}
                                <div className="flex items-center justify-center gap-5 w-full mt-1">
                                    <button onClick={(e) => { e.stopPropagation(); prevSong(); }} className="text-neutral-400 hover:text-white transition-colors p-1">
                                        <SkipBack size={18} fill="currentColor" />
                                    </button>
                                    <button onClick={(e) => { e.stopPropagation(); togglePlay(); }} className="w-9 h-9 rounded-full bg-white text-black flex items-center justify-center hover:scale-105 transition-transform shadow-md">
                                        {isPlaying ? <Pause size={16} fill="currentColor" /> : <Play size={16} fill="currentColor" className="ml-0.5" />}
                                    </button>
                                    <button onClick={(e) => { e.stopPropagation(); nextSong(); }} className="text-neutral-400 hover:text-white transition-colors p-1">
                                        <SkipForward size={18} fill="currentColor" />
                                    </button>
                                </div>
                            </div>
                        ) : (
                            <div className="h-full flex flex-col items-center justify-center gap-3 text-center opacity-60">
                                <div className="w-12 h-12 rounded-full bg-neutral-800/50 flex items-center justify-center border border-white/5">
                                    <Music size={20} className="text-neutral-500" />
                                </div>
                                <div>
                                    <div className="text-xs font-bold text-neutral-300">No Music Playing</div>
                                    <div className="text-[10px] text-neutral-500 mt-1">Select a song to start</div>
                                </div>
                            </div>
                        )}
                    </Card>

                    {/* 2. FINANCE */}
                    <Card
                        title="Finance"
                        icon={Wallet}
                        className="lg:col-span-1 border-emerald-500/10 hover:border-emerald-500/30 cursor-pointer"
                        onClick={() => navigate('/Finances')}
                    >
                        <StatValue
                            value={formatCurrency(data.finance.balance)}
                            label="Total Balance"
                            color="text-emerald-400"
                        />
                        <div className="grid grid-cols-2 gap-4 mt-6 pt-4 border-t border-white/5">
                            <div>
                                <div className="text-[10px] font-bold uppercase text-neutral-500 mb-1">Mo. Income</div>
                                <div className="text-white font-mono">{formatCurrency(data.finance.income)}</div>
                            </div>
                            <div>
                                <div className="text-[10px] font-bold uppercase text-neutral-500 mb-1">Mo. Expenses</div>
                                <div className="text-white font-mono">{formatCurrency(data.finance.expenses)}</div>
                            </div>
                        </div>
                    </Card>

                    {/* 3. TIME TRACKER */}
                    <Card
                        title="Time Tracker"
                        icon={Clock}
                        className="lg:col-span-1 border-amber-500/10 hover:border-amber-500/30 cursor-pointer"
                        onClick={() => navigate('/Parentview/timetracker')}
                    >
                        <div className="flex-1 flex flex-col justify-center min-w-0">
                            {data.time.activeSession && data.time.activeTaskName ? (
                                <div className="flex flex-col">
                                    <div className="flex justify-between items-start mb-2">
                                        <span className="text-[9px] font-black uppercase text-amber-500/80 bg-amber-500/10 px-1.5 py-0.5 rounded tracking-widest">Tracking Now</span>
                                        <div className="flex items-center gap-1.5 text-[9px] font-black uppercase tracking-widest text-emerald-500">
                                            <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                                            Active
                                        </div>
                                    </div>
                                    <span className="text-xl font-black text-white uppercase tracking-tight leading-tight mb-2 truncate">
                                        {data.time.activeTaskName}
                                    </span>
                                    <div className="flex items-start gap-2 mt-1">
                                        <div className="flex flex-col">
                                            <span className="text-[8px] font-bold uppercase text-neutral-600 tracking-tighter leading-none mb-0.5">Elapsed</span>
                                            <div className="px-1.5 h-4.5 bg-white/[0.03] rounded border border-white/5 flex items-center shadow-sm">
                                                <span className="text-[10px] font-mono font-bold text-amber-400 tabular-nums leading-none">
                                                    {(() => {
                                                        if (!data.time.activeSessionStart) return '00:00';
                                                        const start = new Date(data.time.activeSessionStart);
                                                        const s = Math.floor((currentTime - start) / 1000);
                                                        const h = Math.floor(s / 3600);
                                                        const m = Math.floor((s % 3600) / 60);
                                                        const sec = s % 60;
                                                        return `${h > 0 ? `${h}:` : ''}${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
                                                    })()}
                                                </span>
                                            </div>
                                        </div>
                                        <div className="flex flex-col">
                                            <span className="text-[8px] font-bold uppercase text-neutral-600 tracking-tighter leading-none mb-0.5">Timeline</span>
                                            <div className="px-1.5 h-4.5 bg-white/[0.03] rounded border border-white/5 flex items-center shadow-sm">
                                                <span className="text-[10px] font-mono font-bold text-neutral-400 tabular-nums leading-none">
                                                    {(() => {
                                                        const start = new Date(data.time.activeSessionStart);
                                                        const format = (d) => `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
                                                        return `${format(start)} — ${format(currentTime)}`;
                                                    })()}
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            ) : (
                                <div className="flex flex-col items-center justify-center py-4 bg-white/[0.02] rounded-xl border border-dashed border-white/5 opacity-40">
                                    <Clock size={16} className="mb-1 text-neutral-500" />
                                    <span className="text-[10px] font-bold uppercase tracking-widest text-neutral-600">IDLE — NO SESSION</span>
                                </div>
                            )}
                        </div>

                        <div className="mt-4 pt-4 border-t border-white/5 flex items-center justify-between">
                            <div className="flex flex-col">
                                <span className="text-[10px] uppercase font-bold text-neutral-500">Logged Today</span>
                                <div className="text-lg font-bold font-mono text-amber-400 mt-0.5">
                                    {(data.time.todayLogged / 3600).toFixed(1)}<span className="text-xs ml-0.5">h</span>
                                </div>
                            </div>
                            <div className="text-[9px] text-neutral-600 font-bold uppercase tracking-widest bg-white/[0.03] px-2 py-1 rounded-md border border-white/5">
                                Analytics
                            </div>
                        </div>
                    </Card>

                    {/* 4. PLANNER */}
                    <Card
                        title="Day Planner"
                        icon={Calendar}
                        className="lg:col-span-1 border-blue-500/10 hover:border-blue-500/30 cursor-pointer h-[240px]"
                        onClick={() => navigate('/Parentview/dayplanner')}
                    >
                        <div className="h-full flex flex-col justify-between py-1">
                            {data.planner.currentTask ? (() => {
                                let currentMinutes = currentTime.getHours() * 60 + currentTime.getMinutes();
                                if (currentTime.getHours() < 5) {
                                    currentMinutes += 1440;
                                }
                                const task = data.planner.currentTask;
                                const remaining = Math.max(0, task.endMinutes - currentMinutes);
                                const duration = task.endMinutes - task.startMinutes;
                                const formatMins = (m) => {
                                    const h = Math.floor(m / 60) % 24;
                                    const mins = m % 60;
                                    return `${String(h).padStart(2, '0')}:${String(mins).padStart(2, '0')}`;
                                };

                                return (
                                    <div className="space-y-3">
                                        <div>
                                             <div className="flex justify-between items-start mb-1.5">
                                                 <span className="text-[9px] font-black uppercase text-blue-400 bg-blue-400/10 px-1.5 py-0.5 rounded tracking-widest">Active Now</span>
                                                 <span className="text-[10px] font-bold text-blue-500/80 font-mono">{formatTimeRemaining(remaining)} left</span>
                                             </div>
                                             <div className="text-sm font-bold leading-tight line-clamp-1">{task.taskName}</div>
                                             <div className="flex items-center gap-2 mt-1 text-[9px] text-neutral-500 font-bold uppercase tracking-tighter">
                                                 <span>{formatMins(task.startMinutes)} — {formatMins(task.endMinutes)}</span>
                                                 <span className="w-1 h-1 bg-neutral-700 rounded-full"></span>
                                                 <span>{formatTimeRemaining(duration)}</span>
                                             </div>
                                        </div>
                                        <div className="h-px bg-white/5" />
                                    </div>
                                );
                            })() : (
                                <div className="flex flex-col items-center justify-center py-4 bg-white/[0.02] rounded-xl border border-dashed border-white/5 opacity-40">
                                    <CheckSquare size={16} className="mb-1 text-neutral-500" />
                                    <span className="text-[10px] font-bold uppercase tracking-widest text-neutral-600">No Active Task</span>
                                </div>
                            )}

                            {data.planner.nextTask ? (() => {
                                let currentMinutes = currentTime.getHours() * 60 + currentTime.getMinutes();
                                if (currentTime.getHours() < 5) {
                                    currentMinutes += 1440;
                                }
                                const task = data.planner.nextTask;
                                let wait = task.startMinutes - currentMinutes;
                                if (wait < 0) {
                                    wait = (wait + 1440) % 1440;
                                }
                                const duration = task.endMinutes - task.startMinutes;
                                const formatMins = (m) => {
                                    const h = Math.floor(m / 60) % 24;
                                    const mins = m % 60;
                                    return `${String(h).padStart(2, '0')}:${String(mins).padStart(2, '0')}`;
                                };

                                return (
                                    <div className="mt-auto">
                                        <div className="flex justify-between items-center mb-1.5">
                                            <div className="text-[9px] text-neutral-500 uppercase font-black tracking-widest">Coming Up</div>
                                            <div className="text-[9px] text-neutral-600 font-mono font-bold">In {formatTimeRemaining(wait)}</div>
                                        </div>
                                        <div className="text-xs font-semibold text-neutral-300 truncate">{task.taskName}</div>
                                        <div className="flex items-center gap-2 mt-1 text-[8px] text-neutral-600 font-bold uppercase tracking-tighter">
                                            <span>{formatMins(task.startMinutes)} — {formatMins(task.endMinutes)}</span>
                                            <span className="w-0.5 h-0.5 bg-neutral-800 rounded-full"></span>
                                            <span>{formatTimeRemaining(duration)}</span>
                                        </div>
                                    </div>
                                );
                            })() : (
                                <div className="text-[10px] text-neutral-600 italic mt-auto text-center opacity-40">
                                    No more tasks today
                                </div>
                            )}
                        </div>
                    </Card>

                    {/* 5. READING */}
                    <Card
                        title="Reading"
                        icon={BookOpen}
                        className="lg:col-span-1 border-orange-500/10 hover:border-orange-500/30 cursor-pointer h-[240px]"
                        onClick={() => navigate('/Books/books')}
                    >
                        <div className="h-full flex flex-col justify-between relative group/book">
                            {data.reading.cover && (
                                <div
                                    className="absolute inset-0 opacity-10 blur-xl scale-110 pointer-events-none"
                                    style={{ backgroundImage: `url(${data.reading.cover})`, backgroundSize: 'cover', backgroundPosition: 'center' }}
                                />
                            )}
                            <div className="flex gap-4 relative z-10">
                                <div className="w-16 h-24 bg-neutral-900 rounded-lg border border-white/5 overflow-hidden flex-shrink-0 shadow-lg">
                                    {data.reading.cover ? (
                                        <img src={data.reading.cover} alt="Cover" className="w-full h-full object-cover" />
                                    ) : (
                                        <div className="w-full h-full flex items-center justify-center text-neutral-700">
                                            <Book size={20} />
                                        </div>
                                    )}
                                </div>
                                <div className="flex flex-col justify-center relative group/peek">
                                    <div className="text-[10px] font-bold uppercase text-neutral-500 mb-1">Currently Reading</div>
                                    <div className="text-sm font-bold text-white line-clamp-2 leading-tight">
                                        {data.reading.currentBook || "No active book"}
                                    </div>
                                    
                                    {/* Peek Tooltip */}
                                    {data.reading.currentBook && (
                                        <div className="absolute bottom-full left-0 mb-2 w-max max-w-[200px] pointer-events-none opacity-0 group-hover/peek:opacity-100 translate-y-2 group-hover/peek:translate-y-0 transition-all duration-300 z-[150]">
                                            <div className="bg-[#0c0c0c]/95 backdrop-blur-xl border border-white/10 rounded-xl p-2.5 shadow-2xl">
                                                <p className="text-[10px] font-medium text-white leading-relaxed break-words">{data.reading.currentBook}</p>
                                                <div className="absolute top-full left-4 -mt-1 w-2 h-2 bg-[#0c0c0c] border-r border-b border-white/10 rotate-45" />
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>
                            <div className="mt-4 relative z-10">
                                <div className="flex justify-between items-end mb-1">
                                    <span className="text-[10px] font-bold text-neutral-600">Progress</span>
                                    <span className="text-[10px] font-bold text-orange-400">{data.reading.progress}%</span>
                                </div>
                                <ProgressBar progress={data.reading.progress} color="bg-orange-500" />
                            </div>
                        </div>
                    </Card>

                    {/* 6. TASKS (TODOS) */}
                    <Card
                        title="Tasks"
                        icon={List}
                        className="lg:col-span-1 border-pink-500/10 hover:border-pink-500/30 cursor-pointer h-[240px]"
                        onClick={() => navigate('/Parentview/todos')}
                    >
                        <div className="h-full flex flex-col gap-2">
                            {data.todos.topTasks.length > 0 ? (
                                data.todos.topTasks.map(task => (
                                    <div key={task.id} className="flex items-center gap-3 py-2 border-b border-white/5 last:border-0 group/task">
                                        <div className={`w-2 h-2 rounded-full flex-shrink-0 ${task.priority === 'high' ? 'bg-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.5)]' :
                                            task.priority === 'medium' ? 'bg-yellow-500' : 'bg-blue-500'
                                            }`} />
                                        <div className="text-sm font-semibold text-neutral-200 group-hover/task:text-white transition-colors truncate flex-1">
                                            {task.title}
                                        </div>
                                    </div>
                                ))
                            ) : (
                                <div className="text-xs text-neutral-500 italic text-center my-auto">No pending tasks</div>
                            )}
                        </div>
                        <div className="mt-2 text-[9px] text-neutral-600 text-right uppercase tracking-widest font-bold">
                            Top Priorities
                        </div>
                    </Card>

                    {/* 7. GOALS */}
                    <Card
                        title="Active Goals"
                        icon={Target}
                        className="lg:col-span-1 border-rose-500/10 hover:border-rose-500/30 cursor-pointer h-[240px]"
                        onClick={() => navigate('/Growth/goals')}
                        subValue={`${data.goals.activeGoals} IN PROGRESS`}
                    >
                        <div className="flex flex-col gap-4">
                            {data.goals.topGoals.length > 0 ? (
                                data.goals.topGoals.map((goal, idx) => (
                                    <div key={idx} className="space-y-1.5">
                                        <div className="flex justify-between items-center text-[10px] uppercase font-bold tracking-wider">
                                            <span className="text-neutral-400 truncate max-w-[150px]">{goal.name}</span>
                                            <span className="text-rose-400 font-mono italic">{goal.progress || 0}%</span>
                                        </div>
                                        <ProgressBar progress={goal.progress || 0} color="bg-rose-500" />
                                    </div>
                                ))
                            ) : (
                                <div className="text-xs text-neutral-500 italic text-center py-4">No active goals</div>
                            )}
                        </div>
                    </Card>

                    {/* 8. LEXICON (VOCAB) */}
                    <Card
                        title="LexiCon"
                        icon={Globe}
                        className="lg:col-span-1 border-cyan-500/10 hover:border-cyan-500/30 cursor-pointer h-[240px]"
                        onClick={() => navigate('/Language/lexicon')}
                    >
                        <div className="space-y-3">
                            {data.lexicon.recentWords.length > 0 ? (
                                data.lexicon.recentWords.slice(0, 4).map((word, idx) => (
                                    <div key={idx} className="flex items-center group/word">
                                        <div className="text-sm font-bold text-cyan-400 group-hover/word:text-cyan-300 transition-colors">
                                            {word.advanced}
                                        </div>
                                    </div>
                                ))
                            ) : (
                                <div className="text-xs text-neutral-500 italic">No recent words found</div>
                            )}
                        </div>
                    </Card>

                    {/* 9. SKILLS */}
                    <Card
                        title="Skill Phases"
                        icon={Brain}
                        className="lg:col-span-1 border-purple-500/10 hover:border-purple-500/30 cursor-pointer h-[240px]"
                        onClick={() => navigate('/Growth/skills')}
                    >
                        <div className="flex flex-col gap-3">
                            {data.skills.phases.length > 0 ? (
                                data.skills.phases.map((phase, idx) => (
                                    <div key={idx} className="space-y-1">
                                        <div className="flex justify-between items-center text-[10px] uppercase font-bold tracking-wider">
                                            <span className="text-neutral-400 truncate max-w-[150px]">{phase.name}</span>
                                            <span className="text-purple-400">{phase.progress}%</span>
                                        </div>
                                        <ProgressBar progress={phase.progress} color="bg-purple-500" />
                                    </div>
                                ))
                            ) : (
                                <div className="text-xs text-neutral-500 italic text-center py-4">No active phases</div>
                            )}
                        </div>
                    </Card>

                </div>
            </div>
        </div>
    );
};

export default Home;
