import React, { useState, useEffect, useMemo } from 'react';
const fs = window.require('fs').promises;
const path = window.require('path');

import TargetIcon from '../../assets/icons/goals.svg';
import CalendarIcon from '../../assets/icons/calendar.svg';
import ClockIcon from '../../assets/icons/clock.svg';
import BookIcon from '../../assets/icons/book.svg';
import PlusIcon from '../../assets/icons/plus.svg';
import CheckIcon from '../../assets/icons/check.svg';
import EditIcon from '../../assets/icons/edit.svg';

const GOAL_FILE = 'C:\\Users\\PC\\Desktop\\database\\Books\\reading_goal.json';

const ReadingGoal = () => {
    const [goal, setGoal] = useState(null);
    const [isEditing, setIsEditing] = useState(false);
    const [isUpdatingProgress, setIsUpdatingProgress] = useState(false);
    const [newProgress, setNewProgress] = useState('');

    const [formData, setFormData] = useState({
        totalPages: '',
        deadline: '',
        currentPages: 0
    });

    useEffect(() => {
        loadGoal();
    }, []);

    const loadGoal = async () => {
        try {
            const data = await fs.readFile(GOAL_FILE, 'utf8');
            setGoal(JSON.parse(data));
        } catch (e) {
            console.log('No goal found');
        }
    };

    const saveGoal = async (goalData) => {
        try {
            await fs.writeFile(GOAL_FILE, JSON.stringify(goalData, null, 2));
            setGoal(goalData);
            setIsEditing(false);
            setIsUpdatingProgress(false);
        } catch (e) {
            console.error('Failed to save goal', e);
        }
    };

    const handleCreateGoal = () => {
        if (!formData.totalPages || !formData.deadline) return;
        const newGoal = {
            totalPages: parseInt(formData.totalPages),
            deadline: formData.deadline,
            currentPages: 0,
            createdAt: new Date().toISOString()
        };
        saveGoal(newGoal);
    };

    const handleUpdateProgress = () => {
        const addedPages = parseInt(newProgress);
        if (isNaN(addedPages)) return;

        const updatedGoal = {
            ...goal,
            currentPages: (goal.currentPages || 0) + addedPages
        };
        saveGoal(updatedGoal);
        setNewProgress('');
    };

    const stats = useMemo(() => {
        if (!goal) return null;

        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const deadline = new Date(goal.deadline);
        deadline.setHours(23, 59, 59, 999);

        const diffMs = deadline - today;
        const daysLeft = Math.max(0, Math.ceil(diffMs / (1000 * 60 * 60 * 24)));
        const pagesLeft = Math.max(0, goal.totalPages - goal.currentPages);

        const startDate = new Date(goal.createdAt || today);
        startDate.setHours(0, 0, 0, 0);
        const totalDurationMs = deadline - startDate;
        const totalDays = Math.max(1, Math.ceil(totalDurationMs / (1000 * 60 * 60 * 24)));
        const pagesPerDay = Math.ceil(goal.totalPages / totalDays);

        const progressPercent = Math.min(100, Math.round((goal.currentPages / goal.totalPages) * 100));

        return {
            daysLeft,
            pagesLeft,
            pagesPerDay,
            progressPercent,
            isOverdue: diffMs < 0 && pagesLeft > 0
        };
    }, [goal]);

    if (!goal && !isEditing) {
        return (
            <div className="bg-white/[0.02] border border-white/5 rounded-2xl p-4 flex items-center justify-between hover:bg-white/[0.04] transition-all duration-300">
                <div className="flex items-center gap-4">
                    <div className="w-10 h-10 bg-blue-500/10 rounded-xl flex items-center justify-center border border-blue-500/20">
                        <img src={TargetIcon} className="w-5 h-5 filter-blue" style={{ filter: 'invert(60%) sepia(61%) saturate(3685%) hue-rotate(195deg) brightness(102%) contrast(102%)' }} />
                    </div>
                    <div>
                        <h3 className="text-sm font-bold text-white">Active Reading Goal</h3>
                        <p className="text-gray-500 text-[11px]">Set a target to track your daily reading speed.</p>
                    </div>
                </div>
                <button
                    onClick={() => setIsEditing(true)}
                    className="bg-blue-500 hover:bg-blue-400 text-white px-4 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer"
                >
                    Create Goal
                </button>
            </div>
        );
    }

    if (isEditing) {
        return (
            <div className="bg-[#0a0a0a] border border-white/10 rounded-2xl p-5 space-y-4">
                <div className="flex items-center justify-between">
                    <h3 className="text-sm font-bold text-white">Configure Reading Goal</h3>
                    <button onClick={() => setIsEditing(false)} className="text-gray-500 hover:text-white transition-colors text-xs cursor-pointer">
                        Cancel
                    </button>
                </div>

                <div className="flex gap-4">
                    <div className="flex-1">
                        <label className="block text-[9px] font-black tracking-widest text-gray-500 uppercase mb-1">Total Pages</label>
                        <input
                            type="number"
                            value={formData.totalPages}
                            onChange={(e) => setFormData({ ...formData, totalPages: e.target.value })}
                            placeholder="e.g. 500"
                            className="w-full bg-white/[0.03] border border-white/10 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-blue-500/50"
                        />
                    </div>
                    <div className="flex-1">
                        <label className="block text-[9px] font-black tracking-widest text-gray-500 uppercase mb-1">Deadline</label>
                        <input
                            type="date"
                            value={formData.deadline}
                            onChange={(e) => setFormData({ ...formData, deadline: e.target.value })}
                            className="w-full bg-white/[0.03] border border-white/10 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-blue-500/50"
                        />
                    </div>
                </div>

                <button
                    onClick={handleCreateGoal}
                    className="w-full bg-blue-500 hover:bg-blue-400 text-white py-2 rounded-lg text-xs font-bold transition-all shadow-lg shadow-blue-500/20 cursor-pointer"
                >
                    {goal ? 'Update Goal' : 'Start Tracker'}
                </button>
            </div>
        );
    }

    return (
        <div className="group relative bg-[#0a0a0a]/40 backdrop-blur-md rounded-2xl border border-white/5 p-4 transition-all duration-300">
            <div className="flex flex-col gap-4">
                {/* Top bar: Title and Action */}
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-blue-500/10 flex items-center justify-center border border-blue-500/10">
                            <img src={TargetIcon} className="w-4 h-4 filter-blue" style={{ filter: 'invert(60%) sepia(61%) saturate(3685%) hue-rotate(195deg) brightness(102%) contrast(102%)' }} />
                        </div>
                        <div>
                            <div className="flex items-center gap-2">
                                <span className="text-xs font-bold text-white uppercase tracking-tight">Daily Reading Goal</span>
                                <span className="text-[10px] bg-blue-500/20 text-blue-400 px-1.5 py-0.5 rounded font-black tracking-tighter">
                                    {stats.pagesPerDay} PGS/DAY
                                </span>
                            </div>
                        </div>
                    </div>
                    <div className="flex items-center gap-1.5">
                        {!isUpdatingProgress ? (
                            <button
                                onClick={() => {
                                    setIsUpdatingProgress(true);
                                    setNewProgress('');
                                }}
                                className="flex items-center gap-1.5 px-3 py-1 bg-white/5 hover:bg-white/10 rounded-lg text-[10px] font-bold text-white transition-all border border-white/5 cursor-pointer"
                            >
                                <img src={PlusIcon} className="w-2.5 h-2.5 invert" />
                                ADD PAGES
                            </button>
                        ) : (
                            <div className="flex items-center gap-1.5 animate-fadeIn">
                                <input
                                    type="number"
                                    value={newProgress}
                                    onChange={(e) => setNewProgress(e.target.value)}
                                    placeholder="+ Pages"
                                    className="w-16 bg-white/10 border border-blue-500/50 rounded-lg px-2 py-1 text-[10px] text-white focus:outline-none placeholder:text-white/40"
                                    autoFocus
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter') handleUpdateProgress();
                                        if (e.key === 'Escape') setIsUpdatingProgress(false);
                                    }}
                                />
                                <button onClick={handleUpdateProgress} className="p-1 bg-blue-500 hover:bg-blue-400 rounded transition-colors cursor-pointer">
                                    <img src={CheckIcon} className="w-3 h-3 invert" />
                                </button>
                                <button onClick={() => setIsUpdatingProgress(false)} className="text-gray-500 hover:text-white px-1 text-[10px] cursor-pointer">✕</button>
                            </div>
                        )}
                        <button
                            onClick={() => {
                                setFormData({ totalPages: goal.totalPages, deadline: goal.deadline, currentPages: goal.currentPages });
                                setIsEditing(true);
                            }}
                            className="px-3 py-1 bg-white/5 hover:bg-white/10 rounded-lg text-[10px] font-bold text-white transition-all border border-white/5 uppercase tracking-widest cursor-pointer"
                        >
                            Edit
                        </button>
                    </div>
                </div>

                {/* Progress Bar and Summary */}
                <div className="space-y-2">
                    <div className="flex justify-between items-end">
                        <div className="flex gap-4">
                            <div className="flex flex-col">
                                <span className="text-[9px] font-bold text-zinc-500 uppercase tracking-widest">Progress</span>
                                <span className="text-xs font-black text-white">{goal.currentPages} <span className="text-[10px] text-zinc-600 font-normal">/ {goal.totalPages} Pgs</span> <span className="text-[10px] text-blue-400 font-bold ml-1">({stats.progressPercent}%)</span></span>
                            </div>
                            <div className="flex flex-col border-l border-white/5 pl-4">
                                <span className="text-[9px] font-bold text-zinc-500 uppercase tracking-widest">Remaining</span>
                                <span className="text-xs font-black text-white">{stats.pagesLeft} <span className="text-[10px] text-zinc-600 font-normal">Pgs</span></span>
                            </div>
                            <div className="flex flex-col border-l border-white/5 pl-4">
                                <span className="text-[9px] font-bold text-zinc-500 uppercase tracking-widest">Deadline</span>
                                <div className="flex items-baseline gap-1.5">
                                    <span className={`text-xs font-black ${stats.isOverdue ? 'text-red-400' : 'text-emerald-500'}`}>
                                        {stats.daysLeft} <span className="text-[9px] text-emerald-500/50 font-normal uppercase tracking-tighter">Days Left</span>
                                    </span>
                                    <span className="text-[9px] font-bold text-zinc-600 uppercase tracking-tighter">
                                        ({new Date(goal.deadline).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })})
                                    </span>
                                </div>
                            </div>
                        </div>
                        <div className="text-[10px] font-black text-blue-400 tracking-tighter">
                            {stats.progressPercent}% COMPLETE
                        </div>
                    </div>

                    <div className="relative h-1.5 w-full bg-white/5 rounded-full overflow-hidden">
                        <div
                            className="absolute inset-y-0 left-0 bg-gradient-to-r from-blue-600 to-blue-400 transition-all duration-1000 ease-out rounded-full"
                            style={{ width: `${stats.progressPercent}%` }}
                        />
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ReadingGoal;
