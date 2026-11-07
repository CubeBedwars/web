/**
 * src/net/WebSocketAdapter.js
 * Dedicated WebSocket client adapter for Voxel Bedwars.
 * 
 * Supports:
 * - Ephemeral connection timeout detection (for seamless dual-layer fallback to WebRTC)
 * - Automatic resolution across Browser (native WebSocket) and Node.js (headless test runner)
 * - Room creation (ROOM_CREATE), joining (ROOM_JOIN), leaving (ROOM_LEAVE)
 * - Low-latency state packet transmission (BLOCK_PLACE, BLOCK_BREAK, BED_DESTROY, etc.)
 */

export class WebSocketAdapter {
  /**
   * @param {string} [serverUrl] - Dedicated server WebSocket URL (e.g. ws://localhost:8080)
   */
  constructor(serverUrl = null) {
    this.serverUrl = serverUrl || this.getDefaultServerUrl();
    this.ws = null;
    this.isConnected = false;
    this.isConnecting = false;
    this.clientId = null;
    this.roomCode = null;
    this.isHost = false;

    this.packetHandlers = new Map(); // type -> Set<Function>
    this.connectionListeners = new Set();
    this.disconnectListeners = new Set();
    this.pendingQueue = [];
    this.WSClass = null;
  }

  /**
   * Resolves default WebSocket URL based on execution environment.
   */
  getDefaultServerUrl() {
    if (typeof window !== 'undefined' && window.location) {
      const isHttps = window.location.protocol === 'https:';
      const wsProto = isHttps ? 'wss:' : 'ws:';
      const host = window.location.hostname || 'localhost';
      // In dev or local mode, default to dedicated server port 8080
      const port = (window.location.port === '5173' || window.location.port === '3000') ? '8080' : (window.location.port || '8080');
      return `${wsProto}//${host}:${port}`;
    }
    return 'ws://localhost:8080';
  }

  /**
   * Resolves the WebSocket implementation (browser native or Node 'ws').
   */
  async getWebSocketClass() {
    if (this.WSClass) return this.WSClass;
    if (typeof WebSocket !== 'undefined') {
      this.WSClass = WebSocket;
      return this.WSClass;
    }
    if (typeof globalThis !== 'undefined' && globalThis.WebSocket) {
      this.WSClass = globalThis.WebSocket;
      return this.WSClass;
    }
    try {
      const wsModule = await import('ws');
      this.WSClass = wsModule.default || wsModule.WebSocket;
      return this.WSClass;
    } catch (e) {
      throw new Error(`WebSocket implementation not found in environment: ${e.message}`);
    }
  }

  /**
   * Connect to dedicated WebSocket server with a strict timeout.
   * @param {string} [customUrl]
   * @param {number} [timeoutMs=3500] - Defaults to 3500ms before triggering timeout for fallback
   * @returns {Promise<WebSocket>}
   */
  async connect(customUrl = null, timeoutMs = 3500) {
    if (customUrl) this.serverUrl = customUrl;
    if (this.isConnected && this.ws && this.ws.readyState === 1) {
      return this.ws;
    }

    const WS = await this.getWebSocketClass();
    this.isConnecting = true;

    return new Promise((resolve, reject) => {
      let timedOut = false;
      const timer = setTimeout(() => {
        timedOut = true;
        this.isConnecting = false;
        if (this.ws) {
          try { this.ws.close(); } catch (e) {}
        }
        reject(new Error(`WebSocket connection to ${this.serverUrl} timed out after ${timeoutMs}ms`));
      }, timeoutMs);

      try {
        const socket = new WS(this.serverUrl);
        this.ws = socket;

        socket.onopen = () => {
          if (timedOut) return;
          clearTimeout(timer);
          this.isConnected = true;
          this.isConnecting = false;

          // Flush queued packets
          while (this.pendingQueue.length > 0) {
            const raw = this.pendingQueue.shift();
            try { socket.send(raw); } catch (e) {}
          }

          this.connectionListeners.forEach((fn) => fn(this.serverUrl));
          resolve(socket);
        };

        socket.onmessage = (event) => {
          const rawData = typeof event.data === 'string' ? event.data : event.data?.toString?.();
          this.handleIncomingRaw(rawData);
        };

        socket.onerror = (err) => {
          if (timedOut) return;
          clearTimeout(timer);
          this.isConnected = false;
          this.isConnecting = false;
          reject(err instanceof Error ? err : new Error(`WebSocket error on ${this.serverUrl}`));
        };

        socket.onclose = () => {
          this.isConnected = false;
          this.isConnecting = false;
          this.disconnectListeners.forEach((fn) => fn());
        };
      } catch (err) {
        clearTimeout(timer);
        this.isConnecting = false;
        reject(err);
      }
    });
  }

  /**
   * Internal parser and router for incoming WebSocket data frames.
   */
  handleIncomingRaw(rawText) {
    if (!rawText) return;
    let packet;
    try {
      packet = JSON.parse(rawText);
    } catch (e) {
      console.warn('[WebSocketAdapter] Received non-JSON frame:', rawText);
      return;
    }

    if (!packet || !packet.type) return;

    // Track internal metadata
    if (packet.type === 'ROOM_CREATED' && packet.payload) {
      this.roomCode = packet.payload.roomCode;
      this.clientId = packet.payload.hostId;
      this.isHost = true;
    } else if (packet.type === 'ROOM_JOINED' && packet.payload) {
      this.roomCode = packet.payload.roomCode;
      this.clientId = packet.payload.clientId;
      this.isHost = false;
    }

    // Dispatch to registered type handlers
    const handlers = this.packetHandlers.get(packet.type);
    if (handlers) {
      handlers.forEach((fn) => fn(packet));
    }

    // Dispatch to wildcard handlers
    const wildcardHandlers = this.packetHandlers.get('*');
    if (wildcardHandlers) {
      wildcardHandlers.forEach((fn) => fn(packet));
    }
  }

  /**
   * Creates a new match room on the dedicated WebSocket server.
   * @param {Object} [options]
   * @param {string} [options.roomCode]
   * @param {string} [options.format='4v4']
   * @param {string} [options.map='speedway']
   * @param {string} [options.hostName='Host']
   * @returns {Promise<Object>}
   */
  async createRoom(options = {}) {
    await this.connect();
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.offPacket('ROOM_CREATED', onCreated);
        this.offPacket('ERROR', onError);
        reject(new Error('Room creation response timed out'));
      }, 5000);

      const onCreated = (packet) => {
        clearTimeout(timeout);
        this.offPacket('ROOM_CREATED', onCreated);
        this.offPacket('ERROR', onError);
        this.roomCode = packet.payload.roomCode;
        this.clientId = packet.payload.hostId;
        this.isHost = true;
        resolve(packet.payload);
      };

      const onError = (packet) => {
        clearTimeout(timeout);
        this.offPacket('ROOM_CREATED', onCreated);
        this.offPacket('ERROR', onError);
        reject(new Error(packet.payload?.message || 'Failed to create room'));
      };

      this.onPacket('ROOM_CREATED', onCreated);
      this.onPacket('ERROR', onError);

      this.sendRaw({
        type: 'ROOM_CREATE',
        payload: {
          roomCode: options.roomCode,
          format: options.format || '4v4',
          map: options.map || 'speedway',
          hostName: options.hostName || 'Host',
        },
      });
    });
  }

  /**
   * Joins an existing match room on the dedicated WebSocket server.
   * @param {string} roomCode
   * @param {Object} [options]
   * @param {string} [options.playerName='Player']
   * @returns {Promise<Object>}
   */
  async joinRoom(roomCode, options = {}) {
    await this.connect();
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.offPacket('ROOM_JOINED', onJoined);
        this.offPacket('ERROR', onError);
        reject(new Error(`Join room ${roomCode} response timed out`));
      }, 5000);

      const onJoined = (packet) => {
        clearTimeout(timeout);
        this.offPacket('ROOM_JOINED', onJoined);
        this.offPacket('ERROR', onError);
        this.roomCode = packet.payload.roomCode;
        this.clientId = packet.payload.clientId;
        this.isHost = false;
        resolve(packet.payload);
      };

      const onError = (packet) => {
        clearTimeout(timeout);
        this.offPacket('ROOM_JOINED', onJoined);
        this.offPacket('ERROR', onError);
        reject(new Error(packet.payload?.message || `Failed to join room ${roomCode}`));
      };

      this.onPacket('ROOM_JOINED', onJoined);
      this.onPacket('ERROR', onError);

      this.sendRaw({
        type: 'ROOM_JOIN',
        payload: {
          roomCode,
          playerName: options.playerName || 'Player',
        },
      });
    });
  }

  /**
   * Send an arbitrary packet to the server and room peers.
   * @param {string} type - Packet type (e.g. BLOCK_PLACE, PLAYER_TRANSFORM)
   * @param {Object} payload - Associated packet data
   * @returns {boolean}
   */
  sendPacket(type, payload = {}) {
    const packet = {
      type,
      sender: this.clientId || 'client',
      timestamp: Date.now(),
      payload,
    };
    return this.sendRaw(packet);
  }

  /**
   * Sends a pre-structured or raw packet object.
   */
  sendRaw(packet) {
    const raw = typeof packet === 'string' ? packet : JSON.stringify(packet);
    if (this.isConnected && this.ws && this.ws.readyState === 1) {
      try {
        this.ws.send(raw);
        return true;
      } catch (e) {
        console.warn('[WebSocketAdapter] Failed to send packet:', e);
        return false;
      }
    } else {
      this.pendingQueue.push(raw);
      return false;
    }
  }

  /**
   * Register a callback listener for a packet type.
   * @param {string} type - Packet type or '*'
   * @param {Function} handler
   */
  onPacket(type, handler) {
    if (!this.packetHandlers.has(type)) {
      this.packetHandlers.set(type, new Set());
    }
    this.packetHandlers.get(type).add(handler);
  }

  /**
   * Unregister a callback listener.
   * @param {string} type
   * @param {Function} handler
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
    this.isConnecting = false;
    if (this.ws) {
      try {
        this.ws.close();
      } catch (e) {}
      this.ws = null;
    }
    this.roomCode = null;
    this.clientId = null;
  }
}
