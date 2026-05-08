import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import plusIcon from '../assets/icons/plus.svg';
import brainIcon from '../assets/icons/brain.svg';
import closeIcon from '../assets/icons/close.svg';
import checkIcon from '../assets/icons/check.svg';
import loaderIcon from '../assets/icons/loader.svg';
import chevronRightIcon from '../assets/icons/chevron-right.svg';

const { readdir, writeFile, readFile, mkdir } = window.require('fs').promises;
const path = window.require('path');

const BASE_PATH = 'C:\\Users\\PC\\Desktop\\database\\LanguageLearning\\Learning';

const Learning = () => {
    const navigate = useNavigate();
    const [languages, setLanguages] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [creating, setCreating] = useState(false);
    const [inputName, setInputName] = useState('');
    const [inputRef] = useState(React.createRef());

    useEffect(() => {
        const init = async () => {
            try {
                await mkdir(BASE_PATH, { recursive: true });
                await loadLanguages();
            } catch (e) {
                console.error(e);
                setIsLoading(false);
            }
        };
        init();
    }, []);

    useEffect(() => {
        if (creating && inputRef.current) inputRef.current.focus();
    }, [creating]);

    const loadLanguages = async () => {
        setIsLoading(true);
        try {
            const entries = await readdir(BASE_PATH, { withFileTypes: true });
            const langs = [];
            for (const e of entries) {
                if (e.isDirectory()) {
                    try {
                        const meta = await readFile(path.join(BASE_PATH, e.name, 'meta.json'), 'utf8');
                        langs.push(JSON.parse(meta));
                    } catch {}
                }
            }
            langs.sort((a, b) => new Date(b.created) - new Date(a.created));
            setLanguages(langs);
        } catch (e) {
            console.error(e);
        } finally {
            setIsLoading(false);
        }
    };

    const handleCreate = async () => {
        const name = inputName.trim();
        if (!name) return;
        const id = name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
        const dir = path.join(BASE_PATH, id);
        const meta = { id, name, created: new Date().toISOString() };
        try {
            await mkdir(dir, { recursive: true });
            await writeFile(path.join(dir, 'meta.json'), JSON.stringify(meta, null, 2));
            await writeFile(path.join(dir, 'progress.json'), JSON.stringify({}, null, 2));
            setLanguages(prev => [meta, ...prev]);
            setInputName('');
            setCreating(false);
        } catch (e) {
            console.error(e);
        }
    };

    const handleKeyDown = (e) => {
        if (e.key === 'Enter') handleCreate();
        if (e.key === 'Escape') { setCreating(false); setInputName(''); }
    };

    // Subtle flag-like color accents per language initial
    const getAccent = (name) => {
        const colors = [
            'from-amber-500/10 to-transparent border-t-amber-500/20',
            'from-sky-500/10 to-transparent border-t-sky-500/20',
            'from-emerald-500/10 to-transparent border-t-emerald-500/20',
            'from-rose-500/10 to-transparent border-t-rose-500/20',
            'from-violet-500/10 to-transparent border-t-violet-500/20',
            'from-orange-500/10 to-transparent border-t-orange-500/20',
            'from-teal-500/10 to-transparent border-t-teal-500/20',
        ];
        const idx = (name.charCodeAt(0) || 0) % colors.length;
        return colors[idx];
    };

    if (isLoading) {
        return (
            <div className="flex-1 flex items-center justify-center">
                <img src={loaderIcon} className="w-4 h-4 filter brightness-0 invert opacity-20 animate-spin" alt="" />
            </div>
        );
    }

    return (
        <div className="flex-1 flex flex-col h-full overflow-hidden">
            <style>{`
                .lang-card { transition: border-color 0.2s, background 0.2s, transform 0.15s; }
                .lang-card:hover { transform: translateY(-1px); }
                @keyframes fadeSlideIn {
                    from { opacity: 0; transform: translateY(6px); }
                    to   { opacity: 1; transform: translateY(0); }
                }
                .anim-in { animation: fadeSlideIn 0.25s ease-out forwards; }
            `}</style>

            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-white/5 flex-shrink-0">
                <div>
                    <h1 className="text-xs font-bold text-slate-200 uppercase tracking-[0.18em]">Learning</h1>
                    <p className="text-[9px] text-slate-600 uppercase tracking-widest mt-0.5">
                        {languages.length} {languages.length === 1 ? 'Language' : 'Languages'}
                    </p>
                </div>
                <button
                    onClick={() => setCreating(true)}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-white/5 hover:bg-white/10 border border-white/8 text-slate-400 hover:text-slate-200 rounded-lg text-[10px] font-bold uppercase tracking-widest transition-all active:scale-95 cursor-pointer"
                >
                    <img src={plusIcon} className="w-3 h-3 filter brightness-0 invert opacity-50" alt="" />
                    New
                </button>
            </div>

            {/* Inline create input */}
            {creating && (
                <div className="px-5 py-3 border-b border-white/5 bg-white/2 flex-shrink-0 anim-in">
                    <div className="flex items-center gap-2">
                        <img src={brainIcon} className="w-3.5 h-3.5 filter brightness-0 invert opacity-30 flex-shrink-0" alt="" />
                        <input
                            ref={inputRef}
                            type="text"
                            value={inputName}
                            onChange={e => setInputName(e.target.value)}
                            onKeyDown={handleKeyDown}
                            placeholder="Language name..."
                            className="flex-1 bg-transparent text-slate-200 text-xs placeholder:text-slate-700 focus:outline-none"
                        />
                        <button
                            onClick={handleCreate}
                            disabled={!inputName.trim()}
                            className="w-6 h-6 flex items-center justify-center bg-white/10 hover:bg-white/20 disabled:opacity-20 rounded-md transition-all cursor-pointer disabled:cursor-not-allowed"
                        >
                            <img src={checkIcon} className="w-3 h-3 filter brightness-0 invert opacity-60" alt="confirm" />
                        </button>
                        <button
                            onClick={() => { setCreating(false); setInputName(''); }}
                            className="w-6 h-6 flex items-center justify-center hover:bg-white/5 rounded-md transition-all cursor-pointer"
                        >
                            <img src={closeIcon} className="w-3 h-3 filter brightness-0 invert opacity-30" alt="cancel" />
                        </button>
                    </div>
                </div>
            )}

            {/* Language Grid */}
            <div className="flex-1 overflow-y-auto custom-scrollbar p-5">
                {languages.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-full gap-4 text-center select-none">
                        <div className="w-12 h-12 rounded-xl bg-white/3 border border-white/5 flex items-center justify-center">
                            <img src={brainIcon} className="w-5 h-5 filter brightness-0 invert opacity-15" alt="" />
                        </div>
                        <div>
                            <p className="text-[10px] text-slate-600 uppercase tracking-widest font-bold">No languages yet</p>
                            <p className="text-[9px] text-slate-700 mt-1">Click "New" to begin learning</p>
                        </div>
                    </div>
                ) : (
                    <div className="grid gap-2" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))' }}>
                        {languages.map((lang, i) => (
                            <div
                                key={lang.id}
                                onClick={() => navigate(`/Language/tutor/${lang.id}`)}
                                className={`lang-card anim-in group relative bg-[#0d0d0d] border border-white/5 hover:border-white/12 rounded-xl p-4 cursor-pointer bg-gradient-to-b ${getAccent(lang.name)} overflow-hidden`}
                                style={{ animationDelay: `${i * 40}ms` }}
                            >
                                {/* Language initial badge */}
                                <div className="w-8 h-8 rounded-lg bg-white/5 border border-white/8 flex items-center justify-center mb-3 group-hover:bg-white/8 transition-colors">
                                    <span className="text-sm font-bold text-slate-300 uppercase leading-none">
                                        {lang.name.charAt(0)}
                                    </span>
                                </div>

                                <h3 className="text-xs font-bold text-slate-300 group-hover:text-slate-100 transition-colors leading-tight mb-1 truncate">
                                    {lang.name}
                                </h3>
                                <p className="text-[9px] text-slate-700 uppercase tracking-wider">
                                    {new Date(lang.created).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}
                                </p>

                                <div className="absolute bottom-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity">
                                    <img src={chevronRightIcon} className="w-3 h-3 filter brightness-0 invert opacity-40" alt="" />
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
};

export default Learning;
