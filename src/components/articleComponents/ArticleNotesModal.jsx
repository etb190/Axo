import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import BookOpenIcon from '../../assets/icons/book.svg';
import CloseIcon from '../../assets/icons/close.svg';
import SyncIcon from '../../assets/icons/clock.svg';
import EditIcon from '../../assets/icons/edit.svg';
import TrashIcon from '../../assets/icons/delete.svg';
import { useData } from '../../contexts/DataContext';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Underline from '@tiptap/extension-underline';
import Placeholder from '@tiptap/extension-placeholder';
import TextAlign from '@tiptap/extension-text-align';
import Typography from '@tiptap/extension-typography';
import CodeBlockLowlight from '@tiptap/extension-code-block-lowlight';
import { common, createLowlight } from 'lowlight';
import { useMemo } from 'react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

// Helper for conditional classes
function cn(...inputs) {
  return twMerge(clsx(inputs));
}

// Icons for the editor
import boldIcon from '../../assets/icons/bold.svg';
import italicIcon from '../../assets/icons/italic.svg';
import underlineIcon from '../../assets/icons/underline.svg';
import strikethroughIcon from '../../assets/icons/strikethrough.svg';
import heading1Icon from '../../assets/icons/heading1.svg';
import heading2Icon from '../../assets/icons/heading2.svg';
import listIcon from '../../assets/icons/list.svg';
import listOrderedIcon from '../../assets/icons/list-ordered.svg';
import quoteIcon from '../../assets/icons/quote.svg';
import alignLeftIcon from '../../assets/icons/align-left.svg';
import alignCenterIcon from '../../assets/icons/align-center.svg';
import alignRightIcon from '../../assets/icons/align-right.svg';
import codeIcon from '../../assets/icons/hash.svg';

const path = window.require('path');
const fs = window.require('fs');

const NOTES_FOLDER = 'C:\\Users\\PC\\Desktop\\database\\Articles\\Notes';

if (!fs.existsSync(NOTES_FOLDER)) {
  try {
    fs.mkdirSync(NOTES_FOLDER, { recursive: true });
  } catch (err) {
    console.error('Error creating notes folder:', err);
  }
}

const HighlightedText = ({ text, highlight }) => {
  if (!highlight.trim()) return text;
  const escapedHighlight = highlight.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const parts = text.split(new RegExp(`(${escapedHighlight})`, 'gi'));
  return (
    <>
      {parts.map((part, i) =>
        part.toLowerCase() === highlight.toLowerCase() ? (
          <mark key={i} className="bg-emerald-500/30 text-emerald-200 rounded-[2px] px-0.5 border-b border-emerald-500/50">
            {part}
          </mark>
        ) : (
          part
        )
      )}
    </>
  );
};

const checkArabic = (text) => {
  const arabicRegex = /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF]/;
  return arabicRegex.test(text);
};

const MenuBar = ({ editor }) => {
  if (!editor) {
    return null;
  }

  const btnClass = (active, disabled = false) => `
    p-1 rounded-md hover:bg-zinc-800 transition-all cursor-pointer flex items-center justify-center
    ${active ? 'bg-zinc-800 text-white' : 'text-zinc-500 opacity-60 hover:opacity-100'}
    ${disabled ? 'cursor-not-allowed opacity-20' : ''}
  `;

  const iconStyle = (active) => ({
    width: '12px',
    height: '12px',
    filter: active ? 'brightness(0) invert(1)' : 'brightness(0) invert(1) opacity(0.6)'
  });

  return (
    <div className="flex flex-wrap items-center justify-center gap-0.5 p-1 bg-zinc-950/60 border-b border-zinc-800/40 sticky top-0 z-20 backdrop-blur-sm rounded-t-2xl">
      <button onClick={() => editor.chain().focus().toggleBold().run()} disabled={!editor.can().chain().focus().toggleBold().run()} className={btnClass(editor.isActive('bold'))} title="Bold">
        <img src={boldIcon} style={iconStyle(editor.isActive('bold'))} />
      </button>
      <button onClick={() => editor.chain().focus().toggleItalic().run()} disabled={!editor.can().chain().focus().toggleItalic().run()} className={btnClass(editor.isActive('italic'))} title="Italic">
        <img src={italicIcon} style={iconStyle(editor.isActive('italic'))} />
      </button>
      <button onClick={() => editor.chain().focus().toggleUnderline().run()} disabled={!editor.can().chain().focus().toggleUnderline().run()} className={btnClass(editor.isActive('underline'))} title="Underline">
        <img src={underlineIcon} style={iconStyle(editor.isActive('underline'))} />
      </button>
      <button onClick={() => editor.chain().focus().toggleStrike().run()} disabled={!editor.can().chain().focus().toggleStrike().run()} className={btnClass(editor.isActive('strike'))} title="Strike">
        <img src={strikethroughIcon} style={iconStyle(editor.isActive('strike'))} />
      </button>

      <div className="w-px h-3 bg-zinc-800 mx-0.5"></div>

      <button onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()} className={btnClass(editor.isActive('heading', { level: 1 }))} title="H1">
        <img src={heading1Icon} style={iconStyle(editor.isActive('heading', { level: 1 }))} />
      </button>
      <button onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()} className={btnClass(editor.isActive('heading', { level: 2 }))} title="H2">
        <img src={heading2Icon} style={iconStyle(editor.isActive('heading', { level: 2 }))} />
      </button>

      <div className="w-px h-3 bg-zinc-800 mx-0.5"></div>

      <button onClick={() => editor.chain().focus().toggleBulletList().run()} className={btnClass(editor.isActive('bulletList'))} title="Bullet List">
        <img src={listIcon} style={iconStyle(editor.isActive('bulletList'))} />
      </button>
      <button onClick={() => editor.chain().focus().toggleOrderedList().run()} className={btnClass(editor.isActive('orderedList'))} title="Ordered List">
        <img src={listOrderedIcon} style={iconStyle(editor.isActive('orderedList'))} />
      </button>
      <button onClick={() => editor.chain().focus().toggleBlockquote().run()} className={btnClass(editor.isActive('blockquote'))} title="Blockquote">
        <img src={quoteIcon} style={iconStyle(editor.isActive('blockquote'))} />
      </button>

      <div className="w-px h-3 bg-zinc-800 mx-0.5"></div>

      <button onClick={() => editor.chain().focus().toggleCodeBlock().run()} className={btnClass(editor.isActive('codeBlock'))} title="Code Block">
        <img src={codeIcon} style={iconStyle(editor.isActive('codeBlock'))} />
      </button>
      <button onClick={() => editor.chain().focus().toggleCode().run()} className={btnClass(editor.isActive('code'))} title="Inline Code">
        <img src={codeIcon} style={iconStyle(editor.isActive('code'))} />
      </button>

      <div className="w-px h-3 bg-zinc-800 mx-0.5"></div>

      <button onClick={() => editor.chain().focus().setTextAlign('left').run()} className={btnClass(editor.isActive({ textAlign: 'left' }))} title="Left">
        <img src={alignLeftIcon} style={iconStyle(editor.isActive({ textAlign: 'left' }))} />
      </button>
      <button onClick={() => editor.chain().focus().setTextAlign('center').run()} className={btnClass(editor.isActive({ textAlign: 'center' }))} title="Center">
        <img src={alignCenterIcon} style={iconStyle(editor.isActive({ textAlign: 'center' }))} />
      </button>
      <button onClick={() => editor.chain().focus().setTextAlign('right').run()} className={btnClass(editor.isActive({ textAlign: 'right' }))} title="Right">
        <img src={alignRightIcon} style={iconStyle(editor.isActive({ textAlign: 'right' }))} />
      </button>
    </div>
  );
};

const ArticleNotesModal = ({ articlePath, articleName, onClose, initialStartPage = '', initialEndPage = '', filterStartPage = null, filterEndPage = null }) => {
  const { refreshData } = useData();
  const modalRef = useRef(null);
  const scrollContainerRef = useRef(null);
  const [notes, setNotes] = useState([]);
  const [newNote, setNewNote] = useState('');
  const [startPage, setStartPage] = useState(initialStartPage.toString());
  const [endPage, setEndPage] = useState(initialEndPage.toString());
  const [editingId, setEditingId] = useState(null);
  const [editContent, setEditContent] = useState('');
  const [editStartPage, setEditStartPage] = useState('');
  const [editEndPage, setEditEndPage] = useState('');
  const [activeTab, setActiveTab] = useState('general'); // 'general' or 'main'
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  const notesFilePath = path.join(NOTES_FOLDER, `${path.basename(articlePath, '.pdf')}.json`);

  const isInRange = (note) => {
    if (!filterStartPage || !filterEndPage) return true;
    if (!note.startPage) return false;
    const noteStart = parseInt(note.startPage);
    const filterStart = parseInt(filterStartPage);
    const filterEnd = parseInt(filterEndPage);
    return !isNaN(noteStart) && noteStart >= filterStart && noteStart <= filterEnd;
  };

  const lowlight = useMemo(() => createLowlight(common), []);

  const editorConfig = (content, onUpdate) => ({
    extensions: [
      StarterKit.configure({ codeBlock: false }),
      CodeBlockLowlight.configure({ lowlight }),
      Underline,
      Typography,
      TextAlign.configure({ types: ['heading', 'paragraph'] }),
      Placeholder.configure({ placeholder: 'Record strategic insight...' }),
    ],
    content,
    onUpdate: ({ editor }) => onUpdate(editor.getHTML()),
    editorProps: {
      attributes: {
        class: 'prose prose-sm dark:prose-invert max-w-none focus:outline-none min-h-[100px] p-2 text-white font-medium leading-tight custom-scrollbar bg-transparent prose-p:my-0 prose-headings:my-1 prose-ul:my-0 prose-ol:my-0 prose-li:my-0',
      },
      handleTextInput(view, from, to, text) {
        if (text.length !== 1 || !/[a-z]/.test(text)) return false;
        const { state, dispatch } = view;
        const { selection } = state;
        const $pos = selection.$from;
        const isStartOfBlock = $pos.parentOffset === 0;
        let isAfterSentenceEnd = false;
        if (!isStartOfBlock) {
          const textBefore = $pos.parent.textContent.slice(0, $pos.parentOffset);
          if (/[.!?]\s+$/.test(textBefore)) isAfterSentenceEnd = true;
        }
        if (isStartOfBlock || isAfterSentenceEnd) {
          const tr = state.tr.insertText(text.toUpperCase(), from, to);
          dispatch(tr);
          return true;
        }
        return false;
      }
    }
  });

  const mainEditor = useEditor(editorConfig(newNote, (html) => setNewNote(html)));

  const editEditor = useEditor({
    ...editorConfig(editContent, (html) => setEditContent(html)),
    autofocus: 'end',
  }, [editingId]);

  useEffect(() => {
    if (editingId && editEditor) {
      const note = notes.find(n => n.id === editingId);
      if (note) {
        editEditor.commands.setContent(note.content);
      }
    }
  }, [editingId, editEditor, notes]);

  useEffect(() => {
    if (mainEditor && newNote === '') {
      mainEditor.commands.setContent('');
    }
  }, [newNote, mainEditor]);

  useEffect(() => {
    const loadNotes = () => {
      try {
        if (fs.existsSync(notesFilePath)) {
          const data = fs.readFileSync(notesFilePath, 'utf8');
          const parsed = JSON.parse(data);
          setNotes(parsed.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp)));
        } else {
          setNotes([]);
        }
      } catch (err) {
        console.error('Error loading notes:', err);
        setNotes([]);
      } finally {
        setLoading(false);
      }
    };

    loadNotes();
  }, [notesFilePath]);

  const saveNotes = (updatedNotes) => {
    try {
      fs.writeFileSync(notesFilePath, JSON.stringify(updatedNotes, null, 2));
      setNotes(updatedNotes.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp)));
      refreshData();
    } catch (err) {
      console.error('Error saving notes:', err);
    }
  };

  const handleCreateNote = () => {
    if (!newNote.trim()) return;

    const note = {
      id: Date.now().toString(),
      content: newNote.trim(),
      startPage: startPage.trim(),
      endPage: endPage.trim(),
      type: activeTab,
      timestamp: new Date().toISOString(),
    };

    const updated = [note, ...notes];
    saveNotes(updated);
    setNewNote('');
    if (mainEditor) mainEditor.commands.setContent('');
    setStartPage('');
    setEndPage('');
  };

  const startEdit = (note) => {
    setEditingId(note.id);
    setEditContent(note.content);
    setEditStartPage(note.startPage || '');
    setEditEndPage(note.endPage || '');
  };

  const saveEdit = (id) => {
    if (!editContent.trim()) return;

    const updated = notes.map(n =>
      n.id === id ? {
        ...n,
        content: editContent.trim(),
        startPage: editStartPage.trim(),
        endPage: editEndPage.trim()
      } : n
    );
    saveNotes(updated);
    setEditingId(null);
    setEditContent('');
    setEditStartPage('');
    setEditEndPage('');
  };

  const deleteNote = (id) => {
    const updated = notes.filter(n => n.id !== id);
    saveNotes(updated);
    if (updated.length === 0 && fs.existsSync(notesFilePath)) {
      try { fs.unlinkSync(notesFilePath); } catch {}
    }
    refreshData();
  };

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (modalRef.current && !modalRef.current.contains(e.target)) {
        onClose();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [onClose]);

  useEffect(() => {
    const element = scrollContainerRef.current;
    if (!element) return;

    let targetScrollTop = element.scrollTop;
    let currentScrollTop = element.scrollTop;
    let animationFrameId = null;

    const smoothScroll = () => {
      const diff = targetScrollTop - currentScrollTop;
      if (Math.abs(diff) > 0.1) {
        currentScrollTop += diff * 0.12;
        element.scrollTop = currentScrollTop;
        animationFrameId = requestAnimationFrame(smoothScroll);
      } else {
        currentScrollTop = targetScrollTop;
        element.scrollTop = currentScrollTop;
        animationFrameId = null;
      }
    };

    const handleWheel = (e) => {
      e.preventDefault();
      const maxScroll = element.scrollHeight - element.clientHeight;
      targetScrollTop = Math.max(0, Math.min(maxScroll, targetScrollTop + e.deltaY * 0.4));

      if (!animationFrameId) {
        animationFrameId = requestAnimationFrame(smoothScroll);
      }
    };

    element.addEventListener('wheel', handleWheel, { passive: false });
    return () => {
      element.removeEventListener('wheel', handleWheel);
      if (animationFrameId) cancelAnimationFrame(animationFrameId);
    };
  }, []);

  const formatDate = (iso) => {
    return new Date(iso).toLocaleDateString();
  };

  return createPortal(
    <div className="fixed inset-0 z-[300] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-300">
      <div
        ref={modalRef}
        className="bg-zinc-950 border border-zinc-800 rounded-xl w-full max-w-[500px] h-[80vh] max-h-[700px] flex flex-col shadow-2xl animate-in slide-in-from-bottom-2 duration-300 overflow-hidden"
      >
        <div className="px-6 py-2 border-b border-zinc-900/50 flex justify-between items-center shrink-0 bg-zinc-950/40">
          <h2 className="text-xs font-black text-white flex items-center gap-2 tracking-tighter uppercase italic">
            <img src={BookOpenIcon} className="w-3 h-3 invert contrast-150" style={{ filter: 'invert(75%) sepia(65%) saturate(384%) hue-rotate(92deg) brightness(98%) contrast(93%)' }} />
            <p className="truncate max-w-[200px]">
              {articleName}
            </p>
          </h2>

          <div className="flex items-center gap-4">
            <div className="flex items-center bg-zinc-900/50 rounded-lg border border-zinc-800/50 px-2 transition-all focus-within:border-emerald-500/40">
              <svg className="w-3 h-3 text-zinc-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search notes..."
                className="bg-transparent border-none text-[9px] font-black uppercase tracking-wider text-white p-1.5 focus:outline-none w-24 focus:w-40 transition-all placeholder:text-zinc-700"
              />
            </div>
            <div className="flex bg-zinc-900/50 p-1 rounded-lg border border-zinc-800/50">
              <button
                onClick={() => setActiveTab('general')}
                className={`px-3 py-1 rounded-md text-[9px] font-black uppercase tracking-wider transition-all ${activeTab === 'general'
                  ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-900/40'
                  : 'text-zinc-500 hover:text-zinc-300'
                  }`}
              >
                General
              </button>
              <button
                onClick={() => setActiveTab('main')}
                className={`px-3 py-1 rounded-md text-[9px] font-black uppercase tracking-wider transition-all ${activeTab === 'main'
                  ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-900/40'
                  : 'text-zinc-500 hover:text-zinc-300'
                  }`}
              >
                Main
              </button>
            </div>
            <button
              onClick={onClose}
              className="text-zinc-500 hover:text-white transition-all w-8 h-8 rounded-lg hover:bg-zinc-900 border border-transparent hover:border-zinc-800 flex items-center justify-center active:scale-95 cursor-pointer"
            >
              <img src={CloseIcon} className="w-2.5 h-2.5 opacity-50 invert brightness-0" style={{ filter: 'brightness(0) invert(1)' }} />
            </button>
          </div>
        </div>

        <div
          ref={scrollContainerRef}
          className="flex-1 overflow-y-auto p-6 custom-scrollbar bg-zinc-950/10 space-y-8"
        >
          <div className="bg-zinc-900/30 border border-zinc-800/20 rounded-2xl overflow-hidden focus-within:border-emerald-500/40 transition-all shadow-2xl flex flex-col group">
            <MenuBar editor={mainEditor} />
            <div className="journal-editor-content book-note-editor w-full">
              <EditorContent editor={mainEditor} className="w-full" />
            </div>
            <div className="flex bg-zinc-950/20 border-t border-zinc-800/10">
              <div className="flex-1 flex border-r border-zinc-800/10">
                <input
                  type="number"
                  value={startPage}
                  onChange={(e) => setStartPage(e.target.value)}
                  placeholder="Start Page"
                  className="w-1/2 bg-transparent text-white p-3 px-6 focus:outline-none text-[10px] font-bold uppercase tracking-widest border-r border-zinc-800/10 placeholder:text-zinc-800 rounded-md"
                />
                <input
                  type="number"
                  value={endPage}
                  onChange={(e) => setEndPage(e.target.value)}
                  placeholder="End Page "
                  className="w-1/2 bg-transparent text-white p-3 px-6 focus:outline-none text-[10px] font-bold uppercase tracking-widest placeholder:text-zinc-800 rounded-md"
                />
              </div>
              <div className="p-2 px-4 flex items-center bg-zinc-950/40">
                <button
                  onClick={handleCreateNote}
                  disabled={!newNote.trim()}
                  className={`px-6 py-2 rounded-xl font-black text-[10px] uppercase tracking-[0.2em] transition-all duration-300 active:scale-95 cursor-pointer shadow-lg ${newNote.trim()
                    ? 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-900/40'
                    : 'bg-zinc-900/50 text-zinc-700 cursor-not-allowed border border-zinc-800/30'
                    }`}
                >
                  Log Entry
                </button>
              </div>
            </div>
          </div>

          {loading ? (
            <div className="flex flex-col items-center justify-center py-10 text-zinc-800">
              <img src={SyncIcon} className="w-5 h-5 mb-4 opacity-50 animate-spin invert brightness-0" style={{ filter: 'brightness(0) invert(1)' }} />
              <p className="text-[9px] font-bold uppercase tracking-widest text-zinc-700">Synchronizing...</p>
            </div>
          ) : notes.filter(n => isInRange(n) && (n.type || 'general') === activeTab && (searchQuery.trim() === '' || n.content.toLowerCase().includes(searchQuery.toLowerCase()))).length === 0 ? (
            <div className="p-4 rounded-xl border border-zinc-900 border-dashed text-center">
              <p className="text-[10px] text-zinc-700 font-bold uppercase tracking-widest">
                {searchQuery.trim() !== '' ? `No matches found for "${searchQuery}"` : `No ${activeTab} entries recorded in this section`}
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {notes.filter(n => isInRange(n) && (n.type || 'general') === activeTab && (searchQuery.trim() === '' || n.content.toLowerCase().includes(searchQuery.toLowerCase()))).map((note) => (
                <div
                  key={note.id}
                  className={cn(
                    "bg-zinc-900/50 border border-zinc-800/50 rounded-2xl hover:border-emerald-500/50 hover:bg-zinc-800/80 transition-all group relative overflow-hidden shadow-sm active:scale-[0.98]",
                    editingId === note.id ? "" : "p-3"
                  )}
                >
                  {editingId === note.id ? (
                    <div className="flex flex-col w-full">
                      <div className="bg-zinc-900 border-b border-zinc-800 overflow-hidden w-full">
                        <MenuBar editor={editEditor} />
                        <div className="journal-editor-content book-note-editor w-full px-2">
                          <EditorContent editor={editEditor} className="w-full" />
                        </div>
                      </div>
                      
                      <div className="p-3 bg-zinc-950/20 flex items-center gap-3">
                        <div className="flex-1 flex gap-2">
                          <input
                            type="number"
                            value={editStartPage}
                            onChange={(e) => setEditStartPage(e.target.value)}
                            placeholder="P. START"
                            className="w-20 bg-zinc-900 border border-zinc-800 text-white text-[9px] font-black uppercase p-1.5 px-3 rounded-md outline-none focus:ring-1 focus:ring-emerald-500 placeholder:text-zinc-700"
                          />
                          <input
                            type="number"
                            value={editEndPage}
                            onChange={(e) => setEditEndPage(e.target.value)}
                            placeholder="P. END"
                            className="w-20 bg-zinc-900 border border-zinc-800 text-white text-[9px] font-black uppercase p-1.5 px-3 rounded-md outline-none focus:ring-1 focus:ring-emerald-500 placeholder:text-zinc-700"
                          />
                        </div>
                        
                        <div className="flex gap-2 shrink-0">
                          <button
                            onClick={() => {
                              setEditingId(null);
                              setEditContent('');
                              setEditStartPage('');
                              setEditEndPage('');
                            }}
                            className="px-4 py-2 text-zinc-500 hover:text-zinc-300 text-[10px] font-black uppercase tracking-wider rounded-xl transition-all cursor-pointer"
                          >
                            Cancel
                          </button>
                          <button
                            onClick={() => saveEdit(note.id)}
                            className="px-6 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-black text-[10px] uppercase tracking-widest transition-all shadow-lg active:scale-95 cursor-pointer shadow-emerald-900/20"
                          >
                            Save
                          </button>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div>
                      <div className="flex justify-between items-start relative z-10">
                        <div className="flex-1 pr-2">
                          <div
                            dir={checkArabic(note.content) ? 'rtl' : 'ltr'}
                            className={`journal-editor-content text-sm text-zinc-300 leading-relaxed font-medium group-hover:text-white transition-colors ${checkArabic(note.content) ? 'text-right' : 'text-justify'}`}
                            dangerouslySetInnerHTML={{ __html: note.content }}
                          />
                        </div>
                        <div className="absolute top-0 right-0 flex gap-1 opacity-0 group-hover:opacity-100 transition-all translate-x-2 group-hover:translate-x-0">
                          <button
                            onClick={() => startEdit(note)}
                            className="w-8 h-8 flex items-center justify-center hover:bg-emerald-600/10 rounded-lg transition-all text-zinc-600 hover:text-emerald-500"
                            title="Edit"
                          >
                            <img src={EditIcon} className="w-3 h-3 opacity-50 group-hover:opacity-100 invert brightness-0" style={{ filter: 'brightness(0) invert(1)' }} />
                          </button>
                          <button
                            onClick={() => deleteNote(note.id)}
                            className="w-8 h-8 flex items-center justify-center hover:bg-red-500/10 rounded-lg transition-all text-zinc-600 hover:text-red-500"
                            title="Delete"
                          >
                            <img src={TrashIcon} className="w-3 h-3 opacity-50 group-hover:opacity-100" style={{ filter: 'invert(40%) sepia(91%) saturate(3015%) hue-rotate(338deg) brightness(101%) contrast(106%)' }} />
                          </button>
                        </div>
                      </div>
                      <div className="mt-2 pt-2 border-t border-zinc-800/20 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="text-[9px] text-zinc-700 font-bold uppercase tracking-tighter">
                            ID: {note.id.slice(0, 6)}
                          </span>
                          {(note.startPage || note.endPage) && (
                            <span className="px-2 py-0.5 rounded bg-emerald-600/10 text-emerald-500 text-[9px] font-black uppercase tracking-widest border border-emerald-500/10">
                              {note.endPage && note.endPage !== note.startPage ? `pp. ${note.startPage}-${note.endPage}` : `p. ${note.startPage}`}
                            </span>
                          )}
                        </div>
                        <span className="text-[8px] text-zinc-700 font-bold uppercase">
                          {formatDate(note.timestamp)}
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        <style>{`
          .book-note-editor .ProseMirror {
            min-height: 120px;
            width: 100%;
          }
          .book-note-editor {
            width: 100%;
            display: flex;
            flex-direction: column;
          }
          .journal-editor-content .ProseMirror pre {
            background: #1e1e1e;
            color: #d4d4d4;
            font-family: 'JetBrains Mono', 'Fira Code', 'Courier New', monospace;
            padding: 0.5rem 0.75rem;
            border-radius: 0.75rem;
            margin: 0.5rem 0 !important;
            font-size: 0.75rem;
          }
          .journal-editor-content .ProseMirror pre code {
            color: inherit;
            padding: 0;
            background: none;
          }
          .journal-editor-content .ProseMirror code {
            background-color: rgba(110, 118, 129, 0.4);
            padding: 0.1em 0.3em;
            border-radius: 6px;
            font-size: 85%;
            font-family: ui-monospace, SFMono-Regular, SF Mono, Menlo, Consolas, Liberation Mono, monospace;
          }
          .journal-editor-content p { margin: 0 !important; line-height: 1.25 !important; }
          .journal-editor-content blockquote {
            border-left: 2px solid #10b981;
            padding-left: 1rem;
            font-style: italic;
            color: #94a3b8;
            margin: 0.5rem 0;
          }
          .journal-editor-content ul, 
          .journal-editor-content ol {
            padding-left: 0 !important;
            margin: 0.25rem 0 !important;
            list-style: none !important;
          }
          .journal-editor-content li {
            display: flex !important;
            align-items: baseline !important;
            gap: 0.4rem !important;
            margin-bottom: 0.1rem !important;
            line-height: 1.25 !important;
          }
          .journal-editor-content ul li::before {
            content: '•';
            color: #10b981;
            font-weight: bold;
            flex-shrink: 0;
          }
          .journal-editor-content ol {
            counter-reset: item;
          }
          .journal-editor-content ol li::before {
            counter-increment: item;
            content: counter(item) '.';
            color: #10b981;
            font-weight: bold;
            font-size: 0.85em;
            flex-shrink: 0;
            min-width: 1em;
          }
          .journal-editor-content li p,
          .journal-editor-content li div {
            display: inline !important;
            margin: 0 !important;
          }
          .journal-editor-content li p {
            display: inline !important;
            margin: 0 !important;
            line-height: inherit !important;
          }
          .journal-editor-content .ProseMirror ul, 
          .journal-editor-content .ProseMirror ol {
            margin-top: 0.25rem !important;
            margin-bottom: 0.25rem !important;
          }
          .hljs-comment, .hljs-quote { color: #6a9955; font-style: italic; }
          .hljs-keyword, .hljs-selector-tag, .hljs-literal, .hljs-section { color: #569cd6; }
          .hljs-string, .hljs-doctag, .hljs-type { color: #ce9178; }
          .hljs-number, .hljs-deletion, .hljs-attr { color: #b5cea8; }
          .hljs-function, .hljs-title { color: #dcdcaa; }
          .hljs-variable, .hljs-template-variable, .hljs-tag, .hljs-name, .hljs-selector-id, .hljs-selector-class, .hljs-regexp { color: #9cdcfe; }
          .hljs-symbol, .hljs-bullet, .hljs-link, .hljs-meta, .hljs-selector-attr, .hljs-selector-pseudo { color: #c586c0; }
          .hljs-built_in, .hljs-class { color: #4ec9b0; }
          .hljs-params { color: #9cdcfe; }
          .hljs-addition { color: #b5cea8; }
          .hljs-emphasis { font-style: italic; }
          .hljs-strong { font-weight: bold; }
        `}</style>

        <div className="px-5 py-4 border-t border-zinc-900/50 flex justify-end bg-black/20 shrink-0">
          <button
            onClick={onClose}
            className="px-6 py-2 bg-zinc-800 hover:bg-zinc-700 text-white rounded-lg font-bold text-[10px] uppercase tracking-wider transition-all shadow-sm active:scale-95 cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
};

export default ArticleNotesModal;
