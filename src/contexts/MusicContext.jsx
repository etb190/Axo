import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';

const path = window.require('path');
const fs = window.require('fs');
// music-metadata is ESM-only and should be dynamically imported or bundled.
// const mm = window.require('music-metadata'); // dynamic import used in fetchMetadata

const MusicContext = createContext();
export const useMusic = () => useContext(MusicContext);

export const MusicProvider = ({ children }) => {
    const [songs, setSongs] = useState([]);
    const [playlists, setPlaylists] = useState([]);
    const [playingSongs, setPlayingSongs] = useState([]);
    const [playingIndex, setPlayingIndex] = useState(-1);
    const [isPlaying, setIsPlaying] = useState(false);
    const [volume, setVolume] = useState(1.0);
    const [progress, setProgress] = useState(0);
    const [currentTime, setCurrentTime] = useState(0);
    const [duration, setDuration] = useState(0);
    const [isShuffle, setIsShuffle] = useState(false);
    const [repeatMode, setRepeatMode] = useState('none');
    const [isLibraryLoaded, setIsLibraryLoaded] = useState(false);

    const audioRef = useRef(new Audio());
    useEffect(() => {
        audioRef.current.volume = 1.0;
    }, []);
    const musicDir = "E:\\Music";
    const CACHE_DIR = "C:\\Users\\PC\\Desktop\\database\\MusicCache";
    const THUMBNAIL_DIR = path.join(CACHE_DIR, "thumbnails");
    const METADATA_CACHE = path.join(CACHE_DIR, "metadata.json");

    const [selectedSongs, setSelectedSongs] = useState([]);
    const [lastSelectedIndex, setLastSelectedIndex] = useState(-1);

    // 1. Initial State Restoration & Library Load
    const refreshLibrary = async () => {
        window._libraryInitiated = false;
        await loadLibrary();
    };

    const handleSelect = useCallback((song, index, allSongs, isCtrl, isShift) => {
        setSelectedSongs(prev => {
            if (isShift && lastSelectedIndex !== -1) {
                const start = Math.min(lastSelectedIndex, index);
                const end = Math.max(lastSelectedIndex, index);
                const range = allSongs.slice(start, end + 1);

                // For shift, we usually want to ADD the range to current selection
                // or just make the range the selection. Let's make it add to current.
                const newPaths = new Set(prev.map(s => s.path));
                range.forEach(s => newPaths.add(s.path));
                return allSongs.filter(s => newPaths.has(s.path));
            }

            if (isCtrl) {
                const exists = prev.find(s => s.path === song.path);
                setLastSelectedIndex(index);
                if (exists) return prev.filter(s => s.path !== song.path);
                return [...prev, song];
            }

            // Normal single select
            setLastSelectedIndex(index);
            return [song];
        });
    }, [lastSelectedIndex]);

    const clearSelection = useCallback(() => {
        setSelectedSongs([]);
        setLastSelectedIndex(-1);
    }, []);

    // Helper: remove songs from state optimistically
    const removeSongsFromState = useCallback((songPaths) => {
        const pathSet = new Set(songPaths);

        // Remove from root songs
        setSongs(prev => prev.filter(s => !pathSet.has(s.path)));

        // Remove from playlists
        setPlaylists(prev => prev.map(pl => {
            const filtered = pl.songs.filter(s => !pathSet.has(s.path));
            if (filtered.length === pl.songs.length) return pl;
            return { ...pl, songs: filtered, thumbnail: filtered.find(s => s.thumbnail)?.thumbnail || null };
        }).filter(pl => pl.songs.length > 0));

        // Clean up playing queue — recalculate index to keep pointing at same song
        setPlayingSongs(prev => {
            const currentlyPlayingSong = prev[playingIndex];
            const filtered = prev.filter(s => !pathSet.has(s.path));

            // Nothing changed in the queue
            if (filtered.length === prev.length) return prev;

            // Queue is now empty
            if (filtered.length === 0) {
                setPlayingIndex(-1);
                setIsPlaying(false);
                audioRef.current.pause();
                audioRef.current.src = '';
                return [];
            }

            if (currentlyPlayingSong && pathSet.has(currentlyPlayingSong.path)) {
                // The currently playing song was removed — stop playback, reset index
                const newIdx = Math.min(playingIndex, filtered.length - 1);
                setPlayingIndex(newIdx);
                audioRef.current.pause();
                audioRef.current.src = '';
                setIsPlaying(false);
            } else if (currentlyPlayingSong) {
                // Currently playing song is still in the queue — find its new index
                const newIdx = filtered.findIndex(s => s.path === currentlyPlayingSong.path);
                setPlayingIndex(newIdx !== -1 ? newIdx : 0);
                // Audio continues undisturbed
            }

            return filtered;
        });
    }, [playingIndex]);

    // Helper: add songs to a playlist in state optimistically
    const addSongsToPlaylistState = useCallback((targetPlaylistName, songsToAdd) => {
        setPlaylists(prev => {
            const idx = prev.findIndex(pl => pl.name === targetPlaylistName);
            if (idx !== -1) {
                // Add to existing playlist
                const updated = [...prev];
                const newSongs = songsToAdd.map(s => ({
                    ...s,
                    path: path.join(musicDir, targetPlaylistName, path.basename(s.path)),
                    url: `file:///${encodeURI(path.join(musicDir, targetPlaylistName, path.basename(s.path)).replace(/\\/g, '/'))}`,
                }));
                updated[idx] = {
                    ...updated[idx],
                    songs: [...updated[idx].songs, ...newSongs],
                    thumbnail: updated[idx].thumbnail || newSongs.find(s => s.thumbnail)?.thumbnail || null
                };
                return updated;
            } else {
                // Create new playlist
                const newSongs = songsToAdd.map(s => ({
                    ...s,
                    path: path.join(musicDir, targetPlaylistName, path.basename(s.path)),
                    url: `file:///${encodeURI(path.join(musicDir, targetPlaylistName, path.basename(s.path)).replace(/\\/g, '/'))}`,
                }));
                return [...prev, {
                    name: targetPlaylistName,
                    songs: newSongs,
                    thumbnail: newSongs.find(s => s.thumbnail)?.thumbnail || null
                }];
            }
        });
    }, [musicDir]);

    const moveSongs = useCallback(async (targetPlaylistName) => {
        const songsToMove = [...selectedSongs];
        const songPaths = songsToMove.map(s => s.path);

        // Optimistic UI update: remove from source, add to target
        removeSongsFromState(songPaths);
        addSongsToPlaylistState(targetPlaylistName, songsToMove);
        clearSelection();

        // Background file operations
        const targetDir = path.join(musicDir, targetPlaylistName);
        if (!fs.existsSync(targetDir)) fs.mkdirSync(targetDir, { recursive: true });
        for (const song of songsToMove) {
            const destPath = path.join(targetDir, path.basename(song.path));
            try {
                await fs.promises.rename(song.path, destPath);
            } catch (e) {
                console.error(`Error moving ${song.name}:`, e);
            }
        }
    }, [selectedSongs, musicDir, clearSelection, removeSongsFromState, addSongsToPlaylistState]);

    const copySongs = useCallback(async (targetPlaylistName) => {
        const songsToCopy = [...selectedSongs];

        // Optimistic UI update: add to target (source stays)
        addSongsToPlaylistState(targetPlaylistName, songsToCopy);
        clearSelection();

        // Background file operations
        const targetDir = path.join(musicDir, targetPlaylistName);
        if (!fs.existsSync(targetDir)) fs.mkdirSync(targetDir, { recursive: true });
        for (const song of songsToCopy) {
            const destPath = path.join(targetDir, path.basename(song.path));
            try {
                await fs.promises.copyFile(song.path, destPath);
            } catch (e) {
                console.error(`Error copying ${song.name}:`, e);
            }
        }
    }, [selectedSongs, musicDir, clearSelection, addSongsToPlaylistState]);

    const deleteSongs = useCallback(async () => {
        const songsToDelete = [...selectedSongs];
        const songPaths = songsToDelete.map(s => s.path);

        // Optimistic UI update: remove immediately
        removeSongsFromState(songPaths);
        clearSelection();

        // Background file operations
        for (const song of songsToDelete) {
            try {
                await fs.promises.unlink(song.path);
            } catch (e) {
                console.error(`Error deleting ${song.name}:`, e);
            }
        }
    }, [selectedSongs, clearSelection, removeSongsFromState]);

    useEffect(() => {
        const init = async () => {
            // Ensure cache directories exist
            try {
                if (!fs.existsSync(CACHE_DIR)) fs.mkdirSync(CACHE_DIR, { recursive: true });
                if (!fs.existsSync(THUMBNAIL_DIR)) fs.mkdirSync(THUMBNAIL_DIR, { recursive: true });
            } catch (e) { }

            const savedState = localStorage.getItem('music_player_state');
            if (savedState) {
                try {
                    const parsed = JSON.parse(savedState);
                    window._initialMusicState = parsed;
                    if (parsed.volume !== undefined) {
                        // Volume control removed, always maxing
                        setVolume(1.0);
                        audioRef.current.volume = 1.0;
                    }
                    if (parsed.isShuffle !== undefined) setIsShuffle(parsed.isShuffle);
                    if (parsed.repeatMode !== undefined) setRepeatMode(parsed.repeatMode);
                } catch (e) { console.error(e); }
            }

            if (!window._libraryInitiated) {
                await loadLibrary();
            }
        };
        init();
    }, []);

    // 2. State Persistence
    useEffect(() => {
        const stateToSave = {
            playingSongsPaths: playingSongs.map(s => s.path),
            playingIndexPath: playingSongs[playingIndex]?.path || null,
            isPlaying, currentTime, isShuffle, repeatMode
        };
        localStorage.setItem('music_player_state', JSON.stringify(stateToSave));
    }, [playingSongs, playingIndex, isPlaying, currentTime, isShuffle, repeatMode]);

    // 3. Metadata Fetcher with Disk Caching
    const fetchMetadata = async (songPath, cache) => {
        try {
            const stats = await fs.promises.stat(songPath);
            const mtime = stats.mtimeMs;

            // Check Cache
            if (cache[songPath] && cache[songPath].mtime === mtime) {
                return { ...cache[songPath], hydrated: true };
            }

            // Extract new metadata
            console.log(`[Music] Parsing: ${songPath}`);
            const mm = await import('music-metadata');
            const buffer = await fs.promises.readFile(songPath);
            const metadata = await mm.parseBuffer(buffer);

            let thumbnail = null;
            const picture = metadata.common.picture?.[0];
            if (picture) {
                const crypto = window.require('crypto');
                const hash = crypto.createHash('md5').update(songPath).digest('hex');
                const thumbnailPath = path.join(THUMBNAIL_DIR, `${hash}.jpg`);
                await fs.promises.writeFile(thumbnailPath, picture.data);
                thumbnail = `file:///${encodeURI(thumbnailPath.replace(/\\/g, '/'))}`;
            }

            return {
                artist: metadata.common.artist || "Unknown Artist",
                thumbnail: thumbnail,
                name: metadata.common.title || path.basename(songPath, path.extname(songPath)),
                mtime: mtime,
                hydrated: true
            };
        } catch (e) {
            console.error(`[Music] Metadata error for ${songPath}:`, e);
            return null;
        }
    };

    const loadLibrary = async () => {
        if (window._libraryInitiated) return;
        window._libraryInitiated = true;

        try {
            if (!fs.existsSync(musicDir)) return;

            // Load Existing Cache
            let cache = {};
            try {
                if (fs.existsSync(METADATA_CACHE)) {
                    // Force clear on first run of this fix or if cache is corrupted
                    // await fs.promises.unlink(METADATA_CACHE); 
                    // cache = {};
                    cache = JSON.parse(await fs.promises.readFile(METADATA_CACHE, 'utf8'));
                }
            } catch (e) { }
            console.log(`[Music] Loaded ${Object.keys(cache).length} cached entries`);

            const items = await fs.promises.readdir(musicDir);

            // --- STEP A: QUICK SCAN (Parallelized) ---
            const scanResults = await Promise.all(items.map(async (item) => {
                const fullPath = path.join(musicDir, item);
                try {
                    const stats = await fs.promises.stat(fullPath);
                    if (stats.isDirectory()) {
                        const files = (await fs.promises.readdir(fullPath)).filter(f => /\.(mp3|wav|ogg|flac|m4a)$/i.test(f));
                        if (files.length > 0) {
                            const folderSongs = await Promise.all(files.map(async f => {
                                const songPath = path.join(fullPath, f);
                                const songStats = await fs.promises.stat(songPath);
                                const cached = cache[songPath];
                                return {
                                    name: cached?.name || f.replace(/\.[^/.]+$/, ""),
                                    fileName: f,
                                    path: songPath,
                                    url: `file:///${encodeURI(songPath.replace(/\\/g, '/'))}`,
                                    artist: cached?.artist || "Loading...",
                                    thumbnail: cached?.thumbnail || null,
                                    dateAdded: songStats.birthtime,
                                    mtime: songStats.mtimeMs,
                                    hydrated: !!cached
                                };
                            }));
                            return { type: 'playlist', data: { name: item, songs: folderSongs, thumbnail: folderSongs.find(s => s.thumbnail)?.thumbnail || null } };
                        }
                    } else if (/\.(mp3|wav|ogg|flac|m4a)$/i.test(item)) {
                        const cached = cache[fullPath];
                        return {
                            type: 'song',
                            data: {
                                name: cached?.name || item.replace(/\.[^/.]+$/, ""),
                                fileName: item,
                                path: fullPath,
                                url: `file:///${encodeURI(fullPath.replace(/\\/g, '/'))}`,
                                artist: cached?.artist || "Loading...",
                                thumbnail: cached?.thumbnail || null,
                                dateAdded: stats.birthtime,
                                mtime: stats.mtimeMs,
                                hydrated: !!cached
                            }
                        };
                    }
                } catch (e) { }
                return null;
            }));

            const rootSongsList = scanResults.filter(r => r?.type === 'song').map(r => r.data);
            const playlistsList = scanResults.filter(r => r?.type === 'playlist').map(r => r.data);

            setSongs(rootSongsList);
            setPlaylists(playlistsList);
            setIsLibraryLoaded(true);

            // --- STEP B: BATCHED BACKGROUND HYDRATION ---
            const hydrateSongs = async (songArray, setterFunc, playlistIdx = -1) => {
                const BATCH_SIZE = 40; // Larger batch for efficiency
                let currentBatchUpdates = [];
                let cacheChanged = false;
                const processing = new Set();

                for (let i = 0; i < songArray.length; i++) {
                    const song = songArray[i];

                    if (!song.hydrated && !processing.has(song.path)) {
                        processing.add(song.path);
                        const meta = await fetchMetadata(song.path, cache);
                        if (meta) {
                            currentBatchUpdates.push({ index: i, meta });
                            if (!cache[song.path] || cache[song.path].mtime !== meta.mtime) {
                                cache[song.path] = meta;
                                cacheChanged = true;
                            }
                        }
                    }

                    if (currentBatchUpdates.length >= BATCH_SIZE || i === songArray.length - 1) {
                        if (currentBatchUpdates.length === 0) continue;

                        const updatesToApply = [...currentBatchUpdates];
                        currentBatchUpdates = [];

                        setterFunc(prev => {
                            if (playlistIdx === -1) {
                                const updated = [...prev];
                                updatesToApply.forEach(u => {
                                    updated[u.index] = { ...updated[u.index], ...u.meta };
                                });
                                return updated;
                            } else {
                                const updatedPlaylists = [...prev];
                                const updatedSongs = [...updatedPlaylists[playlistIdx].songs];
                                updatesToApply.forEach(u => {
                                    updatedSongs[u.index] = { ...updatedSongs[u.index], ...u.meta };
                                    if (u.index === 0) updatedPlaylists[playlistIdx].thumbnail = u.meta.thumbnail;
                                });
                                updatedPlaylists[playlistIdx].songs = updatedSongs;
                                return updatedPlaylists;
                            }
                        });

                        if (cacheChanged) {
                            try {
                                await fs.promises.writeFile(METADATA_CACHE, JSON.stringify(cache));
                                cacheChanged = false;
                            } catch (e) { }
                        }

                        await new Promise(r => setTimeout(r, 5));
                    }
                }
            };

            // Start hydration tasks sequentially to avoid cache file write collisions
            const startHydration = async () => {
                await hydrateSongs(rootSongsList, setSongs);
                for (let idx = 0; idx < playlistsList.length; idx++) {
                    await hydrateSongs(playlistsList[idx].songs, setPlaylists, idx);
                }
            };
            startHydration();

            // Restore Playback session
            if (window._initialMusicState) {
                const { playingSongsPaths, playingIndexPath, currentTime } = window._initialMusicState;
                const allLoaded = [...rootSongsList, ...playlistsList.flatMap(p => p.songs)];
                if (playingSongsPaths) {
                    const restored = playingSongsPaths.map(p => allLoaded.find(s => s.path === p)).filter(Boolean);
                    if (restored.length > 0) {
                        setPlayingSongs(restored);
                        const idx = restored.findIndex(s => s.path === playingIndexPath);
                        if (idx !== -1) {
                            setPlayingIndex(idx);
                            audioRef.current.src = restored[idx].url;
                            audioRef.current.currentTime = currentTime;
                        }
                    }
                }
                delete window._initialMusicState;
            }

        } catch (error) {
            console.error("[Music] Library load error:", error);
        }
    };

    // Control functions
    const playSong = async (index, songList = songs) => {
        const song = songList[index];
        if (!song) return;
        setPlayingSongs(songList);
        setPlayingIndex(index);
        audioRef.current.src = song.url;
        try { await audioRef.current.play(); setIsPlaying(true); } catch (e) { }
    };

    const togglePlay = () => {
        if (playingIndex === -1 && songs.length > 0) { playSong(0); return; }
        isPlaying ? audioRef.current.pause() : audioRef.current.play().catch(() => { });
        setIsPlaying(!isPlaying);
    };

    const nextSong = () => {
        if (playingSongs.length === 0) return;
        const nextIdx = isShuffle ? Math.floor(Math.random() * playingSongs.length) : (playingIndex + 1) % playingSongs.length;
        playSong(nextIdx, playingSongs);
    };

    const prevSong = () => {
        if (playingSongs.length === 0) return;
        const prevIdx = (playingIndex - 1 + playingSongs.length) % playingSongs.length;
        playSong(prevIdx, playingSongs);
    };

    useEffect(() => {
        const audio = audioRef.current;
        const handleTime = () => {
            setCurrentTime(audio.currentTime);
            setDuration(audio.duration);
            if (audio.duration) setProgress((audio.currentTime / audio.duration) * 100);
        };
        const handleEnd = () => (repeatMode === 'one' ? (audio.currentTime = 0, audio.play()) : nextSong());
        audio.addEventListener('timeupdate', handleTime);
        audio.addEventListener('ended', handleEnd);
        return () => {
            audio.removeEventListener('timeupdate', handleTime);
            audio.removeEventListener('ended', handleEnd);
        };
    }, [playingIndex, playingSongs, repeatMode, isShuffle]);

    return (
        <MusicContext.Provider value={{
            songs, playlists, setPlaylists, playingSongs, playingIndex, isPlaying, volume,
            progress, currentTime, duration, isShuffle, repeatMode,
            currentSong: playingSongs[playingIndex],
            selectedSongs,
            handleSelect,
            clearSelection,
            moveSongs,
            copySongs,
            deleteSongs,
            setVolume: (v) => { /* Volume control removed, always max */ audioRef.current.volume = 1.0; setVolume(1.0); },
            playSong, togglePlay, nextSong, prevSong,
            toggleShuffle: () => setIsShuffle(!isShuffle),
            toggleRepeat: () => setRepeatMode(r => r === 'none' ? 'all' : r === 'all' ? 'one' : 'none'),
            seek: (p) => { if (audioRef.current.duration) audioRef.current.currentTime = (p / 100) * audioRef.current.duration; },
            isLibraryLoaded
        }}>
            {children}
        </MusicContext.Provider>
    );
};