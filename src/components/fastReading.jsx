import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useData } from '../contexts/DataContext';
import BookOpenIcon from '../assets/icons/book.svg';
import CheckCircle2Icon from '../assets/icons/check.svg';
import Loader2Icon from '../assets/icons/loader.svg';
import PlayIcon from '../assets/icons/play.svg';
import ChevronLeftIcon from '../assets/icons/chevron-left.svg';
import PlusIcon from '../assets/icons/plus.svg';
import TrashIcon from '../assets/icons/delete.svg';
import EditIcon from '../assets/icons/edit.svg';
import BookNotesModal from './bookComponenets/BookNotesModal';
import { PDFDocument } from 'pdf-lib';

const fs = window.require('fs');
const path = window.require('path');
const { shell } = window.require('electron');
const THUMBNAIL_CACHE_FOLDER = 'C:\\Users\\PC\\Desktop\\database\\books\\ThumbnailCache';

const ReadingSessions = () => {
    const { data } = useData();
    const navigate = useNavigate();
    const readingBooks = data?.reading?.shelves?.['Reading'] || [];
    const wantToReadBooks = data?.reading?.shelves?.['WanttoRead'] || [];

    const getBookThumbnail = (book) => {
        if (book.cover) return book.cover;
        const cachePath = path.join(THUMBNAIL_CACHE_FOLDER, book.name + '.jpg');
        try {
            if (fs.existsSync(cachePath)) {
                const buffer = fs.readFileSync(cachePath);
                return `data:image/jpeg;base64,${buffer.toString('base64')}`;
            }
        } catch {
            return null;
        }
        return null;
    };

    const allBooks = [...readingBooks, ...wantToReadBooks].filter(
        (book) => book.fullPath && book.fullPath.toLowerCase().endsWith('.pdf')
    );

    // Track which book is currently expanded in the detail view
    const [activeBookPath, setActiveBookPath] = useState(() => {
        try { return localStorage.getItem('axo_fastreader_active_book') || null; } catch { return null; }
    });

    useEffect(() => {
        if (activeBookPath) {
            try { localStorage.setItem('axo_fastreader_active_book', activeBookPath); } catch {}
        } else {
            try { localStorage.removeItem('axo_fastreader_active_book'); } catch {}
        }
    }, [activeBookPath]);

    // Auto-detect and track already split books
    const [splitBooks, setSplitBooks] = useState([]);
    
    // Deletion Modal State
    const [bookToDelete, setBookToDelete] = useState(null);

    // Notes Modal State
    const [notesModalData, setNotesModalData] = useState(null);

    // Read Tracking State
    const [readSessions, setReadSessions] = useState(() => {
        try {
            const saved = localStorage.getItem('axo_read_sessions');
            return saved ? JSON.parse(saved) : {};
        } catch {
            return {};
        }
    });

    useEffect(() => {
        localStorage.setItem('axo_read_sessions', JSON.stringify(readSessions));
    }, [readSessions]);

    // Detail Config States
    const [pagesPerSession, setPagesPerSession] = useState(30);
    const [isProcessing, setIsProcessing] = useState(false);
    const [progressStatus, setProgressStatus] = useState('');
    const [generatedSessions, setGeneratedSessions] = useState([]);
    const [totalPages, setTotalPages] = useState(0);

    // Check which books have existing " - Sessions" folders
    const checkSplitBooks = () => {
        const found = [];
        allBooks.forEach(book => {
            const currentDir = path.dirname(book.fullPath);
            const bookNameWithoutExt = path.basename(book.fullPath, '.pdf');
            const outputDir = path.join(currentDir, `${bookNameWithoutExt} - Sessions`);
            if (fs.existsSync(outputDir)) {
                found.push(book);
            }
        });
        setSplitBooks(found);
    };

    useEffect(() => {
        checkSplitBooks();
    }, [data]);

    // When returning to detail view or clicking an already split book, load its existing sessions
    useEffect(() => {
        if (!activeBookPath) {
            setTotalPages(0);
            return;
        }
        
        let isMounted = true;
        const loadPages = async () => {
            try {
                const pdfBytes = fs.readFileSync(activeBookPath);
                const srcDoc = await PDFDocument.load(pdfBytes, { ignoreEncryption: true });
                if (isMounted) {
                    setTotalPages(srcDoc.getPageCount());
                }
            } catch (err) {
                console.error(err);
            }
        };
        loadPages();

        const currentDir = path.dirname(activeBookPath);
        const bookNameWithoutExt = path.basename(activeBookPath, '.pdf');
        const outputDir = path.join(currentDir, `${bookNameWithoutExt} - Sessions`);

        if (fs.existsSync(outputDir)) {
            try {
                const files = fs.readdirSync(outputDir).filter(f => f.toLowerCase().endsWith('.pdf'));
                const existingFiles = files.map(file => ({
                    name: file,
                    path: path.join(outputDir, file),
                    pages: 'Generated' // We don't read the PDF here to save overhead, just indicate it exists
                })).sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' }));
                setGeneratedSessions(existingFiles);
            } catch (err) {
                console.error(err);
                setGeneratedSessions([]);
            }
        } else {
            setGeneratedSessions([]);
        }
        setProgressStatus('');

        return () => { isMounted = false; };
    }, [activeBookPath]);

    const handleDeleteBook = () => {
        if (!bookToDelete) return;
        const currentDir = path.dirname(bookToDelete.fullPath);
        const bookNameWithoutExt = path.basename(bookToDelete.fullPath, '.pdf');
        const outputDir = path.join(currentDir, `${bookNameWithoutExt} - Sessions`);
        
        try {
            if (fs.existsSync(outputDir)) {
                fs.rmSync(outputDir, { recursive: true, force: true });
            }
        } catch (error) {
            console.error('Failed to delete sessions:', error);
        }
        
        setBookToDelete(null);
        if (activeBookPath === bookToDelete.fullPath) {
            setActiveBookPath(null);
        }
        checkSplitBooks();
    };

    const handleAddNewSplit = (e) => {
        const fullPath = e.target.value;
        if (fullPath) {
            setActiveBookPath(fullPath);
        }
        e.target.value = "";
    };

    const handleSplitPDF = async () => {
        if (!activeBookPath) return;
        setIsProcessing(true);
        setProgressStatus('Loading PDF...');
        setGeneratedSessions([]);

        try {
            const pdfBytes = fs.readFileSync(activeBookPath);
            const srcDoc = await PDFDocument.load(pdfBytes);
            const totalPages = srcDoc.getPageCount();

            if (pagesPerSession <= 0 || pagesPerSession >= totalPages) {
                setProgressStatus('Invalid pages per session.');
                setIsProcessing(false);
                return;
            }

            const sessionsCount = Math.ceil(totalPages / pagesPerSession);
            const currentDir = path.dirname(activeBookPath);
            const bookNameWithoutExt = path.basename(activeBookPath, '.pdf');
            const outputDir = path.join(currentDir, `${bookNameWithoutExt} - Sessions`);

            if (fs.existsSync(outputDir)) {
                fs.rmSync(outputDir, { recursive: true, force: true });
            }
            fs.mkdirSync(outputDir, { recursive: true });

            setProgressStatus(`Generating ${sessionsCount} sessions...`);
            const createdFiles = [];

            for (let i = 0; i < sessionsCount; i++) {
                const startPage = i * pagesPerSession;
                const endPage = Math.min((i + 1) * pagesPerSession - 1, totalPages - 1);
                
                setProgressStatus(`Creating Session ${i + 1} of ${sessionsCount}...`);

                const newPdf = await PDFDocument.create();
                const pagesToCopy = [];
                for (let p = startPage; p <= endPage; p++) {
                    pagesToCopy.push(p);
                }

                const copiedPages = await newPdf.copyPages(srcDoc, pagesToCopy);
                copiedPages.forEach((page) => newPdf.addPage(page));

                const pdfBytesNew = await newPdf.save();
                const sessionFileName = `${startPage + 1}-${endPage + 1} - ${bookNameWithoutExt}.pdf`;
                const sessionPath = path.join(outputDir, sessionFileName);
                
                fs.writeFileSync(sessionPath, pdfBytesNew);
                createdFiles.push({
                    name: sessionFileName,
                    path: sessionPath,
                    pages: `${endPage - startPage + 1} Pages`
                });
            }

            setGeneratedSessions(createdFiles);
            setProgressStatus(`Success! Created ${sessionsCount} sessions.`);
            checkSplitBooks(); // Refresh the list of completely split books
        } catch (error) {
            console.error('Error splitting PDF:', error);
            setProgressStatus('Error splitting PDF. Check console.');
        }

        setIsProcessing(false);
    };

    const openPath = (p) => {
        shell.openPath(p);
    };

    const openDirectory = async () => {
        if (!activeBookPath) return;
        const currentDir = path.dirname(activeBookPath);
        const bookNameWithoutExt = path.basename(activeBookPath, '.pdf');
        const outputDir = path.join(currentDir, `${bookNameWithoutExt} - Sessions`);
        if (fs.existsSync(outputDir)) {
            shell.openPath(outputDir);
        }
    };

    return (
        <div className="w-full text-white font-sans selection:bg-blue-500/30 pl-16 pr-4 pt-2 pb-24">
            <div className="w-full">
                {/* Notes Modal */}
                {notesModalData && (
                    <BookNotesModal
                        bookPath={notesModalData.bookPath}
                        bookName={notesModalData.bookName}
                        initialStartPage={notesModalData.initialStart}
                        initialEndPage={notesModalData.initialEnd}
                        filterStartPage={notesModalData.initialStart}
                        filterEndPage={notesModalData.initialEnd}
                        onClose={() => setNotesModalData(null)}
                    />
                )}

                {/* Deletion Modal */}
                {bookToDelete && (
                    <div className="fixed inset-0 z-[300] flex items-center justify-center bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
                        <div className="bg-[#0a0a0a] border border-white/10 rounded-lg p-5 max-w-sm w-full mx-4 shadow-2xl animate-in zoom-in-95 duration-200">
                            <h3 className="text-sm font-bold text-white mb-2">Delete Sessions?</h3>
                            <p className="text-xs text-gray-400 mb-6 leading-relaxed">
                                Are you sure you want to delete all generated sessions for <span className="text-white font-semibold">"{bookToDelete.name}"</span>? This will permanently wipe the split files from your drive.
                            </p>
                            <div className="flex items-center justify-end gap-3">
                                <button
                                    onClick={() => setBookToDelete(null)}
                                    className="px-4 py-2 rounded-md text-[10px] uppercase tracking-widest font-bold text-gray-400 hover:text-white hover:bg-white/5 transition-colors cursor-pointer"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={handleDeleteBook}
                                    className="px-4 py-2 rounded-md text-[10px] uppercase tracking-widest font-bold bg-red-500/10 text-red-500 hover:bg-red-500 hover:text-white transition-colors border border-red-500/20 cursor-pointer"
                                >
                                    Delete Files
                                </button>
                            </div>
                        </div>
                    </div>
                )}
                {!activeBookPath ? (
                    /* MAIN LIST VIEW */
                    <div className="space-y-4 animate-in fade-in duration-300">
                        <button
                            onClick={() => {
                                try { localStorage.setItem('axo_books_last_view', 'books'); } catch {}
                                navigate('/Books/books');
                            }}
                            className="flex items-center gap-2 text-[11px] font-bold text-gray-400 hover:text-white hover:bg-white/5 px-2 py-1.5 -ml-2 rounded-md transition-all w-fit uppercase tracking-widest mb-1 cursor-pointer"
                        >
                            <img src={ChevronLeftIcon} className="w-3.5 h-3.5 invert opacity-80" alt="back" />
                            Return
                        </button>
                        
                        {/* Selected for Splitting (New) Component */}
                        <div className="flex flex-col gap-1.5">
                            <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                                Split a New Book
                            </label>
                            <div className="relative">
                                <select
                                    defaultValue=""
                                    onChange={handleAddNewSplit}
                                    className="w-full bg-[#0a0a0a] border border-white/10 rounded-md px-3 py-2 text-sm text-gray-300 focus:outline-none focus:border-white/30 transition-colors cursor-pointer appearance-none"
                                >
                                    <option value="" disabled>Select a PDF to split...</option>
                                    {allBooks.map((book) => (
                                        <option key={book.fullPath} value={book.fullPath}>
                                            {book.name}
                                        </option>
                                    ))}
                                </select>
                                <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none">
                                    <img src={PlusIcon} className="w-3 h-3 invert opacity-40" alt="" />
                                </div>
                            </div>
                        </div>

                        {/* Already Split Books */}
                        <div>
                            <h2 className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">
                                Already Split Books
                            </h2>
                            {splitBooks.length === 0 ? (
                                <div className="p-3 border border-dashed border-white/10 rounded-md text-center">
                                    <p className="text-[10px] text-gray-500">No books have been split yet.</p>
                                </div>
                            ) : (
                                <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-3">
                                    {splitBooks.map((book) => {
                                        const thumb = getBookThumbnail(book);
                                        return (
                                        <div
                                            key={book.fullPath}
                                            onClick={() => setActiveBookPath(book.fullPath)}
                                            className="group relative flex flex-col gap-2 transition-all cursor-pointer"
                                        >
                                            <div className="relative aspect-[2.8/4] rounded-lg overflow-hidden bg-[#0c0c0c] border border-white/10 group-hover:border-white/30 transition-all shadow-lg group-hover:-translate-y-1">
                                                {thumb ? (
                                                    <img src={thumb} alt={book.name} className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105" />
                                                ) : (
                                                    <div className="w-full h-full flex flex-col items-center justify-center gap-2 bg-gradient-to-br from-[#111111] to-[#050505]">
                                                        <img src={BookOpenIcon} className="w-5 h-5 opacity-30 invert grayscale" alt="" />
                                                    </div>
                                                )}

                                                <button
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        setBookToDelete(book);
                                                    }}
                                                    className="absolute top-2 right-2 p-1.5 bg-black/60 hover:bg-red-500/80 rounded-md backdrop-blur-sm opacity-0 group-hover:opacity-100 transition-all border border-white/10 hover:border-red-500 cursor-pointer shadow-xl"
                                                    title="Delete Sessions"
                                                >
                                                    <img src={TrashIcon} className="w-3 h-3 invert" alt="delete" />
                                                </button>
                                            </div>
                                            <span className="text-[10px] font-semibold text-gray-400 group-hover:text-white truncate text-center px-1">
                                                {book.name}
                                            </span>
                                        </div>
                                    )})}
                                </div>
                            )}
                        </div>
                    </div>
                ) : (
                    /* DETAIL VIEW */
                    <div className="space-y-2 animate-in slide-in-from-right-4 duration-300">
                        <button
                            onClick={() => setActiveBookPath(null)}
                            className="flex items-center gap-2 text-[11px] font-bold text-gray-400 hover:text-white hover:bg-white/5 px-2 py-1.5 -ml-2 rounded-md transition-all w-fit uppercase tracking-widest mb-1 cursor-pointer"
                        >
                            <img src={ChevronLeftIcon} className="w-3.5 h-3.5 invert opacity-80" alt="back" />
                            Return
                        </button>

                        <div className="p-3 bg-[#0a0a0a] border border-white/10 rounded-lg">
                            <h2 className="text-xs font-bold text-white mb-1">
                                {allBooks.find(b => b.fullPath === activeBookPath)?.name || path.basename(activeBookPath)}
                            </h2>
                            <div className="flex items-center gap-3 mb-3">
                                <span className="text-[10px] text-gray-500 font-semibold uppercase tracking-widest">{totalPages ? `${totalPages} Total Pages` : 'Loading...'}</span>
                                <span className="text-[10px] text-gray-500 font-semibold uppercase tracking-widest">
                                    {generatedSessions.length > 0 
                                        ? `${generatedSessions.length} Created Sessions` 
                                        : totalPages 
                                            ? `${Math.ceil(totalPages / pagesPerSession)} Projected Sessions` 
                                            : '...'
                                    }
                                </span>
                                {(() => {
                                    const readPages = generatedSessions.reduce((total, session) => {
                                        if (readSessions[session.path]) {
                                            const matchNew = session.name.match(/^(\d+)-(\d+)\s+-/);
                                            if (matchNew) return total + (parseInt(matchNew[2], 10) - parseInt(matchNew[1], 10) + 1);

                                            const matchOld = session.name.match(/\((\d+)\s*Pages?\)/i);
                                            if (matchOld) return total + parseInt(matchOld[1], 10);
                                        }
                                        return total;
                                    }, 0);
                                    if (readPages > 0 && totalPages > 0) {
                                        return (
                                            <span className="text-[10px] text-emerald-400 font-bold uppercase tracking-widest bg-emerald-500/10 px-1.5 py-0.5 rounded border border-emerald-500/20 animate-in fade-in zoom-in-95 duration-300">
                                                {Math.max(0, totalPages - readPages)} Pages Left
                                            </span>
                                        );
                                    }
                                    return null;
                                })()}
                            </div>

                            <div className="grid grid-cols-2 gap-2">
                                <div className="space-y-1.5">
                                    <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                                        Pages Per Session
                                    </label>
                                    <input
                                        type="number"
                                        min="1"
                                        value={pagesPerSession}
                                        onChange={(e) => setPagesPerSession(Math.max(1, Number(e.target.value)))}
                                        className="w-full bg-[#050505] border border-white/10 rounded-md px-3 py-1.5 text-sm font-bold text-white focus:outline-none focus:border-white/30 transition-colors"
                                    />
                                </div>
                                <div className="flex items-end">
                                    <button
                                        onClick={handleSplitPDF}
                                        disabled={isProcessing}
                                        className={`w-full flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-md font-bold text-[10px] uppercase tracking-wide transition-all ${
                                            isProcessing
                                                ? 'bg-white/5 text-gray-500 border border-white/5 cursor-not-allowed'
                                                : 'bg-white text-black hover:bg-gray-200 active:bg-gray-300 cursor-pointer'
                                        }`}
                                    >
                                        {isProcessing ? (
                                            <>
                                                <img src={Loader2Icon} className="w-2.5 h-2.5 animate-spin opacity-50" alt="" />
                                                Processing...
                                            </>
                                        ) : (
                                            <>Generate Sessions</>
                                        )}
                                    </button>
                                </div>
                            </div>

                            {progressStatus && (
                                <div className={`mt-2 text-[10px] font-semibold ${progressStatus.includes('Error') ? 'text-red-400' : 'text-gray-400'}`}>
                                    {progressStatus}
                                </div>
                            )}
                        </div>

                        {/* Generated Sessions List in Detail View */}
                        {generatedSessions.length > 0 && (
                            <div className="pt-2 border-t border-white/5">
                                <div className="flex items-center justify-between mb-2">
                                    <h3 className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                                        Split Files
                                    </h3>
                                    <button 
                                        onClick={openDirectory}
                                        className="text-[10px] font-bold text-blue-400 hover:text-blue-300 uppercase tracking-widest cursor-pointer"
                                    >
                                        Open Location
                                    </button>
                                </div>
                                <div className="grid grid-cols-2 gap-2">
                                    {generatedSessions.map((session, i) => (
                                        <div
                                            key={i}
                                            onClick={() => openPath(session.path)}
                                            className={`flex items-center gap-2 p-2 rounded-md transition-colors cursor-pointer group border ${
                                                readSessions[session.path]
                                                    ? 'bg-emerald-500/10 border-emerald-500/30 hover:bg-emerald-500/20'
                                                    : 'bg-[#0a0a0a] border-white/10 hover:border-white/30'
                                            }`}
                                        >
                                            <div className="p-1.5 bg-white/5 rounded">
                                                <img src={PlayIcon} className="w-2.5 h-2.5 invert opacity-60 group-hover:opacity-100" alt="open" />
                                            </div>
                                            <div className="flex-1 overflow-hidden">
                                                <p className="text-[11px] font-semibold text-gray-300 group-hover:text-white truncate">
                                                    {(() => {
                                                        const match = session.name.match(/^(\d+)-(\d+)\s+-/);
                                                        return match 
                                                            ? `Session ${i + 1}: ${match[1]}-${match[2]}` 
                                                            : session.name.replace('.pdf', '');
                                                    })()}
                                                </p>
                                                {session.pages !== 'Generated' && (
                                                    <p className="text-[9px] text-gray-500 mt-0.5">{session.pages}</p>
                                                )}
                                            </div>
                                            
                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    const match = session.name.match(/^(\d+)-(\d+)\s+-/);
                                                    setNotesModalData({
                                                        bookPath: activeBookPath,
                                                        bookName: allBooks.find(b => b.fullPath === activeBookPath)?.name || path.basename(activeBookPath),
                                                        initialStart: match ? match[1] : '',
                                                        initialEnd: match ? match[2] : ''
                                                    });
                                                }}
                                                className="p-1.5 rounded transition-all cursor-pointer hover:bg-white/10 opacity-30 group-hover:opacity-60 hover:!opacity-100"
                                                title="Notes"
                                            >
                                                <img src={EditIcon} className="w-2.5 h-2.5" style={{ filter: 'brightness(0) invert(1)' }} alt="notes" />
                                            </button>
                                            
                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    setReadSessions(prev => ({
                                                        ...prev,
                                                        [session.path]: !prev[session.path]
                                                    }));
                                                }}
                                                className={`p-1.5 rounded transition-all cursor-pointer ${
                                                    readSessions[session.path] 
                                                        ? 'opacity-100 hover:bg-white/10' 
                                                        : 'hover:bg-white/10 opacity-30 group-hover:opacity-60 hover:!opacity-100'
                                                }`}
                                                title={readSessions[session.path] ? "Mark as unread" : "Mark as read"}
                                            >
                                                <img 
                                                    src={CheckCircle2Icon} 
                                                    className="w-2.5 h-2.5 invert" 
                                                    style={readSessions[session.path] ? { filter: 'brightness(0) saturate(100%) invert(60%) sepia(85%) saturate(1000%) hue-rotate(100deg) brightness(95%) contrast(90%)' } : {}} 
                                                    alt="check" 
                                                />
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
};

export default ReadingSessions;