import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useData } from '../contexts/DataContext';

const path = window.require('path');
const fs = window.require('fs');

const BOOKS_NOTES_FOLDER = 'C:\\Users\\PC\\Desktop\\database\\Books\\notes';
const ARTICLES_NOTES_FOLDER = 'C:\\Users\\PC\\Desktop\\database\\Articles\\Notes';
const BOOKS_THUMBNAIL_CACHE = 'C:\\Users\\PC\\Desktop\\database\\books\\ThumbnailCache';
const ARTICLES_THUMBNAIL_CACHE = 'C:\\Users\\PC\\Desktop\\database\\Articles\\ThumbnailCache';

// ─── Helpers ────────────────────────────────────────────────────────────────

function stripHtml(html) {
    const div = document.createElement('div');
    div.innerHTML = html;
    return div.textContent || div.innerText || '';
}

function isArabic(html) {
    const text = stripHtml(html);
    const arabicChars = (text.match(/[\u0600-\u06FF]/g) || []).length;
    return arabicChars > text.length * 0.3;
}

function shuffle(arr) {
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
}

// ─── Recall Modes (The internal engine) ───────────────────────────────────────

/** READ MODE — paginated reading of all notes */
function ReadMode({ notes, title, onBack }) {
    const [idx, setIdx] = useState(0);
    const note = notes[idx];
    const cardInnerRef = useRef(null);
    const [activeSectionIdx, setActiveSectionIdx] = useState(0);

    useEffect(() => {
        const handleKey = (e) => {
            const key = e.key.toLowerCase();
            if (key === 'a' || key === 'arrowleft') {
                setIdx(i => Math.max(0, i - 1));
            } else if (key === 'd' || key === 'arrowright') {
                setIdx(i => Math.min(notes.length - 1, i + 1));
            }
        };
        window.addEventListener('keydown', handleKey);
        return () => window.removeEventListener('keydown', handleKey);
    }, [notes.length]);

    // Extract page range sections from the note content
    const pageRanges = useMemo(() => {
        if (!note) return [];
        const matches = [];
        let index = 0;
        const regex = /Pages?\s+(\d+(?:\s*[\-–—]\s*\d+)?)\s*:/gi;
        const text = stripHtml(note.content);
        let m;
        while ((m = regex.exec(text)) !== null) {
            matches.push({ label: m[1].replace(/\s+/g, ''), id: `psec-${index}` });
            index++;
        }
        return matches;
    }, [note]);

    // Process HTML: wrap "Pages XX-XX:" with styled span + anchor id
    const processedContent = useMemo(() => {
        if (!note) return '';
        let html = note.content;
        let index = 0;
        html = html.replace(
            /(Pages?\s+\d+(?:\s*[\-–—]\s*\d+)?)\s*:/gi,
            (_, pageText) => {
                const id = `psec-${index}`;
                index++;
                return `<span class="page-section-anchor" id="${id}"></span><span class="page-section-header">${pageText}:<span class="page-header-line"></span></span>`;
            }
        );
        return html;
    }, [note]);

    // Reset active section when note changes
    useEffect(() => { setActiveSectionIdx(0); }, [idx]);

    // Track which section is in view
    useEffect(() => {
        const container = cardInnerRef.current;
        if (!container || pageRanges.length === 0) return;
        const handleScroll = () => {
            let closest = 0;
            let closestDist = Infinity;
            pageRanges.forEach((pr, i) => {
                const el = document.getElementById(pr.id);
                if (el) {
                    const dist = Math.abs(el.getBoundingClientRect().top - container.getBoundingClientRect().top);
                    if (dist < closestDist) { closestDist = dist; closest = i; }
                }
            });
            setActiveSectionIdx(closest);
        };
        container.addEventListener('scroll', handleScroll, { passive: true });
        return () => container.removeEventListener('scroll', handleScroll);
    }, [pageRanges]);

    const scrollToSection = (id, i) => {
        const el = document.getElementById(id);
        if (el) {
            el.scrollIntoView({ behavior: 'smooth', block: 'start' });
            setActiveSectionIdx(i);
        }
    };

    return (
        <div className="mode-container">
            <div className="mode-header">
                <button className="back-btn" onClick={onBack}>← Library</button>
                <div className="mode-info">
                    <span className="mode-label">{title || 'Reviewing Notes'}</span>
                    <span className="counter">{idx + 1} / {notes.length}</span>
                </div>
            </div>

            <div className="card-area">
                {note ? (
                    <div className="read-card">
                        <div className="card-topbar">
                            {(note.startPage || note.endPage) && (
                                <span className="page-badge">
                                    {note.startPage && note.endPage
                                        ? `Pages ${note.startPage} – ${note.endPage}`
                                        : `Page ${note.startPage || note.endPage}`}
                                </span>
                            )}
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                {note.wordCount != null && (
                                    <span className="word-count-badge">{note.wordCount} words</span>
                                )}
                                <span className="ts">{new Date(note.timestamp).toLocaleDateString()}</span>
                            </div>
                        </div>
                        <div className="read-card-inner" ref={cardInnerRef}>
                             <div className={`note-content ${isArabic(note.content) ? 'rtl' : ''}`} dangerouslySetInnerHTML={{ __html: processedContent }} />
                        </div>
                    </div>
                ) : (
                    <div className="empty-state">
                        <p>No notes inside</p>
                    </div>
                )}
            </div>

            {/* Fixed page section sidebar — vertical line with dots */}
            {pageRanges.length > 0 && (
                <div className="page-nav-sidebar">
                    <div className="page-nav-line" />
                    {pageRanges.map((pr, i) => (
                        <div
                            key={pr.id}
                            className={`page-nav-dot ${i === activeSectionIdx ? 'active' : ''}`}
                            onClick={() => scrollToSection(pr.id, i)}
                        >
                            <span className="dot-tooltip">pp. {pr.label}</span>
                        </div>
                    ))}
                </div>
            )}

            {notes.length > 0 && (
                <div className="nav-row">
                    <button className="nav-btn" onClick={() => setIdx(i => Math.max(0, i - 1))} disabled={idx === 0}>Prev</button>
                    <div className="dot-track">
                        {notes.map((_, i) => (
                            <div key={i} className={`dot ${i === idx ? 'active' : ''}`} onClick={() => setIdx(i)} />
                        ))}
                    </div>
                    <button className="nav-btn" onClick={() => setIdx(i => Math.min(notes.length - 1, i + 1))} disabled={idx === notes.length - 1}>Next</button>
                </div>
            )}
        </div>
    );
}

// ─── Main Recaller Component ──────────────────────────────────────────────────

const Recaller = () => {
    const { data } = useData();
    const [viewMode, setViewMode] = useState(() => {
        try { return localStorage.getItem('axo_recaller_viewMode') || 'books'; } catch { return 'books'; }
    }); // 'books' or 'articles'
    const [sortOrder, setSortOrder] = useState(() => {
        try { return localStorage.getItem('axo_recaller_sortOrder') || 'newest'; } catch { return 'newest'; }
    });
    const [selectedCategory, setSelectedCategory] = useState(() => {
        try { return localStorage.getItem('axo_recaller_category') || 'all'; } catch { return 'all'; }
    });
    
    const handleViewModeChange = (mode) => {
        setViewMode(mode);
        try { localStorage.setItem('axo_recaller_viewMode', mode); } catch { }
    };
    const handleSortOrderChange = (val) => {
        setSortOrder(val);
        try { localStorage.setItem('axo_recaller_sortOrder', val); } catch { }
    };
    const handleCategoryChange = (cat) => {
        setSelectedCategory(cat);
        try { localStorage.setItem('axo_recaller_category', cat); } catch { }
        setShowCatDropdown(false);
    };

    const [showCatDropdown, setShowCatDropdown] = useState(false);
    const catDropdownRef = useRef(null);
    const [selectedItem, setSelectedItem] = useState(null);
    const [activeNotes, setActiveNotes] = useState([]);

    useEffect(() => {
        const handler = (e) => {
            if (catDropdownRef.current && !catDropdownRef.current.contains(e.target)) setShowCatDropdown(false);
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, []);

    // Build a Set of book/article names that have note files — single sync readdir, no file reads
    const bookNoteSet = useMemo(() => {
        try {
            const files = fs.readdirSync(BOOKS_NOTES_FOLDER);
            return new Set(files.filter(f => f.endsWith('.json')).map(f => f.replace(/\.json$/i, '')));
        } catch { return new Set(); }
    }, []);

    const articleNoteSet = useMemo(() => {
        try {
            const files = fs.readdirSync(ARTICLES_NOTES_FOLDER);
            return new Set(files.filter(f => f.endsWith('.json')).map(f => f.replace(/\.json$/i, '')));
        } catch { return new Set(); }
    }, []);

    // Filter books/articles from DataContext that have notes — pure in-memory, instant
    const booksWithNotes = useMemo(() => {
        if (!data?.reading?.shelves) return [];
        const readBooks = data.reading.shelves.Read || [];
        const readingBooks = data.reading.shelves.Reading || [];
        const allBooks = [...readBooks, ...readingBooks];
        return allBooks.filter(book => {
            const baseName = path.basename(book.fullPath).replace(/\.pdf$/i, '');
            return bookNoteSet.has(baseName);
        }).map(book => {
            const baseName = path.basename(book.fullPath).replace(/\.pdf$/i, '');
            let thumbnail = book.cover || null;
            if (!thumbnail) {
                const thumbPath = path.join(BOOKS_THUMBNAIL_CACHE, `${baseName}.jpg`);
                try { fs.statSync(thumbPath); thumbnail = `file://${thumbPath}`; } catch {}
            }
            let noteModified = 0;
            try { noteModified = fs.statSync(path.join(BOOKS_NOTES_FOLDER, `${baseName}.json`)).mtimeMs; } catch {}
            return { ...book, thumbnail, noteModified };
        });
    }, [data?.reading?.shelves, bookNoteSet]);

    const articlesWithNotes = useMemo(() => {
        if (!data?.articles?.shelves) return [];
        const readArticles = data.articles.shelves.Read || [];
        const readingArticles = data.articles.shelves.Reading || [];
        const allArticles = [...readArticles, ...readingArticles];
        return allArticles.filter(article => {
            const baseName = path.basename(article.fullPath).replace(/\.pdf$/i, '');
            return articleNoteSet.has(baseName);
        }).map(article => {
            const baseName = path.basename(article.fullPath).replace(/\.pdf$/i, '');
            let thumbnail = article.cover || null;
            if (!thumbnail) {
                const thumbPath = path.join(ARTICLES_THUMBNAIL_CACHE, `${baseName}.jpg`);
                try { fs.statSync(thumbPath); thumbnail = `file://${thumbPath}`; } catch {}
            }
            let noteModified = 0;
            try { noteModified = fs.statSync(path.join(ARTICLES_NOTES_FOLDER, `${baseName}.json`)).mtimeMs; } catch {}
            return { ...article, thumbnail, noteModified };
        });
    }, [data?.articles?.shelves, articleNoteSet]);

    const handleItemSelect = (item) => {
        const baseName = path.basename(item.fullPath).replace(/\.pdf$/i, '');
        const notesFolder = viewMode === 'books' ? BOOKS_NOTES_FOLDER : ARTICLES_NOTES_FOLDER;
        const notesPath = path.join(notesFolder, `${baseName}.json`);
        try {
            const notes = JSON.parse(fs.readFileSync(notesPath, 'utf8'));
            
            // Sort by pages (startPage or endPage)
            notes.sort((a, b) => {
                const getPageNum = (note) => {
                    let p = parseFloat(note.startPage);
                    if (!isNaN(p)) return p;
                    p = parseFloat(note.endPage);
                    if (!isNaN(p)) return p;
                    return Infinity;
                };
                
                const pageA = getPageNum(a);
                const pageB = getPageNum(b);

                if (pageA !== pageB) {
                    return pageA - pageB;
                }
                
                // Fallback to timestamp if pages are equal or both missing
                return new Date(a.timestamp) - new Date(b.timestamp);
            });

            // Calculate word count per note (lazy — only on click)
            notes.forEach(note => {
                const text = stripHtml(note.content);
                const words = text.trim().split(/\s+/).filter(w => w.length > 0);
                note.wordCount = words.length;
            });

            setActiveNotes(notes);
            setSelectedItem(item);
        } catch (e) {
            console.error(e);
        }
    };

    const categories = viewMode === 'books' ? (data?.reading?.categories || []) : (data?.articles?.categories || []);

    const currentList = useMemo(() => {
        let list = viewMode === 'books' ? [...booksWithNotes] : [...articlesWithNotes];
        
        if (selectedCategory !== 'all' && categories.length > 0 && !categories.includes(selectedCategory)) {
            handleCategoryChange('all');
        }

        list.sort((a, b) => {
            if (sortOrder === 'newest') return b.noteModified - a.noteModified;
            if (sortOrder === 'oldest') return a.noteModified - b.noteModified;
            return 0;
        });
        return list;
    }, [viewMode, booksWithNotes, articlesWithNotes, sortOrder, selectedCategory, categories]);

    if (selectedItem) {
        return (
            <div className="recaller-view">
                <ReadMode 
                    notes={activeNotes} 
                    title={selectedItem.name} 
                    onBack={() => setSelectedItem(null)} 
                />
                <style>{`
                    .recaller-view {
                        height: 100vh; background: #050505; color: #fff;
                        display: flex; flex-direction: column; padding: 15px 30px; padding-left: 65px;
                    }
                    .mode-container { flex: 1; display: flex; flex-direction: column; gap: 6px; max-width: 900px; margin: 0 auto; width: 100%; }
                    .mode-header { display: flex; align-items: center; justify-content: space-between; }
                    .back-btn { background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); color: #888; padding: 6px 14px; border-radius: 8px; font-size: 12px; cursor: pointer; transition: all 0.2s; }
                    .back-btn:hover { background: rgba(255,255,255,0.1); color: #fff; }
                    .mode-info { display: flex; flex-direction: column; align-items: flex-end; }
                    .mode-label { font-size: 10px; text-transform: uppercase; letter-spacing: 0.1em; color: #4f8ef7; font-weight: 800; max-width: 300px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
                    .counter { font-size: 14px; font-weight: 700; color: #555; }
                    
                    .card-area { flex: 1; display: flex; align-items: stretch; min-height: 0; }
                    .read-card { flex: 1; background: #0c0c0e; border: 1px solid rgba(255,255,255,0.05); border-radius: 20px; display: flex; flex-direction: column; overflow: hidden; box-shadow: 0 20px 50px rgba(0,0,0,0.3); }
                    .card-topbar { padding: 10px 20px; border-bottom: 1px solid rgba(255,255,255,0.05); background: rgba(255,255,255,0.02); display: flex; justify-content: space-between; align-items: center; }
                    .read-card-inner { flex: 1; overflow-y: auto; padding: 10px 20px 20px 20px; }
                    .note-content { font-size: 16px; line-height: 1.6; color: #ccc; text-align: justify; }
                    .note-content.rtl { direction: rtl; text-align: justify; }
                    .note-content h1, .note-content h2 { color: #fff; margin-bottom: 15px; }
                    .page-badge { background: rgba(79,142,247,0.1); color: #4f8ef7; padding: 4px 10px; border-radius: 6px; font-size: 11px; font-weight: 700; }
                    .ts { font-size: 11px; color: #444; }
                    .word-count-badge { font-size: 10px; color: #666; font-weight: 600; letter-spacing: 0.02em; }

                    /* Page section headers inside note content */
                    .page-section-anchor { display: block; height: 0; }
                    .page-section-header {
                        display: inline-flex;
                        align-items: center;
                        color: #6ba3f7;
                        font-weight: 800;
                        font-size: 14px;
                        letter-spacing: 0.02em;
                        margin-bottom: 4px;
                        gap: 0;
                    }
                    .page-header-line {
                        display: inline-block;
                        width: 500px;
                        height: 3px;
                        background: rgba(30, 64, 130, 0.6);
                        margin-left: 10px;
                        vertical-align: middle;
                        flex-shrink: 0;
                    }

                    /* Fixed page nav sidebar — vertical line with dots */
                    .page-nav-sidebar {
                        position: fixed;
                        right: 18px;
                        top: 50%;
                        transform: translateY(-50%);
                        z-index: 100;
                        display: flex;
                        flex-direction: column;
                        align-items: center;
                        gap: 0;
                        pointer-events: none;
                    }
                    .page-nav-line {
                        position: absolute;
                        top: 0;
                        bottom: 0;
                        width: 3px;
                        background: rgba(79, 142, 247, 0.2);
                        border-radius: 1px;
                        pointer-events: none;
                    }
                    .page-nav-dot {
                        width: 18px;
                        height: 18px;
                        border-radius: 50%;
                        background: rgba(255,255,255,0.08);
                        border: 3px solid rgba(79, 142, 247, 0.3);
                        cursor: pointer;
                        pointer-events: auto;
                        transition: all 0.2s;
                        margin: 6px 0;
                        position: relative;
                        z-index: 1;
                    }
                    .page-nav-dot:hover {
                        background: rgba(79, 142, 247, 0.25);
                        border-color: rgba(79, 142, 247, 0.5);
                        transform: scale(1.3);
                    }
                    .page-nav-dot.active {
                        background: #4f8ef7;
                        border-color: #4f8ef7;
                        box-shadow: 0 0 8px rgba(79, 142, 247, 0.5);
                        transform: scale(1.3);
                    }
                    .dot-tooltip {
                        position: absolute;
                        right: calc(100% + 10px);
                        top: 50%;
                        transform: translateY(-50%);
                        background: #111;
                        color: #ccc;
                        font-size: 10px;
                        font-weight: 700;
                        padding: 4px 8px;
                        border-radius: 6px;
                        white-space: nowrap;
                        pointer-events: none;
                        opacity: 0;
                        transition: opacity 0.15s;
                        border: 1px solid rgba(255,255,255,0.08);
                        letter-spacing: 0.03em;
                    }
                    .page-nav-dot:hover .dot-tooltip {
                        opacity: 1;
                    }

                    .nav-row { display: flex; align-items: center; justify-content: space-between; gap: 20px; }
                    .nav-btn { background: #111; border: 1px solid #222; color: #fff; padding: 10px 24px; border-radius: 12px; font-size: 13px; font-weight: 600; cursor: pointer; transition: all 0.2s; }
                    .nav-btn:hover:not(:disabled) { border-color: #444; background: #1a1a1a; }
                    .nav-btn:disabled { opacity: 0.2; cursor: not-allowed; }
                    .dot-track { display: flex; gap: 6px; align-items: center; flex-wrap: wrap; justify-content: center; max-width: 400px; }
                    .dot { width: 6px; height: 6px; border-radius: 50%; background: #222; cursor: pointer; transition: all 0.2s; }
                    .dot.active { background: #4f8ef7; transform: scale(1.3); box-shadow: 0 0 10px rgba(79,142,247,0.5); }
                `}</style>
            </div>
        );
    }

    return (
        <div className="recaller-container">
            <div className="header-section">

                <div className="toggle-wrapper">
                    <div className="toggle-container">
                        <div className={`sliding-bg ${viewMode}`} />
                        <button 
                            className={`toggle-btn ${viewMode === 'books' ? 'active' : ''}`}
                            onClick={() => { handleViewModeChange('books'); handleCategoryChange('all'); }}
                        >
                            <span className="icon">📚</span>
                            <span className="label">Books</span>
                            <span className="badge">{booksWithNotes.length}</span>
                        </button>
                        <button 
                            className={`toggle-btn ${viewMode === 'articles' ? 'active' : ''}`}
                            onClick={() => { setViewMode('articles'); setSelectedCategory('all'); }}
                        >
                            <span className="icon">📄</span>
                            <span className="label">Articles</span>
                            <span className="badge">{articlesWithNotes.length}</span>
                        </button>
                    </div>
                </div>

                <div className="stats-group" style={{ display: 'flex', gap: '15px', alignItems: 'center' }}>
                    {categories.length > 0 && (
                        <div className="relative" ref={catDropdownRef}>
                            <button
                                onClick={() => setShowCatDropdown(!showCatDropdown)}
                                className="flex items-center gap-2 px-3 py-1.5 bg-white/[0.03] hover:bg-white/[0.06] border border-white/[0.06] rounded-xl text-[11px] font-semibold text-gray-400 hover:text-white transition-all duration-200 cursor-pointer h-[36px]"
                            >
                                <svg className="w-3 h-3 opacity-50" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
                                </svg>
                                <span>{selectedCategory === 'all' ? 'All Categories' : selectedCategory}</span>
                                <svg className={`w-3 h-3 opacity-40 transition-transform duration-200 ${showCatDropdown ? 'rotate-180' : ''}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                    <polyline points="6 9 12 15 18 9" />
                                </svg>
                            </button>

                            {showCatDropdown && (
                                <div className="absolute top-full right-0 mt-1.5 w-48 bg-[#0c0c0c]/98 backdrop-blur-2xl border border-white/10 rounded-xl shadow-[0_16px_48px_rgba(0,0,0,0.6)] py-1.5 z-[100] overflow-hidden">
                                    <div className="overflow-y-auto custom-scrollbar max-h-[140px]">
                                        <button
                                            onClick={() => handleCategoryChange('all')}
                                            className={`w-full flex items-center gap-2.5 px-3.5 py-2 text-left text-[11px] font-medium transition-all cursor-pointer ${selectedCategory === 'all' ? 'bg-blue-500/10 text-blue-400' : 'text-gray-400 hover:bg-white/5 hover:text-white'}`}
                                        >
                                            <div className={`w-1.5 h-1.5 rounded-full ${selectedCategory === 'all' ? 'bg-blue-400' : 'bg-gray-600'}`} />
                                            All Categories
                                        </button>
                                        {categories.map(cat => {
                                            return (
                                                <button
                                                    key={cat}
                                                    onClick={() => handleCategoryChange(cat)}
                                                    className={`w-full flex items-center gap-2.5 px-3.5 py-2 text-left text-[11px] font-medium transition-all cursor-pointer ${selectedCategory === cat ? 'bg-blue-500/10 text-blue-400' : 'text-gray-400 hover:bg-white/5 hover:text-white'}`}
                                                >
                                                    <div className={`w-1.5 h-1.5 rounded-full ${selectedCategory === cat ? 'bg-blue-400' : 'bg-gray-600'}`} />
                                                    {cat}
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                    <select 
                        className="sort-dropdown"
                        value={sortOrder}
                        onChange={(e) => handleSortOrderChange(e.target.value)}
                    >
                        <option value="newest">Newest to Oldest</option>
                        <option value="oldest">Oldest to Newest</option>
                    </select>
                    <div className="stat">
                        <span className="val">{currentList.length}</span>
                        <span className="lab">{viewMode === 'books' ? 'Books' : 'Articles'}</span>
                    </div>
                </div>
            </div>

            <div className="books-grid">
                {currentList.map(item => (
                    <div key={item.fullPath} className="book-card" onClick={() => handleItemSelect(item)}>
                        <div className="thumbnail-container">
                            {item.thumbnail ? (
                                <img src={item.thumbnail} alt={item.name} className="thumbnail" />
                            ) : (
                                <div className="placeholder-thumb">
                                    <span>{item.name.charAt(0)}</span>
                                </div>
                            )}

                            <div className="overlay">
                                <span>Recall</span>
                            </div>
                        </div>
                        <div className="book-info">
                            <h3>{item.name}</h3>
                        </div>
                    </div>
                ))}
            </div>

            {currentList.length === 0 && (
                <div className="empty-state">
                    <div className="icon">🧠</div>
                    <p>No notes to recall from {viewMode === 'books' ? 'books' : 'articles'} yet</p>
                </div>
            )}

            <style>{`
                .recaller-container {
                    min-height: 100vh; background: #050505; color: #fff;
                    padding: 20px 30px; padding-left: 65px;
                }
                .header-section { display: flex; justify-content: space-between; align-items: center; margin-bottom: 25px; border-bottom: 1px solid #111; padding-bottom: 15px; gap: 15px; }
                .title-group h1 { font-size: 18px; font-weight: 900; margin-bottom: 2px; color: #fff; }
                .title-group p { color: #444; font-size: 11px; }
                .stats-group .stat { display: flex; align-items: baseline; gap: 6px; }
                .stats-group .val { font-size: 16px; font-weight: 800; color: #4f8ef7; }
                .stats-group .lab { font-size: 9px; text-transform: uppercase; color: #333; letter-spacing: 0.05em; }

                .sort-dropdown {
                    background: rgba(255, 255, 255, 0.03);
                    border: 1px solid rgba(255, 255, 255, 0.05);
                    color: #999;
                    padding: 0 12px;
                    border-radius: 12px;
                    font-size: 11px;
                    font-weight: 600;
                    cursor: pointer;
                    outline: none;
                    transition: all 0.2s;
                    height: 36px;
                    box-sizing: border-box;
                }
                .sort-dropdown:hover {
                    color: #fff;
                    border-color: rgba(255, 255, 255, 0.1);
                }
                .sort-dropdown option {
                    background: #111;
                    color: #fff;
                }

                /* Toggle Styles */
                .toggle-wrapper {
                    display: flex;
                    justify-content: center;
                    align-items: center;
                }
                .toggle-container {
                    position: relative;
                    display: flex;
                    background: rgba(255, 255, 255, 0.03);
                    border: 1px solid rgba(255, 255, 255, 0.05);
                    padding: 3px;
                    border-radius: 12px;
                    gap: 2px;
                    align-items: center;
                    height: 36px;
                    box-sizing: border-box;
                }
                .sliding-bg {
                    position: absolute;
                    top: 3px;
                    left: 3px;
                    height: calc(100% - 6px);
                    width: calc(50% - 4px);
                    background: rgba(79, 142, 247, 0.1);
                    border: 1px solid rgba(79, 142, 247, 0.2);
                    border-radius: 9px;
                    transition: transform 0.3s cubic-bezier(0.25, 1, 0.5, 1);
                    z-index: 0;
                }
                .sliding-bg.books {
                    transform: translateX(0);
                }
                .sliding-bg.articles {
                    transform: translateX(calc(100% + 2px));
                }
                .toggle-btn {
                    position: relative;
                    z-index: 1;
                    background: transparent;
                    border: none;
                    color: #555;
                    padding: 6px 14px;
                    border-radius: 9px;
                    font-size: 11px;
                    font-weight: 700;
                    cursor: pointer;
                    display: flex;
                    align-items: center;
                    gap: 6px;
                    transition: all 0.2s ease;
                }
                .toggle-btn:hover {
                    color: #999;
                }
                .toggle-btn.active {
                    color: #4f8ef7;
                }
                .toggle-btn .badge {
                    background: rgba(255, 255, 255, 0.03);
                    color: #444;
                    padding: 1px 5px;
                    border-radius: 4px;
                    font-size: 9px;
                    transition: all 0.2s ease;
                }
                .toggle-btn.active .badge {
                    background: rgba(79, 142, 247, 0.15);
                    color: #4f8ef7;
                }

                .books-grid {
                    display: grid; grid-template-columns: repeat(auto-fill, minmax(110px, 1fr));
                    gap: 15px;
                }
                .book-card { cursor: pointer; }
                .thumbnail-container {
                    position: relative; aspect-ratio: 2/3; border-radius: 8px;
                    overflow: hidden; background: #0c0c0e; border: 1px solid rgba(255,255,255,0.05);
                    transition: all 0.2s ease;
                }
                .book-card:hover .thumbnail-container { transform: scale(1.03); border-color: #4f8ef7; }
                .thumbnail { width: 100%; height: 100%; object-fit: cover; }
                .placeholder-thumb { width: 100%; height: 100%; display: flex; align-items: center; justify-content: center; font-size: 24px; color: #222; font-weight: 900; }
                
                .note-count-badge {
                    position: absolute; top: 6px; right: 6px;
                    background: rgba(0,0,0,0.85); backdrop-filter: blur(4px);
                    border: 1px solid rgba(255,255,255,0.1); padding: 2px 6px;
                    border-radius: 4px; font-size: 9px; font-weight: 800;
                    display: flex; align-items: center; gap: 3px; z-index: 10;
                }
                .note-count-badge .icon { color: #4f8ef7; font-size: 8px; }

                .overlay {
                    position: absolute; inset: 0; background: rgba(79, 142, 247, 0.4);
                    display: flex; align-items: center; justify-content: center;
                    opacity: 0; transition: opacity 0.2s;
                }
                .overlay span { font-size: 9px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.1em; color: #fff; }
                .book-card:hover .overlay { opacity: 1; }

                .book-info { margin-top: 8px; }
                .book-info h3 { font-size: 11px; font-weight: 600; color: #999; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; margin: 0; }

                .empty-state { padding: 60px 0; text-align: center; color: #333; }
                .empty-state .icon { font-size: 30px; margin-bottom: 10px; opacity: 0.2; }
                .empty-state p { font-size: 12px; color: #444; }
            `}</style>
        </div>
    );
};

export default Recaller;