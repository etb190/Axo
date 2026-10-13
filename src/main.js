import { app, BrowserWindow, Menu, ipcMain, dialog, nativeImage } from 'electron';
import path from 'node:path';
import fs from 'node:fs';
import { exec } from 'node:child_process';
import started from 'electron-squirrel-startup';
import { startBridgeServer, stopBridgeServer, saveConfig } from './services/extensionBridgeServer.js';
import { startAndroidBridgeServer, stopAndroidBridgeServer } from './services/androidBridgeServer.js';
import { discordRpc } from './services/discordRpc.js';

// Handle creating/removing shortcuts on Windows when installing/uninstalling.
if (started) {
  app.quit();
}

// ---------------------------------------------------------------------------
// Timezone watcher
//
// Electron/Chromium reads the OS timezone ONCE at process startup and never
// refreshes it. If Windows changes its timezone while Axo is running (e.g.
// "Set time zone automatically" corrects itself, a Windows update changes the
// DST rule, or the PC's zone was fixed later), the app keeps showing the old,
// stale offset — typically making every clock in the app look 1 hour off.
//
// We poll the effective Windows timezone (registry: ActiveTimeBias +
// TimeZoneKeyName). When it changes we relaunch the app so Chromium picks up
// the fresh zone. Ongoing TimeTracker sessions are persisted to disk and are
// automatically resumed on relaunch, so this is safe.
// ---------------------------------------------------------------------------
let tzBaseline = null;
let tzWatcherInterval = null;
let tzRestartPending = false;

const readWindowsTimezone = () => new Promise((resolve) => {
  if (process.platform !== 'win32') return resolve(null);
  const key = 'HKLM\\SYSTEM\\CurrentControlSet\\Control\\TimeZoneInformation';
  exec(`reg query "${key}" /v ActiveTimeBias`, (err1, out1) => {
    if (err1) return resolve(null);
    const biasMatch = /ActiveTimeBias\s+REG_DWORD\s+0x([0-9a-f]+)/i.exec(out1 || '');
    if (!biasMatch) return resolve(null);
    exec(`reg query "${key}" /v TimeZoneKeyName`, (err2, out2) => {
      const nameMatch = err2 ? null : /TimeZoneKeyName\s+REG_SZ\s+(.*)/i.exec(out2 || '');
      resolve({
        bias: parseInt(biasMatch[1], 16), // minutes west of UTC (incl. DST)
        name: nameMatch ? nameMatch[1].trim() : '',
      });
    });
  });
});

const startTimezoneWatcher = async () => {
  tzBaseline = await readWindowsTimezone();
  if (!tzBaseline) return; // non-Windows or registry unavailable

  tzWatcherInterval = setInterval(async () => {
    if (tzRestartPending) return;
    const current = await readWindowsTimezone();
    if (!current) return;
    if (current.bias !== tzBaseline.bias || current.name !== tzBaseline.name) {
      tzRestartPending = true;
      clearInterval(tzWatcherInterval);
      tzWatcherInterval = null;
      console.log('[TimezoneWatcher] OS timezone changed:', tzBaseline, '->', current);
      try {
        await dialog.showMessageBox(mainWindow, {
          type: 'info',
          title: 'Timezone changed',
          message: 'Windows timezone changed — Axo will restart to show the correct time.',
          detail: `Was: ${tzBaseline.name || tzBaseline.bias}. Now: ${current.name || current.bias}.\nAny running timer will be resumed automatically.`,
          buttons: ['Restart now'],
          noLink: true,
        });
      } catch { /* window may be closed — still relaunch */ }
      app.relaunch();
      app.exit(0);
    }
  }, 60000);
};

let mainWindow;

const getIconPath = (name) => {
  const ext = process.platform === 'win32' ? '.ico' : '.png';
  const baseName = name.split('.')[0];
  const fileName = baseName + ext;

  let iconPath;
  if (app.isPackaged) {
    iconPath = path.join(process.resourcesPath, fileName);
  } else {
    iconPath = path.join(__dirname, '../../src/assets', fileName);
  }

  if (!fs.existsSync(iconPath)) {
    console.error('Icon not found at path:', iconPath);
    // Fallback to PNG if ICO fails
    if (ext === '.ico') {
      const pngPath = iconPath.replace('.ico', '.png');
      if (fs.existsSync(pngPath)) return pngPath;
    }
  }
  return iconPath;
};

const createWindow = () => {
  // Create the browser window (square: as wide as it is long).
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 700,
    minHeight: 700,
    icon: getIconPath('icon.png'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: true,
      contextIsolation: false,
      webSecurity: false,
    },
  });
  mainWindow.setMenuBarVisibility(false);

  // and load the index.html of the app.
  if (MAIN_WINDOW_VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(MAIN_WINDOW_VITE_DEV_SERVER_URL);
  } else {
    mainWindow.loadFile(path.join(__dirname, `../renderer/${MAIN_WINDOW_VITE_NAME}/index.html`));
  }

  // Open the DevTools.
  // Open the DevTools specific shortcut
  mainWindow.webContents.on("before-input-event", (event, input) => {
    if (input.key === 'F11') {
      mainWindow.webContents.toggleDevTools();
      event.preventDefault();
    }
  });

  // Enable native context menu for spellcheck and text editing
  mainWindow.webContents.on('context-menu', (event, params) => {
    const { selectionText, isEditable, dictionarySuggestions } = params;

    // Only show context menu if text is selected or editable
    if (isEditable || selectionText.trim().length > 0) {
      const filteredSuggestions = dictionarySuggestions ? dictionarySuggestions.filter(s => s && s.trim().length > 0) : [];

      const menuTemplate = [
        ...(params.misspelledWord ? [
          {
            label: 'Add to Dictionary',
            click: () => mainWindow.webContents.session.addWordToSpellCheckerDictionary(params.misspelledWord)
          },
          { type: 'separator' }
        ] : []),
        ...filteredSuggestions.map(suggestion => ({
          label: suggestion,
          click: () => mainWindow.webContents.replaceMisspelling(suggestion)
        })),
        ...(filteredSuggestions.length > 0 ? [{ type: 'separator' }] : []),
        { role: 'cut' },
        { role: 'copy' },
        { role: 'paste' },
        { type: 'separator' },
        { role: 'selectAll' }
      ];

      const menu = Menu.buildFromTemplate(menuTemplate);
      menu.popup();
    }
  });

};

ipcMain.on('update-app-icon', (event, isActive) => {
  if (!mainWindow) return;
  const iconName = isActive ? 'icon_active.png' : 'icon.png';
  const iconPath = getIconPath(iconName);

  console.log('Attempting to set icon:', iconPath, 'isActive:', isActive);

  try {
    const image = nativeImage.createFromPath(iconPath);
    if (image.isEmpty()) {
      console.error('Failed to create nativeImage from path:', iconPath);
      return;
    }
    mainWindow.setIcon(image);
    console.log('Icon set successfully');
  } catch (err) {
    console.error('Error in setIcon:', err);
  }
});



console.log('Registering select-pdf-file handler...');
ipcMain.handle('select-pdf-file', async () => {
  console.log('select-pdf-file handler called');
  const result = await dialog.showOpenDialog({
    properties: ['openFile'],
    filters: [
      { name: 'PDF Files', extensions: ['pdf'] }
    ]
  });
  if (result.canceled) return null;
  return result.filePaths[0];
});

ipcMain.handle('discord-rpc-get-status', async () => {
  return discordRpc.getStatus();
});

ipcMain.handle('discord-rpc-save-config', async (event, newConfig) => {
  return saveConfig(newConfig);
});

ipcMain.handle('discord-rpc-test-activity', async (event, sampleData) => {
  discordRpc.setActivity(sampleData || {
    bookTitle: 'Test Book Title',
    pdfName: 'test-book.pdf',
    currentPage: 42,
    totalPages: 250,
  });
  return discordRpc.getStatus();
});

ipcMain.handle('discord-rpc-clear-activity', async () => {
  discordRpc.clearActivity();
  return discordRpc.getStatus();
});

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.whenReady().then(() => {
  app.setAppUserModelId('com.axo.app');
  app.setLoginItemSettings({
    openAtLogin: true,
    path: app.getPath("exe"),
  });
  createWindow();
  startBridgeServer(mainWindow);
  startAndroidBridgeServer();
  startTimezoneWatcher();

  // On OS X it's common to re-create a window in the app when the
  // dock icon is clicked and there are no other windows open.
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on('window-all-closed', () => {
  stopBridgeServer();
  stopAndroidBridgeServer();
  if (tzWatcherInterval) {
    clearInterval(tzWatcherInterval);
    tzWatcherInterval = null;
  }
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
