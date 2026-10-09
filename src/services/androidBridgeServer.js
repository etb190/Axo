// PDF Summarizer — Android Remote Bridge Server (Embedded in Axo)
// Connects the Chrome Extension on PC to the Android App over local Wi-Fi.

import http from 'node:http';
import os from 'node:os';
import fs from 'node:fs';
import path from 'node:path';

export const ANDROID_BRIDGE_PORT = 38126;
const HOST = '0.0.0.0';

let server = null;
let heartbeatInterval = null;

// Current active state of the PDF reader session
let state = {
  bookTitle: 'No Document Loaded',
  pdfName: '',
  currentPage: 1,
  totalPages: 1,
  summary: 'Waiting for summary from PC...',
  currentRecap: '',
  prevRecap: '',
  recaps: {},
  started: false,
  ttsPlaying: false,
  ttsAudioCurrentTime: 0,
  ttsAudioDuration: 0,
  ttsSpeed: 1.0,
  ttsAutoAdvance: true,
  ttsEnabled: true,
  originalMode: false,
  recapMode: false,
  nightMode: true,
  fontSize: 13,
  genre: 'nonfiction_classic',
  language: 'English',
  contextCount: 1,
  summaryLength: 1000,
  lastUpdate: Date.now()
};

// SSE connections
const phoneClients = new Set();
const extensionClients = new Set();

function getLocalIpAddresses() {
  const interfaces = os.networkInterfaces();
  const candidates = [];
  for (const name of Object.keys(interfaces)) {
    const isVirtual = /virtual|vbox|vmware|loopback|host-only/i.test(name);
    for (const iface of interfaces[name]) {
      if (iface.family === 'IPv4' && !iface.internal) {
        if (iface.address.startsWith('192.168.56.')) continue; // Skip VirtualBox host-only
        candidates.push({ address: iface.address, isVirtual, name });
      }
    }
  }
  candidates.sort((a, b) => {
    if (a.isVirtual !== b.isVirtual) return a.isVirtual ? 1 : -1;
    if (/wi-?fi/i.test(a.name) && !/wi-?fi/i.test(b.name)) return -1;
    return 0;
  });
  return candidates.map(c => c.address);
}

function parseJsonBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => {
      body += chunk;
      if (body.length > 5 * 1024 * 1024) {
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
}

function broadcastToPhones(data) {
  const payload = `data: ${JSON.stringify(data)}\n\n`;
  for (const client of phoneClients) {
    try {
      client.write(payload);
    } catch (e) {
      phoneClients.delete(client);
    }
  }
}

function broadcastToExtension(command) {
  const payload = `data: ${JSON.stringify(command)}\n\n`;
  for (const client of extensionClients) {
    try {
      client.write(payload);
    } catch (e) {
      extensionClients.delete(client);
    }
  }
}

export function startAndroidBridgeServer() {
  if (server) return;

  server = http.createServer(async (req, res) => {
    setCorsHeaders(res);

    if (req.method === 'OPTIONS') {
      res.writeHead(204);
      res.end();
      return;
    }

    const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);

    // 1. IP info
    if (url.pathname === '/api/ip') {
      const ips = getLocalIpAddresses();
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ port: ANDROID_BRIDGE_PORT, ips, preferredIp: ips[0] || '127.0.0.1' }));
      return;
    }

    // 2. State GET
    if (req.method === 'GET' && url.pathname === '/api/state') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(state));
      return;
    }

    // 3. State POST (from Chrome Extension)
    if (req.method === 'POST' && url.pathname === '/api/state') {
      try {
        const body = await parseJsonBody(req);
        if (body.summary) {
          body.summary = body.summary
            .replace(/[\u00A0\u1680\u2000-\u200B\u202F\u205F\u3000\uFEFF]/g, ' ')
            .replace(/[\u2010\u2011\u2012]/g, '-')
            .replace(/[ \t\f\v]+/g, ' ');
        }
        if (body.currentRecap) {
          body.currentRecap = body.currentRecap
            .replace(/[\u00A0\u1680\u2000-\u200B\u202F\u205F\u3000\uFEFF]/g, ' ')
            .replace(/[\u2010\u2011\u2012]/g, '-')
            .replace(/[ \t\f\v]+/g, ' ');
        }
        if (body.prevRecap) {
          body.prevRecap = body.prevRecap
            .replace(/[\u00A0\u1680\u2000-\u200B\u202F\u205F\u3000\uFEFF]/g, ' ')
            .replace(/[\u2010\u2011\u2012]/g, '-')
            .replace(/[ \t\f\v]+/g, ' ');
        }
        if (body.recaps && typeof body.recaps === 'object') {
          for (const k of Object.keys(body.recaps)) {
            if (typeof body.recaps[k] === 'string') {
              body.recaps[k] = body.recaps[k]
                .replace(/[\u00A0\u1680\u2000-\u200B\u202F\u205F\u3000\uFEFF]/g, ' ')
                .replace(/[\u2010\u2011\u2012]/g, '-')
                .replace(/[ \t\f\v]+/g, ' ');
            }
          }
        }
        state = {
          ...state,
          ...body,
          recaps: { ...(state.recaps || {}), ...(body.recaps || {}) },
          lastUpdate: Date.now()
        };
        broadcastToPhones(state);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true }));
      } catch (err) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, error: err.message }));
      }
      return;
    }

    // 4. SSE stream for Phones (Phone listens to PC updates)
    if (req.method === 'GET' && url.pathname === '/api/events') {
      res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive'
      });
      res.write(`data: ${JSON.stringify(state)}\n\n`);
      phoneClients.add(res);

      req.on('close', () => {
        phoneClients.delete(res);
      });
      return;
    }

    // 5. Command POST (from Phone -> forwarded to Chrome Extension)
    if (req.method === 'POST' && url.pathname === '/api/command') {
      try {
        const cmd = await parseJsonBody(req);
        broadcastToExtension(cmd);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, command: cmd.action }));
      } catch (err) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, error: err.message }));
      }
      return;
    }

    // 6. SSE stream for Extension (Extension listens to Phone commands)
    if (req.method === 'GET' && url.pathname === '/api/commands') {
      res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive'
      });
      res.write(`data: {"type":"CONNECTED"}\n\n`);
      extensionClients.add(res);

      req.on('close', () => {
        extensionClients.delete(res);
      });
      return;
    }

    // 7. Static file serving (for Web Remote fallback)
    const mobileWebPath = 'C:\\Users\\PC\\Desktop\\Coding\\pdf-summarizer-extension\\mobile-web';
    let filePath = path.join(mobileWebPath, url.pathname === '/' ? 'index.html' : url.pathname);
    if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
      const ext = path.extname(filePath).toLowerCase();
      const mimeTypes = {
        '.html': 'text/html; charset=utf-8',
        '.css': 'text/css; charset=utf-8',
        '.js': 'application/javascript; charset=utf-8',
        '.json': 'application/json',
        '.png': 'image/png',
        '.svg': 'image/svg+xml'
      };
      res.writeHead(200, { 'Content-Type': mimeTypes[ext] || 'application/octet-stream' });
      fs.createReadStream(filePath).pipe(res);
      return;
    }

    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('Not Found');
  });

  server.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
      console.warn(`[AndroidBridge] Port ${ANDROID_BRIDGE_PORT} is in use by another process.`);
    } else {
      console.error('[AndroidBridge] Server error:', err);
    }
  });

  heartbeatInterval = setInterval(() => {
    for (const client of phoneClients) {
      try { client.write(': ping\n\n'); } catch (e) { phoneClients.delete(client); }
    }
    for (const client of extensionClients) {
      try { client.write(': ping\n\n'); } catch (e) { extensionClients.delete(client); }
    }
  }, 15000);

  server.listen(ANDROID_BRIDGE_PORT, HOST, () => {
    const ips = getLocalIpAddresses();
    console.log(`[AndroidBridge] Listening on port ${ANDROID_BRIDGE_PORT}`);
    ips.forEach(ip => console.log(`[AndroidBridge] LAN Access: http://${ip}:${ANDROID_BRIDGE_PORT}`));
  });
}

export function stopAndroidBridgeServer() {
  if (heartbeatInterval) {
    clearInterval(heartbeatInterval);
    heartbeatInterval = null;
  }
  for (const client of phoneClients) {
    try { client.end(); } catch (e) {}
  }
  for (const client of extensionClients) {
    try { client.end(); } catch (e) {}
  }
  phoneClients.clear();
  extensionClients.clear();

  if (server) {
    try { server.close(); } catch (e) {}
    server = null;
  }
}
