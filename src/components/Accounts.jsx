import React, { useState, useEffect } from 'react';
import { Icon } from '@iconify/react';
import { User, Mail, Lock, Shield, Phone as PhoneIcon, Search, Plus, Trash2, Edit3, Copy, X, ChevronDown, Key, History, ArrowUp, ArrowDown, Zap } from 'lucide-react';

import Navbar from './Navbar';
import editIcon from '../assets/icons/edit.svg';
import deleteIcon from '../assets/icons/delete.svg';
import copyIcon from '../assets/icons/copy.svg';

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

// --- Electron/Node.js Imports ---
const { writeFile, readFile } = window.require('fs').promises;
const { existsSync } = window.require('fs');
const path = window.require('path');

const DB_PATH = 'C:\\Users\\PC\\Desktop\\database\\accounts.json';
const ICONS_CACHE_DIR = 'C:\\Users\\PC\\Desktop\\database\\accounts_icons';

try {
    if (!existsSync(ICONS_CACHE_DIR)) {
        window.require('fs').mkdirSync(ICONS_CACHE_DIR, { recursive: true });
    }
} catch (e) {
    console.error("Failed to create icons cache dir", e);
}

const generateId = () => Math.random().toString(36).substr(2, 9);

const Accounts = () => {
    // --- Initial Synchronous Load ---
    const initialAccounts = (() => {
        try {
            if (existsSync(DB_PATH)) {
                return JSON.parse(window.require('fs').readFileSync(DB_PATH, 'utf8'));
            } else {
                window.require('fs').writeFileSync(DB_PATH, '[]', 'utf8');
            }
        } catch (error) {
            console.error("Error initial loading accounts:", error);
        }
        return [];
    })();

    const initialIconCache = (() => {
        let cache = {};
        const uniqueIcons = [...new Set(initialAccounts.map(a => a.icon).filter(Boolean))];
        for (const iconString of uniqueIcons) {
            const safeFileName = iconString.replace(/:/g, '-') + '.svg';
            const cacheFilePath = path.join(ICONS_CACHE_DIR, safeFileName);
            try {
                if (existsSync(cacheFilePath)) {
                    cache[iconString] = window.require('fs').readFileSync(cacheFilePath, 'utf8');
                }
            } catch (e) { }
        }
        return cache;
    })();

    const [accounts, setAccounts] = useState(initialAccounts);
    const [search, setSearch] = useState("");
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingAccount, setEditingAccount] = useState(null);
    const [duplicatingData, setDuplicatingData] = useState(null);
    const [iconCache, setIconCache] = useState(initialIconCache);

    // --- Icon Caching ---
    useEffect(() => {
        let isMounted = true;
        const loadIcons = async () => {
            const uniqueIcons = [...new Set(accounts.map(a => a.icon).filter(Boolean))];
            let newCacheItems = {};
            let updated = false;

            for (const iconString of uniqueIcons) {
                // If it's already in state cache, skip
                if (iconCache[iconString] || newCacheItems[iconString]) continue;

                const safeFileName = iconString.replace(/:/g, '-') + '.svg';
                const cacheFilePath = path.join(ICONS_CACHE_DIR, safeFileName);

                try {
                    if (existsSync(cacheFilePath)) {
                        const svgData = await readFile(cacheFilePath, 'utf8');
                        newCacheItems[iconString] = svgData;
                        updated = true;
                    } else {
                        let prefix, name;
                        if (iconString.includes(':')) {
                            const parts = iconString.split(':');
                            prefix = parts[0];
                            name = parts.slice(1).join(':');
                        } else {
                            const parts = iconString.split('-');
                            prefix = parts[0];
                            name = parts.slice(1).join('-');
                        }

                        if (prefix && name) {
                            const res = await fetch(`https://api.iconify.design/${prefix}/${name}.svg`);
                            if (res.ok) {
                                let svgData = await res.text();
                                await writeFile(cacheFilePath, svgData, 'utf8');
                                newCacheItems[iconString] = svgData;
                                updated = true;
                            }
                        }
                    }
                } catch (err) {
                    console.error("Error caching icon", iconString, err);
                }
            }

            if (updated && isMounted) {
                setIconCache(prev => ({ ...prev, ...newCacheItems }));
            }
        };

        if (accounts.length > 0) {
            loadIcons();
        }
        return () => { isMounted = false; };
    }, [accounts]);

    // --- Persistence ---
    const saveAccounts = async (newAccounts) => {
        try {
            await writeFile(DB_PATH, JSON.stringify(newAccounts, null, 2), 'utf8');
        } catch (error) {
            console.error("Error saving accounts:", error);
        }
    };

    // --- Handlers ---
    const handleSave = async (accountData) => {
        let newAccounts;
        if (editingAccount) {
            newAccounts = accounts.map(acc => acc.id === editingAccount.id ? { ...accountData, id: acc.id } : acc);
        } else {
            newAccounts = [...accounts, { ...accountData, id: generateId(), timestamp: Date.now() }];
        }
        setAccounts(newAccounts);
        await saveAccounts(newAccounts);
        setIsModalOpen(false);
        setEditingAccount(null);
        setDuplicatingData(null);
    };

    const handleDuplicate = (account) => {
        const { id, timestamp, ...data } = account;
        setEditingAccount(null);
        setDuplicatingData(data);
        setIsModalOpen(true);
    };

    // --- Confirmation Modal State ---
    const [confirmState, setConfirmState] = useState({
        isOpen: false,
        message: '',
        onConfirm: null
    });

    const closeConfirm = () => {
        setConfirmState({ isOpen: false, message: '', onConfirm: null });
    };

    const handleDelete = (id) => {
        setConfirmState({
            isOpen: true,
            message: "Are you sure you want to delete this credential?",
            onConfirm: async () => {
                const newAccounts = accounts.filter(acc => acc.id !== id);
                setAccounts(newAccounts);
                await saveAccounts(newAccounts);
                closeConfirm();
            }
        });
    };

    const toggleLightningStatus = async (id) => {
        const newAccounts = accounts.map(acc =>
            acc.id === id ? { ...acc, lightningStatus: !acc.lightningStatus } : acc
        );
        setAccounts(newAccounts);
        await saveAccounts(newAccounts);
    };

    const resetLightningStatus = async () => {
        const newAccounts = accounts.map(acc =>
            acc.service === "LightningAi" ? { ...acc, lightningStatus: false } : acc
        );
        setAccounts(newAccounts);
        await saveAccounts(newAccounts);
    };

    // --- Category Management ---
    const handleRenameCategory = async (oldName, newName) => {
        if (!newName || newName === oldName) {
            setEditingCategory(null);
            return;
        }
        if (availableCategories.includes(newName)) {
            alert("Category name already exists!");
            return;
        }
        const newAccounts = accounts.map(acc => acc.category === oldName ? { ...acc, category: newName } : acc);
        setAccounts(newAccounts);
        await saveAccounts(newAccounts);
        setEditingCategory(null);
    };

    const handleDeleteCategory = (categoryName) => {
        setConfirmState({
            isOpen: true,
            message: `Delete category "${categoryName}"? Accounts will be moved to Uncategorized.`,
            onConfirm: async () => {
                const newAccounts = accounts.map(acc => acc.category === categoryName ? { ...acc, category: '' } : acc);
                setAccounts(newAccounts);
                await saveAccounts(newAccounts);
                closeConfirm();
            }
        });
    };

    const [editingCategory, setEditingCategory] = useState(null); // { original: string, current: string }

    const [categoryOrder, setCategoryOrder] = useState(() => {
        try {
            return JSON.parse(localStorage.getItem('accountsCategoryOrder') || '[]');
        } catch {
            return [];
        }
    });

    const getOrderedCategories = (cats) => {
        return [...cats].sort((a, b) => {
            const idxA = categoryOrder.indexOf(a);
            const idxB = categoryOrder.indexOf(b);
            if (idxA !== -1 && idxB !== -1) return idxA - idxB;
            if (idxA !== -1) return -1;
            if (idxB !== -1) return 1;
            return a.localeCompare(b);
        });
    };

    const handleMoveCategoryUp = (categoryToMove) => {
        const allCats = [...new Set(accounts.map(a => a.category || 'Uncategorized'))];
        const sortedCats = getOrderedCategories(allCats);
        const idx = sortedCats.indexOf(categoryToMove);
        if (idx > 0) {
            const newOrder = [...sortedCats];
            const temp = newOrder[idx - 1];
            newOrder[idx - 1] = newOrder[idx];
            newOrder[idx] = temp;
            setCategoryOrder(newOrder);
            localStorage.setItem('accountsCategoryOrder', JSON.stringify(newOrder));

            setTimeout(() => {
                const element = document.getElementById(`category-${categoryToMove}`);
                if (element) {
                    element.scrollIntoView({ behavior: 'smooth', block: 'start' });
                }
            }, 50);
        }
    };

    const handleMoveCategoryDown = (categoryToMove) => {
        const allCats = [...new Set(accounts.map(a => a.category || 'Uncategorized'))];
        const sortedCats = getOrderedCategories(allCats);
        const idx = sortedCats.indexOf(categoryToMove);
        if (idx < sortedCats.length - 1 && idx !== -1) {
            const newOrder = [...sortedCats];
            const temp = newOrder[idx + 1];
            newOrder[idx + 1] = newOrder[idx];
            newOrder[idx] = temp;
            setCategoryOrder(newOrder);
            localStorage.setItem('accountsCategoryOrder', JSON.stringify(newOrder));

            setTimeout(() => {
                const element = document.getElementById(`category-${categoryToMove}`);
                if (element) {
                    element.scrollIntoView({ behavior: 'smooth', block: 'start' });
                }
            }, 50);
        }
    };

    // --- Copy Feedback ---
    const [copiedState, setCopiedState] = useState(null); // { id: string, field: string }

    const togglePasswordVisibility = (id) => {
        setShowPasswordMap(prev => ({ ...prev, [id]: !prev[id] }));
    };

    const copyToClipboard = (text, id, field) => {
        navigator.clipboard.writeText(text);
        setCopiedState({ id, field });
        setTimeout(() => setCopiedState(null), 2000);
    };

    const filteredAccounts = accounts.filter(acc => {
        const term = search.toLowerCase();
        
        let matches = (
            (acc.service || '').toLowerCase().includes(term) ||
            (acc.username || '').toLowerCase().includes(term) ||
            (acc.email || '').toLowerCase().includes(term) ||
            (acc.password || '').toLowerCase().includes(term) ||
            (acc.phone || '').toLowerCase().includes(term) ||
            (acc.notes || '').toLowerCase().includes(term) ||
            (acc.category || '').toLowerCase().includes(term)
        );

        if (!matches && acc.motherAccountId) {
            const motherAcc = accounts.find(a => a.id === acc.motherAccountId);
            if (motherAcc) {
                matches = (
                    (motherAcc.service || '').toLowerCase().includes(term) ||
                    (motherAcc.username || '').toLowerCase().includes(term) ||
                    (motherAcc.email || '').toLowerCase().includes(term) ||
                    (motherAcc.password || '').toLowerCase().includes(term) ||
                    (motherAcc.phone || '').toLowerCase().includes(term) ||
                    (motherAcc.notes || '').toLowerCase().includes(term) ||
                    (motherAcc.category || '').toLowerCase().includes(term)
                );
            }
        }

        return matches;
    }).sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));

    // --- Category Derivatives ---
    const availableCategories = [...new Set(accounts.map(a => a.category).filter(Boolean))].sort();

    return (
        <div className="h-screen w-full bg-black text-zinc-200 overflow-hidden flex flex-col p-4 pl-16"> {/* Reduced left padding to pl-16 */}
            <Navbar />

            {/* Header */}
            <div className="flex items-center justify-end mb-3 shrink-0"> {/* Reduced mb-4 to mb-3 */}
                <div className="flex items-center gap-2">
                    <button
                        onClick={resetLightningStatus}
                        className="bg-zinc-900 border border-zinc-800 p-2.5 rounded-xl hover:border-emerald-500/50 hover:bg-zinc-800 transition-all active:scale-95 text-emerald-500 cursor-pointer"
                        title="Reset all LightningAi statuses"
                    >
                        <Zap size={14} />
                    </button>
                    <div className="relative group">
                        <input
                            type="text"
                            placeholder="Search vault..."
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            className="bg-zinc-900 border border-zinc-800 text-xs font-bold rounded-xl px-4 py-2.5 w-64 outline-none focus:border-zinc-600 focus:bg-zinc-800 transition-all placeholder:text-zinc-700 text-zinc-300"
                        />
                        <Search size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-700" />
                    </div>
                    <button
                        onClick={() => { setEditingAccount(null); setDuplicatingData(null); setIsModalOpen(true); }}
                        className="bg-zinc-100 hover:bg-white text-black px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all active:scale-95 flex items-center gap-2 cursor-pointer"
                    >
                        <Plus size={14} /> Add Entry
                    </button>
                </div>
            </div>

            {/* Content Area */}
            <div className="flex-1 overflow-y-auto custom-scrollbar pr-2">
                {getOrderedCategories(Object.keys(accounts.length > 0 ? Object.groupBy(filteredAccounts, ({ category }) => category || 'Uncategorized') : {})).map((category, index, activeCategories) => {
                    const catAccounts = filteredAccounts.filter(a => (a.category || 'Uncategorized') === category);
                    if (catAccounts.length === 0) return null;

                    return (
                        <div key={category} id={`category-${category}`} className="mb-4"> {/* Reduced mb-8 to mb-4 */}
                            <div className="flex items-center gap-2 mb-2 group/cat"> {/* Reduced mb-4 to mb-2 */}
                                {editingCategory?.original === category ? (
                                    <div className="flex items-center gap-2">
                                        <input
                                            value={editingCategory.current}
                                            onChange={(e) => setEditingCategory({ ...editingCategory, current: e.target.value })}
                                            onKeyDown={(e) => {
                                                if (e.key === 'Enter') handleRenameCategory(category, editingCategory.current);
                                                if (e.key === 'Escape') setEditingCategory(null);
                                            }}
                                            className="bg-zinc-900 border border-zinc-800 text-xs font-bold text-white px-2 py-1 rounded-md outline-none focus:border-blue-500"
                                            autoFocus
                                            onBlur={() => handleRenameCategory(category, editingCategory.current)}
                                        />
                                    </div>
                                ) : (
                                    <span className="text-xs font-black text-zinc-500 uppercase tracking-widest">{category}</span>
                                )}

                                <div className="h-px bg-zinc-900 flex-1"></div>

                                {category !== 'Uncategorized' && !editingCategory && (
                                    <div className="flex gap-1 ml-2">
                                        {index > 0 && (
                                            <button
                                                onClick={() => handleMoveCategoryUp(category)}
                                                className="text-zinc-600 hover:text-white px-1.5 py-0.5 transition-colors cursor-pointer"
                                                title="Move Category Up"
                                            >
                                                <ArrowUp size={11} />
                                            </button>
                                        )}
                                        {index < activeCategories.length - 1 && (
                                            <button
                                                onClick={() => handleMoveCategoryDown(category)}
                                                className="text-zinc-600 hover:text-white px-1.5 py-0.5 transition-colors cursor-pointer"
                                                title="Move Category Down"
                                            >
                                                <ArrowDown size={11} />
                                            </button>
                                        )}
                                        <button
                                            onClick={() => setEditingCategory({ original: category, current: category })}
                                            className="text-zinc-600 hover:text-white px-1.5 py-0.5 transition-colors cursor-pointer"
                                            title="Rename Category"
                                        >
                                            <Edit3 size={11} />
                                        </button>
                                        <button
                                            onClick={() => handleDeleteCategory(category)}
                                            className="text-zinc-600 hover:text-red-500 px-1.5 py-0.5 transition-colors cursor-pointer"
                                            title="Delete Category"
                                        >
                                            <Trash2 size={11} />
                                        </button>
                                    </div>
                                )}
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-2"> {/* Reduced gap-2.5 to gap-2 */}
                                {catAccounts.map(account => (
                                    <div key={account.id} id={`account-${account.id}`} className="bg-zinc-900/30 border border-zinc-800/50 rounded-xl p-3.5 hover:border-zinc-700 hover:bg-zinc-900/50 transition-all group relative"> {/* Reduced p-4 to p-3.5 */}
                                        <div className="flex justify-between items-start mb-2.5"> {/* Reduced mb-3 to mb-2.5 */}
                                            <div className="flex items-center gap-3">
                                                <div className="w-8 h-8 rounded-lg bg-zinc-950 border border-zinc-800 flex items-center justify-center text-zinc-500 font-bold text-xs shrink-0 overflow-hidden">
                                                    {account.icon ? (
                                                        iconCache[account.icon] ? (
                                                            <div className="text-lg text-zinc-300 w-[1em] h-[1em] flex items-center justify-center [&>svg]:w-full [&>svg]:h-full" dangerouslySetInnerHTML={{ __html: iconCache[account.icon] }} />
                                                        ) : (
                                                            <Icon icon={account.icon} className="text-lg text-zinc-300" />
                                                        )
                                                    ) : (
                                                        account.service.charAt(0).toUpperCase()
                                                    )}
                                                </div>
                                                <div className="overflow-hidden flex items-center gap-2">
                                                    <h3 className="font-bold text-sm text-zinc-200 truncate">{account.service}</h3>
                                                    {account.isMotherAccount && (
                                                        <span className="px-1.5 py-0.5 rounded bg-blue-500/10 text-blue-400 text-[9px] font-bold uppercase tracking-wider border border-blue-500/20 shrink-0">Main</span>
                                                    )}
                                                    {account.motherAccountId && accounts.some(a => a.id === account.motherAccountId) && (
                                                        <span className="px-1.5 py-0.5 rounded bg-purple-500/10 text-purple-400 text-[9px] font-bold uppercase tracking-wider border border-purple-500/20 shrink-0">Linked</span>
                                                    )}
                                                </div>
                                            </div>
                                            <div className="flex gap-1">
                                                {account.service === "LightningAi" && (
                                                    <button
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            toggleLightningStatus(account.id);
                                                        }}
                                                        className={`p-1.5 rounded-md transition-colors cursor-pointer ${account.lightningStatus ? 'text-red-500' : 'text-emerald-500'}`}
                                                        title="Toggle Lightning Status"
                                                    >
                                                        <Zap size={14} fill={account.lightningStatus ? "currentColor" : "none"} />
                                                    </button>
                                                )}
                                                <button onClick={() => { setDuplicatingData(null); setEditingAccount(account); setIsModalOpen(true); }} className="hover:bg-zinc-800 p-1.5 rounded-md text-zinc-500 hover:text-white transition-colors cursor-pointer" title="Edit">
                                                    <Edit3 size={14} />
                                                </button>
                                                <button onClick={() => handleDuplicate(account)} className="hover:bg-blue-900/20 p-1.5 rounded-md text-zinc-500 hover:text-blue-400 transition-colors cursor-pointer" title="Duplicate">
                                                    <Copy size={14} />
                                                </button>
                                                <button onClick={() => handleDelete(account.id)} className="hover:bg-red-900/20 p-1.5 rounded-md text-zinc-600 hover:text-red-400 transition-colors cursor-pointer" title="Delete">
                                                    <Trash2 size={14} />
                                                </button>
                                            </div>
                                        </div>

                                        <div className="space-y-1.5"> {/* Reduced space-y-2 to space-y-1.5 */}
                                            {/* Order: Username, Email, Phone, Password, 2FA */}

                                            {/* Mother Account Field */}
                                            {account.motherAccountId && (() => {
                                                const motherAcc = accounts.find(a => a.id === account.motherAccountId);
                                                if (!motherAcc) return null;
                                                return (
                                                    <div 
                                                        className="bg-purple-500/5 rounded-lg p-2.5 flex items-center justify-between border border-purple-500/20 group/field cursor-pointer hover:bg-purple-500/10 transition-colors"
                                                        onClick={() => {
                                                            const el = document.getElementById(`account-${motherAcc.id}`);
                                                            if (el) {
                                                                el.scrollIntoView({ behavior: 'smooth', block: 'center' });
                                                                el.classList.add('ring-2', 'ring-purple-500', 'ring-offset-2', 'ring-offset-black', 'bg-zinc-800/80');
                                                                setTimeout(() => {
                                                                    el.classList.remove('ring-2', 'ring-purple-500', 'ring-offset-2', 'ring-offset-black', 'bg-zinc-800/80');
                                                                }, 1500);
                                                            }
                                                        }}
                                                        title={`Go to ${motherAcc.service}`}
                                                    >
                                                        <div className="flex items-center gap-3 overflow-hidden">
                                                            <div className="w-7 h-7 rounded-md bg-purple-500/10 border border-purple-500/20 flex items-center justify-center shrink-0">
                                                                {motherAcc.icon ? (
                                                                    iconCache[motherAcc.icon] ? (
                                                                        <div className="text-sm text-purple-400 w-[1em] h-[1em] flex items-center justify-center [&>svg]:w-full [&>svg]:h-full" dangerouslySetInnerHTML={{ __html: iconCache[motherAcc.icon] }} />
                                                                    ) : (
                                                                        <Icon icon={motherAcc.icon} className="text-sm text-purple-400" />
                                                                    )
                                                                ) : (
                                                                    <span className="text-xs font-bold text-purple-400">{motherAcc.service.charAt(0).toUpperCase()}</span>
                                                                )}
                                                            </div>
                                                            <div className="flex flex-col overflow-hidden">
                                                                <div className="flex items-center gap-1.5 mb-0.5">
                                                                    <Icon icon="lucide:link" className="text-purple-400/50" width="10" />
                                                                    <span className="text-[9px] text-purple-400/60 font-bold uppercase tracking-wider">Linked to Parent</span>
                                                                </div>
                                                                <span className="text-xs text-purple-300 font-bold truncate">
                                                                    {motherAcc.service} {motherAcc.username || motherAcc.email ? `• ${motherAcc.username || motherAcc.email}` : ''}
                                                                </span>
                                                            </div>
                                                        </div>
                                                    </div>
                                                );
                                            })()}

                                            {/* Username Field */}
                                            {account.username && (
                                                <div
                                                    onClick={() => copyToClipboard(account.username, account.id, 'username')}
                                                    className="bg-black/20 rounded-lg p-2 flex items-center justify-between border border-zinc-900 cursor-pointer hover:bg-zinc-800/50 hover:border-zinc-700 transition-all group/field"
                                                >
                                                    <div className="flex items-center gap-2.5 overflow-hidden">
                                                        <User size={12} className="text-zinc-600 group-hover/field:text-zinc-400 transition-colors" />
                                                        <span className="text-xs text-zinc-400 font-bold truncate group-hover/field:text-zinc-200 transition-colors">{account.username}</span>
                                                    </div>
                                                    {copiedState?.id === account.id && copiedState?.field === 'username' ? (
                                                        <span className="text-[10px] font-bold text-emerald-500 animate-in fade-in slide-in-from-right-2 duration-300">Copied!</span>
                                                    ) : (
                                                        <Copy size={12} className="text-zinc-700 group-hover/field:text-blue-400 transition-colors" />
                                                    )}
                                                </div>
                                            )}

                                            {/* Email Field */}
                                            {account.email && (
                                                <div
                                                    onClick={() => copyToClipboard(account.email, account.id, 'email')}
                                                    className="bg-black/20 rounded-lg p-2 flex items-center justify-between border border-zinc-900 cursor-pointer hover:bg-zinc-800/50 hover:border-zinc-700 transition-all group/field"
                                                >
                                                    <div className="flex items-center gap-2.5 overflow-hidden">
                                                        <Mail size={12} className="text-zinc-600 group-hover/field:text-zinc-400 transition-colors" />
                                                        <span className="text-xs text-zinc-400 font-bold truncate group-hover/field:text-zinc-200 transition-colors">{account.email}</span>
                                                    </div>
                                                    {copiedState?.id === account.id && copiedState?.field === 'email' ? (
                                                        <span className="text-[10px] font-bold text-emerald-500 animate-in fade-in slide-in-from-right-2 duration-300">Copied!</span>
                                                    ) : (
                                                        <Copy size={12} className="text-zinc-700 group-hover/field:text-blue-400 transition-colors" />
                                                    )}
                                                </div>
                                            )}

                                            {/* Phone/2FA Field */}
                                            {account.phone && (
                                                <div
                                                    onClick={() => copyToClipboard(account.phone, account.id, 'phone')}
                                                    className="bg-black/20 rounded-lg p-2 flex items-center justify-between border border-zinc-900 cursor-pointer hover:bg-zinc-800/50 hover:border-zinc-700 transition-all group/field"
                                                >
                                                    <div className="flex items-center gap-2.5 overflow-hidden">
                                                        <PhoneIcon size={12} className="text-zinc-600 group-hover/field:text-zinc-400 transition-colors" />
                                                        <span className="text-xs text-zinc-400 font-bold truncate group-hover/field:text-zinc-200 transition-colors">{account.phone}</span>
                                                    </div>
                                                    {copiedState?.id === account.id && copiedState?.field === 'phone' ? (
                                                        <span className="text-[10px] font-bold text-emerald-500 animate-in fade-in slide-in-from-right-2 duration-300">Copied!</span>
                                                    ) : (
                                                        <Copy size={12} className="text-zinc-700 group-hover/field:text-blue-400 transition-colors" />
                                                    )}
                                                </div>
                                            )}

                                            {/* Password Field */}
                                            {account.password && (
                                                <div
                                                    onClick={() => copyToClipboard(account.password, account.id, 'password')}
                                                    className="bg-black/40 rounded-lg p-2 flex items-center justify-between border border-zinc-900 cursor-pointer hover:bg-zinc-800/50 hover:border-zinc-700 transition-all group/field"
                                                >
                                                    <div className="flex items-center gap-2.5 overflow-hidden">
                                                        <Key size={12} className="text-zinc-600 group-hover/field:text-zinc-400 transition-colors" />
                                                        <span className="text-xs text-zinc-400 font-bold truncate group-hover/field:text-zinc-200 transition-colors">{account.password}</span>
                                                    </div>
                                                    {copiedState?.id === account.id && copiedState?.field === 'password' ? (
                                                        <span className="text-[10px] font-bold text-emerald-500 animate-in fade-in slide-in-from-right-2 duration-300">Copied!</span>
                                                    ) : (
                                                        <Copy size={12} className="text-zinc-700 group-hover/field:text-blue-400 transition-colors" />
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    );
                })}

                {filteredAccounts.length === 0 && (
                    <div className="py-20 text-center opacity-30">
                        <Shield size={48} className="text-zinc-700 mx-auto mb-4" />
                        <p className="text-xs font-bold uppercase tracking-widest text-zinc-600">Vault Empty</p>
                    </div>
                )}
            </div>

            {/* Confirmation Modal */}
            <ConfirmationModal
                isOpen={confirmState.isOpen}
                onClose={closeConfirm}
                onConfirm={confirmState.onConfirm}
                message={confirmState.message}
            />

            {/* Entry/Edit Modal */}
            <AccountModal
                isOpen={isModalOpen}
                onClose={() => { setIsModalOpen(false); setEditingAccount(null); setDuplicatingData(null); }}
                onSave={handleSave}
                initialData={editingAccount || duplicatingData}
                isDuplicating={!!duplicatingData}
                categories={availableCategories}
                accounts={accounts}
                iconCache={iconCache}
            />
        </div >
    );
};



const ConfirmationModal = ({ isOpen, onClose, onConfirm, message }) => {
    const [isVisible, setIsVisible] = useState(false);
    const [isAnimatingOut, setIsAnimatingOut] = useState(false);

    useEffect(() => {
        if (isOpen) {
            setIsVisible(true);
            setIsAnimatingOut(false);
        } else if (isVisible) {
            setIsAnimatingOut(true);
            const timer = setTimeout(() => {
                setIsVisible(false);
                setIsAnimatingOut(false);
            }, 200);
            return () => clearTimeout(timer);
        }
    }, [isOpen, isVisible]);

    if (!isVisible) return null;

    return (
        <div
            className={`fixed inset-0 z-[200] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 duration-200 ${isAnimatingOut ? 'animate-out fade-out' : 'animate-in fade-in'}`}
            onMouseDown={(e) => {
                if (e.target === e.currentTarget) onClose();
            }}
        >
            <div
                className={`bg-zinc-950 border border-zinc-800 rounded-xl w-full max-w-sm shadow-2xl overflow-hidden transform transition-all duration-200 ${isAnimatingOut ? 'animate-out zoom-out-95' : 'animate-in zoom-in-95'}`}
            >
                <div className="p-6 text-center">
                    <div className="w-12 h-12 rounded-full bg-red-900/20 flex items-center justify-center mx-auto mb-4">
                        <Trash2 className="text-red-500" size={24} />
                    </div>
                    <h3 className="text-lg font-bold text-white mb-2 tracking-tight">Confirm Action</h3>
                    <p className="text-zinc-400 text-sm mb-6 leading-relaxed">
                        {message}
                    </p>
                    <div className="flex gap-3">
                        <button
                            onClick={onClose}
                            className="flex-1 bg-zinc-900 hover:bg-zinc-800 text-white py-2.5 rounded-lg text-xs font-bold uppercase tracking-wider border border-zinc-800 transition-colors cursor-pointer"
                        >
                            Cancel
                        </button>
                        <button
                            onClick={onConfirm}
                            className="flex-1 bg-red-600 hover:bg-red-500 text-white py-2.5 rounded-lg text-xs font-bold uppercase tracking-wider transition-colors shadow-lg shadow-red-900/20 cursor-pointer"
                        >
                            Confirm
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

const AccountModal = ({ isOpen, onClose, initialData, isDuplicating, onSave, categories, accounts, iconCache }) => {
    const [formData, setFormData] = useState({
        service: '',
        username: '',
        password: '',
        email: '',
        phone: '',
        category: '',
        icon: '',
        notes: '',
        isMotherAccount: false,
        motherAccountId: ''
    });

    // Animation State
    const [isVisible, setIsVisible] = useState(false);
    const [isAnimatingOut, setIsAnimatingOut] = useState(false);

    useEffect(() => {
        if (isOpen) {
            setIsVisible(true);
            setIsAnimatingOut(false);
        } else if (isVisible) {
            setIsAnimatingOut(true);
            const timer = setTimeout(() => {
                setIsVisible(false);
                setIsAnimatingOut(false);
            }, 200);
            return () => clearTimeout(timer);
        }
    }, [isOpen, isVisible]);

    // Toggles for optional fields
    const [toggles, setToggles] = useState({
        username: false,
        email: false,
        password: false,
        phone: false
    });

    const [isNewCategory, setIsNewCategory] = useState(false);

    // Icon Search State
    const [iconSearch, setIconSearch] = useState("");
    const [showIconPicker, setShowIconPicker] = useState(false);
    const [searchResults, setSearchResults] = useState([]);
    const [isSearching, setIsSearching] = useState(false);

    // Main Account Search State
    const [showMainAccountPicker, setShowMainAccountPicker] = useState(false);
    const [mainAccountSearch, setMainAccountSearch] = useState("");

    useEffect(() => {
        if (isOpen) {
            if (initialData) {
                setFormData({
                    ...initialData,
                    isMotherAccount: !!initialData.isMotherAccount,
                    motherAccountId: initialData.motherAccountId || ''
                });
                setToggles({
                    username: !!initialData.username,
                    email: !!initialData.email,
                    password: !!initialData.password,
                    phone: !!initialData.phone
                });
                setIsNewCategory(false);
                setShowIconPicker(false);
                setIconSearch("");
                setSearchResults([]);
                setShowMainAccountPicker(false);
                setMainAccountSearch("");
            } else {
                setFormData({ service: '', username: '', password: '', email: '', phone: '', category: '', icon: 'lucide:shield', notes: '', isMotherAccount: false, motherAccountId: '' }); // Set default icon
                setToggles({ username: true, email: false, password: true, phone: false }); // Pre-enable common fields for better UX
                setIsNewCategory(false);
                setShowIconPicker(false);
                setIconSearch("");
                setSearchResults([]);
                setShowMainAccountPicker(false);
                setMainAccountSearch("");
            }
        }
    }, [isOpen, initialData]);

    // Debounced Search Effect
    useEffect(() => {
        if (!iconSearch || iconSearch.length < 2) {
            setSearchResults([]);
            return;
        }

        const timeoutId = setTimeout(async () => {
            setIsSearching(true);
            try {
                const response = await fetch(`https://api.iconify.design/search?query=${encodeURIComponent(iconSearch)}&limit=5`);
                const data = await response.json();
                if (data && data.icons) {
                    setSearchResults(data.icons.slice(0, 5));
                }
            } catch (error) {
                console.error("Icon search failed:", error);
            } finally {
                setIsSearching(false);
            }
        }, 500); // 500ms debounce

        return () => clearTimeout(timeoutId);
    }, [iconSearch]);

    const handleCategoryChange = (e) => {
        const value = e.target.value;
        if (value === '__NEW__') {
            setIsNewCategory(true);
            setFormData(prev => ({ ...prev, category: '' }));
        } else {
            setIsNewCategory(false);
            setFormData(prev => ({ ...prev, category: value }));
        }
    };

    // Click Outside Handler
    const iconPickerRef = React.useRef(null);
    const mainAccountPickerRef = React.useRef(null);

    useEffect(() => {
        const handleClickOutside = (event) => {
            if (iconPickerRef.current && !iconPickerRef.current.contains(event.target)) {
                setShowIconPicker(false);
            }
            if (mainAccountPickerRef.current && !mainAccountPickerRef.current.contains(event.target)) {
                setShowMainAccountPicker(false);
            }
        };

        if (showIconPicker || showMainAccountPicker) {
            document.addEventListener("mousedown", handleClickOutside);
        }
        return () => {
            document.removeEventListener("mousedown", handleClickOutside);
        };
    }, [showIconPicker, showMainAccountPicker]);

    if (!isVisible) return null;

    return (
        <div
            className={`fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 duration-200 ${isAnimatingOut ? 'animate-out fade-out' : 'animate-in fade-in'}`}
            onMouseDown={(e) => {
                if (e.target === e.currentTarget) onClose();
            }}
        >
            <div
                className={`bg-zinc-950 border border-zinc-800 rounded-xl w-full max-w-[400px] shadow-2xl overflow-hidden flex flex-col max-h-[90vh] relative transform transition-all duration-200 ${isAnimatingOut ? 'animate-out zoom-out-95' : 'animate-in zoom-in-95'}`}
            >
                <div className="px-5 py-4 border-b border-zinc-900/50 flex justify-between items-center bg-black/40 shrink-0">
                    <h3 className="text-sm font-bold text-white tracking-tight">{isDuplicating ? 'Duplicate Credential' : initialData ? 'Edit Credential' : 'New Credential'}</h3>
                    <button onClick={onClose} className="text-zinc-500 hover:text-white transition-colors cursor-pointer">
                        <X size={16} />
                    </button>
                </div>

                <div className="p-4 space-y-4 overflow-y-auto custom-scrollbar"> {/* Reduced padding and spacing */}
                    {/* Toggles */}
                    <div>
                        <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider mb-2 block">Include Fields</label>
                        <div className="grid grid-cols-2 gap-2"> {/* Changed to grid from flex-wrap */}
                            {[
                                { key: 'username', label: 'Username', icon: <User size={12} /> },
                                { key: 'email', label: 'Email', icon: <Mail size={12} /> },
                                { key: 'password', label: 'Password', icon: <Lock size={12} /> },
                                { key: 'phone', label: 'Phone / 2FA', icon: <PhoneIcon size={12} /> }
                            ].map(item => (
                                <button
                                    key={item.key}
                                    onClick={() => setToggles(prev => ({ ...prev, [item.key]: !prev[item.key] }))}
                                    className={`px-3 py-1.5 rounded-md text-[10px] font-bold uppercase tracking-wider border transition-all flex items-center justify-center gap-2 cursor-pointer ${toggles[item.key]
                                        ? 'bg-blue-600/10 border-blue-500 text-blue-400'
                                        : 'bg-zinc-900 border-zinc-800 text-zinc-500 hover:border-zinc-700 hover:text-zinc-300'
                                        }`}
                                >
                                    {item.icon} {item.label}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Mandatory Fields */}
                    <div className="space-y-4">
                        <div className="space-y-1">
                            <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider">Service Name <span className="text-blue-500">*</span></label>
                            <div className="flex gap-2">
                                <div className="relative" ref={iconPickerRef}>
                                    <button
                                        onClick={() => setShowIconPicker(!showIconPicker)}
                                        className="w-10 h-full bg-zinc-900 border border-zinc-800 rounded-lg flex items-center justify-center text-zinc-400 hover:text-white hover:border-zinc-700 transition-colors cursor-pointer"
                                        title="Select Icon"
                                    >
                                        {formData.icon ? (
                                            iconCache && iconCache[formData.icon] ? (
                                                <div className="text-lg w-[1em] h-[1em] flex items-center justify-center [&>svg]:w-full [&>svg]:h-full" dangerouslySetInnerHTML={{ __html: iconCache[formData.icon] }} />
                                            ) : (
                                                <Icon icon={formData.icon} className="text-lg" />
                                            )
                                        ) : (
                                            <Shield className="text-zinc-400" size={18} />
                                        )}
                                    </button>

                                    {/* Icon Picker Popover */}
                                    {showIconPicker && (
                                        <div className="absolute top-12 left-0 z-50 w-64 bg-zinc-950 border border-zinc-700 rounded-xl shadow-2xl p-3 animate-in zoom-in-95 duration-150">
                                            <input
                                                className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-2 py-1.5 text-xs text-white mb-2 focus:border-blue-500 outline-none"
                                                placeholder="Search icons (e.g. google, steam)..."
                                                value={iconSearch}
                                                onChange={e => setIconSearch(e.target.value)}
                                                autoFocus
                                            />
                                            <div className="grid grid-cols-5 gap-2 relative">
                                                {isSearching && (
                                                    <div className="absolute inset-0 bg-zinc-950/80 flex items-center justify-center z-10 min-h-[40px]">
                                                        <i className="fa-solid fa-circle-notch fa-spin text-zinc-500"></i>
                                                    </div>
                                                )}

                                                {searchResults.map(iconName => (
                                                    <button
                                                        key={iconName}
                                                        onClick={() => { setFormData({ ...formData, icon: iconName }); setShowIconPicker(false); }}
                                                        className="w-8 h-8 rounded-md bg-zinc-900 hover:bg-zinc-800 flex items-center justify-center text-zinc-400 hover:text-white transition-colors border border-transparent hover:border-zinc-700 cursor-pointer"
                                                        title={iconName}
                                                    >
                                                        <Icon icon={iconName} className="text-lg" />
                                                    </button>
                                                ))}

                                                {!isSearching && searchResults.length === 0 && iconSearch.length > 2 && (
                                                    <div className="col-span-5 text-center text-[10px] text-zinc-600 py-2">
                                                        No results found
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    )}
                                </div>
                                <input
                                    className="flex-1 bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 text-xs text-white focus:border-zinc-600 outline-none transition-colors"
                                    value={formData.service}
                                    onChange={e => setFormData({ ...formData, service: e.target.value })}
                                    placeholder="e.g. Netflix"
                                    autoFocus={!initialData}
                                />
                            </div>
                        </div>

                        <div className="space-y-1">
                            <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider">Category <span className="text-blue-500">*</span></label>
                            {isNewCategory ? (
                                <div className="flex gap-2">
                                    <input
                                        className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 text-xs text-white focus:border-blue-500 outline-none transition-colors"
                                        value={formData.category}
                                        onChange={e => setFormData({ ...formData, category: e.target.value })}
                                        placeholder="Name your new category..."
                                        autoFocus
                                    />
                                    <button
                                        onClick={() => setIsNewCategory(false)}
                                        className="px-3 bg-zinc-900 border border-zinc-800 rounded-lg text-zinc-400 hover:text-white cursor-pointer"
                                        title="Cancel new category"
                                    >
                                        <X size={14} />
                                    </button>
                                </div>
                            ) : (
                                <div className="relative">
                                    <select
                                        className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 text-xs text-white focus:border-zinc-600 outline-none transition-colors appearance-none"
                                        value={formData.category}
                                        onChange={handleCategoryChange}
                                    >
                                        <option value="" disabled>Select a category...</option>
                                        {categories.map(cat => (
                                            <option key={cat} value={cat}>{cat}</option>
                                        ))}
                                        <option disabled>──────────</option>
                                        <option value="__NEW__" className="font-bold text-blue-400">+ Create New Category</option>
                                    </select>
                                    <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-600 pointer-events-none" />
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Linking Options */}
                    <div className="space-y-3 pt-3 border-t border-zinc-900/50">
                        <label className="flex items-center gap-2 cursor-pointer group w-fit">
                            <div className={`w-4 h-4 rounded border flex items-center justify-center transition-colors ${formData.isMotherAccount ? 'bg-blue-500 border-blue-500 text-white' : 'bg-transparent border-zinc-700 text-transparent group-hover:border-zinc-500'}`}>
                                <Icon icon="lucide:check" width="12" />
                            </div>
                            <span className="text-xs text-zinc-400 group-hover:text-zinc-300">Mark as Main Account</span>
                            <input
                                type="checkbox"
                                className="hidden"
                                checked={formData.isMotherAccount}
                                onChange={(e) => setFormData({ ...formData, isMotherAccount: e.target.checked, motherAccountId: e.target.checked ? '' : formData.motherAccountId })}
                            />
                        </label>
                        {!formData.isMotherAccount && (
                            <div className="space-y-1 relative" ref={mainAccountPickerRef}>
                                <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider">Link to Main Account</label>
                                <div
                                    className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 text-xs text-white focus:border-zinc-600 outline-none transition-colors cursor-pointer flex items-center justify-between"
                                    onClick={() => setShowMainAccountPicker(!showMainAccountPicker)}
                                >
                                    <span className="truncate">
                                        {formData.motherAccountId ? (
                                            (() => {
                                                const a = accounts.find(acc => acc.id === formData.motherAccountId);
                                                return a ? `${a.service} ${a.username || a.email ? `(${a.username || a.email})` : ''}` : 'None';
                                            })()
                                        ) : 'None'}
                                    </span>
                                    <ChevronDown size={14} className="text-zinc-600" />
                                </div>
                                {showMainAccountPicker && (
                                    <div className="absolute top-[calc(100%+4px)] left-0 z-50 w-full bg-zinc-950 border border-zinc-700 rounded-xl shadow-2xl p-2 animate-in zoom-in-95 duration-150">
                                        <input
                                            className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-2 py-1.5 text-xs text-white mb-2 focus:border-blue-500 outline-none"
                                            placeholder="Search main accounts..."
                                            value={mainAccountSearch}
                                            onChange={e => setMainAccountSearch(e.target.value)}
                                            autoFocus
                                            onClick={(e) => e.stopPropagation()}
                                        />
                                        <div className="max-h-40 overflow-y-auto custom-scrollbar space-y-1">
                                            <div
                                                className="px-2 py-1.5 text-xs text-zinc-400 hover:text-white hover:bg-zinc-800 rounded-lg cursor-pointer transition-colors border border-transparent hover:border-zinc-700"
                                                onClick={() => { setFormData({ ...formData, motherAccountId: '' }); setShowMainAccountPicker(false); setMainAccountSearch(""); }}
                                            >
                                                None
                                            </div>
                                            {accounts
                                                .filter(a => a.isMotherAccount && a.id !== initialData?.id)
                                                .filter(a => {
                                                    const term = mainAccountSearch.toLowerCase();
                                                    return !term ||
                                                        (a.service || '').toLowerCase().includes(term) ||
                                                        (a.email || '').toLowerCase().includes(term) ||
                                                        (a.username || '').toLowerCase().includes(term);
                                                })
                                                .map(a => (
                                                    <div
                                                        key={a.id}
                                                        className="px-2 py-1.5 text-xs text-zinc-300 hover:text-white hover:bg-zinc-800 rounded-lg cursor-pointer transition-colors truncate border border-transparent hover:border-zinc-700"
                                                        onClick={() => { setFormData({ ...formData, motherAccountId: a.id }); setShowMainAccountPicker(false); setMainAccountSearch(""); }}
                                                    >
                                                        {a.service} {a.username || a.email ? <span className="text-zinc-500 shrink-0">({a.username || a.email})</span> : ''}
                                                    </div>
                                                ))
                                            }
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>

                    {/* Conditional Fields */}
                    <div className="space-y-3 animate-in fade-in duration-300">
                        {toggles.username && (
                            <FieldWithHistory
                                labelText="Username"
                                fieldKey="username"
                                value={formData.username}
                                onChange={val => setFormData({ ...formData, username: val })}
                                accounts={accounts}
                                isAutoFocus
                            />
                        )}
                        {toggles.email && (
                            <FieldWithHistory
                                labelText="Email Address"
                                fieldKey="email"
                                value={formData.email}
                                onChange={val => setFormData({ ...formData, email: val })}
                                accounts={accounts}
                                isAutoFocus
                            />
                        )}
                        {toggles.password && (
                            <FieldWithHistory
                                labelText="Password"
                                fieldKey="password"
                                value={formData.password}
                                onChange={val => setFormData({ ...formData, password: val })}
                                type="text"
                                accounts={accounts}
                                isAutoFocus
                            />
                        )}
                        {toggles.phone && (
                            <FieldWithHistory
                                labelText="Phone / 2FA Secret"
                                fieldKey="phone"
                                value={formData.phone}
                                onChange={val => setFormData({ ...formData, phone: val })}
                                accounts={accounts}
                                isAutoFocus
                            />
                        )}
                    </div>
                </div>

                <div className="px-5 py-4 border-t border-zinc-900/50 flex justify-end gap-2 bg-black/20 shrink-0">
                    <button onClick={onClose} className="px-4 py-2 rounded-lg text-zinc-500 hover:text-white text-[10px] font-bold uppercase tracking-wider transition-colors cursor-pointer">Cancel</button>
                    <button
                        onClick={() => {
                            const cleanedData = { ...formData };
                            if (!toggles.username) cleanedData.username = '';
                            if (!toggles.email) cleanedData.email = '';
                            if (!toggles.password) cleanedData.password = '';
                            if (!toggles.phone) cleanedData.phone = '';
                            if (cleanedData.isMotherAccount) cleanedData.motherAccountId = '';
                            onSave(cleanedData);
                        }}
                        disabled={!formData.service || !formData.category} // Validation
                        className="px-6 py-2 bg-zinc-100 hover:bg-white text-black rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                    >
                        Save Entry
                    </button>
                </div>
            </div>
        </div >
    )
}

const FieldWithHistory = ({ labelText, fieldKey, value, onChange, type = "text", accounts = [], isAutoFocus = false }) => {
    const [isOpen, setIsOpen] = useState(false);
    const dropdownRef = React.useRef(null);

    useEffect(() => {
        const handleClickOutside = (event) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
                setIsOpen(false);
            }
        };

        if (isOpen) {
            document.addEventListener("mousedown", handleClickOutside);
        }
        return () => {
            document.removeEventListener("mousedown", handleClickOutside);
        };
    }, [isOpen]);

    const uniqueValues = React.useMemo(() => {
        if (!accounts) return [];
        const values = accounts.map(a => a[fieldKey]).filter(v => v !== undefined && v !== null && String(v).trim() !== '');
        return [...new Set(values)];
    }, [accounts, fieldKey]);

    return (
        <div className="space-y-1 animate-in slide-in-from-left-2 duration-300">
            <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider">{labelText}</label>
            <div className="flex gap-2 relative" ref={dropdownRef}>
                <input
                    className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 text-xs text-white focus:border-blue-500 outline-none transition-colors"
                    value={value}
                    onChange={e => onChange(e.target.value)}
                    type={type}
                    autoFocus={isAutoFocus}
                />
                <button
                    type="button"
                    onClick={() => setIsOpen(!isOpen)}
                    className="w-10 flex-shrink-0 bg-zinc-900 border border-zinc-800 rounded-lg flex items-center justify-center text-zinc-400 hover:text-white hover:border-zinc-700 transition-colors cursor-pointer"
                    title={`Saved ${labelText}s`}
                >
                    <History size={14} />
                </button>

                {isOpen && (
                    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-200" onMouseDown={(e) => { if (e.target === e.currentTarget) setIsOpen(false); }}>
                        <div
                            className="bg-zinc-950 border border-zinc-800 rounded-xl w-full max-w-sm shadow-2xl overflow-hidden flex flex-col max-h-[80vh] animate-in zoom-in-95 duration-200"
                        >
                            <div className="px-5 py-4 border-b border-zinc-900/50 flex justify-between items-center bg-black/40 shrink-0">
                                <h3 className="text-sm font-bold text-white tracking-tight">Select {labelText}</h3>
                                <button type="button" onClick={() => setIsOpen(false)} className="text-zinc-500 hover:text-white transition-colors cursor-pointer">
                                    <X size={16} />
                                </button>
                            </div>
                            <div className="p-2 overflow-y-auto custom-scrollbar">
                                {uniqueValues.length > 0 ? (
                                    <div className="space-y-1">
                                        {uniqueValues.map((val, idx) => (
                                            <div
                                                key={idx}
                                                className="px-4 py-3 text-sm text-zinc-300 hover:text-white hover:bg-zinc-800 rounded-lg cursor-pointer transition-colors truncate border border-transparent hover:border-zinc-700"
                                                onClick={() => {
                                                    onChange(val);
                                                    setIsOpen(false);
                                                }}
                                            >
                                                {val}
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <div className="py-8 text-sm text-zinc-600 text-center">
                                        No saved records found.
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default Accounts;
