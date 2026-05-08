import React from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Play, Pause, SkipBack, SkipForward, Music, X } from 'lucide-react';
import { useMusic } from '../contexts/MusicContext';

const MiniMusicPlayer = () => {
    const {
        currentSong,
        isPlaying,
        togglePlay,
        nextSong,
        prevSong,
        isLibraryLoaded,
    } = useMusic();

    const location = useLocation();
    const navigate = useNavigate();
    const [isDismissed, setIsDismissed] = React.useState(() => {
        return localStorage.getItem('mini_player_dismissed') === 'true';
    });

    const isReady = React.useRef(false);

    const updateDismissed = (val) => {
        setIsDismissed(val);
        localStorage.setItem('mini_player_dismissed', val);
    };

    const [position, setPosition] = React.useState(() => {
        const saved = localStorage.getItem('mini_player_pos');
        return saved ? JSON.parse(saved) : { x: window.innerWidth / 2 - 100, y: window.innerHeight - 80 };
    });
    const [isDragging, setIsDragging] = React.useState(false);
    const dragOffset = React.useRef({ x: 0, y: 0 });

    const handleMouseDown = (e) => {
        if (e.target.closest('button')) return;
        e.preventDefault(); // Prevent text selection
        setIsDragging(true);
        dragOffset.current = {
            x: e.clientX - position.x,
            y: e.clientY - position.y
        };
    };

    const handleDoubleClick = (e) => {
        if (e.target.closest('button')) return;
        navigate('/Music');
    };

    const handleContextMenu = (e) => {
        e.preventDefault();
        if (e.target.closest('button')) return;
        updateDismissed(true);
    };

    React.useEffect(() => {
        const handleMouseMove = (e) => {
            if (!isDragging) return;
            const newPos = {
                x: e.clientX - dragOffset.current.x,
                y: e.clientY - dragOffset.current.y
            };
            setPosition(newPos);
        };

        const handleMouseUp = () => {
            if (isDragging) {
                setIsDragging(false);
                localStorage.setItem('mini_player_pos', JSON.stringify(position));
            }
        };

        if (isDragging) {
            window.addEventListener('mousemove', handleMouseMove);
            window.addEventListener('mouseup', handleMouseUp);
            document.body.style.userSelect = 'none'; // Aggressive prevention
        } else {
            document.body.style.userSelect = '';
        }

        return () => {
            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('mouseup', handleMouseUp);
            document.body.style.userSelect = '';
        };
    }, [isDragging, position]);

    const suppressUndismissRef = React.useRef(false);

    // Reset dismissal when song changes OR when playback starts (BUT ONLY after initial library load)
    React.useEffect(() => {
        if (!isLibraryLoaded) return;

        if (!isReady.current) {
            isReady.current = true;
            return;
        }

        if (isPlaying || currentSong) {
            if (suppressUndismissRef.current) {
                // If F1 was just pressed, we suppress bringing up the bar
                suppressUndismissRef.current = false;
            } else {
                updateDismissed(false);
            }
        }
    }, [currentSong?.path, isPlaying, isLibraryLoaded]);

    // Reset dismissal when returning to Music page (so it shows up again when leaving)
    React.useEffect(() => {
        if (location.pathname === '/Music') {
            updateDismissed(false);
        }
    }, [location.pathname]);

    // Global F1 Hotkey for Play/Pause (all routes)
    React.useEffect(() => {
        const handleKeyDown = (e) => {
            if (e.key === 'F1') {
                e.preventDefault(); // Prevent browser help from opening
                suppressUndismissRef.current = true;
                togglePlay();
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [togglePlay]);

    // Hide conditions
    if (location.pathname === '/Music' || !currentSong || isDismissed) return null;

    return (
        <div
            className="fixed z-[100] transition-colors pointer-events-none select-none"
            style={{
                left: `${position.x}px`,
                top: `${position.y}px`
            }}
        >
            <div
                onMouseDown={handleMouseDown}
                onDoubleClick={handleDoubleClick}
                onContextMenu={handleContextMenu}
                className={`group bg-black/40 backdrop-blur-xl border border-white/10 rounded-full pl-2 pr-4 py-1.5 flex items-center gap-3 shadow-2xl pointer-events-auto cursor-grab active:cursor-grabbing transition-all hover:bg-black/60 relative ${isDragging ? 'scale-105 shadow-white/5 border-white/30' : ''}`}
            >
                {/* Close Button - Appears on hover */}
                <button
                    onClick={(e) => {
                        e.stopPropagation();
                        updateDismissed(true);
                    }}
                    className="absolute -top-2 -right-2 w-5 h-5 bg-white text-black rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all duration-300 hover:scale-110 active:scale-95 shadow-lg z-10 scale-50 group-hover:scale-100 cursor-pointer"
                >
                    <X className="w-3 h-3" />
                </button>

                {/* Small Thumbnail */}
                <div className="w-6 h-6 rounded-full overflow-hidden bg-white/5 shrink-0 border border-white/10">
                    {currentSong?.thumbnail ? (
                        <img src={currentSong.thumbnail} className="w-full h-full object-cover" alt="" />
                    ) : (
                        <div className="w-full h-full flex items-center justify-center">
                            <Music className="w-3 h-3 text-white/40" />
                        </div>
                    )}
                </div>

                {/* Song Name - Truncated */}
                <div className="flex flex-col min-w-0 max-w-[100px] mr-1">
                    <span className="text-[10px] font-bold text-white/90 truncate leading-tight">
                        {currentSong?.name || "No Track"}
                    </span>
                    <span className="text-[8px] font-medium text-white/40 truncate leading-tight">
                        {currentSong?.artist || "Unknown"}
                    </span>
                </div>

                <div className="flex items-center gap-2 border-l border-white/10 pl-2">
                    <button
                        onClick={prevSong}
                        className="text-white/40 hover:text-white transition-colors p-0.5 cursor-pointer"
                    >
                        <SkipBack className="w-3 h-3 fill-current" />
                    </button>

                    <button
                        onClick={togglePlay}
                        className="w-7 h-7 rounded-full bg-white text-black flex items-center justify-center hover:scale-110 active:scale-95 transition-all shadow-md cursor-pointer"
                    >
                        {isPlaying ? <Pause className="w-3.5 h-3.5 fill-current" /> : <Play className="w-3.5 h-3.5 fill-current ml-0.5" />}
                    </button>

                    <button
                        onClick={nextSong}
                        className="text-white/40 hover:text-white transition-colors p-0.5 cursor-pointer"
                    >
                        <SkipForward className="w-3 h-3 fill-current" />
                    </button>
                </div>
            </div>
        </div>
    );
};




export default MiniMusicPlayer;
