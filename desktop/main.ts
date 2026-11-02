import { app, BrowserWindow, ipcMain } from 'electron';
import path from 'path';

let mainWindow: BrowserWindow | null = null;

export function createWindow(): BrowserWindow {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 1024,
    minHeight: 700,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
    },
    title: 'FarmaCore ERP - Terminal de Balcão',
    autoHideMenuBar: true,
  });

  const devUrl = process.env.VITE_DEV_SERVER_URL || 'http://localhost:3000';
  const isDev = process.env.NODE_ENV !== 'production' && !app.isPackaged;

  if (isDev) {
    mainWindow.loadURL(devUrl);
  } else {
    mainWindow.loadFile(path.join(__dirname, '../frontend/dist/index.html'));
  }

  // Desabilitar menu de contexto padrão
  mainWindow.webContents.on('context-menu', (event) => {
    event.preventDefault();
  });

  // Bloquear atalhos do browser (F5, Ctrl+R, Ctrl+W) para impedir perda de dados de atendimento
  mainWindow.webContents.on('before-input-event', (event, input) => {
    if (input.type !== 'keyDown') return;

    const isReload =
      input.key === 'F5' ||
      ((input.control || input.meta) && input.key.toLowerCase() === 'r');
    const isCloseWindow =
      (input.control || input.meta) && input.key.toLowerCase() === 'w';

    if (isReload || isCloseWindow) {
      event.preventDefault();
    }
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  return mainWindow;
}

// IPC Handlers para controle da janela e testes de integração
ipcMain.handle('ping', () => 'pong');

ipcMain.on('window-close', () => {
  mainWindow?.close();
});

ipcMain.on('window-minimize', () => {
  mainWindow?.minimize();
});

ipcMain.on('window-maximize', () => {
  if (mainWindow?.isMaximized()) {
    mainWindow.unmaximize();
  } else {
    mainWindow?.maximize();
  }
});

app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
