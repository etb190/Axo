import React, { useState, useEffect, useMemo } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useData } from '../contexts/DataContext';
import Navbar from './Navbar';
import plusIcon from '../assets/icons/plus.svg';
import trashIcon from '../assets/icons/delete.svg';
import closeIcon from '../assets/icons/close.svg';
import chevronDownIcon from '../assets/icons/chevron-down.svg';
import checkIcon from '../assets/icons/check.svg';
import clockIcon from '../assets/icons/clock.svg';
import chartIcon from '../assets/icons/chart.svg';
import editIcon from '../assets/icons/edit.svg';
import bookIcon from '../assets/icons/book.svg';
import chevronRightIcon from '../assets/icons/chevron-right.svg';
import rotateIcon from '../assets/icons/rotate.svg';
import zapIcon from '../assets/icons/zap.svg';
import hashIcon from '../assets/icons/hash.svg';
import goalsIcon from '../assets/icons/goals.svg';
import menuIcon from '../assets/icons/list.svg';
import brainIcon from '../assets/icons/brain.svg';
import conceptsIcon from '../assets/icons/concepts.svg';
import journalIcon from '../assets/icons/journal.svg';
import roadmapIcon from '../assets/icons/chart.svg';
import userIcon from '../assets/icons/user.svg';
import planIcon from '../assets/icons/Plans.svg';

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

const fs = window.require('fs');
const { readdir, writeFile, readFile, unlink, stat } = fs.promises;
const { readdirSync, readFileSync, existsSync } = fs;
const path = window.require('path');

import * as pdfjsLib from 'pdfjs-dist';
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.js?url';

const SKILLS = 'C:\\Users\\PC\\Desktop\\database\\Skills';
const BOOK_READING_PATH = 'C:\\Users\\PC\\Desktop\\Database\\Books\\Reading';
const BOOK_WANT_PATH = 'C:\\Users\\PC\\Desktop\\Database\\Books\\WanttoRead';
const BOOK_READ_PATH = 'C:\\Users\\PC\\Desktop\\Database\\Books\\Read';
const BOOK_THUMBNAIL_PATH = 'C:\\Users\\PC\\Desktop\\Database\\Books\\ThumbnailCache';
const BOOK_PROGRESS_PATH = 'C:\\Users\\PC\\Desktop\\Database\\Books\\Progress';

const ARTICLE_READING_PATH = 'C:\\Users\\PC\\Desktop\\database\\Articles\\Reading';
const ARTICLE_WANT_PATH = 'C:\\Users\\PC\\Desktop\\database\\Articles\\WanttoRead';
const ARTICLE_READ_PATH = 'C:\\Users\\PC\\Desktop\\database\\Articles\\Read';
const ARTICLE_THUMBNAIL_PATH = 'C:\\Users\\PC\\Desktop\\database\\Articles\\ThumbnailCache';
const ARTICLE_PROGRESS_PATH = 'C:\\Users\\PC\\Desktop\\database\\Articles\\Progress';

const generateId = () => Math.random().toString(36).substr(2, 9);

const getFileAsBase64 = (filePath) => {
    try {
        const data = readFileSync(filePath);
        const ext = path.extname(filePath).toLowerCase();
        let mime = 'image/jpeg';
        if (ext === '.png') mime = 'image/png';
        if (ext === '.gif') mime = 'image/gif';
        return `data:${mime};base64,${data.toString('base64')}`;
    } catch (err) {
        console.error("Error converting image to base64:", err);
        return null;
    }
};

const readBookMeta = (bookName, progressPath = BOOK_PROGRESS_PATH) => {
    try {
        const progressFile = path.join(progressPath, `${bookName}.json`);
        if (fs.existsSync(progressFile)) {
            const parsed = JSON.parse(fs.readFileSync(progressFile, 'utf-8'));
            return { current: parsed.current || 0, pages: parsed.pages || null };
        }
    } catch (err) { }
    return { current: 0, pages: null };
};

const LocalCover = ({ path: thumbPath, pdfPath, className }) => {
    const [src, setSrc] = useState(null);
    useEffect(() => {
        if (!thumbPath) { setSrc(null); return; }
        if (thumbPath.startsWith('http') || thumbPath.startsWith('data:')) {
            setSrc(thumbPath);
            return;
        }
        let active = true;
        const load = async () => {
            try {
                if (existsSync(thumbPath)) {
                    const data = await readFile(thumbPath);
                    if (!active) return;
                    const ext = path.extname(thumbPath).toLowerCase();
                    let mime = 'image/jpeg';
                    if (ext === '.png') mime = 'image/png';
                    else if (ext === '.gif') mime = 'image/gif';
                    setSrc(`data:${mime};base64,${data.toString('base64')}`);
                } else if (pdfPath && existsSync(pdfPath)) {
                    const data = await readFile(pdfPath);
                    pdfjsLib.GlobalWorkerOptions.workerSrc = workerUrl;
                    const pdf = await pdfjsLib.getDocument({ data }).promise;
                    const page = await pdf.getPage(1);
                    const viewport = page.getViewport({ scale: 0.3 });
                    const canvas = document.createElement('canvas');
                    const context = canvas.getContext('2d');
                    canvas.width = viewport.width;
                    canvas.height = viewport.height;
                    await page.render({ canvasContext: context, viewport }).promise;
                    const dataUrl = canvas.toDataURL('image/jpeg', 0.8);
                    
                    if (!active) return;
                    setSrc(dataUrl);

                    try {
                        const base64Data = dataUrl.replace(/^data:image\/jpeg;base64,/, '');
                        const buffer = Buffer.from(base64Data, 'base64');
                        await writeFile(thumbPath, buffer);
                    } catch (e) {
                        console.error('Failed to save thumbnail cache:', e);
                    }
                } else {
                    if (active) setSrc(null);
                }
            } catch (e) {
                if (active) setSrc(null);
            }
        };
        load();
        return () => { active = false; };
    }, [thumbPath, pdfPath]);

    if (!src) {
        return (
            <div className={className} style={{ background: 'var(--bg-3)', display: 'flex', alignItems: 'center', justifyContent: 'center', textAlign: 'center', padding: '2px' }}>
                <span style={{ fontSize: '0.4rem', color: 'var(--text-4)', textTransform: 'uppercase', fontWeight: '800' }}>No Cover</span>
            </div>
        );
    }
    return <img src={src} className={className} alt="" />;
};

const readBookProgress = (bookName, progressPath = BOOK_PROGRESS_PATH) => {
    return readBookMeta(bookName, progressPath).current;
};

const writeBookProgress = async (bookName, currentPage, progressPath = BOOK_PROGRESS_PATH) => {
    try {
        const progressFile = path.join(progressPath, `${bookName}.json`);
        let existing = {};
        try { if (existsSync(progressFile)) existing = JSON.parse(readFileSync(progressFile, 'utf-8')); } catch { }
        await writeFile(progressFile, JSON.stringify({ ...existing, current: currentPage }), 'utf-8');
    } catch (err) {
        console.error(`Error writing progress for ${bookName}:`, err);
    }
};

const cacheBookPages = async (bookName, pages, progressPath = BOOK_PROGRESS_PATH) => {
    try {
        const progressFile = path.join(progressPath, `${bookName}.json`);
        let existing = {};
        try { if (existsSync(progressFile)) existing = JSON.parse(readFileSync(progressFile, 'utf-8')); } catch { }
        await writeFile(progressFile, JSON.stringify({ ...existing, pages }), 'utf-8');
    } catch (err) { }
};

// ─── MODAL ───────────────────────────────────────────────────────────────────
const Modal = ({ isOpen, onClose, title, children }) => {
    if (!isOpen) return null;
    return (
        <div className="sk-overlay" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
        <div className="sk-modal sk-modal--sm">
                <div className="sk-modal__head">
                    <span className="sk-modal__title">{title}</span>
                    <button onClick={onClose} className="sk-icon-btn">
                        <LocalIcon src={closeIcon} size={11} className="sk-icon" />
                    </button>
                </div>
                <div className="sk-modal__body">{children}</div>
            </div>
        </div>
    );
};

// ─── LESSON MODAL ─────────────────────────────────────────────────────────────
const LessonModal = ({ isOpen, onClose, lesson, phases, initialPhaseId, onSave, onDelete }) => {
    const [text, setText] = useState("");
    const [phaseId, setPhaseId] = useState(initialPhaseId || "");
    const [isEditing, setIsEditing] = useState(!lesson);

    useEffect(() => {
        if (isOpen) {
            if (lesson) {
                setText(lesson.text);
                setPhaseId(lesson.phaseId);
                setIsEditing(false);
            } else {
                setText("");
                const validPhaseId = initialPhaseId || (phases.length > 0 ? phases[0].id : "");
                setPhaseId(validPhaseId);
                setIsEditing(true);
            }
        }
    }, [isOpen, lesson, initialPhaseId, phases]);

    const handleSave = () => {
        if (!text.trim()) return;
        onSave({
            id: lesson ? lesson.id : generateId(),
            text: text.trim(),
            phaseId: phaseId,
            timestamp: lesson ? lesson.timestamp : Date.now()
        });
        onClose();
    };

    const handleDelete = () => {
        if (lesson && onDelete) { onDelete(lesson.id); onClose(); }
    };

    if (!isOpen) return null;

    return (
        <div className="sk-overlay" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
        <div className="sk-modal sk-modal--md">
                <div className="sk-modal__head">
                    <div>
                        <span className="sk-modal__title">{lesson ? (isEditing ? 'Edit Note' : 'View Note') : 'Log Note'}</span>
                        <p className="sk-modal__sub">{phases.find(p => p.id === phaseId)?.name || 'Unknown Module'}</p>
                    </div>
                    <button onClick={onClose} className="sk-icon-btn">
                        <LocalIcon src={closeIcon} size={11} className="sk-icon" />
                    </button>
                </div>

                <div className="sk-modal__body">
                    <div className="sk-field">
                        <label className="sk-label">Module</label>
                        <div className="sk-select-wrap">
                            <select
                                className="sk-select"
                                value={phaseId}
                                onChange={(e) => setPhaseId(e.target.value)}
                                disabled={!!lesson && !isEditing}
                            >
                                {phases.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                            </select>
                            <LocalIcon src={chevronDownIcon} size={12} className="sk-select-arrow sk-icon" />
                        </div>
                    </div>

                    {isEditing ? (
                        <div className="sk-field">
                            <label className="sk-label">Content</label>
                            <textarea
                                className="sk-textarea"
                                placeholder="Type your lesson notes here..."
                                value={text}
                                onChange={(e) => setText(e.target.value)}
                            />
                        </div>
                    ) : (
                        <div className="sk-note-view">
                            <p className="sk-note-view__text">{text}</p>
                            <div className="sk-note-view__meta">
                                <span>ID: {lesson?.id?.slice(0, 6)}</span>
                                <span>{new Date(lesson?.timestamp).toLocaleDateString()}</span>
                            </div>
                        </div>
                    )}
                </div>

                <div className="sk-modal__foot">
                    <div className="sk-modal__foot-left">
                        {lesson && !isEditing && (
                            <>
                                <button onClick={() => setIsEditing(true)} className="sk-btn sk-btn--ghost">Edit</button>
                                <button onClick={handleDelete} className="sk-btn sk-btn--danger-ghost">Delete</button>
                            </>
                        )}
                    </div>
                    <div className="sk-modal__foot-right">
                        <button onClick={onClose} className="sk-btn sk-btn--ghost">Cancel</button>
                        <button
                            onClick={handleSave}
                            disabled={!text.trim()}
                            className={`sk-btn ${text.trim() ? 'sk-btn--primary' : 'sk-btn--disabled'}`}
                        >
                            {isEditing ? 'Save' : 'Close'}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

// ─── BOOK ITEM ────────────────────────────────────────────────────────────────
const BookItem = ({ data, onUpdate, onDelete }) => {
    const percent = data.pages > 0 ? Math.round((data.currentPage / data.pages) * 100) : 0;
    return (
        <div className="sk-item sk-item--book group">
            <div className="sk-item__cover-wrap">
                <img src={data.cover} alt="cover" className="sk-item__cover" />
                <div className="sk-item__cover-overlay">
                    <span className="sk-item__cover-label">{data.pages}p</span>
                </div>
            </div>
            <div className="sk-item__body">
                <div className="sk-item__row">
                    <div className="sk-item__title-wrap">
                        <h4 className="sk-item__title">{data.title}</h4>
                        <p className={`sk-item__type ${data.dbType === 'article' ? 'sk-item__type--emerald' : 'sk-item__type--book'}`}>
                            {data.dbType === 'article' ? 'Article' : 'Literature'}
                        </p>
                    </div>
                    <button onClick={onDelete} className="sk-icon-btn sk-icon-btn--delete group-hover:opacity-100">
                        <LocalIcon src={trashIcon} size={13} className="sk-icon sk-icon--delete" />
                    </button>
                </div>
                <div className="sk-progress">
                    <div className="sk-progress__track">
                        <div className={`sk-progress__fill ${data.dbType === 'article' ? 'sk-progress__fill--emerald' : 'sk-progress__fill--orange'}`} style={{ width: `${percent}%` }} />
                    </div>
                    <span className={`sk-progress__label ${data.dbType === 'article' ? 'sk-progress__label--emerald' : 'sk-progress__label--orange'}`}>{percent}%</span>
                </div>
                <div className="sk-item__controls">
                    <span className="sk-label">Page</span>
                    <div className="sk-num-input">
                        <input
                            type="number"
                            className="sk-num-input__field"
                            value={data.currentPage}
                            onChange={(e) => onUpdate(Math.min(parseInt(e.target.value) || 0, data.pages))}
                        />
                        <span className="sk-num-input__max">/ {data.pages}</span>
                    </div>
                    <div className="sk-dot-row group-hover:opacity-100">
                        {[...Array(5)].map((_, i) => (
                            <div key={i} className={`sk-dot ${i / 5 < percent / 100 ? (data.dbType === 'article' ? 'sk-dot--active-emerald' : 'sk-dot--active-orange') : ''}`} />
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
};

// ─── DOCUMENT ITEM ────────────────────────────────────────────────────────────
const DocumentItem = ({ data, onUpdate, onDelete }) => {
    const percent = data.pages > 0 ? Math.round((data.currentPage / data.pages) * 100) : 0;
    return (
        <div className="sk-item sk-item--doc group">
            <div className="sk-item__cover-wrap">
                <img src={data.cover} alt="cover" className="sk-item__cover" />
                <div className="sk-item__cover-overlay">
                    <span className="sk-item__cover-label">{data.pages}p</span>
                </div>
            </div>
            <div className="sk-item__body">
                <div className="sk-item__row">
                    <div className="sk-item__title-wrap">
                        <h4 className="sk-item__title">{data.title}</h4>
                        <p className="sk-item__type sk-item__type--doc">Document</p>
                    </div>
                    <button onClick={onDelete} className="sk-icon-btn sk-icon-btn--delete group-hover:opacity-100">
                        <LocalIcon src={trashIcon} size={13} className="sk-icon sk-icon--delete" />
                    </button>
                </div>
                <div className="sk-progress">
                    <div className="sk-progress__track">
                        <div className="sk-progress__fill sk-progress__fill--blue" style={{ width: `${percent}%` }} />
                    </div>
                    <span className="sk-progress__label sk-progress__label--blue">{percent}%</span>
                </div>
                <div className="sk-item__controls">
                    <span className="sk-label">Progress</span>
                    <div className="sk-num-input">
                        <input
                            type="number"
                            className="sk-num-input__field"
                            value={data.currentPage}
                            onChange={(e) => onUpdate(Math.min(parseInt(e.target.value) || 0, data.pages))}
                        />
                        <span className="sk-num-input__max">/ {data.pages}</span>
                    </div>
                </div>
            </div>
        </div>
    );
};

// ─── TASK ITEM ────────────────────────────────────────────────────────────────
const TaskItem = ({ data, onUpdate, onDelete }) => {
    return (
        <div className="sk-item sk-item--task group">
            <div className="sk-checkbox-wrap">
                <input
                    type="checkbox"
                    checked={data.completed}
                    onChange={(e) => onUpdate({ completed: e.target.checked })}
                    className="sk-checkbox"
                />
                {data.completed && (
                    <LocalIcon src={checkIcon} size={10} className="sk-checkbox-check" />
                )}
            </div>
            <div className="sk-item__body">
                <span className={`sk-task-text ${data.completed ? 'sk-task-text--done' : ''}`}>{data.text}</span>
                <p className="sk-item__type sk-item__type--task">Task</p>
            </div>
            <button onClick={onDelete} className="sk-icon-btn sk-icon-btn--delete">
                <LocalIcon src={trashIcon} size={13} className="sk-icon sk-icon--delete" />
            </button>
        </div>
    );
};

// ─── COUNTER ITEM ─────────────────────────────────────────────────────────────
const CounterItem = ({ data, onUpdate, onDelete }) => {
    const isHours = data.type === 'hours';
    const percent = data.target > 0 ? Math.round((data.current / data.target) * 100) : 0;

    return (
        <div className={`sk-item sk-item--counter group ${isHours ? 'sk-item--counter-purple' : ''}`}>
            <div className="sk-item__body">
                <div className="sk-counter__row">
                    <div className="sk-counter__info">
                        <span className="sk-item__type" style={{ color: isHours ? 'var(--purple)' : 'var(--blue)', opacity: 0.7 }}>{isHours ? 'Hours' : 'Count'}</span>
                        <div className="sk-counter__value">
                            <span className="sk-counter__num">{data.current}</span>
                            <span className="sk-counter__max">/{data.target}</span>
                        </div>
                    </div>
                    <div className="sk-counter__actions">
                        <button
                            onClick={() => onUpdate(data.current + 1)}
                            className={`sk-counter__inc-sm ${isHours ? 'sk-counter__inc--purple' : 'sk-counter__inc--blue'}`}
                        >
                            <LocalIcon src={plusIcon} size={12} className="sk-icon--white" />
                        </button>
                        <button onClick={onDelete} className="sk-icon-btn sk-icon-btn--delete">
                            <LocalIcon src={trashIcon} size={12} className="sk-icon sk-icon--delete" />
                        </button>
                    </div>
                </div>
                <div className="sk-progress sk-progress--sm">
                    <div className="sk-progress__track">
                        <div
                            className={`sk-progress__fill ${isHours ? 'sk-progress__fill--purple' : 'sk-progress__fill--blue'}`}
                            style={{ width: `${percent}%` }}
                        />
                    </div>
                    <span className={`sk-progress__label ${isHours ? 'sk-progress__label--purple' : 'sk-progress__label--blue'}`}>{percent}%</span>
                </div>
                <div className="sk-num-input sk-num-input--inline">
                    <LocalIcon src={editIcon} size={12} className="sk-icon--muted" />
                    <input
                        type="number"
                        className="sk-num-input__field sk-num-input__field--center"
                        value={data.current}
                        onChange={(e) => onUpdate(Math.min(parseInt(e.target.value) || 0, data.target))}
                    />
                    <span className="sk-label">set</span>
                </div>
            </div>
        </div>
    );
};

// ─── ADD ITEM MODAL ───────────────────────────────────────────────────────────
const AddItemModal = ({ isOpen, onClose, onAddItem }) => {
    const [step, setStep] = useState(1);
    const [selectedType, setSelectedType] = useState(null);
    const [books, setBooks] = useState([]);
    const [booksLoading, setBooksLoading] = useState(true);
    const [selectedBook, setSelectedBook] = useState(null);
    const [currentPage, setCurrentPage] = useState(0);
    const [taskText, setTaskText] = useState("");
    const [counterType, setCounterType] = useState("count");
    const [counterTarget, setCounterTarget] = useState(100);
    const [selectedPdf, setSelectedPdf] = useState(null);
    const [isGeneratingPath, setIsGeneratingPath] = useState(false);
    const [bookSearch, setBookSearch] = useState("");
    const [selectedShelfFilter, setSelectedShelfFilter] = useState('all');
    const [selectedCategoryFilter, setSelectedCategoryFilter] = useState('all');

    const resetModal = () => {
        setStep(1); setSelectedType(null); setSelectedBook(null);
        setCurrentPage(0); setTaskText(""); setCounterType("count");
        setCounterTarget(100); setBooks([]); setSelectedPdf(null); setIsGeneratingPath(false); setBookSearch("");
        setSelectedShelfFilter('all'); setSelectedCategoryFilter('all');
    };

    const handleClose = () => { resetModal(); onClose(); };

    useEffect(() => {
        const loadLocalBooks = async () => {
            setBooksLoading(true);
            const bookDirs = [
                { path: BOOK_READING_PATH, type: 'book', progress: BOOK_PROGRESS_PATH, thumb: BOOK_THUMBNAIL_PATH, shelf: 'reading' },
                { path: BOOK_WANT_PATH, type: 'book', progress: BOOK_PROGRESS_PATH, thumb: BOOK_THUMBNAIL_PATH, shelf: 'want' },
                { path: BOOK_READ_PATH, type: 'book', progress: BOOK_PROGRESS_PATH, thumb: BOOK_THUMBNAIL_PATH, shelf: 'read' },
                { path: ARTICLE_READING_PATH, type: 'article', progress: ARTICLE_PROGRESS_PATH, thumb: ARTICLE_THUMBNAIL_PATH, shelf: 'reading' },
                { path: ARTICLE_WANT_PATH, type: 'article', progress: ARTICLE_PROGRESS_PATH, thumb: ARTICLE_THUMBNAIL_PATH, shelf: 'want' },
                { path: ARTICLE_READ_PATH, type: 'article', progress: ARTICLE_PROGRESS_PATH, thumb: ARTICLE_THUMBNAIL_PATH, shelf: 'read' },
            ];
            const results = [];
            
            const processFile = async (fileName, dirPath, category, config) => {
                const fullPath = path.join(dirPath, fileName);
                const name = path.basename(fileName, '.pdf');

                let coverPath = null;
                const extensions = ['.jpg', '.jpeg', '.png'];
                for (const ext of extensions) {
                    const cachedPath = path.join(config.thumb, name + ext);
                    if (fs.existsSync(cachedPath)) { coverPath = cachedPath; break; }
                }
                if (!coverPath) {
                    for (const ext of extensions) {
                        const potential = path.join(dirPath, name + ext);
                        if (fs.existsSync(potential)) { coverPath = potential; break; }
                    }
                }

                const meta = readBookMeta(name, config.progress);
                let totalPages = meta.pages;
                if (!totalPages) {
                    try {
                        pdfjsLib.GlobalWorkerOptions.workerSrc = workerUrl;
                        const data = await readFile(fullPath);
                        const pdf = await pdfjsLib.getDocument({ data }).promise;
                        totalPages = pdf.numPages;
                        cacheBookPages(name, totalPages, config.progress);
                    } catch (err) { totalPages = 0; }
                }

                results.push({ 
                    id: fullPath, 
                    title: name, 
                    pages: totalPages, 
                    cover: coverPath || path.join(config.thumb, name + '.jpg'), 
                    path: fullPath, 
                    currentProgress: meta.current, 
                    shelf: config.shelf, 
                    category: category || 'General',
                    dbType: config.type,
                    progressPath: config.progress 
                });
            };

            try {
                for (const config of bookDirs) {
                    if (!fs.existsSync(config.path)) continue;
                    const items = fs.readdirSync(config.path, { withFileTypes: true });
                    for (const item of items) {
                        if (item.isDirectory()) {
                            const catName = item.name;
                            if (catName.endsWith(' - Sessions')) continue;
                            const catPath = path.join(config.path, catName);
                            try {
                                const catFiles = fs.readdirSync(catPath);
                                for (const file of catFiles) {
                                    if (path.extname(file).toLowerCase() === '.pdf') {
                                        await processFile(file, catPath, catName, config);
                                    }
                                }
                            } catch (e) {}
                        } else {
                            if (path.extname(item.name).toLowerCase() === '.pdf') {
                                await processFile(item.name, config.path, null, config);
                            }
                        }
                    }
                }
                setBooks(results);
            } catch (err) { console.error(err); }
            setBooksLoading(false);
        };
        if (isOpen && (selectedType === 'book' || selectedType === 'document') && step === 2) loadLocalBooks();
    }, [isOpen, selectedType, step]);

    const categories = Array.from(new Set(
        books.filter(b => (selectedType === 'document' ? b.dbType === 'article' : b.dbType === 'book'))
             .map(b => b.category)
    )).sort();

    const filteredBooks = books.filter(b => {
        const typeMatch = selectedType === 'document' ? b.dbType === 'article' : b.dbType === 'book';
        const matchesSearch = b.title.toLowerCase().includes(bookSearch.toLowerCase());
        const matchesShelf = selectedShelfFilter === 'all' || b.shelf === selectedShelfFilter;
        const matchesCategory = selectedCategoryFilter === 'all' || b.category === selectedCategoryFilter;
        return typeMatch && matchesSearch && matchesShelf && matchesCategory;
    });

    const handleAddFinal = async () => {
        if ((selectedType === 'book' || selectedType === 'document') && selectedBook) {
            let initialP = 0;
            if (selectedBook.shelf === 'read') initialP = selectedBook.pages;
            else if (selectedBook.shelf === 'reading') initialP = selectedBook.currentProgress;
            else initialP = 0;
            
            onAddItem({ 
                type: selectedType, 
                data: { 
                    title: selectedBook.title, 
                    pages: selectedBook.pages, 
                    cover: selectedBook.cover, 
                    currentPage: initialP,
                    dbType: selectedBook.dbType,
                    progressPath: selectedBook.progressPath,
                    path: selectedBook.path
                } 
            });
        } else if (selectedType === 'task' && taskText.trim()) {
            onAddItem({ type: 'task', data: { text: taskText.trim(), completed: false } });
        } else if (selectedType === 'counter') {
            onAddItem({ type: 'counter', data: { type: counterType, current: 0, target: counterTarget } });
        }
        handleClose();
    };

    if (!isOpen) return null;

    const canProceed = !((selectedType === 'book' || selectedType === 'document') && !selectedBook) &&
        !(selectedType === 'task' && !taskText.trim());

    const accentMap = { book: 'orange', document: 'blue', task: 'emerald', counter: 'blue' };
    const accent = selectedType ? accentMap[selectedType] : 'blue';

    return (
        <div className="sk-overlay" onMouseDown={(e) => { if (e.target === e.currentTarget) handleClose(); }}>
        <div className="sk-modal sk-modal--md">
                <div className="sk-modal__head sk-modal__head--tiny">
                    <div />
                    <button onClick={handleClose} className="sk-icon-btn">
                        <LocalIcon src={closeIcon} size={11} className="sk-icon" />
                    </button>
                </div>

                <div className="sk-modal__body">
                    {step === 1 && (
                        <div className="sk-type-grid">
                            {[
                                { type: 'book', icon: bookIcon, label: 'Literature', desc: 'Sync PDF files', accent: 'orange' },
                                { type: 'document', icon: conceptsIcon, label: 'Articles', desc: 'Sync PDF files', accent: 'blue' },
                                { type: 'task', icon: checkIcon, label: 'Task', desc: 'Actionable item', accent: 'emerald' },
                                { type: 'counter', icon: chartIcon, label: 'Metric', desc: 'Continuous tracker', accent: 'blue' },
                            ].map(item => (
                                <button
                                    key={item.type}
                                    onClick={() => { setSelectedType(item.type); setStep(2); }}
                                    className={`sk-type-btn sk-type-btn--${item.accent}`}
                                >
                                    <div className={`sk-type-btn__icon sk-type-btn__icon--${item.accent}`}>
                                        <LocalIcon src={item.icon} size={18} className={`sk-icon--${item.accent}`} />
                                    </div>
                                    <div className="sk-type-btn__content">
                                        <span className="sk-type-btn__label">{item.label}</span>
                                        <span className="sk-type-btn__desc">{item.desc}</span>
                                    </div>
                                    <LocalIcon src={chevronRightIcon} size={11} className="sk-icon--muted" />
                                </button>
                            ))}
                        </div>
                    )}

                    {step === 2 && (selectedType === 'book' || selectedType === 'document') && (
                        <div className="sk-fade-in">
                            {booksLoading ? (
                                <div className="sk-empty-state">
                                    <img src={rotateIcon} className="w-5 h-5 invert animate-spin opacity-40" alt="loading" />
                                    <span className="sk-label mt-2">Scanning workspace…</span>
                                </div>
                            ) : (
                                <>
                                    <div className="flex gap-2 mb-3 items-stretch" style={{ height: '32px' }}>
                                        <div className="sk-search-wrap mb-0 flex-1" style={{ height: '100%' }}>
                                            <LocalIcon src={menuIcon} size={12} className="sk-icon--muted sk-search-icon" />
                                            <input
                                                className="sk-search-input"
                                                placeholder="Search library..."
                                                value={bookSearch}
                                                onChange={e => setBookSearch(e.target.value)}
                                                autoFocus
                                            />
                                            {bookSearch && (
                                                <button className="sk-search-clear" onClick={() => setBookSearch("")}>
                                                    <LocalIcon src={closeIcon} size={9} className="sk-icon--muted" />
                                                </button>
                                            )}
                                        </div>

                                            <div className="sk-select-wrap" style={{ width: '100px', height: '100%' }}>
                                                <select 
                                                    className="sk-select" 
                                                    style={{ height: '100%', fontSize: '0.6rem', padding: '0 1.5rem 0 0.5rem', background: 'var(--bg-3)', cursor: 'pointer', margin: 0 }}
                                                    value={selectedShelfFilter}
                                                    onChange={(e) => setSelectedShelfFilter(e.target.value)}
                                            >
                                                <option value="all">All Shelves</option>
                                                <option value="reading">Currently Reading</option>
                                                <option value="want">Queue</option>
                                                <option value="read">Read</option>
                                            </select>
                                            <div className="sk-select-arrow">
                                                <LocalIcon src={chevronDownIcon} size={8} className="sk-icon--muted" />
                                            </div>
                                        </div>

                                            <div className="sk-select-wrap" style={{ width: '100px', height: '100%' }}>
                                                <select 
                                                    className="sk-select" 
                                                    style={{ height: '100%', fontSize: '0.6rem', padding: '0 1.5rem 0 0.5rem', background: 'var(--bg-3)', cursor: 'pointer', margin: 0 }}
                                                    value={selectedCategoryFilter}
                                                onChange={(e) => setSelectedCategoryFilter(e.target.value)}
                                            >
                                                <option value="all">All Cats</option>
                                                {categories.map(cat => (
                                                    <option key={cat} value={cat}>{cat}</option>
                                                ))}
                                            </select>
                                            <div className="sk-select-arrow">
                                                <LocalIcon src={chevronDownIcon} size={8} className="sk-icon--muted" />
                                            </div>
                                        </div>
                                    </div>

                                    <div className="sk-book-list">
                                        {filteredBooks.length === 0 ? (
                                            <div className="sk-phase__empty">No items found matching filters</div>
                                        ) : (
                                            filteredBooks.map(book => (
                                                <div
                                                    key={book.id}
                                                    onClick={() => setSelectedBook(book)}
                                                    className={`sk-book-row ${selectedBook?.id === book.id ? 'sk-book-row--selected' : ''}`}
                                                >
                                                    <LocalCover path={book.cover} pdfPath={book.path} className="sk-book-row__cover" />
                                                    <div className="flex flex-col flex-1 min-width-0">
                                                        <span className="sk-book-row__title">{book.title}</span>
                                                        <span style={{ fontSize: '0.5rem', color: 'var(--text-4)', textTransform: 'uppercase' }}>
                                                            {book.shelf} · {book.category}
                                                        </span>
                                                    </div>
                                                    {selectedBook?.id === book.id && (
                                                        <LocalIcon src={checkIcon} size={11} className="sk-icon--orange" />
                                                    )}
                                                </div>
                                            ))
                                        )}
                                    </div>
                                </>
                            )}
                            {selectedBook && (
                                <div className="sk-info-row sk-fade-in">
                                    <span className="sk-label sk-label--italic">Synced from bookshelf</span>
                                    <span className="sk-value--orange">p.{selectedBook.currentProgress} <span className="sk-value--muted">/ {selectedBook.pages}</span></span>
                                </div>
                            )}
                        </div>
                    )}

                    {step === 2 && selectedType === 'task' && (
                        <div className="sk-fade-in">
                            <textarea
                                className="sk-textarea"
                                placeholder="State actionable intent…"
                                value={taskText}
                                onChange={(e) => setTaskText(e.target.value)}
                                autoFocus
                            />
                        </div>
                    )}

                    {step === 2 && selectedType === 'counter' && (
                        <div className="sk-fade-in space-y-3">
                            <div className="sk-toggle-grid">
                                <button
                                    onClick={() => setCounterType('count')}
                                    className={`sk-toggle ${counterType === 'count' ? 'sk-toggle--blue' : ''}`}
                                >
                                    <LocalIcon src={hashIcon} size={14} className="sk-icon--muted" /> Integer
                                </button>
                                <button
                                    onClick={() => setCounterType('hours')}
                                    className={`sk-toggle ${counterType === 'hours' ? 'sk-toggle--purple' : ''}`}
                                >
                                    <LocalIcon src={clockIcon} size={14} className="sk-icon--muted" /> Temporal
                                </button>
                            </div>
                            <div className="sk-field-row">
                                <LocalIcon src={goalsIcon} size={18} className="sk-icon--muted" />
                                <input
                                    type="number"
                                    className="sk-num-input__field flex-1"
                                    value={counterTarget}
                                    onChange={(e) => setCounterTarget(parseInt(e.target.value) || 0)}
                                />
                                <span className="sk-label">threshold</span>
                            </div>
                        </div>
                    )}
                </div>

                {step === 2 && (
                    <div className="sk-modal__foot">
                        <button onClick={() => setStep(1)} className="sk-btn sk-btn--ghost">Back</button>
                        <button
                            onClick={handleAddFinal}
                            disabled={!canProceed && selectedType !== 'counter'}
                            className={`sk-btn sk-btn--accent-${accent} flex-1`}
                        >
                            Initialize
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
};

// ─── MAIN COMPONENT ───────────────────────────────────────────────────────────
export default function SkillsApp({ showNavbar = true }) {
    const { data, refreshData } = useData();
    const location = useLocation();
    const navigate = useNavigate();
    const { skillId, fromGoal, goalName, roadmapId, journalId, goalId } = location.state || {};
    const [skills, setSkills] = useState(data.skills.allSkills || []);
    const [activeSkillId, setActiveSkillId] = useState(() => skillId || localStorage.getItem('lastActiveSkillId') || null);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [modalMode, setModalMode] = useState('skill');
    const [newSkillName, setNewSkillName] = useState("");
    const [newPhaseName, setNewPhaseName] = useState("");
    const [isItemModalOpen, setIsItemModalOpen] = useState(false);
    const [activePhaseIdForItem, setActivePhaseIdForItem] = useState(null);
    const [isSidebarOpen, setIsSidebarOpen] = useState(false);
    const [editingSkillId, setEditingSkillId] = useState(null);
    const [editingSkillName, setEditingSkillName] = useState("");
    const [isRightSidebarOpen, setIsRightSidebarOpen] = useState(false);
    const [isPlanOpen, setIsPlanOpen] = useState(false);
    const [selectedLessonPhaseId, setSelectedLessonPhaseId] = useState("");
    const [isLessonModalOpen, setIsLessonModalOpen] = useState(false);
    const [currentEditingLesson, setCurrentEditingLesson] = useState(null);
    const [deleteConfirmSkillId, setDeleteConfirmSkillId] = useState(null);
    const [editingPhaseId, setEditingPhaseId] = useState(null);
    const [editingPhaseName, setEditingPhaseName] = useState("");

    const activeSkill = useMemo(() => skills.find(s => s.id === activeSkillId), [skills, activeSkillId]);
    const currentLessons = useMemo(() => activeSkill?.lessons || [], [activeSkill]);

    useEffect(() => {
        if (activeSkill) {
            const phaseExists = activeSkill.phases.some(p => p.id === selectedLessonPhaseId);
            if (selectedLessonPhaseId && !phaseExists) {
                setSelectedLessonPhaseId(activeSkill.phases.length > 0 ? activeSkill.phases[0].id : "");
            }
        }
    }, [activeSkill, selectedLessonPhaseId]);

    const calculateProgress = (items) => {
        if (!items || items.length === 0) return 0;
        const totalProgress = items.reduce((sum, item) => {
            if (item.type === 'book' || item.type === 'document') return sum + (item.data.currentPage / item.data.pages);
            if (item.type === 'task') return sum + (item.data.completed ? 1 : 0);
            if (item.type === 'counter') return sum + (item.data.current / item.data.target);
            return sum;
        }, 0);
        return Math.round((totalProgress / items.length) * 100);
    };

    const overallProgress = useMemo(() => {
        if (!activeSkill || !activeSkill.phases || activeSkill.phases.length === 0) return 0;
        const total = activeSkill.phases.reduce((sum, phase) => sum + calculateProgress(phase.items), 0);
        return Math.round(total / activeSkill.phases.length);
    }, [activeSkill]);

    const [skillSortMode, setSkillSortMode] = useState(() => localStorage.getItem('skillSortMode') || 'newest');

    useEffect(() => {
        localStorage.setItem('skillSortMode', skillSortMode);
    }, [skillSortMode]);

    const getSkillProgress = (skill) => {
        if (!skill || !skill.phases || skill.phases.length === 0) return 0;
        const total = skill.phases.reduce((sum, phase) => sum + calculateProgress(phase.items), 0);
        return Math.round(total / skill.phases.length);
    };

    const getSkillItemsCount = (skill) => {
        if (!skill || !skill.phases) return 0;
        return skill.phases.reduce((sum, phase) => sum + (phase.items ? phase.items.length : 0), 0);
    };

    const sortedSkills = useMemo(() => {
        const sorted = [...skills];
        if (skillSortMode === 'oldest') {
            return sorted.reverse();
        } else if (skillSortMode === 'completion') {
            return sorted.sort((a, b) => getSkillProgress(b) - getSkillProgress(a));
        } else if (skillSortMode === 'items') {
            return sorted.sort((a, b) => getSkillItemsCount(b) - getSkillItemsCount(a));
        }
        return sorted;
    }, [skills, skillSortMode]);

    const saveSkill = async (skill) => {
        try {
            await writeFile(path.join(SKILLS, `${skill.id}.json`), JSON.stringify(skill, null, 2), 'utf-8');
        } catch (err) { console.error(err); }
    };

    useEffect(() => {
        if (data.skills && data.skills.allSkills) {
            setSkills(data.skills.allSkills);
            const skillExists = activeSkillId && data.skills.allSkills.some(s => s.id === activeSkillId);
            if ((!activeSkillId || !skillExists) && data.skills.allSkills.length > 0) {
                setActiveSkillId(skillId || data.skills.allSkills[0].id);
            }
        }
    }, [data.skills, activeSkillId, skillId]);

    useEffect(() => {
        if (activeSkillId) {
            localStorage.setItem('lastActiveSkillId', activeSkillId);
        }
    }, [activeSkillId]);

    const handleCreateSkill = () => {
        const name = newSkillName.trim();
        if (!name) return;
        const newSkill = { id: generateId(), name, phases: [], lessons: [] };
        saveSkill(newSkill).then(() => { setSkills(prev => [newSkill, ...prev]); setActiveSkillId(newSkill.id); });
        setIsModalOpen(false); setNewSkillName("");
    };

    const handleAddPhase = () => {
        if (!activeSkill) return;
        const name = newPhaseName.trim();
        if (!name) return;
        const newPhase = { id: generateId(), name, items: [] };
        const updatedSkill = { ...activeSkill, phases: [...activeSkill.phases, newPhase] };
        saveSkill(updatedSkill).then(() => setSkills(prev => prev.map(s => s.id === activeSkill.id ? updatedSkill : s)));
        setIsModalOpen(false); setNewPhaseName("");
    };

    const handleDeleteSkill = async (id) => {
        try {
            await unlink(path.join(SKILLS, `${id}.json`));
            refreshData();
            const remaining = skills.filter(s => s.id !== id);
            setSkills(remaining);
            if (activeSkillId === id) {
                const next = remaining[0]?.id || null;
                setActiveSkillId(next);
                if (next) setIsSidebarOpen(true);
            }
        } catch (err) { console.error(err); }
    };

    const handleRenameSkill = async (id) => {
        const name = editingSkillName.trim();
        if (!name) { setEditingSkillId(null); return; }
        const skill = skills.find(s => s.id === id);
        if (!skill) { setEditingSkillId(null); return; }
        const updated = { ...skill, name };
        await saveSkill(updated);
        setSkills(prev => prev.map(s => s.id === id ? updated : s));
        setEditingSkillId(null);
    };

    const handleDeletePhase = async (phaseId) => {
        if (!activeSkill) return;
        const updated = { ...activeSkill, phases: activeSkill.phases.filter(p => p.id !== phaseId) };
        await saveSkill(updated);
        setSkills(prev => prev.map(s => s.id === activeSkillId ? updated : s));
    };

    const handleRenamePhase = async (phaseId) => {
        const name = editingPhaseName.trim();
        setEditingPhaseId(null);
        if (!name || !activeSkill) return;
        const updated = {
            ...activeSkill,
            phases: activeSkill.phases.map(p => p.id === phaseId ? { ...p, name } : p)
        };
        await saveSkill(updated);
        setSkills(prev => prev.map(s => s.id === activeSkillId ? updated : s));
    };

    const handleMovePhaseUp = async (index) => {
        if (!activeSkill || index <= 0) return;
        const newPhases = [...activeSkill.phases];
        [newPhases[index - 1], newPhases[index]] = [newPhases[index], newPhases[index - 1]];
        const updated = { ...activeSkill, phases: newPhases };
        await saveSkill(updated);
        setSkills(prev => prev.map(s => s.id === activeSkillId ? updated : s));
    };

    const handleMovePhaseDown = async (index) => {
        if (!activeSkill || index >= activeSkill.phases.length - 1) return;
        const newPhases = [...activeSkill.phases];
        [newPhases[index + 1], newPhases[index]] = [newPhases[index], newPhases[index + 1]];
        const updated = { ...activeSkill, phases: newPhases };
        await saveSkill(updated);
        setSkills(prev => prev.map(s => s.id === activeSkillId ? updated : s));
    };

    const handleAddItem = async (itemData) => {
        if (!activeSkill || !activePhaseIdForItem) return;
        const newItem = { id: generateId(), ...itemData };
        const updated = {
            ...activeSkill,
            phases: activeSkill.phases.map(p =>
                p.id === activePhaseIdForItem ? { ...p, items: [...(p.items || []), newItem] } : p
            )
        };
        await saveSkill(updated);
        setSkills(prev => prev.map(s => s.id === activeSkillId ? updated : s));
    };

    const handleUpdateItem = async (phaseId, itemId, updates) => {
        if (!activeSkill) return;
        let bookInfo = null;
        const phase = activeSkill.phases.find(p => p.id === phaseId);
        if (phase) {
            const item = phase.items.find(i => i.id === itemId);
            if (item && item.type === 'book') bookInfo = { title: item.data.title, progressPath: item.data.progressPath };
        }
        const updated = {
            ...activeSkill,
            phases: activeSkill.phases.map(p =>
                p.id === phaseId ? {
                    ...p,
                    items: (p.items || []).map(i =>
                        i.id === itemId ? { ...i, data: { ...i.data, ...updates } } : i
                    )
                } : p
            )
        };
        await saveSkill(updated);
        setSkills(prev => prev.map(s => s.id === activeSkillId ? updated : s));
        if (bookInfo && updates.currentPage !== undefined) {
            await writeBookProgress(bookInfo.title, updates.currentPage, bookInfo.progressPath);
        }
    };

    const handleDeleteItem = async (phaseId, itemId) => {
        if (!activeSkill) return;
        const updated = {
            ...activeSkill,
            phases: activeSkill.phases.map(p =>
                p.id === phaseId ? { ...p, items: (p.items || []).filter(i => i.id !== itemId) } : p
            )
        };
        await saveSkill(updated);
        setSkills(prev => prev.map(s => s.id === activeSkillId ? updated : s));
    };

    const handleMainModalSubmit = (e) => {
        e.preventDefault();
        if (modalMode === 'skill') handleCreateSkill();
        else handleAddPhase();
    };

    const openCreateLessonModal = () => {
        if (!activeSkill || !activeSkill.phases.length) return;
        setCurrentEditingLesson(null);
        setIsLessonModalOpen(true);
    };

    const openReadLessonModal = (lesson) => {
        setCurrentEditingLesson(lesson);
        setIsLessonModalOpen(true);
    };

    const handleSaveLesson = async (lessonData) => {
        if (!activeSkill) return;
        const updatedLessons = currentEditingLesson
            ? currentLessons.map(l => l.id === lessonData.id ? lessonData : l)
            : [...currentLessons, lessonData];
        const updatedSkill = { ...activeSkill, lessons: updatedLessons };
        await saveSkill(updatedSkill);
        setSkills(prev => prev.map(s => s.id === activeSkillId ? updatedSkill : s));
    };

    useEffect(() => {
        if (fromGoal && activeSkillId && activeSkillId !== skillId) {
            navigate('/Growth/skills', { replace: true, state: {} });
        }
    }, [activeSkillId, fromGoal, skillId, navigate]);

    const handleDeleteLesson = async (lessonId) => {
        if (!activeSkill) return;
        const updatedLessons = currentLessons.filter(l => l.id !== lessonId);
        const updatedSkill = { ...activeSkill, lessons: updatedLessons };
        await saveSkill(updatedSkill);
        setSkills(prev => prev.map(s => s.id === activeSkillId ? updatedSkill : s));
    };

    return (
        <div className={`sk-root${showNavbar ? '' : ' sk-root--no-nav'}`}>
            {showNavbar && (
                <div className="sk-navbar-wrap">
                    <Navbar />
                </div>
            )}

            {/* Left edge hover trigger */}
            <div
                className="sk-edge-trigger"
                onMouseEnter={() => { if (!isSidebarOpen) setIsSidebarOpen(true); }}
            />

            {/* Left Sidebar */}
            <aside
                className={`sk-sidebar sk-sidebar--left ${isSidebarOpen ? 'sk-sidebar--open' : ''}`}
                onMouseLeave={() => setIsSidebarOpen(false)}
            >
                <div className="sk-sidebar__inner">
                    <div className="sk-sidebar__head">
                        <span className="sk-sidebar__title">Skill Set</span>
                        <button
                            onClick={() => { setModalMode('skill'); setNewSkillName(""); setNewPhaseName(""); setIsModalOpen(true); }}
                            className="sk-icon-btn"
                        >
                            <LocalIcon src={plusIcon} size={11} className="sk-icon" />
                        </button>
                    </div>
                    {skills.length > 0 && (
                        <div className="sk-sidebar__filter-zone" style={{ padding: '0.5rem 1rem' }}>
                            <div className="sk-select-wrap">
                                <select
                                    className="sk-select cursor-pointer"
                                    value={skillSortMode}
                                    onChange={(e) => setSkillSortMode(e.target.value)}
                                >
                                    <option value="newest">Newest Added</option>
                                    <option value="oldest">Oldest Added</option>
                                    <option value="completion">Completion</option>
                                    <option value="items">Items Count</option>
                                </select>
                                <LocalIcon src={chevronDownIcon} size={10} className="sk-select-arrow sk-icon--muted" />
                            </div>
                        </div>
                    )}
                    <div className="sk-sidebar__list">
                        {skills.length === 0 ? (
                            <div className="sk-empty-state sk-fade-in">
                                <LocalIcon src={brainIcon} size={28} className="sk-icon--muted opacity-20" />
                                <p className="sk-label mt-2">No Skills Detected</p>
                                <button
                                    onClick={() => { setModalMode('skill'); setNewSkillName(""); setNewPhaseName(""); setIsModalOpen(true); }}
                                    className="sk-btn sk-btn--ghost mt-3"
                                >
                                    <LocalIcon src={plusIcon} size={11} className="sk-icon" /> Create Skill
                                </button>
                            </div>
                        ) : (
                            sortedSkills.map(skill => (
                                <div
                                    key={skill.id}
                                    onClick={() => {
                                        if (editingSkillId !== skill.id) {
                                            setActiveSkillId(skill.id);
                                            setIsSidebarOpen(false);
                                            navigate('/Growth/skills', { replace: true, state: {} });
                                        }
                                    }}
                                    className={`sk-skill-row group ${activeSkillId === skill.id ? 'sk-skill-row--active' : ''}`}
                                >
                                    <div className={`sk-skill-row__dot ${activeSkillId === skill.id ? 'sk-skill-row__dot--active' : ''}`} />
                                    {editingSkillId === skill.id ? (
                                        <input
                                            type="text"
                                            className="sk-inline-edit"
                                            value={editingSkillName}
                                            onChange={(e) => setEditingSkillName(e.target.value)}
                                            onKeyDown={(e) => { if (e.key === 'Enter') handleRenameSkill(skill.id); if (e.key === 'Escape') setEditingSkillId(null); }}
                                            onBlur={() => handleRenameSkill(skill.id)}
                                            onClick={(e) => e.stopPropagation()}
                                            autoFocus
                                        />
                                    ) : (
                                        <span className="sk-skill-row__name">{skill.name}</span>
                                    )}
                                    {editingSkillId !== skill.id && (
                                        <div className="sk-skill-row__actions">
                                            <button
                                                onClick={(e) => { e.stopPropagation(); setEditingSkillId(skill.id); setEditingSkillName(skill.name); }}
                                                className="sk-icon-btn"
                                            >
                                                <LocalIcon src={editIcon} size={10} className="sk-icon" />
                                            </button>
                                            <button
                                                onClick={(e) => { e.stopPropagation(); setDeleteConfirmSkillId(skill.id); }}
                                                className="sk-icon-btn"
                                            >
                                                <LocalIcon src={trashIcon} size={10} className="sk-icon sk-icon--delete" />
                                            </button>
                                        </div>
                                    )}
                                </div>
                            ))
                        )}
                    </div>
                </div>
            </aside>

            {/* Right Sidebar — Lessons */}
            <aside className={`sk-sidebar sk-sidebar--right ${isRightSidebarOpen ? 'sk-sidebar--open' : ''}`}>
                <div className="sk-sidebar__inner">
                    <div className="sk-sidebar__head sk-sidebar__head--tall">
                        <div>
                            <div className="flex items-center gap-2">
                                <LocalIcon src={conceptsIcon} size={16} className="sk-icon--blue" />
                                <span className="sk-sidebar__title">Lessons</span>
                            </div>
                            <p className="sk-sidebar__sub">Knowledge Base</p>
                        </div>
                        <button onClick={() => setIsRightSidebarOpen(false)} className="sk-icon-btn">
                            <LocalIcon src={closeIcon} size={13} className="sk-icon" />
                        </button>
                    </div>

                    <div className="sk-sidebar__filter-zone">
                        <label className="sk-label">Filter by phase</label>
                        <div className="sk-select-wrap mt-1">
                            <select
                                className="sk-select"
                                value={selectedLessonPhaseId}
                                onChange={(e) => setSelectedLessonPhaseId(e.target.value)}
                                disabled={!activeSkill || activeSkill.phases.length === 0}
                            >
                                {!activeSkill ? <option>No Skill Selected</option> :
                                    activeSkill.phases.length === 0 ? <option>No Phases</option> : (
                                        <>
                                            <option value="">All Phases</option>
                                            {activeSkill.phases.map(p => (
                                                <option key={p.id} value={p.id}>{p.name}</option>
                                            ))}
                                        </>
                                    )
                                }
                            </select>
                            <LocalIcon src={chevronDownIcon} size={12} className="sk-select-arrow sk-icon" />
                        </div>
                        <button
                            onClick={openCreateLessonModal}
                            disabled={!activeSkill || activeSkill.phases.length === 0}
                            className={`sk-btn sk-btn--full mt-2 ${(!activeSkill || activeSkill.phases.length === 0) ? 'sk-btn--disabled' : 'sk-btn--ghost-active'}`}
                        >
                            <LocalIcon src={plusIcon} size={13} className="sk-icon" /> New Lesson
                        </button>
                    </div>

                    <div className="sk-sidebar__list sk-sidebar__list--lessons">
                        {!activeSkill ? (
                            <div className="sk-empty-state">
                                <LocalIcon src={userIcon} size={28} className="sk-icon--muted opacity-20" />
                                <p className="sk-label mt-2">Awaiting Selection</p>
                            </div>
                        ) : activeSkill.phases.length === 0 ? (
                            <div className="sk-empty-state">
                                <LocalIcon src={menuIcon} size={28} className="sk-icon--muted opacity-20" />
                                <p className="sk-label mt-2">No Phases Found</p>
                            </div>
                        ) : (
                            <div className="space-y-6">
                                {activeSkill.phases.map(phase => {
                                    if (selectedLessonPhaseId && phase.id !== selectedLessonPhaseId) return null;
                                    const phaseLessons = currentLessons.filter(l => l.phaseId === phase.id);
                                    return (
                                        <div key={phase.id} className="sk-fade-in">
                                            <div className="sk-phase-header sk-phase-header--sticky">
                                                <div className="sk-phase-header__bar" />
                                                <span className="sk-phase-header__name">{phase.name}</span>
                                            </div>
                                            {phaseLessons.length === 0 ? (
                                                <div className="sk-empty-dashed">
                                                    <p className="sk-label sk-label--dim">No entries recorded</p>
                                                </div>
                                            ) : (
                                                <ul className="space-y-2">
                                                    {phaseLessons.map(lesson => (
                                                        <li
                                                            key={lesson.id}
                                                            onClick={() => openReadLessonModal(lesson)}
                                                            className="sk-lesson-card group"
                                                        >
                                                            <p className="sk-lesson-card__text line-clamp-3">{lesson.text}</p>
                                                            <div className="sk-lesson-card__meta">
                                                                <span>ID:{lesson.id.slice(0, 4)}</span>
                                                                <span>{new Date(lesson.timestamp).toLocaleDateString()}</span>
                                                            </div>
                                                            <div className="sk-lesson-card__arrow">
                                                                <LocalIcon src={chevronRightIcon} size={10} className="sk-icon--blue" />
                                                            </div>
                                                        </li>
                                                    ))}
                                                </ul>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                </div>
            </aside>

            {/* Main Content */}
            <main className="sk-main">
                {activeSkill ? (
                    <>
                        {/* Header */}
                        <header className="sk-header">
                            <div className="sk-header__left">
                                <button
                                    onClick={() => setIsSidebarOpen(!isSidebarOpen)}
                                    className="sk-icon-btn sk-icon-btn--lg"
                                >
                                    <LocalIcon src={menuIcon} size={17} className="sk-icon" />
                                </button>
                                <div className="sk-header__title-group">
                                    <h2 className="sk-header__title">{activeSkill.name}</h2>
                                    <div className="sk-header__progress">
                                        <div className="sk-header__progress-track">
                                            <div className="sk-header__progress-fill" style={{ width: `${overallProgress}%` }} />
                                        </div>
                                        <span className="sk-header__progress-label">{overallProgress}%</span>
                                    </div>
                                </div>
                            </div>

                            <div className="sk-header__actions">
                                {fromGoal && activeSkillId === skillId && (
                                    <div className="sk-nav-group">
                                        <button onClick={() => navigate('/Growth/goals')} className="sk-nav-btn">
                                            <LocalIcon src={goalsIcon} size={14} className="sk-icon--muted" />
                                            <span>Goals</span>
                                        </button>
                                        {roadmapId && (
                                            <button onClick={() => navigate('/Growth/roadmap', { state: { roadmapId, fromGoal, goalId, goalName, journalId, skillId: activeSkillId } })} className="sk-nav-btn">
                                                <LocalIcon src={roadmapIcon} size={14} className="sk-icon--muted" />
                                                <span>Map</span>
                                            </button>
                                        )}
                                        {journalId && (
                                            <button onClick={() => navigate('/DailyJournal', { state: { targetTitle: goalName, fromGoal, goalId, roadmapId, skillId: activeSkillId } })} className="sk-nav-btn">
                                                <LocalIcon src={journalIcon} size={14} className="sk-icon--muted" />
                                                <span>Journal</span>
                                            </button>
                                        )}
                                    </div>
                                )}

                                <button
                                    onClick={() => setIsPlanOpen(!isPlanOpen)}
                                    className={`sk-hdr-btn ${isPlanOpen ? 'sk-hdr-btn--active' : ''}`}
                                >
                                    <LocalIcon src={planIcon} size={14} className={isPlanOpen ? "sk-icon--black" : "sk-icon--muted"} />
                                    <span className="hidden sm:inline">Plan</span>
                                </button>

                                <button
                                    onClick={() => setIsRightSidebarOpen(!isRightSidebarOpen)}
                                    className={`sk-hdr-btn ${isRightSidebarOpen ? 'sk-hdr-btn--active' : ''}`}
                                >
                                    <LocalIcon src={conceptsIcon} size={14} className={isRightSidebarOpen ? "sk-icon--black" : "sk-icon--muted"} />
                                    <span className="hidden sm:inline">Notes</span>
                                </button>

                                <button
                                    onClick={() => { setModalMode('phase'); setNewSkillName(""); setNewPhaseName(""); setIsModalOpen(true); }}
                                    className="sk-hdr-btn sk-hdr-btn--primary"
                                >
                                    <LocalIcon src={plusIcon} size={14} className="sk-icon--black" />
                                    <span className="hidden sm:inline">Phase</span>
                                </button>
                            </div>
                        </header>

                        {/* Plan Banner */}
                        {isPlanOpen && (
                            <div className="sk-plan-bar">
                                <div className="sk-plan-bar__inner">
                                    <div className="flex items-center gap-1.5 mb-1.5">
                                        <LocalIcon src={planIcon} size={12} className="sk-icon--muted" />
                                        <span className="sk-label">Skill Plan</span>
                                    </div>
                                    <textarea
                                        className="sk-textarea sk-textarea--plan"
                                        rows={3}
                                        placeholder="Write your plan for this skill…"
                                        value={activeSkill.plan || ''}
                                        onChange={(e) => {
                                            const updatedSkill = { ...activeSkill, plan: e.target.value };
                                            setSkills(prev => prev.map(s => s.id === activeSkillId ? updatedSkill : s));
                                        }}
                                        onBlur={() => {
                                            const current = skills.find(s => s.id === activeSkillId);
                                            if (current) saveSkill(current);
                                        }}
                                    />
                                </div>
                            </div>
                        )}

                        {/* Phase List */}
                        <div className="sk-content">
                            {activeSkill.phases.length === 0 ? (
                                <div className="sk-empty-full">
                                    <div className="sk-empty-full__icon">
                                        <LocalIcon src={conceptsIcon} size={32} className="sk-icon--muted opacity-20" />
                                    </div>
                                    <h3 className="sk-empty-full__title">No phases yet</h3>
                                    <p className="sk-empty-full__sub">Add a phase to begin structuring your skill</p>
                                </div>
                            ) : (
                                <div className="sk-phase-list">
                                    {activeSkill.phases.map((phase, index) => {
                                        const progress = calculateProgress(phase.items);
                                        return (
                                            <div key={phase.id} className="sk-phase group/phase">
                                                <div className="sk-phase__head">
                                                    <div className="sk-phase__head-left">
                                                        <span className="sk-phase__badge">PH</span>
                                                        {editingPhaseId === phase.id ? (
                                                            <input
                                                                className="sk-inline-edit sk-phase__name-edit"
                                                                value={editingPhaseName}
                                                                autoFocus
                                                                onChange={e => setEditingPhaseName(e.target.value)}
                                                                onKeyDown={e => { if (e.key === 'Enter') handleRenamePhase(phase.id); if (e.key === 'Escape') setEditingPhaseId(null); }}
                                                                onBlur={() => handleRenamePhase(phase.id)}
                                                                onClick={e => e.stopPropagation()}
                                                            />
                                                        ) : (
                                                            <h3
                                                                className="sk-phase__name sk-phase__name--editable"
                                                                onClick={() => { setEditingPhaseId(phase.id); setEditingPhaseName(phase.name); }}
                                                                title="Click to rename"
                                                            >{phase.name}</h3>
                                                        )}
                                                        <div className="sk-mini-progress">
                                                            <div className="sk-mini-progress__track">
                                                                <div className="sk-mini-progress__fill" style={{ width: `${progress}%` }} />
                                                            </div>
                                                            <span className="sk-mini-progress__label">{progress}%</span>
                                                        </div>
                                                    </div>
                                                    <div className="sk-phase__head-actions">
                                                        {phase.items?.some(i => i.type === 'book') && (
                                                            <button
                                                                onClick={async () => {
                                                                    const bookItems = phase.items.filter(i => i.type === 'book');
                                                                    for (const item of bookItems) {
                                                                        const synced = readBookProgress(item.data.title, item.data.progressPath);
                                                                        await handleUpdateItem(phase.id, item.id, { currentPage: synced });
                                                                    }
                                                                }}
                                                                className="sk-phase-action sk-phase-action--sync"
                                                                title="Sync book progress"
                                                            >
                                                                <LocalIcon src={rotateIcon} size={11} className="sk-icon--white" />
                                                                <span style={{ color: 'var(--white)' }}>Sync</span>
                                                            </button>
                                                        )}
                                                        <button
                                                            onClick={() => handleMovePhaseUp(index)}
                                                            className={`sk-phase-action ${index === 0 ? 'opacity-30 cursor-not-allowed' : ''}`}
                                                            disabled={index === 0}
                                                        >
                                                            <div style={{ transform: 'rotate(180deg)', display: 'flex' }}>
                                                                <LocalIcon src={chevronDownIcon} size={12} className="sk-icon--muted" />
                                                            </div>
                                                        </button>
                                                        <button
                                                            onClick={() => handleMovePhaseDown(index)}
                                                            className={`sk-phase-action ${index === activeSkill.phases.length - 1 ? 'opacity-30 cursor-not-allowed' : ''}`}
                                                            disabled={index === activeSkill.phases.length - 1}
                                                        >
                                                            <LocalIcon src={chevronDownIcon} size={12} className="sk-icon--muted" />
                                                        </button>
                                                        <button
                                                            onClick={() => { setActivePhaseIdForItem(phase.id); setIsItemModalOpen(true); }}
                                                            className="sk-phase-action"
                                                        >
                                                            <LocalIcon src={plusIcon} size={12} className="sk-icon--muted" />
                                                            <span className="hidden sm:inline">Add</span>
                                                        </button>
                                                        <button
                                                            onClick={() => handleDeletePhase(phase.id)}
                                                            className="sk-phase-action"
                                                        >
                                                            <LocalIcon src={trashIcon} size={12} className="sk-icon sk-icon--delete" />
                                                        </button>
                                                    </div>
                                                </div>

                                                <div className="sk-phase__items">
                                                    {(!phase.items || phase.items.length === 0) ? (
                                                        <div className="sk-phase__empty">
                                                            <p className="sk-label sk-label--dim">Empty module</p>
                                                        </div>
                                                    ) : (
                                                        phase.items.map(item => (
                                                            <div key={item.id} className="sk-phase__item">
                                                                {item.type === 'book' && (
                                                                    <BookItem
                                                                        data={item.data}
                                                                        onUpdate={(val) => handleUpdateItem(phase.id, item.id, { currentPage: val })}
                                                                        onDelete={() => handleDeleteItem(phase.id, item.id)}
                                                                    />
                                                                )}
                                                                {item.type === 'document' && (
                                                                    <DocumentItem
                                                                        data={item.data}
                                                                        onUpdate={(val) => handleUpdateItem(phase.id, item.id, { currentPage: val })}
                                                                        onDelete={() => handleDeleteItem(phase.id, item.id)}
                                                                    />
                                                                )}
                                                                {item.type === 'task' && (
                                                                    <TaskItem
                                                                        data={item.data}
                                                                        onUpdate={(val) => handleUpdateItem(phase.id, item.id, val)}
                                                                        onDelete={() => handleDeleteItem(phase.id, item.id)}
                                                                    />
                                                                )}
                                                                {item.type === 'counter' && (
                                                                    <CounterItem
                                                                        data={item.data}
                                                                        onUpdate={(val) => handleUpdateItem(phase.id, item.id, { current: val })}
                                                                        onDelete={() => handleDeleteItem(phase.id, item.id)}
                                                                    />
                                                                )}
                                                            </div>
                                                        ))
                                                    )}
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    </>
                ) : (
                    <div className="sk-empty-full">
                        <div className="sk-empty-full__icon">
                            <LocalIcon src={brainIcon} size={40} className="sk-icon--muted opacity-15" />
                        </div>
                        {skills.length === 0 ? (
                            <>
                                <h3 className="sk-empty-full__title">No skills detected</h3>
                                <p className="sk-empty-full__sub">Start your growth journey by creating your first skill</p>
                                <button
                                    onClick={() => { setModalMode('skill'); setNewSkillName(""); setNewPhaseName(""); setIsModalOpen(true); }}
                                    className="sk-btn sk-btn--primary mt-4 px-6"
                                >
                                    <LocalIcon src={plusIcon} size={14} className="mr-2" /> Create Your First Skill
                                </button>
                            </>
                        ) : (
                            <>
                                <h3 className="sk-empty-full__title">No skill selected</h3>
                                <p className="sk-empty-full__sub">Hover the left edge or press the menu icon to begin</p>
                            </>
                        )}
                    </div>
                )}
            </main>

            {/* ── Modals ── */}
            <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={modalMode === 'skill' ? "New Skill" : "New Phase"}>
                <form onSubmit={handleMainModalSubmit}>
                    <label className="sk-label">{modalMode === 'skill' ? "Skill Name" : "Phase Name"}</label>
                    <input
                        type="text"
                        className="sk-input mt-1"
                        placeholder={modalMode === 'skill' ? "e.g. Learn Piano" : "e.g. Fundamentals"}
                        value={modalMode === 'skill' ? newSkillName : newPhaseName}
                        onChange={(e) => modalMode === 'skill' ? setNewSkillName(e.target.value) : setNewPhaseName(e.target.value)}
                        autoFocus
                    />
                    <div className="sk-modal__foot mt-3">
                        <div />
                        <div className="sk-modal__foot-right">
                            <button type="button" onClick={() => { setIsModalOpen(false); setNewSkillName(""); setNewPhaseName(""); }} className="sk-btn sk-btn--ghost">Cancel</button>
                            <button type="submit" className="sk-btn sk-btn--primary">Create</button>
                        </div>
                    </div>
                </form>
            </Modal>

            <AddItemModal
                isOpen={isItemModalOpen}
                onClose={() => setIsItemModalOpen(false)}
                onAddItem={handleAddItem}
            />

            <LessonModal
                isOpen={isLessonModalOpen}
                onClose={() => setIsLessonModalOpen(false)}
                lesson={currentEditingLesson}
                phases={activeSkill?.phases || []}
                initialPhaseId={selectedLessonPhaseId || (activeSkill?.phases[0]?.id)}
                onSave={handleSaveLesson}
                onDelete={handleDeleteLesson}
            />

            {deleteConfirmSkillId && (
                <div className="sk-overlay" onMouseDown={(e) => { if (e.target === e.currentTarget) setDeleteConfirmSkillId(null); }}>
        <div className="sk-modal sk-modal--sm">
                        <div className="sk-modal__head">
                            <div className="flex items-center gap-2">
                                <LocalIcon src={trashIcon} size={13} className="sk-icon--delete opacity-70" />
                                <span className="sk-modal__title">Delete Skill</span>
                            </div>
                        </div>
                        <div className="sk-modal__body">
                            <p className="sk-body-text">
                                Delete <span className="text-white font-semibold">{skills.find(s => s.id === deleteConfirmSkillId)?.name}</span>? All phases, items, and lessons will be permanently removed.
                            </p>
                        </div>
                        <div className="sk-modal__foot">
                            <div />
                            <div className="sk-modal__foot-right">
                                <button onClick={() => setDeleteConfirmSkillId(null)} className="sk-btn sk-btn--ghost">Cancel</button>
                                <button onClick={() => { handleDeleteSkill(deleteConfirmSkillId); setDeleteConfirmSkillId(null); }} className="sk-btn sk-btn--danger">Delete</button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            <style>{`
@import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500;600;700&family=DM+Sans:wght@300;400;500;600;700&display=swap');

*, *::before, *::after { box-sizing: border-box; }

:root {
  --bg: #000000;
  --bg-1: #080808;
  --bg-2: #0f0f0f;
  --bg-3: #141414;
  --bg-4: #1a1a1a;
  --border: rgba(255,255,255,0.06);
  --border-2: rgba(255,255,255,0.10);
  --text: #e4e4e4;
  --text-2: #a0a0a0;
  --text-3: #555555;
  --text-4: #333333;
  --white: #ffffff;
  --blue: #3b82f6;
  --blue-dim: rgba(59,130,246,0.12);
  --blue-border: rgba(59,130,246,0.25);
  --orange: #f97316;
  --orange-dim: rgba(249,115,22,0.12);
  --orange-border: rgba(249,115,22,0.25);
  --emerald: #10b981;
  --emerald-dim: rgba(16,185,129,0.12);
  --emerald-border: rgba(16,185,129,0.25);
  --purple: #a855f7;
  --purple-dim: rgba(168,85,247,0.12);
  --purple-border: rgba(168,85,247,0.25);
  --red: #ef4444;
  --red-dim: rgba(239,68,68,0.08);
  font-family: 'DM Sans', sans-serif;
}

/* ── Scrollbar ── */
.sk-scroll::-webkit-scrollbar { width: 3px; }
.sk-scroll::-webkit-scrollbar-track { background: transparent; }
.sk-scroll::-webkit-scrollbar-thumb { background: var(--bg-4); border-radius: 4px; }
.sk-scroll::-webkit-scrollbar-thumb:hover { background: var(--border-2); }
*::-webkit-scrollbar { width: 3px; }
*::-webkit-scrollbar-track { background: transparent; }
*::-webkit-scrollbar-thumb { background: var(--bg-4); border-radius: 4px; }

/* ── Root Layout ── */
.sk-root { height: 100vh; width: 100%; background: var(--bg); color: var(--text); overflow: hidden; position: relative; }
.sk-navbar-wrap { position: fixed; top: 0; left: 0; right: 0; z-index: 60; height: 3.5rem; border-bottom: 1px solid var(--border); }
.sk-edge-trigger { position: fixed; left: 0; top: 3.5rem; bottom: 0; width: 18px; z-index: 55; }

/* ── Sidebars ── */
.sk-sidebar { position: fixed; top: 0; bottom: 0; z-index: 40; width: 260px; background: var(--bg-1); border-right: 1px solid var(--border); transform: translateX(-100%); transition: transform 240ms cubic-bezier(0.4,0,0.2,1); display: flex; flex-direction: column; }
.sk-sidebar--left { left: 3rem; }
.sk-sidebar--right { right: 0; left: auto; border-right: none; border-left: 1px solid var(--border); transform: translateX(100%); width: 280px; z-index: 100; }
.sk-sidebar--open { transform: translateX(0); }
.sk-sidebar__inner { display: flex; flex-direction: column; height: 100%; padding-top: 3.5rem; }
.sk-root--no-nav .sk-sidebar__inner { padding-top: 0; }
.sk-sidebar__head { display: flex; align-items: center; justify-content: space-between; padding: 0.875rem 1rem; border-bottom: 1px solid var(--border); }
.sk-sidebar__head--tall { padding: 1.25rem 1rem; }
.sk-sidebar__title { font-size: 0.7rem; font-weight: 700; color: var(--text-2); text-transform: uppercase; letter-spacing: 0.12em; font-family: 'IBM Plex Mono', monospace; }
.sk-sidebar__sub { font-size: 0.6rem; color: var(--text-3); text-transform: uppercase; letter-spacing: 0.1em; margin-top: 0.2rem; font-family: 'IBM Plex Mono', monospace; }
.sk-sidebar__list { flex: 1; overflow-y: auto; padding: 0.5rem; }
.sk-sidebar__list--lessons { padding: 1rem; }
.sk-sidebar__filter-zone { padding: 0.875rem 1rem; border-bottom: 1px solid var(--border); }

/* ── Skill Rows ── */
.sk-skill-row { display: flex; align-items: center; gap: 0.5rem; padding: 0.4rem 0.5rem; border-radius: 5px; cursor: pointer; transition: background 150ms, color 150ms; border: 1px solid transparent; }
.sk-skill-row:hover { background: var(--bg-3); color: var(--text); }
.sk-skill-row--active { background: var(--bg-3); border-color: var(--border-2); color: var(--white); }
.sk-skill-row__dot { width: 3px; height: 12px; border-radius: 2px; background: var(--bg-4); flex-shrink: 0; transition: background 150ms; }
.sk-skill-row__dot--active { background: var(--white); }
.sk-skill-row__name { font-size: 0.75rem; font-weight: 500; flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; color: inherit; }
.sk-skill-row__actions { display: flex; gap: 1px; opacity: 0; transition: opacity 150ms; }
.sk-skill-row:hover .sk-skill-row__actions { opacity: 1; }

/* ── Main ── */
.sk-main { width: 100%; height: 100%; display: flex; flex-direction: column; background: var(--bg-1); padding-left: 0; padding-top: 3.5rem; }
@media (min-width: 768px) { .sk-main { padding-left: 3rem; } }
.sk-root--no-nav .sk-main { padding-top: 0; }

/* ── Header ── */
.sk-header { background: var(--bg); border-bottom: 1px solid var(--border); padding: 0 1rem; height: 2.75rem; display: flex; align-items: center; justify-content: space-between; gap: 1rem; flex-shrink: 0; }
.sk-header__left { display: flex; align-items: center; gap: 0.625rem; flex: 1; min-width: 0; }
.sk-header__title-group { display: flex; align-items: center; gap: 0.75rem; min-width: 0; flex: 1; }
.sk-header__title { font-size: 0.8125rem; font-weight: 600; color: var(--text); letter-spacing: -0.01em; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.sk-header__progress { display: flex; align-items: center; gap: 0.5rem; }
.sk-header__progress-track { width: 4.5rem; height: 2px; background: var(--bg-4); border-radius: 2px; overflow: hidden; }
.sk-header__progress-fill { height: 100%; background: var(--white); border-radius: 2px; transition: width 400ms ease; }
.sk-header__progress-label { font-size: 0.625rem; font-family: 'IBM Plex Mono', monospace; color: var(--text-3); }
.sk-header__actions { display: flex; align-items: center; gap: 0.375rem; flex-shrink: 0; }

/* ── Header Buttons ── */
.sk-hdr-btn { display: flex; align-items: center; gap: 0.375rem; padding: 0.3rem 0.625rem; border-radius: 4px; font-size: 0.6875rem; font-weight: 600; text-transform: uppercase; letter-spacing: 0.06em; border: 1px solid var(--border-2); background: var(--bg); color: var(--text-3); cursor: pointer; transition: all 150ms; }
.sk-hdr-btn:hover { border-color: var(--border-2); color: var(--text); background: var(--bg-3); }
.sk-hdr-btn--active { background: var(--white) !important; color: #000 !important; border-color: var(--white) !important; }
.sk-hdr-btn--primary { background: var(--white); color: #000; border-color: var(--white); }
.sk-hdr-btn--primary:hover { background: #ddd; }

/* ── Nav Group ── */
.sk-nav-group { display: flex; gap: 0.25rem; align-items: center; padding-right: 0.625rem; margin-right: 0.25rem; border-right: 1px solid var(--border-2); }
.sk-nav-btn { display: flex; align-items: center; gap: 0.3rem; padding: 0.3rem 0.5rem; border-radius: 4px; font-size: 0.625rem; font-weight: 600; text-transform: uppercase; letter-spacing: 0.08em; border: 1px solid var(--border); background: var(--bg); color: var(--text-3); cursor: pointer; transition: all 150ms; }
.sk-nav-btn:hover { color: var(--text); border-color: var(--border-2); background: var(--bg-3); }

/* ── Plan Bar ── */
.sk-plan-bar { border-bottom: 1px solid var(--border); background: var(--bg); padding: 0.75rem 1rem; }
.sk-plan-bar__inner { max-width: 56rem; margin: 0 auto; }

/* ── Content ── */
.sk-content { flex: 1; overflow-y: auto; padding: 0.625rem 1rem 1rem; }
@media (min-width: 640px) { .sk-content { padding: 0.625rem 1.25rem 1.25rem; } }
@media (min-width: 1024px) { .sk-content { padding: 0.625rem 2rem 1.5rem; } }

/* ── Phase ── */
.sk-phase-list { display: flex; flex-direction: column; gap: 0.625rem; max-width: 56rem; margin: 0 auto; padding-bottom: 4rem; }
.sk-phase { background: var(--bg-2); border: 1px solid var(--border); border-radius: 7px; overflow: hidden; transition: border-color 200ms; }
.sk-phase:hover { border-color: var(--border-2); }
.sk-phase__head { display: flex; align-items: center; justify-content: space-between; gap: 0.75rem; padding: 0.5rem 0.75rem; border-bottom: 1px solid var(--border); background: var(--bg); }
.sk-phase__head-left { display: flex; align-items: center; gap: 0.5rem; flex: 1; min-width: 0; }
.sk-phase__badge { display: flex; align-items: center; justify-content: center; width: 1.375rem; height: 1.375rem; border-radius: 3px; background: var(--bg-3); border: 1px solid var(--border); font-size: 0.5rem; font-weight: 800; font-family: 'IBM Plex Mono', monospace; color: var(--text-3); flex-shrink: 0; }
.sk-phase__name { font-size: 0.7rem; font-weight: 700; color: var(--text); text-transform: uppercase; letter-spacing: 0.08em; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.sk-phase__head-actions { display: flex; align-items: center; gap: 0.25rem; }
.sk-phase-action--sync { opacity: 1; color: var(--white); }
.sk-phase__hover-actions { display: flex; align-items: center; gap: 0.25rem; }
.sk-phase__name--editable { cursor: text; }
.sk-phase__name--editable:hover { color: var(--white); }
.sk-phase__name-edit { font-size: 0.7rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.08em; flex: 1; min-width: 0; }
.sk-phase-action { display: flex; align-items: center; gap: 0.25rem; padding: 0.2rem 0.5rem; border-radius: 3px; font-size: 0.625rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.06em; color: var(--text-3); border: 1px solid transparent; cursor: pointer; transition: all 150ms; background: transparent; }
.sk-phase-action:hover { background: var(--bg-3); border-color: var(--border); color: var(--text-2); }
.sk-phase-action--sync:hover { color: var(--orange); border-color: var(--orange-border); background: var(--orange-dim); }
.sk-phase-action--delete:hover { color: var(--red); background: var(--red-dim); }
.sk-phase__items { padding: 0.375rem; display: flex; flex-direction: column; gap: 0.25rem; }
.sk-phase__item {}
.sk-phase__empty { text-align: center; padding: 0.75rem; }

/* ── Progress ── */
.sk-progress { display: flex; align-items: center; gap: 0.625rem; margin-top: 0.625rem; }
.sk-progress--sm { margin-top: 0.375rem; }
.sk-progress__track { flex: 1; height: 3px; background: var(--bg); border-radius: 2px; overflow: hidden; }
.sk-progress__fill { height: 100%; border-radius: 2px; transition: width 800ms ease-out; }
.sk-progress__fill--orange { background: var(--orange); box-shadow: 0 0 8px rgba(249,115,22,0.3); }
.sk-progress__fill--blue { background: var(--blue); box-shadow: 0 0 8px rgba(59,130,246,0.3); }
.sk-progress__fill--purple { background: var(--purple); box-shadow: 0 0 8px rgba(168,85,247,0.3); }
.sk-progress__fill--emerald { background: var(--emerald); }
.sk-progress__label { font-size: 0.6rem; font-family: 'IBM Plex Mono', monospace; font-weight: 700; min-width: 2rem; text-align: right; }
.sk-progress__label--orange { color: var(--orange); }
.sk-progress__label--blue { color: var(--blue); }
.sk-progress__label--purple { color: var(--purple); }

.sk-mini-progress { display: flex; align-items: center; gap: 0.375rem; }
.sk-mini-progress__track { width: 3.5rem; height: 2px; background: var(--bg-3); border-radius: 1px; overflow: hidden; }
.sk-mini-progress__fill { height: 100%; background: var(--text-3); border-radius: 1px; }
.sk-mini-progress__label { font-size: 0.55rem; font-family: 'IBM Plex Mono', monospace; color: var(--text-4); }

/* ── Items ── */
.sk-item { display: flex; gap: 0.875rem; padding: 0.625rem 0.75rem; border: 1px solid var(--border); border-radius: 6px; transition: border-color 200ms, background 200ms; background: var(--bg-2); }
.sk-item--book:hover { border-color: var(--orange-border); background: rgba(249,115,22,0.03); }
.sk-item--doc:hover { border-color: var(--blue-border); background: rgba(59,130,246,0.03); }
.sk-item--task:hover { border-color: var(--emerald-border); background: rgba(16,185,129,0.03); }
.sk-item--counter { flex-direction: column; }
.sk-item--counter:hover { border-color: var(--blue-border); }
.sk-item--counter-purple:hover { border-color: var(--purple-border) !important; }
.sk-item__cover-wrap { position: relative; flex-shrink: 0; }
.sk-item__cover { width: 3rem; height: 4.25rem; object-fit: cover; border-radius: 4px; }
@media (min-width: 640px) { .sk-item__cover { width: 3.5rem; height: 5rem; } }
.sk-item__cover-overlay { position: absolute; inset: 0; background: linear-gradient(to top, rgba(0,0,0,0.7), transparent); opacity: 0; transition: opacity 200ms; border-radius: 4px; display: flex; align-items: flex-end; justify-content: center; padding-bottom: 0.25rem; }
.sk-item__cover-wrap:hover .sk-item__cover-overlay { opacity: 1; }
.sk-item__cover-label { font-size: 0.5rem; font-weight: 800; color: #fff; text-transform: uppercase; letter-spacing: 0.1em; font-family: 'IBM Plex Mono', monospace; }
.sk-item__body { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 0.25rem; }
.sk-item__row { display: flex; align-items: flex-start; justify-content: space-between; gap: 0.5rem; }
.sk-item__title-wrap { flex: 1; min-width: 0; }
.sk-item__title { font-size: 0.8125rem; font-weight: 700; color: var(--white); letter-spacing: -0.01em; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.sk-item__type { font-size: 0.5rem; font-weight: 800; text-transform: uppercase; letter-spacing: 0.12em; font-family: 'IBM Plex Mono', monospace; margin-top: 0.125rem; }
.sk-item__type--book { color: var(--orange); opacity: 0.6; }
.sk-item__type--doc { color: var(--blue); opacity: 0.6; }
.sk-item__type--task { color: var(--emerald); opacity: 0.6; }
.sk-item__controls { display: flex; align-items: center; gap: 0.5rem; margin-top: 0.25rem; }

/* ── Task ── */
.sk-checkbox-wrap { position: relative; display: flex; align-items: center; justify-content: center; flex-shrink: 0; margin-top: 0.125rem; }
.sk-checkbox { appearance: none; width: 1.125rem; height: 1.125rem; border: 1.5px solid var(--bg-4); border-radius: 4px; transition: all 200ms; cursor: pointer; }
.sk-checkbox:checked { background: var(--emerald); border-color: var(--emerald); }
.sk-checkbox:hover { border-color: var(--emerald); }
.sk-checkbox-check { position: absolute; pointer-events: none; color: var(--bg); }
.sk-task-text { font-size: 0.8125rem; font-weight: 500; color: var(--text); line-height: 1.5; }
.sk-task-text--done { color: var(--text-4); text-decoration: line-through; text-decoration-color: rgba(16,185,129,0.3); }

/* ── Counter ── */
.sk-counter__row { display: flex; align-items: center; justify-content: space-between; gap: 0.5rem; }
.sk-counter__info { display: flex; flex-direction: column; gap: 0.1rem; }
.sk-counter__actions { display: flex; align-items: center; gap: 0.375rem; }
.sk-counter__icon-wrap { display: flex; align-items: center; justify-content: center; width: 2.25rem; height: 2.25rem; border-radius: 5px; background: var(--bg-3); border: 1px solid var(--border); flex-shrink: 0; }
.sk-counter__value { display: flex; align-items: baseline; gap: 0.25rem; }
.sk-counter__num { font-size: 1.625rem; font-weight: 800; color: var(--white); font-family: 'IBM Plex Mono', monospace; letter-spacing: -0.03em; line-height: 1; }
.sk-counter__max { font-size: 0.625rem; font-weight: 700; color: var(--text-4); font-family: 'IBM Plex Mono', monospace; }
.sk-counter__inc { display: flex; align-items: center; justify-content: center; width: 2rem; height: 2rem; border-radius: 5px; cursor: pointer; transition: all 150ms; border: none; }
.sk-counter__inc-sm { display: flex; align-items: center; justify-content: center; width: 1.375rem; height: 1.375rem; border-radius: 4px; cursor: pointer; transition: all 150ms; border: none; }
.sk-counter__inc--blue { background: var(--blue); }
.sk-counter__inc--blue:hover { background: #2563eb; }
.sk-counter__inc--purple { background: var(--purple); }
.sk-counter__inc--purple:hover { background: #9333ea; }
.sk-counter__inc:active, .sk-counter__inc-sm:active { transform: scale(0.9); }

/* ── Num Input ── */
.sk-num-input { display: flex; align-items: center; gap: 0.25rem; background: var(--bg); border: 1px solid var(--border); border-radius: 4px; padding: 0.125rem 0.5rem; }
.sk-num-input--inline { margin-top: 0.375rem; }
.sk-num-input__field { width: 3rem; background: transparent; border: none; color: var(--white); font-size: 0.75rem; font-weight: 600; font-family: 'IBM Plex Mono', monospace; outline: none; text-align: center; padding: 0.2rem 0; }
.sk-num-input__field--center { text-align: center; flex: 1; width: auto; }
.sk-num-input__max { font-size: 0.6rem; color: var(--text-4); font-weight: 700; font-family: 'IBM Plex Mono', monospace; }

/* ── Dot Row ── */
.sk-dot-row { display: flex; gap: 2px; opacity: 0; transition: opacity 200ms; }
.group:hover .sk-dot-row { opacity: 1; }
.sk-dot { width: 4px; height: 4px; border-radius: 50%; background: var(--bg-4); }
.sk-dot--active-orange { background: var(--orange); }

/* ── Modal ── */
.sk-overlay { position: fixed; inset: 0; z-index: 100; display: flex; align-items: center; justify-content: center; background: rgba(0,0,0,0.85); backdrop-filter: blur(6px); padding: 1rem; }
.sk-modal { background: var(--bg-1); border: 1px solid var(--border-2); border-radius: 8px; width: 100%; display: flex; flex-direction: column; box-shadow: 0 0 60px rgba(0,0,0,0.6); overflow: hidden; max-height: 85vh; }
.sk-modal--sm { max-width: 22rem; }
.sk-modal--md { max-width: 28rem; }
.sk-modal__head { display: flex; align-items: center; justify-content: space-between; padding: 0.75rem 1rem; border-bottom: 1px solid var(--border); background: var(--bg); flex-shrink: 0; }
.sk-modal__head--tiny { padding: 0.375rem 0.5rem; border-bottom: none; }
.sk-modal__title { font-size: 0.7rem; font-weight: 800; color: var(--white); text-transform: uppercase; letter-spacing: 0.12em; font-family: 'IBM Plex Mono', monospace; }
.sk-modal__sub { font-size: 0.55rem; color: var(--text-3); text-transform: uppercase; letter-spacing: 0.1em; margin-top: 0.2rem; font-family: 'IBM Plex Mono', monospace; }
.sk-modal__body { padding: 1rem; overflow-y: auto; }
.sk-modal__foot { display: flex; align-items: center; justify-content: space-between; padding: 0.625rem 1rem; border-top: 1px solid var(--border); background: var(--bg); flex-shrink: 0; }
.sk-modal__foot-right { display: flex; gap: 0.375rem; }
.sk-modal__foot-left { display: flex; gap: 0.375rem; }

/* ── Form Controls ── */
.sk-field { margin-bottom: 0.75rem; }
.sk-label { font-size: 0.6rem; font-weight: 700; color: var(--text-3); text-transform: uppercase; letter-spacing: 0.12em; font-family: 'IBM Plex Mono', monospace; }
.sk-label--italic { font-style: italic; }
.sk-label--dim { color: var(--text-4); }
.sk-input { width: 100%; background: var(--bg-2); border: 1px solid var(--border); color: var(--white); font-size: 0.8125rem; border-radius: 5px; padding: 0.4rem 0.625rem; outline: none; transition: border-color 150ms; }
.sk-input:focus { border-color: var(--border-2); }
.sk-textarea { width: 100%; background: var(--bg-2); border: 1px solid var(--border); color: var(--text); font-size: 0.8125rem; border-radius: 5px; padding: 0.5rem 0.75rem; outline: none; resize: none; line-height: 1.6; transition: border-color 150ms; placeholder-color: var(--text-4); height: 8rem; font-family: 'IBM Plex Mono', monospace; }
.sk-textarea--plan { height: auto; font-family: 'DM Sans', sans-serif; font-size: 0.8125rem; }
.sk-textarea:focus { border-color: var(--border-2); }
.sk-select-wrap { position: relative; }
.sk-select { width: 100%; background: var(--bg-2); border: 1px solid var(--border); color: var(--text); font-size: 0.8125rem; border-radius: 5px; padding: 0.3rem 2rem 0.3rem 0.625rem; appearance: none; outline: none; transition: border-color 150ms; cursor: pointer; }
.sk-select:focus { border-color: var(--border-2); }
.sk-select-arrow { position: absolute; right: 0.625rem; top: 50%; transform: translateY(-50%); pointer-events: none; }

/* ── Buttons ── */
.sk-btn { padding: 0.3rem 0.75rem; border-radius: 4px; font-size: 0.6875rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.07em; cursor: pointer; transition: all 150ms; border: 1px solid transparent; }
.sk-btn--ghost { color: var(--text-3); background: transparent; border-color: transparent; }
.sk-btn--ghost:hover { color: var(--text); background: var(--bg-3); }
.sk-btn--ghost-active { color: var(--text-2); background: var(--bg-2); border-color: var(--border); }
.sk-btn--ghost-active:hover { color: var(--white); border-color: var(--blue); }
.sk-btn--primary { background: var(--white); color: #000; }
.sk-btn--primary:hover { background: #ddd; }
.sk-btn--danger { background: var(--red); color: #fff; }
.sk-btn--danger:hover { background: #dc2626; }
.sk-btn--danger-ghost { color: var(--text-3); background: transparent; }
.sk-btn--danger-ghost:hover { color: var(--red); background: var(--red-dim); }
.sk-btn--disabled { background: var(--bg-3); color: var(--text-4); cursor: not-allowed; }
.sk-btn--full { width: 100%; display: flex; align-items: center; justify-content: center; gap: 0.375rem; }
.sk-btn--accent-orange { background: var(--orange); color: #fff; border-color: transparent; }
.sk-btn--accent-orange:hover { background: #ea6c10; }
.sk-btn--accent-blue { background: var(--blue); color: #fff; }
.sk-btn--accent-blue:hover { background: #2563eb; }
.sk-btn--accent-emerald { background: var(--emerald); color: #fff; }
.sk-btn--accent-emerald:hover { background: #059669; }

/* ── Icon Button ── */
.sk-icon-btn { display: flex; align-items: center; justify-content: center; width: 1.625rem; height: 1.625rem; border-radius: 4px; background: transparent; border: 1px solid transparent; cursor: pointer; transition: all 150ms; }
.sk-icon-btn:hover { background: var(--bg-3); border-color: var(--border); }
.sk-icon-btn--lg { width: 1.875rem; height: 1.875rem; }
.sk-icon-btn--delete { transition: background 150ms; }
.sk-icon-btn--delete:hover { background: var(--red-dim) !important; }

/* ── Icons ── */
.sk-icon { color: var(--text-3); }
.sk-icon--delete { color: var(--text-4); }
.sk-icon--delete:hover { color: var(--red); }
.sk-icon--blue { color: var(--blue); }
.sk-icon--orange { color: var(--orange); }
.sk-icon--purple { color: var(--purple); }
.sk-icon--white { color: var(--white); }
.sk-icon--black { color: #000; }
.sk-icon--muted { color: var(--text-3); }

/* ── Type selector ── */
.sk-type-grid { display: flex; flex-direction: column; gap: 0.375rem; }
.sk-type-btn { display: flex; align-items: center; gap: 0.75rem; padding: 0.625rem 0.75rem; border-radius: 5px; border: 1px solid var(--border); background: var(--bg-2); cursor: pointer; transition: all 150ms; text-align: left; }
.sk-type-btn:hover { background: var(--bg-3); }
.sk-type-btn--orange:hover { border-color: var(--orange-border); }
.sk-type-btn--blue:hover { border-color: var(--blue-border); }
.sk-type-btn--emerald:hover { border-color: var(--emerald-border); }
.sk-type-btn__icon { width: 2rem; height: 2rem; border-radius: 4px; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
.sk-type-btn__icon--orange { background: var(--orange-dim); border: 1px solid var(--orange-border); }
.sk-type-btn__icon--blue { background: var(--blue-dim); border: 1px solid var(--blue-border); }
.sk-type-btn__icon--emerald { background: var(--emerald-dim); border: 1px solid var(--emerald-border); }
.sk-type-btn__content { flex: 1; }
.sk-type-btn__label { display: block; font-size: 0.725rem; font-weight: 700; color: var(--text); text-transform: uppercase; letter-spacing: 0.08em; }
.sk-type-btn__desc { display: block; font-size: 0.6rem; color: var(--text-3); margin-top: 0.1rem; font-family: 'IBM Plex Mono', monospace; }

/* ── Toggle ── */
.sk-toggle-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 0.375rem; }
.sk-toggle { display: flex; align-items: center; justify-content: center; gap: 0.375rem; padding: 0.4rem; border-radius: 4px; font-size: 0.6rem; font-weight: 800; text-transform: uppercase; letter-spacing: 0.1em; border: 1px solid var(--border); background: var(--bg-2); color: var(--text-3); cursor: pointer; font-family: 'IBM Plex Mono', monospace; transition: all 150ms; }
.sk-toggle--blue { background: var(--blue-dim); border-color: var(--blue-border); color: var(--blue); }
.sk-toggle--purple { background: var(--purple-dim); border-color: var(--purple-border); color: var(--purple); }

/* ── Book List ── */
.sk-search-wrap { display: flex; align-items: center; gap: 0.5rem; background: var(--bg-2); border: 1px solid var(--border); border-radius: 5px; padding: 0.3rem 0.625rem; margin-bottom: 0.5rem; transition: border-color 150ms; }
.sk-search-wrap:focus-within { border-color: var(--border-2); }
.sk-search-icon { flex-shrink: 0; }
.sk-search-input { flex: 1; background: transparent; border: none; outline: none; color: var(--text); font-size: 0.8125rem; font-family: 'DM Sans', sans-serif; }
.sk-search-input::placeholder { color: var(--text-4); }
.sk-search-clear { display: flex; align-items: center; justify-content: center; background: transparent; border: none; cursor: pointer; padding: 0.1rem; opacity: 0.6; transition: opacity 150ms; }
.sk-search-clear:hover { opacity: 1; }
.sk-book-list { display: flex; flex-direction: column; gap: 0.25rem; overflow-y: auto; overflow-x: hidden; max-height: 18rem; margin-bottom: 0.625rem; }
.sk-book-row { display: flex; align-items: center; gap: 0.625rem; padding: 0.5rem 0.625rem; border-radius: 4px; border: 1px solid var(--border); background: var(--bg-2); cursor: pointer; transition: all 150ms; }
.sk-book-row:hover { border-color: var(--border-2); background: var(--bg-3); }
.sk-book-row--selected { background: var(--orange-dim); border-color: var(--orange-border); }
.sk-book-row__cover { width: 1.75rem; height: 1.75rem; object-fit: cover; border-radius: 2px; background: var(--bg-4); flex-shrink: 0; }
.sk-book-row__title { flex: 1; font-size: 0.6875rem; font-weight: 600; color: var(--text-2); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

/* ── Dropzone ── */
.sk-dropzone { width: 100%; display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 2rem 1rem; border: 1px dashed var(--border-2); border-radius: 6px; background: var(--bg-2); cursor: pointer; transition: all 150ms; }
.sk-dropzone:hover { border-color: var(--blue); background: var(--blue-dim); }
.sk-dropzone__icon { width: 2.5rem; height: 2.5rem; border-radius: 50%; background: var(--blue-dim); border: 1px solid var(--blue-border); display: flex; align-items: center; justify-content: center; }

/* ── PDF Preview ── */
.sk-pdf-preview { display: flex; align-items: center; gap: 0.75rem; background: var(--bg-2); border: 1px solid var(--border); border-radius: 5px; padding: 0.5rem 0.75rem; }
.sk-pdf-preview__thumb { width: 2.25rem; height: 3rem; object-fit: cover; border-radius: 3px; border: 1px solid var(--border); flex-shrink: 0; }
.sk-pdf-preview__info { flex: 1; overflow: hidden; }
.sk-pdf-preview__title { display: block; font-size: 0.75rem; font-weight: 700; color: var(--white); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

/* ── Info/Field Row ── */
.sk-info-row { display: flex; align-items: center; justify-content: space-between; background: var(--bg-2); border: 1px solid var(--border); border-radius: 4px; padding: 0.375rem 0.625rem; }
.sk-field-row { display: flex; align-items: center; gap: 0.5rem; background: var(--bg-2); border: 1px solid var(--border); border-radius: 4px; padding: 0.3rem 0.625rem; }
.sk-value--orange { font-size: 0.75rem; font-weight: 700; color: var(--orange); font-family: 'IBM Plex Mono', monospace; }
.sk-value--muted { color: var(--text-4); }

/* ── Note View ── */
.sk-note-view { background: var(--bg-2); border: 1px solid var(--border); border-radius: 5px; padding: 0.75rem; min-height: 7rem; }
.sk-note-view__text { font-size: 0.8125rem; color: var(--text); white-space: pre-wrap; line-height: 1.65; }
.sk-note-view__meta { display: flex; justify-content: space-between; margin-top: 0.75rem; padding-top: 0.5rem; border-top: 1px solid var(--border); font-size: 0.55rem; color: var(--text-4); font-family: 'IBM Plex Mono', monospace; font-weight: 700; text-transform: uppercase; letter-spacing: 0.08em; }

/* ── Lesson Card ── */
.sk-lesson-card { background: var(--bg-2); border: 1px solid var(--border); border-radius: 5px; padding: 0.625rem 0.75rem; cursor: pointer; transition: all 150ms; position: relative; overflow: hidden; }
.sk-lesson-card:hover { border-color: var(--blue-border); background: var(--bg-3); }
.sk-lesson-card__text { font-size: 0.75rem; color: var(--text-2); line-height: 1.55; }
.sk-lesson-card:hover .sk-lesson-card__text { color: var(--text); }
.sk-lesson-card__meta { display: flex; justify-content: space-between; margin-top: 0.5rem; padding-top: 0.375rem; border-top: 1px solid var(--border); font-size: 0.55rem; color: var(--text-4); font-family: 'IBM Plex Mono', monospace; font-weight: 700; text-transform: uppercase; letter-spacing: 0.06em; }
.sk-lesson-card__arrow { position: absolute; top: 0.625rem; right: 0.625rem; opacity: 0; transform: translateX(4px); transition: opacity 150ms, transform 150ms; }
.sk-lesson-card:hover .sk-lesson-card__arrow { opacity: 1; transform: translateX(0); }

/* ── Phase header in lessons sidebar ── */
.sk-phase-header { display: flex; align-items: center; gap: 0.5rem; margin-bottom: 0.5rem; }
.sk-phase-header--sticky { position: sticky; top: 0; background: var(--bg-1); z-index: 10; padding: 0.25rem 0; }
.sk-phase-header__bar { width: 2px; height: 0.875rem; background: var(--blue); border-radius: 1px; flex-shrink: 0; }
.sk-phase-header__name { font-size: 0.6rem; font-weight: 800; color: var(--text-2); text-transform: uppercase; letter-spacing: 0.15em; font-family: 'IBM Plex Mono', monospace; }

/* ── Empty states ── */
.sk-empty-state { display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 2rem 1rem; }
.sk-empty-full { display: flex; flex-direction: column; align-items: center; justify-content: center; flex: 1; min-height: 50vh; text-align: center; }
.sk-empty-full__icon { width: 4rem; height: 4rem; background: var(--bg-3); border-radius: 8px; display: flex; align-items: center; justify-content: center; margin-bottom: 1rem; }
.sk-empty-full__title { font-size: 1rem; font-weight: 600; color: var(--text-2); margin-bottom: 0.375rem; }
.sk-empty-full__sub { font-size: 0.75rem; color: var(--text-4); }
.sk-empty-dashed { border: 1px dashed var(--border); border-radius: 5px; padding: 0.625rem; text-align: center; }

/* ── Inline edit ── */
.sk-inline-edit { background: var(--bg-3); border: 1px solid var(--border-2); color: var(--white); font-size: 0.75rem; border-radius: 3px; padding: 0.15rem 0.375rem; outline: none; width: 100%; }
.sk-inline-edit:focus { border-color: var(--blue); }

/* ── Body text ── */
.sk-body-text { font-size: 0.75rem; color: var(--text-2); line-height: 1.55; }

/* ── Animations ── */
.sk-fade-in { animation: skFadeIn 200ms ease-out forwards; }
@keyframes skFadeIn { from { opacity: 0; transform: translateY(4px); } to { opacity: 1; transform: translateY(0); } }

/* ── Line clamp ── */
.line-clamp-3 { display: -webkit-box; -webkit-line-clamp: 3; -webkit-box-orient: vertical; overflow: hidden; }
`}</style>
        </div>
    );
}