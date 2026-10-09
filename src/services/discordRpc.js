import net from 'node:net';
import crypto from 'node:crypto';

// Default Client ID for PDF Summarizer
export const DEFAULT_CLIENT_ID = '1547881478774595705';

class DiscordRpcClient {
  constructor() {
    this.socket = null;
    this.clientId = DEFAULT_CLIENT_ID;
    this.isConnected = false;
    this.isConnecting = false;
    this.currentActivity = null;
    this.reconnectTimer = null;
    this.incomingBuffer = Buffer.alloc(0);
    this.onStatusChangeCallbacks = new Set();
  }

  setClientId(newId) {
    if (!newId || newId === this.clientId) return;
    this.clientId = newId.trim();
    if (this.isConnected || this.isConnecting) {
      this.disconnect();
      this.connect();
    }
  }

  onStatusChange(cb) {
    this.onStatusChangeCallbacks.add(cb);
    return () => this.onStatusChangeCallbacks.delete(cb);
  }

  notifyStatusChange() {
    for (const cb of this.onStatusChangeCallbacks) {
      try {
        cb({
          isConnected: this.isConnected,
          clientId: this.clientId,
          currentActivity: this.currentActivity,
        });
      } catch (err) {
        console.error('[DiscordRPC] Error in status callback:', err);
      }
    }
  }

  connect(customClientId) {
    if (customClientId) {
      this.clientId = customClientId.trim();
    }
    if (this.isConnected || this.isConnecting) {
      return;
    }

    this.isConnecting = true;
    this._tryConnectPipe(0);
  }

  _tryConnectPipe(pipeIndex) {
    if (pipeIndex > 9) {
      this.isConnecting = false;
      this.isConnected = false;
      this.notifyStatusChange();
      this._scheduleReconnect(15000);
      return;
    }

    const pipePath = process.platform === 'win32'
      ? `\\\\.\\pipe\\discord-ipc-${pipeIndex}`
      : `${process.env.XDG_RUNTIME_DIR || process.env.TMPDIR || process.env.TMP || '/tmp'}/discord-ipc-${pipeIndex}`;

    const socket = net.createConnection(pipePath);

    const onConnect = () => {
      cleanup();
      this.socket = socket;
      this.isConnecting = false;
      this._setupSocketListeners();
      this._sendHandshake();
    };

    const onError = () => {
      cleanup();
      socket.destroy();
      // Try next pipe
      this._tryConnectPipe(pipeIndex + 1);
    };

    const cleanup = () => {
      socket.removeListener('connect', onConnect);
      socket.removeListener('error', onError);
    };

    socket.once('connect', onConnect);
    socket.once('error', onError);
  }

  _setupSocketListeners() {
    if (!this.socket) return;

    this.socket.on('data', (data) => {
      this.incomingBuffer = Buffer.concat([this.incomingBuffer, data]);
      this._processBuffer();
    });

    this.socket.on('close', () => {
      this._handleDisconnect();
    });

    this.socket.on('error', (err) => {
      console.warn('[DiscordRPC] Socket error:', err.message);
      this._handleDisconnect();
    });
  }

  _processBuffer() {
    while (this.incomingBuffer.length >= 8) {
      const opcode = this.incomingBuffer.readInt32LE(0);
      const length = this.incomingBuffer.readInt32LE(4);

      if (this.incomingBuffer.length < 8 + length) {
        // Wait for full packet
        break;
      }

      const payloadBuf = this.incomingBuffer.subarray(8, 8 + length);
      this.incomingBuffer = this.incomingBuffer.subarray(8 + length);

      this._handleMessage(opcode, payloadBuf);
    }
  }

  _handleMessage(opcode, payloadBuf) {
    try {
      const text = payloadBuf.toString('utf8');
      const data = JSON.parse(text);

      if (opcode === 1) { // FRAME
        if (data.cmd === 'DISPATCH' && data.evt === 'READY') {
          console.log('[DiscordRPC] Connected to Discord as application:', this.clientId);
          this.isConnected = true;
          this.lastError = null;
          this.notifyStatusChange();

          // Resend current activity if queued, otherwise clear stale presence from Discord
          if (this.currentActivity) {
            this.sendActivityPayload(this.currentActivity);
          } else {
            this.sendActivityPayload(null);
          }
        }
      } else if (opcode === 2) { // CLOSE
        console.warn('[DiscordRPC] Received CLOSE from Discord:', data);
        this.lastError = data.message || 'Connection closed by Discord';
        this.disconnect();
        if (data.code === 4000) {
          // Don't auto-reconnect on invalid client ID
          if (this.reconnectTimer) {
            clearTimeout(this.reconnectTimer);
            this.reconnectTimer = null;
          }
        }
      } else if (opcode === 3) { // PING
        this._sendPacket(4, data); // PONG
      }
    } catch (e) {
      console.error('[DiscordRPC] Failed to parse message:', e);
    }
  }

  _sendHandshake() {
    const payload = {
      v: 1,
      client_id: this.clientId,
    };
    this._sendPacket(0, payload);
  }

  _sendPacket(opcode, payload) {
    if (!this.socket || this.socket.destroyed) return;
    try {
      const json = JSON.stringify(payload);
      const payloadBuf = Buffer.from(json, 'utf8');
      const headerBuf = Buffer.alloc(8);
      headerBuf.writeInt32LE(opcode, 0);
      headerBuf.writeInt32LE(payloadBuf.length, 4);

      const packet = Buffer.concat([headerBuf, payloadBuf]);
      this.socket.write(packet);
    } catch (err) {
      console.error('[DiscordRPC] Failed to send packet:', err);
    }
  }

  setActivity({ bookTitle, pdfName, currentPage, totalPages, startTime, coverUrl, smallBadgeUrl, activityType = 0 }) {
    // Truncate to Discord limits (max 128 chars for strings)
    let title = (bookTitle || pdfName || 'Reading').trim();
    title = title.replace(/\.pdf$/i, '').trim();
    title = title.replace(/(['’])([A-Z]+)\b/g, (m, quote, letters) => quote + letters.toLowerCase());
    title = title.substring(0, 128);

    // Display only page progress in state line — never repeat the title or show .pdf
    let stateText = '';
    if (currentPage && totalPages) {
      stateText = `Page ${currentPage} of ${totalPages}`;
    } else if (currentPage) {
      stateText = `Page ${currentPage}`;
    }
    stateText = stateText.substring(0, 128);

    const activity = {
      type: activityType, // 0 = Playing ("Playing Kindle")
      details: title,
      state: stateText || undefined,
      timestamps: {
        start: startTime || Math.floor(Date.now() / 1000),
      },
      assets: {
        large_image: (coverUrl && coverUrl.startsWith('https://')) ? coverUrl : 'kindle',
        large_text: title,
        small_image: (smallBadgeUrl && smallBadgeUrl.startsWith('https://')) ? smallBadgeUrl : 'https://cdn.discordapp.com/app-icons/1547881478774595705/9f913825c797ce44d9a79a0ccaeeec5b.png',
        small_text: 'Kindle',
      },
      instance: true,
    };

    this.currentActivity = activity;

    if (this.isConnected) {
      this.sendActivityPayload(activity);
    } else if (!this.isConnecting) {
      this.connect();
    }

    this.notifyStatusChange();
  }

  sendActivityPayload(activity) {
    const args = { pid: process.pid };
    if (activity) {
      args.activity = activity;
    }
    const payload = {
      cmd: 'SET_ACTIVITY',
      args,
      nonce: crypto.randomUUID(),
    };
    this._sendPacket(1, payload);
  }

  clearActivity() {
    this.currentActivity = null;
    if (this.isConnected) {
      this.sendActivityPayload(null);
    }
    this.notifyStatusChange();
  }

  _handleDisconnect() {
    this.isConnected = false;
    this.isConnecting = false;
    if (this.socket) {
      this.socket.destroy();
      this.socket = null;
    }
    this.notifyStatusChange();
    this._scheduleReconnect(10000);
  }

  _scheduleReconnect(delayMs) {
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      if (!this.isConnected && !this.isConnecting) {
        this.connect();
      }
    }, delayMs);
  }

  disconnect() {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    this.isConnected = false;
    this.isConnecting = false;
    if (this.socket) {
      this.socket.destroy();
      this.socket = null;
    }
    this.notifyStatusChange();
  }

  getStatus() {
    return {
      isConnected: this.isConnected,
      isConnecting: this.isConnecting,
      clientId: this.clientId,
      currentActivity: this.currentActivity,
      lastError: this.lastError || null,
    };
  }
}

export const discordRpc = new DiscordRpcClient();
