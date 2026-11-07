/**
 * src/net/WebRTCAdapter.js
 * Serverless WebRTC PeerJS adapter for Voxel Bedwars.
 * 
 * Functions as the zero-server peer-to-peer fallback transport whenever
 * the dedicated WebSocket server is unreachable or offline.
 */

import Peer from 'peerjs';

export class WebRTCAdapter {
  constructor() {
    this.peer = null;
    this.connections = [];
    this.isHost = false;
    this.roomCode = null;
    this.isConnected = false;
    this.clientId = null;
    this.packetHandlers = new Map(); // type -> Set<Function>
    this.connectionListeners = new Set();
    this.disconnectListeners = new Set();
  }

  /**
   * Generates a standard Bedwars room code.
   */
  generateRoomCode() {
    return 'BW-' + Math.floor(1000 + Math.random() * 9000);
  }

  /**
   * Hosts a serverless P2P room with an explicit or generated room code.
   * @param {Object} [options]
   * @param {string} [options.roomCode]
   * @param {Function} [onSuccess]
   * @param {Function} [onError]
   * @returns {Promise<string>}
   */
  createRoom(options = {}, onSuccess = null, onError = null) {
    const code = (options.roomCode && String(options.roomCode).trim()) || this.generateRoomCode();
    this.isHost = true;
    this.roomCode = code;

    return new Promise((resolve, reject) => {
      try {
        this.peer = new Peer(code);

        this.peer.on('open', (id) => {
          this.isConnected = true;
          this.clientId = id;
          this.connectionListeners.forEach((fn) => fn(id));
          if (onSuccess) onSuccess(id);
          resolve(id);
        });

        this.peer.on('connection', (conn) => {
          this.setupConnection(conn);
        });

        this.peer.on('error', (err) => {
          this.isConnected = false;
          if (onError) onError(err);
          reject(err);
        });

        this.peer.on('close', () => {
          this.isConnected = false;
          this.disconnectListeners.forEach((fn) => fn());
        });
      } catch (e) {
        this.isConnected = false;
        if (onError) onError(e);
        reject(e);
      }
    });
  }

  /**
   * Joins an existing serverless P2P match room via host room code.
   * @param {string} roomCode
   * @param {Object} [options]
   * @param {Function} [onSuccess]
   * @param {Function} [onError]
   * @returns {Promise<void>}
   */
  joinRoom(roomCode, options = {}, onSuccess = null, onError = null) {
    this.isHost = false;
    this.roomCode = roomCode;

    return new Promise((resolve, reject) => {
      try {
        this.peer = new Peer();

        this.peer.on('open', (id) => {
          this.clientId = id;
          const conn = this.peer.connect(roomCode, {
            reliable: true,
          });

          this.setupConnection(conn);

          conn.on('open', () => {
            this.isConnected = true;
            this.connectionListeners.forEach((fn) => fn(id));
            if (onSuccess) onSuccess();
            resolve();
          });

          conn.on('error', (err) => {
            if (onError) onError(err);
            reject(err);
          });
        });

        this.peer.on('error', (err) => {
          this.isConnected = false;
          if (onError) onError(err);
          reject(err);
        });

        this.peer.on('close', () => {
          this.isConnected = false;
          this.disconnectListeners.forEach((fn) => fn());
        });
      } catch (e) {
        this.isConnected = false;
        if (onError) onError(e);
        reject(e);
      }
    });
  }

  /**
   * Wire data channel listeners for a new peer connection.
   */
  setupConnection(conn) {
    this.connections.push(conn);

    conn.on('data', (data) => {
      this.handleIncomingData(data, conn);
    });

    conn.on('close', () => {
      this.connections = this.connections.filter((c) => c !== conn);
      if (this.connections.length === 0 && !this.isHost) {
        this.isConnected = false;
      }
    });

    conn.on('error', (err) => {
      console.warn('[WebRTCAdapter] Peer connection error:', err);
      this.connections = this.connections.filter((c) => c !== conn);
    });
  }

  /**
   * Dispatches and routes incoming data packets from peers.
   */
  handleIncomingData(data, senderConn) {
    let packet = data;
    if (typeof data === 'string') {
      try {
        packet = JSON.parse(data);
      } catch (e) {
        return;
      }
    }

    if (!packet || !packet.type) return;

    // If we are host, relay packet to other peers
    if (this.isHost && this.connections.length > 1) {
      for (const peerConn of this.connections) {
        if (peerConn !== senderConn && peerConn.open) {
          try {
            peerConn.send(packet);
          } catch (e) {}
        }
      }
    }

    // Trigger registered handlers for this packet type
    const handlers = this.packetHandlers.get(packet.type);
    if (handlers) {
      handlers.forEach((fn) => fn(packet));
    }

    // Wildcard handlers
    const wildcardHandlers = this.packetHandlers.get('*');
    if (wildcardHandlers) {
      wildcardHandlers.forEach((fn) => fn(packet));
    }
  }

  /**
   * Transmits a packet across connected peers.
   * @param {string} type
   * @param {Object} payload
   * @returns {boolean}
   */
  sendPacket(type, payload = {}) {
    const packet = {
      type,
      sender: this.clientId || 'webrtc_client',
      timestamp: Date.now(),
      payload,
    };

    let delivered = false;
    for (const conn of this.connections) {
      if (conn.open) {
        try {
          conn.send(packet);
          delivered = true;
        } catch (e) {
          console.warn('[WebRTCAdapter] Error sending to peer:', e);
        }
      }
    }
    return delivered;
  }

  /**
   * Registers a packet listener.
   */
  onPacket(type, handler) {
    if (!this.packetHandlers.has(type)) {
      this.packetHandlers.set(type, new Set());
    }
    this.packetHandlers.get(type).add(handler);
  }

  /**
   * Unregisters a packet listener.
   */
  offPacket(type, handler) {
    const set = this.packetHandlers.get(type);
    if (set) set.delete(handler);
  }

  onConnect(fn) {
    this.connectionListeners.add(fn);
  }

  onDisconnect(fn) {
    this.disconnectListeners.add(fn);
  }

  disconnect() {
    this.isConnected = false;
    for (const conn of this.connections) {
      try { conn.close(); } catch (e) {}
    }
    this.connections = [];

    if (this.peer) {
      try { this.peer.destroy(); } catch (e) {}
      this.peer = null;
    }
    this.roomCode = null;
    this.clientId = null;
  }
}
