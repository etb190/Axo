import React, { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import { Play, Pause, SkipBack, SkipForward, Music, List, Search, Heart, Share2, Repeat, Shuffle, ArrowDownUp, Copy, Move, Trash2, FolderPlus, Check, X, AlertTriangle, Target } from 'lucide-react';
import Navbar from './Navbar';
import { useMusic } from '../contexts/MusicContext';
import { SongItem, PlaylistItem, VirtualLibrary } from './musicComponents/MusicLibraryItems';

const MusicPlayer = () => {
    const {
        songs,
        playlists,
        playingSongs,
        playingIndex,
        isPlaying,
        progress,
        currentTime,
        duration,
        isShuffle,
        repeatMode,
        currentSong,
        selectedSongs,
        handleSelect,
        clearSelection,
        moveSongs,
        copySongs,
        deleteSongs,
        playSong,
        togglePlay,
        nextSong,
        prevSong,
        toggleShuffle,
        toggleRepeat,
        seek,
        isLibraryLoaded
    } = useMusic();

    const [viewingPlaylist, setViewingPlaylist] = useState(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [isLibraryOpen, setIsLibraryOpen] = useState(false);
    const [deferredLoad, setDeferredLoad] = useState(false);
    const hasInitializedPlaylistView = useRef(false);

    // Keep viewingPlaylist in sync with context playlists (for optimistic updates)
    useEffect(() => {
        if (viewingPlaylist) {
            const updated = playlists.find(pl => pl.name === viewingPlaylist.name);
            if (!updated || updated.songs.length === 0) {
                // Playlist was emptied or removed, go back to library
                setViewingPlaylist(null);
            } else if (updated !== viewingPlaylist) {
                setViewingPlaylist(updated);
            }
        }
    }, [playlists]);

    // Initialize view to the currently playing song's playlist when opened/refreshed
    useEffect(() => {
        if (!hasInitializedPlaylistView.current && isLibraryLoaded) {
            if (currentSong && playlists.length > 0 && playingSongs.length > 0) {
                const activePlaylist = playlists.find(pl => 
                    pl.songs.length === playingSongs.length &&
                    pl.songs.some(s => s.path === currentSong.path)
                );
                if (activePlaylist) {
                    setViewingPlaylist(activePlaylist);
                }
            }
            hasInitializedPlaylistView.current = true;
        }
    }, [isLibraryLoaded, currentSong, playlists, playingSongs]);

    // Context Menu & Selector State
    const [contextMenu, setContextMenu] = useState(null);
    const [playlistSelector, setPlaylistSelector] = useState(null); // { songs, action: 'move' | 'copy' }
    const [newPlaylistName, setNewPlaylistName] = useState('');
    const [isCreatingNew, setIsCreatingNew] = useState(false);
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

    // Defer heavy list rendering to ensure routing is instant
    useEffect(() => {
        const timer = setTimeout(() => setDeferredLoad(true), 100);
        return () => clearTimeout(timer);
    }, []);

    // Global click listener to deselect "anywhere"
    useEffect(() => {
        const handleGlobalClick = (e) => {
            // Only left clicks
            if (e.button !== 0) return;
            // Don't deselect if holding modifier keys (multi-select mode)
            if (e.ctrlKey || e.metaKey) return;
            // Don't deselect if clicking inside management menus or modals
            if (e.target.closest('.context-menu') || e.target.closest('.playlist-selector') || e.target.closest('.delete-confirm-modal')) return;
            // Don't deselect if clicking a song (SongItem's onClick handles it)
            if (e.target.closest('.music-song-item')) return;

            if (selectedSongs.length > 0) {
                clearSelection();
            }
            setContextMenu(null);
            setPlaylistSelector(null);
        };

        window.addEventListener('mousedown', handleGlobalClick);
        return () => window.removeEventListener('mousedown', handleGlobalClick);
    }, [selectedSongs, clearSelection, setContextMenu, setPlaylistSelector]);

    // Per-playlist sorting persistence
    const [sortOrders, setSortOrders] = useState(() => {
        try {
            const saved = localStorage.getItem('axo_music_sort_preferences');
            return saved ? JSON.parse(saved) : { library: 'a-z' };
        } catch (e) {
            return { library: 'a-z' };
        }
    });

    const currentSortKey = viewingPlaylist ? `playlist-${viewingPlaylist.name}` : 'library';
    const sortOrder = sortOrders[currentSortKey] || 'a-z';

    const handleSortChange = (newOrder) => {
        const updated = { ...sortOrders, [currentSortKey]: newOrder };
        setSortOrders(updated);
        localStorage.setItem('axo_music_sort_preferences', JSON.stringify(updated));
    };

    const activeSongsForView = useMemo(() => {
        return viewingPlaylist
            ? viewingPlaylist.songs
            : [...songs, ...playlists.flatMap(p => p.songs)];
    }, [viewingPlaylist, songs, playlists]);

    const filteredSongs = useMemo(() => {
        if (!deferredLoad && !searchQuery) return []; // Don't compute until deferred load

        return activeSongsForView
            .filter(song =>
                song.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                song.artist.toLowerCase().includes(searchQuery.toLowerCase())
            )
            .sort((a, b) => {
                if (sortOrder === 'newest') {
                    return new Date(b.dateAdded) - new Date(a.dateAdded);
                } else if (sortOrder === 'oldest') {
                    return new Date(a.dateAdded) - new Date(b.dateAdded);
                } else {
                    return a.name.localeCompare(b.name);
                }
            });
    }, [activeSongsForView, searchQuery, sortOrder, deferredLoad]);


    const filteredPlaylists = useMemo(() => {
        return playlists.filter(playlist =>
            playlist.name.toLowerCase().includes(searchQuery.toLowerCase())
        );
    }, [playlists, searchQuery]);

    const formatTime = (time) => {
        if (isNaN(time)) return "0:00";
        const mins = Math.floor(time / 60);
        const secs = Math.floor(time % 60);
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    };

    const handleSeek = (e) => {
        seek(parseFloat(e.target.value));
    };

    const dismissMenu = useCallback(() => setContextMenu(null), []);

    return (
        <div className="flex h-screen bg-black text-white overflow-hidden relative">
            <Navbar />

            {/* Main Content */}
            <div className={`flex-1 flex flex-col items-center justify-center relative overflow-hidden pl-12`}>
                {/* Minimal Background Glow */}
                <div className="absolute top-[-10%] left-[20%] w-[40%] h-[40%] bg-blue-900/10 blur-[100px] rounded-full pointer-events-none" />


                {/* Library Sidebar (Retractable Overlay) */}
                <div
                    onMouseEnter={() => setIsLibraryOpen(true)}
                    onMouseLeave={() => {
                        if (contextMenu || playlistSelector) return;
                        setIsLibraryOpen(false);
                    }}
                    className={`fixed left-12 top-0 h-full bg-black/80 backdrop-blur-2xl border-r border-white/5 z-50 transition-all duration-500 ease-in-out flex flex-col ${isLibraryOpen || contextMenu || playlistSelector ? 'w-72 translate-x-0 opacity-100 shadow-[20px_0_50px_rgba(0,0,0,0.5)]' : 'w-12 -translate-x-10 opacity-0 pointer-events-none'}`}
                >
                    <header className="px-4 py-3 border-b border-white/5 shrink-0 flex items-center gap-2">
                        {(viewingPlaylist || searchQuery) && (
                            <button
                                onClick={() => {
                                    setSearchQuery('');
                                    setViewingPlaylist(null);
                                }}
                                className="w-10 h-10 shrink-0 flex items-center justify-center bg-white/5 border border-white/10 rounded-2xl text-blue-400 hover:text-blue-300 hover:bg-white/10 transition-all cursor-pointer"
                                title={searchQuery ? "Clear Search" : "Back to Library"}
                            >
                                <SkipBack className="w-5 h-5" />
                            </button>
                        )}
                        <div className="flex-1 flex items-center gap-4 bg-white/5 border border-white/10 rounded-2xl px-4 h-10 backdrop-blur-md">
                            <Search className="w-5 h-5 text-gray-400" />
                            <input
                                type="text"
                                placeholder="Search..."
                                className="bg-transparent border-none outline-none text-sm w-full"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                            />
                        </div>
                    </header>

                    <div className="flex-1 flex flex-col pt-0 pb-4 pr-1 pl-1 space-y-1 min-h-0 min-w-0">
                        <div className="flex items-center justify-between pr-1 pl-1 py-1.5 mb-0.5">
                            <div className="flex flex-col min-w-0">
                                <h3 className="text-xl font-bold flex items-center gap-2">
                                    <List className="w-5 h-5 text-blue-400" />
                                    <span className="truncate max-w-[150px]">{viewingPlaylist ? viewingPlaylist.name : 'Library'}</span>
                                </h3>
                                {viewingPlaylist && (
                                    <p className="text-[10px] text-blue-400/60 ml-7 -mt-0.5 font-medium uppercase tracking-wider">
                                        {viewingPlaylist.songs.length} {viewingPlaylist.songs.length === 1 ? 'Song' : 'Songs'}
                                    </p>
                                )}
                            </div>

                            <div className="relative ml-auto">
                                <select
                                    value={sortOrder}
                                    onChange={(e) => handleSortChange(e.target.value)}
                                    className="bg-black/40 border border-white/10 rounded-lg pl-2 pr-6 py-1 text-[10px] text-gray-300 outline-none focus:border-blue-500/50 appearance-none cursor-pointer hover:bg-white/5 transition-colors"
                                >
                                    <option value="a-z" className="bg-neutral-900 text-gray-300">A-Z</option>
                                    <option value="newest" className="bg-neutral-900 text-gray-300">Newest</option>
                                    <option value="oldest" className="bg-neutral-900 text-gray-300">Oldest</option>
                                </select>
                                <ArrowDownUp className="absolute right-2 top-1/2 -translate-y-1/2 w-2.5 h-2.5 text-gray-500 pointer-events-none" />
                            </div>
                        </div>

                        <div className="flex-1 flex flex-col min-h-0 min-w-0">
                            {deferredLoad ? (
                                <VirtualLibrary
                                    viewKey={viewingPlaylist ? `playlist-${viewingPlaylist.name}` : 'library'}
                                    header={!viewingPlaylist && (filteredPlaylists.length > 0 || filteredSongs.length > 0) && (
                                        <div className="shrink-0 mb-1">
                                            {filteredPlaylists.length > 0 && (
                                                <div className="mb-1">
                                                    <p className="text-[10px] uppercase tracking-widest text-gray-500 mb-0.5 pr-1 pl-1">Playlists ({filteredPlaylists.length})</p>
                                                    <div className="space-y-1">
                                                        {filteredPlaylists.map((playlist, idx) => (
                                                            <PlaylistItem
                                                                key={`playlist-${idx}`}
                                                                playlist={playlist}
                                                                onSelect={setViewingPlaylist}
                                                            />
                                                        ))}
                                                    </div>
                                                </div>
                                            )}
                                            {filteredSongs.length > 0 && (
                                                <p className="text-[10px] uppercase tracking-widest text-gray-500 mt-1 pr-1 pl-1">Songs ({filteredSongs.length})</p>
                                            )}
                                        </div>
                                    )}
                                    items={filteredSongs}
                                    onPlay={playSong}
                                    currentSong={currentSong}
                                    selectedSongs={selectedSongs}
                                    onSelect={handleSelect}
                                    onClear={clearSelection}
                                    onDismiss={dismissMenu}
                                    onContextMenu={(e, song) => {
                                        e.preventDefault();
                                        if (!selectedSongs.find(s => s.path === song.path)) {
                                            handleSelect(song, -1, [], false, false);
                                        }
                                        setContextMenu({ x: e.clientX, y: e.clientY });
                                    }}
                                    isPlaying={isPlaying}
                                />

                            ) : (
                                <div className="flex items-center justify-center h-32 text-gray-500 opacity-50">
                                    <div className="w-4 h-4 border-2 border-blue-500/30 border-t-blue-500 rounded-full animate-spin mr-2"></div>
                                    <span className="text-[10px] uppercase tracking-widest">Waking up Library...</span>
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* Context Menu */}
                {contextMenu && (
                    <div
                        className="context-menu fixed z-[100] bg-neutral-900/95 backdrop-blur-2xl border border-white/10 rounded-xl shadow-2xl py-1 w-48 animate-in fade-in zoom-in-95 duration-100"
                        style={{ left: contextMenu.x, top: contextMenu.y }}
                        onMouseLeave={() => setContextMenu(null)}
                    >
                        <button
                            onClick={() => { setPlaylistSelector({ action: 'move' }); setContextMenu(null); }}
                            className="w-full px-4 py-2.5 text-left text-sm hover:bg-white/5 flex items-center gap-3 transition-colors"
                        >
                            <Move className="w-4 h-4 text-blue-400" />
                            <span>Move to Playlist</span>
                        </button>
                        <button
                            onClick={() => { setPlaylistSelector({ action: 'copy' }); setContextMenu(null); }}
                            className="w-full px-4 py-2.5 text-left text-sm hover:bg-white/5 flex items-center gap-3 transition-colors"
                        >
                            <Copy className="w-4 h-4 text-green-400" />
                            <span>Copy to Playlist</span>
                        </button>
                        <div className="my-1 border-t border-white/5" />
                        <button
                            onClick={() => { setShowDeleteConfirm(true); setContextMenu(null); }}
                            className="w-full px-4 py-2.5 text-left text-sm hover:bg-red-500/10 text-red-400 flex items-center gap-3 transition-colors"
                        >
                            <Trash2 className="w-4 h-4" />
                            <span>Delete from Disk</span>
                        </button>
                    </div>
                )}

                {/* Playlist Selector Modal */}
                {playlistSelector && (
                    <div className="playlist-selector fixed inset-0 z-[200] flex items-center justify-center p-4">
                        <div className="absolute inset-0 bg-black/60 backdrop-blur-md" onClick={() => setPlaylistSelector(null)} />
                        <div className="relative bg-neutral-900 border border-white/10 w-full max-w-[320px] rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[70vh]">
                            <header className="px-4 py-3 border-b border-white/5 flex items-center justify-between shrink-0">
                                <div>
                                    <h3 className="text-base font-bold flex items-center gap-2">
                                        {playlistSelector.action === 'move' ? <Move className="w-4 h-4 text-blue-400" /> : <Copy className="w-4 h-4 text-green-400" />}
                                        {playlistSelector.action === 'move' ? 'Move' : 'Copy'} to...
                                    </h3>
                                    <p className="text-[10px] text-gray-500">{selectedSongs.length} items</p>
                                </div>
                                <button onClick={() => setPlaylistSelector(null)} className="p-1.5 hover:bg-white/5 rounded-full transition-colors"><X className="w-4 h-4" /></button>
                            </header>

                            <div className="flex-1 overflow-y-auto p-2 custom-scrollbar playlist-selector-scroll">
                                <div className="grid grid-cols-1 gap-1">
                                    {playlists.map((pl, idx) => (
                                        <button
                                            key={idx}
                                            onClick={() => {
                                                if (playlistSelector.action === 'move') moveSongs(pl.name);
                                                else copySongs(pl.name);
                                                setPlaylistSelector(null);
                                            }}
                                            className="group flex items-center gap-2 p-2 rounded-xl hover:bg-white/5 border border-transparent hover:border-white/10 transition-all text-left"
                                        >
                                            <div className="w-8 h-8 rounded-lg bg-blue-600/10 flex items-center justify-center group-hover:scale-110 transition-transform flex-shrink-0">
                                                <List className="w-4 h-4 text-blue-400" />
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <p className="text-xs font-semibold truncate">{pl.name}</p>
                                                <p className="text-[9px] text-gray-500 uppercase tracking-widest">{pl.songs.length} Songs</p>
                                            </div>
                                            <div className="w-6 h-6 rounded-full bg-white/5 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                                <Check className="w-3 h-3 text-blue-400" />
                                            </div>
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <footer className="p-3 bg-black/20 border-t border-white/5 shrink-0">
                                {isCreatingNew ? (
                                    <div className="flex items-center gap-2">
                                        <input
                                            autoFocus
                                            type="text"
                                            placeholder="Playlist name..."
                                            className="flex-1 bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-xs outline-none focus:border-blue-500/50"
                                            value={newPlaylistName}
                                            onChange={(e) => setNewPlaylistName(e.target.value)}
                                            onKeyDown={(e) => {
                                                if (e.key === 'Enter' && newPlaylistName) {
                                                    if (playlistSelector.action === 'move') moveSongs(newPlaylistName);
                                                    else copySongs(newPlaylistName);
                                                    setPlaylistSelector(null);
                                                    setIsCreatingNew(false);
                                                    setNewPlaylistName('');
                                                }
                                            }}
                                        />
                                        <button
                                            onClick={() => {
                                                if (newPlaylistName) {
                                                    if (playlistSelector.action === 'move') moveSongs(newPlaylistName);
                                                    else copySongs(newPlaylistName);
                                                    setPlaylistSelector(null);
                                                    setIsCreatingNew(false);
                                                    setNewPlaylistName('');
                                                }
                                            }}
                                            className="px-3 py-1.5 bg-blue-600 text-white rounded-lg text-xs font-bold hover:bg-blue-500 transition-colors"
                                        >Create</button>
                                        <button onClick={() => setIsCreatingNew(false)} className="p-1.5 hover:bg-white/5 rounded-lg"><X className="w-3.5 h-3.5" /></button>
                                    </div>
                                ) : (
                                    <button
                                        onClick={() => setIsCreatingNew(true)}
                                        className="w-full py-2 rounded-xl border border-dashed border-white/20 hover:border-blue-500/50 hover:bg-blue-500/5 transition-all flex items-center justify-center gap-2 text-xs font-medium text-gray-400 hover:text-blue-400"
                                    >
                                        <FolderPlus className="w-4 h-4" />
                                        New Playlist
                                    </button>
                                )}
                            </footer>
                        </div>
                    </div>
                )}

                {/* Custom Delete Confirmation Modal */}
                {showDeleteConfirm && (
                    <div className="fixed inset-0 z-[300] flex items-center justify-center p-4 animate-in fade-in duration-200">
                        <div className="absolute inset-0 bg-black/10" onClick={() => setShowDeleteConfirm(false)} />
                        <div className="delete-confirm-modal relative bg-neutral-950/95 backdrop-blur-md border border-white/10 w-full max-w-[280px] rounded-[1.5rem] shadow-[0_20px_40px_rgba(0,0,0,0.8)] overflow-hidden animate-in zoom-in-95 duration-200">
                            <div className="p-5 text-center">
                                <div className="w-12 h-12 bg-red-500/10 rounded-full flex items-center justify-center mx-auto mb-4 border border-red-500/20">
                                    <Trash2 className="w-6 h-6 text-red-500" />
                                </div>
                                <h3 className="text-lg font-bold mb-1 text-white">Delete Items?</h3>
                                <p className="text-gray-400 text-[11px] leading-tight mb-5">
                                    Permanently remove <span className="text-white font-bold">{selectedSongs.length}</span> {selectedSongs.length === 1 ? 'file' : 'files'}?
                                </p>

                                <div className="grid grid-cols-2 gap-2">
                                    <button
                                        onClick={() => setShowDeleteConfirm(false)}
                                        className="py-2.5 px-4 bg-white/5 hover:bg-white/10 text-white rounded-xl text-xs font-bold transition-all border border-white/5 active:scale-95"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        onClick={() => {
                                            deleteSongs();
                                            setShowDeleteConfirm(false);
                                        }}
                                        className="py-2.5 px-4 bg-red-600 hover:bg-red-500 text-white rounded-xl text-xs font-bold transition-all active:scale-95 flex items-center justify-center gap-1.5"
                                    >
                                        Delete
                                    </button>
                                </div>
                            </div>


                        </div>
                    </div>
                )}

                {/* Library Trigger Handle */}
                <div
                    onMouseEnter={() => setIsLibraryOpen(true)}
                    className="fixed left-12 top-0 h-full w-4 z-40 hover:bg-white/5 transition-colors cursor-pointer flex items-center justify-center"
                >
                    <div className="w-1 h-12 rounded-full bg-gray-700/50" />
                </div>

                <div className="flex-1 flex flex-col items-center justify-center w-full max-w-2xl z-10 px-6">
                    <div className="relative group">
                        {/* Compact Disc Visual / Album Art */}
                        <div className={`w-52 h-52 rounded-2xl overflow-hidden bg-gradient-to-br from-gray-900 to-black shadow-2xl flex items-center justify-center relative`}>
                            {currentSong?.thumbnail ? (
                                <img src={currentSong.thumbnail} alt="" className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110" />
                            ) : (
                                <div className="w-full h-full flex items-center justify-center">
                                    <div className="w-24 h-24 rounded-full bg-blue-600/10 flex items-center justify-center backdrop-blur-xl border border-white/10">
                                        <Music className="w-12 h-12 text-blue-400/60" />
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>


                    <div className="mt-4 text-center w-full">
                        <h2 className="text-3xl font-black mb-1 tracking-tight truncate px-4">
                            {currentSong ? currentSong.name : "Select a Track"}
                        </h2>
                        <p className="text-lg font-medium text-blue-400/60 mb-2 truncate px-4">
                            {currentSong ? currentSong.artist : ""}
                        </p>
                    </div>

                    <div className="mt-1 w-full max-w-md flex flex-col items-center gap-2">
                        <div className="w-full flex items-center gap-4 text-[11px] text-gray-500 font-medium">
                            <span>{formatTime(currentTime)}</span>

                            <div className="flex-1 relative h-6 group cursor-pointer flex items-center">
                                <input
                                    type="range"
                                    className="w-full h-1.5 bg-gray-800 rounded-full appearance-none cursor-pointer accent-blue-500 hover:h-2 transition-all outline-none"
                                    min="0"
                                    max="100"
                                    value={progress}
                                    onChange={handleSeek}
                                />
                            </div>
                            <span>{formatTime(duration)}</span>
                        </div>

                        <div className="flex items-center gap-4">
                            <button
                                onClick={toggleShuffle}
                                className={`transition-colors cursor-pointer ${isShuffle ? 'text-blue-400' : 'text-gray-600 hover:text-white'}`}
                            >
                                <Shuffle className={`w-4 h-4 ${isShuffle ? 'fill-current' : ''}`} />
                            </button>
                            <button onClick={prevSong} className="text-white hover:text-blue-400 transition-colors transform hover:scale-110 active:scale-95 cursor-pointer">
                                <SkipBack className="w-6 h-6 fill-current" />
                            </button>
                            <button
                                onClick={togglePlay}
                                className="w-16 h-16 rounded-full bg-white text-black flex items-center justify-center hover:scale-110 active:scale-95 transition-all shadow-xl shadow-white/5 cursor-pointer"
                            >
                                {isPlaying ? <Pause className="w-6 h-6 fill-current" /> : <Play className="w-6 h-6 fill-current ml-1" />}
                            </button>
                            <button onClick={nextSong} className="text-white hover:text-blue-400 transition-colors transform hover:scale-110 active:scale-95 cursor-pointer">
                                <SkipForward className="w-6 h-6 fill-current" />
                            </button>
                            <button
                                onClick={toggleRepeat}
                                className={`transition-colors relative cursor-pointer ${repeatMode !== 'none' ? 'text-blue-400' : 'text-gray-600 hover:text-white'}`}
                            >
                                <Repeat className={`w-4 h-4 ${repeatMode !== 'none' ? 'fill-current' : ''}`} />
                                {repeatMode === 'one' && (
                                    <span className="absolute -top-1 -right-1 text-[8px] font-bold leading-none bg-blue-400 text-black rounded-full w-2.5 h-2.5 flex items-center justify-center">1</span>
                                )}
                            </button>
                        </div>





                    </div>
                </div>
            </div>

            <style>{`
                @keyframes music-bar-1 { 0%, 100% { height: 40% } 50% { height: 100% } }
                @keyframes music-bar-2 { 0%, 100% { height: 100% } 50% { height: 60% } }
                @keyframes music-bar-3 { 0%, 100% { height: 70% } 50% { height: 30% } }
                .animate-music-bar-1 { animation: music-bar-1 0.8s ease-in-out infinite; }
                .animate-music-bar-2 { animation: music-bar-2 0.8s ease-in-out infinite; }
                .animate-music-bar-3 { animation: music-bar-3 0.8s ease-in-out infinite; }
                
                .custom-scrollbar::-webkit-scrollbar { width: 4px; }
                .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
                .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.1); border-radius: 10px; }
                .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: rgba(255,255,255,0.2); }

                input[type='range']::-webkit-slider-thumb {
                    -webkit-appearance: none;
                    appearance: none;
                    width: 12px;
                    height: 12px;
                    background: white;
                    border-radius: 50%;
                    cursor: pointer;
                    box-shadow: 0 0 10px rgba(0,0,0,0.5);
                }
            `}</style>
        </div >
    );
};

export default MusicPlayer;
