import React, { useState, useEffect } from 'react';
import chevronLeftIcon from '../assets/icons/chevron-left.svg';
import clockIcon from '../assets/icons/clock.svg';
import goalsIcon from '../assets/icons/goals.svg';
import checkIcon from '../assets/icons/check.svg';
import journalIcon from '../assets/icons/journal.svg';
// Local icons replacement
const ArrowLeft = ({ size = 16 }) => <LocalIcon src={chevronLeftIcon} size={size} className="text-zinc-500 hover:text-white" />;
const Clock = ({ size = 12 }) => <LocalIcon src={clockIcon} size={size} className="text-zinc-500" />;
const Target = ({ size = 14 }) => <LocalIcon src={goalsIcon} size={size} className="text-blue-500" />;
const CheckSquare = ({ size = 14, className }) => <LocalIcon src={checkIcon} size={size} className={`text-emerald-500 ${className}`} />;
const FileText = ({ size = 14 }) => <LocalIcon src={journalIcon} size={size} className="text-zinc-500" />;

const fs = window.require('fs').promises;
const path = window.require('path');

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

const DB_DIR = 'C:\\Users\\PC\\Desktop\\Database\\DayPlanner';
const PLANS_FILE = path.join(DB_DIR, 'session_plans.json');

const TaskDetailer = ({ event, currentMinutes, onBack, onEditOriginal }) => {
    const [plan, setPlan] = useState({
        goal: '',
        checklist: [],
        notes: ''
    });
    const [newItem, setNewItem] = useState('');
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        loadPlan();
    }, [event.id]);

    const loadPlan = async () => {
        try {
            await fs.mkdir(DB_DIR, { recursive: true });
            const data = await fs.readFile(PLANS_FILE, 'utf-8').catch(() => '{}');
            const allPlans = JSON.parse(data);
            if (allPlans[event.id]) {
                setPlan(allPlans[event.id]);
            }
        } catch (err) {
            console.error("Failed to load plan", err);
        } finally {
            setLoading(false);
        }
    };

    const savePlan = async (newPlanState) => {
        const planToSave = newPlanState || plan;
        setPlan(planToSave);

        try {
            await fs.mkdir(DB_DIR, { recursive: true });
            const data = await fs.readFile(PLANS_FILE, 'utf-8').catch(() => '{}');
            const allPlans = JSON.parse(data);
            allPlans[event.id] = planToSave;
            await fs.writeFile(PLANS_FILE, JSON.stringify(allPlans, null, 2));
        } catch (err) {
            console.error("Failed to save plan", err);
        }
    };

    const addItem = (e) => {
        if (e.key === 'Enter' && newItem.trim()) {
            const updated = {
                ...plan,
                checklist: [...plan.checklist, { id: Date.now(), text: newItem.trim(), done: false }]
            };
            setNewItem('');
            savePlan(updated);
        }
    };

    const toggleItem = (id) => {
        const updated = {
            ...plan,
            checklist: plan.checklist.map(item =>
                item.id === id ? { ...item, done: !item.done } : item
            )
        };
        savePlan(updated);
    };

    const getFormattedDuration = (totalMin) => {
        const h = Math.floor(totalMin / 60);
        const m = Math.round(totalMin % 60);
        if (h > 0 && m > 0) return `${h}h ${m}m`;
        if (h > 0) return `${h}h`;
        return `${m}m`;
    };
    const durationMins = (event.endMinutes && event.startMinutes) ? (event.endMinutes - event.startMinutes) : 0;
    const duration = getFormattedDuration(durationMins);

    const formatTime = (minutes) => {
        if (minutes === undefined || minutes === null) return '';
        const h = Math.floor(minutes / 60);
        const m = (minutes % 60).toString().padStart(2, '0');
        return `${h}:${m}`;
    };

    const getStatus = () => {
        if (!currentMinutes || event.startMinutes === undefined) return null;
        if (currentMinutes < event.startMinutes) {
            const diff = event.startMinutes - currentMinutes;
            return { text: `Starts in ${getFormattedDuration(diff)}`, color: 'text-zinc-500' };
        }
        if (currentMinutes >= event.startMinutes && currentMinutes < event.endMinutes) {
            const diff = event.endMinutes - currentMinutes;
            return { text: `${getFormattedDuration(diff)} left`, color: 'text-emerald-400' };
        }
        return { text: 'Ended', color: 'text-zinc-500' };
    };

    const status = getStatus();

    return (
        <div className="pl-15 fixed inset-0 z-50 bg-black text-white flex flex-col font-sans animate-in slide-in-from-right duration-300">
            {/* Header */}
            <div className="h-16 border-b border-white/10 flex items-center justify-between px-6 bg-zinc-950">
                <div className="flex items-center gap-4">
                    <button
                        onClick={onBack}
                        className="flex items-center gap-2 px-3 py-1.5 hover:bg-white/10 rounded-lg transition-colors text-zinc-400 hover:text-white text-sm font-medium cursor-pointer"
                    >
                        <ArrowLeft size={16} />
                        Back
                    </button>
                    <div className="h-6 w-px bg-white/10 mx-2"></div>
                    <div>
                        <h1 className="text-xl font-bold flex items-center gap-2">
                            <span className="w-3 h-3 rounded-full" style={{ background: event.color }}></span>
                            {event.taskName}
                        </h1>
                        {(event.startMinutes !== undefined && event.endMinutes !== undefined) && (
                            <div className="flex items-center gap-4 text-xs text-zinc-500 font-mono mt-0.5">
                                <span className="flex items-center gap-1">
                                    <Clock size={12} />
                                    {formatTime(event.startMinutes)} - {formatTime(event.endMinutes)} ({duration})
                                </span>
                                {status && (
                                    <>
                                        <span className="text-zinc-700">•</span>
                                        <span className={`font-bold ${status.color}`}>{status.text}</span>
                                    </>
                                )}
                            </div>
                        )}
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <button
                        onClick={onEditOriginal}
                        className="px-3 py-1.5 text-xs font-medium text-zinc-400 hover:text-white hover:bg-white/5 rounded border border-transparent hover:border-white/10 transition-all cursor-pointer"
                    >
                        Edit Properties
                    </button>
                </div>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-8 max-w-4xl mx-auto w-full">
                <div className="space-y-8">

                    {/* Primary Goal */}
                    <div className="space-y-2">
                        <label className="text-xs font-bold uppercase tracking-widest text-zinc-500 flex items-center gap-2">
                            <Target size={14} /> session goal
                        </label>
                        <input
                            type="text"
                            value={plan.goal}
                            onChange={(e) => savePlan({ ...plan, goal: e.target.value })}
                            placeholder="What is the one main thing you want to achieve?"
                            className="w-full bg-zinc-900/50 border border-white/5 rounded-xl px-4 py-4 text-lg focus:outline-none focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/50 transition-all"
                        />
                    </div>

                    {/* Checklist */}
                    <div className="space-y-3">
                        <label className="text-xs font-bold uppercase tracking-widest text-zinc-500 flex items-center gap-2">
                            <CheckSquare size={14} /> Execution Steps
                        </label>
                        <div className="bg-zinc-900/30 border border-white/5 rounded-xl overflow-hidden">
                            {plan.checklist.map(item => (
                                <div key={item.id} className="group flex items-center gap-3 p-3 border-b border-white/5 hover:bg-white/5 transition-colors">
                                    <button
                                        onClick={() => toggleItem(item.id)}
                                        className={`w-5 h-5 rounded border flex items-center justify-center transition-all cursor-pointer ${item.done ? 'bg-blue-600 border-blue-600' : 'border-zinc-600 hover:border-zinc-400'}`}
                                    >
                                        {item.done && <CheckSquare size={12} className="text-white" />}
                                    </button>
                                    <span className={`flex-1 ${item.done ? 'text-zinc-600 line-through' : 'text-zinc-200'}`}>
                                        {item.text}
                                    </span>
                                    <button
                                        onClick={() => savePlan({ ...plan, checklist: plan.checklist.filter(i => i.id !== item.id) })}
                                        className="opacity-0 group-hover:opacity-100 p-1 text-zinc-500 hover:text-red-400 transition-all cursor-pointer"
                                    >
                                        <div className="h-4 w-4">×</div>
                                    </button>
                                </div>
                            ))}
                            <div className="p-3">
                                <input
                                    type="text"
                                    value={newItem}
                                    onChange={(e) => setNewItem(e.target.value)}
                                    onKeyDown={addItem}
                                    placeholder="+ Add step (Press Enter)"
                                    className="w-full bg-transparent border-none outline-none text-sm placeholder-zinc-600"
                                />
                            </div>
                        </div>
                    </div>

                    {/* Notes */}
                    <div className="space-y-2">
                        <label className="text-xs font-bold uppercase tracking-widest text-zinc-500 flex items-center gap-2">
                            <FileText size={14} /> Session Notes
                        </label>
                        <textarea
                            value={plan.notes}
                            onChange={(e) => savePlan({ ...plan, notes: e.target.value })}
                            placeholder="Ideas, blockers, reminders..."
                            className="w-full h-40 bg-zinc-900/50 border border-white/5 rounded-xl p-4 text-sm focus:outline-none focus:border-blue-500/50 resize-none"
                        />
                    </div>

                </div>
            </div>
        </div>
    );
};

export default TaskDetailer;
