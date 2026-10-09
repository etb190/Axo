import React, { useState, useEffect, useMemo, useRef } from 'react';
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
const { shell } = window.require('electron');

import * as pdfjsLib from 'pdfjs-dist';
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.js?url';

const SKILLS = 'C:\\Users\\PC\\Desktop\\database\\Skills';
const BOOK_READING_PATH = 'C:\\Users\\PC\\Desktop\\Database\\Books\\Reading';
const BOOK_WANT_PATH = 'C:\\Users\\PC\\Desktop\\Database\\Books\\WanttoRead';
const BOOK_READ_PATH = 'C:\\Users\\PC\\Desktop\\Database\\Books\\Read';
const BOOK_THUMBNAIL_PATH = 'C:\\Users\\PC\\Desktop\\Database\\Books\\ThumbnailCache';
const BOOK_PROGRESS_PATH = 'C:\\Users\\PC\\Desktop\\Database\\Books\\Progress';
const BOOK_CACHE_PATH = 'C:\\Users\\PC\\Desktop\\Database\\Books\\BookCache';

const ARTICLE_READING_PATH = 'C:\\Users\\PC\\Desktop\\database\\Articles\\Reading';
const ARTICLE_WANT_PATH = 'C:\\Users\\PC\\Desktop\\database\\Articles\\WanttoRead';
const ARTICLE_READ_PATH = 'C:\\Users\\PC\\Desktop\\database\\Articles\\Read';
const ARTICLE_THUMBNAIL_PATH = 'C:\\Users\\PC\\Desktop\\database\\Articles\\ThumbnailCache';
const ARTICLE_PROGRESS_PATH = 'C:\\Users\\PC\\Desktop\\database\\Articles\\Progress';
const ARTICLE_CACHE_PATH = 'C:\\Users\\PC\\Desktop\\database\\Articles\\ArticleCache';

const findPdfPath = (itemData) => {
    if (itemData?.path && fs.existsSync(itemData.path)) {
        return itemData.path;
    }
    const title = itemData?.title;
    if (!title) return null;

    const dirs = itemData.dbType === 'article'
        ? [ARTICLE_READING_PATH, ARTICLE_WANT_PATH, ARTICLE_READ_PATH]
        : [BOOK_READING_PATH, BOOK_WANT_PATH, BOOK_READ_PATH];

    const searchRecursively = (dir, fileName) => {
        if (!fs.existsSync(dir)) return null;
        try {
            const items = fs.readdirSync(dir, { withFileTypes: true });
            for (const item of items) {
                const full = path.join(dir, item.name);
                if (item.isDirectory()) {
                    const found = searchRecursively(full, fileName);
                    if (found) return found;
                } else if (item.name.toLowerCase() === fileName.toLowerCase()) {
                    return full;
                }
            }
        } catch (e) { }
        return null;
    };

    for (const d of dirs) {
        const found = searchRecursively(d, `${title}.pdf`);
        if (found) return found;
    }
    return null;
};

const openBookOrDoc = (itemData) => {
    try {
        const pdfPath = findPdfPath(itemData);
        if (pdfPath) {
            shell.openPath(pdfPath);
        } else if (itemData?.path) {
            shell.openPath(itemData.path);
        } else {
            console.warn('Could not locate PDF file for:', itemData?.title);
        }
    } catch (err) {
        console.error('Error opening PDF:', err);
    }
};

const capitalizeFirst = (str) => {
    if (!str) return str;
    return str.charAt(0).toUpperCase() + str.slice(1);
};

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

const readBookMeta = (bookName, progressPath = BOOK_PROGRESS_PATH, dbType = 'book') => {
    let current = 0;
    let pages = null;
    try {
        const progressFile = path.join(progressPath, `${bookName}.json`);
        if (fs.existsSync(progressFile)) {
            const parsed = JSON.parse(fs.readFileSync(progressFile, 'utf-8'));
            current = parsed.current || 0;
            pages = parsed.pages || parsed.total || parsed.totalPages || null;
        }
    } catch (err) { }

    if (!pages) {
        try {
            const cacheFolder = dbType === 'article' ? ARTICLE_CACHE_PATH : BOOK_CACHE_PATH;
            const cacheFile = path.join(cacheFolder, `${bookName}.json`);
            if (fs.existsSync(cacheFile)) {
                const parsedCache = JSON.parse(fs.readFileSync(cacheFile, 'utf-8'));
                pages = parsedCache.totalPages || parsedCache.total || parsedCache.pages || null;
            }
        } catch (err) { }
    }

    return { current, pages };
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

const readBookProgress = (bookName, progressPath = BOOK_PROGRESS_PATH, dbType = 'book', totalPages = null) => {
    const meta = readBookMeta(bookName, progressPath);
    let current = meta.current || 0;

    const readDir = dbType === 'article' ? ARTICLE_READ_PATH : BOOK_READ_PATH;

    const searchRecursively = (dir, fileName) => {
        if (!fs.existsSync(dir)) return false;
        try {
            const items = fs.readdirSync(dir, { withFileTypes: true });
            for (const item of items) {
                if (item.isDirectory()) {
                    if (searchRecursively(path.join(dir, item.name), fileName)) return true;
                } else if (item.name.toLowerCase() === fileName.toLowerCase()) {
                    return true;
                }
            }
        } catch (e) { }
        return false;
    };

    if (searchRecursively(readDir, `${bookName}.pdf`)) {
        return totalPages || meta.pages || current;
    }

    return current;
};

const getPdfTotalPages = async (pdfPath) => {
    if (!pdfPath) return 0;
    try {
        if (!fs.existsSync(pdfPath)) return 0;
        const data = await readFile(pdfPath);
        pdfjsLib.GlobalWorkerOptions.workerSrc = workerUrl;
        const pdf = await pdfjsLib.getDocument({ data }).promise;
        return pdf.numPages || 0;
    } catch (e) {
        console.error('Failed to get PDF pages for:', pdfPath, e);
        return 0;
    }
};

const writeBookProgress = async (bookName, currentPage, progressPath = BOOK_PROGRESS_PATH) => {
    try {
        const progressFile = path.join(progressPath, `${bookName}.json`);
        let existing = {};
        try { if (existsSync(progressFile)) existing = JSON.parse(readFileSync(progressFile, 'utf-8')); } catch { }
        await writeFile(progressFile, JSON.stringify({ ...existing, current: currentPage, total: existing.total || existing.pages }), 'utf-8');
    } catch (err) {
        console.error(`Error writing progress for ${bookName}:`, err);
    }
};

const cacheBookPages = async (bookName, pages, progressPath = BOOK_PROGRESS_PATH) => {
    try {
        const progressFile = path.join(progressPath, `${bookName}.json`);
        let existing = {};
        try { if (existsSync(progressFile)) existing = JSON.parse(readFileSync(progressFile, 'utf-8')); } catch { }
        await writeFile(progressFile, JSON.stringify({ ...existing, pages, total: pages }), 'utf-8');
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
const BookItem = ({ data, onUpdate, onDelete, onMoveUp, onMoveDown, isFirst, isLast }) => {
    useEffect(() => {
        if (!data.pages || data.pages === 0) {
            let active = true;
            const resolvePages = async () => {
                const pdfPath = data.path || findPdfPath(data);
                if (pdfPath) {
                    const pages = await getPdfTotalPages(pdfPath);
                    if (pages > 0 && active) {
                        onUpdate({ pages, path: pdfPath });
                        if (data.title && data.progressPath) {
                            cacheBookPages(data.title, pages, data.progressPath);
                        }
                    }
                }
            };
            resolvePages();
            return () => { active = false; };
        }
    }, [data.pages, data.title, data.path]);

    const percent = data.pages > 0 ? Math.round((data.currentPage / data.pages) * 100) : 0;
    const isRead = data.shelf?.toLowerCase() === 'read' || percent >= 100;
    return (
        <div className={`sk-item sk-item--book group ${isRead ? 'sk-item--book-read' : ''}`}>
            <div
                className="sk-item__cover-wrap"
                onClick={() => openBookOrDoc(data)}
                title={`Click to open "${data.title}" in default PDF viewer`}
            >
                <LocalCover path={data.cover} pdfPath={data.path} className="sk-item__cover" />
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
                    <div className="flex items-center gap-0.5">
                        <button
                            onClick={onMoveUp}
                            disabled={isFirst}
                            title="Move up"
                            className={`sk-icon-btn ${isFirst ? 'opacity-20 cursor-not-allowed' : 'opacity-60 hover:opacity-100'}`}
                        >
                            <div style={{ transform: 'rotate(180deg)', display: 'flex' }}>
                                <LocalIcon src={chevronDownIcon} size={11} className="sk-icon" />
                            </div>
                        </button>
                        <button
                            onClick={onMoveDown}
                            disabled={isLast}
                            title="Move down"
                            className={`sk-icon-btn ${isLast ? 'opacity-20 cursor-not-allowed' : 'opacity-60 hover:opacity-100'}`}
                        >
                            <LocalIcon src={chevronDownIcon} size={11} className="sk-icon" />
                        </button>
                        <button onClick={onDelete} title="Delete item" className="sk-icon-btn sk-icon-btn--delete group-hover:opacity-100">
                            <LocalIcon src={trashIcon} size={13} className="sk-icon sk-icon--delete" />
                        </button>
                    </div>
                </div>
                {isRead ? (
                    <div className="sk-book-read-badge mt-2 mb-1">
                        <LocalIcon src={checkIcon} size={12} className="sk-icon--emerald" />
                        <span>Read</span>
                    </div>
                ) : (
                    <>
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
                                    onFocus={(e) => e.target.select()}
                                />
                                <span className="sk-num-input__max">/ {data.pages}</span>
                            </div>
                            <div className="sk-dot-row group-hover:opacity-100">
                                {[...Array(5)].map((_, i) => (
                                    <div key={i} className={`sk-dot ${i / 5 < percent / 100 ? (data.dbType === 'article' ? 'sk-dot--active-emerald' : 'sk-dot--active-orange') : ''}`} />
                                ))}
                            </div>
                        </div>
                    </>
                )}
            </div>
        </div>
    );
};

// ─── DOCUMENT ITEM ────────────────────────────────────────────────────────────
const DocumentItem = ({ data, onUpdate, onDelete, onMoveUp, onMoveDown, isFirst, isLast }) => {
    useEffect(() => {
        if (!data.pages || data.pages === 0) {
            let active = true;
            const resolvePages = async () => {
                const pdfPath = data.path || findPdfPath(data);
                if (pdfPath) {
                    const pages = await getPdfTotalPages(pdfPath);
                    if (pages > 0 && active) {
                        onUpdate({ pages, path: pdfPath });
                        if (data.title && data.progressPath) {
                            cacheBookPages(data.title, pages, data.progressPath);
                        }
                    }
                }
            };
            resolvePages();
            return () => { active = false; };
        }
    }, [data.pages, data.title, data.path]);

    const percent = data.pages > 0 ? Math.round((data.currentPage / data.pages) * 100) : 0;
    const isRead = data.shelf?.toLowerCase() === 'read' || percent >= 100;
    return (
        <div className={`sk-item sk-item--doc group ${isRead ? 'sk-item--doc-read' : ''}`}>
            <div
                className="sk-item__cover-wrap"
                onClick={() => openBookOrDoc(data)}
                title={`Click to open "${data.title}" in default PDF viewer`}
            >
                <LocalCover path={data.cover} pdfPath={data.path} className="sk-item__cover" />
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
                    <div className="flex items-center gap-0.5">
                        <button
                            onClick={onMoveUp}
                            disabled={isFirst}
                            title="Move up"
                            className={`sk-icon-btn ${isFirst ? 'opacity-20 cursor-not-allowed' : 'opacity-60 hover:opacity-100'}`}
                        >
                            <div style={{ transform: 'rotate(180deg)', display: 'flex' }}>
                                <LocalIcon src={chevronDownIcon} size={11} className="sk-icon" />
                            </div>
                        </button>
                        <button
                            onClick={onMoveDown}
                            disabled={isLast}
                            title="Move down"
                            className={`sk-icon-btn ${isLast ? 'opacity-20 cursor-not-allowed' : 'opacity-60 hover:opacity-100'}`}
                        >
                            <LocalIcon src={chevronDownIcon} size={11} className="sk-icon" />
                        </button>
                        <button onClick={onDelete} title="Delete item" className="sk-icon-btn sk-icon-btn--delete group-hover:opacity-100">
                            <LocalIcon src={trashIcon} size={13} className="sk-icon sk-icon--delete" />
                        </button>
                    </div>
                </div>
                {isRead ? (
                    <div className="sk-book-read-badge mt-2 mb-1">
                        <LocalIcon src={checkIcon} size={12} className="sk-icon--emerald" />
                        <span>Read</span>
                    </div>
                ) : (
                    <>
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
                                    onFocus={(e) => e.target.select()}
                                />
                                <span className="sk-num-input__max">/ {data.pages}</span>
                            </div>
                        </div>
                    </>
                )}
            </div>
        </div>
    );
};

// ─── TASK ITEM ────────────────────────────────────────────────────────────────
const TaskItem = ({ data, onUpdate, onDelete, onMoveUp, onMoveDown, isFirst, isLast }) => {
    const [isEditing, setIsEditing] = useState(false);
    const [editValue, setEditValue] = useState(data.text || '');
    return (
        <div className={`sk-item sk-item--task group ${data.completed ? 'sk-item--task-done' : ''}`}>
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
                <span className="sk-item__type sk-item__type--task" style={{ margin: 0, display: 'block' }}>Task</span>
                {isEditing ? (
                    <input
                        className="sk-input"
                        value={editValue}
                        onChange={e => setEditValue(capitalizeFirst(e.target.value))}
                        onBlur={() => { onUpdate({ text: editValue }); setIsEditing(false); }}
                        onKeyDown={e => { if (e.key === 'Enter') { onUpdate({ text: editValue }); setIsEditing(false); } if (e.key === 'Escape') setIsEditing(false); }}
                        autoFocus
                        onFocus={e => e.target.select()}
                    />
                ) : (
                    <span
                        className={`sk-task-text sk-task-text--editable ${data.completed ? 'sk-task-text--done' : ''}`}
                        onClick={() => { setIsEditing(true); setEditValue(data.text || ''); }}
                        title="Click to rename"
                        style={{ cursor: 'pointer' }}
                    >
                        {data.text}
                    </span>
                )}
            </div>
            <div className="sk-item__actions group-hover:opacity-100 opacity-60 transition-opacity" style={{ display: 'flex', gap: '2px', alignItems: 'center' }}>
                <button
                    onClick={onMoveUp}
                    disabled={isFirst}
                    title="Move up"
                    className={`sk-icon-btn ${isFirst ? 'opacity-20 cursor-not-allowed' : ''}`}
                >
                    <div style={{ transform: 'rotate(180deg)', display: 'flex' }}>
                        <LocalIcon src={chevronDownIcon} size={11} className="sk-icon" />
                    </div>
                </button>
                <button
                    onClick={onMoveDown}
                    disabled={isLast}
                    title="Move down"
                    className={`sk-icon-btn ${isLast ? 'opacity-20 cursor-not-allowed' : ''}`}
                >
                    <LocalIcon src={chevronDownIcon} size={11} className="sk-icon" />
                </button>
                <button onClick={onDelete} title="Delete task" className="sk-icon-btn sk-icon-btn--delete">
                    <LocalIcon src={trashIcon} size={13} className="sk-icon sk-icon--delete" />
                </button>
            </div>
        </div>
    );
};

// ─── COUNTER ITEM ─────────────────────────────────────────────────────────────
const CounterItem = ({ data, onUpdate, onDelete, onMoveUp, onMoveDown, isFirst, isLast }) => {
    const [isEditing, setIsEditing] = useState(false);
    const [editValue, setEditValue] = useState(data.name || '');
    const isHours = data.type === 'hours';
    const percent = data.target > 0 ? Math.round((data.current / data.target) * 100) : 0;
    const isDone = percent >= 100;

    return (
        <div className={`sk-item sk-item--counter group ${isHours ? 'sk-item--counter-purple' : ''} ${isDone ? 'sk-item--counter-done' : ''}`}>
            <div className="sk-item__body">
                <div className="sk-counter__row">
                    <div className="sk-counter__info">
                        <span className="sk-item__type" style={{ color: isHours ? 'var(--purple)' : 'var(--blue)', opacity: 0.7, marginBottom: '2px', display: 'block' }}>{isHours ? 'Hours' : 'Count'}</span>
                        {isEditing ? (
                            <input
                                className="sk-input"
                                value={editValue}
                                onChange={e => setEditValue(capitalizeFirst(e.target.value))}
                                onBlur={() => { onUpdate({ name: editValue }); setIsEditing(false); }}
                                onKeyDown={e => { if (e.key === 'Enter') { onUpdate({ name: editValue }); setIsEditing(false); } if (e.key === 'Escape') setIsEditing(false); }}
                                autoFocus
                                onFocus={e => e.target.select()}
                            />
                        ) : (
                            data.name && (
                                <div
                                    className="sk-task-text"
                                    style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-1)', marginBottom: '2px', cursor: 'pointer' }}
                                    onClick={() => { setIsEditing(true); setEditValue(data.name || ''); }}
                                    title="Click to rename"
                                >
                                    {data.name}
                                </div>
                            )
                        )}
                        <div className="sk-counter__value">
                            <span className="sk-counter__num">{data.current}</span>
                            <span className="sk-counter__max">/{data.target}</span>
                        </div>
                    </div>
                    <div className="sk-counter__actions">
                        <button
                            onClick={onMoveUp}
                            disabled={isFirst}
                            title="Move up"
                            className={`sk-icon-btn ${isFirst ? 'opacity-20 cursor-not-allowed' : 'opacity-60 hover:opacity-100'}`}
                        >
                            <div style={{ transform: 'rotate(180deg)', display: 'flex' }}>
                                <LocalIcon src={chevronDownIcon} size={11} className="sk-icon" />
                            </div>
                        </button>
                        <button
                            onClick={onMoveDown}
                            disabled={isLast}
                            title="Move down"
                            className={`sk-icon-btn ${isLast ? 'opacity-20 cursor-not-allowed' : 'opacity-60 hover:opacity-100'}`}
                        >
                            <LocalIcon src={chevronDownIcon} size={11} className="sk-icon" />
                        </button>
                        <button
                            onClick={() => onUpdate({ current: data.current + 1 })}
                            className={`sk-counter__inc-sm ${isHours ? 'sk-counter__inc--purple' : 'sk-counter__inc--blue'}`}
                        >
                            <LocalIcon src={plusIcon} size={12} className="sk-icon--white" />
                        </button>
                        <button onClick={onDelete} title="Delete metric" className="sk-icon-btn sk-icon-btn--delete">
                            <LocalIcon src={trashIcon} size={12} className="sk-icon sk-icon--delete" />
                        </button>
                    </div>
                </div>
                {isDone && (
                    <div className="sk-book-read-badge mt-2 mb-1">
                        <LocalIcon src={checkIcon} size={12} className="sk-icon--emerald" />
                        <span>Completed</span>
                    </div>
                )}
                <div className="sk-progress sk-progress--sm mt-2">
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
                        onChange={(e) => onUpdate({ current: Math.min(parseInt(e.target.value) || 0, data.target) })}
                        onFocus={(e) => e.target.select()}
                    />
                    <span className="sk-label">set</span>
                </div>
            </div>
        </div>
    );
};

let memoryBooksCache = null;

const AddItemModal = ({ isOpen, onClose, onAddItem, activeSkill, existingItems = [] }) => {
    const { data } = useData();
    const [step, setStep] = useState(1);
    const [selectedType, setSelectedType] = useState(null);
    const [books, setBooks] = useState(() => memoryBooksCache || []);
    const [booksLoading, setBooksLoading] = useState(false);
    const [selectedBooks, setSelectedBooks] = useState([]);
    const [taskText, setTaskText] = useState("");
    const [counterName, setCounterName] = useState("");
    const [counterType, setCounterType] = useState("count");
    const [counterTarget, setCounterTarget] = useState(100);
    const [bookSearch, setBookSearch] = useState("");
    const [selectedShelfFilter, setSelectedShelfFilter] = useState('all');
    const [selectedCategoryFilter, setSelectedCategoryFilter] = useState('all');
    const [hideAdded, setHideAdded] = useState(() => {
        try { return localStorage.getItem('axo_skills_hide_added') === 'true'; } catch { return false; }
    });

    const toggleHideAdded = () => {
        setHideAdded(prev => {
            const next = !prev;
            try { localStorage.setItem('axo_skills_hide_added', String(next)); } catch { }
            return next;
        });
    };

    const resetModal = () => {
        setStep(1); setSelectedType(null); setSelectedBooks([]);
        setTaskText(""); setCounterName(""); setCounterType("count");
        setCounterTarget(100); setBookSearch("");
        setSelectedShelfFilter('all'); setSelectedCategoryFilter('all');
    };

    const handleClose = () => { resetModal(); onClose(); };

    // Set of all book/article titles added across ANY phase in this active skill
    const allSkillAddedTitles = useMemo(() => {
        if (!activeSkill?.phases) return new Set();
        const set = new Set();
        for (const phase of activeSkill.phases) {
            for (const item of (phase.items || [])) {
                if (item.type === 'book' || item.type === 'document') {
                    if (item.data?.title) {
                        set.add(item.data.title.toLowerCase().trim());
                    }
                }
            }
        }
        return set;
    }, [activeSkill]);

    // Instant population from DataContext so books/articles snap to appear immediately
    useEffect(() => {
        if (!isOpen) return;

        // If we already have items in memory cache, use them immediately
        if (memoryBooksCache && memoryBooksCache.length > 0) {
            setBooks(memoryBooksCache);
            return;
        }

        // Build list instantly from DataContext
        const ctxItems = [];
        if (data?.reading?.shelves) {
            Object.entries(data.reading.shelves).forEach(([shelfKey, booksList]) => {
                const shelf = shelfKey === 'WanttoRead' ? 'want' : shelfKey.toLowerCase();
                (booksList || []).forEach(b => {
                    const coverPath = b.cover ? (b.cover.startsWith('file://') ? b.cover.replace('file://', '') : b.cover) : path.join(BOOK_THUMBNAIL_PATH, b.name + '.jpg');
                    ctxItems.push({
                        id: b.fullPath,
                        title: b.name,
                        pages: b.totalPages || b.progress?.total || 0,
                        cover: coverPath,
                        path: b.fullPath,
                        currentProgress: b.progress?.current || 0,
                        shelf: shelf,
                        category: b.category || 'General',
                        dbType: 'book',
                        progressPath: BOOK_PROGRESS_PATH
                    });
                });
            });
        }
        if (data?.articles?.shelves) {
            Object.entries(data.articles.shelves).forEach(([shelfKey, articlesList]) => {
                const shelf = shelfKey === 'WanttoRead' ? 'want' : shelfKey.toLowerCase();
                (articlesList || []).forEach(a => {
                    const coverPath = a.cover ? (a.cover.startsWith('file://') ? a.cover.replace('file://', '') : a.cover) : path.join(ARTICLE_THUMBNAIL_PATH, a.name + '.jpg');
                    ctxItems.push({
                        id: a.fullPath,
                        title: a.name,
                        pages: a.totalPages || a.progress?.total || 0,
                        cover: coverPath,
                        path: a.fullPath,
                        currentProgress: a.progress?.current || 0,
                        shelf: shelf,
                        category: a.category || 'General',
                        dbType: 'article',
                        progressPath: ARTICLE_PROGRESS_PATH
                    });
                });
            });
        }

        if (ctxItems.length > 0) {
            setBooks(ctxItems);
            memoryBooksCache = ctxItems;
            setBooksLoading(false);
        }

        // Non-blocking background scan to pick up any files not yet in context
        const scanBackground = async () => {
            try {
                const bookDirs = [
                    { path: BOOK_READING_PATH, type: 'book', progress: BOOK_PROGRESS_PATH, thumb: BOOK_THUMBNAIL_PATH, shelf: 'reading' },
                    { path: BOOK_WANT_PATH, type: 'book', progress: BOOK_PROGRESS_PATH, thumb: BOOK_THUMBNAIL_PATH, shelf: 'want' },
                    { path: BOOK_READ_PATH, type: 'book', progress: BOOK_PROGRESS_PATH, thumb: BOOK_THUMBNAIL_PATH, shelf: 'read' },
                    { path: ARTICLE_READING_PATH, type: 'article', progress: ARTICLE_PROGRESS_PATH, thumb: ARTICLE_THUMBNAIL_PATH, shelf: 'reading' },
                    { path: ARTICLE_WANT_PATH, type: 'article', progress: ARTICLE_PROGRESS_PATH, thumb: ARTICLE_THUMBNAIL_PATH, shelf: 'want' },
                    { path: ARTICLE_READ_PATH, type: 'article', progress: ARTICLE_PROGRESS_PATH, thumb: ARTICLE_THUMBNAIL_PATH, shelf: 'read' },
                ];
                const scanned = [];
                const extensions = ['.jpg', '.jpeg', '.png'];

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
                                        const name = path.basename(file, '.pdf');
                                        const fullPath = path.join(catPath, file);
                                        let coverPath = null;
                                        for (const ext of extensions) {
                                            const cachedPath = path.join(config.thumb, name + ext);
                                            if (fs.existsSync(cachedPath)) { coverPath = cachedPath; break; }
                                        }
                                        const meta = readBookMeta(name, config.progress, config.type);
                                        scanned.push({
                                            id: fullPath,
                                            title: name,
                                            pages: meta.pages || 0,
                                            cover: coverPath || path.join(config.thumb, name + '.jpg'),
                                            path: fullPath,
                                            currentProgress: meta.current || 0,
                                            shelf: config.shelf,
                                            category: catName || 'General',
                                            dbType: config.type,
                                            progressPath: config.progress
                                        });
                                    }
                                }
                            } catch (e) { }
                        } else {
                            if (path.extname(item.name).toLowerCase() === '.pdf') {
                                const name = path.basename(item.name, '.pdf');
                                const fullPath = path.join(config.path, item.name);
                                let coverPath = null;
                                for (const ext of extensions) {
                                    const cachedPath = path.join(config.thumb, name + ext);
                                    if (fs.existsSync(cachedPath)) { coverPath = cachedPath; break; }
                                }
                                const meta = readBookMeta(name, config.progress, config.type);
                                scanned.push({
                                    id: fullPath,
                                    title: name,
                                    pages: meta.pages || 0,
                                    cover: coverPath || path.join(config.thumb, name + '.jpg'),
                                    path: fullPath,
                                    currentProgress: meta.current || 0,
                                    shelf: config.shelf,
                                    category: 'General',
                                    dbType: config.type,
                                    progressPath: config.progress
                                });
                            }
                        }
                    }
                }
                if (scanned.length > 0) {
                    setBooks(scanned);
                    memoryBooksCache = scanned;
                }
            } catch (err) { }
        };
        scanBackground();
    }, [isOpen, data]);

    const categories = useMemo(() => {
        return Array.from(new Set(
            books.filter(b => (selectedType === 'document' ? b.dbType === 'article' : b.dbType === 'book'))
                .map(b => b.category)
        )).sort();
    }, [books, selectedType]);

    const filteredBooks = useMemo(() => {
        return books.filter(b => {
            const typeMatch = selectedType === 'document' ? b.dbType === 'article' : b.dbType === 'book';
            if (!typeMatch) return false;

            const isAlreadyAdded = allSkillAddedTitles.has(b.title.toLowerCase().trim());
            if (hideAdded && isAlreadyAdded) return false;

            const matchesSearch = !bookSearch.trim() || b.title.toLowerCase().includes(bookSearch.toLowerCase().trim());
            const matchesShelf = selectedShelfFilter === 'all' || b.shelf === selectedShelfFilter;
            const matchesCategory = selectedCategoryFilter === 'all' || b.category === selectedCategoryFilter;
            return matchesSearch && matchesShelf && matchesCategory;
        });
    }, [books, selectedType, allSkillAddedTitles, hideAdded, bookSearch, selectedShelfFilter, selectedCategoryFilter]);

    const handleAddFinal = async () => {
        if ((selectedType === 'book' || selectedType === 'document') && selectedBooks.length > 0) {
            const itemsToAdd = [];
            for (const book of selectedBooks) {
                let pages = book.pages || 0;
                const resolvedPath = book.path || findPdfPath(book);
                if (!pages || pages === 0) {
                    if (resolvedPath) {
                        const pdfPages = await getPdfTotalPages(resolvedPath);
                        if (pdfPages > 0) {
                            pages = pdfPages;
                            cacheBookPages(book.title, pages, book.progressPath);
                        }
                    }
                }
                let initialP = readBookProgress(book.title, book.progressPath, book.dbType, pages);
                if (book.shelf === 'read') {
                    initialP = pages;
                }
                itemsToAdd.push({
                    type: selectedType,
                    data: {
                        title: book.title,
                        pages: pages,
                        cover: book.cover,
                        currentPage: initialP,
                        dbType: book.dbType,
                        progressPath: book.progressPath,
                        path: resolvedPath || book.path
                    }
                });
            }
            onAddItem(itemsToAdd);
        } else if (selectedType === 'task' && taskText.trim()) {
            onAddItem({ type: 'task', data: { text: taskText.trim(), completed: false } });
        } else if (selectedType === 'counter' && counterName.trim()) {
            onAddItem({ type: 'counter', data: { name: counterName.trim(), type: counterType, current: 0, target: counterTarget } });
        }
        handleClose();
    };

    if (!isOpen) return null;

    const canProceed = !((selectedType === 'book' || selectedType === 'document') && selectedBooks.length === 0) &&
        !(selectedType === 'task' && !taskText.trim()) &&
        !(selectedType === 'counter' && !counterName.trim());

    const accentMap = { book: 'orange', document: 'blue', task: 'emerald', counter: 'blue' };
    const accent = selectedType ? accentMap[selectedType] : 'blue';

    const modalClass = step === 1
        ? 'sk-modal--type-picker'
        : (selectedType === 'book' || selectedType === 'document')
            ? 'sk-modal--books'
            : 'sk-modal--form';

    return (
        <div className="sk-overlay" onMouseDown={(e) => { if (e.target === e.currentTarget) handleClose(); }}>
            <div className={`sk-modal ${modalClass}`}>
                {/* Header */}
                <div className="sk-modal__head" style={{ padding: '0.75rem 1rem' }}>
                    <div className="flex items-center gap-2.5">
                        <span className="sk-modal__title">
                            {step === 1 ? 'Add Component' : (
                                selectedType === 'book' ? 'Add Literature' :
                                    selectedType === 'document' ? 'Add Articles' :
                                        selectedType === 'task' ? 'Create Task' : 'Define Metric'
                            )}
                        </span>
                        {step === 2 && (
                            <span className="sk-pill" style={{ opacity: 0.8, fontSize: '0.55rem' }}>
                                {activeSkill?.phases?.find(p => p.id === existingItems?.[0]?.phaseId)?.name || 'Active Phase'}
                            </span>
                        )}
                    </div>
                    <button onClick={handleClose} className="sk-icon-btn" title="Close">
                        <LocalIcon src={closeIcon} size={11} className="sk-icon" />
                    </button>
                </div>

                {/* Body */}
                <div className="sk-modal__body" style={{ padding: '0.875rem 1rem', flex: 1, overflowY: 'auto' }}>
                    {step === 1 && (
                        <div className="sk-type-list--picker">
                            {[
                                { type: 'book', icon: bookIcon, label: 'Literature', desc: 'Add books & sync reading progress', accent: 'orange' },
                                { type: 'document', icon: conceptsIcon, label: 'Articles', desc: 'Add articles & research papers', accent: 'blue' },
                                { type: 'task', icon: checkIcon, label: 'Task', desc: 'Actionable goal checklist item', accent: 'emerald' },
                                { type: 'counter', icon: chartIcon, label: 'Metric', desc: 'Continuous integer or temporal tracker', accent: 'purple' },
                            ].map(item => (
                                <button
                                    key={item.type}
                                    onClick={() => { setSelectedType(item.type); setStep(2); }}
                                    className={`sk-type-btn--picker sk-type-btn--${item.accent}`}
                                >
                                    <div className={`sk-type-btn__icon--picker sk-type-btn__icon--${item.accent}`}>
                                        <LocalIcon src={item.icon} size={18} className={`sk-icon--${item.accent}`} />
                                    </div>
                                    <div style={{ flex: 1 }}>
                                        <span className="sk-type-btn__label--picker">{item.label}</span>
                                        <span className="sk-type-btn__desc--picker">{item.desc}</span>
                                    </div>
                                    <LocalIcon src={chevronRightIcon} size={14} className="sk-icon--muted" />
                                </button>
                            ))}
                        </div>
                    )}

                    {step === 2 && (selectedType === 'book' || selectedType === 'document') && (
                        <div className="sk-fade-in flex flex-col h-full">
                            {/* Filter Bar (Pixel-perfect centered alignment) */}
                            <div className="sk-filter-bar">
                                {/* Search */}
                                <div className="sk-filter-control sk-filter-control--search">
                                    <LocalIcon src={menuIcon} size={13} className="sk-icon--muted sk-search-icon" />
                                    <input
                                        className="sk-search-input"
                                        placeholder={`Search ${selectedType === 'book' ? 'literature' : 'articles'} by title...`}
                                        value={bookSearch}
                                        onChange={e => setBookSearch(e.target.value)}
                                        autoFocus
                                    />
                                    {bookSearch && (
                                        <button className="sk-search-clear" onClick={() => setBookSearch("")}>
                                            <LocalIcon src={closeIcon} size={10} className="sk-icon--muted" />
                                        </button>
                                    )}
                                </div>

                                {/* Shelf Filter */}
                                <div className="sk-filter-control sk-filter-control--select">
                                    <select
                                        className="sk-select"
                                        value={selectedShelfFilter}
                                        onChange={(e) => setSelectedShelfFilter(e.target.value)}
                                    >
                                        <option value="all">All Shelves</option>
                                        <option value="reading">Currently Reading</option>
                                        <option value="want">Want to Read</option>
                                        <option value="read">Read</option>
                                    </select>
                                    <div className="sk-select-arrow">
                                        <LocalIcon src={chevronDownIcon} size={9} className="sk-icon--muted" />
                                    </div>
                                </div>

                                {/* Category Filter */}
                                <div className="sk-filter-control sk-filter-control--select">
                                    <select
                                        className="sk-select"
                                        value={selectedCategoryFilter}
                                        onChange={(e) => setSelectedCategoryFilter(e.target.value)}
                                    >
                                        <option value="all">All Categories</option>
                                        {categories.map(cat => (
                                            <option key={cat} value={cat}>{cat}</option>
                                        ))}
                                    </select>
                                    <div className="sk-select-arrow">
                                        <LocalIcon src={chevronDownIcon} size={9} className="sk-icon--muted" />
                                    </div>
                                </div>

                                {/* Hide Added Toggle */}
                                <button
                                    type="button"
                                    onClick={toggleHideAdded}
                                    className={`sk-filter-control sk-filter-control--toggle ${hideAdded ? 'sk-filter-control--toggle-active' : ''}`}
                                    title={hideAdded ? "Currently hiding items already in this skill. Click to show all." : "Currently showing all items. Click to hide added items."}
                                >
                                    <div className="sk-toggle-box">
                                        {hideAdded && <LocalIcon src={checkIcon} size={9} className="sk-icon--white" />}
                                    </div>
                                    <span>Hide Added</span>
                                    {allSkillAddedTitles.size > 0 && (
                                        <span className="sk-toggle-count">({allSkillAddedTitles.size})</span>
                                    )}
                                </button>
                            </div>

                            {/* Books Grid - 5x bigger thumbnails, snappy presentation */}
                            <div className="sk-book-list--grid flex-1">
                                {filteredBooks.length === 0 ? (
                                    <div className="sk-empty-dashed col-span-full py-12">
                                        <LocalIcon src={bookIcon} size={28} className="sk-icon--muted opacity-30 mx-auto mb-2" />
                                        <p className="sk-label sk-label--dim text-xs">No items found matching your filters</p>
                                        {hideAdded && allSkillAddedTitles.size > 0 && (
                                            <button
                                                onClick={() => setHideAdded(false)}
                                                className="sk-btn sk-btn--ghost mt-2 text-xs"
                                            >
                                                Show {allSkillAddedTitles.size} hidden items already in skill
                                            </button>
                                        )}
                                    </div>
                                ) : (
                                    filteredBooks.map(b => {
                                        const isSelected = selectedBooks.some(sb => sb.id === b.id);
                                        const isMulti = selectedBooks.length > 1;
                                        const selClass = isSelected ? (isMulti ? 'sk-book-card--selected-multi' : 'sk-book-card--selected') : '';
                                        const isAlreadyInSkill = allSkillAddedTitles.has(b.title.toLowerCase().trim());

                                        return (
                                            <div
                                                key={b.id}
                                                className={`sk-book-card ${selClass}`}
                                                onClick={(e) => {
                                                    if (e.ctrlKey || e.metaKey) {
                                                        if (isSelected) {
                                                            setSelectedBooks(prev => prev.filter(sb => sb.id !== b.id));
                                                        } else {
                                                            setSelectedBooks(prev => [...prev, b]);
                                                        }
                                                    } else {
                                                        setSelectedBooks([b]);
                                                    }
                                                }}
                                            >
                                                {/* 5x Bigger Thumbnail Cover */}
                                                <div className="sk-book-card__cover-wrap">
                                                    <LocalCover path={b.cover} pdfPath={b.path} className="sk-book-card__cover" />
                                                    {b.pages > 0 && (
                                                        <div className="sk-item__cover-overlay">
                                                            <span className="sk-item__cover-label">{b.pages}p</span>
                                                        </div>
                                                    )}
                                                </div>

                                                {/* Card Content */}
                                                <div className="sk-book-card__content">
                                                    <div>
                                                        <div className="flex items-start justify-between gap-2">
                                                            <h4 className="sk-book-card__title" title={b.title}>
                                                                {b.title}
                                                            </h4>
                                                            {isSelected && (
                                                                <div className="w-4 h-4 rounded-full bg-orange-500 flex items-center justify-center flex-shrink-0">
                                                                    <LocalIcon src={checkIcon} size={10} className="sk-icon--white" />
                                                                </div>
                                                            )}
                                                        </div>

                                                        <div className="sk-book-card__badges">
                                                            <span className={`sk-pill ${b.shelf === 'reading' ? 'sk-pill--reading' : b.shelf === 'read' ? 'sk-pill--read' : 'sk-pill--want'}`}>
                                                                {b.shelf === 'reading' ? 'Currently Reading' : b.shelf === 'read' ? 'Read' : 'Queue'}
                                                            </span>
                                                            <span className="sk-pill">
                                                                {b.category}
                                                            </span>
                                                            {isAlreadyInSkill && (
                                                                <span className="sk-pill sk-pill--in-skill">
                                                                    Added
                                                                </span>
                                                            )}
                                                        </div>
                                                    </div>

                                                    <div className="flex items-center justify-between text-[0.625rem] text-zinc-400 font-mono pt-1.5 border-t border-zinc-800/60">
                                                        <span>{b.pages > 0 ? `${b.pages} Pages` : 'PDF Document'}</span>
                                                        <span className="text-zinc-500">{b.dbType === 'article' ? 'Article' : 'Book'}</span>
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })
                                )}
                            </div>

                            {selectedBooks.length > 0 && (
                                <div className="sk-info-row sk-fade-in mt-2" style={{ padding: '0.4rem 0.75rem' }}>
                                    <span className="sk-label sk-label--italic" style={{ fontSize: '0.7rem' }}>
                                        {selectedBooks.length} item{selectedBooks.length > 1 ? 's' : ''} selected (Ctrl/Cmd to multi-select)
                                    </span>
                                    <button
                                        onClick={() => setSelectedBooks([])}
                                        className="text-xs text-zinc-400 hover:text-white underline"
                                    >
                                        Clear Selection
                                    </button>
                                </div>
                            )}
                        </div>
                    )}

                    {step === 2 && selectedType === 'task' && (
                        <div className="sk-fade-in space-y-2">
                            <label className="sk-label block">Task Description</label>
                            <textarea
                                className="sk-textarea"
                                placeholder="Describe the specific actionable objective to complete…"
                                value={taskText}
                                onChange={(e) => setTaskText(capitalizeFirst(e.target.value))}
                                autoFocus
                                rows={4}
                                style={{ height: '7rem', resize: 'vertical' }}
                            />
                            <p className="text-xs text-zinc-500 font-mono">
                                Actionable checkpoints will be tracked within this module.
                            </p>
                        </div>
                    )}

                    {step === 2 && selectedType === 'counter' && (
                        <div className="sk-fade-in space-y-3">
                            <div>
                                <label className="sk-label block mb-1">Metric Name</label>
                                <input
                                    type="text"
                                    className="sk-input"
                                    placeholder="e.g. Practice Scales, LeetCode Problems, Run Kilometers…"
                                    value={counterName}
                                    onChange={(e) => setCounterName(capitalizeFirst(e.target.value))}
                                    autoFocus
                                />
                            </div>

                            <div>
                                <label className="sk-label block mb-1">Tracking Mode</label>
                                <div className="sk-toggle-grid">
                                    <button
                                        type="button"
                                        onClick={() => setCounterType('count')}
                                        className={`sk-toggle ${counterType === 'count' ? 'sk-toggle--blue' : ''}`}
                                    >
                                        <LocalIcon src={hashIcon} size={14} className="sk-icon--muted" /> Units / Reps
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setCounterType('hours')}
                                        className={`sk-toggle ${counterType === 'hours' ? 'sk-toggle--purple' : ''}`}
                                    >
                                        <LocalIcon src={clockIcon} size={14} className="sk-icon--muted" /> Hours
                                    </button>
                                </div>
                            </div>

                            <div>
                                <label className="sk-label block mb-1">Target Threshold</label>
                                <div className="sk-field-row">
                                    <LocalIcon src={goalsIcon} size={16} className="sk-icon--muted" />
                                    <input
                                        type="number"
                                        className="sk-num-input__field flex-1"
                                        value={counterTarget}
                                        onChange={(e) => setCounterTarget(parseInt(e.target.value) || 0)}
                                        style={{ textAlign: 'left' }}
                                    />
                                    <span className="sk-label">Target Value</span>
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                {/* Footer */}
                {step === 2 && (
                    <div className="sk-modal__foot">
                        <button onClick={() => setStep(1)} className="sk-btn sk-btn--ghost">
                            Back
                        </button>
                        <button
                            onClick={handleAddFinal}
                            disabled={!canProceed}
                            className={`sk-btn sk-btn--accent-${accent} px-6`}
                        >
                            Add {selectedBooks.length > 1 ? `(${selectedBooks.length})` : ''}
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
    const [isAddModalOpen, setIsAddModalOpen] = useState(false);
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
    const [deleteConfirmPhaseId, setDeleteConfirmPhaseId] = useState(null);
    const [editingPhaseId, setEditingPhaseId] = useState(null);
    const [editingPhaseName, setEditingPhaseName] = useState("");

    const contentRef = useRef(null);
    const skillScrollPositions = useRef({});
    const [activePhaseIdx, setActivePhaseIdx] = useState(0);

    const activeSkill = useMemo(() => skills.find(s => s.id === activeSkillId), [skills, activeSkillId]);
    const currentLessons = useMemo(() => activeSkill?.lessons || [], [activeSkill]);

    // Track scroll position per skill and update active phase index
    const handleContentScroll = (e) => {
        if (activeSkillId) {
            skillScrollPositions.current[activeSkillId] = e.currentTarget.scrollTop;
            try {
                sessionStorage.setItem('axo_skill_scroll_' + activeSkillId, String(e.currentTarget.scrollTop));
            } catch { }
        }
        if (activeSkill && activeSkill.phases && activeSkill.phases.length > 0) {
            const containerTop = e.currentTarget.getBoundingClientRect().top;
            let closestIdx = 0;
            let minDiff = Infinity;
            activeSkill.phases.forEach((phase, idx) => {
                const el = document.getElementById('sk-phase-' + phase.id);
                if (el) {
                    const diff = Math.abs(el.getBoundingClientRect().top - containerTop);
                    if (diff < minDiff) {
                        minDiff = diff;
                        closestIdx = idx;
                    }
                }
            });
            setActivePhaseIdx(closestIdx);
        }
    };

    // Restore scroll position when activeSkillId changes
    useEffect(() => {
        if (!activeSkillId) return;
        let savedScroll = skillScrollPositions.current[activeSkillId];
        if (savedScroll === undefined) {
            try {
                const stored = sessionStorage.getItem('axo_skill_scroll_' + activeSkillId);
                if (stored !== null) savedScroll = parseFloat(stored);
            } catch { }
        }
        if (savedScroll === undefined) savedScroll = 0;

        const timer = setTimeout(() => {
            if (contentRef.current) {
                contentRef.current.scrollTop = savedScroll;
            }
        }, 40);
        return () => clearTimeout(timer);
    }, [activeSkillId]);

    const scrollToPhase = (phaseId, idx) => {
        const el = document.getElementById('sk-phase-' + phaseId);
        if (el) {
            el.scrollIntoView({ behavior: 'smooth', block: 'start' });
            setActivePhaseIdx(idx);
        }
    };

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

    useEffect(() => {
        if (data.skills && data.skills.allSkills) {
            setSkills(prev => {
                const newSkills = [...data.skills.allSkills];
                prev.forEach(p => {
                    if (!newSkills.some(s => s.id === p.id)) {
                        newSkills.push(p);
                    }
                });
                return newSkills;
            });
        }
    }, [data.skills]);

    useEffect(() => {
        if (skills.length > 0) {
            const skillExists = activeSkillId && skills.some(s => s.id === activeSkillId);
            if (!activeSkillId || !skillExists) {
                setActiveSkillId(skillId || skills[0].id);
            }
        }
    }, [skills, activeSkillId, skillId]);

    useEffect(() => {
        if (activeSkillId) {
            localStorage.setItem('lastActiveSkillId', activeSkillId);
        }
    }, [activeSkillId]);

    const sortedSkills = useMemo(() => {
        const sorted = [...skills];
        if (skillSortMode === 'oldest') {
            return sorted.sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0));
        } else if (skillSortMode === 'newest') {
            return sorted.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
        } else if (skillSortMode === 'completion') {
            return sorted.sort((a, b) => getSkillProgress(b) - getSkillProgress(a));
        } else if (skillSortMode === 'items') {
            return sorted.sort((a, b) => getSkillItemsCount(b) - getSkillItemsCount(a));
        }
        // Default fallback to newest if mode is something else
        return sorted.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
    }, [skills, skillSortMode]);

    const saveSkill = async (skill) => {
        try {
            await writeFile(path.join(SKILLS, `${skill.id}.json`), JSON.stringify(skill, null, 2), 'utf-8');
        } catch (err) { console.error(err); }
    };



    useEffect(() => {
        if (activeSkillId) {
            localStorage.setItem('lastActiveSkillId', activeSkillId);
        }
    }, [activeSkillId]);

    const handleCreateSkill = () => {
        const name = newSkillName.trim();
        if (!name) return;
        const newSkill = { id: generateId(), name, phases: [], lessons: [], createdAt: Date.now() };
        saveSkill(newSkill).then(() => {
            setSkills(prev => [newSkill, ...prev]);
            setActiveSkillId(newSkill.id);
            localStorage.setItem('lastActiveSkillId', newSkill.id);
            refreshData();
            setIsSidebarOpen(false);
            navigate('/Growth/skills', { replace: true, state: { skillId: newSkill.id } });
        });
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
        saveSkill(updated);
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

    const handleMoveItemUp = async (phaseId, itemIndex) => {
        if (!activeSkill || itemIndex <= 0) return;
        const phase = activeSkill.phases.find(p => p.id === phaseId);
        if (!phase || !phase.items) return;
        const newItems = [...phase.items];
        [newItems[itemIndex - 1], newItems[itemIndex]] = [newItems[itemIndex], newItems[itemIndex - 1]];
        const updated = {
            ...activeSkill,
            phases: activeSkill.phases.map(p => p.id === phaseId ? { ...p, items: newItems } : p)
        };
        await saveSkill(updated);
        setSkills(prev => prev.map(s => s.id === activeSkillId ? updated : s));
    };

    const handleMoveItemDown = async (phaseId, itemIndex) => {
        if (!activeSkill) return;
        const phase = activeSkill.phases.find(p => p.id === phaseId);
        if (!phase || !phase.items || itemIndex >= phase.items.length - 1) return;
        const newItems = [...phase.items];
        [newItems[itemIndex + 1], newItems[itemIndex]] = [newItems[itemIndex], newItems[itemIndex + 1]];
        const updated = {
            ...activeSkill,
            phases: activeSkill.phases.map(p => p.id === phaseId ? { ...p, items: newItems } : p)
        };
        await saveSkill(updated);
        setSkills(prev => prev.map(s => s.id === activeSkillId ? updated : s));
    };

    const handleAddItem = async (items) => {
        if (!activeSkill || !activePhaseIdForItem) return;
        const newItems = Array.isArray(items)
            ? items.map(item => ({ id: generateId(), ...item }))
            : [{ id: generateId(), ...items }];

        const updated = {
            ...activeSkill,
            phases: activeSkill.phases.map(p =>
                p.id === activePhaseIdForItem ? { ...p, items: [...(p.items || []), ...newItems] } : p
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
            if (item && (item.type === 'book' || item.type === 'document')) bookInfo = { title: item.data.title, progressPath: item.data.progressPath };
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

    const handleBulkUpdateItems = async (updatesArray) => {
        if (!activeSkill) return;
        let newSkill = { ...activeSkill };

        for (const updateObj of updatesArray) {
            const { phaseId, itemId, updates } = updateObj;
            const phaseIndex = newSkill.phases.findIndex(p => p.id === phaseId);
            if (phaseIndex === -1) continue;

            let newItems = [...newSkill.phases[phaseIndex].items];
            newItems = newItems.map(i => i.id === itemId ? { ...i, data: { ...i.data, ...updates } } : i);
            newSkill.phases[phaseIndex].items = newItems;

            const item = newItems.find(i => i.id === itemId);
            if (item && (item.type === 'book' || item.type === 'document') && updates.currentPage !== undefined) {
                await writeBookProgress(item.data.title, updates.currentPage, item.data.progressPath);
            }
        }

        await saveSkill(newSkill);
        setSkills(prev => prev.map(s => s.id === activeSkillId ? newSkill : s));
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

            {/* Left Sidebar (Fixed) */}
            <aside className="sk-sidebar sk-sidebar--left">
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
                                    onClick={async () => {
                                        if (!activeSkill) return;
                                        const updatesArray = [];
                                        for (const phase of activeSkill.phases) {
                                            const syncItems = phase.items?.filter(i => i.type === 'book' || i.type === 'document') || [];
                                            for (const item of syncItems) {
                                                const synced = readBookProgress(item.data.title, item.data.progressPath, item.data.dbType, item.data.pages);
                                                updatesArray.push({ phaseId: phase.id, itemId: item.id, updates: { currentPage: synced } });
                                            }
                                        }
                                        if (updatesArray.length > 0) {
                                            await handleBulkUpdateItems(updatesArray);
                                        }
                                    }}
                                    className="sk-hdr-btn"
                                    title="Sync all book progress"
                                >
                                    <LocalIcon src={rotateIcon} size={14} className="sk-icon--muted" />
                                    <span className="hidden sm:inline">Sync</span>
                                </button>

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
                        <div className="sk-content" ref={contentRef} onScroll={handleContentScroll}>
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
                                            <div key={phase.id} id={`sk-phase-${phase.id}`} className="sk-phase group/phase">
                                                <div className="sk-phase__head">
                                                    <div className="sk-phase__head-left">
                                                        <span className="sk-phase__badge">PH</span>
                                                        {editingPhaseId === phase.id ? (
                                                            <input
                                                                className="sk-inline-edit sk-phase__name-edit"
                                                                value={editingPhaseName}
                                                                autoFocus
                                                                onFocus={e => e.target.select()}
                                                                onChange={e => setEditingPhaseName(capitalizeFirst(e.target.value))}
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
                                                            onClick={() => { setActivePhaseIdForItem(phase.id); setIsAddModalOpen(true); }}
                                                            className="sk-phase-action"
                                                        >
                                                            <LocalIcon src={plusIcon} size={12} className="sk-icon--muted" />
                                                            <span className="hidden sm:inline">Add</span>
                                                        </button>

                                                        <button
                                                            onClick={() => setDeleteConfirmPhaseId(phase.id)}
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
                                                        phase.items.map((item, itemIndex) => {
                                                            const isFirst = itemIndex === 0;
                                                            const isLast = itemIndex === phase.items.length - 1;
                                                            return (
                                                                <div key={item.id} className="sk-phase__item">
                                                                    {item.type === 'book' && (
                                                                        <BookItem
                                                                            data={item.data}
                                                                            isFirst={isFirst}
                                                                            isLast={isLast}
                                                                            onMoveUp={() => handleMoveItemUp(phase.id, itemIndex)}
                                                                            onMoveDown={() => handleMoveItemDown(phase.id, itemIndex)}
                                                                            onUpdate={(val) => handleUpdateItem(phase.id, item.id, typeof val === 'object' ? val : { currentPage: val })}
                                                                            onDelete={() => handleDeleteItem(phase.id, item.id)}
                                                                        />
                                                                    )}
                                                                    {item.type === 'document' && (
                                                                        <DocumentItem
                                                                            data={item.data}
                                                                            isFirst={isFirst}
                                                                            isLast={isLast}
                                                                            onMoveUp={() => handleMoveItemUp(phase.id, itemIndex)}
                                                                            onMoveDown={() => handleMoveItemDown(phase.id, itemIndex)}
                                                                            onUpdate={(val) => handleUpdateItem(phase.id, item.id, typeof val === 'object' ? val : { currentPage: val })}
                                                                            onDelete={() => handleDeleteItem(phase.id, item.id)}
                                                                        />
                                                                    )}
                                                                    {item.type === 'task' && (
                                                                        <TaskItem
                                                                            data={item.data}
                                                                            isFirst={isFirst}
                                                                            isLast={isLast}
                                                                            onMoveUp={() => handleMoveItemUp(phase.id, itemIndex)}
                                                                            onMoveDown={() => handleMoveItemDown(phase.id, itemIndex)}
                                                                            onUpdate={(val) => handleUpdateItem(phase.id, item.id, val)}
                                                                            onDelete={() => handleDeleteItem(phase.id, item.id)}
                                                                        />
                                                                    )}
                                                                    {item.type === 'counter' && (
                                                                        <CounterItem
                                                                            data={item.data}
                                                                            isFirst={isFirst}
                                                                            isLast={isLast}
                                                                            onMoveUp={() => handleMoveItemUp(phase.id, itemIndex)}
                                                                            onMoveDown={() => handleMoveItemDown(phase.id, itemIndex)}
                                                                            onUpdate={(updates) => handleUpdateItem(phase.id, item.id, updates)}
                                                                            onDelete={() => handleDeleteItem(phase.id, item.id)}
                                                                        />
                                                                    )}
                                                                </div>
                                                            );
                                                        })
                                                    )}
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>

                        {/* Right-side Line Map Navigation (Recaller style) */}
                        {activeSkill && activeSkill.phases && activeSkill.phases.length > 1 && (
                            <div className={`sk-phase-map ${isRightSidebarOpen ? 'sk-phase-map--shifted' : ''}`}>
                                <div className="sk-phase-map__line" />
                                {activeSkill.phases.map((phase, i) => (
                                    <button
                                        key={phase.id}
                                        type="button"
                                        className={`sk-phase-map__node ${i === activePhaseIdx ? 'active' : ''}`}
                                        onClick={() => scrollToPhase(phase.id, i)}
                                    >
                                        <span className="sk-phase-map__label">{phase.name}</span>
                                        <div className="sk-phase-map__dot" />
                                    </button>
                                ))}
                            </div>
                        )}
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
                        onChange={(e) => modalMode === 'skill' ? setNewSkillName(capitalizeFirst(e.target.value)) : setNewPhaseName(capitalizeFirst(e.target.value))}
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
                isOpen={isAddModalOpen}
                onClose={() => setIsAddModalOpen(false)}
                onAddItem={handleAddItem}
                activeSkill={activeSkill}
                existingItems={activeSkill && activePhaseIdForItem ? activeSkill.phases.find(p => p.id === activePhaseIdForItem)?.items : []}
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

            {deleteConfirmPhaseId && (
                <div className="sk-overlay" onMouseDown={(e) => { if (e.target === e.currentTarget) setDeleteConfirmPhaseId(null); }}>
                    <div className="sk-modal sk-modal--sm">
                        <div className="sk-modal__head">
                            <div className="flex items-center gap-2">
                                <LocalIcon src={trashIcon} size={13} className="sk-icon--delete opacity-70" />
                                <span className="sk-modal__title">Delete Phase</span>
                            </div>
                        </div>
                        <div className="sk-modal__body">
                            <p className="sk-body-text">
                                Delete <span className="text-white font-semibold">{activeSkill?.phases?.find(p => p.id === deleteConfirmPhaseId)?.name}</span>? All items in this phase will be permanently removed.
                            </p>
                        </div>
                        <div className="sk-modal__foot">
                            <div />
                            <div className="sk-modal__foot-right">
                                <button onClick={() => setDeleteConfirmPhaseId(null)} className="sk-btn sk-btn--ghost">Cancel</button>
                                <button onClick={() => { handleDeletePhase(deleteConfirmPhaseId); setDeleteConfirmPhaseId(null); }} className="sk-btn sk-btn--danger">Delete</button>
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
.sk-sidebar { position: fixed; top: 0; bottom: 0; z-index: 40; width: 260px; background: var(--bg-1); border-right: 1px solid var(--border); display: flex; flex-direction: column; }
.sk-sidebar--left { left: 3rem; transform: none; }
.sk-root--no-nav .sk-sidebar--left { left: 3rem; }
.sk-sidebar--right { right: 0; left: auto; border-right: none; border-left: 1px solid var(--border); transform: translateX(100%); width: 280px; z-index: 100; transition: transform 240ms cubic-bezier(0.4,0,0.2,1); }
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
.sk-main { width: 100%; height: 100%; display: flex; flex-direction: column; background: var(--bg-1); padding-left: calc(3rem + 260px); padding-top: 3.5rem; }
@media (max-width: 768px) { .sk-sidebar--left { left: 0; } .sk-main { padding-left: 260px; } }
.sk-root--no-nav .sk-main { padding-left: calc(3rem + 260px); padding-top: 0; }

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
.sk-plan-bar__inner { max-width: 44rem; margin: 0 auto; }

/* ── Content ── */
.sk-content { flex: 1; overflow-y: auto; padding: 0.625rem 1rem 1rem; scroll-behavior: smooth; }
@media (min-width: 640px) { .sk-content { padding: 0.625rem 1.25rem 1.25rem; } }
@media (min-width: 1024px) { .sk-content { padding: 0.625rem 2rem 1.5rem; } }

/* ── Phase Line Map (Recaller style) ── */
.sk-phase-map {
    position: fixed;
    right: 14px;
    top: 50%;
    transform: translateY(-50%);
    z-index: 50;
    display: flex;
    flex-direction: column;
    align-items: flex-end;
    gap: 10px;
    pointer-events: none;
    transition: right 240ms cubic-bezier(0.4, 0, 0.2, 1);
}
.sk-phase-map--shifted {
    right: 295px;
}
.sk-phase-map__line {
    position: absolute;
    right: 7px;
    top: 6px;
    bottom: 6px;
    width: 2px;
    background: rgba(255, 255, 255, 0.12);
    border-radius: 1px;
    pointer-events: none;
}
.sk-phase-map__node {
    position: relative;
    width: 16px;
    height: 16px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    pointer-events: auto;
    cursor: pointer;
    background: transparent;
    border: none;
    padding: 0;
    margin: 0;
}
.sk-phase-map__label {
    position: absolute;
    right: calc(100% + 10px);
    top: 50%;
    transform: translateY(-50%) translateX(6px);
    opacity: 0;
    visibility: hidden;
    pointer-events: none;
    transition: opacity 0.16s ease, transform 0.16s ease, visibility 0.16s ease;
    background: rgba(18, 18, 18, 0.94);
    backdrop-filter: blur(8px);
    -webkit-backdrop-filter: blur(8px);
    border: 1px solid rgba(255, 255, 255, 0.15);
    color: var(--text-2);
    font-size: 0.6875rem;
    font-weight: 600;
    padding: 3px 8px;
    border-radius: 5px;
    white-space: nowrap;
    max-width: 170px;
    overflow: hidden;
    text-overflow: ellipsis;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.5);
    letter-spacing: 0.02em;
    z-index: 20;
}
.sk-phase-map__node:hover .sk-phase-map__label {
    opacity: 1;
    visibility: visible;
    pointer-events: none;
    transform: translateY(-50%) translateX(0);
    color: var(--white);
    border-color: rgba(255, 255, 255, 0.3);
    background: rgba(28, 28, 28, 0.98);
}
.sk-phase-map__node.active:hover .sk-phase-map__label {
    color: var(--white);
    border-color: var(--blue-border);
    background: rgba(15, 23, 42, 0.98);
    box-shadow: 0 0 10px rgba(59, 130, 246, 0.3);
}
.sk-phase-map__dot {
    width: 16px;
    height: 16px;
    border-radius: 50%;
    background: #111;
    border: 2.5px solid rgba(255, 255, 255, 0.2);
    cursor: pointer;
    pointer-events: auto;
    transition: all 0.2s ease;
    position: relative;
    z-index: 2;
    flex-shrink: 0;
}
.sk-phase-map__node:hover .sk-phase-map__dot {
    background: rgba(59, 130, 246, 0.25);
    border-color: rgba(59, 130, 246, 0.6);
    transform: scale(1.2);
}
.sk-phase-map__node.active .sk-phase-map__dot {
    background: #3b82f6;
    border-color: #3b82f6;
    box-shadow: 0 0 8px rgba(59, 130, 246, 0.6);
    transform: scale(1.25);
}

/* ── Phase ── */
.sk-phase-list { display: flex; flex-direction: column; gap: 0.625rem; max-width: 44rem; margin: 0 auto; padding-bottom: 4rem; }
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
.sk-item--book-read, .sk-item--doc-read, .sk-item--task-done, .sk-item--counter-done { background: rgba(16,185,129,0.06) !important; border-color: rgba(16,185,129,0.25) !important; }
.sk-item--book-read:hover, .sk-item--doc-read:hover, .sk-item--task-done:hover, .sk-item--counter-done:hover { background: rgba(16,185,129,0.1) !important; border-color: rgba(16,185,129,0.4) !important; }
.sk-book-read-badge { display: inline-flex; align-items: center; gap: 0.375rem; padding: 0.25rem 0.5rem; border-radius: 4px; background: var(--emerald-dim); border: 1px solid var(--emerald-border); font-size: 0.65rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.1em; color: var(--emerald); width: fit-content; }
.sk-item--doc:hover { border-color: var(--blue-border); background: rgba(59,130,246,0.03); }
.sk-item--task:hover { border-color: var(--emerald-border); background: rgba(16,185,129,0.03); }
.sk-item--counter { flex-direction: column; }
.sk-item--counter:hover { border-color: var(--blue-border); }
.sk-item__cover-wrap { position: relative; flex-shrink: 0; cursor: pointer; border-radius: 4px; overflow: hidden; transition: transform 160ms ease, box-shadow 160ms ease; user-select: none; }
.sk-item__cover-wrap:hover { transform: scale(1.04); box-shadow: 0 4px 14px rgba(0, 0, 0, 0.55); }
.sk-item__cover-wrap:active { transform: scale(0.97); }
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
.sk-modal--type-picker { max-width: 28rem; width: 92%; height: auto; border-radius: 8px; }
.sk-modal--form { max-width: 28rem; width: 90%; height: auto; border-radius: 8px; }
.sk-modal--books { max-width: 52rem; width: 92%; height: 75vh; max-height: 75vh; border-radius: 8px; }
.sk-modal__head { display: flex; align-items: center; justify-content: space-between; padding: 0.875rem 1.25rem; border-bottom: 1px solid var(--border); background: var(--bg); flex-shrink: 0; }
.sk-modal__head--tiny { padding: 0.375rem 0.5rem; border-bottom: none; }
.sk-modal__title { font-size: 0.75rem; font-weight: 800; color: var(--white); text-transform: uppercase; letter-spacing: 0.12em; font-family: 'IBM Plex Mono', monospace; }
.sk-modal__sub { font-size: 0.55rem; color: var(--text-3); text-transform: uppercase; letter-spacing: 0.1em; margin-top: 0.2rem; font-family: 'IBM Plex Mono', monospace; }
.sk-modal__body { padding: 1rem; overflow-y: auto; }
.sk-modal__foot { display: flex; align-items: center; justify-content: space-between; padding: 0.75rem 1.25rem; border-top: 1px solid var(--border); background: var(--bg); flex-shrink: 0; }
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
.sk-icon--emerald { color: var(--emerald); }
.sk-icon--orange { color: var(--orange); }
.sk-icon--purple { color: var(--purple); }
.sk-icon--white { color: var(--white); }
.sk-icon--black { color: #000; }
.sk-icon--muted { color: var(--text-3); }

/* ── Step 1 Type Selector ── */
.sk-type-list--picker { display: flex; flex-direction: column; gap: 0.5rem; padding: 0.25rem 0; }
.sk-type-btn--picker { display: flex; align-items: center; gap: 0.875rem; padding: 0.75rem 1rem; border-radius: 6px; border: 1px solid var(--border); background: var(--bg-2); cursor: pointer; transition: all 160ms ease; text-align: left; }
.sk-type-btn--picker:hover { background: var(--bg-3); transform: translateY(-1px); }
.sk-type-btn--picker.sk-type-btn--orange:hover { border-color: var(--orange-border); }
.sk-type-btn--picker.sk-type-btn--blue:hover { border-color: var(--blue-border); }
.sk-type-btn--picker.sk-type-btn--emerald:hover { border-color: var(--emerald-border); }
.sk-type-btn--picker.sk-type-btn--purple:hover { border-color: var(--purple-border); }
.sk-type-btn__icon--picker { width: 2.25rem; height: 2.25rem; border-radius: 5px; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
.sk-type-btn__icon--picker.sk-type-btn__icon--orange { background: var(--orange-dim); border: 1px solid var(--orange-border); }
.sk-type-btn__icon--picker.sk-type-btn__icon--blue { background: var(--blue-dim); border: 1px solid var(--blue-border); }
.sk-type-btn__icon--picker.sk-type-btn__icon--emerald { background: var(--emerald-dim); border: 1px solid var(--emerald-border); }
.sk-type-btn__icon--picker.sk-type-btn__icon--purple { background: var(--purple-dim); border: 1px solid var(--purple-border); }
.sk-type-btn__label--picker { display: block; font-size: 0.8125rem; font-weight: 700; color: var(--text); text-transform: uppercase; letter-spacing: 0.08em; margin-bottom: 0.15rem; font-family: 'IBM Plex Mono', monospace; }
.sk-type-btn__desc--picker { display: block; font-size: 0.6875rem; color: var(--text-3); font-family: 'DM Sans', sans-serif; line-height: 1.35; }

/* ── Filter Bar (Strict 1-line alignment) ── */
.sk-filter-bar { display: flex; align-items: stretch; gap: 0.5rem; margin-bottom: 0.75rem; height: 36px; width: 100%; }
.sk-filter-control { height: 36px; min-height: 36px; max-height: 36px; box-sizing: border-box; margin: 0; border: 1px solid var(--border); border-radius: 6px; background: var(--bg-2); display: flex; align-items: center; transition: border-color 150ms; }
.sk-filter-control:hover { border-color: var(--border-2); }
.sk-filter-control:focus-within { border-color: var(--border-2); }
.sk-filter-control--search { flex: 1; min-width: 180px; padding: 0 0.75rem; gap: 0.5rem; }
.sk-filter-control--search .sk-search-input { flex: 1; height: 100%; border: none; background: transparent; outline: none; color: var(--text); font-size: 0.8125rem; font-family: 'DM Sans', sans-serif; padding: 0; margin: 0; line-height: 34px; }
.sk-filter-control--search .sk-search-input::placeholder { color: var(--text-4); }
.sk-filter-control--select { position: relative; width: 130px; padding: 0; background: transparent; border: none; }
.sk-filter-control--select .sk-select { width: 100%; height: 36px; box-sizing: border-box; border: 1px solid var(--border); border-radius: 6px; background: var(--bg-2); color: var(--text-2); font-size: 0.75rem; font-weight: 600; font-family: 'DM Sans', sans-serif; padding: 0 1.75rem 0 0.75rem; margin: 0; outline: none; appearance: none; cursor: pointer; line-height: 34px; display: block; }
.sk-filter-control--select .sk-select:hover { border-color: var(--border-2); background: var(--bg-3); color: var(--text); }
.sk-filter-control--select .sk-select-arrow { position: absolute; right: 0.625rem; top: 50%; transform: translateY(-50%); pointer-events: none; display: flex; align-items: center; }
.sk-filter-control--toggle { padding: 0 0.875rem; gap: 0.5rem; background: var(--bg-2); color: var(--text-3); font-size: 0.7rem; font-weight: 700; font-family: 'IBM Plex Mono', monospace; text-transform: uppercase; letter-spacing: 0.06em; cursor: pointer; white-space: nowrap; user-select: none; }
.sk-filter-control--toggle:hover { background: var(--bg-3); color: var(--text); border-color: var(--border-2); }
.sk-filter-control--toggle-active { background: var(--blue-dim) !important; border-color: var(--blue-border) !important; color: var(--blue) !important; }
.sk-toggle-box { width: 0.95rem; height: 0.95rem; border-radius: 3px; border: 1px solid var(--border-2); display: flex; align-items: center; justify-content: center; background: var(--bg-3); flex-shrink: 0; }
.sk-filter-control--toggle-active .sk-toggle-box { background: var(--blue); border-color: var(--blue); }
.sk-toggle-count { opacity: 0.7; font-size: 0.625rem; }

/* ── Book List & Grid ── */
.sk-book-list--grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); gap: 0.875rem; overflow-y: auto; padding: 0.25rem 0.25rem 1rem 0.25rem; align-content: start; align-items: start; }
.sk-book-card { display: flex; gap: 0.875rem; padding: 0.75rem; border-radius: 6px; border: 1px solid var(--border); background: var(--bg-2); cursor: pointer; transition: all 160ms ease; user-select: none; position: relative; height: fit-content; align-self: start; }
.sk-book-card:hover { border-color: var(--border-2); background: var(--bg-3); transform: translateY(-1px); }
.sk-book-card--selected { background: rgba(249,115,22,0.08) !important; border-color: var(--orange-border) !important; }
.sk-book-card--selected-multi { background: rgba(59,130,246,0.12) !important; border-color: var(--blue-border) !important; }
.sk-book-card__cover-wrap { width: 4.5rem; height: 6.25rem; position: relative; flex-shrink: 0; border-radius: 4px; overflow: hidden; background: var(--bg-4); border: 1px solid var(--border); }
.sk-book-card__cover { width: 100%; height: 100%; object-fit: cover; display: block; }
.sk-book-card__content { flex: 1; min-width: 0; display: flex; flex-direction: column; justify-content: space-between; min-height: 6.25rem; }
.sk-book-card__title { font-size: 0.8125rem; font-weight: 700; color: var(--white); line-height: 1.35; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; margin-bottom: 0.375rem; }
.sk-book-card__badges { display: flex; flex-wrap: wrap; gap: 0.25rem; margin-top: 0.25rem; margin-bottom: 0.375rem; }

/* ── Pills & Toggles ── */
.sk-pill { display: inline-flex; align-items: center; gap: 0.25rem; padding: 0.2rem 0.5rem; border-radius: 4px; font-size: 0.6rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.08em; background: var(--bg-4); color: var(--text-2); border: 1px solid var(--border); font-family: 'IBM Plex Mono', monospace; }
.sk-pill--reading { background: var(--orange-dim); color: var(--orange); border-color: var(--orange-border); }
.sk-pill--read { background: var(--emerald-dim); color: var(--emerald); border-color: var(--emerald-border); }
.sk-pill--want { background: var(--blue-dim); color: var(--blue); border-color: var(--blue-border); }
.sk-pill--in-skill { background: rgba(255,255,255,0.08); color: var(--text-3); border-color: rgba(255,255,255,0.12); }

/* ── Large screen scaling for 1200px+ (App size 1400px) ── */
@media (min-width: 1200px) {
  .sk-phase-list { max-width: 80rem; gap: 0.625rem; }
  .sk-plan-bar__inner { max-width: 30rem; }
  .sk-phase { border-radius: 8px; }
  .sk-phase__head { padding: 0.5rem 0.875rem; }
  .sk-phase__name { font-size: 0.75rem; }
  .sk-phase__name-edit { font-size: 0.75rem; }
  .sk-phase__badge { width: 1.5rem; height: 1.5rem; font-size: 0.55rem; }
  .sk-phase-action { padding: 0.25rem 0.5rem; font-size: 0.65rem; }
  .sk-mini-progress { gap: 0.5rem; }
  .sk-mini-progress__track { width: 4.5rem; height: 3px; }
  .sk-mini-progress__label { font-size: 0.625rem; }
  .sk-phase__items { padding: 0.5rem; gap: 0.375rem; }
  
  /* Items inside phase: tastefully scaled up without being gigantic */
  .sk-item { padding: 0.5rem 0.75rem; gap: 0.75rem; border-radius: 6px; }
  .sk-item__cover { width: 4.25rem; height: 6rem; border-radius: 4px; }
  .sk-item__cover-label { font-size: 0.55rem; }
  .sk-item__title { font-size: 0.85rem; line-height: 1.35; }
  .sk-item__type { font-size: 0.55rem; margin-top: 0.15rem; }
  .sk-progress { margin-top: 0.5rem; gap: 0.625rem; }
  .sk-progress__track { height: 4px; border-radius: 2px; }
  .sk-progress__label { font-size: 0.7rem; min-width: 2.25rem; }
  .sk-num-input { padding: 0.15rem 0.5rem; gap: 0.25rem; }
  .sk-num-input__field { width: 3rem; font-size: 0.8125rem; padding: 0.15rem 0; }
  .sk-num-input__max { font-size: 0.65rem; }
  .sk-book-read-badge { padding: 0.25rem 0.5rem; font-size: 0.6875rem; }
  .sk-task-text { font-size: 0.85rem; line-height: 1.45; }
  .sk-checkbox-wrap { margin-top: 0.15rem; }
  .sk-checkbox { width: 1.15rem; height: 1.15rem; border-radius: 4px; }
  .sk-counter__num { font-size: 1.75rem; }
  .sk-counter__max { font-size: 0.65rem; }
  .sk-counter__icon-wrap { width: 2.25rem; height: 2.25rem; border-radius: 5px; }
  .sk-counter__inc { width: 2rem; height: 2rem; }
  .sk-counter__inc-sm { width: 1.4rem; height: 1.4rem; }
  .sk-icon-btn { width: 1.625rem; height: 1.625rem; }
}

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