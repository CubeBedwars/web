/**
 * src/net/LanDiscovery.js
 * Local Area Network (LAN) Multiplayer & Direct IP:Port Join System for Voxel Bedwars.
 * 
 * Features:
 * - Direct IP:Port Address Validation & URL resolution
 * - Desktop UDP Discovery beacon on port 8766 (with Electron API bridge)
 * - Cross-tab / Local subnet fallback beacon via BroadcastChannel
 * - Discovered room registry with TTL expiry
 */

/**
 * Validates an IPv4 address and port number.
 * @param {string} ip
 * @param {number} port
 * @returns {boolean}
 */
export function validateLanAddress(ip, port) {
  if (typeof ip !== 'string') return false;
  const ipv4Pattern = /^(25[0-5]|2[0-4]\d|[01]?\d\d?)\.(25[0-5]|2[0-4]\d|[01]?\d\d?)\.(25[0-5]|2[0-4]\d|[01]?\d\d?)\.(25[0-5]|2[0-4]\d|[01]?\d\d?)$/;
  if (!ipv4Pattern.test(ip.trim())) return false;

  const numPort = Number(port);
  if (!Number.isInteger(numPort) || numPort < 1 || numPort > 65535) {
    return false;
  }
  return true;
}

/**
 * Resolves a valid IP and Port into a WebSocket URL.
 * @param {string} ip
 * @param {number} port
 * @returns {string}
 */
export function formatDirectUrl(ip, port) {
  if (!validateLanAddress(ip, port)) {
    throw new Error(`Invalid LAN IP:Port address: ${ip}:${port}`);
  }
  return `ws://${ip.trim()}:${port}`;
}

export class LanDiscovery {
  constructor(options = {}) {
    this.port = options.port || 8766;
    this.discoveredRooms = new Map(); // key -> roomData
    this.listeners = new Set();
    this.broadcastTimer = null;
    this.expiryTimer = null;
    this.broadcastChannel = null;

    if (typeof BroadcastChannel !== 'undefined') {
      try {
        this.broadcastChannel = new BroadcastChannel('voxel-bedwars-lan');
        this.broadcastChannel.onmessage = (event) => {
          this.handleBeacon(event.data);
        };
      } catch (e) {
        // BroadcastChannel unavailable in this environment
      }
    }
  }

  /**
   * Starts broadcasting local room beacon on the local network.
   * @param {Object} roomData
   * @param {string} roomData.roomCode
   * @param {string} [roomData.hostName='LAN Host']
   * @param {string} [roomData.map='speedway']
   * @param {number} [roomData.port=8766]
   */
  startBroadcast(roomData) {
    this.stopBroadcast();

    const beacon = {
      app: 'voxel-bedwars-lan',
      roomCode: roomData.roomCode || 'LAN-1000',
      hostName: roomData.hostName || "Host's Arena",
      map: roomData.map || 'speedway',
      port: roomData.port || this.port,
      timestamp: Date.now(),
    };

    // Broadcast immediately
    this.sendBeacon(beacon);

    // Periodically broadcast every 2.5 seconds
    this.broadcastTimer = setInterval(() => {
      beacon.timestamp = Date.now();
      this.sendBeacon(beacon);
    }, 2500);
  }

  /**
   * Sends the beacon across native Electron UDP bridge and BroadcastChannel.
   */
  sendBeacon(beacon) {
    // 1. Desktop Electron Native Bridge (if present)
    if (typeof window !== 'undefined' && window.electronAPI?.broadcastLanBeacon) {
      try {
        window.electronAPI.broadcastLanBeacon(beacon);
      } catch (e) {}
    }

    // 2. Local BroadcastChannel
    if (this.broadcastChannel) {
      try {
        this.broadcastChannel.postMessage(beacon);
      } catch (e) {}
    }
  }

  /**
   * Stops active broadcasting.
   */
  stopBroadcast() {
    if (this.broadcastTimer) {
      clearInterval(this.broadcastTimer);
      this.broadcastTimer = null;
    }
  }

  /**
   * Starts listening for discovered LAN games.
   * @param {Function} onUpdate
   */
  startDiscovery(onUpdate = null) {
    if (onUpdate) this.listeners.add(onUpdate);

    // Desktop Electron Native Bridge listener
    if (typeof window !== 'undefined' && window.electronAPI?.onLanBeaconReceived) {
      window.electronAPI.onLanBeaconReceived((beacon) => {
        this.handleBeacon(beacon);
      });
    }

    // Periodic room pruning for rooms not seen in 8 seconds
    if (!this.expiryTimer) {
      this.expiryTimer = setInterval(() => {
        const now = Date.now();
        let changed = false;
        for (const [key, room] of this.discoveredRooms.entries()) {
          if (now - room.lastSeen > 8000) {
            this.discoveredRooms.delete(key);
            changed = true;
          }
        }
        if (changed) this.notifyListeners();
      }, 3000);
    }
  }

  /**
   * Ingests and registers an incoming beacon frame.
   */
  handleBeacon(beacon) {
    if (!beacon || beacon.app !== 'voxel-bedwars-lan') return;
    if (!beacon.roomCode) return;

    const key = beacon.roomCode;
    const isNew = !this.discoveredRooms.has(key);

    this.discoveredRooms.set(key, {
      roomCode: beacon.roomCode,
      hostName: beacon.hostName || 'LAN Host',
      map: beacon.map || 'speedway',
      port: beacon.port || this.port,
      ip: beacon.ip || '127.0.0.1',
      lastSeen: Date.now(),
    });

    this.notifyListeners();
  }

  notifyListeners() {
    const list = Array.from(this.discoveredRooms.values());
    this.listeners.forEach((fn) => fn(list));
  }

  /**
   * Stops discovery and clears memory.
   */
  stopDiscovery() {
    if (this.expiryTimer) {
      clearInterval(this.expiryTimer);
      this.expiryTimer = null;
    }
    this.discoveredRooms.clear();
    this.listeners.clear();
  }
}
