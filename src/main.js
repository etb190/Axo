import { app, BrowserWindow, Menu, ipcMain, dialog } from 'electron';
import path from 'node:path';
import started from 'electron-squirrel-startup';

// Handle creating/removing shortcuts on Windows when installing/uninstalling.
if (started) {
  app.quit();
}

let mainWindow;

const getIconPath = (name) => {
  if (app.isPackaged) {
    return path.join(process.resourcesPath, name);
  }
  return path.join(__dirname, '../../src/assets', name);
};

const createWindow = () => {
  // Create the browser window.
  mainWindow = new BrowserWindow({
    width: 800,
    height: 600,
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
  mainWindow.setIcon(iconPath);
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
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// In this file you can include the rest of your app's specific main process
// code. You can also put them in separate files and import them here.
