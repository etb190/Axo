import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import Navbar from './Navbar';
import plusIcon from '../assets/icons/plus.svg';
import conceptsIcon from '../assets/icons/concepts.svg';
import chevronLeftIcon from '../assets/icons/chevron-left.svg';
import chevronRightIcon from '../assets/icons/chevron-right.svg';
import brainIcon from '../assets/icons/brain.svg';
import messageIcon from '../assets/icons/message.svg';
import deleteIcon from '../assets/icons/delete.svg';
import checkIcon from '../assets/icons/check.svg';
import loaderIcon from '../assets/icons/loader.svg';
import zapIcon from '../assets/icons/zap.svg';
import editIcon from '../assets/icons/edit.svg';

// --- Electron / Node.js Imports ---
const { readdir, writeFile, readFile, mkdir } = window.require('fs').promises;
const path = window.require('path');

const STUDY_ANIMATIONS = `
@keyframes shake-violent {
  0%, 100% { transform: translateX(0); }
  10%, 30%, 50%, 70%, 90% { transform: translateX(-15px); }
  20%, 40%, 60%, 80% { transform: translateX(15px); }
}
@keyframes success-ring {
  0% { transform: translate(-50%, -50%) scale(0.5); opacity: 0; border-width: 20px; }
  50% { opacity: 0.5; border-width: 10px; }
  100% { transform: translate(-50%, -50%) scale(2); opacity: 0; border-width: 0; }
}
@keyframes success-wash {
  0% { transform: scaleY(0); opacity: 0; }
  50% { opacity: 0.1; }
  100% { transform: scaleY(1); opacity: 0; }
}
@keyframes failure-glitch {
  0% { opacity: 0; transform: skewX(0); }
  10% { opacity: 0.2; transform: skewX(-5deg); background: rgba(239, 68, 68, 0.4); }
  20% { opacity: 0.1; transform: skewX(5deg); }
  30% { opacity: 0; transform: skewX(0); }
}
@keyframes border-pulse-success {
  0% { box-shadow: 0 0 0 0 rgba(34, 197, 94, 0.4); border-color: rgba(34, 197, 94, 0.5); }
  100% { box-shadow: 0 0 30px 10px rgba(34, 197, 94, 0); border-color: rgba(34, 197, 94, 0.1); }
}
@keyframes border-pulse-failure {
  0% { box-shadow: 0 0 0 0 rgba(239, 68, 68, 0.4); border-color: rgba(239, 68, 68, 0.5); }
  100% { box-shadow: 0 0 40px 15px rgba(239, 68, 68, 0); border-color: rgba(239, 68, 68, 0.1); }
}

.animate-shake-violent { animation: shake-violent 0.4s cubic-bezier(.36,.07,.19,.97) both; }
.animate-success-ring { animation: success-ring 0.6s ease-out forwards; }
.animate-success-wash { animation: success-wash 0.6s ease-out forwards; }
.animate-failure-glitch { animation: failure-glitch 0.3s ease-out forwards; }
.animate-border-success { animation: border-pulse-success 0.8s ease-out forwards; }
.animate-border-failure { animation: border-pulse-failure 0.8s ease-out forwards; }
`;

// --- Configuration ---
const BASE_DB_PATH = 'C:\\Users\\PC\\Desktop\\database\\LanguageLearning';
const LANGUAGES_PATH = path.join(BASE_DB_PATH, 'Languages');

const LanguageLearning = ({ showNavbar = true }) => {
    const { language: langId } = useParams();
    const navigate = useNavigate();

    const [languages, setLanguages] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isVocabModalOpen, setIsVocabModalOpen] = useState(false);
    const [newLangName, setNewLangName] = useState('');
    const [newWord, setNewWord] = useState('');
    const [newMeaning, setNewMeaning] = useState('');
    const [vocabulary, setVocabulary] = useState([]);
    const [phrases, setPhrases] = useState([]);
    const [grammarRules, setGrammarRules] = useState([]);
    const [editingWord, setEditingWord] = useState(null);
    const [editingPhrase, setEditingPhrase] = useState(null);
    const [editingRule, setEditingRule] = useState(null);
    const [isPhraseModalOpen, setIsPhraseModalOpen] = useState(false);
    const [isGrammarModalOpen, setIsGrammarModalOpen] = useState(false);
    const [isFlashcardModalOpen, setIsFlashcardModalOpen] = useState(false);
    const [studySession, setStudySession] = useState(null);
    const [userStudyAnswer, setUserStudyAnswer] = useState('');
    const [studyFeedback, setStudyFeedback] = useState({ isCorrect: null, isRevealed: false });
    const [newPhrase, setNewPhrase] = useState('');
    const [newPhraseMeaning, setNewPhraseMeaning] = useState('');
    const [newRuleTitle, setNewRuleTitle] = useState('');
    const [newRuleDescription, setNewRuleDescription] = useState('');
    const loadedLangRef = React.useRef(null);

    // --- DB Initialization ---
    const loadRepoData = React.useCallback(async (id) => {
        try {
            const repoPath = path.join(LANGUAGES_PATH, id);
            await mkdir(repoPath, { recursive: true });

            // Load Vocabulary
            const vocabPath = path.join(repoPath, 'vocabulary.json');
            try {
                const content = await readFile(vocabPath, 'utf8');
                setVocabulary(JSON.parse(content));
            } catch (e) {
                setVocabulary([]);
                await writeFile(vocabPath, JSON.stringify([], null, 2));
            }

            // Load Phrases
            const phrasesPath = path.join(repoPath, 'phrases.json');
            try {
                const content = await readFile(phrasesPath, 'utf8');
                setPhrases(JSON.parse(content));
            } catch (e) {
                setPhrases([]);
                await writeFile(phrasesPath, JSON.stringify([], null, 2));
            }

            // Load Grammar
            const grammarPath = path.join(repoPath, 'grammar.json');
            try {
                const content = await readFile(grammarPath, 'utf8');
                setGrammarRules(JSON.parse(content));
            } catch (e) {
                setGrammarRules([]);
                await writeFile(grammarPath, JSON.stringify([], null, 2));
            }
        } catch (err) {
            console.error('Load Repo Data Error:', err);
        }
    }, []);

    useEffect(() => {
        const initDB = async () => {
            try {
                await mkdir(LANGUAGES_PATH, { recursive: true });
                loadLanguages();
            } catch (err) {
                console.error('DB Init Error:', err);
                setIsLoading(false);
            }
        };
        initDB();
    }, []);

    // --- Persistence & Redirection ---
    useEffect(() => {
        if (langId) {
            localStorage.setItem('axo_last_language', langId);
            // Only load data if we haven't loaded this language yet
            if (loadedLangRef.current !== langId) {
                loadedLangRef.current = langId;
                loadRepoData(langId);
            }
        } else {
            loadedLangRef.current = null;
            setVocabulary([]);
            setPhrases([]);
            setGrammarRules([]);
        }
    }, [langId, loadRepoData]);

    useEffect(() => {
        if (!langId && !isLoading) {
            const lastLang = localStorage.getItem('axo_last_language');
            if (lastLang && languages.some(l => l.id === lastLang)) {
                navigate(`/Language/learning/${lastLang}`, { replace: true });
            }
        }
    }, [langId, isLoading, languages, navigate]);

    const loadLanguages = async () => {
        setIsLoading(true);
        try {
            const items = await readdir(LANGUAGES_PATH, { withFileTypes: true });

            // Handle migration of old .json files to folders
            for (const item of items) {
                if (item.isFile() && item.name.endsWith('.json')) {
                    const id = item.name.replace('.json', '');
                    const oldPath = path.join(LANGUAGES_PATH, item.name);
                    const newDirPath = path.join(LANGUAGES_PATH, id);

                    try {
                        const content = await readFile(oldPath, 'utf8');
                        await mkdir(newDirPath, { recursive: true });
                        await writeFile(path.join(newDirPath, 'meta.json'), content);
                        await window.require('fs').promises.unlink(oldPath);
                    } catch (e) {
                        console.error('Migration failed for', id, e);
                    }
                }
            }

            // Load from folders
            const freshItems = await readdir(LANGUAGES_PATH, { withFileTypes: true });
            const loaded = [];
            for (const item of freshItems) {
                if (item.isDirectory()) {
                    try {
                        const metaPath = path.join(LANGUAGES_PATH, item.name, 'meta.json');
                        const content = await readFile(metaPath, 'utf8');
                        loaded.push(JSON.parse(content));
                    } catch (e) {
                        console.error('Error loading repo', item.name, e);
                    }
                }
            }

            const sorted = loaded.sort((a, b) => new Date(b.created) - new Date(a.created));
            setLanguages(sorted);
        } catch (err) {
            console.error('Load Languages Error:', err);
        } finally {
            setIsLoading(false);
        }
    };



    const addLanguage = async () => {
        if (!newLangName.trim()) return;

        const id = newLangName.toLowerCase().replace(/\s+/g, '-');
        const langDir = path.join(LANGUAGES_PATH, id);

        const newLang = {
            id,
            name: newLangName,
            created: new Date().toISOString()
        };

        try {
            await mkdir(langDir, { recursive: true });
            await writeFile(path.join(langDir, 'meta.json'), JSON.stringify(newLang, null, 2));
            await writeFile(path.join(langDir, 'vocabulary.json'), JSON.stringify([], null, 2));

            setLanguages([newLang, ...languages]);
            setNewLangName('');
            setIsModalOpen(false);
        } catch (err) {
            console.error('Save Language Error:', err);
        }
    };

    const addWordToVocab = async () => {
        if (!newWord.trim() || !newMeaning.trim() || !langId) return;

        let updatedVocab;

        if (editingWord) {
            // Update existing word
            updatedVocab = vocabulary.map(entry =>
                entry.id === editingWord.id
                    ? { ...entry, word: newWord, meaning: newMeaning }
                    : entry
            );
        } else {
            // Add new word
            const entry = {
                word: newWord,
                meaning: newMeaning,
                id: Date.now(),
                created: new Date().toISOString()
            };
            updatedVocab = [entry, ...vocabulary];
        }

        try {
            await writeFile(path.join(LANGUAGES_PATH, langId, 'vocabulary.json'), JSON.stringify(updatedVocab, null, 2));
            setVocabulary(updatedVocab);
            setNewWord('');
            setNewMeaning('');
            setEditingWord(null);
            setIsVocabModalOpen(false);
        } catch (err) {
            console.error('Save Word Error:', err);
        }
    };

    const deleteWord = async (wordId) => {
        if (!langId) return;

        const updatedVocab = vocabulary.filter(entry => entry.id !== wordId);
        try {
            await writeFile(path.join(LANGUAGES_PATH, langId, 'vocabulary.json'), JSON.stringify(updatedVocab, null, 2));
            setVocabulary(updatedVocab);
        } catch (err) {
            console.error('Delete Word Error:', err);
        }
    };

    const addPhraseToRepo = async () => {
        if (!newPhrase.trim() || !newPhraseMeaning.trim() || !langId) return;

        let updatedPhrases;

        if (editingPhrase) {
            updatedPhrases = phrases.map(entry =>
                entry.id === editingPhrase.id
                    ? { ...entry, phrase: newPhrase, meaning: newPhraseMeaning }
                    : entry
            );
        } else {
            const entry = {
                phrase: newPhrase,
                meaning: newPhraseMeaning,
                id: Date.now(),
                created: new Date().toISOString()
            };
            updatedPhrases = [entry, ...phrases];
        }

        try {
            await writeFile(path.join(LANGUAGES_PATH, langId, 'phrases.json'), JSON.stringify(updatedPhrases, null, 2));
            setPhrases(updatedPhrases);
            setNewPhrase('');
            setNewPhraseMeaning('');
            setEditingPhrase(null);
            setIsPhraseModalOpen(false);
        } catch (err) {
            console.error('Save Phrase Error:', err);
        }
    };

    const deletePhrase = async (phraseId) => {
        if (!langId) return;

        const updatedPhrases = phrases.filter(entry => entry.id !== phraseId);
        try {
            await writeFile(path.join(LANGUAGES_PATH, langId, 'phrases.json'), JSON.stringify(updatedPhrases, null, 2));
            setPhrases(updatedPhrases);
        } catch (err) {
            console.error('Delete Phrase Error:', err);
        }
    };

    const addGrammarRuleToRepo = async () => {
        if (!newRuleTitle.trim() || !newRuleDescription.trim() || !langId) return;

        let updatedRules;

        if (editingRule) {
            updatedRules = grammarRules.map(entry =>
                entry.id === editingRule.id
                    ? { ...entry, title: newRuleTitle, description: newRuleDescription }
                    : entry
            );
        } else {
            const entry = {
                title: newRuleTitle,
                description: newRuleDescription,
                id: Date.now(),
                created: new Date().toISOString()
            };
            updatedRules = [entry, ...grammarRules];
        }

        try {
            await writeFile(path.join(LANGUAGES_PATH, langId, 'grammar.json'), JSON.stringify(updatedRules, null, 2));
            setGrammarRules(updatedRules);
            setNewRuleTitle('');
            setNewRuleDescription('');
            setEditingRule(null);
            setIsGrammarModalOpen(false);
        } catch (err) {
            console.error('Save Grammar Rule Error:', err);
        }
    };

    const deleteGrammarRule = async (ruleId) => {
        if (!langId) return;

        const updatedRules = grammarRules.filter(entry => entry.id !== ruleId);
        try {
            await writeFile(path.join(LANGUAGES_PATH, langId, 'grammar.json'), JSON.stringify(updatedRules, null, 2));
            setGrammarRules(updatedRules);
        } catch (err) {
            console.error('Delete Grammar Rule Error:', err);
        }
    };

    const openEditRuleModal = (rule) => {
        setEditingRule(rule);
        setNewRuleTitle(rule.title);
        setNewRuleDescription(rule.description);
        setIsGrammarModalOpen(true);
    };

    const openAddRuleModal = () => {
        setEditingRule(null);
        setNewRuleTitle('');
        setNewRuleDescription('');
        setIsGrammarModalOpen(true);
    };

    const startStudySession = (mode) => {
        let sourceData = [];
        if (mode === 'words') sourceData = [...vocabulary];
        else if (mode === 'phrases') sourceData = [...phrases];
        else if (mode === 'grammar') sourceData = [...grammarRules];

        if (sourceData.length === 0) {
            setIsFlashcardModalOpen(false);
            return;
        }

        const shuffled = [...sourceData].sort(() => Math.random() - 0.5);
        setStudySession({
            mode,
            cards: shuffled,
            index: 0
        });
        setUserStudyAnswer('');
        setStudyFeedback({ isCorrect: null, isRevealed: false });
        setIsFlashcardModalOpen(false);
    };

    const handleStudyAnswer = () => {
        if (!studySession) return;
        const currentCard = studySession.cards[studySession.index];
        let correct;

        if (studySession.mode === 'words') {
            correct = currentCard.meaning;
        } else if (studySession.mode === 'phrases') {
            correct = currentCard.meaning;
        } else if (studySession.mode === 'grammar') {
            correct = currentCard.title;
        }

        const isRight = userStudyAnswer.trim().toLowerCase() === correct.trim().toLowerCase();

        if (isRight) {
            setStudyFeedback({ isCorrect: true, isRevealed: false });
            setTimeout(() => {
                nextStudyCard();
            }, 800);
        } else {
            setStudyFeedback({ isCorrect: false, isRevealed: false });
        }
    };

    const nextStudyCard = () => {
        setStudySession(prev => {
            if (!prev) return null;
            if (prev.index + 1 >= prev.cards.length) return null;
            return { ...prev, index: prev.index + 1 };
        });
        setUserStudyAnswer('');
        setStudyFeedback({ isCorrect: null, isRevealed: false });
    };

    const handleAnswerInputChange = (val) => {
        setUserStudyAnswer(val);
        if (studyFeedback.isCorrect === false) {
            setStudyFeedback({ isCorrect: null, isRevealed: false });
        }
    };

    const revealStudyAnswer = () => {
        setStudyFeedback(prev => ({ ...prev, isRevealed: true }));
    };

    const openEditPhraseModal = (phrase) => {
        setEditingPhrase(phrase);
        setNewPhrase(phrase.phrase);
        setNewPhraseMeaning(phrase.meaning);
        setIsPhraseModalOpen(true);
    };

    const openAddPhraseModal = () => {
        setEditingPhrase(null);
        setNewPhrase('');
        setNewPhraseMeaning('');
        setIsPhraseModalOpen(true);
    };

    const openEditModal = (word) => {
        setEditingWord(word);
        setNewWord(word.word);
        setNewMeaning(word.meaning);
        setIsVocabModalOpen(true);
    };

    const openAddModal = () => {
        setEditingWord(null);
        setNewWord('');
        setNewMeaning('');
        setIsVocabModalOpen(true);
    };

    // --- Components ---

    const Dashboard = () => (
        <div className="p-6 space-y-6 custom-scrollbar overflow-y-auto h-full">
            <header className="flex justify-between items-center">
                <div>
                    <h1 className="text-xl font-bold text-slate-100 uppercase tracking-tight">Languages</h1>
                    <p className="text-slate-500 text-[10px] font-bold uppercase tracking-widest">Mastery Repository</p>
                </div>
                <button
                    onClick={() => setIsModalOpen(true)}
                    className="bg-black hover:bg-slate-900 text-slate-400 border border-slate-800 px-4 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-widest transition-all active:scale-95 cursor-pointer flex items-center gap-2"
                >
                    <img src={plusIcon} className="w-3 h-3 filter brightness-0 invert opacity-40" alt="add" />
                    Init Repo
                </button>
            </header>

            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3 pb-10">
                {languages.map(lang => (
                    <div
                        key={lang.id}
                        onClick={() => navigate(`/Language/learning/${lang.id}`)}
                        className="group relative bg-black/40 border border-white/5 rounded-xl p-4 cursor-pointer hover:border-white/10 transition-all"
                    >
                        <div className="flex flex-col gap-3">
                            <div className="w-8 h-8 bg-slate-900 rounded-lg flex items-center justify-center border border-slate-800 text-slate-500 group-hover:text-slate-300 transition-colors">
                                <img src={conceptsIcon} className="w-4 h-4 filter brightness-0 invert opacity-40 group-hover:opacity-80 transition-opacity" alt="lang" />
                            </div>
                            <div>
                                <h3 className="text-xs font-bold text-slate-200 group-hover:text-white transition-colors truncate">{lang.name}</h3>
                                <p className="text-[9px] text-slate-600 font-mono uppercase tracking-tighter">Enter</p>
                            </div>
                        </div>
                    </div>
                ))}

                {languages.length === 0 && !isLoading && (
                    <div className="col-span-full py-12 flex flex-col items-center justify-center border border-dashed border-slate-900 rounded-xl text-slate-700">
                        <p className="text-[10px] font-bold uppercase tracking-widest italic">No repositories initialized.</p>
                    </div>
                )}
            </div>

            {/* Addition Modal */}
            {isModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-black/60" onClick={() => setIsModalOpen(false)}></div>
                    <div className="relative bg-[#0a0a0a] border border-white/10 rounded-xl p-6 max-w-xs w-full shadow-2xl">
                        <h2 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-4">New Repository</h2>

                        <div className="space-y-4">
                            <input
                                autoFocus
                                type="text"
                                value={newLangName}
                                onChange={(e) => setNewLangName(e.target.value)}
                                onKeyDown={(e) => e.key === 'Enter' && addLanguage()}
                                className="w-full bg-[#050505] border border-slate-800 rounded-lg px-3 py-2 text-slate-200 text-xs focus:outline-none focus:border-slate-600 transition-all placeholder:text-slate-800"
                                placeholder="Language..."
                            />
                            <div className="flex gap-2">
                                <button
                                    onClick={() => setIsModalOpen(false)}
                                    className="flex-1 py-2 bg-transparent hover:bg-slate-900 text-slate-600 font-bold rounded-lg text-[10px] uppercase tracking-widest transition-all cursor-pointer border border-slate-900"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={addLanguage}
                                    className="flex-1 py-2 bg-slate-900 hover:bg-white hover:text-black text-slate-400 font-bold rounded-lg text-[10px] uppercase tracking-widest transition-all cursor-pointer border border-slate-800"
                                >
                                    Initialize
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );

    const LanguageDetail = () => {
        const currentLang = languages.find(l => l.id === langId) || { name: 'Language' };

        return (
            <div className="p-6 space-y-6 h-full flex flex-col">
                <header className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <button
                            onClick={() => {
                                localStorage.removeItem('axo_last_language');
                                navigate('/Language/learning');
                            }}
                            className="w-8 h-8 bg-black border border-slate-800 rounded-lg flex items-center justify-center text-slate-500 hover:text-slate-200 transition-all cursor-pointer"
                        >
                            <img src={chevronLeftIcon} className="w-3 h-3 filter brightness-0 invert opacity-40 group-hover:opacity-80 transition-opacity" alt="back" />
                        </button>
                        <div>
                            <h1 className="text-lg font-bold text-slate-200 uppercase tracking-tight">{currentLang.name}</h1>
                            <p className="text-slate-600 text-[10px] uppercase tracking-[0.2em]">Repository</p>
                        </div>
                    </div>

                    <div className="flex items-center gap-2">
                        {['Flashcards', 'Lessons', 'Converse'].map((action) => (
                            <button
                                key={action}
                                onClick={() => action === 'Flashcards' && setIsFlashcardModalOpen(true)}
                                className="px-4 py-1.5 bg-black hover:bg-slate-900 text-slate-400 border border-slate-800 rounded-lg text-[10px] font-bold uppercase tracking-widest transition-all active:scale-95 cursor-pointer flex items-center gap-2"
                            >
                                <img
                                    src={action === 'Flashcards' ? zapIcon : action === 'Lessons' ? brainIcon : messageIcon}
                                    className="w-3 h-3 filter brightness-0 invert opacity-40 group-hover:opacity-80 transition-opacity"
                                    alt={action}
                                />
                                {action}
                            </button>
                        ))}
                    </div>
                </header>

                <div className="flex-1 flex gap-4 overflow-hidden pb-10">
                    {/* Column 1: Vocabulary */}
                    <div className="flex-1 flex flex-col bg-[#0a0a0a] border border-slate-900 rounded-xl overflow-hidden border-t-indigo-500/30">
                        <div className="p-4 border-b border-slate-900 flex items-center justify-between bg-gradient-to-b from-indigo-500/5 to-transparent">
                            <div>
                                <h3 className="text-xs font-bold text-slate-300 uppercase tracking-widest">Words</h3>
                                <p className="text-[9px] text-slate-600 uppercase tracking-wider">{vocabulary.length} Learned</p>
                            </div>
                            <button
                                onClick={openAddModal}
                                className="bg-slate-900 hover:bg-slate-800 text-slate-400 border border-slate-800 px-3 py-1 rounded-lg text-[9px] font-bold uppercase tracking-widest transition-all cursor-pointer flex items-center gap-1.5"
                            >
                                <img src={plusIcon} className="w-2.5 h-2.5 filter brightness-0 invert opacity-40" alt="add" />
                                Add
                            </button>
                        </div>
                        <div className="flex-1 overflow-y-auto custom-scrollbar p-3 space-y-1">
                            {vocabulary.map((entry) => (
                                <div
                                    key={entry.id}
                                    onClick={() => openEditModal(entry)}
                                    className="group bg-black/40 border border-white/5 rounded-lg px-3 py-1 hover:border-white/10 transition-colors cursor-pointer flex items-center justify-between"
                                >
                                    <p className="text-xs text-slate-300 font-medium truncate flex-1">{entry.word}</p>
                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            deleteWord(entry.id);
                                        }}
                                        className="opacity-0 group-hover:opacity-100 text-slate-600 hover:text-red-500 transition-all flex items-center"
                                    >
                                        <img src={deleteIcon} className="w-3 h-3 filter brightness-0 invert opacity-40 hover:opacity-100 placeholder-red-500" alt="delete" />
                                    </button>
                                </div>
                            ))}
                            {vocabulary.length === 0 && (
                                <div className="py-8 text-center">
                                    <p className="text-[10px] text-slate-700 uppercase tracking-widest italic">No words yet</p>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Column 2: Phrases */}
                    <div className="flex-1 flex flex-col bg-[#0a0a0a] border border-slate-900 rounded-xl overflow-hidden border-t-slate-700/50">
                        <div className="p-4 border-b border-slate-900 flex items-center justify-between bg-gradient-to-b from-white/5 to-transparent">
                            <div>
                                <h3 className="text-xs font-bold text-slate-300 uppercase tracking-widest">Phrases</h3>
                                <p className="text-[9px] text-slate-600 uppercase tracking-wider">{phrases.length} Saved</p>
                            </div>
                            <button
                                onClick={openAddPhraseModal}
                                className="bg-slate-900 hover:bg-slate-800 text-slate-400 border border-slate-800 px-3 py-1 rounded-lg text-[9px] font-bold uppercase tracking-widest transition-all cursor-pointer flex items-center gap-1.5"
                            >
                                <img src={plusIcon} className="w-2.5 h-2.5 filter brightness-0 invert opacity-40" alt="add" />
                                Add
                            </button>
                        </div>
                        <div className="flex-1 overflow-y-auto custom-scrollbar p-3 space-y-1">
                            {phrases.map((entry) => (
                                <div
                                    key={entry.id}
                                    onClick={() => openEditPhraseModal(entry)}
                                    className="group bg-black/40 border border-white/5 rounded-lg px-3 py-1 hover:border-white/10 transition-colors cursor-pointer flex items-center justify-between"
                                >
                                    <p className="text-xs text-slate-300 font-medium truncate flex-1">{entry.phrase}</p>
                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            deletePhrase(entry.id);
                                        }}
                                        className="opacity-0 group-hover:opacity-100 text-slate-600 hover:text-red-500 transition-all flex items-center"
                                    >
                                        <img src={deleteIcon} className="w-3 h-3 filter brightness-0 invert opacity-40 hover:opacity-100 placeholder-red-500" alt="delete" />
                                    </button>
                                </div>
                            ))}
                            {phrases.length === 0 && (
                                <div className="py-8 text-center">
                                    <p className="text-[10px] text-slate-700 uppercase tracking-widest italic">No phrases yet</p>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Column 3: Grammar */}
                    <div className="flex-1 flex flex-col bg-[#0a0a0a] border border-slate-900 rounded-xl overflow-hidden border-t-teal-500/30">
                        <div className="p-4 border-b border-slate-900 flex items-center justify-between bg-gradient-to-b from-teal-500/5 to-transparent">
                            <div>
                                <h3 className="text-xs font-bold text-slate-300 uppercase tracking-widest">Grammar</h3>
                                <p className="text-[9px] text-slate-600 uppercase tracking-wider">{grammarRules.length} Rules</p>
                            </div>
                            <button
                                onClick={openAddRuleModal}
                                className="bg-slate-900 hover:bg-slate-800 text-slate-400 border border-slate-800 px-3 py-1 rounded-lg text-[9px] font-bold uppercase tracking-widest transition-all cursor-pointer flex items-center gap-1.5"
                            >
                                <img src={plusIcon} className="w-2.5 h-2.5 filter brightness-0 invert opacity-40" alt="add" />
                                Add
                            </button>
                        </div>
                        <div className="flex-1 overflow-y-auto custom-scrollbar p-3 space-y-1">
                            {grammarRules.map((entry) => (
                                <div
                                    key={entry.id}
                                    onClick={() => openEditRuleModal(entry)}
                                    className="group bg-black/40 border border-white/5 rounded-lg px-3 py-1 hover:border-white/10 transition-colors cursor-pointer flex items-center justify-between"
                                >
                                    <p className="text-xs text-slate-300 font-medium truncate flex-1">{entry.title}</p>
                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            deleteGrammarRule(entry.id);
                                        }}
                                        className="opacity-0 group-hover:opacity-100 text-slate-600 hover:text-red-500 transition-all flex items-center"
                                    >
                                        <img src={deleteIcon} className="w-3 h-3 filter brightness-0 invert opacity-40 hover:opacity-100 placeholder-red-500" alt="delete" />
                                    </button>
                                </div>
                            ))}
                            {grammarRules.length === 0 && (
                                <div className="py-8 text-center">
                                    <p className="text-[10px] text-slate-700 uppercase tracking-widest italic">No rules yet</p>
                                </div>
                            )}
                        </div>
                    </div>
                </div>


            </div>
        );
    };

    if (isLoading) {
        return (
            <div className="h-screen bg-black flex items-center justify-center text-slate-800">
                <img src={loaderIcon} className="w-5 h-5 filter brightness-0 invert opacity-20 animate-spin" alt="Loading" />
            </div>
        );
    }

    return (
        <div className="flex h-screen bg-black text-slate-400 overflow-hidden font-sans selection:bg-slate-800 selection:text-white">
            <style>{`
                .custom-scrollbar::-webkit-scrollbar { width: 3px; }
                .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
                .custom-scrollbar::-webkit-scrollbar-thumb { background: #171717; border-radius: 10px; }
                .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #262626; }
            `}</style>
            {showNavbar && <Navbar />}
            <div className="flex-1 pl-12 flex flex-col relative h-full overflow-hidden">
                <main className="flex-1 relative h-full overflow-hidden">
                    {langId ? <LanguageDetail /> : <Dashboard />}
                </main>
            </div>

            {isVocabModalOpen && langId && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-black/60" onClick={() => setIsVocabModalOpen(false)}></div>
                    <div className="relative bg-[#0a0a0a] border border-white/10 rounded-xl p-6 max-w-sm w-full shadow-2xl">
                        <h2 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-4">
                            {editingWord ? 'Edit Word' : 'New Word'}
                        </h2>

                        <div className="space-y-4">
                            <div>
                                <label className="block text-[9px] font-bold text-slate-600 uppercase tracking-widest mb-2">Word</label>
                                <input
                                    type="text"
                                    value={newWord}
                                    onChange={(e) => setNewWord(e.target.value)}
                                    className="w-full bg-[#050505] border border-slate-800 rounded-lg px-3 py-2 text-slate-200 text-xs focus:outline-none focus:border-slate-600 transition-all placeholder:text-slate-800"
                                    placeholder="e.g. こんにちは"
                                />
                            </div>
                            <div>
                                <label className="block text-[9px] font-bold text-slate-600 uppercase tracking-widest mb-2">Meaning</label>
                                <input
                                    type="text"
                                    value={newMeaning}
                                    onChange={(e) => setNewMeaning(e.target.value)}
                                    onKeyDown={(e) => e.key === 'Enter' && addWordToVocab()}
                                    className="w-full bg-[#050505] border border-slate-800 rounded-lg px-3 py-2 text-slate-200 text-xs focus:outline-none focus:border-slate-600 transition-all placeholder:text-slate-800"
                                    placeholder="e.g. Hello"
                                />
                            </div>
                            <div className="flex gap-2 pt-2">
                                <button
                                    onClick={() => setIsVocabModalOpen(false)}
                                    className="flex-1 py-2 bg-transparent hover:bg-slate-900 text-slate-600 font-bold rounded-lg text-[10px] uppercase tracking-widest transition-all cursor-pointer border border-slate-900"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={addWordToVocab}
                                    className="flex-1 py-2 bg-slate-900 hover:bg-white hover:text-black text-slate-400 font-bold rounded-lg text-[10px] uppercase tracking-widest transition-all cursor-pointer border border-slate-800"
                                >
                                    Save
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {isPhraseModalOpen && langId && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-black/60" onClick={() => setIsPhraseModalOpen(false)}></div>
                    <div className="relative bg-[#0a0a0a] border border-white/10 rounded-xl p-6 max-w-sm w-full shadow-2xl">
                        <h2 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-4">
                            {editingPhrase ? 'Edit Phrase' : 'New Phrase'}
                        </h2>

                        <div className="space-y-4">
                            <div>
                                <label className="block text-[9px] font-bold text-slate-600 uppercase tracking-widest mb-2">Phrase</label>
                                <input
                                    type="text"
                                    value={newPhrase}
                                    onChange={(e) => setNewPhrase(e.target.value)}
                                    className="w-full bg-[#050505] border border-slate-800 rounded-lg px-3 py-2 text-slate-200 text-xs focus:outline-none focus:border-slate-600 transition-all placeholder:text-slate-800"
                                    placeholder="e.g. お元気ですか？"
                                />
                            </div>
                            <div>
                                <label className="block text-[9px] font-bold text-slate-600 uppercase tracking-widest mb-2">Meaning / Translation</label>
                                <input
                                    type="text"
                                    value={newPhraseMeaning}
                                    onChange={(e) => setNewPhraseMeaning(e.target.value)}
                                    onKeyDown={(e) => e.key === 'Enter' && addPhraseToRepo()}
                                    className="w-full bg-[#050505] border border-slate-800 rounded-lg px-3 py-2 text-slate-200 text-xs focus:outline-none focus:border-slate-600 transition-all placeholder:text-slate-800"
                                    placeholder="e.g. How are you?"
                                />
                            </div>
                            <div className="flex gap-2 pt-2">
                                <button
                                    onClick={() => setIsPhraseModalOpen(false)}
                                    className="flex-1 py-2 bg-transparent hover:bg-slate-900 text-slate-600 font-bold rounded-lg text-[10px] uppercase tracking-widest transition-all cursor-pointer border border-slate-900"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={addPhraseToRepo}
                                    className="flex-1 py-2 bg-slate-900 hover:bg-white hover:text-black text-slate-400 font-bold rounded-lg text-[10px] uppercase tracking-widest transition-all cursor-pointer border border-slate-800"
                                >
                                    Save
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {isGrammarModalOpen && langId && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-black/60" onClick={() => setIsGrammarModalOpen(false)}></div>
                    <div className="relative bg-[#0a0a0a] border border-white/10 rounded-xl p-6 max-w-sm w-full shadow-2xl">
                        <h2 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-4">
                            {editingRule ? 'Edit Rule' : 'New Rule'}
                        </h2>

                        <div className="space-y-4">
                            <div>
                                <label className="block text-[9px] font-bold text-slate-600 uppercase tracking-widest mb-2">Title</label>
                                <input
                                    type="text"
                                    value={newRuleTitle}
                                    onChange={(e) => setNewRuleTitle(e.target.value)}
                                    className="w-full bg-[#050505] border border-slate-800 rounded-lg px-3 py-2 text-slate-200 text-xs focus:outline-none focus:border-slate-600 transition-all placeholder:text-slate-800"
                                    placeholder="e.g. Past Tense Conjugation"
                                />
                            </div>
                            <div>
                                <label className="block text-[9px] font-bold text-slate-600 uppercase tracking-widest mb-2">Description / Usage</label>
                                <textarea
                                    rows={4}
                                    value={newRuleDescription}
                                    onChange={(e) => setNewRuleDescription(e.target.value)}
                                    className="w-full bg-[#050505] border border-slate-800 rounded-lg px-3 py-2 text-slate-200 text-xs focus:outline-none focus:border-slate-600 transition-all placeholder:text-slate-800 resize-none"
                                    placeholder="Explain the rule..."
                                />
                            </div>
                            <div className="flex gap-2 pt-2">
                                <button
                                    onClick={() => setIsGrammarModalOpen(false)}
                                    className="flex-1 py-2 bg-transparent hover:bg-slate-900 text-slate-600 font-bold rounded-lg text-[10px] uppercase tracking-widest transition-all cursor-pointer border border-slate-900"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={addGrammarRuleToRepo}
                                    className="flex-1 py-2 bg-slate-900 hover:bg-white hover:text-black text-slate-400 font-bold rounded-lg text-[10px] uppercase tracking-widest transition-all cursor-pointer border border-slate-800"
                                >
                                    Save
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {isFlashcardModalOpen && (
                <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-black/60" onClick={() => setIsFlashcardModalOpen(false)}></div>
                    <div className="relative bg-[#0a0a0a] border border-white/10 rounded-2xl p-8 max-w-sm w-full shadow-2xl overflow-hidden">
                        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-indigo-500 via-slate-500 to-teal-500 opacity-40"></div>

                        <div className="mb-8">
                            <h2 className="text-sm font-bold text-slate-100 uppercase tracking-tight">Flashcards</h2>
                            <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">Select Study Mode</p>
                        </div>

                        <div className="space-y-3">
                            {[
                                { id: 'words', label: 'Words', iconSrc: conceptsIcon, color: 'indigo' },
                                { id: 'phrases', label: 'Phrases', iconSrc: messageIcon, color: 'slate' },
                                { id: 'grammar', label: 'Grammar', iconSrc: editIcon, color: 'teal' }
                            ].map((mode) => (
                                <button
                                    key={mode.id}
                                    onClick={() => startStudySession(mode.id)}
                                    className={`w-full group relative bg-black/40 border border-white/5 hover:border-white/10 p-4 rounded-xl flex items-center justify-between transition-all active:scale-[0.98] cursor-pointer`}
                                >
                                    <div className="flex items-center gap-4">
                                        <div className={`w-10 h-10 rounded-lg bg-white/5 flex items-center justify-center border border-white/5 text-slate-500 group-hover:text-${mode.color}-400 transition-colors`}>
                                            <img src={mode.iconSrc} className="w-4 h-4 filter brightness-0 invert opacity-40 group-hover:opacity-80 transition-opacity" alt={mode.label} />
                                        </div>
                                        <div className="text-left">
                                            <h3 className="text-xs font-bold text-slate-200 group-hover:text-white transition-colors">{mode.label}</h3>
                                            <p className="text-[9px] text-slate-600 font-mono uppercase tracking-tighter">Ready to Study</p>
                                        </div>
                                    </div>
                                    <img src={chevronRightIcon} className="w-3 h-3 filter brightness-0 invert opacity-20 group-hover:opacity-60 transition-all transform group-hover:translate-x-1" alt="next" />
                                </button>
                            ))}
                        </div>

                        <button
                            onClick={() => setIsFlashcardModalOpen(false)}
                            className="w-full mt-6 py-2.5 bg-transparent hover:bg-white/5 text-slate-600 hover:text-slate-400 font-bold rounded-xl text-[10px] uppercase tracking-widest transition-all cursor-pointer border border-white/5"
                        >
                            Cancel
                        </button>
                    </div>
                </div>
            )}

            {studySession && (
                <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 overflow-hidden">
                    <style>{STUDY_ANIMATIONS}</style>
                    <div className="absolute inset-0 bg-black/40 backdrop-blur-md"></div>

                    <div className={`relative max-w-lg w-full transition-transform duration-300 ${studyFeedback.isCorrect === false ? 'animate-shake-violent' : ''}`}>
                        {/* Success Feedback Layer (Contained to card area) */}
                        {studyFeedback.isCorrect && (
                            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[300px] h-[300px] border-[20px] border-green-500/30 rounded-full animate-success-ring pointer-events-none z-[80]"></div>
                        )}
                        {/* Progress Bar */}
                        <div className="absolute -top-12 left-0 w-full flex items-center justify-between px-2">
                            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">
                                {studySession.mode} Practice
                            </span>
                            <span className="text-[10px] font-bold text-slate-500 font-mono">
                                {studySession.index + 1} / {studySession.cards.length}
                            </span>
                        </div>
                        <div className="absolute -top-8 left-0 w-full h-1 bg-white/5 rounded-full overflow-hidden">
                            <div
                                className="h-full bg-indigo-500 transition-all duration-500 ease-out shadow-[0_0_15px_rgba(99,102,241,0.4)]"
                                style={{ width: `${((studySession.index + 1) / studySession.cards.length) * 100}%` }}
                            ></div>
                        </div>

                        <div className={`bg-[#0a0a0a] border ${studyFeedback.isCorrect ? 'animate-border-success border-green-500/50' :
                            studyFeedback.isCorrect === false ? 'animate-border-failure border-red-500/50' :
                                'border-white/10'
                            } rounded-3xl p-10 shadow-3xl text-center space-y-8 relative overflow-hidden`}>
                            <div className="space-y-2 relative z-10">
                                <p className="text-[10px] text-white/20 font-bold uppercase tracking-widest">
                                    {studySession.mode === 'words' ? 'What does this word mean?' :
                                        studySession.mode === 'phrases' ? 'What does this phrase mean?' :
                                            'What is this grammar concept?'}
                                </p>
                                <h2 className={`font-bold text-white tracking-tight ${studySession.mode === 'grammar' ? 'text-2xl leading-relaxed' : 'text-4xl'}`}>
                                    {studySession.mode === 'words' ? studySession.cards[studySession.index].word :
                                        studySession.mode === 'phrases' ? studySession.cards[studySession.index].phrase :
                                            studySession.cards[studySession.index].description}
                                </h2>
                            </div>

                            <div className="space-y-4 relative z-10">
                                <div className="relative">
                                    <input
                                        autoFocus
                                        type="text"
                                        value={userStudyAnswer}
                                        onChange={(e) => handleAnswerInputChange(e.target.value)}
                                        onKeyDown={(e) => {
                                            if (e.key === 'Enter') {
                                                if (studyFeedback.isRevealed || studyFeedback.isCorrect) nextStudyCard();
                                                else handleStudyAnswer();
                                            }
                                        }}
                                        placeholder="Type the meaning..."
                                        className={`w-full bg-black/40 border ${studyFeedback.isCorrect ? 'border-green-500/50 text-green-400' :
                                            studyFeedback.isCorrect === false ? 'border-red-500/50 text-red-400' :
                                                'border-white/10 text-slate-200'
                                            } rounded-2xl px-6 py-4 text-center text-lg focus:outline-none focus:border-indigo-500/30 transition-all placeholder:text-white/5`}
                                    />
                                    {studyFeedback.isCorrect && (
                                        <div className="absolute right-4 top-1/2 -translate-y-1/2 text-green-500 animate-bounce">
                                            <img src={checkIcon} className="w-5 h-5 filter brightness-0 invert" alt="correct" />
                                        </div>
                                    )}
                                </div>

                                {studyFeedback.isRevealed && (
                                    <div className="p-4 rounded-xl border bg-indigo-500/5 border-indigo-500/20 animate-in fade-in slide-in-from-top-2 duration-300">
                                        <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mb-1">
                                            {studySession.mode === 'grammar' ? 'Rule Concept' : 'Correct Meaning'}
                                        </p>
                                        <p className="text-lg font-bold text-slate-200">
                                            {studySession.mode === 'grammar' ? studySession.cards[studySession.index].title : studySession.cards[studySession.index].meaning}
                                        </p>
                                    </div>
                                )}

                                <div className="flex gap-3">
                                    <button
                                        onClick={() => setStudySession(null)}
                                        className="px-6 py-3 bg-transparent hover:bg-white/5 text-white/30 hover:text-white/50 font-bold rounded-xl text-[10px] uppercase tracking-widest transition-all border border-white/5"
                                    >
                                        Quit
                                    </button>
                                    {(studyFeedback.isRevealed || studyFeedback.isCorrect) ? (
                                        <button
                                            onClick={nextStudyCard}
                                            className="flex-1 py-3 bg-indigo-600/60 hover:bg-indigo-600 text-white font-bold rounded-xl text-[10px] uppercase tracking-widest transition-all shadow-lg shadow-indigo-500/20 border border-indigo-400/20"
                                        >
                                            Next Card
                                        </button>
                                    ) : (
                                        <div className="flex-1 flex gap-3">
                                            <button
                                                onClick={handleStudyAnswer}
                                                className="flex-[2] py-3 bg-white/[0.03] hover:bg-white hover:text-black text-white/50 font-bold rounded-xl text-[10px] uppercase tracking-widest transition-all border border-white/5"
                                            >
                                                Check Answer
                                            </button>
                                            <button
                                                onClick={revealStudyAnswer}
                                                className="flex-1 py-3 bg-red-900/10 hover:bg-red-900/30 text-red-500/40 hover:text-red-400 font-bold rounded-xl text-[10px] uppercase tracking-widest transition-all border border-red-500/10"
                                            >
                                                Reveal
                                            </button>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default LanguageLearning;

