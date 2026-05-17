import React, { useState, useEffect, useMemo } from 'react';
import { useData } from '../contexts/DataContext';

const path = window.require('path');
const fs = window.require('fs');

const NOTES_FOLDER = 'C:\\Users\\PC\\Desktop\\database\\Books\\notes';
const THUMBNAIL_CACHE = 'C:\\Users\\PC\\Desktop\\database\\books\\ThumbnailCache';

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
function ReadMode({ notes, onBack }) {
    const [idx, setIdx] = useState(0);
    const note = notes[idx];

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

    return (
        <div className="mode-container">
            <div className="mode-header">
                <button className="back-btn" onClick={onBack}>← Library</button>
                <div className="mode-info">
                    <span className="mode-label">Reviewing Notes</span>
                    <span className="counter">{idx + 1} / {notes.length}</span>
                </div>
            </div>

            <div className="card-area">
                <div className="read-card">
                    <div className="card-topbar">
                        {(note.startPage || note.endPage) && (
                            <span className="page-badge">
                                {note.startPage && note.endPage
                                    ? `Pages ${note.startPage} – ${note.endPage}`
                                    : `Page ${note.startPage || note.endPage}`}
                            </span>
                        )}
                        <span className="ts">{new Date(note.timestamp).toLocaleDateString()}</span>
                    </div>
                    <div className="read-card-inner">
                         <div className={`note-content ${isArabic(note.content) ? 'rtl' : ''}`} dangerouslySetInnerHTML={{ __html: note.content }} />
                    </div>
                </div>
            </div>

            <div className="nav-row">
                <button className="nav-btn" onClick={() => setIdx(i => Math.max(0, i - 1))} disabled={idx === 0}>Prev</button>
                <div className="dot-track">
                    {notes.map((_, i) => (
                        <div key={i} className={`dot ${i === idx ? 'active' : ''}`} onClick={() => setIdx(i)} />
                    ))}
                </div>
                <button className="nav-btn" onClick={() => setIdx(i => Math.min(notes.length - 1, i + 1))} disabled={idx === notes.length - 1}>Next</button>
            </div>
        </div>
    );
}

// ─── Main Recaller Component ──────────────────────────────────────────────────

const Recaller = () => {
    const { data } = useData();
    const [booksWithNotes, setBooksWithNotes] = useState([]);
    const [selectedBook, setSelectedBook] = useState(null);
    const [activeNotes, setActiveNotes] = useState([]);

    useEffect(() => {
        if (!data?.reading?.shelves?.Read) return;

        const readBooks = data.reading.shelves.Read;
        const processed = readBooks.map(book => {
            const baseName = path.basename(book.fullPath).replace(/\.pdf$/i, '');
            const notesPath = path.join(NOTES_FOLDER, `${baseName}.json`);
            let count = 0;
            if (fs.existsSync(notesPath)) {
                try {
                    const notes = JSON.parse(fs.readFileSync(notesPath, 'utf8'));
                    count = notes.length;
                } catch (e) { console.error(e); }
            }
            const thumbPath = path.join(THUMBNAIL_CACHE, `${baseName}.jpg`);
            return { 
                ...book, 
                noteCount: count, 
                thumbnail: fs.existsSync(thumbPath) ? `file://${thumbPath}` : null 
            };
        }).filter(b => b.noteCount > 0);

        setBooksWithNotes(processed);
    }, [data]);

    const handleBookSelect = (book) => {
        const baseName = path.basename(book.fullPath).replace(/\.pdf$/i, '');
        const notesPath = path.join(NOTES_FOLDER, `${baseName}.json`);
        try {
            const notes = JSON.parse(fs.readFileSync(notesPath, 'utf8'));
            // Sort by timestamp ascending — earliest note first
            notes.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
            setActiveNotes(notes);
            setSelectedBook(book);
        } catch (e) {
            console.error(e);
        }
    };

    if (selectedBook) {
        return (
            <div className="recaller-view">
                <ReadMode 
                    notes={activeNotes} 
                    bookName={selectedBook.name} 
                    onBack={() => setSelectedBook(null)} 
                />
                <style>{`
                    .recaller-view {
                        height: 100vh; background: #050505; color: #fff;
                        display: flex; flex-direction: column; padding: 15px 30px; padding-left: 65px;
                    }
                    .mode-container { flex: 1; display: flex; flex-direction: column; gap: 10px; max-width: 900px; margin: 0 auto; width: 100%; }
                    .mode-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 4px; }
                    .back-btn { background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); color: #888; padding: 6px 14px; border-radius: 8px; font-size: 12px; cursor: pointer; transition: all 0.2s; }
                    .back-btn:hover { background: rgba(255,255,255,0.1); color: #fff; }
                    .mode-info { display: flex; flex-direction: column; align-items: flex-end; }
                    .mode-label { font-size: 10px; text-transform: uppercase; letter-spacing: 0.1em; color: #4f8ef7; font-weight: 800; }
                    .counter { font-size: 14px; font-weight: 700; color: #555; }
                    
                    .card-area { flex: 1; display: flex; align-items: stretch; min-height: 0; }
                    .read-card { flex: 1; background: #0c0c0e; border: 1px solid rgba(255,255,255,0.05); border-radius: 20px; display: flex; flex-direction: column; overflow: hidden; box-shadow: 0 20px 50px rgba(0,0,0,0.3); }
                    .card-topbar { padding: 10px 20px; border-bottom: 1px solid rgba(255,255,255,0.05); background: rgba(255,255,255,0.02); display: flex; justify-content: space-between; align-items: center; }
                    .read-card-inner { flex: 1; overflow-y: auto; padding: 20px; }
                    .note-content { font-size: 16px; line-height: 1.6; color: #ccc; text-align: justify; }
                    .note-content.rtl { direction: rtl; text-align: justify; }
                    .note-content h1, .note-content h2 { color: #fff; margin-bottom: 15px; }
                    .page-badge { background: rgba(79,142,247,0.1); color: #4f8ef7; padding: 4px 10px; border-radius: 6px; font-size: 11px; font-weight: 700; }
                    .ts { font-size: 11px; color: #444; }

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
                <div className="title-group">
                    <h1>Recaller</h1>
                    <p>Review notes from read books.</p>
                </div>
                <div className="stats-group">
                    <div className="stat">
                        <span className="val">{booksWithNotes.length}</span>
                        <span className="lab">Books</span>
                    </div>
                </div>
            </div>

            <div className="books-grid">
                {booksWithNotes.map(book => (
                    <div key={book.fullPath} className="book-card" onClick={() => handleBookSelect(book)}>
                        <div className="thumbnail-container">
                            {book.thumbnail ? (
                                <img src={book.thumbnail} alt={book.name} className="thumbnail" />
                            ) : (
                                <div className="placeholder-thumb">
                                    <span>{book.name.charAt(0)}</span>
                                </div>
                            )}
                            <div className="note-count-badge">
                                <span className="icon">◈</span>
                                {book.noteCount}
                            </div>
                            <div className="overlay">
                                <span>Recall</span>
                            </div>
                        </div>
                        <div className="book-info">
                            <h3>{book.name}</h3>
                        </div>
                    </div>
                ))}
            </div>

            {booksWithNotes.length === 0 && (
                <div className="empty-state">
                    <div className="icon">🧠</div>
                    <p>No notes to recall yet</p>
                </div>
            )}

            <style>{`
                .recaller-container {
                    min-height: 100vh; background: #050505; color: #fff;
                    padding: 20px 30px; padding-left: 65px;
                }
                .header-section { display: flex; justify-content: space-between; align-items: center; margin-bottom: 25px; border-bottom: 1px solid #111; padding-bottom: 15px; }
                .title-group h1 { font-size: 18px; font-weight: 900; margin-bottom: 2px; color: #fff; }
                .title-group p { color: #444; font-size: 11px; }
                .stats-group .stat { display: flex; align-items: baseline; gap: 6px; }
                .stats-group .val { font-size: 16px; font-weight: 800; color: #4f8ef7; }
                .stats-group .lab { font-size: 9px; text-transform: uppercase; color: #333; letter-spacing: 0.05em; }

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