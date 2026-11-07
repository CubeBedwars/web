# Voxel Bedwars — Desktop Client (Electron)

This directory contains the production-grade native Electron wrapper for **Voxel Bedwars**, providing desktop window management, F11 fullscreen gaming mode, IPC security bridging, and native UDP LAN beacon broadcasting/listening.

---

## Architecture

- **Main Process** (`main.cjs`):
  - Configures 1280x720 initial window with minimum 960x540 bounds.
  - Hardens security with `contextIsolation: true`, `nodeIntegration: false`, and `sandbox: true`.
  - Implements F11 fullscreen shortcut and window control IPC handlers (minimize, maximize, close).
  - Integrates `dgram` UDP sockets on port 8766 for local subnet LAN game broadcasting and discovery.
  - Loads production assets from `../dist/index.html` with hot-reloading dev server fallback.
- **Preload Script** (`preload.cjs`):
  - Uses Electron `contextBridge.exposeInMainWorld` to expose `window.electronAPI`.
  - Exposes platform detection (`isElectron`, `platform`).
  - Provides window control bridges (`minimize`, `maximize`, `toggleFullscreen`, `close`).
  - Provides UDP LAN multiplayer broadcast and listener hooks.

---

## Development

To run the desktop application in development mode:

1. Build or start the web client from the repository root:
   ```bash
   npm run dev
   ```
2. In a separate terminal, launch the desktop client:
   ```bash
   npm run desktop:dev
   ```

---

## Building Executables

Build the web application first, then package for your operating system:

```bash
# 1. Build production web bundle
npm run build

# 2. Package desktop standalone application
npm run desktop:build
```

### Platform-Specific Targets:

- **Windows (.exe)**:
  - Generates NSIS installer and standalone portable executable:
    ```bash
    cd desktop && npm run dist:win
    ```
  - Outputs to `dist-electron/Voxel Bedwars Setup 1.0.0.exe` and `dist-electron/Voxel Bedwars 1.0.0.exe`.

- **macOS (.dmg / .zip)**:
  - Generates signed Apple Disk Image (.dmg):
    ```bash
    cd desktop && npm run dist:mac
    ```
  - Outputs to `dist-electron/Voxel Bedwars-1.0.0.dmg`.

- **Linux (.AppImage / .deb)**:
  - Generates universal Linux AppImage and Debian package:
    ```bash
    cd desktop && npm run dist:linux
    ```
  - Outputs to `dist-electron/Voxel Bedwars-1.0.0.AppImage` and `dist-electron/voxel-bedwars_1.0.0_amd64.deb`.

---

## Security Best Practices
- Node integration is disabled in all renderer frames.
- Context isolation guarantees that web JavaScript cannot access privileged Node.js APIs directly.
- All inter-process communication is routed via strictly validated IPC channels in `preload.cjs`.
