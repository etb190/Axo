import React, { useState, useEffect, useRef, useCallback } from 'react';
import Navbar from './Navbar';

// Icons
import playIcon from '../assets/icons/play.svg';
import listIcon from '../assets/icons/list.svg';
import searchIcon from '../assets/icons/search.svg';
import closeIcon from '../assets/icons/close.svg';
import chevronLeftIcon from '../assets/icons/chevron-left.svg';
import loaderIcon from '../assets/icons/loader.svg';
import conceptsIcon from '../assets/icons/concepts.svg';

// Resolve ffmpeg path — set by preload.js, with dev fallback
const getFFmpegPath = () => {
    if (window.ffmpegPath) return window.ffmpegPath;
    try { return window.require('ffmpeg-static'); } catch { return null; }
};

const VideoThumbnail = ({ videoPath, className, timeOffset = 10 }) => {
    const [thumbnail, setThumbnail] = useState(null);
    const [failed, setFailed] = useState(false);

    useEffect(() => {
        let isMounted = true;
        const loadThumbnail = async () => {
            try {
                const { exec } = window.require('child_process');
                const ffmpegPath = getFFmpegPath();
                const path = window.require('path');
                const fs = window.require('fs');
                const os = window.require('os');
                const crypto = window.require('crypto');

                // Persistent cache directory
                const cacheDir = path.join(os.tmpdir(), '.axo_thumbcache');
                if (!fs.existsSync(cacheDir)) fs.mkdirSync(cacheDir, { recursive: true });

                // Cache key from video path
                const hash = crypto.createHash('md5').update(videoPath).digest('hex');
                const cachePath = path.join(cacheDir, `${hash}.jpg`);

                // Load from cache if available
                if (fs.existsSync(cachePath)) {
                    const data = fs.readFileSync(cachePath);
                    if (isMounted) setThumbnail(`data:image/jpeg;base64,${data.toString('base64')}`);
                    return;
                }

                // Generate and cache thumbnail
                const cmd = `"${ffmpegPath}" -ss ${timeOffset} -i "${videoPath}" -vframes 1 -f image2 -s 320x180 "${cachePath}"`;

                exec(cmd, (error) => {
                    if (error) {
                        if (isMounted) setFailed(true);
                        return;
                    }
                    if (fs.existsSync(cachePath)) {
                        const data = fs.readFileSync(cachePath);
                        if (isMounted) setThumbnail(`data:image/jpeg;base64,${data.toString('base64')}`);
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
    }, [videoPath, timeOffset]);

    if (failed || !thumbnail) {
        return (
            <div className={`bg-zinc-800 flex items-center justify-center ${className}`}>
                <div className="w-4 h-4 rounded-full border-2 border-white/5 border-t-white/40 animate-spin"></div>
            </div>
        );
    }

    return <img src={thumbnail} className={className} alt="Thumbnail" />;
};

// ─── ImageThumbnail — loads image file from disk as base64 data URI ─────
const imgCache = {};
const IMAGE_EXTS = ['jpg', 'jpeg', 'png', 'gif', 'bmp', 'webp', 'avif'];

const ImageThumbnail = ({ imagePath, className }) => {
    const [src, setSrc] = useState(imgCache[imagePath] || null);
    const [failed, setFailed] = useState(false);

    useEffect(() => {
        if (imgCache[imagePath]) { setSrc(imgCache[imagePath]); return; }
        let isMounted = true;
        try {
            const fs = window.require('fs');
            const path = window.require('path');
            const ext = path.extname(imagePath).slice(1).toLowerCase();
            const mimeMap = { jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', gif: 'image/gif', bmp: 'image/bmp', webp: 'image/webp', avif: 'image/avif' };
            const mime = mimeMap[ext] || 'image/jpeg';
            const data = fs.readFileSync(imagePath);
            const uri = `data:${mime};base64,${data.toString('base64')}`;
            imgCache[imagePath] = uri;
            if (isMounted) setSrc(uri);
        } catch (e) {
            if (isMounted) setFailed(true);
        }
        return () => { isMounted = false; };
    }, [imagePath]);

    if (failed || !src) {
        return (
            <div className={`bg-zinc-800 flex items-center justify-center ${className}`}>
                <div className="w-4 h-4 rounded-full border-2 border-white/5 border-t-white/40 animate-spin"></div>
            </div>
        );
    }
    return <img src={src} className={className} alt="Cover" />;
};

// ─── VideoDuration — fetches and caches video duration via ffmpeg ────────
const durationCache = {}; // videoPath -> seconds
const VideoDuration = ({ videoPath, className }) => {
    const [dur, setDur] = useState(durationCache[videoPath] ?? null);
    useEffect(() => {
        if (durationCache[videoPath] != null) { setDur(durationCache[videoPath]); return; }
        let isMounted = true;
        getVideoDuration(videoPath).then(d => {
            if (d > 0) {
                durationCache[videoPath] = d;
                if (isMounted) setDur(d);
            }
        });
        return () => { isMounted = false; };
    }, [videoPath]);
    if (dur == null) return null;
    return <span className={className}>{formatTime(dur)}</span>;
};

// ─── SeriesTotalStats — total duration + total size for a series ───────
const formatFileSize = (bytes) => {
    if (bytes >= 1073741824) return `${(bytes / 1073741824).toFixed(1)}GB`;
    return `${Math.round(bytes / 1048576)}MB`;
};

const SeriesTotalStats = ({ videos, className }) => {
    const [totalDur, setTotalDur] = useState(null);
    const totalSize = videos.reduce((sum, v) => sum + (v.stats?.size || 0), 0);

    useEffect(() => {
        let isMounted = true;
        const fetchAll = async () => {
            let sum = 0;
            for (const v of videos) {
                if (durationCache[v.path] != null) {
                    sum += durationCache[v.path];
                } else {
                    const d = await getVideoDuration(v.path);
                    if (d > 0) { durationCache[v.path] = d; sum += d; }
                }
            }
            if (isMounted) setTotalDur(sum);
        };
        fetchAll();
        return () => { isMounted = false; };
    }, [videos]);

    return (
        <span className={className}>
            {totalDur != null ? formatTime(totalDur) : '…'} · {formatFileSize(totalSize)}
        </span>
    );
};

// ─── SeriesCover — uses cover image if available, otherwise video thumbnail ──
const SeriesCover = ({ series, className }) => {
    if (series.coverImage) {
        return <ImageThumbnail imagePath={series.coverImage} className={className} />;
    }
    if (series.videos.length > 0) {
        return <VideoThumbnail videoPath={series.videos[0].path} className={className} />;
    }
    return (
        <div className={`bg-zinc-800 flex items-center justify-center ${className}`}>
            <img src={playIcon} className="w-6 h-6 filter brightness-0 invert opacity-20" alt="empty" />
        </div>
    );
};

const LIBRARY_PATH = 'C:\\Users\\PC\\Desktop\\Database\\TV and Videos';

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
                className={`bg-zinc-900 border border-zinc-800 text-zinc-400 font-bold rounded-md hover:bg-zinc-800 hover:border-zinc-700 transition-all flex items-center gap-2 cursor-pointer ${btnClassName}`}
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
                                onClick={() => {
                                    onChange(opt.value);
                                    setIsOpen(false);
                                }}
                                className={`w-full text-left px-4 py-2 text-[10px] font-bold uppercase tracking-widest hover:bg-white/5 transition-colors ${current === opt.value ? 'text-blue-400 bg-white/5' : 'text-zinc-500 hover:text-white'}`}
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

// Global state
let activeServer = null;
let activeProcess = null;
let remuxProcess = null;
let tempRemuxPath = null;

const cleanup = () => {
    if (activeProcess) {
        try { activeProcess.kill('SIGKILL'); } catch (e) { }
        activeProcess = null;
    }
    if (activeServer) {
        try { activeServer.close(); } catch (e) { }
        activeServer = null;
    }
    if (remuxProcess) {
        try { remuxProcess.kill('SIGKILL'); } catch (e) { }
        remuxProcess = null;
    }
    if (tempRemuxPath) {
        try {
            const fs = window.require('fs');
            if (fs.existsSync(tempRemuxPath)) fs.unlinkSync(tempRemuxPath);
        } catch (e) { }
        tempRemuxPath = null;
    }
};

// Serve a local file via HTTP with Range request support — enables instant native browser seeking
const createFileServer = (filePath) => {
    return new Promise((resolve, reject) => {
        try {
            const http = window.require('http');
            const fs = window.require('fs');

            // Stop any previous server/process
            if (activeProcess) { try { activeProcess.kill('SIGKILL'); } catch (e) { } activeProcess = null; }
            if (activeServer) { try { activeServer.close(); } catch (e) { } activeServer = null; }

            const server = http.createServer((req, res) => {
                let stream = null;

                // CRITICAL: Prevent file descriptor leaks when the browser aborts the request
                req.on('close', () => {
                    if (stream && !stream.destroyed) {
                        try { stream.destroy(); } catch (e) { }
                    }
                });

                try {
                    const stat = fs.statSync(filePath);
                    const fileSize = stat.size;
                    const range = req.headers.range;

                    if (range) {
                        const parts = range.replace(/bytes=/, '').split('-');
                        const start = parseInt(parts[0], 10);
                        let end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;

                        // Limit chunk size to 20MB to prevent single long-running requests timing out in Chromium
                        const CHUNK_SIZE = 20 * 1024 * 1024; // 20MB
                        if (end - start + 1 > CHUNK_SIZE) {
                            end = start + CHUNK_SIZE - 1;
                        }

                        res.writeHead(206, {
                            'Content-Range': `bytes ${start}-${end}/${fileSize}`,
                            'Accept-Ranges': 'bytes',
                            'Content-Length': end - start + 1,
                            'Content-Type': 'video/mp4',
                            'Access-Control-Allow-Origin': '*',
                            'Connection': 'close'
                        });
                        stream = fs.createReadStream(filePath, { start, end });
                        stream.pipe(res);
                    } else {
                        res.writeHead(200, {
                            'Content-Length': fileSize,
                            'Content-Type': 'video/mp4',
                            'Accept-Ranges': 'bytes',
                            'Access-Control-Allow-Origin': '*',
                            'Connection': 'close'
                        });
                        stream = fs.createReadStream(filePath);
                        stream.pipe(res);
                    }

                    stream.on('error', (err) => {
                        console.error('[TVPlayer] FS Read Error:', err);
                        if (!res.headersSent) {
                            res.writeHead(500);
                            res.end('Error');
                        }
                    });
                } catch (err) {
                    console.error('[TVPlayer] Server Error:', err);
                    if (!res.headersSent) {
                        res.writeHead(500);
                        res.end('Error');
                    }
                }
            });

            // Prevent idle timeouts from aggressively killing the video stream
            server.keepAliveTimeout = 0;
            server.headersTimeout = 0;
            server.timeout = 0;

            server.listen(0, '127.0.0.1', () => {
                const port = server.address().port;
                activeServer = server;
                resolve(`http://127.0.0.1:${port}/video`);
            });
        } catch (err) {
            reject(err);
        }
    });
};

// Background remux: tries -c copy first (instant), falls back to audio re-encoding if needed
const backgroundRemux = (videoPath) => {
    const { spawn } = window.require('child_process');
    const ffmpegPath = getFFmpegPath();
    const path = window.require('path');
    const os = window.require('os');
    const fs = window.require('fs');

    const attemptRemux = (copyAudio) => {
        return new Promise((resolve, reject) => {
            if (remuxProcess) { try { remuxProcess.kill('SIGKILL'); } catch (e) { } remuxProcess = null; }
            if (tempRemuxPath) {
                try { if (fs.existsSync(tempRemuxPath)) fs.unlinkSync(tempRemuxPath); } catch (e) { }
            }
            tempRemuxPath = path.join(os.tmpdir(), `axo_remux_${Date.now()}.mp4`);

            const audioArgs = copyAudio
                ? ['-c:a', 'copy']
                : ['-c:a', 'aac', '-b:a', '128k'];

            console.log(`[TVPlayer] Remuxing with ${copyAudio ? '-c copy (fast)' : '-c:a aac (re-encode)'}...`);
            const startTime = Date.now();

            const ffmpeg = spawn(ffmpegPath, [
                '-i', videoPath,
                '-c:v', 'copy',
                ...audioArgs,
                '-movflags', '+faststart',
                '-f', 'mp4',
                '-y',
                tempRemuxPath
            ]);

            remuxProcess = ffmpeg;

            ffmpeg.on('close', (code) => {
                remuxProcess = null;
                const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
                if (code === 0) {
                    console.log(`[TVPlayer] Remux completed in ${elapsed}s`);
                    resolve(tempRemuxPath);
                } else {
                    console.warn(`[TVPlayer] Remux failed (code ${code}) after ${elapsed}s`);
                    reject(new Error(`Remux failed with code ${code}`));
                }
            });

            ffmpeg.on('error', (err) => {
                remuxProcess = null;
                reject(err);
            });
        });
    };

    // Try fast copy first, fall back to audio re-encoding
    return attemptRemux(true).catch(() => {
        console.log('[TVPlayer] Fast remux failed, retrying with audio re-encoding...');
        return attemptRemux(false);
    });
};

// Streaming transcode for immediate MKV playback (supports seeking via seekTime)
const startStreamingTranscode = (videoPath, seekTime = 0) => {
    return new Promise((resolve, reject) => {
        try {
            const http = window.require('http');
            const { spawn } = window.require('child_process');
            const ffmpegPath = getFFmpegPath();

            // Kill streaming process/server but NOT the background remux
            if (activeProcess) { try { activeProcess.kill('SIGKILL'); } catch (e) { } activeProcess = null; }
            if (activeServer) { try { activeServer.close(); } catch (e) { } activeServer = null; }

            const server = http.createServer((req, res) => {
                res.writeHead(200, {
                    'Content-Type': 'video/mp4',
                    'Access-Control-Allow-Origin': '*',
                    'Connection': 'keep-alive'
                });

                const args = [
                    '-hide_banner',
                    ...(seekTime > 0 ? ['-ss', seekTime.toString()] : []),
                    '-i', videoPath,
                    '-c:v', 'libx264', '-preset', 'ultrafast', '-tune', 'zerolatency', '-crf', '28',
                    '-c:a', 'aac', '-b:a', '128k', '-ac', '2',
                    '-start_at_zero', '-avoid_negative_ts', 'make_zero',
                    '-movflags', 'frag_keyframe+empty_moov+default_base_moof',
                    '-f', 'mp4', '-'
                ];
                const ffmpeg = spawn(ffmpegPath, args);
                activeProcess = ffmpeg;
                ffmpeg.stdout.pipe(res);
                ffmpeg.stderr.on('data', () => { });
                req.on('close', () => { try { ffmpeg.kill('SIGKILL'); } catch (e) { } });
            });

            server.keepAliveTimeout = 0;
            server.headersTimeout = 0;
            server.timeout = 0;

            server.listen(0, '127.0.0.1', () => {
                const port = server.address().port;
                activeServer = server;
                resolve(`http://127.0.0.1:${port}/stream`);
            });
        } catch (err) {
            reject(err);
        }
    });
};

const getVideoDuration = (videoPath) => {
    return new Promise((resolve) => {
        try {
            const { exec } = window.require('child_process');
            const ffmpegPath = getFFmpegPath();
            exec(`"${ffmpegPath}" -i "${videoPath}"`, (error, stdout, stderr) => {
                const match = (stdout + stderr).match(/Duration: (\d+):(\d+):(\d+)\.(\d+)/);
                if (match) {
                    const h = parseInt(match[1]);
                    const m = parseInt(match[2]);
                    const s = parseInt(match[3]);
                    resolve(h * 3600 + m * 60 + s);
                } else {
                    resolve(0);
                }
            });
        } catch (e) {
            resolve(0);
        }
    });
};

const formatTime = (seconds) => {
    if (!seconds || isNaN(seconds)) return '0:00';
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = Math.floor(seconds % 60);
    if (h > 0) return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    return `${m}:${s.toString().padStart(2, '0')}`;
};

const TVPlayer = ({ showNavbar = true, onViewingMedia }) => {
    const [library, setLibrary] = useState([]);
    const [loading, setLoading] = useState(true);
    const [currentView, setCurrentView] = useState('grid');
    const [selectedSeries, setSelectedSeries] = useState(null);
    const [currentVideo, setCurrentVideo] = useState(null);
    const [videoSrc, setVideoSrc] = useState(null);
    const [search, setSearch] = useState('');
    const [sortOption, setSortOption] = useState('newest');
    const [isSidebarOpen, setIsSidebarOpen] = useState(true);

    const [currentTime, setCurrentTime] = useState(0);
    const [duration, setDuration] = useState(0);
    const [isPlaying, setIsPlaying] = useState(false);
    const [playbackSpeed, setPlaybackSpeed] = useState(1);
    const [isSpeedOpen, setIsSpeedOpen] = useState(false);
    const [videoKey, setVideoKey] = useState(0);
    const [isSeeking, setIsSeeking] = useState(false);
    const [playbackMode, setPlaybackMode] = useState('direct'); // 'direct' = native seeking, 'transcode' = streaming
    const [isFullscreen, setIsFullscreen] = useState(false);
    const [isPiP, setIsPiP] = useState(false);
    const [controlsVisible, setControlsVisible] = useState(true);
    const [isMuted, setIsMuted] = useState(() => {
        try { return localStorage.getItem('axo_muted') === 'true'; } catch { return false; }
    });

    const stateRef = useRef({});
    stateRef.current = { currentTime, duration, playbackMode, currentVideo, isMuted, isPlaying };
    const isResumingRef = useRef(false);
    const mouseIdleTimerRef = useRef(null);
    const [resumePrompt, setResumePrompt] = useState(null); // { series, video, time, speed, fileName }
    const dismissedResumePathRef = useRef(null); // Track dismissed video so we don't re-prompt

    const videoRef = useRef(null);
    const seekOffsetRef = useRef(0);       // Tracks seek offset in transcode mode
    const pendingSeekRef = useRef(0);      // For seamless swap: seek to this time after source change
    const currentVideoPathRef = useRef(''); // Track which video is playing (for async safety)
    const isDraggingRef = useRef(false);   // Suppress time updates while dragging seek bar
    const saveThrottleRef = useRef(0);     // Throttle playback state saves

    // Subtitle state — both use custom overlay rendering
    const [availableSubs, setAvailableSubs] = useState([]);
    const [primaryCues, setPrimaryCues] = useState([]);
    const [primaryText, setPrimaryText] = useState('');
    const [activeSubPath, setActiveSubPath] = useState(null);
    const [isSubMenuOpen, setIsSubMenuOpen] = useState(false);

    const [secondaryCues, setSecondaryCues] = useState([]);
    const [secondaryText, setSecondaryText] = useState('');
    const [activeSubPath2, setActiveSubPath2] = useState(null);
    const [isSubMenu2Open, setIsSubMenu2Open] = useState(false);

    // Subtitle positions & style (persisted)
    const defaultSubStyle = { fontSize: 18, bgOpacity: 80, bgColor: '#000000', textColor: '#ffffff', containerWidth: 80 };
    const defaultPositions = { sub1: { x: 50, y: 88 }, sub2: { x: 50, y: 78 } };
    const [subStyle, setSubStyle] = useState(() => {
        try { return JSON.parse(localStorage.getItem('axo_sub_style')) || defaultSubStyle; } catch { return defaultSubStyle; }
    });
    const [subPositions, setSubPositions] = useState(() => {
        try { return JSON.parse(localStorage.getItem('axo_sub_positions')) || defaultPositions; } catch { return defaultPositions; }
    });
    const [isSubSettingsOpen, setIsSubSettingsOpen] = useState(false);
    const dragRef = useRef({ active: false, which: null, startX: 0, startY: 0, origX: 0, origY: 0 });
    const videoContainerRef = useRef(null);

    const isNativelySupportedFormat = (filePath) => {
        const ext = filePath.split('.').pop().toLowerCase();
        return ['mp4', 'webm', 'ogg', 'mov'].includes(ext);
    };

    // SRT parser
    const parseSrt = (srtContent) => {
        const normalized = srtContent.replace(/\r\n/g, '\n').trim();
        const blocks = normalized.split('\n\n');
        return blocks.map(block => {
            const lines = block.split('\n');
            const timeIdx = lines.findIndex(l => l.includes('-->'));
            if (timeIdx === -1) return null;
            const parts = lines[timeIdx].split('-->');
            const parseT = (t) => {
                const m = t.trim().match(/(\d{2}):(\d{2}):(\d{2})[,.](\d{3})/);
                if (!m) return 0;
                return parseInt(m[1]) * 3600 + parseInt(m[2]) * 60 + parseInt(m[3]) + parseInt(m[4]) / 1000;
            };
            return { start: parseT(parts[0]), end: parseT(parts[1]), text: lines.slice(timeIdx + 1).join('\n').trim() };
        }).filter(Boolean);
    };

    // Subtitle helpers
    const scanForSubtitles = (videoPath) => {
        try {
            const fs = window.require('fs');
            const path = window.require('path');
            const dir = path.dirname(videoPath);
            const files = fs.readdirSync(dir);
            return files
                .filter(f => f.toLowerCase().endsWith('.srt'))
                .map(f => ({ name: f.replace(/\.srt$/i, ''), path: path.join(dir, f) }));
        } catch (e) {
            return [];
        }
    };

    const loadSubtitle = (srtPath, vidPath) => {
        try {
            const fs = window.require('fs');
            const content = fs.readFileSync(srtPath, 'utf-8');
            setPrimaryCues(parseSrt(content));
            setActiveSubPath(srtPath);
            const saved = JSON.parse(localStorage.getItem('axo_subtitle_prefs') || '{}');
            saved[vidPath] = srtPath;
            localStorage.setItem('axo_subtitle_prefs', JSON.stringify(saved));
        } catch (e) {
            console.error('Failed to load subtitle:', e);
        }
    };

    const clearSubtitle = (vidPath) => {
        setPrimaryCues([]);
        setPrimaryText('');
        setActiveSubPath(null);
        const saved = JSON.parse(localStorage.getItem('axo_subtitle_prefs') || '{}');
        delete saved[vidPath];
        localStorage.setItem('axo_subtitle_prefs', JSON.stringify(saved));
    };

    const loadSecondarySubtitle = (srtPath, vidPath) => {
        try {
            const fs = window.require('fs');
            const content = fs.readFileSync(srtPath, 'utf-8');
            setSecondaryCues(parseSrt(content));
            setActiveSubPath2(srtPath);
            const saved = JSON.parse(localStorage.getItem('axo_subtitle2_prefs') || '{}');
            saved[vidPath] = srtPath;
            localStorage.setItem('axo_subtitle2_prefs', JSON.stringify(saved));
        } catch (e) {
            console.error('Failed to load secondary subtitle:', e);
        }
    };

    const clearSecondarySubtitle = (vidPath) => {
        setSecondaryCues([]);
        setActiveSubPath2(null);
        setSecondaryText('');
        const saved = JSON.parse(localStorage.getItem('axo_subtitle2_prefs') || '{}');
        delete saved[vidPath];
        localStorage.setItem('axo_subtitle2_prefs', JSON.stringify(saved));
    };

    // Subtitle style/position persistence
    const updateSubStyle = (patch) => {
        setSubStyle(prev => {
            const next = { ...prev, ...patch };
            localStorage.setItem('axo_sub_style', JSON.stringify(next));
            return next;
        });
    };

    const updateSubPosition = (which, pos) => {
        setSubPositions(prev => {
            const next = { ...prev, [which]: pos };
            localStorage.setItem('axo_sub_positions', JSON.stringify(next));
            return next;
        });
    };

    // Drag handlers for subtitle repositioning
    const startSubDrag = (e, which) => {
        e.preventDefault();
        e.stopPropagation();
        const container = videoContainerRef.current;
        if (!container) return;
        const pos = subPositions[which];
        dragRef.current = { active: true, which, startX: e.clientX, startY: e.clientY, origX: pos.x, origY: pos.y };
    };

    useEffect(() => {
        const handleMouseMove = (e) => {
            if (!dragRef.current.active) return;
            const container = videoContainerRef.current;
            if (!container) return;
            const rect = container.getBoundingClientRect();
            const dx = ((e.clientX - dragRef.current.startX) / rect.width) * 100;
            const dy = ((e.clientY - dragRef.current.startY) / rect.height) * 100;
            const newX = Math.max(5, Math.min(95, dragRef.current.origX + dx));
            const newY = Math.max(5, Math.min(95, dragRef.current.origY + dy));
            setSubPositions(prev => ({ ...prev, [dragRef.current.which]: { x: newX, y: newY } }));
        };
        const handleMouseUp = () => {
            if (!dragRef.current.active) return;
            dragRef.current.active = false;
            // Persist final position
            setSubPositions(prev => {
                localStorage.setItem('axo_sub_positions', JSON.stringify(prev));
                return prev;
            });
        };
        window.addEventListener('mousemove', handleMouseMove);
        window.addEventListener('mouseup', handleMouseUp);
        return () => { window.removeEventListener('mousemove', handleMouseMove); window.removeEventListener('mouseup', handleMouseUp); };
    }, []);

    // Shared subtitle overlay style
    const getSubOverlayStyle = (pos) => ({
        left: `${pos.x}%`,
        top: `${pos.y}%`,
        transform: 'translate(-50%, -50%)',
        fontSize: `${subStyle.fontSize}px`,
        backgroundColor: `${subStyle.bgColor}${Math.round(subStyle.bgOpacity * 2.55).toString(16).padStart(2, '0')}`,
        color: subStyle.textColor,
        padding: '4px 14px',
        borderRadius: '4px',
        maxWidth: `${subStyle.containerWidth ?? 80}%`,
        width: 'max-content',
        textAlign: 'center',
        fontWeight: 'bold',
        lineHeight: '1.4',
    });

    const scanLibrary = useCallback(() => {
        try {
            const fs = window.require('fs');
            const path = window.require('path');

            if (!fs.existsSync(LIBRARY_PATH)) {
                setLoading(false);
                return;
            }

            const folders = fs.readdirSync(LIBRARY_PATH);
            const libData = folders.map(folderName => {
                const fullPath = path.join(LIBRARY_PATH, folderName);
                if (!fs.statSync(fullPath).isDirectory()) return null;

                const files = fs.readdirSync(fullPath);
                const videos = files
                    .filter(file => {
                        const ext = file.split('.').pop().toLowerCase();
                        return ['mp4', 'mkv', 'avi', 'mov', 'webm'].includes(ext);
                    })
                    .map(file => ({
                        name: file,
                        path: path.join(fullPath, file),
                        stats: fs.statSync(path.join(fullPath, file))
                    }));

                if (videos.length === 0) return null;

                // Find cover image (first image file in folder)
                const coverImageFile = files.find(file => {
                    const ext = file.split('.').pop().toLowerCase();
                    return IMAGE_EXTS.includes(ext);
                });
                const coverImage = coverImageFile ? path.join(fullPath, coverImageFile) : null;

                return {
                    name: folderName,
                    videos,
                    coverImage,
                    mtime: fs.statSync(fullPath).mtime
                };
            }).filter(Boolean);

            setLibrary(libData);
            setLoading(false);
        } catch (err) {
            console.error("Library Scan Error:", err);
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        scanLibrary();
        return () => cleanup();
    }, [scanLibrary]);

    // Show "Continue watching?" prompt after library loads (only if was in player view)
    const hasResumedRef = useRef(false);
    useEffect(() => {
        if (library.length === 0 || hasResumedRef.current) return;
        hasResumedRef.current = true;
        try {
            const saved = JSON.parse(localStorage.getItem('axo_playback_state'));
            if (!saved || !saved.videoPath || !saved.seriesName || !saved.wasInPlayerView) return;
            const series = library.find(s => s.name === saved.seriesName);
            if (!series) return;
            const video = series.videos.find(v => v.path === saved.videoPath);
            if (!video) return;
            const path = window.require('path');
            setResumePrompt({
                series,
                video,
                time: saved.currentTime || 0,
                speed: saved.playbackSpeed || 1,
                fileName: path.basename(video.name, path.extname(video.name)),
            });
        } catch (e) {
            console.warn('Failed to restore playback state:', e);
        }
    }, [library]);

    const handleResumeYes = () => {
        if (!resumePrompt) return;
        const { series, video, time, speed } = resumePrompt;
        setSelectedSeries(series);
        setCurrentView('player');
        setIsSidebarOpen(true);
        setPlaybackSpeed(speed);
        pendingSeekRef.current = time;
        isResumingRef.current = true;
        handleVideoSelect(video);
        setResumePrompt(null);
    };

    const handleResumeNo = () => {
        // Remember this video so we don't re-prompt until they watch something
        if (resumePrompt) {
            dismissedResumePathRef.current = resumePrompt.video.path;
        }
        // Clear the saved state so it won't prompt on app restart either
        const state = JSON.parse(localStorage.getItem('axo_playback_state') || '{}');
        if (state.videoPath) {
            state.wasInPlayerView = false;
            localStorage.setItem('axo_playback_state', JSON.stringify(state));
        }
        setResumePrompt(null);
    };

    // Fullscreen handlers
    const toggleFullscreen = () => {
        const container = videoContainerRef.current;
        if (!container) return;
        if (document.fullscreenElement) {
            document.exitFullscreen();
        } else {
            container.requestFullscreen().catch(e => console.warn('Fullscreen failed:', e));
        }
    };

    useEffect(() => {
        const onFsChange = () => setIsFullscreen(!!document.fullscreenElement);
        document.addEventListener('fullscreenchange', onFsChange);
        return () => document.removeEventListener('fullscreenchange', onFsChange);
    }, []);

    // PiP with subtitle support
    const cuesToVtt = (cues) => {
        if (!cues || cues.length === 0) return null;
        const pad = (n, d = 2) => String(n).padStart(d, '0');
        const fmtTime = (s) => {
            const h = Math.floor(s / 3600);
            const m = Math.floor((s % 3600) / 60);
            const sec = Math.floor(s % 60);
            const ms = Math.round((s % 1) * 1000);
            return `${pad(h)}:${pad(m)}:${pad(sec)}.${pad(ms, 3)}`;
        };
        const lines = ['WEBVTT', ''];
        cues.forEach((c, i) => {
            lines.push(String(i + 1));
            lines.push(`${fmtTime(c.start)} --> ${fmtTime(c.end)}`);
            lines.push(c.text, '');
        });
        return URL.createObjectURL(new Blob([lines.join('\n')], { type: 'text/vtt' }));
    };

    const togglePiP = async () => {
        if (!videoRef.current) return;
        try {
            if (document.pictureInPictureElement) {
                await document.exitPictureInPicture();
            } else {
                const video = videoRef.current;
                // Remove old PiP tracks
                Array.from(video.querySelectorAll('track[data-pip]')).forEach(t => t.remove());

                // Add subtitle tracks and wait for them to load
                const addTrack = (cues, lang, label, isDefault) => {
                    return new Promise((resolve) => {
                        const vttUrl = cuesToVtt(cues);
                        if (!vttUrl) { resolve(); return; }
                        const trackEl = document.createElement('track');
                        trackEl.kind = 'captions';
                        trackEl.src = vttUrl;
                        trackEl.srclang = lang;
                        trackEl.label = label;
                        if (isDefault) trackEl.default = true;
                        trackEl.dataset.pip = '1';
                        trackEl.addEventListener('load', () => {
                            trackEl.track.mode = 'showing';
                            resolve();
                        });
                        trackEl.addEventListener('error', () => resolve());
                        video.appendChild(trackEl);
                        // Fallback if load never fires
                        setTimeout(() => { trackEl.track.mode = 'showing'; resolve(); }, 300);
                    });
                };

                const promises = [];
                if (primaryCues.length > 0) promises.push(addTrack(primaryCues, 'en', 'Primary', true));
                if (secondaryCues.length > 0) promises.push(addTrack(secondaryCues, 'es', 'Secondary', false));
                await Promise.all(promises);

                await video.requestPictureInPicture();
            }
        } catch (e) {
            console.warn('PiP failed:', e);
        }
    };

    useEffect(() => {
        const video = videoRef.current;
        if (!video) return;
        const onEnter = () => setIsPiP(true);
        const onLeave = () => {
            setIsPiP(false);
            Array.from(video.querySelectorAll('track[data-pip]')).forEach(t => t.remove());
        };
        video.addEventListener('enterpictureinpicture', onEnter);
        video.addEventListener('leavepictureinpicture', onLeave);
        return () => {
            video.removeEventListener('enterpictureinpicture', onEnter);
            video.removeEventListener('leavepictureinpicture', onLeave);
        };
    }, [videoSrc, videoKey]);

    const sortData = (data, option) => {
        const sorted = [...data];
        switch (option) {
            case 'newest': return sorted.sort((a, b) => b.mtime - a.mtime);
            case 'oldest': return sorted.sort((a, b) => a.mtime - b.mtime);
            case 'az': return sorted.sort((a, b) => a.name.localeCompare(b.name));
            case 'za': return sorted.sort((a, b) => b.name.localeCompare(a.name));
            default: return sorted;
        }
    };

    const handleSeriesSelect = (series) => {
        setSelectedSeries(series);
        setCurrentView('player');
        setIsSidebarOpen(true);
    };

    const handleVideoSelect = async (video) => {
        // Clear dismissed resume tracking — user is actively watching something
        dismissedResumePathRef.current = null;
        // Save current video's position before switching
        if (currentVideoPathRef.current && currentTime > 0) {
            const positions = JSON.parse(localStorage.getItem('axo_video_positions') || '{}');
            positions[currentVideoPathRef.current] = currentTime;
            localStorage.setItem('axo_video_positions', JSON.stringify(positions));
        }
        setCurrentVideo(video);
        setCurrentTime(0);
        // Only reset speed if not restoring from saved state
        const savedState = JSON.parse(localStorage.getItem('axo_playback_state') || '{}');
        if (savedState.videoPath !== video.path) {
            setPlaybackSpeed(1);
        }
        setVideoSrc(null);
        setIsSidebarOpen(false);
        seekOffsetRef.current = 0;
        // Check for saved per-video position
        if (pendingSeekRef.current === 0) {
            const positions = JSON.parse(localStorage.getItem('axo_video_positions') || '{}');
            if (positions[video.path] && positions[video.path] > 0) {
                pendingSeekRef.current = positions[video.path];
            }
        }
        currentVideoPathRef.current = video.path;

        // Scan for subtitles and load saved preference
        const subs = scanForSubtitles(video.path);
        setAvailableSubs(subs);
        const savedSubs = JSON.parse(localStorage.getItem('axo_subtitle_prefs') || '{}');
        const savedSubPath = savedSubs[video.path];
        if (savedSubPath && subs.some(s => s.path === savedSubPath)) {
            loadSubtitle(savedSubPath, video.path);
        } else {
            setPrimaryCues([]);
            setPrimaryText('');
            setActiveSubPath(null);
        }

        // Load saved secondary subtitle preference
        const savedSubs2 = JSON.parse(localStorage.getItem('axo_subtitle2_prefs') || '{}');
        const savedSubPath2 = savedSubs2[video.path];
        if (savedSubPath2 && subs.some(s => s.path === savedSubPath2)) {
            loadSecondarySubtitle(savedSubPath2, video.path);
        } else {
            setSecondaryCues([]);
            setActiveSubPath2(null);
            setSecondaryText('');
        }

        const isNative = isNativelySupportedFormat(video.path);
        console.log(`[TVPlayer] Playing: ${video.name} | Format: ${isNative ? 'NATIVE' : 'NEEDS REMUX'} | Ext: ${video.path.split('.').pop()}`);
        const dur = await getVideoDuration(video.path);
        setDuration(dur);

        if (isNative) {
            // Native format — serve directly with Range requests, seeking is instant
            setPlaybackMode('direct');
            try {
                const url = await createFileServer(video.path);
                setVideoKey(Date.now());
                setVideoSrc(url);
            } catch (err) {
                console.error('Direct playback failed:', err);
            }
        } else {
            // MKV/AVI — start streaming immediately, remux in background
            setPlaybackMode('transcode');
            try {
                const url = await startStreamingTranscode(video.path);
                setVideoKey(Date.now());
                setVideoSrc(`${url}?t=${Date.now()}`);
            } catch (err) {
                console.error('Streaming transcode failed:', err);
                return;
            }

            // Simultaneously start background remux
            const videoPath = video.path;
            backgroundRemux(videoPath)
                .then(async (mp4Path) => {
                    // Make sure we're still playing the same video
                    if (currentVideoPathRef.current !== videoPath) return;

                    // Save current playback position
                    const currentPos = seekOffsetRef.current + (videoRef.current?.currentTime || 0);

                    // Switch to file-served mode for instant seeking
                    const url = await createFileServer(mp4Path);
                    pendingSeekRef.current = currentPos;
                    seekOffsetRef.current = 0;
                    setPlaybackMode('direct');
                    setVideoKey(Date.now());
                    setVideoSrc(url);
                    console.log('Switched to direct mode — seeking is now instant');
                })
                .catch(err => {
                    console.warn('Background remux failed, staying in transcode mode:', err);
                });
        }
    };

    const handleBackToGrid = () => {
        const videoPath = currentVideoPathRef.current;
        const savedTime = currentTime;

        // Save per-video position before leaving
        if (videoPath && savedTime > 0) {
            const positions = JSON.parse(localStorage.getItem('axo_video_positions') || '{}');
            positions[videoPath] = savedTime;
            localStorage.setItem('axo_video_positions', JSON.stringify(positions));
        }

        // Show "Continue watching?" prompt if there's progress and not dismissed
        if (currentVideo && savedTime > 0 && dismissedResumePathRef.current !== videoPath) {
            const path = window.require('path');
            setResumePrompt({
                series: selectedSeries,
                video: currentVideo,
                time: savedTime,
                speed: playbackSpeed,
                fileName: path.basename(currentVideo.name, path.extname(currentVideo.name)),
            });
        }

        setCurrentView('grid');
        setSelectedSeries(null);
        setCurrentVideo(null);
        setVideoSrc(null);
        currentVideoPathRef.current = '';
        cleanup();
    };

    const handleTimeUpdate = () => {
        if (videoRef.current && !isDraggingRef.current) {
            const t = playbackMode === 'direct'
                ? videoRef.current.currentTime
                : seekOffsetRef.current + videoRef.current.currentTime;
            setCurrentTime(t);

            // Update primary subtitle
            if (primaryCues.length > 0) {
                const cue = primaryCues.find(c => t >= c.start && t <= c.end);
                setPrimaryText(cue ? cue.text : '');
            }
            // Update secondary subtitle
            if (secondaryCues.length > 0) {
                const cue = secondaryCues.find(c => t >= c.start && t <= c.end);
                setSecondaryText(cue ? cue.text : '');
            }

            // Save playback state every 3 seconds (only when in player view)
            const now = Date.now();
            if (now - saveThrottleRef.current > 3000 && currentVideoPathRef.current) {
                saveThrottleRef.current = now;
                localStorage.setItem('axo_playback_state', JSON.stringify({
                    videoPath: currentVideoPathRef.current,
                    seriesName: selectedSeries?.name || '',
                    currentTime: t,
                    playbackSpeed,
                    wasInPlayerView: true,
                }));
            }
        }
    };

    const handleSeek = (e) => {
        const time = parseFloat(e.target.value);
        setCurrentTime(time);
    };

    const handleSeekEnd = async (e) => {
        isDraggingRef.current = false;
        const newTime = parseFloat(e.target.value);
        const state = stateRef.current;
        if (!state.currentVideo || !videoRef.current) return;
        console.log(`[TVPlayer] Seeking to ${newTime.toFixed(1)}s | Mode: ${state.playbackMode}`);

        if (state.playbackMode === 'direct') {
            // Instant native browser seeking
            videoRef.current.currentTime = newTime;
        } else {
            // Transcode mode — restart FFmpeg at new position
            setIsSeeking(true);
            seekOffsetRef.current = newTime;
            try {
                const url = await startStreamingTranscode(state.currentVideo.path, newTime);
                setVideoKey(Date.now());
                setVideoSrc(`${url}?t=${Date.now()}`);
            } catch (err) {
                console.error('Seek failed:', err);
                setIsSeeking(false);
            }
        }
    };

    const jump = (seconds) => {
        if (!videoRef.current) return;
        const state = stateRef.current;
        const currentRTime = state.playbackMode === 'direct'
            ? videoRef.current.currentTime
            : seekOffsetRef.current + videoRef.current.currentTime;
        const targetDur = state.playbackMode === 'direct' && isFinite(videoRef.current.duration) ? videoRef.current.duration : state.duration;
        const target = Math.max(0, Math.min(targetDur || 0, currentRTime + seconds));

        if (state.playbackMode === 'direct') {
            videoRef.current.currentTime = target;
        } else {
            handleSeekEnd({ target: { value: target } });
        }
    };

    const togglePlay = () => {
        if (videoRef.current) {
            const paused = videoRef.current.paused;
            if (!paused) videoRef.current.pause();
            else videoRef.current.play();
            setIsPlaying(paused);
        }
    };

    const toggleMute = () => {
        const next = !stateRef.current.isMuted;
        setIsMuted(next);
        if (videoRef.current) videoRef.current.muted = next;
        localStorage.setItem('axo_muted', String(next));
    };

    const handleSpeedChange = (speed) => {
        setPlaybackSpeed(speed);
        if (videoRef.current) videoRef.current.playbackRate = speed;
        setIsSpeedOpen(false);
        // Save speed to playback state immediately
        if (currentVideoPathRef.current) {
            const state = JSON.parse(localStorage.getItem('axo_playback_state') || '{}');
            state.playbackSpeed = speed;
            localStorage.setItem('axo_playback_state', JSON.stringify(state));
        }
    };

    useEffect(() => {
        if (videoSrc && videoRef.current) {
            videoRef.current.playbackRate = playbackSpeed;
        }
    }, [videoSrc, videoKey]);

    // Mouse idle -> hide controls
    const resetMouseIdle = useCallback(() => {
        setControlsVisible(true);
        if (mouseIdleTimerRef.current) clearTimeout(mouseIdleTimerRef.current);
        mouseIdleTimerRef.current = setTimeout(() => setControlsVisible(false), 2500);
    }, []);

    const handlePlayerMouseMove = useCallback(() => {
        resetMouseIdle();
    }, [resetMouseIdle]);

    const handlePlayerMouseLeave = useCallback(() => {
        if (mouseIdleTimerRef.current) clearTimeout(mouseIdleTimerRef.current);
        setControlsVisible(false);
    }, []);


    // Keyboard shortcuts: Space=play/pause, F=fullscreen, P=PiP
    useEffect(() => {
        const handleKeyDown = (e) => {
            if (e.target.tagName === 'INPUT' && e.target.type !== 'range') return;
            if (e.target.tagName === 'TEXTAREA') return;

            // Defocus range slider on space or arrows to cleanly return keyboard controls
            if (e.target.tagName === 'INPUT' && e.target.type === 'range') {
                if (['Space', 'ArrowRight', 'ArrowLeft', 'KeyF', 'KeyP', 'KeyM'].includes(e.code)) {
                    e.target.blur();
                }
            }

            if (e.code === 'Space' && currentVideo && videoRef.current) {
                e.preventDefault();
                togglePlay();
            }
            if (e.code === 'KeyF' && currentVideo) {
                e.preventDefault();
                toggleFullscreen();
            }
            if (e.code === 'KeyP' && currentVideo) {
                e.preventDefault();
                togglePiP();
            }
            if (e.code === 'KeyM' && currentVideo) {
                e.preventDefault();
                toggleMute();
            }
            if (e.code === 'ArrowRight' && currentVideo) {
                e.preventDefault();
                jump(10);
            }
            if (e.code === 'ArrowLeft' && currentVideo) {
                e.preventDefault();
                jump(-10);
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => {
            window.removeEventListener('keydown', handleKeyDown);
            if (mouseIdleTimerRef.current) clearTimeout(mouseIdleTimerRef.current);
        };
    }, [currentVideo, isPlaying]);

    // Notify parent when viewing media (player view with a video)
    useEffect(() => {
        if (onViewingMedia) {
            onViewingMedia(currentView === 'player' && !!currentVideo);
        }
    }, [currentView, currentVideo, onViewingMedia]);

    const filteredSeries = sortData(
        library.filter(s => s.name.toLowerCase().includes(search.toLowerCase())),
        sortOption
    );

    const filteredVideos = React.useMemo(() => selectedSeries
        ? sortData(
            selectedSeries.videos.filter(v => v.name.toLowerCase().includes(search.toLowerCase())),
            sortOption
        )
        : [], [selectedSeries, search, sortOption]);

    // Next / Previous video navigation
    const currentVideoIndex = currentVideo ? filteredVideos.findIndex(v => v.path === currentVideo.path) : -1;
    const hasPrev = currentVideoIndex > 0;
    const hasNext = currentVideoIndex >= 0 && currentVideoIndex < filteredVideos.length - 1;
    const goToPrev = () => { if (hasPrev) handleVideoSelect(filteredVideos[currentVideoIndex - 1]); };
    const goToNext = () => { if (hasNext) handleVideoSelect(filteredVideos[currentVideoIndex + 1]); };

    return (
        <div className={`h-screen w-full bg-black text-zinc-200 overflow-hidden flex flex-col ${showNavbar ? 'pl-12' : ''}`}>
            {showNavbar && <Navbar />}

            {currentView === 'grid' && (
                <div className="flex-1 flex flex-col overflow-hidden p-4 animate-in fade-in duration-300">
                    {/* Continue Watching prompt */}
                    {resumePrompt && (
                        <div className="mb-3 shrink-0 animate-in slide-in-from-top-4 fade-in duration-500">
                            <div className="bg-gradient-to-r from-blue-600/15 via-blue-500/10 to-transparent border border-blue-500/20 rounded-lg px-4 py-3 flex items-center justify-between backdrop-blur-sm">
                                <div className="flex items-center gap-3 min-w-0">
                                    <div className="w-8 h-8 rounded-full bg-blue-500/20 flex items-center justify-center shrink-0">
                                        <img src={playIcon} className="w-4 h-4 filter brightness-0 invert opacity-80" alt="play" />
                                    </div>
                                    <div className="min-w-0">
                                        <p className="text-[11px] text-zinc-400 font-medium">Continue watching?</p>
                                        <p className="text-[13px] text-white font-semibold truncate">{resumePrompt.fileName}</p>
                                        <p className="text-[10px] text-zinc-500 font-medium">{formatTime(resumePrompt.time)} in</p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-2 shrink-0 ml-4">
                                    <button
                                        onClick={handleResumeYes}
                                        className="px-4 py-1.5 bg-blue-600 hover:bg-blue-500 text-white text-[11px] font-bold uppercase tracking-wider rounded-md transition-all duration-200 hover:scale-105 cursor-pointer"
                                    >
                                        Yes
                                    </button>
                                    <button
                                        onClick={handleResumeNo}
                                        className="px-4 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-white text-[11px] font-bold uppercase tracking-wider rounded-md transition-all duration-200 border border-zinc-700/50 cursor-pointer"
                                    >
                                        No
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}

                    <div className="flex items-center gap-2 mb-3 shrink-0">
                        <SortDropdown current={sortOption} onChange={setSortOption} btnClassName="px-2 py-1.5 text-[10px] min-w-[70px]" />
                        <div className="relative">
                            <input type="text" placeholder="Search..." value={search} onChange={(e) => setSearch(e.target.value)} className="bg-zinc-900/80 border border-zinc-800/80 text-[11px] font-medium rounded-md px-2 py-1.5 w-40 outline-none focus:border-zinc-600 transition-all text-white placeholder:text-zinc-600" />
                            <img src={searchIcon} className="absolute right-3 top-1/2 -translate-y-1/2 w-3 h-3 filter brightness-0 invert opacity-20" alt="search" />
                        </div>
                    </div>

                    <div className="flex-1 overflow-y-auto custom-scrollbar">
                        {loading ? (
                            <div className="flex items-center justify-center h-full opacity-50">
                                <img src={loaderIcon} className="w-8 h-8 filter brightness-0 invert animate-spin opacity-20" alt="loading" />
                            </div>
                        ) : filteredSeries.length === 0 ? (
                            <div className="text-center py-20 opacity-30">
                                <img src={conceptsIcon} className="w-12 h-12 filter brightness-0 invert opacity-20 mb-4 mx-auto" alt="empty" />
                                <p className="text-xl font-bold uppercase tracking-widest">No Series Found</p>
                            </div>
                        ) : (
                            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-2 content-start pb-4">
                                {filteredSeries.map((series) => (
                                    <button
                                        key={series.name}
                                        onClick={() => handleSeriesSelect(series)}
                                        className="group relative aspect-[16/10] bg-zinc-900 rounded-md border border-zinc-800/60 hover:border-zinc-500 overflow-hidden transition-all duration-300 text-left cursor-pointer hover:shadow-lg hover:shadow-blue-500/5"
                                    >
                                        <div className="absolute inset-0 bg-zinc-900">
                                            <SeriesCover series={series} className="w-full h-full opacity-50 group-hover:opacity-80 transition-opacity duration-300" />
                                            <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/30 to-transparent"></div>
                                        </div>
                                        <div className="absolute top-1.5 right-1.5 bg-black/70 px-1.5 py-0.5 rounded-md text-[9px] font-bold text-zinc-300 z-10">{series.videos.length}</div>
                                        <div className="p-2 absolute bottom-0 left-0 right-0 z-10">
                                            <h3 className="text-sm font-semibold text-white leading-snug line-clamp-2 group-hover:text-blue-400 transition-colors">{series.name}</h3>
                                        </div>
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            )}

            {currentView === 'player' && selectedSeries && (
                <div className="flex-1 relative overflow-hidden flex">
                    <div className={`absolute top-0 bottom-0 left-0 z-50 bg-zinc-950/98 backdrop-blur-xl border-r border-zinc-800/50 w-[340px] shadow-2xl transition-transform duration-200 flex flex-col ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}>
                        <div className="px-3 py-2.5 border-b border-zinc-800/50 flex justify-between items-center">
                            <div className="flex items-center gap-2.5 min-w-0 flex-1">
                                <button onClick={handleBackToGrid} className="flex items-center text-zinc-500 hover:text-white transition-colors p-1.5 rounded-lg hover:bg-zinc-800 cursor-pointer shrink-0">
                                    <img src={chevronLeftIcon} className="w-4 h-4 filter brightness-0 invert opacity-50" alt="back" />
                                </button>
                                <h2 className="text-sm font-bold text-white leading-tight truncate">{selectedSeries.name}</h2>
                                <SeriesTotalStats videos={selectedSeries.videos} className="text-[10px] text-zinc-500 leading-none shrink-0" />
                            </div>
                            <button onClick={() => setIsSidebarOpen(false)} className="text-zinc-600 hover:text-white p-1.5 rounded-lg hover:bg-zinc-800 cursor-pointer shrink-0">
                                <img src={closeIcon} className="w-4 h-4 filter brightness-0 invert opacity-40" alt="close" />
                            </button>
                        </div>
                        <div className="px-2.5 py-2 border-b border-zinc-800/30 flex gap-2">
                            <input type="text" placeholder="Filter..." value={search} onChange={(e) => setSearch(e.target.value)} className="flex-1 bg-black/40 border border-zinc-800/60 rounded-lg px-2.5 py-1.5 text-xs font-medium text-white outline-none placeholder:text-zinc-600 focus:border-zinc-600" />
                            <SortDropdown current={sortOption} onChange={setSortOption} btnClassName="px-2.5 py-1.5 text-[10px] rounded-lg" />
                        </div>
                        <div className="flex-1 overflow-y-auto custom-scrollbar p-2 space-y-1.5">
                            {(() => {
                                const positions = JSON.parse(localStorage.getItem('axo_video_positions') || '{}');
                                const lastState = JSON.parse(localStorage.getItem('axo_playback_state') || '{}');
                                const lastWatchedPath = lastState.seriesName === selectedSeries?.name ? lastState.videoPath : null;
                                return filteredVideos.map((video, index) => {
                                    const isCurrentlyPlaying = currentVideo?.path === video.path;
                                    const savedPos = isCurrentlyPlaying ? currentTime : (positions[video.path] || 0);
                                    const cachedDur = durationCache[video.path] || 0;
                                    const progress = cachedDur > 0 ? Math.min((savedPos / cachedDur) * 100, 100) : 0;
                                    const isLastWatched = video.path === lastWatchedPath;
                                    return (
                                        <button key={index} onClick={() => handleVideoSelect(video)} className={`w-full text-left p-2 rounded-xl flex items-center gap-3 transition-all cursor-pointer relative overflow-hidden group/item ${currentVideo?.path === video.path ? 'bg-blue-600/15 border border-blue-600/30 shadow-sm' : 'hover:bg-zinc-900/70 border border-transparent'}`}>
                                            {isLastWatched && !currentVideo && (
                                                <div className="absolute right-0 top-1/2 -translate-y-1/2 w-[3px] h-6 bg-blue-500 rounded-l-full" />
                                            )}
                                            <div className="w-28 aspect-video rounded-lg overflow-hidden shrink-0 border border-white/10 relative bg-zinc-900 shadow-md group-hover/item:border-white/20 transition-all">
                                                <VideoThumbnail videoPath={video.path} className="w-full h-full object-cover opacity-85 group-hover/item:opacity-100 transition-opacity" />
                                                {currentVideo?.path === video.path && (
                                                    <div className="absolute inset-0 bg-blue-600/30 flex items-center justify-center backdrop-blur-[1px]">
                                                        <div className="w-2 h-2 rounded-full bg-white animate-pulse shadow-[0_0_8px_white]"></div>
                                                    </div>
                                                )}
                                                {progress > 0 && (
                                                    <div className="absolute bottom-0 left-0 right-0 h-[3px] bg-black/60">
                                                        <div className="h-full bg-blue-500 rounded-r-full transition-all" style={{ width: `${progress}%` }} />
                                                    </div>
                                                )}
                                            </div>
                                            <div className="min-w-0 flex-1">
                                                <h4 className={`text-xs font-semibold leading-snug line-clamp-2 transition-colors ${currentVideo?.path === video.path ? 'text-blue-400' : 'text-zinc-300 group-hover/item:text-white'}`}>{video.name.replace(/\.[^.]+$/, '')}</h4>
                                                <div className="flex items-center gap-1.5 leading-none mt-1.5">
                                                    <VideoDuration videoPath={video.path} className="text-[10px] text-zinc-500 font-mono" />
                                                    <span className="text-[10px] text-zinc-700">•</span>
                                                    <span className="text-[10px] text-zinc-600 font-mono">{formatFileSize(video.stats?.size || 0)}</span>
                                                </div>
                                            </div>
                                        </button>
                                    );
                                });
                            })()}
                        </div>
                    </div>

                    <div className="flex-1 bg-black flex flex-col h-full relative group/player" onMouseMove={handlePlayerMouseMove} onMouseLeave={handlePlayerMouseLeave} style={{ cursor: controlsVisible ? 'default' : 'none' }}>
                        {!isSidebarOpen && (
                            <button onClick={() => setIsSidebarOpen(true)} className={`absolute top-2 left-2 z-40 bg-black/60 backdrop-blur text-white p-2 rounded-md hover:bg-zinc-800 transition-all border border-zinc-700/50 duration-200 cursor-pointer ${controlsVisible ? 'opacity-100' : 'opacity-0'}`}>
                                <img src={listIcon} className="w-4 h-4 filter brightness-0 invert opacity-60" alt="list" />
                            </button>
                        )}

                        {currentVideo ? (
                            <div className="flex-1 relative flex flex-col w-full h-full">
                                <div className={`absolute top-0 left-0 right-0 pl-12 pr-4 py-2 bg-gradient-to-b from-black/80 to-transparent z-30 transition-opacity duration-200 flex items-start gap-2 ${isSidebarOpen ? 'opacity-0 pointer-events-none' : controlsVisible ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}>
                                    <button onClick={handleBackToGrid} className="shrink-0 bg-black/60 backdrop-blur text-white p-2 rounded-md hover:bg-zinc-800 transition-all border border-zinc-700/50 duration-200 cursor-pointer" title="Back to library">
                                        <img src={closeIcon} className="w-4 h-4 filter brightness-0 invert opacity-60" alt="close" />
                                    </button>
                                    <div className="min-w-0">
                                        <h2 className="text-sm font-semibold text-white">{currentVideo.name.replace(/\.[^.]+$/, '')}</h2>
                                        <p className="text-[9px] text-zinc-500">{selectedSeries.name}</p>
                                    </div>
                                </div>
                                <div ref={videoContainerRef} className="flex-1 relative group/controls overflow-hidden">
                                    {videoSrc && (
                                        <video
                                            key={videoKey}
                                            ref={videoRef}
                                            onClick={togglePlay}
                                            onTimeUpdate={handleTimeUpdate}
                                            onPlay={() => setIsPlaying(true)}
                                            onPause={() => setIsPlaying(false)}
                                            onLoadedMetadata={() => {
                                                if (videoRef.current && videoRef.current.duration && isFinite(videoRef.current.duration)) {
                                                    if (playbackMode === 'direct') {
                                                        setDuration(videoRef.current.duration);
                                                    }
                                                }
                                            }}
                                            onCanPlay={() => {
                                                setIsSeeking(false);
                                                if (videoRef.current) {
                                                    videoRef.current.playbackRate = playbackSpeed;
                                                    if (pendingSeekRef.current > 0) {
                                                        videoRef.current.currentTime = pendingSeekRef.current;
                                                        pendingSeekRef.current = 0;
                                                    }
                                                    if (isResumingRef.current) {
                                                        isResumingRef.current = false;
                                                        videoRef.current.pause();
                                                    } else {
                                                        videoRef.current.play().catch(e => console.warn("Auto-play blocked:", e));
                                                    }
                                                }
                                            }}
                                            onSeeking={() => setIsSeeking(true)}
                                            onSeeked={() => setIsSeeking(false)}
                                            onEnded={() => {
                                                if (duration > 0 && Math.abs(duration - currentTime) > 5) {
                                                    console.warn('Stream dropped out unexpectedly. Auto-recovering...');
                                                    handleSeekEnd({ target: { value: currentTime } });
                                                }
                                            }}
                                            onError={(e) => {
                                                console.error("Video Error:", videoRef.current?.error);
                                                if (videoRef.current?.error?.code === 2 || videoRef.current?.error?.code === 3) {
                                                    console.warn("Recovering from network state error...");
                                                    handleSeekEnd({ target: { value: Math.max(0, currentTime - 1) } });
                                                }
                                            }}
                                            className="absolute inset-0 w-full h-full object-contain outline-none bg-black"
                                            style={{ objectFit: 'contain' }}
                                            src={videoSrc}
                                            autoPlay
                                            muted={isMuted}
                                        >
                                            Your browser does not support the video tag.
                                        </video>
                                    )}
                                    {isSeeking && (
                                        <div className="absolute inset-0 flex items-center justify-center bg-black/40 z-20 pointer-events-none">
                                            <div className="w-10 h-10 rounded-full border-3 border-white/10 border-t-white/60 animate-spin"></div>
                                        </div>
                                    )}
                                    {/* Primary subtitle overlay — hidden during PiP */}
                                    {primaryText && !isPiP && (
                                        <div className="absolute inset-0 pointer-events-none z-10">
                                            <div
                                                className="absolute pointer-events-auto cursor-grab active:cursor-grabbing select-none"
                                                style={getSubOverlayStyle(subPositions.sub1)}
                                                onMouseDown={(e) => startSubDrag(e, 'sub1')}
                                                dangerouslySetInnerHTML={{ __html: primaryText.replace(/\n/g, ' ') }}
                                            />
                                        </div>
                                    )}
                                    {/* Secondary subtitle overlay — hidden during PiP */}
                                    {secondaryText && !isPiP && (
                                        <div className="absolute inset-0 pointer-events-none z-10">
                                            <div
                                                className="absolute pointer-events-auto cursor-grab active:cursor-grabbing select-none"
                                                style={getSubOverlayStyle(subPositions.sub2)}
                                                onMouseDown={(e) => startSubDrag(e, 'sub2')}
                                                dangerouslySetInnerHTML={{ __html: secondaryText.replace(/\n/g, ' ') }}
                                            />
                                        </div>
                                    )}
                                    <div className={`absolute bottom-0 left-0 right-0 px-3 py-2 bg-gradient-to-t from-black/90 via-black/50 to-transparent transition-opacity duration-300 flex flex-col gap-1 ${isSidebarOpen ? 'opacity-0' : controlsVisible ? 'opacity-100' : 'opacity-0'}`}>
                                        <input type="range" min="0" max={duration || 0} step="0.1" value={currentTime} onChange={handleSeek} onMouseDown={() => { isDraggingRef.current = true; }} onMouseUp={handleSeekEnd} onTouchStart={() => { isDraggingRef.current = true; }} onTouchEnd={handleSeekEnd} className="w-full h-1 bg-zinc-700/50 rounded-full appearance-none cursor-pointer accent-blue-500" style={{ background: `linear-gradient(to right, #3b82f6 ${(currentTime / (duration || 1)) * 100}%, #333 ${(currentTime / (duration || 1)) * 100}%)` }} />
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-2">
                                                <button onClick={goToPrev} disabled={!hasPrev} className={`flex items-center justify-center w-7 h-7 rounded-full transition-all cursor-pointer ${hasPrev ? 'text-white hover:bg-white/10' : 'text-zinc-700 cursor-default'}`}><img src={chevronLeftIcon} className={`w-3.5 h-3.5 filter brightness-0 invert ${hasPrev ? 'opacity-60' : 'opacity-20'}`} alt="prev" /></button>
                                                <button onClick={togglePlay} className="text-white hover:scale-105 transition-transform cursor-pointer flex items-center justify-center w-9 h-9 bg-white/10 rounded-full">{isPlaying ? <div className="flex gap-1"><div className="w-1 h-4 bg-white rounded-full"></div><div className="w-1 h-4 bg-white rounded-full"></div></div> : <img src={playIcon} className="w-4 h-4 filter brightness-0 invert ml-0.5" alt="play" />}</button>
                                                <button onClick={goToNext} disabled={!hasNext} className={`flex items-center justify-center w-7 h-7 rounded-full transition-all cursor-pointer ${hasNext ? 'text-white hover:bg-white/10' : 'text-zinc-700 cursor-default'}`}><img src={chevronLeftIcon} className={`w-3.5 h-3.5 filter brightness-0 invert rotate-180 ${hasNext ? 'opacity-60' : 'opacity-20'}`} alt="next" /></button>
                                                <div className="flex items-center gap-1"><button onClick={() => jump(-10)} className="text-[11px] font-bold text-zinc-400 hover:text-white transition-colors cursor-pointer px-2 py-1">-10s</button><button onClick={() => jump(10)} className="text-[11px] font-bold text-zinc-400 hover:text-white transition-colors cursor-pointer px-2 py-1">+10s</button></div>
                                                <div className="text-[11px] font-mono text-zinc-400">{formatTime(currentTime)}<span className="mx-1.5 text-zinc-600">/</span><span className="text-zinc-600">{formatTime(duration)}</span></div>
                                                <button onClick={(e) => { e.stopPropagation(); toggleMute(); }} className={`flex items-center justify-center w-7 h-7 rounded-full transition-all cursor-pointer ${isMuted ? 'text-red-400 hover:bg-red-500/10' : 'text-zinc-400 hover:bg-white/10'}`}>
                                                    {isMuted ? (
                                                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" /><line x1="23" y1="9" x2="17" y2="15" /><line x1="17" y1="9" x2="23" y2="15" /></svg>
                                                    ) : (
                                                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" /><path d="M19.07 4.93a10 10 0 0 1 0 14.14" /><path d="M15.54 8.46a5 5 0 0 1 0 7.07" /></svg>
                                                    )}
                                                </button>
                                            </div>
                                            <div className="flex items-center gap-1">
                                                <div className="relative">
                                                    <button onClick={(e) => { e.stopPropagation(); setIsSpeedOpen(!isSpeedOpen); }} className="text-[11px] font-bold text-zinc-400 hover:text-white transition-colors cursor-pointer px-2.5 py-1.5 border border-zinc-700/60 rounded-md">{playbackSpeed}x</button>
                                                    {isSpeedOpen && <><div className="fixed inset-0 z-40" onMouseDown={(e) => { if (e.target === e.currentTarget) { setIsSpeedOpen(false) } }}></div><div className="absolute bottom-full right-0 mb-1 bg-zinc-900/95 border border-zinc-700 rounded-md shadow-xl z-50 py-0.5 w-16">{[0.5, 1, 1.25, 1.5, 2].map(speed => <button key={speed} onClick={() => handleSpeedChange(speed)} className={`w-full text-center px-2 py-1.5 text-[11px] font-bold hover:bg-zinc-800 transition-colors cursor-pointer ${playbackSpeed === speed ? 'text-blue-400' : 'text-zinc-500'}`}>{speed}x</button>)}</div></>}
                                                </div>
                                                <div className="relative">
                                                    <button onClick={(e) => { e.stopPropagation(); setIsSubMenuOpen(!isSubMenuOpen); }} className={`text-[11px] font-bold transition-colors cursor-pointer px-2.5 py-1.5 border rounded-md ${activeSubPath ? 'text-blue-400 border-blue-500/30' : 'text-zinc-400 hover:text-white border-zinc-700/60'}`}>CC</button>
                                                    {isSubMenuOpen && <><div className="fixed inset-0 z-40" onMouseDown={(e) => { if (e.target === e.currentTarget) { setIsSubMenuOpen(false) } }}></div><div className="absolute bottom-full right-0 mb-1 bg-zinc-900/95 border border-zinc-700 rounded-md shadow-xl z-50 py-0.5 w-52 max-h-44 overflow-y-auto custom-scrollbar">
                                                        <button onClick={() => { clearSubtitle(currentVideoPathRef.current); setIsSubMenuOpen(false); }} className={`w-full text-left px-3 py-2 text-[10px] font-bold hover:bg-zinc-800 transition-colors ${!activeSubPath ? 'text-blue-400 bg-zinc-800' : 'text-zinc-400'}`}>Off</button>
                                                        {availableSubs.length === 0 ? (
                                                            <div className="px-3 py-2 text-[10px] text-zinc-600 font-bold">No .srt files found</div>
                                                        ) : availableSubs.map((sub, i) => (
                                                            <button key={i} onClick={() => { loadSubtitle(sub.path, currentVideoPathRef.current); setIsSubMenuOpen(false); }} className={`w-full text-left px-3 py-2 text-[10px] font-bold hover:bg-zinc-800 transition-colors truncate ${activeSubPath === sub.path ? 'text-blue-400 bg-zinc-800' : 'text-zinc-400'}`}>{sub.name}</button>
                                                        ))}
                                                    </div></>}
                                                </div>
                                                <div className="relative">
                                                    <button onClick={(e) => { e.stopPropagation(); setIsSubMenu2Open(!isSubMenu2Open); }} className={`text-[11px] font-bold transition-colors cursor-pointer px-2.5 py-1.5 border rounded-md ${activeSubPath2 ? 'text-blue-400 border-blue-500/30' : 'text-zinc-400 hover:text-white border-zinc-700/60'}`}>CC2</button>
                                                    {isSubMenu2Open && <><div className="fixed inset-0 z-40" onMouseDown={(e) => { if (e.target === e.currentTarget) { setIsSubMenu2Open(false) } }}></div><div className="absolute bottom-full right-0 mb-1 bg-zinc-900/95 border border-zinc-700 rounded-md shadow-xl z-50 py-0.5 w-52 max-h-44 overflow-y-auto custom-scrollbar">
                                                        <button onClick={() => { clearSecondarySubtitle(currentVideoPathRef.current); setIsSubMenu2Open(false); }} className={`w-full text-left px-3 py-2 text-[10px] font-bold hover:bg-zinc-800 transition-colors ${!activeSubPath2 ? 'text-yellow-400 bg-zinc-800' : 'text-zinc-400'}`}>Off</button>
                                                        {availableSubs.length === 0 ? (
                                                            <div className="px-3 py-2 text-[10px] text-zinc-600 font-bold">No .srt files found</div>
                                                        ) : availableSubs.map((sub, i) => (
                                                            <button key={i} onClick={() => { loadSecondarySubtitle(sub.path, currentVideoPathRef.current); setIsSubMenu2Open(false); }} className={`w-full text-left px-3 py-2 text-[10px] font-bold hover:bg-zinc-800 transition-colors truncate ${activeSubPath2 === sub.path ? 'text-yellow-400 bg-zinc-800' : 'text-zinc-400'}`}>{sub.name}</button>
                                                        ))}
                                                    </div></>}
                                                </div>
                                                <div className="relative">
                                                    <button onClick={(e) => { e.stopPropagation(); setIsSubSettingsOpen(!isSubSettingsOpen); }} className={`text-[11px] font-bold transition-colors cursor-pointer px-2.5 py-1.5 border rounded-md ${isSubSettingsOpen ? 'text-emerald-400 border-emerald-500/30' : 'text-zinc-400 hover:text-white border-zinc-700/60'}`}>⚙</button>
                                                    {isSubSettingsOpen && <><div className="fixed inset-0 z-40" onMouseDown={(e) => { if (e.target === e.currentTarget) { setIsSubSettingsOpen(false) } }}></div><div className="absolute bottom-full right-0 mb-1 bg-zinc-900/95 border border-zinc-700 rounded-md shadow-xl z-50 p-2.5 w-52" onClick={(e) => e.stopPropagation()}>
                                                        <h4 className="text-[10px] font-black text-zinc-300 uppercase tracking-widest mb-3">Subtitle Settings</h4>
                                                        <div className="space-y-3">
                                                            <div>
                                                                <label className="text-[10px] font-bold text-zinc-500 block mb-1">Font Size: {subStyle.fontSize}px</label>
                                                                <input type="range" min="10" max="40" step="1" value={subStyle.fontSize} onChange={(e) => updateSubStyle({ fontSize: parseInt(e.target.value) })} className="w-full h-1 bg-zinc-800 rounded-full appearance-none cursor-pointer accent-blue-500" />
                                                            </div>
                                                            <div>
                                                                <label className="text-[10px] font-bold text-zinc-500 block mb-1">BG Opacity: {subStyle.bgOpacity}%</label>
                                                                <input type="range" min="0" max="100" step="5" value={subStyle.bgOpacity} onChange={(e) => updateSubStyle({ bgOpacity: parseInt(e.target.value) })} className="w-full h-1 bg-zinc-800 rounded-full appearance-none cursor-pointer accent-blue-500" />
                                                            </div>
                                                            <div>
                                                                <label className="text-[10px] font-bold text-zinc-500 block mb-1">Sub Width: {subStyle.containerWidth ?? 80}%</label>
                                                                <input type="range" min="20" max="100" step="5" value={subStyle.containerWidth ?? 80} onChange={(e) => updateSubStyle({ containerWidth: parseInt(e.target.value) })} className="w-full h-1 bg-zinc-800 rounded-full appearance-none cursor-pointer accent-blue-500" />
                                                            </div>
                                                            <div className="flex gap-3">
                                                                <div className="flex-1">
                                                                    <label className="text-[10px] font-bold text-zinc-500 block mb-1">Text Color</label>
                                                                    <input type="color" value={subStyle.textColor} onChange={(e) => updateSubStyle({ textColor: e.target.value })} className="w-full h-7 bg-zinc-800 border border-zinc-700 rounded cursor-pointer" />
                                                                </div>
                                                                <div className="flex-1">
                                                                    <label className="text-[10px] font-bold text-zinc-500 block mb-1">BG Color</label>
                                                                    <input type="color" value={subStyle.bgColor} onChange={(e) => updateSubStyle({ bgColor: e.target.value })} className="w-full h-7 bg-zinc-800 border border-zinc-700 rounded cursor-pointer" />
                                                                </div>
                                                            </div>
                                                            <button onClick={() => { updateSubStyle(defaultSubStyle); setSubPositions(defaultPositions); localStorage.setItem('axo_sub_positions', JSON.stringify(defaultPositions)); }} className="w-full text-[10px] font-bold text-zinc-500 hover:text-white py-1.5 border border-zinc-800 rounded-md hover:bg-zinc-800 transition-colors cursor-pointer mt-1">Reset to Default</button>
                                                        </div>
                                                    </div></>}
                                                </div>
                                                <button onClick={(e) => { e.stopPropagation(); togglePiP(); }} className={`text-[11px] font-bold transition-colors cursor-pointer px-2.5 py-1.5 border rounded-md ${isPiP ? 'text-blue-400 border-blue-500/30' : 'text-zinc-400 hover:text-white border-zinc-700/60'}`}>PiP</button>
                                                <button onClick={(e) => { e.stopPropagation(); toggleFullscreen(); }} className="text-[11px] font-bold text-zinc-400 hover:text-white transition-colors cursor-pointer px-2.5 py-1.5 border border-zinc-700/60 rounded-md">{isFullscreen ? '✕' : '⛶'}</button>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ) : (
                            <div className="flex-1 flex flex-col items-center justify-center text-zinc-800 select-none w-full h-full">
                                <div className="text-center p-6 bg-zinc-900/30 rounded-md border border-zinc-900">
                                    <img src={playIcon} className="w-12 h-12 block mx-auto filter brightness-0 invert opacity-10 mb-6" alt="play" />
                                    <h2 className="text-xl font-black uppercase tracking-widest opacity-30 text-zinc-500">Ready to Watch</h2>
                                    <p className="text-xs text-zinc-600 mt-2">Select an episode from the list to begin</p>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};

export default TVPlayer;
