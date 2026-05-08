import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { useData } from '../contexts/DataContext';
import Navbar from './Navbar';

import {
    TrendingUp,
    TrendingDown,
    Wallet,
    Plus,
    Search,
    Filter,
    ArrowUpRight,
    ArrowDownLeft,
    Calendar,
    Tag,
    Briefcase,
    PieChart as PieIcon,
    Trash2,
    X,
    Target as TargetIcon,
    ChevronRight,
    Shield,
    CreditCard,
    Zap,
    Activity,
    Edit2,
    Check
} from 'lucide-react';
import {
    AreaChart,
    Area,
    XAxis,
    YAxis,
    Tooltip,
    ResponsiveContainer,
    Cell,
    PieChart,
    Pie
} from 'recharts';

// --- ELECTRON / NODE.JS PERSISTENCE CONFIG ---
const fs = window.require('fs').promises;
const path = window.require('path');
const BASE_DB = 'C:\\Users\\PC\\Desktop\\database';
const FINANCES_DIR = path.join(BASE_DB, 'Finances');
const DATA_FILE = path.join(FINANCES_DIR, 'data.json');
const CATEGORIES_FILE = path.join(FINANCES_DIR, 'categories.json');

const FinanceTracker = () => {
    // --- STATE ---
    const { data, refreshData } = useData();
    const [transactions, setTransactions] = useState([]);
    const [budgets, setBudgets] = useState([]);
    const [savingsGoals, setSavingsGoals] = useState([]);
    // const [isLoading, setIsLoading] = useState(true); // Handled by context

    const [showAddModal, setShowAddModal] = useState(false);
    const [editingCategory, setEditingCategory] = useState(null);
    const [editValue, setEditValue] = useState('');
    const [confirmation, setConfirmation] = useState({ show: false, message: '', onConfirm: null });
    const [searchTerm, setSearchTerm] = useState('');
    const [activeTab, setActiveTab] = useState('overview');
    const [categories, setCategories] = useState([]); // Will store { name, type }
    const [editingTransaction, setEditingTransaction] = useState(null);


    // --- IO / PERSISTENCE ---
    useEffect(() => {
        if (data.finance && data.finance.fullData) {
            setTransactions(data.finance.fullData.transactions || []);
            setBudgets(data.finance.fullData.budgets || []);
            setSavingsGoals(data.finance.fullData.savingsGoals || []);

            // Migrate old string categories to objects if necessary
            const rawCategories = data.finance.fullData.categories || [];
            const migratedCategories = rawCategories.map(cat =>
                typeof cat === 'string' ? { name: cat, type: 'expense' } : cat
            );
            setCategories(migratedCategories);
        }
    }, [data.finance]);

    const saveData = async (t, b, s, c) => {
        try {
            await fs.mkdir(FINANCES_DIR, { recursive: true });

            // Save main financial data
            const financialPayload = {
                transactions: t,
                budgets: b,
                savingsGoals: s,
                lastUpdated: new Date().toISOString()
            };
            const tempFinancialPath = DATA_FILE + '.tmp';
            await fs.writeFile(tempFinancialPath, JSON.stringify(financialPayload, null, 2), 'utf8');
            await fs.rename(tempFinancialPath, DATA_FILE);

            // Save categories data separately
            const tempCategoriesPath = CATEGORIES_FILE + '.tmp';
            await fs.writeFile(tempCategoriesPath, JSON.stringify(c, null, 2), 'utf8');
            await fs.rename(tempCategoriesPath, CATEGORIES_FILE);

            refreshData(); // Sync with context
        } catch (e) {
            console.error("Critical error during finance database write:", e);
        }
    };

    // --- Analytical Computations ---
    const metrics = useMemo(() => {
        const income = transactions.filter(t => t.type === 'income').reduce((a, b) => a + b.amount, 0);
        const expenses = transactions.filter(t => t.type === 'expense').reduce((a, b) => a + b.amount, 0);
        return { balance: income - expenses, income, expenses };
    }, [transactions]);

    const historicalData = useMemo(() => {
        if (transactions.length === 0) return [];
        const sorted = [...transactions].sort((a, b) => new Date(a.date) - new Date(b.date));
        let runningBalance = 0;
        return sorted.map(t => {
            runningBalance += t.type === 'income' ? t.amount : -t.amount;
            return { date: t.date, value: runningBalance };
        });
    }, [transactions]);

    const categoryMix = useMemo(() => {
        const map = {};
        transactions.filter(t => t.type === 'expense').forEach(t => {
            map[t.category] = (map[t.category] || 0) + t.amount;
        });
        return Object.entries(map).map(([name, value]) => ({ name, value }));
    }, [transactions]);

    // --- Actions ---
    const addTransaction = (t) => {
        let newTransactions;
        if (t.id && transactions.some(trans => trans.id === t.id)) {
            newTransactions = transactions.map(trans => trans.id === t.id ? t : trans);
        } else {
            newTransactions = [t, ...transactions];
        }
        setTransactions(newTransactions);
        saveData(newTransactions, budgets, savingsGoals, categories);
        setShowAddModal(false);
        setEditingTransaction(null);
    };

    const deleteTransaction = (id) => {
        setConfirmation({
            show: true,
            message: "Permamently remove this transaction?",
            onConfirm: () => {
                const newTransactions = transactions.filter(t => t.id !== id);
                setTransactions(newTransactions);
                saveData(newTransactions, budgets, savingsGoals, categories);
                setConfirmation({ show: false, message: '', onConfirm: null });
            }
        });
    };
    const addCategory = (name, type = 'expense') => {
        if (name && !categories.some(c => c.name === name)) {
            const newCategories = [...categories, { name, type }];
            setCategories(newCategories);
            saveData(transactions, budgets, savingsGoals, newCategories);
            return name;
        }
        return name;
    };

    const deleteCategory = (categoryName) => {
        const newCategories = categories.filter(c => c.name !== categoryName);
        const newTransactions = transactions.map(t =>
            t.category === categoryName ? { ...t, category: 'Uncategorized' } : t
        );
        const newBudgets = budgets.filter(b => b.category !== categoryName);

        setCategories(newCategories);
        setTransactions(newTransactions);
        setBudgets(newBudgets);
        saveData(newTransactions, newBudgets, savingsGoals, newCategories);
        setConfirmation({ show: false, message: '', onConfirm: null });
    };

    const triggerDeleteCategory = (categoryName) => {
        setConfirmation({
            show: true,
            message: `Delete "${categoryName}"? Associated transactions will be moved to "Uncategorized".`,
            onConfirm: () => deleteCategory(categoryName)
        });
    };

    const editCategory = (oldName, newName) => {
        if (!newName || oldName === newName || categories.some(c => c.name === newName)) return;

        const newCategories = categories.map(c => c.name === oldName ? { ...c, name: newName } : c);
        const newTransactions = transactions.map(t =>
            t.category === oldName ? { ...t, category: newName } : t
        );
        const newBudgets = budgets.map(b =>
            b.category === oldName ? { ...b, category: newName } : b
        );

        setCategories(newCategories);
        setTransactions(newTransactions);
        setBudgets(newBudgets);
        saveData(newTransactions, newBudgets, savingsGoals, newCategories);
    };



    return (
        <>
            <Navbar />
            <div className="pl-10 fixed inset-0 bg-black text-white flex flex-col font-sans selection:bg-emerald-500/30 overflow-hidden">
                {/* Header */}
                <header className="h-20 shrink-0 border-b border-white/5 bg-zinc-950/20 backdrop-blur-xl px-8 flex items-center justify-between z-50">
                    <div className="flex items-center gap-12">


                        <nav className="flex gap-1">
                            {['overview', 'transactions', 'categories'].map(tab => (
                                <button
                                    key={tab}
                                    onClick={() => setActiveTab(tab)}
                                    className={`px-6 py-2 rounded-lg text-[10px] font-black uppercase tracking-[0.2em] transition-all duration-300 pointer-events-auto cursor-pointer ${activeTab === tab ? 'bg-white text-black shadow-[0_0_20px_rgba(255,255,255,0.1)]' : 'text-zinc-500 hover:text-zinc-300 hover:bg-white/5'
                                        }`}
                                >
                                    {tab}
                                </button>
                            ))}
                        </nav>
                    </div>

                    <button
                        onClick={() => setShowAddModal(true)}
                        className="h-10 px-6 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-[10px] font-black uppercase tracking-[0.2em] transition-all duration-500 flex items-center gap-2 shadow-[0_0_30px_rgba(16,185,129,0.2)] active:scale-95 cursor-pointer"
                    >
                        <Plus size={16} /> New Entry
                    </button>
                </header>

                {/* Main Content Area */}
                <main className="flex-1 overflow-y-auto custom-scrollbar p-8">
                    <div className="max-w-[1600px] mx-auto space-y-8">

                        {/* Metrics Section - Compact Flex */}
                        <div className="flex flex-col md:flex-row gap-4 items-stretch">
                            <div className="flex-[1.5] bg-zinc-950/40 border border-white/5 rounded-[1.2rem] p-5 flex flex-col justify-between group overflow-hidden relative">
                                <div className="absolute -right-4 -top-4 w-24 h-24 bg-emerald-500/5 blur-2xl rounded-full pointer-events-none"></div>
                                <div className="flex justify-between items-start">
                                    <div>
                                        <span className="text-[9px] font-black text-zinc-500 uppercase tracking-[0.2em] block mb-1 italic">Balance</span>
                                        <div className="text-xl font-black tracking-tight">{metrics.balance.toLocaleString()} MAD</div>
                                    </div>
                                    <div className="h-10 w-24 translate-y-1">
                                        {historicalData.length > 1 && (
                                            <ResponsiveContainer width="100%" height="100%">
                                                <AreaChart data={historicalData}>
                                                    <defs>
                                                        <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
                                                            <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                                                            <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                                                        </linearGradient>
                                                    </defs>
                                                    <Area type="monotone" dataKey="value" stroke="#10b981" strokeWidth={1.5} fillOpacity={1} fill="url(#colorValue)" />
                                                </AreaChart>
                                            </ResponsiveContainer>
                                        )}
                                    </div>
                                </div>
                            </div>

                            <div className="flex-1 bg-zinc-950/40 border border-white/5 rounded-[1.2rem] p-5 flex justify-between items-center group relative overflow-hidden">
                                <div>
                                    <span className="text-[9px] font-black text-zinc-500 uppercase tracking-[0.2em] block mb-1 italic">Income</span>
                                    <div className="text-xl font-black tracking-tight text-emerald-400">{metrics.income.toLocaleString()} MAD</div>
                                </div>
                                <div className="w-8 h-8 rounded-lg bg-emerald-500/5 border border-emerald-500/10 flex items-center justify-center">
                                    <ArrowUpRight size={14} className="text-emerald-500" />
                                </div>
                            </div>

                            <div className="flex-1 bg-zinc-950/40 border border-white/5 rounded-[1.2rem] p-5 flex justify-between items-center group relative overflow-hidden">
                                <div>
                                    <span className="text-[9px] font-black text-zinc-500 uppercase tracking-[0.2em] block mb-1 italic">Expenses</span>
                                    <div className="text-xl font-black tracking-tight text-rose-400">{metrics.expenses.toLocaleString()} MAD</div>
                                </div>
                                <div className="w-8 h-8 rounded-lg bg-rose-500/5 border border-rose-500/10 flex items-center justify-center">
                                    <ArrowDownLeft size={14} className="text-rose-500" />
                                </div>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                            <div className="lg:col-span-8">
                                {activeTab === 'overview' ? (
                                    <div className="bg-zinc-950/40 backdrop-blur-3xl border border-white/5 rounded-[2rem] p-8">
                                        <div className="flex justify-between items-center mb-10">
                                            <div>
                                                <h3 className="text-lg font-black uppercase tracking-widest italic">Capital Trend</h3>
                                                <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest mt-1">Real-time fiscal performance</p>
                                            </div>
                                        </div>
                                        {historicalData.length > 1 ? (
                                            <div className="h-[340px] w-full">
                                                <ResponsiveContainer width="100%" height="100%">
                                                    <AreaChart data={historicalData}>
                                                        <defs>
                                                            <linearGradient id="mainFlow" x1="0" y1="0" x2="0" y2="1">
                                                                <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.2} />
                                                                <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                                                            </linearGradient>
                                                        </defs>
                                                        <XAxis dataKey="date" hide />
                                                        <YAxis hide domain={['auto', 'auto']} />
                                                        <Tooltip
                                                            contentStyle={{ backgroundColor: 'rgba(9, 9, 11, 0.95)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '12px' }}
                                                            itemStyle={{ color: '#fff', fontSize: '10px', fontWeight: '900', textTransform: 'uppercase' }}
                                                            labelStyle={{ color: '#52525b', fontSize: '8px', fontWeight: 'bold' }}
                                                            formatter={(value) => [`${value.toLocaleString()} MAD`, 'Value']}
                                                        />
                                                        <Area type="monotone" dataKey="value" stroke="#3b82f6" strokeWidth={3} fillOpacity={1} fill="url(#mainFlow)" />
                                                    </AreaChart>
                                                </ResponsiveContainer>
                                            </div>
                                        ) : (
                                            <div className="h-[340px] flex flex-col items-center justify-center text-zinc-800 gap-4">
                                                <Activity size={40} className="opacity-20 translate-y-2 text-zinc-600" />
                                                <p className="text-[10px] font-black uppercase tracking-[0.4em] opacity-40">Awaiting sufficient data points</p>
                                            </div>
                                        )}
                                    </div>
                                ) : activeTab === 'transactions' ? (
                                    <div className="bg-zinc-950/40 backdrop-blur-3xl border border-white/5 rounded-[2rem] overflow-hidden flex flex-col min-h-[500px]">
                                        <div className="p-8 border-b border-white/5 flex justify-between items-center">
                                            <h3 className="text-lg font-black uppercase tracking-widest italic">Capital Log</h3>
                                            <div className="relative group">
                                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-700 group-focus-within:text-emerald-500 transition-colors" size={14} />
                                                <input
                                                    className="bg-zinc-950 border border-white/5 rounded-xl pl-9 pr-4 py-2 text-[10px] font-bold uppercase tracking-widest focus:ring-1 focus:ring-emerald-500 outline-none w-64 transition-all"
                                                    placeholder="Search entries..."
                                                    value={searchTerm}
                                                    onChange={(e) => setSearchTerm(e.target.value)}
                                                />
                                            </div>
                                        </div>
                                        <div className="flex-1 overflow-y-auto custom-scrollbar">
                                            <table className="w-full border-collapse">
                                                <thead className="sticky top-0 bg-zinc-950/90 backdrop-blur-md z-10 border-b border-white/5">
                                                    <tr>
                                                        <th className="px-8 py-4 text-left text-[9px] font-black text-zinc-600 uppercase tracking-[0.3em]">Date</th>
                                                        <th className="px-8 py-4 text-left text-[9px] font-black text-zinc-600 uppercase tracking-[0.3em]">Description</th>
                                                        <th className="px-8 py-4 text-left text-[9px] font-black text-zinc-600 uppercase tracking-[0.3em]">Category</th>
                                                        <th className="px-8 py-4 text-right text-[9px] font-black text-zinc-600 uppercase tracking-[0.3em]">Amount</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {transactions.filter(t => t.description.toLowerCase().includes(searchTerm.toLowerCase())).map((t) => (
                                                        <tr key={t.id} className="group border-b border-white/5 hover:bg-white/[0.02] transition-colors">
                                                            <td className="px-8 py-5 text-[10px] font-black text-zinc-500 font-mono uppercase tracking-tighter">{t.date}</td>
                                                            <td className="px-8 py-5 text-[10px] font-black uppercase tracking-widest group-hover:text-emerald-400 transition-colors">{t.description}</td>
                                                            <td className="px-8 py-5">
                                                                <span className="px-3 py-1 bg-white/5 border border-white/5 rounded-lg text-[9px] font-black text-zinc-400 uppercase tracking-widest">{t.category}</span>
                                                            </td>
                                                            <td className={`px-8 py-5 text-right font-black font-mono text-xs ${t.type === 'income' ? 'text-emerald-400' : 'text-rose-400'}`}>
                                                                {t.type === 'income' ? '+' : '-'}{t.amount.toLocaleString()} MAD
                                                                <div className="inline-flex items-center gap-2 ml-4 opacity-0 group-hover:opacity-100 transition-all">
                                                                    <button
                                                                        onClick={() => {
                                                                            setEditingTransaction(t);
                                                                            setShowAddModal(true);
                                                                        }}
                                                                        className="text-zinc-500 hover:text-blue-400 cursor-pointer"
                                                                    >
                                                                        <Edit2 size={12} />
                                                                    </button>
                                                                    <button onClick={() => deleteTransaction(t.id)} className="text-zinc-700 hover:text-rose-500 cursor-pointer"><Trash2 size={12} /></button>
                                                                </div>
                                                            </td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                            {transactions.length === 0 && (
                                                <div className="p-20 flex flex-col items-center justify-center text-zinc-800 gap-4">
                                                    <Briefcase size={40} className="opacity-20" />
                                                    <p className="text-[10px] font-black uppercase tracking-[0.4em] opacity-40">No entries recorded</p>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                ) : activeTab === 'categories' ? (
                                    <div className="bg-zinc-950/40 backdrop-blur-3xl border border-white/5 rounded-[2rem] p-8 min-h-[500px]">
                                        <div className="flex justify-between items-center mb-10">
                                            <div>
                                                <h3 className="text-lg font-black uppercase tracking-widest italic">Categories</h3>
                                                <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest mt-1">Manage your fiscal classifications</p>
                                            </div>
                                        </div>

                                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                            {categories.map((catObj) => {
                                                const cat = catObj.name;
                                                return (
                                                    <div key={cat} className="group bg-zinc-900/30 border border-white/5 rounded-2xl p-4 flex items-center justify-between hover:bg-white/[0.02] transition-all">
                                                        {editingCategory === cat ? (
                                                            <div className="flex-1 flex gap-2">
                                                                <input
                                                                    autoFocus
                                                                    className="flex-1 bg-zinc-950 border border-white/10 rounded-lg px-3 py-1 text-[10px] font-bold uppercase tracking-widest text-white outline-none focus:ring-1 focus:ring-emerald-500"
                                                                    value={editValue}
                                                                    onChange={(e) => setEditValue(e.target.value)}
                                                                    onKeyDown={(e) => {
                                                                        if (e.key === 'Enter') {
                                                                            editCategory(cat, editValue);
                                                                            setEditingCategory(null);
                                                                        } else if (e.key === 'Escape') {
                                                                            setEditingCategory(null);
                                                                        }
                                                                    }}
                                                                />
                                                                <button
                                                                    onClick={() => {
                                                                        editCategory(cat, editValue);
                                                                        setEditingCategory(null);
                                                                    }}
                                                                    className="p-2 text-emerald-500 hover:bg-emerald-500/10 rounded-lg transition-colors cursor-pointer"
                                                                >
                                                                    <Check size={14} />
                                                                </button>
                                                                <button
                                                                    onClick={() => setEditingCategory(null)}
                                                                    className="p-2 text-zinc-500 hover:bg-white/5 rounded-lg transition-colors cursor-pointer"
                                                                >
                                                                    <X size={14} />
                                                                </button>
                                                            </div>
                                                        ) : (
                                                            <>
                                                                <div className="flex flex-col">
                                                                    <span className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-300">{cat}</span>
                                                                    <span className={`text-[8px] font-bold uppercase tracking-widest ${catObj.type === 'income' ? 'text-emerald-500/60' : 'text-rose-500/60'}`}>{catObj.type}</span>
                                                                </div>
                                                                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                                    <button
                                                                        onClick={() => {
                                                                            setEditingCategory(cat);
                                                                            setEditValue(cat);
                                                                        }}
                                                                        className="p-2 text-zinc-500 hover:text-blue-400 hover:bg-blue-400/10 rounded-lg transition-colors cursor-pointer"
                                                                    >
                                                                        <Edit2 size={12} />
                                                                    </button>
                                                                    <button
                                                                        onClick={() => triggerDeleteCategory(cat)}
                                                                        className="p-2 text-zinc-500 hover:text-rose-500 hover:bg-rose-500/10 rounded-lg transition-colors cursor-pointer"
                                                                    >
                                                                        <Trash2 size={12} />
                                                                    </button>
                                                                </div>
                                                            </>
                                                        )}
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>
                                ) : null}
                            </div>

                            <div className="lg:col-span-4 flex flex-col gap-8">
                                <div className="bg-zinc-950/40 backdrop-blur-3xl border border-white/5 rounded-[2rem] p-8">
                                    <h3 className="text-sm font-black uppercase tracking-[0.2em] italic mb-8">Asset Mix</h3>
                                    {categoryMix.length > 0 ? (
                                        <>
                                            <div className="h-[200px] relative">
                                                <ResponsiveContainer width="100%" height="100%">
                                                    <PieChart>
                                                        <Pie data={categoryMix} innerRadius={60} outerRadius={80} paddingAngle={4} dataKey="value">
                                                            {categoryMix.map((_, index) => (
                                                                <Cell key={`cell-${index}`} fill={['#10b981', '#3b82f6', '#8b5cf6', '#f59e0b', '#ec4899', '#ef4444'][index % 6]} stroke="none" />
                                                            ))}
                                                        </Pie>
                                                        <Tooltip
                                                            contentStyle={{ backgroundColor: '#000', border: 'none', borderRadius: '8px', fontSize: '9px', fontWeight: '900', textTransform: 'uppercase' }}
                                                            formatter={(value) => [`${value.toLocaleString()} MAD`]}
                                                        />
                                                    </PieChart>
                                                </ResponsiveContainer>
                                            </div>
                                            <div className="space-y-4 mt-8">
                                                {categoryMix.slice(0, 4).map((item, i) => (
                                                    <div key={i} className="flex items-center justify-between">
                                                        <div className="flex items-center gap-3">
                                                            <div className="w-2 h-2 rounded-full" style={{ backgroundColor: ['#10b981', '#3b82f6', '#8b5cf6', '#f59e0b'][i % 4] }}></div>
                                                            <span className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">{item.name}</span>
                                                        </div>
                                                        <span className="text-[11px] font-black font-mono text-zinc-400">{item.value.toLocaleString()} MAD</span>
                                                    </div>
                                                ))}
                                            </div>
                                        </>
                                    ) : (
                                        <div className="h-[280px] flex flex-col items-center justify-center text-zinc-800 gap-2 text-center">
                                            <PieIcon size={40} className="opacity-10 mb-2" />
                                            <p className="text-[10px] font-black uppercase tracking-widest opacity-40">No categorical data</p>
                                        </div>
                                    )}
                                </div>

                                <div className="bg-zinc-950/40 backdrop-blur-3xl border border-white/5 rounded-[2rem] p-8">
                                    <div className="flex justify-between items-center mb-8">
                                        <h3 className="text-sm font-black uppercase tracking-[0.2em] italic">Targets</h3>
                                    </div>
                                    <div className="space-y-8">
                                        {budgets.length > 0 ? budgets.map((b) => {
                                            const spent = transactions.filter(t => t.category === b.category && t.type === 'expense').reduce((a, b) => a + b.amount, 0);
                                            const percentage = Math.min((spent / b.limit) * 100, 100);
                                            return (
                                                <div key={b.id} className="space-y-3">
                                                    <div className="flex justify-between items-end">
                                                        <span className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">{b.category}</span>
                                                        <span className="text-[9px] font-black font-mono text-zinc-600 uppercase tracking-widest">{spent.toFixed(0)} MAD / {b.limit} MAD</span>
                                                    </div>
                                                    <div className="h-1.5 w-full bg-zinc-900 rounded-full overflow-hidden">
                                                        <div className={`h-full rounded-full ${percentage > 90 ? 'bg-rose-500' : 'bg-emerald-500'}`} style={{ width: `${percentage}%` }}></div>
                                                    </div>
                                                </div>
                                            )
                                        }) : (
                                            <div className="py-10 flex flex-col items-center justify-center text-zinc-800 gap-2 text-center text-zinc-600">
                                                <TargetIcon size={30} className="opacity-10 mb-2" />
                                                <p className="text-[10px] font-black uppercase tracking-widest opacity-40">No active targets</p>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </main>

                {/* Modal */}
                {showAddModal && (
                    <DeploymentModal
                        onClose={() => {
                            setShowAddModal(false);
                            setEditingTransaction(null);
                        }}
                        onSave={addTransaction}
                        categories={categories}
                        onAddCategory={addCategory}
                        editingTransaction={editingTransaction}
                        transactions={transactions}
                    />
                )}

                {confirmation.show && (
                    <ConfirmationModal
                        message={confirmation.message}
                        onConfirm={confirmation.onConfirm}
                        onClose={() => setConfirmation({ show: false, message: '', onConfirm: null })}
                    />
                )}
            </div>
        </>
    );
};

const ConfirmationModal = ({ message, onConfirm, onClose }) => {
    return (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60 backdrop-blur-md p-4 animate-in fade-in duration-300">
            <div className="absolute inset-0" onClick={onClose} />
            <div className="bg-zinc-950 rounded-[2rem] border border-white/5 w-full max-w-sm animate-in zoom-in-95 duration-300 relative overflow-hidden shadow-[0_0_50px_rgba(0,0,0,0.5)]">
                <div className="p-8 text-center">
                    <div className="w-12 h-12 rounded-2xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center mx-auto mb-6">
                        <Trash2 className="text-rose-500" size={20} />
                    </div>
                    <h3 className="text-sm font-black text-white uppercase tracking-widest italic mb-2">Confirm Action</h3>
                    <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest leading-relaxed">{message}</p>
                </div>
                <div className="flex border-t border-white/5">
                    <button
                        onClick={onClose}
                        className="flex-1 py-4 text-[9px] font-black uppercase tracking-[0.3em] text-zinc-500 hover:bg-white/5 transition-all cursor-pointer"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={onConfirm}
                        className="flex-1 py-4 text-[9px] font-black uppercase tracking-[0.3em] text-rose-500 hover:bg-rose-500/10 border-l border-white/5 transition-all cursor-pointer"
                    >
                        Delete
                    </button>
                </div>
            </div>
        </div>
    );
};

const DeploymentModal = ({ onClose, onSave, categories, onAddCategory, editingTransaction, transactions }) => {
    const [formData, setFormData] = useState({
        description: '',
        amount: '',
        category: '',
        type: 'expense',
        date: new Date().toISOString().split('T')[0]
    });

    useEffect(() => {
        if (editingTransaction) {
            setFormData({
                ...editingTransaction,
                amount: editingTransaction.amount.toString()
            });
        }
    }, [editingTransaction]);

    // Update default category when type changes
    useEffect(() => {
        if (!editingTransaction && categories.length > 0) {
            const filtered = categories.filter(c => c.type === formData.type);
            if (filtered.length > 0) {
                // Find last used category for this type
                const lastUsed = transactions.find(t => t.type === formData.type)?.category;
                const lastUsedInCategoryList = filtered.find(c => c.name === lastUsed);
                setFormData(prev => ({ ...prev, category: lastUsedInCategoryList ? lastUsedInCategoryList.name : filtered[0].name }));
            } else {
                setFormData(prev => ({ ...prev, category: '' }));
            }
        }
    }, [formData.type, categories, editingTransaction, transactions]);

    const [isAddingCategory, setIsAddingCategory] = useState(false);
    const [newCategoryName, setNewCategoryName] = useState('');

    const handleSubmit = (e) => {
        e.preventDefault();
        if (!formData.description || !formData.amount || !formData.category) return;
        onSave({
            ...formData,
            id: editingTransaction ? editingTransaction.id : Date.now().toString(),
            amount: parseFloat(formData.amount)
        });
    };

    const sortedCategories = useMemo(() => {
        const filtered = categories.filter(c => c.type === formData.type);

        // Find usage timestamps
        const usageMap = {};
        transactions.forEach(t => {
            if (!usageMap[t.category]) {
                usageMap[t.category] = new Date(t.date).getTime();
            }
        });

        return [...filtered].sort((a, b) => {
            const timeA = usageMap[a.name] || 0;
            const timeB = usageMap[b.name] || 0;
            return timeB - timeA;
        });
    }, [categories, formData.type, transactions]);

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-in fade-in duration-300">
            <div className="absolute inset-0" onClick={onClose} />
            <div className="bg-zinc-950 rounded-[2.5rem] border border-zinc-800 w-full max-w-lg animate-in slide-in-from-bottom-2 duration-500 relative overflow-hidden">
                <div className="px-6 py-4 border-b border-zinc-900 flex justify-between items-center">
                    <h3 className="text-lg font-black text-white tracking-tighter uppercase italic">{editingTransaction ? 'Edit Entry' : 'New Entry'}</h3>
                    <button onClick={onClose} className="text-zinc-500 hover:text-white transition-all cursor-pointer"><X size={20} /></button>
                </div>
                <form onSubmit={handleSubmit} className="p-6 space-y-4">
                    <div className="flex bg-zinc-900/50 p-1 rounded-2xl border border-white/5">
                        {['expense', 'income'].map((type) => (
                            <button key={type} type="button" onClick={() => setFormData({ ...formData, type })}
                                className={`flex-1 py-3 rounded-xl text-[10px] font-black uppercase tracking-[0.25em] transition-all pointer-events-auto cursor-pointer ${formData.type === type ? (type === 'income' ? 'bg-emerald-600 text-white' : 'bg-rose-600 text-white') : 'text-zinc-500'
                                    }`}
                            > {type} </button>
                        ))}
                    </div>
                    <div className="space-y-2">
                        <label className="text-[9px] font-black uppercase tracking-[0.3em] text-zinc-500 ml-2 italic">Description</label>
                        <input autoFocus className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-2 text-[11px] font-black uppercase tracking-widest text-white outline-none focus:ring-1 focus:ring-emerald-500"
                            placeholder="e.g. RENT" value={formData.description} onChange={(e) => setFormData({ ...formData, description: e.target.value })} />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <label className="text-[9px] font-black uppercase tracking-[0.3em] text-zinc-500 ml-2 italic">Amount</label>
                            <input type="number" step="0.01" className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-2 text-[11px] font-black font-mono text-white outline-none focus:ring-1 focus:ring-emerald-500"
                                placeholder="0.00" value={formData.amount} onChange={(e) => setFormData({ ...formData, amount: e.target.value })} />
                        </div>
                        <div className="space-y-2">
                            <label className="text-[9px] font-black uppercase tracking-[0.3em] text-zinc-500 ml-2 italic">Date</label>
                            <input type="date" className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-2 text-[11px] font-black font-mono text-white outline-none focus:ring-1 focus:ring-emerald-500"
                                value={formData.date} onChange={(e) => setFormData({ ...formData, date: e.target.value })} />
                        </div>
                    </div>
                    <div className="space-y-2">
                        <label className="text-[9px] font-black uppercase tracking-[0.3em] text-zinc-500 ml-2 italic">Category</label>
                        {isAddingCategory ? (
                            <div className="flex gap-2">
                                <input
                                    autoFocus
                                    className="flex-1 bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-2 text-[11px] font-black uppercase tracking-widest text-white outline-none focus:ring-1 focus:ring-emerald-500"
                                    placeholder="NEW CATEGORY"
                                    value={newCategoryName}
                                    onChange={(e) => setNewCategoryName(e.target.value)}
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter' && newCategoryName.trim()) {
                                            const name = newCategoryName.trim();
                                            onAddCategory(name, formData.type);
                                            setFormData({ ...formData, category: name });
                                            setNewCategoryName('');
                                            setIsAddingCategory(false);
                                        } else if (e.key === 'Escape') {
                                            setNewCategoryName('');
                                            setIsAddingCategory(false);
                                        }
                                    }}
                                />
                                <button
                                    type="button"
                                    onClick={() => {
                                        if (newCategoryName.trim()) {
                                            const name = newCategoryName.trim();
                                            onAddCategory(name, formData.type);
                                            setFormData({ ...formData, category: name });
                                            setNewCategoryName('');
                                            setIsAddingCategory(false);
                                        }
                                    }}
                                    className="px-4 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-[10px] font-black uppercase tracking-[0.2em] transition-all cursor-pointer"
                                >
                                    Add
                                </button>
                                <button
                                    type="button"
                                    onClick={() => {
                                        setNewCategoryName('');
                                        setIsAddingCategory(false);
                                    }}
                                    className="px-4 bg-zinc-800 hover:bg-zinc-700 text-white rounded-xl text-[10px] font-black uppercase tracking-[0.2em] transition-all cursor-pointer"
                                >
                                    Cancel
                                </button>
                            </div>
                        ) : (
                            <div className="flex gap-2">
                                <select className="flex-1 bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-2 text-[10px] font-black uppercase tracking-[0.2em] text-white outline-none focus:ring-1 focus:ring-emerald-500 appearance-none pointer-events-auto cursor-pointer"
                                    value={formData.category} onChange={(e) => setFormData({ ...formData, category: e.target.value })}>
                                    <option value="" disabled>Select Category</option>
                                    {sortedCategories.map(cat => (
                                        <option key={cat.name} value={cat.name}>{cat.name}</option>
                                    ))}
                                </select>
                                <button
                                    type="button"
                                    onClick={() => setIsAddingCategory(true)}
                                    className="px-4 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-[10px] font-black uppercase tracking-[0.2em] transition-all whitespace-nowrap cursor-pointer"
                                >
                                    + New
                                </button>
                            </div>
                        )}
                    </div>
                    <button type="submit" className={`w-full py-3 rounded-xl text-[10px] font-black uppercase tracking-[0.3em] transition-all shadow-[0_0_40px_rgba(0,0,0,0.2)] cursor-pointer ${formData.type === 'income' ? 'bg-emerald-600 hover:bg-emerald-500 shadow-emerald-500/20' : 'bg-rose-600 hover:bg-rose-500 shadow-rose-500/20'} text-white`}>
                        {editingTransaction ? 'UPDATE TRANSACTION' : 'SAVE TRANSACTION'}
                    </button>
                </form>
            </div>
        </div>
    );
};

export default FinanceTracker;

