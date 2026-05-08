import React, { useState, useEffect } from 'react';
import editIcon from '../assets/icons/edit.svg';
import plusIcon from '../assets/icons/plus.svg';
import trashIcon from '../assets/icons/delete.svg';
import closeIcon from '../assets/icons/close.svg';
import Navbar from './Navbar';

const fs = window.require('fs').promises;
const path = window.require('path');

const BASE_DB = 'C:\\Users\\PC\\Desktop\\database';
const NOTES_DIR = path.join(BASE_DB, 'CardNotes');

const Notes = () => {
    const [notes, setNotes] = useState([]);
    const [selectedNote, setSelectedNote] = useState(null);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [isTitleModalOpen, setIsTitleModalOpen] = useState(false);
    const [newNoteTitle, setNewNoteTitle] = useState('');

    useEffect(() => {
        loadNotes();
    }, []);

    const loadNotes = async () => {
        try {
            await fs.mkdir(NOTES_DIR, { recursive: true });

            // Clean up any stray non-json files or old structures during load
            const files = await fs.readdir(NOTES_DIR);

            // We ignore quicknotes.txt if it's there
            const jsonFiles = files.filter(f => f.endsWith('.json'));

            const loaded = await Promise.all(jsonFiles.map(async file => {
                const content = await fs.readFile(path.join(NOTES_DIR, file), 'utf8');
                try {
                    return JSON.parse(content);
                } catch {
                    return null;
                }
            }));

            const validNotes = loaded.filter(n => n !== null).map(n => ({
                ...n,
                fields: n.fields || []
            }));
            validNotes.sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
            setNotes(validNotes);
        } catch (e) {
            console.error("Failed to load notes", e);
        }
    };

    const saveNote = async (noteToSave) => {
        setIsSaving(true);
        try {
            noteToSave.updatedAt = new Date().toISOString();
            await fs.mkdir(NOTES_DIR, { recursive: true });
            await fs.writeFile(path.join(NOTES_DIR, `${noteToSave.id}.json`), JSON.stringify(noteToSave, null, 2));
            setNotes(prev => prev.map(n => n.id === noteToSave.id ? noteToSave : n).sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt)));
        } catch (e) {
            console.error("Failed to save note", e);
        }
        setTimeout(() => setIsSaving(false), 500); // Visual delay for feedback
    };

    const handleCreateNote = async (e) => {
        if (e) e.preventDefault();
        const finalTitle = newNoteTitle.trim() || 'Untitled Note';

        const newNote = {
            id: crypto.randomUUID(),
            title: finalTitle,
            fields: [{ id: crypto.randomUUID(), title: '', value: '' }],
            updatedAt: new Date().toISOString(),
            createdAt: new Date().toISOString()
        };

        await fs.mkdir(NOTES_DIR, { recursive: true });
        await fs.writeFile(path.join(NOTES_DIR, `${newNote.id}.json`), JSON.stringify(newNote, null, 2));
        setNotes([newNote, ...notes]);
        setSelectedNote(newNote);
        setNewNoteTitle('');
        setIsTitleModalOpen(false);
        setIsModalOpen(true);
    };

    const deleteNote = async (e, id) => {
        e.stopPropagation();
        try {
            await fs.unlink(path.join(NOTES_DIR, `${id}.json`));
            setNotes(prev => prev.filter(n => n.id !== id));
        } catch (e) {
            console.error("Failed to delete note", e);
        }
    };

    const handleUpdateNote = (updatedNote) => {
        setSelectedNote(updatedNote);
        saveNote(updatedNote);
    };

    const addField = () => {
        if (!selectedNote) return;
        const updated = {
            ...selectedNote,
            fields: [...selectedNote.fields, { id: crypto.randomUUID(), title: '', value: '' }]
        };
        handleUpdateNote(updated);
    };

    const updateField = (id, value) => {
        if (!selectedNote) return;
        const updated = {
            ...selectedNote,
            fields: selectedNote.fields.map(f => f.id === id ? { ...f, value } : f)
        };
        handleUpdateNote(updated);
    };

    const updateFieldTitle = (id, title) => {
        if (!selectedNote) return;
        const updated = {
            ...selectedNote,
            fields: selectedNote.fields.map(f => f.id === id ? { ...f, title } : f)
        };
        handleUpdateNote(updated);
    };

    const deleteField = (id) => {
        if (!selectedNote) return;
        const updated = {
            ...selectedNote,
            fields: selectedNote.fields.filter(f => f.id !== id)
        };
        // Don't leave zero fields
        if (updated.fields.length === 0) {
            updated.fields.push({ id: crypto.randomUUID(), title: '', value: '' });
        }
        handleUpdateNote(updated);
    };

    return (
        <div className="min-h-screen bg-black text-white p-4 pl-20 flex relative font-sans">
            <Navbar />
            <div className="w-full max-w-7xl mx-auto flex flex-col">
                {/* Header */}
                <div className="flex items-center justify-between mb-4 px-2">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-white/10 rounded-lg shadow-inner border border-white/5">
                            <img src={editIcon} alt="Notes" className="w-4 h-4 filter brightness-0 invert opacity-90" />
                        </div>
                        <h1 className="text-xl font-bold tracking-wide text-white/90">Notes</h1>
                    </div>
                    <button
                        onClick={() => { setNewNoteTitle(''); setIsTitleModalOpen(true); }}
                        className="group flex items-center gap-1.5 bg-emerald-500 hover:bg-emerald-400 text-black px-3 py-1.5 rounded-lg text-xs font-bold transition-all shadow-[0_0_10px_rgba(16,185,129,0.3)] hover:shadow-[0_0_15px_rgba(16,185,129,0.5)] transform hover:-translate-y-0.5"
                    >
                        <img src={plusIcon} alt="Add" className="w-3 h-3 filter brightness-0 transition-transform group-hover:rotate-90" />
                        New Note
                    </button>
                </div>

                {/* Grid of Cards */}
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-3 px-2">
                    {notes.map(note => (
                        <div
                            key={note.id}
                            onClick={() => { setSelectedNote(note); setIsModalOpen(true); }}
                            className="bg-[#111] backdrop-blur-xl border border-white/10 rounded-xl p-3 cursor-pointer hover:bg-white/5 transition-all duration-300 hover:-translate-y-0.5 shadow-md hover:shadow-lg hover:shadow-white/5 group relative flex flex-col h-[160px]"
                        >
                            <h3 className="text-sm font-bold mb-2 text-white/90 pr-6 truncate">{note.title || 'Untitled'}</h3>
                            <div className="flex flex-col gap-0.5 flex-grow overflow-hidden relative text-[10px] text-white/50 leading-tight">
                                {(note.fields || []).slice(0, 2).map((field, i) => (
                                    <div key={field.id} className="flex flex-col">
                                        {field.title && <span className="font-bold text-white/70 block truncate">{field.title}</span>}
                                        <div className="line-clamp-2">{field.value || <span className="text-white/20 italic">Empty...</span>}</div>
                                    </div>
                                ))}
                                {(note.fields || []).length > 2 && (
                                    <p className="text-[9px] text-white/30 italic font-medium mt-auto">+ {(note.fields || []).length - 2} more</p>
                                )}
                                {/* Gradient fade out at bottom if long */}
                                <div className="absolute bottom-0 left-0 right-0 h-6 bg-gradient-to-t from-[#111] via-[#111]/80 to-transparent pointer-events-none opacity-80 group-hover:opacity-100 transition-opacity"></div>
                            </div>

                            <button
                                onClick={(e) => deleteNote(e, note.id)}
                                className="absolute top-2 right-2 p-1.5 bg-red-500/10 hover:bg-red-500 text-red-500 hover:text-white rounded flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all z-10"
                                title="Delete Note"
                            >
                                <img src={trashIcon} alt="Delete" className="w-3 h-3 filter brightness-0 saturate-100 invert-27 sepia-91 hue-rotate-343" style={{ filter: 'invert(52%) sepia(87%) saturate(4177%) hue-rotate(338deg) brightness(100%) contrast(105%)' }} />
                            </button>

                            <div className="text-[9px] text-white/30 uppercase tracking-widest mt-2 pt-2 border-t border-white/5 font-bold flex items-center justify-between shrink-0">
                                <span>{new Date(note.updatedAt).toLocaleDateString(undefined, { month: '2-digit', day: '2-digit', year: '2-digit' })}</span>
                                <span className="bg-white/5 px-1.5 py-0.5 rounded shadow-sm">{note.fields.length} Field{note.fields.length !== 1 ? 's' : ''}</span>
                            </div>
                        </div>
                    ))}
                </div>

                {notes.length === 0 && (
                    <div className="flex flex-col items-center justify-center h-[50vh] text-white/30 px-2">
                        <div className="w-16 h-16 mb-4 rounded-full bg-white/5 flex items-center justify-center border border-white/10">
                            <img src={editIcon} className="w-6 h-6 filter brightness-0 invert opacity-40" />
                        </div>
                        <p className="text-sm font-medium text-white/50 mb-1">No notes here yet</p>
                        <p className="text-[10px] text-white/30">Click "New Note" to create a card based note.</p>
                    </div>
                )}
            </div>

            {/* Modal */}
            {isModalOpen && selectedNote && (
                <div className="fixed inset-0 z-[200] flex items-center justify-center p-2 sm:p-4 md:p-8 lg:p-12 h-screen">
                    {/* Backdrop */}
                    <div
                        className="absolute inset-0 bg-black/60 backdrop-blur-md transition-opacity"
                        onClick={() => setIsModalOpen(false)}
                    ></div>

                    {/* Modal Content */}
                    <div className="relative w-full max-w-3xl h-full flex flex-col bg-[#0a0a0a] border border-white/10 rounded-xl shadow-2xl overflow-hidden transform transition-all animate-in fade-in zoom-in-95 duration-200">

                        {/* Modal Header */}
                        <div className="flex items-center justify-between px-4 py-3 bg-white/[0.02] border-b border-white/5 shrink-0 relative z-10 shadow-sm">
                            <input
                                type="text"
                                value={selectedNote.title}
                                onChange={(e) => handleUpdateNote({ ...selectedNote, title: e.target.value })}
                                placeholder="Note Title Here..."
                                className="bg-transparent text-lg font-bold text-white outline-none w-full mr-4 placeholder:text-white/10 tracking-tight"
                            />

                            <div className="flex items-center gap-1">
                                {isSaving ? (
                                    <div className="flex items-center gap-1.5 bg-white/5 px-2 py-1 rounded border border-white/10">
                                        <span className="text-white/40 text-[9px] font-bold uppercase tracking-widest whitespace-nowrap">Saving</span>
                                        <div className="w-1.5 h-1.5 rounded-full bg-emerald-500/50 animate-pulse" />
                                    </div>
                                ) : (
                                    <div className="flex items-center gap-1.5 bg-white/5 px-2 py-1 rounded border border-white/10">
                                        <span className="text-white/40 text-[9px] font-bold uppercase tracking-widest whitespace-nowrap">Saved</span>
                                        <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]" />
                                    </div>
                                )}
                                <button
                                    onClick={() => setIsModalOpen(false)}
                                    className="p-1.5 hover:bg-white/10 rounded-lg transition-colors shrink-0 group flex items-center justify-center mr-2"
                                >
                                    <img src={closeIcon} alt="Close" className="w-4 h-4 filter brightness-0 invert opacity-50 group-hover:opacity-100 transition-opacity" />
                                </button>
                            </div>
                        </div>

                        {/* Fields Container */}
                        <div className="flex-grow overflow-y-auto p-2 sm:p-4 flex flex-col gap-3 custom-scrollbar bg-gradient-to-b from-transparent to-black/40">
                            {(selectedNote.fields || []).map((field, index) => (
                                <div key={field.id} className="relative group flex flex-col gap-2 bg-white/[0.03] hover:bg-white/[0.05] focus-within:bg-white/[0.06] p-3 pl-10 rounded-lg border border-white/5 focus-within:border-white/20 transition-all shadow-sm">
                                    <div className="absolute left-2 top-3 flex flex-col items-center justify-center bg-black/50 rounded w-6 h-6 shrink-0 border border-white/5 shadow-inner">
                                        <span className="text-white/40 text-[10px] font-bold">{index + 1}</span>
                                    </div>
                                    <input
                                        type="text"
                                        value={field.title || ''}
                                        onChange={(e) => updateFieldTitle(field.id, e.target.value)}
                                        placeholder={`Field ${index + 1} Title (Optional)`}
                                        className="w-full bg-transparent text-white/80 font-bold outline-none text-[12px] placeholder:text-white/30 border-b border-white/5 focus:border-white/20 pb-1.5 pr-8 transition-colors"
                                    />
                                    <textarea
                                        value={field.value}
                                        onChange={(e) => updateField(field.id, e.target.value)}
                                        placeholder={`Field ${index + 1} content...`}
                                        rows={Math.max(1, field.value.split('\n').length)}
                                        className="w-full bg-transparent text-white/90 py-1 outline-none resize-none min-h-[30px] font-sans placeholder:text-white/20 leading-relaxed text-[13px] pr-8"
                                        style={{ overflow: 'hidden' }}
                                    />
                                    <button
                                        onClick={() => deleteField(field.id)}
                                        className="absolute right-2 top-3 p-1.5 bg-red-500/10 hover:bg-red-500 text-red-500 hover:text-white rounded flex items-center justify-center opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-all z-10"
                                        title="Remove Field"
                                    >
                                        <img src={trashIcon} alt="Remove" className="w-3 h-3 filter brightness-0 invert opacity-100" />
                                    </button>
                                </div>
                            ))}

                            <button
                                onClick={addField}
                                className="mt-2 flex items-center justify-center gap-2 w-full py-3 bg-white/[0.02] border border-dashed border-white/10 rounded-lg text-white/40 hover:text-white/80 hover:border-white/30 hover:bg-white/5 transition-all font-bold tracking-widest uppercase text-[10px] cursor-pointer shadow-sm group"
                            >
                                <img src={plusIcon} alt="Add" className="w-3 h-3 filter brightness-0 invert opacity-50 group-hover:opacity-100 transition-all group-hover:rotate-90" />
                                Add Field Below
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Title Prompt Modal */}
            {isTitleModalOpen && (
                <div className="fixed inset-0 z-[210] flex items-center justify-center p-4 h-screen">
                    <div
                        className="absolute inset-0 bg-black/60 backdrop-blur-md transition-opacity"
                        onClick={() => setIsTitleModalOpen(false)}
                    ></div>

                    <div className="relative w-full max-w-md bg-[#111] border border-white/10 rounded-xl shadow-2xl p-6 flex flex-col gap-4 animate-in fade-in zoom-in-95 duration-200">
                        <div className="flex items-center justify-between">
                            <h2 className="text-lg font-bold text-white/90 tracking-wide">Create New Note</h2>
                            <button onClick={() => setIsTitleModalOpen(false)} className="p-1.5 hover:bg-white/10 rounded-lg transition-colors">
                                <img src={closeIcon} alt="Close" className="w-4 h-4 filter brightness-0 invert opacity-50 hover:opacity-100 transition-opacity" />
                            </button>
                        </div>
                        <form onSubmit={handleCreateNote} className="flex flex-col gap-5 mt-2">
                            <input
                                autoFocus
                                type="text"
                                value={newNoteTitle}
                                onChange={(e) => setNewNoteTitle(e.target.value)}
                                placeholder="Enter note title..."
                                className="w-full bg-black/50 border border-white/10 rounded-lg px-4 py-3 text-[13px] text-white outline-none focus:border-emerald-500/50 transition-colors shadow-inner"
                            />
                            <div className="flex justify-end gap-3 mt-1">
                                <button
                                    type="button"
                                    onClick={() => setIsTitleModalOpen(false)}
                                    className="px-4 py-2 rounded-lg text-xs font-bold text-white/50 hover:text-white hover:bg-white/5 transition-all uppercase tracking-widest"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    className="px-5 py-2 rounded-lg text-xs font-bold bg-emerald-500 hover:bg-emerald-400 text-black transition-all shadow-[0_0_10px_rgba(16,185,129,0.3)] hover:shadow-[0_0_15px_rgba(16,185,129,0.5)] uppercase tracking-widest"
                                >
                                    Create
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Notes;
