/**
 * desktop/main.cjs
 * Electron Main Process for Voxel Bedwars.
 * Native window management, F11 fullscreen, LAN UDP broadcast, and asset loading.
 */

const path = require('path');
const dgram = require('dgram');

let electron;
try {
  electron = require('electron');
} catch (e) {
  // Graceful fallback for test runner environments where electron binary isn't launched
  electron = null;
}

const { app, BrowserWindow, ipcMain, Menu, globalShortcut } = electron || {};

const WINDOW_CONFIG = {
  width: 1280,
  height: 720,
  minWidth: 960,
  minHeight: 540,
  center: true,
  title: 'Voxel Bedwars',
  backgroundColor: '#0f172a',
  webPreferences: {
    preload: path.join(__dirname, 'preload.cjs'),
    contextIsolation: true,
    nodeIntegration: false,
    sandbox: true,
  },
};

let mainWindow = null;
let lanSocket = null;

function createWindow() {
  if (!BrowserWindow) return null;

  mainWindow = new BrowserWindow(WINDOW_CONFIG);

  // Setup Application Menu
  const menuTemplate = [
    {
      label: 'Game',
      submenu: [
        {
          label: 'Toggle Fullscreen',
          accelerator: 'F11',
          click: () => {
            if (mainWindow) {
              mainWindow.setFullScreen(!mainWindow.isFullScreen());
            }
          },
        },
        {
          label: 'Reload',
          accelerator: 'CmdOrCtrl+R',
          click: () => mainWindow && mainWindow.reload(),
        },
        { type: 'separator' },
        {
          label: 'Quit',
          accelerator: 'CmdOrCtrl+Q',
          click: () => app && app.quit(),
        },
      ],
    },
    {
      label: 'View',
      submenu: [
        {
          label: 'Toggle Developer Tools',
          accelerator: 'CmdOrCtrl+Shift+I',
          click: () => mainWindow && mainWindow.webContents.toggleDevTools(),
        },
      ],
    },
  ];

  const menu = Menu.buildFromTemplate(menuTemplate);
  Menu.setApplicationMenu(menu);

  // Load URL or production dist bundle
  const devServerUrl = process.env.VITE_DEV_SERVER_URL;
  if (devServerUrl) {
    mainWindow.loadURL(devServerUrl);
  } else {
    const indexPath = path.join(__dirname, '..', 'dist', 'index.html');
    mainWindow.loadFile(indexPath).catch(() => {
      // If dist doesn't exist yet, try local dev URL fallback
      mainWindow.loadURL('http://localhost:5173');
    });
  }

  // Handle window close
  mainWindow.on('closed', () => {
    mainWindow = null;
    cleanupLanSocket();
  });

  return mainWindow;
}

// Window Control IPC Handlers
function registerIpcHandlers() {
  if (!ipcMain) return;

  ipcMain.on('window-minimize', () => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.minimize();
    }
  });

  ipcMain.on('window-maximize', () => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      if (mainWindow.isMaximized()) {
        mainWindow.unmaximize();
      } else {
        mainWindow.maximize();
      }
    }
  });

  ipcMain.on('window-fullscreen', () => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.setFullScreen(!mainWindow.isFullScreen());
    }
  });

  ipcMain.on('window-close', () => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.close();
    }
  });

  // LAN Broadcast IPC Handler
  ipcMain.handle('lan-broadcast', async (_event, { message, port = 8766 }) => {
    return new Promise((resolve) => {
      try {
        const client = dgram.createSocket({ type: 'udp4', reuseAddr: true });
        const buf = Buffer.from(typeof message === 'string' ? message : JSON.stringify(message));
        client.bind(() => {
          client.setBroadcast(true);
          client.send(buf, 0, buf.length, port, '255.255.255.255', (err) => {
            client.close();
            resolve(!err);
          });
        });
      } catch (err) {
        resolve(false);
      }
    });
  });

  // LAN Listener IPC Handler
  ipcMain.on('lan-listen-start', (_event, { port = 8766 }) => {
    cleanupLanSocket();
    try {
      lanSocket = dgram.createSocket({ type: 'udp4', reuseAddr: true });
      lanSocket.on('message', (msg, rinfo) => {
        if (mainWindow && !mainWindow.isDestroyed()) {
          try {
            const data = JSON.parse(msg.toString('utf-8'));
            mainWindow.webContents.send('lan-message', {
              senderIp: rinfo.address,
              senderPort: rinfo.port,
              payload: data,
            });
          } catch (e) {
            mainWindow.webContents.send('lan-message', {
              senderIp: rinfo.address,
              senderPort: rinfo.port,
              payload: msg.toString('utf-8'),
            });
          }
        }
      });
      lanSocket.bind(port, () => {
        // Listening on LAN port
      });
    } catch (e) {
      // Failed to bind LAN socket
    }
  });

  ipcMain.on('lan-listen-stop', () => {
    cleanupLanSocket();
  });
}

function cleanupLanSocket() {
  if (lanSocket) {
    try {
      lanSocket.close();
    } catch (e) {}
    lanSocket = null;
  }
}

// App lifecycle
if (app) {
  app.whenReady().then(() => {
    registerIpcHandlers();
    createWindow();

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) {
        createWindow();
      }
    });
  });

  app.on('window-all-closed', () => {
    cleanupLanSocket();
    if (process.platform !== 'darwin') {
      app.quit();
    }
  });
}

module.exports = {
  WINDOW_CONFIG,
  createWindow,
  registerIpcHandlers,
  cleanupLanSocket,
};
