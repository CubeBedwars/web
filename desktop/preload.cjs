/**
 * desktop/preload.cjs
 * Electron Preload Script for Voxel Bedwars.
 * Secure contextBridge exposing platform detection, window controls, and LAN UDP bridge.
 */

const { contextBridge, ipcRenderer } = (() => {
  try {
    return require('electron');
  } catch (e) {
    // Headless / test shim fallback
    return {
      contextBridge: {
        exposeInMainWorld: (key, api) => {
          if (typeof globalThis !== 'undefined') {
            globalThis[key] = api;
          }
        },
      },
      ipcRenderer: {
        send: () => {},
        invoke: async () => true,
        on: () => {},
        removeListener: () => {},
      },
    };
  }
})();

const electronAPI = {
  isElectron: true,
  platform: process.platform,

  // Window Controls
  minimize: () => ipcRenderer.send('window-minimize'),
  maximize: () => ipcRenderer.send('window-maximize'),
  toggleFullscreen: () => ipcRenderer.send('window-fullscreen'),
  close: () => ipcRenderer.send('window-close'),

  // LAN Multiplayer UDP Socket Bridge
  broadcastLAN: (message, port = 8766) => {
    return ipcRenderer.invoke('lan-broadcast', { message, port });
  },

  listenLAN: (port = 8766, callback) => {
    ipcRenderer.send('lan-listen-start', { port });
    if (typeof callback === 'function') {
      ipcRenderer.on('lan-message', (_event, data) => callback(data));
    }
  },

  stopListenLAN: () => {
    ipcRenderer.send('lan-listen-stop');
  },

  onLANMessage: (callback) => {
    if (typeof callback === 'function') {
      const listener = (_event, data) => callback(data);
      ipcRenderer.on('lan-message', listener);
      return () => ipcRenderer.removeListener('lan-message', listener);
    }
  },
};

// Expose API securely to main world
if (contextBridge && typeof contextBridge.exposeInMainWorld === 'function') {
  contextBridge.exposeInMainWorld('electronAPI', electronAPI);
}

// CommonJS export for Node.js test suites
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { electronAPI };
}
