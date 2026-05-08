// See the Electron documentation for details on how to use preload scripts:
// https://www.electronjs.org/docs/latest/tutorial/process-model#preload-scripts

const path = require('path');
const fs = require('fs');

// Resolve ffmpeg path for both dev and production
const resolveFFmpegPath = () => {
    // In production, ffmpeg.exe is copied to resources/ via extraResource
    const prodPath = path.join(process.resourcesPath, 'ffmpeg.exe');
    if (fs.existsSync(prodPath)) return prodPath;
    // In dev, use ffmpeg-static module  
    try { return require('ffmpeg-static'); } catch { return null; }
};

window.ffmpegPath = resolveFFmpegPath();
