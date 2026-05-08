import React, { memo, useState, useEffect, useLayoutEffect, useRef, useMemo } from 'react';
import { Music, List, Target } from 'lucide-react';

export const PlaylistItem = memo(({ playlist, onSelect }) => (
    <div
        onClick={() => onSelect(playlist)}
        className="group flex items-center gap-2 py-1 pr-1 pl-1 rounded-lg cursor-pointer hover:bg-white/5 border border-transparent transition-all"
    >
        <div className="w-8 h-8 rounded-md bg-blue-600/20 flex items-center justify-center">
            {playlist.thumbnail ? (
                <img src={playlist.thumbnail} className="w-full h-full object-cover rounded-md" alt="" />
            ) : (
                <List className="w-4 h-4 text-blue-400" />
            )}
        </div>
        <div className="flex-1 min-w-0">
            <p className="truncate text-xs font-medium text-gray-200">{playlist.name}</p>
            <p className="text-[8px] text-gray-500">{playlist.songs.length} Tracks</p>
        </div>
    </div>
));

export const SongItem = memo(({ song, isPlaying, isCurrent, isSelected, onPlay, onSelect, onContextMenu, onClear, index, list, style }) => (
    <div
        onClick={(e) => {
            if (e.ctrlKey || e.metaKey || e.shiftKey) {
                onSelect(song, index, list, e.ctrlKey || e.metaKey, e.shiftKey);
            } else {
                onClear?.();
                onPlay(index, list);
            }
        }}
        onContextMenu={(e) => onContextMenu(e, song)}
        style={style}
        className={`group music-song-item flex items-center gap-2 py-1.5 pr-1 pl-1 rounded-lg cursor-pointer transition-all duration-200 select-none ${isCurrent ? 'bg-blue-600/20 border border-blue-500/20' : isSelected ? 'bg-blue-500/10 border border-blue-500/40' : 'hover:bg-white/5 border border-transparent'}`}
    >
        <div className="relative w-8 h-8 flex-shrink-0 rounded-md bg-gradient-to-br from-gray-700 to-gray-900 overflow-hidden">
            {isSelected && (
                <div className="absolute -top-1 -right-1 w-3 h-3 bg-blue-500 rounded-full border-2 border-black z-10 flex items-center justify-center">
                    <div className="w-1 h-1 bg-white rounded-full" />
                </div>
            )}
            {song.thumbnail ? (
                <img src={song.thumbnail} alt="" className="absolute inset-0 w-full h-full object-cover" />
            ) : (
                <div className={`absolute inset-0 flex items-center justify-center ${isCurrent && isPlaying ? 'animate-pulse' : ''}`}>
                    {isCurrent && isPlaying ? (
                        <div className="flex gap-0.5 items-end h-2.5">
                            <div className="w-0.5 bg-blue-400 animate-music-bar-1" />
                            <div className="w-0.5 bg-blue-400 animate-music-bar-2" />
                            <div className="w-0.5 bg-blue-400 animate-music-bar-3" />
                        </div>
                    ) : (
                        <Music className="w-3.5 h-3.5 text-gray-500" />
                    )}
                </div>
            )}
        </div>
        <div className="flex-1 min-w-0">
            <p className={`truncate text-xs font-medium ${isCurrent ? 'text-blue-400' : isSelected ? 'text-blue-300' : 'text-gray-200'}`}>
                {song.name}
            </p>
            <p className="truncate text-[9px] text-white/40 font-normal">
                {song.artist}
            </p>
        </div>

        {isCurrent && isPlaying && (
            <div className="text-blue-400 shrink-0">
                <div className="w-1 h-1 rounded-full bg-current shadow-[0_0_10px_currentColor]" />
            </div>
        )}
    </div>
));

// Virtualized List for rendering thousands of songs efficiently
export const VirtualLibrary = ({ items, onPlay, currentSong, isPlaying, header, selectedSongs = [], onSelect, onContextMenu, onClear, onDismiss, viewKey = 'default' }) => {
    const containerRef = useRef(null);
    const headerRef = useRef(null);
    const [scrollTop, setScrollTop] = useState(0);
    const [containerHeight, setContainerHeight] = useState(600);
    const [headerHeight, setHeaderHeight] = useState(0);
    const itemHeight = 44; // Fixed height for each item
    const scrollPositions = useRef({}); // Store scroll positions per viewKey
    const currentViewKey = useRef(viewKey);



    const selectedPaths = useMemo(() => new Set(selectedSongs.map(s => s.path)), [selectedSongs]);

    // Save/restore scroll positions when switching views (useLayoutEffect to prevent flash)
    useLayoutEffect(() => {
        if (currentViewKey.current !== viewKey) {
            // Save current scroll position for the old view
            scrollPositions.current[currentViewKey.current] = containerRef.current?.scrollTop || 0;
            currentViewKey.current = viewKey;

            // Restore scroll position for the new view synchronously before paint
            const saved = scrollPositions.current[viewKey] || 0;
            if (containerRef.current) {
                containerRef.current.scrollTop = saved;
            }
            setScrollTop(saved);
        }
    }, [viewKey]);

    useEffect(() => {
        const container = containerRef.current;
        const headerEl = headerRef.current;
        if (!container) return;

        // Use ResizeObserver for perfect dimension tracking (fixes blank space bugs)
        const resizeObserver = new ResizeObserver(() => {
            if (container) setContainerHeight(container.offsetHeight);
            if (headerRef.current) setHeaderHeight(headerRef.current.offsetHeight);
        });

        resizeObserver.observe(container);
        if (headerEl) resizeObserver.observe(headerEl);

        const handleScroll = (e) => {
            const newScroll = e.target.scrollTop;
            // Use a ref for onDismiss to avoid re-binding
            if (Math.abs(newScroll - scrollTop) > 5) {
                onDismiss?.();
            }
            setScrollTop(newScroll);
            // Persist scroll position for current view
            scrollPositions.current[viewKey] = newScroll;
        };

        container.addEventListener('scroll', handleScroll, { passive: true });

        // Initial measurement
        setContainerHeight(container.offsetHeight);
        if (headerRef.current) setHeaderHeight(headerRef.current.offsetHeight);

        return () => {
            resizeObserver.disconnect();
            container.removeEventListener('scroll', handleScroll);
        };
    }, [header, onDismiss, viewKey]); // Re-run if header presence changes to observe/unobserve

    const visibleItems = useMemo(() => {
        const adjustedScrollTop = Math.max(0, scrollTop - headerHeight);
        // Add a larger buffer (10 items instead of 5) for smoother fast scrolling
        const start = Math.max(0, Math.floor(adjustedScrollTop / itemHeight) - 10);
        const end = Math.min(items.length, Math.ceil((adjustedScrollTop + containerHeight) / itemHeight) + 10);

        return items.slice(start, end).map((item, idx) => ({
            song: item,
            index: start + idx,
            top: headerHeight + (start + idx) * itemHeight
        }));
    }, [scrollTop, containerHeight, items, itemHeight, headerHeight]);

    const norm = (p) => p ? p.replace(/\\/g, '/') : '';

    const scrollToPlaying = () => {
        const cPath = norm(currentSong?.path);
        const songIndex = items.findIndex(s => norm(s.path) === cPath);
        const container = containerRef.current;

        if (songIndex !== -1 && container) {
            const hHeight = headerRef.current ? headerRef.current.offsetHeight : 0;
            const target = hHeight + (songIndex * itemHeight) - (container.clientHeight / 2) + (itemHeight / 2);
            const final = Math.max(0, Math.min(target, container.scrollHeight - container.clientHeight));

            // Override everything and just scroll
            container.scrollTo({ top: final, behavior: 'smooth' });

            // Also sync our internal state ref just in case
            scrollState.current.target = final;
        }
    };

    return (
        <div className="flex-1 relative min-h-0 min-w-0 flex flex-col">
            <div
                ref={containerRef}
                onClick={(e) => { if (e.target === e.currentTarget) onClear?.(); }}
                className="virtual-library-container flex-1 overflow-y-auto pt-1 pb-4 pr-1 pl-1 custom-scrollbar select-none"
            >
                <div
                    onClick={(e) => { if (e.target === e.currentTarget) onClear?.(); }}
                    style={{ height: headerHeight + items.length * itemHeight, width: '100%', position: 'relative' }}
                >
                    <div ref={headerRef} className="absolute top-0 left-0 right-0 z-10">
                        {header}
                    </div>
                    {visibleItems.map(({ song, index, top }) => (
                        <div
                            key={`${song.path}-${index}`}
                            style={{
                                position: 'absolute',
                                top: top,
                                left: 0,
                                right: 0,
                                height: itemHeight,
                                paddingBottom: '4px'
                            }}
                        >
                            <SongItem
                                song={song}
                                isPlaying={isPlaying}
                                isCurrent={currentSong && norm(currentSong.path) === norm(song.path)}
                                isSelected={selectedPaths.has(song.path)}
                                onPlay={onPlay}
                                onSelect={onSelect}
                                onContextMenu={onContextMenu}
                                onClear={onClear}
                                index={index}
                                list={items}
                            />
                        </div>
                    ))}
                </div>
                {items.length === 0 && (
                    <div className="flex flex-col items-center justify-center h-64 text-gray-500 opacity-50">
                        <Music className="w-12 h-12 mb-4" />
                        <p>No songs found</p>
                    </div>
                )}
            </div>

            {currentSong && items.some(s => norm(s.path) === norm(currentSong.path)) && (
                <button
                    onClick={(e) => {
                        e.stopPropagation();
                        scrollToPlaying();
                    }}
                    className="absolute bottom-1.5 right-1.5 w-9 h-9 bg-blue-600 shadow-[0_0_20px_rgba(37,99,235,0.4)] text-white rounded-full flex items-center justify-center hover:scale-110 active:scale-95 transition-all z-[100] cursor-pointer border border-white/20"
                    title="Jump to playing song"
                >
                    <Target className="w-5 h-5 shadow-sm" />
                </button>
            )}
        </div>
    );
};
