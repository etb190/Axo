import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import Navbar from './Navbar';

// Icons
import searchIcon from '../assets/icons/search.svg';
import closeIcon from '../assets/icons/close.svg';
import chevronLeftIcon from '../assets/icons/chevron-left.svg';
import chevronRightIcon from '../assets/icons/chevron-right.svg';
import loaderIcon from '../assets/icons/loader.svg';
import conceptsIcon from '../assets/icons/concepts.svg';
import playIcon from '../assets/icons/play.svg';
import plusIcon from '../assets/icons/plus.svg';

// ─── Config ───────────────────────────────────────────────────────
const GALLERY_PATH = 'E:\\Gallery';
const IMAGE_EXTS = ['jpg', 'jpeg', 'png', 'gif', 'bmp', 'webp', 'svg', 'avif', 'ico', 'tiff'];
const VIDEO_EXTS = ['mp4', 'mkv', 'avi', 'mov', 'webm', 'flv', 'wmv'];
const ALL_MEDIA_EXTS = [...IMAGE_EXTS, ...VIDEO_EXTS];

// ─── FFmpeg path helper (same as TVPlayer) ────────────────────────
const getFFmpegPath = () => {
    if (window.ffmpegPath) return window.ffmpegPath;
    try { return window.require('ffmpeg-static'); } catch { return null; }
};

// ─── In-memory caches — survive re-renders, make album switching instant ──
const thumbCache = {};   // videoPath -> data:uri
const imgCache = {};     // imagePath -> data:uri
const durationCache = {}; // videoPath -> formatted string e.g. "1:23:45"

const formatDuration = (seconds) => {
    if (!seconds || isNaN(seconds) || seconds <= 0) return null;
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = Math.floor(seconds % 60);
    if (h > 0) return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    return `${m}:${s.toString().padStart(2, '0')}`;
};

// Probe video duration (cached to disk + memory)
const probeVideoDuration = (videoPath, callback) => {
    if (durationCache[videoPath]) { callback(durationCache[videoPath]); return; }
    try {
        const { exec } = window.require('child_process');
        const ffmpegPath = getFFmpegPath();
        const path = window.require('path');
        const fs = window.require('fs');
        const os = window.require('os');
        const crypto = window.require('crypto');

        // Check disk cache
        const cacheDir = path.join(os.tmpdir(), '.axo_gallery_durcache');
        if (!fs.existsSync(cacheDir)) fs.mkdirSync(cacheDir, { recursive: true });
        const hash = crypto.createHash('md5').update(videoPath).digest('hex');
        const cachePath = path.join(cacheDir, `${hash}.txt`);

        if (fs.existsSync(cachePath)) {
            const dur = fs.readFileSync(cachePath, 'utf-8').trim();
            durationCache[videoPath] = dur;
            callback(dur);
            return;
        }

        exec(`"${ffmpegPath}" -i "${videoPath}"`, (error, stdout, stderr) => {
            const match = (stdout + stderr).match(/Duration: (\d+):(\d+):(\d+)\.(\d+)/);
            if (match) {
                const totalSec = parseInt(match[1]) * 3600 + parseInt(match[2]) * 60 + parseInt(match[3]);
                const formatted = formatDuration(totalSec);
                if (formatted) {
                    durationCache[videoPath] = formatted;
                    try { fs.writeFileSync(cachePath, formatted); } catch (e) { }
                    callback(formatted);
                }
            }
        });
    } catch (e) { }
};

// ─── VideoThumbnail (reused from TVPlayer pattern) ────────────────
const VideoThumbnail = ({ videoPath, className, timeOffset = 5, refreshKey }) => {
    const [thumbnail, setThumbnail] = useState(null);
    const [failed, setFailed] = useState(false);

    useEffect(() => {
        // Reset thumbnail when path or refreshKey changes
        setThumbnail(thumbCache[videoPath] || null);
        setFailed(false);
    }, [videoPath, refreshKey]);

    useEffect(() => {
        if (thumbCache[videoPath]) { setThumbnail(thumbCache[videoPath]); return; }
        let isMounted = true;
        const loadThumbnail = async () => {
            try {
                const { exec } = window.require('child_process');
                const ffmpegPath = getFFmpegPath();
                const path = window.require('path');
                const fs = window.require('fs');
                const os = window.require('os');
                const crypto = window.require('crypto');

                const cacheDir = path.join(os.tmpdir(), '.axo_gallery_thumbcache');
                if (!fs.existsSync(cacheDir)) fs.mkdirSync(cacheDir, { recursive: true });

                const hash = crypto.createHash('md5').update(videoPath).digest('hex');
                const cachePath = path.join(cacheDir, `${hash}.jpg`);

                if (fs.existsSync(cachePath)) {
                    const data = fs.readFileSync(cachePath);
                    const uri = `data:image/jpeg;base64,${data.toString('base64')}`;
                    thumbCache[videoPath] = uri;
                    if (isMounted) setThumbnail(uri);
                    return;
                }

                // First try capturing at offset. 
                // Using -ss after -i is slower but more reliable for problematic/short files.
                const cmd = `"${ffmpegPath}" -i "${videoPath}" -ss ${timeOffset} -vframes 1 -vf "scale='min(480,iw)':-1" -f image2 "${cachePath}"`;
                exec(cmd, (error) => {
                    if (error) {
                        // FALLBACK: Try from the very beginning (0s)
                        const fallbackCmd = `"${ffmpegPath}" -i "${videoPath}" -ss 0 -vframes 1 -vf "scale='min(480,iw)':-1" -f image2 "${cachePath}"`;
                        exec(fallbackCmd, (fallbackErr) => {
                            if (fallbackErr) {
                                if (isMounted) setFailed(true);
                            } else {
                                if (fs.existsSync(cachePath)) {
                                    const data = fs.readFileSync(cachePath);
                                    const uri = `data:image/jpeg;base64,${data.toString('base64')}`;
                                    thumbCache[videoPath] = uri;
                                    if (isMounted) setThumbnail(uri);
                                } else {
                                    if (isMounted) setFailed(true);
                                }
                            }
                        });
                        return;
                    }
                    if (fs.existsSync(cachePath)) {
                        const data = fs.readFileSync(cachePath);
                        const uri = `data:image/jpeg;base64,${data.toString('base64')}`;
                        thumbCache[videoPath] = uri;
                        if (isMounted) setThumbnail(uri);
                    } else {
                        if (isMounted) setFailed(true);
                    }
                });
            } catch (e) {
                if (isMounted) setFailed(true);
            }
        };
        loadThumbnail();
        return () => { isMounted = false; };
    }, [videoPath, timeOffset, refreshKey]);

    if (failed) {
        return (
            <div className={`bg-zinc-800 flex items-center justify-center ${className}`}>
                <img src={playIcon} className="w-6 h-6 filter brightness-0 invert opacity-20" alt="video" />
            </div>
        );
    }
    if (!thumbnail) {
        return (
            <div className={`bg-zinc-800 flex items-center justify-center ${className}`}>
                <div className="w-4 h-4 rounded-full border-2 border-white/5 border-t-white/40 animate-spin"></div>
            </div>
        );
    }
    return <img src={thumbnail} className={className} alt="Thumbnail" />;
};

// ─── ImageThumbnail — loads a cached smaller version or the image directly ──
const ImageThumbnail = ({ imagePath, className, refreshKey }) => {
    const [src, setSrc] = useState(null);
    const [failed, setFailed] = useState(false);

    useEffect(() => {
        setSrc(imgCache[imagePath] || null);
        setFailed(false);
    }, [imagePath, refreshKey]);

    useEffect(() => {
        if (imgCache[imagePath]) { setSrc(imgCache[imagePath]); return; }
        let isMounted = true;
        try {
            const fs = window.require('fs');
            const path = window.require('path');
            const os = window.require('os');
            const crypto = window.require('crypto');

            const stats = fs.statSync(imagePath);
            const ext = path.extname(imagePath).slice(1).toLowerCase();
            const mimeMap = { jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', gif: 'image/gif', bmp: 'image/bmp', webp: 'image/webp', svg: 'image/svg+xml', avif: 'image/avif', ico: 'image/x-icon', tiff: 'image/tiff' };
            const mime = mimeMap[ext] || 'image/jpeg';

            const loadAndCache = (data, m) => {
                const uri = `data:${m};base64,${data.toString('base64')}`;
                imgCache[imagePath] = uri;
                if (isMounted) setSrc(uri);
            };

            if (stats.size < 3 * 1024 * 1024) {
                loadAndCache(fs.readFileSync(imagePath), mime);
            } else {
                const cacheDir = path.join(os.tmpdir(), '.axo_gallery_imgcache');
                if (!fs.existsSync(cacheDir)) fs.mkdirSync(cacheDir, { recursive: true });
                const hash = crypto.createHash('md5').update(imagePath).digest('hex');
                const cachePath = path.join(cacheDir, `${hash}.jpg`);

                if (fs.existsSync(cachePath)) {
                    loadAndCache(fs.readFileSync(cachePath), 'image/jpeg');
                } else {
                    loadAndCache(fs.readFileSync(imagePath), mime);
                }
            }
        } catch (e) {
            if (isMounted) setFailed(true);
        }
        return () => { isMounted = false; };
    }, [imagePath, refreshKey]);

    if (failed) {
        return (
            <div className={`bg-zinc-800 flex items-center justify-center ${className}`}>
                <div className="text-zinc-600 text-xs">✕</div>
            </div>
        );
    }
    if (!src) {
        return (
            <div className={`bg-zinc-800 flex items-center justify-center ${className}`}>
                <div className="w-4 h-4 rounded-full border-2 border-white/5 border-t-white/40 animate-spin"></div>
            </div>
        );
    }
    return <img src={src} className={className} alt="Photo" loading="lazy" />;
};

// ─── MediaThumbnail — unified thumbnail for both images and videos ──
// `natural` prop: when true, uses natural aspect ratio (no object-cover cropping)
const MediaThumbnail = ({ item, className, natural, showDuration, hideOverlay, refreshKey }) => {
    const ext = item.name.split('.').pop().toLowerCase();
    const isVideo = VIDEO_EXTS.includes(ext);
    const fitClass = natural ? 'w-full h-auto object-contain' : 'w-full h-full object-cover';
    const [duration, setDuration] = useState(durationCache[item.path] || null);

    useEffect(() => {
        if (isVideo && showDuration !== false) {
            if (durationCache[item.path]) { setDuration(durationCache[item.path]); return; }
            probeVideoDuration(item.path, (dur) => setDuration(dur));
        }
    }, [item.path, isVideo]);

    return (
        <div className={`relative ${className}`}>
            {isVideo ? (
                <>
                    <VideoThumbnail videoPath={item.path} className={fitClass} refreshKey={refreshKey} />
                    {!hideOverlay && (
                        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                            <div className="w-7 h-7 rounded-full bg-black/60 backdrop-blur-sm flex items-center justify-center border border-white/10">
                                <img src={playIcon} className="w-3 h-3 filter brightness-0 invert ml-0.5" alt="play" />
                            </div>
                        </div>
                    )}
                    {!hideOverlay && duration && (
                        <div className="absolute bottom-1 right-1 bg-black/80 px-1 py-0.5 rounded-md text-[8px] font-bold text-zinc-200 pointer-events-none tabular-nums">
                            {duration}
                        </div>
                    )}
                </>
            ) : (
                <ImageThumbnail imagePath={item.path} className={fitClass} refreshKey={refreshKey} />
            )}
        </div>
    );
};

// ─── SortDropdown (same pattern as TVPlayer) ──────────────────────
const SortDropdown = ({ current, onChange, className, btnClassName }) => {
    const [isOpen, setIsOpen] = useState(false);
    const options = [
        { value: 'newest', label: 'Newest' },
        { value: 'oldest', label: 'Oldest' },
        { value: 'az', label: 'A-Z' },
        { value: 'za', label: 'Z-A' }
    ];

    return (
        <div className={`relative ${className}`}>
            <button
                onClick={() => setIsOpen(!isOpen)}
                className={`bg-zinc-900 border border-zinc-800 text-zinc-400 font-bold rounded-md hover:bg-zinc-800 hover:border-zinc-700 transition-all flex items-center gap-1.5 cursor-pointer ${btnClassName}`}
            >
                <span className="uppercase tracking-widest text-[10px]">{options.find(o => o.value === current)?.label}</span>
                <div className={`w-0 h-0 border-l-[4px] border-l-transparent border-r-[4px] border-r-transparent border-t-[4px] border-t-zinc-600 transition-transform ${isOpen ? 'rotate-180' : ''}`}></div>
            </button>

            {isOpen && (
                <>
                    <div className="fixed inset-0 z-40" onMouseDown={(e) => { if (e.target === e.currentTarget) { setIsOpen(false) } }}></div>
                    <div className="absolute top-full left-0 right-0 mt-1 bg-zinc-900 border border-zinc-800 rounded-md shadow-2xl z-50 overflow-hidden py-0.5 animate-in fade-in slide-in-from-top-2 duration-200">
                        {options.map(opt => (
                            <button
                                key={opt.value}
                                onClick={() => { onChange(opt.value); setIsOpen(false); }}
                                className={`w-full text-left px-3 py-1.5 text-[10px] font-bold uppercase tracking-widest hover:bg-white/5 transition-colors ${current === opt.value ? 'text-blue-400 bg-white/5' : 'text-zinc-500 hover:text-white'}`}
                            >
                                {opt.label}
                            </button>
                        ))}
                    </div>
                </>
            )}
        </div>
    );
};

// ─── File server for video playback in lightbox ───────────────────
let galleryServer = null;

const createGalleryFileServer = (filePath) => {
    return new Promise((resolve, reject) => {
        try {
            const http = window.require('http');
            const fs = window.require('fs');
            const path = window.require('path');

            if (galleryServer) { try { galleryServer.close(); } catch (e) { } galleryServer = null; }

            const ext = path.extname(filePath).slice(1).toLowerCase();
            const mimeTypes = {
                mp4: 'video/mp4', webm: 'video/webm', mov: 'video/mp4', mkv: 'video/x-matroska',
                avi: 'video/x-msvideo', flv: 'video/x-flv', wmv: 'video/x-ms-wmv',
                ogg: 'video/ogg'
            };
            const contentType = mimeTypes[ext] || 'video/mp4';

            const server = http.createServer((req, res) => {
                try {
                    const stat = fs.statSync(filePath);
                    const fileSize = stat.size;
                    const range = req.headers.range;

                    if (range) {
                        const parts = range.replace(/bytes=/, '').split('-');
                        const start = parseInt(parts[0], 10);
                        const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
                        res.writeHead(206, {
                            'Content-Range': `bytes ${start}-${end}/${fileSize}`,
                            'Accept-Ranges': 'bytes',
                            'Content-Length': end - start + 1,
                            'Content-Type': contentType,
                            'Access-Control-Allow-Origin': '*'
                        });
                        fs.createReadStream(filePath, { start, end }).pipe(res);
                    } else {
                        res.writeHead(200, {
                            'Content-Length': fileSize,
                            'Content-Type': contentType,
                            'Accept-Ranges': 'bytes',
                            'Access-Control-Allow-Origin': '*'
                        });
                        fs.createReadStream(filePath).pipe(res);
                    }
                } catch (err) {
                    res.writeHead(500);
                    res.end('Error');
                }
            });

            server.listen(0, '127.0.0.1', () => {
                const port = server.address().port;
                galleryServer = server;
                resolve(`http://127.0.0.1:${port}/video`);
            });
        } catch (err) {
            reject(err);
        }
    });
};

// ─── DockThumbnailStrip — iOS-style magnification dock ─────────────
const DOCK_BASE_SIZE = 48;      // px — base thumbnail width
const DOCK_BASE_HEIGHT = 36;    // px — base thumbnail height
const DOCK_MAX_SCALE = 1.9;     // hovered item scale
const DOCK_INFLUENCE = 3;       // how many neighbors are affected

const DockThumbnailStrip = ({ items, currentIndex, onNavigate, refreshKey }) => {
    const [hoveredIndex, setHoveredIndex] = useState(-1);
    const [mouseX, setMouseX] = useState(0);
    const stripRef = useRef(null);
    const itemRefs = useRef([]);

    const getScaleForIndex = useCallback((index) => {
        if (hoveredIndex === -1) return 1;
        const distance = Math.abs(index - hoveredIndex);
        if (distance === 0) return DOCK_MAX_SCALE;
        if (distance > DOCK_INFLUENCE) return 1;
        // Smooth cosine-based falloff for a natural magnification curve
        const ratio = distance / DOCK_INFLUENCE;
        const scale = 1 + (DOCK_MAX_SCALE - 1) * Math.cos((ratio * Math.PI) / 2);
        return Math.max(1, scale);
    }, [hoveredIndex]);

    const handleMouseMove = useCallback((e) => {
        if (!stripRef.current) return;
        const stripRect = stripRef.current.getBoundingClientRect();
        setMouseX(e.clientX - stripRect.left);

        // Find which item we're closest to
        let closestIdx = -1;
        let closestDist = Infinity;
        itemRefs.current.forEach((ref, idx) => {
            if (!ref) return;
            const rect = ref.getBoundingClientRect();
            const center = rect.left + rect.width / 2 - stripRect.left;
            const dist = Math.abs((e.clientX - stripRect.left) - center);
            if (dist < closestDist) {
                closestDist = dist;
                closestIdx = idx;
            }
        });
        if (closestDist < DOCK_BASE_SIZE * 1.5) {
            setHoveredIndex(closestIdx);
        } else {
            setHoveredIndex(-1);
        }
    }, []);

    const handleMouseLeave = useCallback(() => {
        setHoveredIndex(-1);
    }, []);

    // Convert vertical wheel scrolling into horizontal scrolling
    const handleWheel = useCallback((e) => {
        if (!stripRef.current) return;
        if (e.deltaY !== 0) {
            e.preventDefault();
            stripRef.current.scrollLeft += e.deltaY;
        }
    }, []);

    // Auto-scroll to center the active item when currentIndex changes
    useEffect(() => {
        const el = itemRefs.current[currentIndex];
        if (el) {
            el.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
        }
    }, [currentIndex]);

    return (
        <div className="absolute bottom-0 left-0 right-0 z-[10] pointer-events-none" style={{ paddingBottom: 6 }}>
            {/* Gradient backdrop so thumbnails are visible over media */}
            <div className="absolute inset-x-0 bottom-0 h-28 bg-gradient-to-t from-black/80 via-black/40 to-transparent pointer-events-none" />
            <div
                ref={stripRef}
                className="relative flex gap-[3px] overflow-x-auto custom-scrollbar pb-1 px-3 justify-center items-end pointer-events-auto"
                onMouseMove={handleMouseMove}
                onMouseLeave={handleMouseLeave}
                onWheel={handleWheel}
                style={{ minHeight: DOCK_BASE_HEIGHT * DOCK_MAX_SCALE + 8 }}
            >
                {items.map((t, i) => {
                    const scale = getScaleForIndex(i);
                    const w = DOCK_BASE_SIZE * scale;
                    const h = DOCK_BASE_HEIGHT * scale;
                    const isActive = i === currentIndex;

                    return (
                        <button
                            key={i}
                            ref={el => itemRefs.current[i] = el}
                            onClick={() => onNavigate(i)}
                            className="cursor-pointer rounded-lg overflow-hidden flex-shrink-0"
                            style={{
                                width: w,
                                height: h,
                                transition: 'width 0.25s cubic-bezier(0.34, 1.56, 0.64, 1), height 0.25s cubic-bezier(0.34, 1.56, 0.64, 1), opacity 0.2s ease, border-color 0.2s ease, box-shadow 0.2s ease',
                                opacity: isActive ? 1 : hoveredIndex === i ? 0.95 : 0.45,
                                border: isActive ? '2px solid rgb(59, 130, 246)' : hoveredIndex === i ? '2px solid rgba(255,255,255,0.3)' : '2px solid transparent',
                                boxShadow: hoveredIndex === i ? '0 8px 24px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.08)' : isActive ? '0 4px 12px rgba(59, 130, 246, 0.25)' : 'none',
                                borderRadius: '8px',
                                transform: 'translateZ(0)', // GPU acceleration
                            }}
                        >
                            <MediaThumbnail item={t} className="w-full h-full" hideOverlay refreshKey={refreshKey} />
                        </button>
                    );
                })}
            </div>
        </div>
    );
};

// ─── Lightbox Component ─────────────────────────────────────────
const Lightbox = ({ items, currentIndex, onClose, onNavigate, refreshKey }) => {
    const [imageSrc, setImageSrc] = useState(null);
    const [videoSrc, setVideoSrc] = useState(null);
    const [isLoading, setIsLoading] = useState(true);
    const videoRef = useRef(null);
    const item = items[currentIndex];
    const ext = item?.name.split('.').pop().toLowerCase();
    const isVideo = VIDEO_EXTS.includes(ext);

    // Mute persistence
    const getStoredMuted = () => {
        try { return localStorage.getItem('gallery_muted') === 'true'; } catch { return false; }
    };
    const [isMuted, setIsMuted] = useState(getStoredMuted);

    useEffect(() => {
        setIsLoading(true);
        setImageSrc(null);
        setVideoSrc(null);

        if (!item) return;

        if (isVideo) {
            createGalleryFileServer(item.path).then(url => {
                setVideoSrc(url);
                setIsLoading(false);
            }).catch(() => setIsLoading(false));
        } else {
            try {
                const fs = window.require('fs');
                const path = window.require('path');
                const imgExt = path.extname(item.path).slice(1).toLowerCase();
                const mimeMap = { jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', gif: 'image/gif', bmp: 'image/bmp', webp: 'image/webp', svg: 'image/svg+xml', avif: 'image/avif', ico: 'image/x-icon', tiff: 'image/tiff' };
                const mime = mimeMap[imgExt] || 'image/jpeg';
                const data = fs.readFileSync(item.path);
                setImageSrc(`data:${mime};base64,${data.toString('base64')}`);
                setIsLoading(false);
            } catch (e) {
                setIsLoading(false);
            }
        }

        return () => {
            if (galleryServer) { try { galleryServer.close(); } catch (e) { } galleryServer = null; }
        };
    }, [currentIndex, item]);

    // Apply mute state when video loads
    useEffect(() => {
        if (videoRef.current) {
            videoRef.current.muted = isMuted;
        }
    }, [videoSrc, isMuted]);

    // Listen for mute toggle on the video element itself
    useEffect(() => {
        const vid = videoRef.current;
        if (!vid) return;
        const onVolumeChange = () => {
            const muted = vid.muted;
            setIsMuted(muted);
            try { localStorage.setItem('gallery_muted', muted ? 'true' : 'false'); } catch { }
        };
        vid.addEventListener('volumechange', onVolumeChange);
        return () => vid.removeEventListener('volumechange', onVolumeChange);
    }, [videoSrc]);

    // Keyboard navigation: Escape, Arrow Left/Q, Arrow Right/E, Space
    useEffect(() => {
        const handleKey = (e) => {
            if (e.key === 'Escape') onClose();
            if ((e.key === 'ArrowLeft' || e.key === 'q' || e.key === 'Q') && currentIndex > 0) onNavigate(currentIndex - 1);
            if ((e.key === 'ArrowRight' || e.key === 'e' || e.key === 'E') && currentIndex < items.length - 1) onNavigate(currentIndex + 1);
            if (e.key === ' ' || e.code === 'Space') {
                e.preventDefault();
                if (videoRef.current) {
                    if (videoRef.current.paused) videoRef.current.play();
                    else videoRef.current.pause();
                }
            }
        };
        window.addEventListener('keydown', handleKey);
        return () => window.removeEventListener('keydown', handleKey);
    }, [currentIndex, items.length, onClose, onNavigate]);

    if (!item) return null;

    return (
        <div className="fixed top-0 right-0 bottom-0 left-12 z-[500] bg-black/95 backdrop-blur-xl flex flex-col animate-in fade-in duration-200">
            {/* Top bar */}
            <div className="flex items-center gap-2 px-3 py-1 shrink-0 z-[11]">
                <button onClick={onClose} className="p-1 hover:bg-white/10 rounded-md transition-colors cursor-pointer shrink-0">
                    <img src={closeIcon} className="w-4 h-4 filter brightness-0 invert opacity-60" alt="close" />
                </button>
                <h3 className="text-xs font-semibold text-white truncate min-w-0 flex-1">{item.name.replace(/\.[^.]+$/, '')}</h3>
                <span className="text-[10px] text-zinc-500 shrink-0">{currentIndex + 1} / {items.length}</span>
            </div>

            {/* Media — takes full remaining space */}
            <div className="flex-1 relative flex items-center justify-center overflow-hidden px-10 pb-16">
                {isLoading ? (
                    <div className="w-10 h-10 rounded-full border-2 border-white/10 border-t-white/50 animate-spin"></div>
                ) : isVideo && videoSrc ? (
                    <video
                        ref={videoRef}
                        src={videoSrc}
                        controls
                        autoPlay
                        loop
                        muted={isMuted}
                        className="max-w-full max-h-full rounded-md shadow-2xl"
                        style={{ maxHeight: 'calc(100vh - 110px)' }}
                    />
                ) : imageSrc ? (
                    <img
                        src={imageSrc}
                        className="max-w-full max-h-full object-contain rounded-md shadow-2xl select-none"
                        style={{ maxHeight: 'calc(100vh - 110px)' }}
                        alt={item.name}
                        draggable={false}
                    />
                ) : (
                    <div className="text-zinc-600 text-sm">Failed to load media</div>
                )}

                {/* Nav arrows */}
                {currentIndex > 0 && (
                    <button
                        onClick={() => onNavigate(currentIndex - 1)}
                        className="absolute left-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-md bg-black/60 hover:bg-white/10 border border-white/10 flex items-center justify-center transition-all cursor-pointer"
                    >
                        <img src={chevronLeftIcon} className="w-4 h-4 filter brightness-0 invert opacity-70" alt="prev" />
                    </button>
                )}
                {currentIndex < items.length - 1 && (
                    <button
                        onClick={() => onNavigate(currentIndex + 1)}
                        className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-md bg-black/60 hover:bg-white/10 border border-white/10 flex items-center justify-center transition-all cursor-pointer"
                    >
                        <img src={chevronRightIcon} className="w-4 h-4 filter brightness-0 invert opacity-70" alt="next" />
                    </button>
                )}

                {/* Bottom strip — iOS dock-style magnification thumbnails (overlays on media) */}
                <DockThumbnailStrip items={items} currentIndex={currentIndex} onNavigate={onNavigate} refreshKey={refreshKey} />
            </div>
        </div>
    );
};


// ─── Main Gallery Component ───────────────────────────────────────
const Gallery = ({ showNavbar = true, onViewingMedia }) => {
    const [albums, setAlbums] = useState([]);
    const [loading, setLoading] = useState(true);
    const [currentView, setCurrentView] = useState('albums'); // 'albums' | 'album' | 'all'
    const [selectedAlbum, setSelectedAlbum] = useState(null);
    const [search, setSearch] = useState('');
    const [lightboxIndex, setLightboxIndex] = useState(-1);
    const [viewMode, setViewMode] = useState('grid'); // 'grid' | 'list'
    const [refreshKey, setRefreshKey] = useState(0);
    const [mediaTypeFilter, setMediaTypeFilter] = useState(() => {
        try { return localStorage.getItem('gallery_media_type_filter') || 'all'; } catch { return 'all'; }
    }); // 'all' | 'images' | 'videos'

    // Per-album sort persistence (same pattern as MusicPlayer's per-playlist sorting)
    const [sortOrders, setSortOrders] = useState(() => {
        try {
            const saved = localStorage.getItem('gallery_sort_preferences');
            return saved ? JSON.parse(saved) : { _albums: 'newest', _all: 'newest' };
        } catch (e) {
            return { _albums: 'newest', _all: 'newest' };
        }
    });

    const currentSortKey = currentView === 'albums' ? '_albums' : currentView === 'all' ? '_all' : (selectedAlbum?.name || '_albums');
    const sortOption = sortOrders[currentSortKey] || 'newest';

    const handleSortChange = (newOrder) => {
        const updated = { ...sortOrders, [currentSortKey]: newOrder };
        setSortOrders(updated);
        localStorage.setItem('gallery_sort_preferences', JSON.stringify(updated));
    };

    // ─── Helpers ──────────────────────────────────────────────────
    const sortData = (data, option) => {
        const sorted = [...data];
        switch (option) {
            case 'newest': return sorted.sort((a, b) => new Date(b.mtime) - new Date(a.mtime));
            case 'oldest': return sorted.sort((a, b) => new Date(a.mtime) - new Date(b.mtime));
            case 'az': return sorted.sort((a, b) => a.name.localeCompare(b.name));
            case 'za': return sorted.sort((a, b) => b.name.localeCompare(a.name));
            default: return sorted;
        }
    };

    const applyMediaTypeFilter = (items) => {
        if (mediaTypeFilter === 'images') return items.filter(m => IMAGE_EXTS.includes(m.name.split('.').pop().toLowerCase()));
        if (mediaTypeFilter === 'videos') return items.filter(m => VIDEO_EXTS.includes(m.name.split('.').pop().toLowerCase()));
        return items;
    };

    // ─── Filtered data ────────────────────────────────────────────
    const filteredAlbums = useMemo(() =>
        sortData(albums.filter(a => a.name.toLowerCase().includes(search.toLowerCase())), sortOption),
        [albums, search, sortOption]
    );

    const currentMedia = useMemo(() => {
        const actualAlbum = selectedAlbum ? albums.find(a => a.path === selectedAlbum.path) : null;
        if (currentView === 'all') {
            const all = albums.flatMap(a => a.media);
            return sortData(
                applyMediaTypeFilter(all.filter(m => m.name.toLowerCase().includes(search.toLowerCase()))),
                sortOption
            );
        }
        if (actualAlbum) {
            return sortData(
                applyMediaTypeFilter(actualAlbum.media.filter(m => m.name.toLowerCase().includes(search.toLowerCase()))),
                sortOption
            );
        }
        return [];
    }, [selectedAlbum, currentView, albums, search, sortOption, mediaTypeFilter]);

    // ─── Scan library ─────────────────────────────────────────────
    const scanGallery = useCallback(() => {
        try {
            const fs = window.require('fs');
            const path = window.require('path');

            if (!fs.existsSync(GALLERY_PATH)) {
                setLoading(false);
                return;
            }

            const entries = fs.readdirSync(GALLERY_PATH);
            const albumData = [];

            // Collect root-level media files as "Unsorted" album
            const rootMedia = [];

            entries.forEach(entry => {
                const fullPath = path.join(GALLERY_PATH, entry);
                const stat = fs.statSync(fullPath);

                if (stat.isDirectory()) {
                    // Scan folder for media recursively (1 level deep)
                    const files = fs.readdirSync(fullPath);
                    const media = files
                        .filter(f => {
                            const ext = f.split('.').pop().toLowerCase();
                            return ALL_MEDIA_EXTS.includes(ext);
                        })
                        .map(f => {
                            const filePath = path.join(fullPath, f);
                            const fileStat = fs.statSync(filePath);
                            return {
                                name: f,
                                path: filePath,
                                mtime: fileStat.birthtime,
                                size: fileStat.size
                            };
                        });

                    if (media.length > 0) {
                        albumData.push({
                            name: entry,
                            path: fullPath,
                            media,
                            mtime: stat.birthtime,
                            coverItem: media[0]
                        });
                    }
                } else {
                    const ext = entry.split('.').pop().toLowerCase();
                    if (ALL_MEDIA_EXTS.includes(ext)) {
                        rootMedia.push({
                            name: entry,
                            path: fullPath,
                            mtime: stat.birthtime,
                            size: stat.size
                        });
                    }
                }
            });

            if (rootMedia.length > 0) {
                albumData.unshift({
                    name: 'Unsorted',
                    path: GALLERY_PATH,
                    media: rootMedia,
                    mtime: new Date(),
                    coverItem: rootMedia[0],
                    isRoot: true
                });
            }

            setAlbums(albumData);
            setLoading(false);
        } catch (err) {
            console.error('[Gallery] Scan Error:', err);
            setLoading(false);
        }
    }, []);

    const clearCache = useCallback(() => {
        try {
            // Memory clear
            Object.keys(thumbCache).forEach(k => delete thumbCache[k]);
            Object.keys(imgCache).forEach(k => delete imgCache[k]);
            Object.keys(durationCache).forEach(k => delete durationCache[k]);

            // Disk clear
            const fs = window.require('fs');
            const path = window.require('path');
            const os = window.require('os');
            const cacheDirs = [
                path.join(os.tmpdir(), '.axo_gallery_thumbcache'),
                path.join(os.tmpdir(), '.axo_gallery_durcache'),
                path.join(os.tmpdir(), '.axo_gallery_imgcache')
            ];

            cacheDirs.forEach(dir => {
                if (fs.existsSync(dir)) {
                    const files = fs.readdirSync(dir);
                    files.forEach(f => {
                        try { fs.unlinkSync(path.join(dir, f)); } catch (e) { }
                    });
                }
            });

            // Force Re-render and re-scan
            setRefreshKey(prev => prev + 1);
            scanGallery();
        } catch (e) { console.error('Cache clear error:', e); }
    }, [scanGallery]);

    useEffect(() => {
        scanGallery();
        return () => {
            if (galleryServer) { try { galleryServer.close(); } catch (e) { } galleryServer = null; }
        };
    }, [scanGallery]);

    // ─── Selection state (same pattern as MusicContext) ───────────
    const [selectedItems, setSelectedItems] = useState([]);
    const [lastSelectedIndex, setLastSelectedIndex] = useState(-1);

    // Keep selectedAlbum in sync with the master albums list after a scan
    useEffect(() => {
        if (selectedAlbum) {
            const fresh = albums.find(a => a.path === selectedAlbum.path);
            if (fresh) setSelectedAlbum(fresh);
        }
    }, [albums]);

    const [contextMenu, setContextMenu] = useState(null);
    const [albumSelector, setAlbumSelector] = useState(null); // { action: 'move' | 'copy' }
    const [newAlbumName, setNewAlbumName] = useState('');
    const [isCreatingNewAlbum, setIsCreatingNewAlbum] = useState(false);
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
    const [albumContextMenu, setAlbumContextMenu] = useState(null); // { x, y, album }
    const [showAlbumDeleteConfirm, setShowAlbumDeleteConfirm] = useState(null); // album to delete

    const selectedPaths = useMemo(() => new Set(selectedItems.map(s => s.path)), [selectedItems]);

    const handleSelect = useCallback((item, index, allItems, isCtrl, isShift) => {
        setSelectedItems(prev => {
            if (isShift && lastSelectedIndex !== -1) {
                const start = Math.min(lastSelectedIndex, index);
                const end = Math.max(lastSelectedIndex, index);
                const range = allItems.slice(start, end + 1);
                
                const newMap = new Map();
                // Preserve previous selection from other views/albums
                prev.forEach(s => newMap.set(s.path, s));
                // Add new range
                range.forEach(s => newMap.set(s.path, s));
                return Array.from(newMap.values());
            }
            if (isCtrl) {
                const exists = prev.find(s => s.path === item.path);
                setLastSelectedIndex(index);
                if (exists) return prev.filter(s => s.path !== item.path);
                return [...prev, item];
            }
            setLastSelectedIndex(index);
            return [item];
        });
    }, [lastSelectedIndex]);

    const selectAll = useCallback(() => {
        const newMap = new Map();
        selectedItems.forEach(s => newMap.set(s.path, s));
        currentMedia.forEach(s => newMap.set(s.path, s));
        setSelectedItems(Array.from(newMap.values()));
    }, [currentMedia, selectedItems]);

    const clearSelection = useCallback(() => {
        setSelectedItems([]);
        setLastSelectedIndex(-1);
    }, []);

    // Global click to deselect
    useEffect(() => {
        const handleGlobalClick = (e) => {
            if (e.button !== 0) return;
            if (e.ctrlKey || e.metaKey) return;
            if (e.target.closest('.gallery-context-menu') || e.target.closest('.gallery-album-selector') || e.target.closest('.gallery-delete-modal') || e.target.closest('.gallery-selection-bar')) return;
            if (e.target.closest('.gallery-media-item')) return;
            if (selectedItems.length > 0) clearSelection();
            setContextMenu(null);
            setAlbumSelector(null);
        };
        window.addEventListener('mousedown', handleGlobalClick);
        return () => window.removeEventListener('mousedown', handleGlobalClick);
    }, [selectedItems, clearSelection]);

    // ─── Move / Copy / Delete ─────────────────────────────────────
    const moveItems = useCallback(async (targetAlbumName) => {
        const fs = window.require('fs');
        const path = window.require('path');
        const targetDir = path.join(GALLERY_PATH, targetAlbumName);
        if (!fs.existsSync(targetDir)) fs.mkdirSync(targetDir, { recursive: true });
        
        const itemsToMove = [...selectedItems];
        clearSelection();

        await Promise.all(itemsToMove.map(async (item) => {
            const dest = path.join(targetDir, path.basename(item.path));
            try { await fs.promises.rename(item.path, dest); } catch (e) { console.error(`Move error:`, e); }
        }));
        
        // Small delay to allow FS to settle before re-scanning
        setTimeout(scanGallery, 300);
    }, [selectedItems, clearSelection, scanGallery]);

    const copyItems = useCallback(async (targetAlbumName) => {
        const fs = window.require('fs');
        const path = window.require('path');
        const targetDir = path.join(GALLERY_PATH, targetAlbumName);
        if (!fs.existsSync(targetDir)) fs.mkdirSync(targetDir, { recursive: true });
        
        const itemsToCopy = [...selectedItems];
        clearSelection();

        await Promise.all(itemsToCopy.map(async (item) => {
            const dest = path.join(targetDir, path.basename(item.path));
            try { await fs.promises.copyFile(item.path, dest); } catch (e) { console.error(`Copy error:`, e); }
        }));
        
        setTimeout(scanGallery, 300);
    }, [selectedItems, clearSelection, scanGallery]);

    const deleteItems = useCallback(async () => {
        try {
            const fs = window.require('fs');
            const itemsToDelete = [...selectedItems];
            const pathsToDelete = new Set(itemsToDelete.map(s => s.path));
            
            clearSelection();

            // Use sync unlinks for mass operations to avoid race conditions with re-scanning
            // and ensure the OS handles them in order.
            for (const item of itemsToDelete) {
                try {
                    if (fs.existsSync(item.path)) {
                        fs.unlinkSync(item.path);
                    }
                } catch (e) {
                    console.error(`Delete error for ${item.path}:`, e);
                }
            }
            
            // Immediate optimistic UI update
            setAlbums(prev => prev.map(album => ({
                ...album,
                media: album.media.filter(m => !pathsToDelete.has(m.path))
            })));

            // Re-scan after a short delay to finalize
            setTimeout(scanGallery, 500);
        } catch (err) {
            console.error('Mass delete failed:', err);
        }
    }, [selectedItems, clearSelection, scanGallery]);

    // Delete entire album (folder + contents)
    const deleteAlbum = useCallback(async (album) => {
        if (!album || album.isRoot) return;
        try {
            const fs = window.require('fs');
            const path = window.require('path');
            // Delete all media files in the album
            for (const item of album.media) {
                try { await fs.promises.unlink(item.path); } catch (e) { console.error(`Delete file error:`, e); }
            }
            // Try to remove the directory (will only work if empty)
            try { await fs.promises.rmdir(album.path); } catch (e) {
                // If not empty (has non-media files), use recursive removal
                try {
                    const remaining = fs.readdirSync(album.path);
                    for (const f of remaining) {
                        await fs.promises.unlink(path.join(album.path, f));
                    }
                    await fs.promises.rmdir(album.path);
                } catch (e2) { console.error('Folder removal error:', e2); }
            }
            // If we were viewing this album, go back to albums
            if (selectedAlbum?.name === album.name) {
                backToAlbums();
            }
            scanGallery();
        } catch (e) {
            console.error('Album delete error:', e);
        }
    }, [selectedAlbum, scanGallery]);





    // ─── Counters ─────────────────────────────────────────────────
    const totalPhotos = useMemo(() => {
        return albums.reduce((sum, a) => {
            return sum + a.media.filter(m => IMAGE_EXTS.includes(m.name.split('.').pop().toLowerCase())).length;
        }, 0);
    }, [albums]);

    const totalVideos = useMemo(() => {
        return albums.reduce((sum, a) => {
            return sum + a.media.filter(m => VIDEO_EXTS.includes(m.name.split('.').pop().toLowerCase())).length;
        }, 0);
    }, [albums]);

    // ─── Handlers ─────────────────────────────────────────────────
    const openAlbum = (album) => {
        setSelectedAlbum(album);
        setCurrentView('album');
        setSearch('');
        clearSelection();
    };

    const backToAlbums = () => {
        setCurrentView('albums');
        setSelectedAlbum(null);
        setSearch('');
        clearSelection();
    };

    const openLightbox = (index) => {
        setLightboxIndex(index);
    };

    const showAllMedia = () => {
        setCurrentView('all');
        setSelectedAlbum(null);
        setSearch('');
        clearSelection();
    };

    // Notify parent when viewing media (lightbox open)
    useEffect(() => {
        if (onViewingMedia) {
            onViewingMedia(lightboxIndex >= 0);
        }
    }, [lightboxIndex, onViewingMedia]);

    // ─── Format file size ─────────────────────────────────────────
    const formatSize = (bytes) => {
        if (bytes < 1024) return `${bytes} B`;
        if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
        if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
        return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
    };

    // ─── Open folder in explorer ──────────────────────────────────
    const openInExplorer = (folderPath) => {
        try {
            const { exec } = window.require('child_process');
            exec(`explorer "${folderPath}"`);
        } catch (e) { }
    };

    // ─── Media item click handler ─────────────────────────────────
    const handleMediaClick = (e, item, index) => {
        if (e.ctrlKey || e.metaKey || e.shiftKey) {
            e.preventDefault();
            handleSelect(item, index, currentMedia, e.ctrlKey || e.metaKey, e.shiftKey);
        } else if (selectedItems.length > 0) {
            handleSelect(item, index, currentMedia, false, false);
        } else {
            openLightbox(index);
        }
    };

    const handleMediaContextMenu = (e, item) => {
        e.preventDefault();
        if (!selectedPaths.has(item.path)) {
            setSelectedItems([item]);
            setLastSelectedIndex(-1);
        }
        setContextMenu({ x: e.clientX, y: e.clientY });
    };

    return (
        <div className={`h-screen w-full bg-black text-zinc-200 overflow-hidden flex flex-col ${showNavbar ? 'pl-12' : ''}`}>
            {showNavbar && <Navbar />}

            {/* ──── Albums Grid View ──── */}
            {currentView === 'albums' && (
                <div className="flex-1 flex flex-col overflow-hidden">
                    {/* Header */}
                    <div className="px-4 pt-3 pb-1 shrink-0">
                        <div className="flex items-end justify-between mb-2">
                            <div>
                                <h1 className="text-2xl font-black text-white tracking-tight">Gallery</h1>
                                <p className="text-[11px] text-zinc-500 mt-1 font-medium">
                                    {albums.length} albums · {totalPhotos} photos · {totalVideos} videos
                                </p>
                            </div>
                            <div className="flex items-center gap-1">
                                <button
                                    onClick={showAllMedia}
                                    className="bg-zinc-900 border border-zinc-800 text-zinc-400 hover:text-white hover:border-zinc-600 px-2 py-1.5 rounded-md text-[10px] font-bold uppercase tracking-widest transition-all cursor-pointer"
                                >
                                    All Media
                                </button>
                                <button
                                    onClick={() => openInExplorer(GALLERY_PATH)}
                                    className="bg-zinc-900 border border-zinc-800 text-zinc-400 hover:text-white hover:border-zinc-600 p-1.5 rounded-md transition-all cursor-pointer"
                                    title="Open in Explorer"
                                >
                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" /><polyline points="15 3 21 3 21 9" /><line x1="10" y1="14" x2="21" y2="3" /></svg>
                                </button>
                            </div>
                        </div>
                        <div className="flex items-center gap-1.5">
                            <SortDropdown current={sortOption} onChange={handleSortChange} btnClassName="px-2 py-1.5 text-xs min-w-[80px]" />
                            <div className="relative">
                                <input
                                    type="text"
                                    placeholder="Search albums..."
                                    value={search}
                                    onChange={(e) => { 
                                        setSearch(e.target.value); 
                                        clearSelection(); 
                                    }}
                                    className="bg-zinc-900/80 border border-zinc-800/80 text-xs font-medium rounded-md px-2 py-1.5 w-44 outline-none focus:border-zinc-600 transition-all text-white placeholder:text-zinc-600"
                                />
                                <img src={searchIcon} className="absolute right-3 top-1/2 -translate-y-1/2 w-3 h-3 filter brightness-0 invert opacity-20" alt="search" />
                            </div>
                        </div>
                    </div>

                    {/* Albums Grid */}
                    <div className="flex-1 overflow-y-auto custom-scrollbar px-4 pb-4">
                        {loading ? (
                            <div className="flex items-center justify-center h-full opacity-50">
                                <img src={loaderIcon} className="w-8 h-8 filter brightness-0 invert animate-spin opacity-20" alt="loading" />
                            </div>
                        ) : filteredAlbums.length === 0 ? (
                            <div className="text-center py-20 opacity-30">
                                <img src={conceptsIcon} className="w-12 h-12 filter brightness-0 invert opacity-20 mb-4 mx-auto" alt="empty" />
                                <p className="text-xl font-bold uppercase tracking-widest">No Albums Found</p>
                                <p className="text-xs text-zinc-500 mt-2">Add folders with photos or videos to <span className="text-zinc-400 font-mono">{GALLERY_PATH}</span></p>
                            </div>
                        ) : (
                            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-1.5 content-start pt-2">
                                {filteredAlbums.map((album) => {
                                    const photoCount = album.media.filter(m => IMAGE_EXTS.includes(m.name.split('.').pop().toLowerCase())).length;
                                    const videoCount = album.media.filter(m => VIDEO_EXTS.includes(m.name.split('.').pop().toLowerCase())).length;

                                    return (
                                        <button
                                            key={album.name}
                                            onClick={() => openAlbum(album)}
                                            onContextMenu={(e) => {
                                                if (!album.isRoot) {
                                                    e.preventDefault();
                                                    setAlbumContextMenu({ x: e.clientX, y: e.clientY, album });
                                                }
                                            }}
                                            className="group relative aspect-square bg-zinc-900 rounded-md border border-zinc-800/60 hover:border-zinc-600 overflow-hidden transition-all duration-300 hover:scale-[1.02] text-left cursor-pointer"
                                        >
                                            {/* Cover image — stack preview of first 3 */}
                                            <div className="absolute inset-0 bg-zinc-900">
                                                {album.coverItem && (
                                                    <MediaThumbnail
                                                        item={album.coverItem}
                                                        className="w-full h-full opacity-50 group-hover:opacity-75 transition-opacity duration-500 group-hover:scale-105"
                                                        refreshKey={refreshKey}
                                                    />
                                                )}
                                                <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-black/10"></div>
                                            </div>

                                            {/* Badge */}
                                            <div className="absolute top-1 right-1 flex gap-0.5 z-10">
                                                {photoCount > 0 && (
                                                    <span className="bg-black/70 backdrop-blur-sm px-1.5 py-0.5 rounded-md text-[8px] font-bold text-zinc-300 border border-white/5">
                                                        {photoCount} 📷
                                                    </span>
                                                )}
                                                {videoCount > 0 && (
                                                    <span className="bg-black/70 backdrop-blur-sm px-1.5 py-0.5 rounded-md text-[8px] font-bold text-zinc-300 border border-white/5">
                                                        {videoCount} 🎬
                                                    </span>
                                                )}
                                            </div>

                                            {/* Album info */}
                                            <div className="p-2 absolute bottom-0 left-0 right-0 z-10">
                                                <h3 className="text-sm font-bold text-white leading-snug line-clamp-2 group-hover:text-blue-400 transition-colors duration-300">
                                                    {album.name}
                                                </h3>
                                                <p className="text-[10px] text-zinc-500 mt-0.5 font-medium">
                                                    {album.media.length} items
                                                </p>
                                            </div>

                                            {/* Hover glow */}
                                            <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none bg-gradient-to-br from-blue-500/5 via-transparent to-purple-500/5"></div>
                                        </button>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* ──── Album Detail / All Media View ──── */}
            {(currentView === 'album' || currentView === 'all') && (
                <div className="flex-1 flex flex-col overflow-hidden">
                    {/* Header */}
                    <div className="px-4 pt-3 pb-1 shrink-0">
                        <div className="flex items-center gap-2 mb-2">
                            <button
                                onClick={backToAlbums}
                                className="flex items-center gap-1.5 text-zinc-400 hover:text-white transition-colors px-2 py-1.5 rounded-md hover:bg-zinc-800 border border-zinc-800 cursor-pointer"
                            >
                                <img src={chevronLeftIcon} className="w-4 h-4 filter brightness-0 invert opacity-60" alt="back" />
                                <span className="text-xs font-bold uppercase tracking-widest">Back</span>
                            </button>
                            {selectedAlbum && !selectedAlbum.isRoot && (
                                <button
                                    onClick={() => openInExplorer(selectedAlbum.path)}
                                    className="flex items-center gap-1.5 text-zinc-500 hover:text-white transition-colors px-2 py-1.5 rounded-md hover:bg-zinc-800 border border-zinc-800 cursor-pointer"
                                >
                                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" /><polyline points="15 3 21 3 21 9" /><line x1="10" y1="14" x2="21" y2="3" /></svg>
                                    <span className="text-[10px] font-bold uppercase tracking-widest">Open Folder</span>
                                </button>
                            )}
                            <div className="min-w-0 flex-1">
                                <h1 className="text-xl font-black text-white tracking-tight truncate">
                                    {currentView === 'all' ? 'All Media' : selectedAlbum?.name}
                                </h1>
                            </div>
                        </div>
                        <div className="flex items-center gap-1.5">
                            <SortDropdown current={sortOption} onChange={handleSortChange} btnClassName="px-2 py-1.5 text-xs min-w-[80px]" />
                            {/* Media type filter */}
                            <div className="flex bg-zinc-900 border border-zinc-800 rounded-md overflow-hidden">
                                {['all', 'images', 'videos'].map(type => (
                                    <button
                                        key={type}
                                        onClick={() => {
                                            setMediaTypeFilter(type);
                                            try { localStorage.setItem('gallery_media_type_filter', type); } catch { }
                                        }}
                                        className={`px-2 py-1.5 text-[10px] font-bold uppercase tracking-widest transition-colors cursor-pointer ${mediaTypeFilter === type ? 'bg-white/10 text-white' : 'text-zinc-500 hover:text-white'}`}
                                    >
                                        {type === 'all' ? 'All' : type === 'images' ? '📷' : '🎬'}
                                    </button>
                                ))}
                            </div>
                            {/* Select All button */}
                            {(currentView === 'album' || currentView === 'all') && (
                                <button
                                    onClick={selectAll}
                                    className="bg-zinc-900 border border-zinc-800 text-zinc-500 hover:text-white hover:border-zinc-600 px-2 py-1.5 rounded-md text-[10px] font-bold uppercase tracking-widest transition-all cursor-pointer"
                                >
                                    Select All
                                </button>
                            )}
                            <div className="relative">
                                <input
                                    type="text"
                                    placeholder="Search media..."
                                    value={search}
                                    onChange={(e) => { 
                                        setSearch(e.target.value); 
                                        clearSelection(); 
                                    }}
                                    className="bg-zinc-900/80 border border-zinc-800/80 text-xs font-medium rounded-md px-2 py-1.5 w-44 outline-none focus:border-zinc-600 transition-all text-white placeholder:text-zinc-600"
                                />
                                <img src={searchIcon} className="absolute right-3 top-1/2 -translate-y-1/2 w-3 h-3 filter brightness-0 invert opacity-20" alt="search" />
                            </div>
                            {/* View mode toggle */}
                            <div className="flex bg-zinc-900 border border-zinc-800 rounded-md overflow-hidden">
                                <button
                                    onClick={() => setViewMode('grid')}
                                    className={`px-2 py-1.5 text-[10px] font-bold uppercase tracking-widest transition-colors cursor-pointer ${viewMode === 'grid' ? 'bg-white/10 text-white' : 'text-zinc-500 hover:text-white'}`}
                                >
                                    <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" /><rect x="3" y="14" width="7" height="7" rx="1" /><rect x="14" y="14" width="7" height="7" rx="1" /></svg>
                                </button>
                                <button
                                    onClick={() => setViewMode('list')}
                                    className={`px-2 py-1.5 text-[10px] font-bold uppercase tracking-widest transition-colors cursor-pointer ${viewMode === 'list' ? 'bg-white/10 text-white' : 'text-zinc-500 hover:text-white'}`}
                                >
                                    <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><rect x="3" y="4" width="18" height="3" rx="1" /><rect x="3" y="10.5" width="18" height="3" rx="1" /><rect x="3" y="17" width="18" height="3" rx="1" /></svg>
                                </button>
                            </div>
                            <button
                                onClick={clearCache}
                                className="bg-zinc-900 border border-zinc-800 text-zinc-500 hover:text-white hover:border-zinc-600 p-1.5 px-2 rounded-md transition-all cursor-pointer flex items-center gap-1.5 ml-1"
                                title="Refresh all thumbnails"
                            >
                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="23 4 23 10 17 10" /><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" /></svg>
                                <span className="text-[10px] font-bold uppercase tracking-widest">Refresh</span>
                            </button>
                        </div>
                    </div>

                    {/* Media Grid */}
                    <div className="flex-1 overflow-y-auto custom-scrollbar px-4 pb-4">
                        {currentMedia.length === 0 ? (
                            <div className="text-center py-20 opacity-30">
                                <p className="text-xl font-bold uppercase tracking-widest">No Media Found</p>
                            </div>
                        ) : viewMode === 'grid' ? (
                            <div className="pt-2" style={{ columns: 'auto 180px', columnGap: '4px' }}>
                                {currentMedia.map((item, index) => {
                                    const ext = item.name.split('.').pop().toLowerCase();
                                    const isVid = VIDEO_EXTS.includes(ext);
                                    const isSel = selectedPaths.has(item.path);
                                    return (
                                        <button
                                            key={item.path}
                                            onClick={(e) => handleMediaClick(e, item, index)}
                                            onContextMenu={(e) => handleMediaContextMenu(e, item)}
                                            className={`gallery-media-item group relative bg-zinc-900 rounded-md overflow-hidden border transition-all duration-200 cursor-pointer w-full ${isSel ? 'border-blue-500 ring-1 ring-blue-500/30' : 'border-zinc-800/40 hover:border-zinc-600'}`}
                                            style={{ breakInside: 'avoid', marginBottom: '4px', display: 'inline-block' }}
                                        >
                                            {isSel && (
                                                <div className="absolute top-1 right-1 z-20 w-4 h-4 bg-blue-500 rounded-full border-2 border-black flex items-center justify-center">
                                                    <div className="w-1.5 h-1.5 bg-white rounded-full" />
                                                </div>
                                            )}
                                            <MediaThumbnail
                                                item={item}
                                                className={`w-full transition-opacity duration-300 ${isSel ? 'opacity-70' : 'opacity-80 group-hover:opacity-100'}`}
                                                natural
                                                refreshKey={refreshKey}
                                            />
                                            {isVid && (
                                                <div className="absolute top-1 left-1 bg-black/60 backdrop-blur-sm px-1 py-0.5 rounded-md text-[8px] font-bold text-zinc-300 border border-white/5">
                                                    VIDEO
                                                </div>
                                            )}
                                            <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-1 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                                                <p className="text-[9px] font-medium text-white truncate">{item.name.replace(/\.[^.]+$/, '')}</p>
                                            </div>
                                        </button>
                                    );
                                })}
                            </div>
                        ) : (
                            /* List view */
                            <div className="space-y-0.5 pt-2">
                                {currentMedia.map((item, index) => {
                                    const ext = item.name.split('.').pop().toLowerCase();
                                    const isVid = VIDEO_EXTS.includes(ext);
                                    const isSel = selectedPaths.has(item.path);
                                    return (
                                        <button
                                            key={item.path}
                                            onClick={(e) => handleMediaClick(e, item, index)}
                                            onContextMenu={(e) => handleMediaContextMenu(e, item)}
                                            className={`gallery-media-item w-full flex items-center gap-2 p-1 rounded-md transition-all cursor-pointer text-left ${isSel ? 'bg-blue-500/10 border border-blue-500/40' : 'hover:bg-zinc-900/60 border border-transparent hover:border-zinc-800'}`}
                                        >
                                            {isSel && (
                                                <div className="w-4 h-4 bg-blue-500 rounded-full border-2 border-black flex items-center justify-center shrink-0">
                                                    <div className="w-1.5 h-1.5 bg-white rounded-full" />
                                                </div>
                                            )}
                                            <div className="w-14 h-10 rounded-md overflow-hidden shrink-0 bg-zinc-900 border border-zinc-800/50">
                                                <MediaThumbnail item={item} className="w-full h-full" refreshKey={refreshKey} />
                                            </div>
                                            <div className="min-w-0 flex-1">
                                                <p className={`text-xs font-medium truncate ${isSel ? 'text-blue-300' : 'text-zinc-300'}`}>{item.name.replace(/\.[^.]+$/, '')}</p>
                                                <p className="text-[10px] text-zinc-600 mt-0.5">
                                                    {ext.toUpperCase()} · {formatSize(item.size)}
                                                    {isVid && <span className="ml-1.5 text-blue-400/60">● Video</span>}
                                                </p>
                                            </div>
                                            <div className="text-[10px] text-zinc-600 font-medium shrink-0">
                                                {new Date(item.mtime).toLocaleDateString()}
                                            </div>
                                        </button>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* ──── Selection Bar ──── */}
            {selectedItems.length > 0 && (currentView === 'album' || currentView === 'all') && (
                <div className="gallery-selection-bar absolute bottom-4 right-4 z-[60] bg-zinc-900/95 backdrop-blur-xl border border-zinc-700 rounded-md px-3 py-1.5 flex items-center gap-2 shadow-2xl">
                    <span className="text-[10px] font-bold text-white uppercase tracking-widest">{selectedItems.length} selected</span>
                    <div className="w-px h-4 bg-zinc-700"></div>
                    <button onClick={() => { setAlbumSelector({ action: 'move' }); }} className="text-[10px] font-bold text-blue-400 hover:text-blue-300 uppercase tracking-widest cursor-pointer">Move</button>
                    <button onClick={() => { setAlbumSelector({ action: 'copy' }); }} className="text-[10px] font-bold text-green-400 hover:text-green-300 uppercase tracking-widest cursor-pointer">Copy</button>
                    <button onClick={() => setShowDeleteConfirm(true)} className="text-[10px] font-bold text-red-400 hover:text-red-300 uppercase tracking-widest cursor-pointer">Delete</button>
                    <div className="w-px h-4 bg-zinc-700"></div>
                    <button onClick={clearSelection} className="text-[10px] font-bold text-zinc-500 hover:text-white uppercase tracking-widest cursor-pointer">✕</button>
                </div>
            )}

            {/* ──── Context Menu ──── */}
            {contextMenu && (
                <div
                    className="gallery-context-menu fixed z-[100] bg-zinc-900/95 backdrop-blur-2xl border border-zinc-700 rounded-md shadow-2xl py-0.5 w-44"
                    style={{ left: contextMenu.x, top: contextMenu.y }}
                    onMouseLeave={() => setContextMenu(null)}
                >
                    <button
                        onClick={() => { setAlbumSelector({ action: 'move' }); setContextMenu(null); }}
                        className="w-full px-3 py-2 text-left text-xs hover:bg-white/5 flex items-center gap-2 transition-colors cursor-pointer"
                    >
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-blue-400"><path d="M5 12h14M12 5l7 7-7 7" /></svg>
                        Move to Album
                    </button>
                    <button
                        onClick={() => { setAlbumSelector({ action: 'copy' }); setContextMenu(null); }}
                        className="w-full px-3 py-2 text-left text-xs hover:bg-white/5 flex items-center gap-2 transition-colors cursor-pointer"
                    >
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-green-400"><rect x="9" y="9" width="13" height="13" rx="2" ry="2" /><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" /></svg>
                        Copy to Album
                    </button>
                    <div className="my-0.5 border-t border-zinc-800" />
                    <button
                        onClick={() => { setShowDeleteConfirm(true); setContextMenu(null); }}
                        className="w-full px-3 py-2 text-left text-xs hover:bg-red-500/10 text-red-400 flex items-center gap-2 transition-colors cursor-pointer"
                    >
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6" /><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" /></svg>
                        Delete from Disk
                    </button>
                </div>
            )}

            {/* ──── Album Selector Modal ──── */}
            {albumSelector && (
                <div className="gallery-album-selector fixed inset-0 z-[200] flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-black/60 backdrop-blur-md" onClick={() => setAlbumSelector(null)} />
                    <div className="relative bg-zinc-900 border border-zinc-700 w-full max-w-[300px] rounded-md shadow-2xl overflow-hidden flex flex-col max-h-[60vh]">
                        <header className="px-3 py-2 border-b border-zinc-800 flex items-center justify-between shrink-0">
                            <div>
                                <h3 className="text-sm font-bold text-white">
                                    {albumSelector.action === 'move' ? 'Move' : 'Copy'} to Album
                                </h3>
                                <p className="text-[9px] text-zinc-500">{selectedItems.length} items</p>
                            </div>
                            <button onClick={() => setAlbumSelector(null)} className="p-1 hover:bg-white/5 rounded-md transition-colors cursor-pointer">
                                <img src={closeIcon} className="w-4 h-4 filter brightness-0 invert opacity-50" alt="close" />
                            </button>
                        </header>

                        <div className="flex-1 overflow-y-auto p-1.5 custom-scrollbar">
                            {albums.filter(a => !a.isRoot).map((album) => (
                                <button
                                    key={album.name}
                                    onClick={() => {
                                        if (albumSelector.action === 'move') moveItems(album.name);
                                        else copyItems(album.name);
                                        setAlbumSelector(null);
                                    }}
                                    className="group w-full flex items-center gap-2 p-1.5 rounded-md hover:bg-white/5 border border-transparent hover:border-zinc-700 transition-all text-left cursor-pointer"
                                >
                                    <div className="w-8 h-8 rounded-md bg-zinc-800 overflow-hidden shrink-0">
                                        {album.coverItem && <MediaThumbnail item={album.coverItem} className="w-full h-full" showDuration={false} refreshKey={refreshKey} />}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className="text-xs font-semibold text-zinc-200 truncate">{album.name}</p>
                                        <p className="text-[9px] text-zinc-600">{album.media.length} items</p>
                                    </div>
                                </button>
                            ))}
                        </div>

                        <footer className="p-2 bg-black/20 border-t border-zinc-800 shrink-0">
                            {isCreatingNewAlbum ? (
                                <div className="flex items-center gap-1.5">
                                    <input
                                        autoFocus
                                        type="text"
                                        placeholder="Album name..."
                                        className="flex-1 bg-zinc-800 border border-zinc-700 rounded-md px-2 py-1 text-xs outline-none focus:border-blue-500/50 text-white placeholder:text-zinc-600"
                                        value={newAlbumName}
                                        onChange={(e) => setNewAlbumName(e.target.value)}
                                        onKeyDown={(e) => {
                                            if (e.key === 'Enter' && newAlbumName) {
                                                if (albumSelector.action === 'move') moveItems(newAlbumName);
                                                else copyItems(newAlbumName);
                                                setAlbumSelector(null);
                                                setIsCreatingNewAlbum(false);
                                                setNewAlbumName('');
                                            }
                                        }}
                                    />
                                    <button
                                        onClick={() => {
                                            if (newAlbumName) {
                                                if (albumSelector.action === 'move') moveItems(newAlbumName);
                                                else copyItems(newAlbumName);
                                                setAlbumSelector(null);
                                                setIsCreatingNewAlbum(false);
                                                setNewAlbumName('');
                                            }
                                        }}
                                        className="px-2 py-1 bg-blue-600 text-white rounded-md text-xs font-bold hover:bg-blue-500 transition-colors cursor-pointer"
                                    >Create</button>
                                    <button onClick={() => setIsCreatingNewAlbum(false)} className="p-1 hover:bg-white/5 rounded-md cursor-pointer">
                                        <img src={closeIcon} className="w-3 h-3 filter brightness-0 invert opacity-40" alt="cancel" />
                                    </button>
                                </div>
                            ) : (
                                <button
                                    onClick={() => setIsCreatingNewAlbum(true)}
                                    className="w-full py-1.5 rounded-md border border-dashed border-zinc-700 hover:border-blue-500/50 hover:bg-blue-500/5 transition-all flex items-center justify-center gap-1.5 text-[10px] font-bold text-zinc-500 hover:text-blue-400 uppercase tracking-widest cursor-pointer"
                                >
                                    <img src={plusIcon} className="w-3 h-3 filter brightness-0 invert opacity-40" alt="new" />
                                    New Album
                                </button>
                            )}
                        </footer>
                    </div>
                </div>
            )}

            {/* ──── Delete Confirmation Modal ──── */}
            {showDeleteConfirm && (
                <div className="fixed inset-0 z-[300] flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-black/60 backdrop-blur-md" onClick={() => setShowDeleteConfirm(false)} />
                    <div className="gallery-delete-modal relative bg-zinc-950/95 border border-zinc-700 w-full max-w-[260px] rounded-md shadow-2xl overflow-hidden">
                        <div className="p-4 text-center">
                            <div className="w-10 h-10 bg-red-500/10 rounded-full flex items-center justify-center mx-auto mb-3 border border-red-500/20">
                                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-red-500"><polyline points="3 6 5 6 21 6" /><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" /></svg>
                            </div>
                            <h3 className="text-base font-bold mb-1 text-white">Delete Items?</h3>
                            <p className="text-zinc-400 text-[11px] leading-tight mb-4">
                                Permanently remove <span className="text-white font-bold">{selectedItems.length}</span> {selectedItems.length === 1 ? 'file' : 'files'}?
                            </p>
                            <div className="grid grid-cols-2 gap-1.5">
                                <button
                                    onClick={() => setShowDeleteConfirm(false)}
                                    className="py-2 px-3 bg-zinc-800 hover:bg-zinc-700 text-white rounded-md text-xs font-bold transition-all border border-zinc-700 cursor-pointer"
                                >Cancel</button>
                                <button
                                    onClick={() => { deleteItems(); setShowDeleteConfirm(false); }}
                                    className="py-2 px-3 bg-red-600 hover:bg-red-500 text-white rounded-md text-xs font-bold transition-all cursor-pointer"
                                >Delete</button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* ──── Album Context Menu ──── */}
            {albumContextMenu && (
                <div
                    className="gallery-context-menu fixed z-[100] bg-zinc-900/95 backdrop-blur-2xl border border-zinc-700 rounded-md shadow-2xl py-0.5 w-44"
                    style={{ left: albumContextMenu.x, top: albumContextMenu.y }}
                    onMouseLeave={() => setAlbumContextMenu(null)}
                >
                    <button
                        onClick={() => {
                            openInExplorer(albumContextMenu.album.path);
                            setAlbumContextMenu(null);
                        }}
                        className="w-full px-3 py-2 text-left text-xs hover:bg-white/5 flex items-center gap-2 transition-colors cursor-pointer"
                    >
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-zinc-400"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" /><polyline points="15 3 21 3 21 9" /><line x1="10" y1="14" x2="21" y2="3" /></svg>
                        Open in Explorer
                    </button>
                    <div className="my-0.5 border-t border-zinc-800" />
                    <button
                        onClick={() => {
                            setShowAlbumDeleteConfirm(albumContextMenu.album);
                            setAlbumContextMenu(null);
                        }}
                        className="w-full px-3 py-2 text-left text-xs hover:bg-red-500/10 text-red-400 flex items-center gap-2 transition-colors cursor-pointer"
                    >
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6" /><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" /></svg>
                        Delete Album
                    </button>
                </div>
            )}

            {/* ──── Album Delete Confirmation Modal ──── */}
            {showAlbumDeleteConfirm && (
                <div className="fixed inset-0 z-[300] flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-black/60 backdrop-blur-md" onClick={() => setShowAlbumDeleteConfirm(null)} />
                    <div className="gallery-delete-modal relative bg-zinc-950/95 border border-zinc-700 w-full max-w-[300px] rounded-md shadow-2xl overflow-hidden">
                        <div className="p-4 text-center">
                            <div className="w-10 h-10 bg-red-500/10 rounded-full flex items-center justify-center mx-auto mb-3 border border-red-500/20">
                                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-red-500"><polyline points="3 6 5 6 21 6" /><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" /></svg>
                            </div>
                            <h3 className="text-base font-bold mb-1 text-white">Delete Album?</h3>
                            <p className="text-zinc-400 text-[11px] leading-tight mb-1">
                                Permanently remove <span className="text-white font-bold">{showAlbumDeleteConfirm.name}</span>?
                            </p>
                            <p className="text-zinc-500 text-[10px] leading-tight mb-4">
                                This will delete the folder and all {showAlbumDeleteConfirm.media.length} files inside.
                            </p>
                            <div className="grid grid-cols-2 gap-1.5">
                                <button
                                    onClick={() => setShowAlbumDeleteConfirm(null)}
                                    className="py-2 px-3 bg-zinc-800 hover:bg-zinc-700 text-white rounded-md text-xs font-bold transition-all border border-zinc-700 cursor-pointer"
                                >Cancel</button>
                                <button
                                    onClick={() => { deleteAlbum(showAlbumDeleteConfirm); setShowAlbumDeleteConfirm(null); }}
                                    className="py-2 px-3 bg-red-600 hover:bg-red-500 text-white rounded-md text-xs font-bold transition-all cursor-pointer"
                                >Delete</button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* ──── Lightbox ──── */}
            {lightboxIndex >= 0 && currentMedia.length > 0 && (
                <Lightbox
                    items={currentMedia}
                    currentIndex={lightboxIndex}
                    onClose={() => setLightboxIndex(-1)}
                    onNavigate={(i) => setLightboxIndex(i)}
                    refreshKey={refreshKey}
                />
            )}
        </div>
    );
};

export default Gallery;
