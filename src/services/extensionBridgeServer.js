import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { discordRpc, DEFAULT_CLIENT_ID } from './discordRpc.js';
import { getCoverUrlForBook, getKindleBadgeUrl } from './coverService.js';

const CONFIG_FILE = 'C:\\Users\\PC\\Desktop\\database\\discord_rpc.json';
export const BRIDGE_PORT = 38120;

let server = null;
let currentWindow = null;
let activeSession = null; // { key, bookTitle, pdfName, startTime }
const sessionTimers = new Map(); // url -> start timestamp (seconds)
let watchdogTimer = null;
const WATCHDOG_TIMEOUT_MS = 15 * 60 * 1000; // 15-minute safety watchdog (clears presence if browser crashes)

function resetWatchdog() {
  if (watchdogTimer) clearTimeout(watchdogTimer);
  watchdogTimer = setTimeout(() => {
    watchdogTimer = null;
    console.log('[BridgeServer] No heartbeat for 25s; auto-clearing Discord presence.');
    activeSession = null;
    sessionTimers.clear();
    discordRpc.clearActivity();
    if (currentWindow && !currentWindow.isDestroyed()) {
      currentWindow.webContents.send('discord-rpc-reading-cleared');
    }
  }, WATCHDOG_TIMEOUT_MS);
}

function stopWatchdog() {
  if (watchdogTimer) {
    clearTimeout(watchdogTimer);
    watchdogTimer = null;
  }
}

function loadConfig() {
  try {
    if (fs.existsSync(CONFIG_FILE)) {
      const data = JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8'));
      return {
        clientId: data.clientId || DEFAULT_CLIENT_ID,
        enabled: data.enabled !== false,
      };
    }
  } catch (err) {
    console.error('[BridgeServer] Error reading config file:', err);
  }
  return { clientId: DEFAULT_CLIENT_ID, enabled: true };
}

export function saveConfig(newConfig) {
  try {
    const dir = path.dirname(CONFIG_FILE);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    const current = loadConfig();
    const updated = { ...current, ...newConfig };
    fs.writeFileSync(CONFIG_FILE, JSON.stringify(updated, null, 2), 'utf8');

    if (updated.clientId) {
      discordRpc.setClientId(updated.clientId);
    }
    if (updated.enabled === false) {
      discordRpc.clearActivity();
      discordRpc.disconnect();
    } else if (!discordRpc.isConnected) {
      discordRpc.connect();
    }

    return updated;
  } catch (err) {
    console.error('[BridgeServer] Error saving config:', err);
    return null;
  }
}

function parseJsonBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', (chunk) => {
      body += chunk;
      if (body.length > 1e6) { // 1MB limit
        req.destroy();
        reject(new Error('Payload too large'));
      }
    });
    req.on('end', () => {
      if (!body.trim()) return resolve({});
      try {
        resolve(JSON.parse(body));
      } catch (err) {
        reject(err);
      }
    });
    req.on('error', reject);
  });
}

function setCorsHeaders(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', '*');
  res.setHeader('Access-Control-Allow-Private-Network', 'true');
  res.setHeader('Access-Control-Max-Age', '86400');
}

export function startBridgeServer(mainWindow) {
  if (server) return;
  currentWindow = mainWindow;

  const config = loadConfig();
  if (config.enabled) {
    discordRpc.connect(config.clientId);
  }

  // Forward Discord RPC status changes to renderer
  discordRpc.onStatusChange((status) => {
    if (currentWindow && !currentWindow.isDestroyed()) {
      currentWindow.webContents.send('discord-rpc-status-update', status);
    }
  });

  server = http.createServer(async (req, res) => {
    setCorsHeaders(res);

    if (req.method === 'OPTIONS') {
      res.writeHead(204);
      res.end();
      return;
    }

    const url = new URL(req.url, `http://${req.headers.host}`);

    // GET /status
    if (req.method === 'GET' && url.pathname === '/status') {
      const status = discordRpc.getStatus();
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: true, port: BRIDGE_PORT, ...status, activeSession, config: loadConfig() }));
      return;
    }

    // POST /presence
    if (req.method === 'POST' && url.pathname === '/presence') {
      try {
        const body = await parseJsonBody(req);
        const { bookTitle, pdfName, currentPage, totalPages, url: pdfUrl, resetSession, startTime: requestedStartTime } = body;

        const config = loadConfig();
        if (!config.enabled) {
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: true, message: 'RPC is disabled in settings' }));
          return;
        }

        const docKey = pdfUrl || pdfName || 'current_doc';
        
        // Strict start gate & running timer preservation:
        // resetSession = true means user clicked "Start" (or bookmark jump).
        // The running timer is NEVER reset — it persists across book switches.
        // Only the very first Start of a reading session creates the timestamp.
        if (resetSession) {
          // Preserve running timer if a session already exists (switching books) or supplied by extension
          const preservedStartTime = (requestedStartTime && typeof requestedStartTime === 'number')
            ? requestedStartTime
            : (activeSession ? activeSession.startTime : Math.floor(Date.now() / 1000));
          sessionTimers.clear();
          sessionTimers.set(docKey, preservedStartTime);
          activeSession = {
            key: docKey,
            bookTitle,
            pdfName,
            startTime: preservedStartTime,
          };
          // Clear old activity so Discord picks up the new book's cover/title immediately
          discordRpc.clearActivity();
        } else if (activeSession && activeSession.key === docKey) {
          // Page navigation / heartbeat for the active book — keep existing startTime intact!
          activeSession.bookTitle = bookTitle || activeSession.bookTitle;
          activeSession.pdfName = pdfName || activeSession.pdfName;
        } else if (!activeSession && sessionTimers.has(docKey)) {
          // Tab was idle or bridge reconnected — revive session without resetting the timer!
          activeSession = {
            key: docKey,
            bookTitle,
            pdfName,
            startTime: sessionTimers.get(docKey),
          };
        } else {
          // Tab has not clicked Start yet; reject background heartbeat
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: false, ignored: true, message: 'Not the active started reading session' }));
          return;
        }

        // Running timer always uses the activeSession startTime (never resets on page flips)
        const startTime = activeSession ? activeSession.startTime : Math.floor(Date.now() / 1000);

        resetWatchdog();

        const coverUrl = await getCoverUrlForBook(bookTitle, pdfName);
        const smallBadgeUrl = await getKindleBadgeUrl();

        discordRpc.setActivity({
          bookTitle,
          pdfName,
          currentPage,
          totalPages,
          startTime,
          coverUrl,
          smallBadgeUrl,
          activityType: 0, // Playing ("Playing Kindle")
        });

        // Notify Axo renderer
        if (currentWindow && !currentWindow.isDestroyed()) {
          currentWindow.webContents.send('discord-rpc-reading-update', {
            bookTitle,
            pdfName,
            currentPage,
            totalPages,
            url: pdfUrl,
            startTime,
            coverUrl,
          });
        }

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, status: discordRpc.getStatus() }));
      } catch (err) {
        console.error('[BridgeServer] /presence error:', err);
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, error: err.message }));
      }
      return;
    }

    // POST /clear
    if (req.method === 'POST' && url.pathname === '/clear') {
      try {
        const body = await parseJsonBody(req);
        const { url: pdfUrl } = body;
        const docKey = pdfUrl || 'current_doc';

        if (!pdfUrl || (activeSession && activeSession.key === docKey)) {
          stopWatchdog();
          activeSession = null;
          sessionTimers.clear();
          discordRpc.clearActivity();

          if (currentWindow && !currentWindow.isDestroyed()) {
            currentWindow.webContents.send('discord-rpc-reading-cleared');
          }
        }

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true }));
      } catch (err) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, error: err.message }));
      }
      return;
    }

    // POST /config
    if (req.method === 'POST' && url.pathname === '/config') {
      try {
        const body = await parseJsonBody(req);
        const updated = saveConfig(body);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, config: updated }));
      } catch (err) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, error: err.message }));
      }
      return;
    }

    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Not found' }));
  });

  server.listen(BRIDGE_PORT, '127.0.0.1', () => {
    console.log(`[BridgeServer] Extension bridge server listening on http://127.0.0.1:${BRIDGE_PORT}`);
  });

  server.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
      console.warn(`[BridgeServer] Port ${BRIDGE_PORT} already in use, assuming bridge is already active.`);
    } else {
      console.error('[BridgeServer] Server error:', err);
    }
  });
}

export function stopBridgeServer() {
  stopWatchdog();
  if (server) {
    server.close();
    server = null;
  }
  discordRpc.clearActivity();
  discordRpc.disconnect();
}
