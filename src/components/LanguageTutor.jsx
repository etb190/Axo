import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import Navbar from './Navbar';
import chevronLeftIcon from '../assets/icons/chevron-left.svg';
import chevronRightIcon from '../assets/icons/chevron-right.svg';
import chevronDownIcon from '../assets/icons/chevron-down.svg';
import brainIcon from '../assets/icons/brain.svg';
import messageIcon from '../assets/icons/message.svg';
import loaderIcon from '../assets/icons/loader.svg';
import playIcon from '../assets/icons/play.svg';
import stopIcon from '../assets/icons/stop.svg';
import panelLeftCloseIcon from '../assets/icons/panel-left-close.svg';
import panelLeftOpenIcon from '../assets/icons/panel-left-open.svg';

const { readFile, writeFile, mkdir } = window.require('fs').promises;
const path = window.require('path');
const BASE_PATH = 'C:\\Users\\PC\\Desktop\\database\\LanguageLearning\\Learning';
const OLLAMA_URL = 'http://localhost:11434/api/chat';
const OLLAMA_MODEL = 'llama3';

// ─── Lesson Curriculum Structure ───────────────────────────────────────────
const CURRICULUM = [
    {
        id: 'introductory',
        label: 'Introductory',
        accent: '#6b7280',
        accentBg: 'rgba(107,114,128,0.08)',
        lessons: [
            { id: 'intro-alphabet', title: 'Alphabet & Sounds' },
            { id: 'intro-greetings', title: 'Greetings' },
            { id: 'intro-numbers', title: 'Numbers 1–20' },
            { id: 'intro-colors', title: 'Colors' },
            { id: 'intro-days', title: 'Days & Months' },
        ],
    },
    {
        id: 'basic',
        label: 'Basic',
        accent: '#3b82f6',
        accentBg: 'rgba(59,130,246,0.08)',
        lessons: [
            { id: 'basic-pronouns', title: 'Pronouns' },
            { id: 'basic-verbs', title: 'Core Verbs' },
            { id: 'basic-nouns', title: 'Everyday Nouns' },
            { id: 'basic-questions', title: 'Simple Questions' },
            { id: 'basic-food', title: 'Food & Drink' },
            { id: 'basic-family', title: 'Family Members' },
        ],
    },
    {
        id: 'intermediate',
        label: 'Intermediate',
        accent: '#f59e0b',
        accentBg: 'rgba(245,158,11,0.08)',
        lessons: [
            { id: 'int-tenses', title: 'Past & Future Tenses' },
            { id: 'int-adjectives', title: 'Adjectives' },
            { id: 'int-adverbs', title: 'Adverbs' },
            { id: 'int-conversation', title: 'Real Conversations' },
            { id: 'int-travel', title: 'Travel Phrases' },
            { id: 'int-work', title: 'Work & School' },
        ],
    },
    {
        id: 'fluent',
        label: 'Fluent',
        accent: '#10b981',
        accentBg: 'rgba(16,185,129,0.08)',
        lessons: [
            { id: 'flu-idioms', title: 'Idioms & Slang' },
            { id: 'flu-conditionals', title: 'Conditionals' },
            { id: 'flu-subjunctive', title: 'Subjunctive Mood' },
            { id: 'flu-culture', title: 'Culture & Context' },
            { id: 'flu-debate', title: 'Debate & Opinion' },
            { id: 'flu-literature', title: 'Literature Snippets' },
        ],
    },
];

// ─── Ollama Streaming Hook ──────────────────────────────────────────────────
const useOllama = () => {
    const abortRef = useRef(null);
    const [streaming, setStreaming] = useState(false);

    const chat = useCallback(async (messages, onToken, onDone) => {
        if (abortRef.current) abortRef.current.abort();
        abortRef.current = new AbortController();
        setStreaming(true);
        try {
            const res = await fetch(OLLAMA_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ model: OLLAMA_MODEL, messages, stream: true }),
                signal: abortRef.current.signal,
            });
            if (!res.ok) throw new Error(`Ollama error: ${res.status}`);
            const reader = res.body.getReader();
            const decoder = new TextDecoder();
            let buffer = '';
            while (true) {
                const { done, value } = await reader.read();
                if (done) break;
                buffer += decoder.decode(value, { stream: true });
                const lines = buffer.split('\n');
                buffer = lines.pop();
                for (const line of lines) {
                    if (!line.trim()) continue;
                    try {
                        const obj = JSON.parse(line);
                        if (obj.message?.content) onToken(obj.message.content);
                        if (obj.done) { onDone(); break; }
                    } catch {}
                }
            }
        } catch (e) {
            if (e.name !== 'AbortError') {
                onToken('\n\n_[Ollama connection error — is the app running on localhost:11434?]_');
                onDone();
            }
        } finally {
            setStreaming(false);
        }
    }, []);

    const abort = () => { if (abortRef.current) abortRef.current.abort(); setStreaming(false); };
    return { chat, abort, streaming };
};

// ─── Main Component ─────────────────────────────────────────────────────────
const LanguageTutor = () => {
    const { language: langId } = useParams();
    const navigate = useNavigate();
    const { chat, abort, streaming } = useOllama();

    const [langName, setLangName] = useState(langId || 'Language');
    const [sidebarOpen, setSidebarOpen] = useState(true);
    const [expandedCategories, setExpandedCategories] = useState({ introductory: true });
    const [activeLesson, setActiveLesson] = useState(null);
    const [messages, setMessages] = useState([]);
    const [inputValue, setInputValue] = useState('');
    const [progress, setProgress] = useState({});
    const bottomRef = useRef(null);
    const inputRef = useRef(null);

    // Load meta & progress
    useEffect(() => {
        const load = async () => {
            if (!langId) return;
            try {
                const metaRaw = await readFile(path.join(BASE_PATH, langId, 'meta.json'), 'utf8');
                const meta = JSON.parse(metaRaw);
                setLangName(meta.name);
            } catch {}
            try {
                const progRaw = await readFile(path.join(BASE_PATH, langId, 'progress.json'), 'utf8');
                setProgress(JSON.parse(progRaw));
            } catch {}
        };
        load();
    }, [langId]);

    // Auto-scroll
    useEffect(() => {
        bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    const saveProgress = async (lessonId) => {
        const updated = { ...progress, [lessonId]: { visited: true, lastSeen: new Date().toISOString() } };
        setProgress(updated);
        try {
            await writeFile(path.join(BASE_PATH, langId, 'progress.json'), JSON.stringify(updated, null, 2));
        } catch {}
    };

    const buildSystemPrompt = (lesson) => {
        const cat = CURRICULUM.find(c => c.lessons.some(l => l.id === lesson.id));
        return `You are an expert ${langName} language tutor. You are currently teaching the "${lesson.title}" lesson from the "${cat?.label}" level.

Your style:
- Compact and clear. No fluff.
- Use examples in ${langName} with English translations in parentheses.
- Ask the student to practice after each concept.
- Adapt difficulty to the ${cat?.label} level.
- Start this lesson immediately by introducing the topic concisely.`;
    };

    const startLesson = async (lesson) => {
        setActiveLesson(lesson);
        setMessages([]);
        await saveProgress(lesson.id);
        const system = buildSystemPrompt(lesson);
        const initMessages = [{ role: 'system', content: system }];
        const assistantMsg = { id: Date.now(), role: 'assistant', content: '' };
        setMessages([assistantMsg]);
        chat(
            initMessages,
            (token) => setMessages(prev => prev.map(m => m.id === assistantMsg.id ? { ...m, content: m.content + token } : m)),
            () => {}
        );
    };

    const sendMessage = () => {
        const text = inputValue.trim();
        if (!text || streaming || !activeLesson) return;
        setInputValue('');

        const userMsg = { id: Date.now(), role: 'user', content: text };
        const assistantMsg = { id: Date.now() + 1, role: 'assistant', content: '' };

        setMessages(prev => [...prev, userMsg, assistantMsg]);

        const historyMessages = [
            { role: 'system', content: buildSystemPrompt(activeLesson) },
            ...messages.map(m => ({ role: m.role, content: m.content })),
            { role: 'user', content: text },
        ];

        chat(
            historyMessages,
            (token) => setMessages(prev => prev.map(m => m.id === assistantMsg.id ? { ...m, content: m.content + token } : m)),
            () => {}
        );
    };

    const toggleCategory = (id) => {
        setExpandedCategories(prev => ({ ...prev, [id]: !prev[id] }));
    };

    const completedCount = Object.keys(progress).length;
    const totalLessons = CURRICULUM.reduce((s, c) => s + c.lessons.length, 0);

    return (
        <div className="fixed inset-0 bg-[#070707]">
            <Navbar />
            <div className="absolute inset-0 left-12 flex overflow-hidden">
            <style>{`
                .tutor-scrollbar::-webkit-scrollbar { width: 2px; }
                .tutor-scrollbar::-webkit-scrollbar-track { background: transparent; }
                .tutor-scrollbar::-webkit-scrollbar-thumb { background: #1f1f1f; border-radius: 4px; }
                .msg-in { animation: msgIn 0.2s ease-out; }
                @keyframes msgIn { from { opacity: 0; transform: translateY(4px); } to { opacity: 1; transform: none; } }
                .cursor-blink::after { content: '▋'; animation: blink 1s step-end infinite; font-size: 0.75em; }
                @keyframes blink { 50% { opacity: 0; } }
                .lesson-row { transition: background 0.15s, color 0.15s; }
                .lesson-row:hover { background: rgba(255,255,255,0.04); }
            `}</style>

            {/* ── Sidebar ── */}
            <div
                className="flex-shrink-0 flex flex-col border-r border-white/5 bg-[#080808] overflow-hidden transition-all duration-300"
                style={{ width: sidebarOpen ? '220px' : '0px', minWidth: sidebarOpen ? '220px' : '0px' }}
            >
                <div className="flex-shrink-0 px-4 py-3 border-b border-white/5">
                    {/* Back + Language title */}
                    <button
                        onClick={() => navigate('/Language/learning')}
                        className="flex items-center gap-1.5 text-slate-600 hover:text-slate-300 transition-colors mb-3 cursor-pointer group"
                    >
                        <img src={chevronLeftIcon} className="w-3 h-3 filter brightness-0 invert opacity-30 group-hover:opacity-60 transition-opacity" alt="" />
                        <span className="text-[9px] uppercase tracking-widest font-bold">All Languages</span>
                    </button>
                    <h2 className="text-xs font-bold text-slate-200 uppercase tracking-wide truncate">{langName}</h2>
                    {/* Progress bar */}
                    <div className="mt-2 flex items-center gap-2">
                        <div className="flex-1 h-0.5 bg-white/5 rounded-full overflow-hidden">
                            <div
                                className="h-full bg-white/25 rounded-full transition-all duration-500"
                                style={{ width: `${totalLessons > 0 ? (completedCount / totalLessons) * 100 : 0}%` }}
                            />
                        </div>
                        <span className="text-[9px] text-slate-700 font-mono">{completedCount}/{totalLessons}</span>
                    </div>
                </div>

                {/* Lesson categories */}
                <div className="flex-1 overflow-y-auto tutor-scrollbar py-2">
                    {CURRICULUM.map(cat => (
                        <div key={cat.id}>
                            {/* Category header */}
                            <button
                                onClick={() => toggleCategory(cat.id)}
                                className="w-full flex items-center justify-between px-4 py-2 text-left cursor-pointer group hover:bg-white/3 transition-colors"
                            >
                                <div className="flex items-center gap-2">
                                    <div className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: cat.accent }} />
                                    <span className="text-[10px] font-bold uppercase tracking-widest" style={{ color: cat.accent }}>
                                        {cat.label}
                                    </span>
                                </div>
                                <img
                                    src={chevronDownIcon}
                                    className="w-3 h-3 filter brightness-0 invert opacity-20 transition-transform duration-200"
                                    style={{ transform: expandedCategories[cat.id] ? 'rotate(0deg)' : 'rotate(-90deg)' }}
                                    alt=""
                                />
                            </button>

                            {/* Lessons list */}
                            {expandedCategories[cat.id] && (
                                <div className="pb-1">
                                    {cat.lessons.map(lesson => {
                                        const done = !!progress[lesson.id];
                                        const active = activeLesson?.id === lesson.id;
                                        return (
                                            <button
                                                key={lesson.id}
                                                onClick={() => startLesson(lesson)}
                                                className="lesson-row w-full flex items-center gap-2.5 px-4 py-1.5 text-left cursor-pointer"
                                                style={{
                                                    background: active ? cat.accentBg : undefined,
                                                    borderLeft: active ? `2px solid ${cat.accent}` : '2px solid transparent',
                                                }}
                                            >
                                                {/* Visited dot */}
                                                <div
                                                    className="w-1.5 h-1.5 rounded-full flex-shrink-0 transition-colors"
                                                    style={{ background: done ? cat.accent : '#1f1f1f' }}
                                                />
                                                <span className={`text-[10px] leading-snug font-medium truncate transition-colors ${
                                                    active ? 'text-slate-200' : done ? 'text-slate-500' : 'text-slate-600'
                                                }`}>
                                                    {lesson.title}
                                                </span>
                                            </button>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            </div>

            {/* ── Main content ── */}
            <div className="flex-1 flex flex-col overflow-hidden relative">
                {/* Topbar */}
                <div className="flex items-center gap-3 px-4 py-3 border-b border-white/5 flex-shrink-0">
                    <button
                        onClick={() => setSidebarOpen(o => !o)}
                        className="w-7 h-7 flex items-center justify-center hover:bg-white/5 rounded-lg transition-colors cursor-pointer flex-shrink-0"
                    >
                        <img
                            src={sidebarOpen ? panelLeftCloseIcon : panelLeftOpenIcon}
                            className="w-3.5 h-3.5 filter brightness-0 invert opacity-30 hover:opacity-60 transition-opacity"
                            alt=""
                        />
                    </button>

                    {activeLesson ? (
                        <div className="flex items-center gap-2 min-w-0">
                            <span className="text-[9px] text-slate-600 uppercase tracking-widest font-bold flex-shrink-0">
                                {CURRICULUM.find(c => c.lessons.some(l => l.id === activeLesson.id))?.label}
                            </span>
                            <span className="text-slate-700 text-[9px]">/</span>
                            <span className="text-xs text-slate-300 font-medium truncate">{activeLesson.title}</span>
                        </div>
                    ) : (
                        <span className="text-[10px] text-slate-700 italic">Select a lesson from the sidebar</span>
                    )}

                    {streaming && (
                        <div className="ml-auto flex items-center gap-1.5">
                            <img src={loaderIcon} className="w-3 h-3 filter brightness-0 invert opacity-30 animate-spin" alt="" />
                            <button
                                onClick={abort}
                                className="flex items-center gap-1 px-2 py-0.5 bg-white/5 hover:bg-white/10 rounded text-[9px] text-slate-500 hover:text-slate-300 transition-all cursor-pointer"
                            >
                                <img src={stopIcon} className="w-2.5 h-2.5 filter brightness-0 invert opacity-40" alt="" />
                                Stop
                            </button>
                        </div>
                    )}
                </div>

                {/* Chat area */}
                <div className="flex-1 overflow-y-auto tutor-scrollbar px-5 py-4 space-y-4">
                    {messages.length === 0 && !activeLesson && (
                        <div className="flex flex-col items-center justify-center h-full gap-3 text-center select-none">
                            <img src={brainIcon} className="w-8 h-8 filter brightness-0 invert opacity-10" alt="" />
                            <div>
                                <p className="text-[10px] text-slate-700 uppercase tracking-widest font-bold">Tutor Ready</p>
                                <p className="text-[9px] text-slate-800 mt-1">Choose a lesson to begin</p>
                            </div>
                        </div>
                    )}

                    {messages.map((msg) => (
                        <div key={msg.id} className={`msg-in flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                            {msg.role === 'assistant' && (
                                <div className="w-5 h-5 rounded-md bg-white/5 border border-white/8 flex items-center justify-center flex-shrink-0 mr-2 mt-0.5">
                                    <img src={brainIcon} className="w-2.5 h-2.5 filter brightness-0 invert opacity-40" alt="" />
                                </div>
                            )}
                            <div
                                className={`max-w-[80%] rounded-xl px-3 py-2 text-[11px] leading-relaxed whitespace-pre-wrap ${
                                    msg.role === 'user'
                                        ? 'bg-white/8 text-slate-200 rounded-tr-sm'
                                        : 'bg-transparent text-slate-300 rounded-tl-sm'
                                } ${msg.role === 'assistant' && streaming && msg === messages[messages.length - 1] && !msg.content.endsWith(' ') ? 'cursor-blink' : ''}`}
                            >
                                {msg.content || (msg.role === 'assistant' ? <span className="text-slate-700 italic text-[10px]">Thinking…</span> : null)}
                            </div>
                        </div>
                    ))}
                    <div ref={bottomRef} />
                </div>

                {/* Input */}
                {activeLesson && (
                    <div className="flex-shrink-0 px-4 py-3 border-t border-white/5">
                        <div className="flex items-center gap-2 bg-white/4 border border-white/8 rounded-xl px-3 py-2 focus-within:border-white/15 transition-colors">
                            <img src={messageIcon} className="w-3 h-3 filter brightness-0 invert opacity-20 flex-shrink-0" alt="" />
                            <input
                                ref={inputRef}
                                type="text"
                                value={inputValue}
                                onChange={e => setInputValue(e.target.value)}
                                onKeyDown={e => e.key === 'Enter' && !e.shiftKey && sendMessage()}
                                placeholder="Type your answer or question..."
                                disabled={streaming}
                                className="flex-1 bg-transparent text-xs text-slate-200 placeholder:text-slate-700 focus:outline-none disabled:opacity-50"
                            />
                            <button
                                onClick={sendMessage}
                                disabled={!inputValue.trim() || streaming}
                                className="w-6 h-6 flex items-center justify-center bg-white/8 hover:bg-white/15 disabled:opacity-20 rounded-lg transition-all cursor-pointer disabled:cursor-not-allowed flex-shrink-0"
                            >
                                <img src={playIcon} className="w-3 h-3 filter brightness-0 invert opacity-60" alt="send" />
                            </button>
                        </div>
                        <p className="text-[9px] text-slate-800 mt-1.5 text-center">Enter to send · Powered by Ollama</p>
                    </div>
                )}
            </div>
            </div>
        </div>
    );
};

export default LanguageTutor;
