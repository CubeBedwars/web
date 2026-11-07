/**
 * server/index.js
 * Dedicated WebSocket Multiplayer Service & Uptime Monitoring for Voxel Bedwars
 * 
 * Exposes:
 *  - HTTP GET /ping: non-WebSocket healthcheck returning JSON uptime & room count for UptimeRobot (5-min interval)
 *  - WebSocket server: room creation/joins, state packet relay (BLOCK_PLACE, BLOCK_BREAK, BED_DESTROY, etc.),
 *    heartbeats, and automated room cleanup.
 */

import http from 'http';
import { WebSocketServer, WebSocket } from 'ws';

/**
 * Creates and starts the Voxel Bedwars dedicated server.
 * @param {Object} options
 * @param {number} [options.port=8080]
 * @param {string} [options.host='0.0.0.0']
 * @returns {Promise<{ server: http.Server, wss: WebSocketServer, rooms: Map, port: number, close: Function }>}
 */
export function startServer(options = {}) {
  const port = options.port !== undefined ? options.port : (parseInt(process.env.PORT, 10) || 8080);
  const host = options.host || '0.0.0.0';

  const rooms = new Map();

  // Create HTTP Server for UptimeRobot & Health Checks
  const server = http.createServer((req, res) => {
    // CORS headers for cross-origin healthchecks and API queries
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    if (req.method === 'OPTIONS') {
      res.writeHead(204);
      res.end();
      return;
    }

    const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
    const pathname = url.pathname.replace(/\/+$/, '') || '/';

    // GET /ping (and /ping/) — UptimeRobot 5-minute keepalive endpoint
    if (pathname === '/ping') {
      const pingPayload = {
        status: 'ok',
        uptime: process.uptime(),
        timestamp: Date.now(),
        rooms: rooms.size,
      };
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(pingPayload));
      return;
    }

    // Root status endpoint
    if (pathname === '/' || pathname === '/health') {
      const healthPayload = {
        name: 'voxel-bedwars-server',
        status: 'online',
        uptime: process.uptime(),
        timestamp: Date.now(),
        rooms: rooms.size,
        activeClients: Array.from(rooms.values()).reduce((acc, r) => acc + r.clients.size, 0),
      };
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(healthPayload));
      return;
    }

    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Not Found' }));
  });

  // Attach WebSocket Server
  const wss = new WebSocketServer({ server });

  // Generate unique client and room IDs
  let clientSequence = 0;
  function generateClientId() {
    clientSequence++;
    return `c_${Date.now()}_${clientSequence}_${Math.random().toString(36).substring(2, 6)}`;
  }

  function generateRoomCode() {
    let code;
    do {
      code = 'BW-' + Math.floor(1000 + Math.random() * 9000);
    } while (rooms.has(code));
    return code;
  }

  // Helper to broadcast to a room
  function broadcastToRoom(room, packet, excludeWs = null) {
    const raw = typeof packet === 'string' ? packet : JSON.stringify(packet);
    for (const client of room.clients.values()) {
      if (client.ws !== excludeWs && client.ws.readyState === WebSocket.OPEN) {
        client.ws.send(raw);
      }
    }
  }

  // Clean up client on disconnect
  function removeClientFromRoom(ws) {
    if (!ws.roomCode) return;
    const room = rooms.get(ws.roomCode);
    if (!room) return;

    room.clients.delete(ws.id);

    // Notify peers that client left
    broadcastToRoom(room, {
      type: 'PEER_LEFT',
      sender: 'server',
      timestamp: Date.now(),
      payload: { clientId: ws.id },
    });

    if (room.clients.size === 0) {
      rooms.delete(room.code);
    } else if (room.hostId === ws.id) {
      // Elect next peer as host
      const [nextHostId] = room.clients.keys();
      room.hostId = nextHostId;
      broadcastToRoom(room, {
        type: 'HOST_MIGRATED',
        sender: 'server',
        timestamp: Date.now(),
        payload: { newHostId: nextHostId },
      });
    }

    ws.roomCode = null;
  }

  wss.on('connection', (ws) => {
    ws.id = generateClientId();
    ws.isAlive = true;
    ws.roomCode = null;

    ws.on('pong', () => {
      ws.isAlive = true;
    });

    ws.on('message', (messageData) => {
      let packet;
      try {
        packet = JSON.parse(messageData.toString());
      } catch (e) {
        ws.send(JSON.stringify({
          type: 'ERROR',
          payload: { message: 'Invalid JSON packet', error: e.message },
        }));
        return;
      }

      if (!packet || typeof packet !== 'object') return;

      const type = packet.type;
      const payload = packet.payload || {};

      switch (type) {
        // Room Creation
        case 'ROOM_CREATE': {
          if (ws.roomCode) removeClientFromRoom(ws);

          const roomCode = (payload.roomCode && String(payload.roomCode).trim()) || generateRoomCode();
          const format = payload.format || '4v4';
          const map = payload.map || 'speedway';

          const room = {
            code: roomCode,
            hostId: ws.id,
            format,
            map,
            clients: new Map(),
            worldBlocks: new Map(),
            createdAt: Date.now(),
          };

          room.clients.set(ws.id, {
            ws,
            id: ws.id,
            playerName: payload.hostName || 'Host',
            joinedAt: Date.now(),
          });

          rooms.set(roomCode, room);
          ws.roomCode = roomCode;

          ws.send(JSON.stringify({
            type: 'ROOM_CREATED',
            sender: 'server',
            timestamp: Date.now(),
            payload: {
              roomCode,
              hostId: ws.id,
              format,
              map,
            },
          }));
          break;
        }

        // Room Joining
        case 'ROOM_JOIN': {
          if (ws.roomCode) removeClientFromRoom(ws);

          const roomCode = payload.roomCode ? String(payload.roomCode).trim() : null;
          if (!roomCode || !rooms.has(roomCode)) {
            ws.send(JSON.stringify({
              type: 'ERROR',
              sender: 'server',
              timestamp: Date.now(),
              payload: {
                code: 'ROOM_NOT_FOUND',
                message: `Room ${roomCode || 'unknown'} not found or expired.`,
              },
            }));
            return;
          }

          const room = rooms.get(roomCode);
          const playerName = payload.playerName || 'Player';

          room.clients.set(ws.id, {
            ws,
            id: ws.id,
            playerName,
            joinedAt: Date.now(),
          });
          ws.roomCode = roomCode;

          // Acknowledge join to new client with current world snapshot
          ws.send(JSON.stringify({
            type: 'ROOM_JOINED',
            sender: 'server',
            timestamp: Date.now(),
            payload: {
              roomCode: room.code,
              clientId: ws.id,
              hostId: room.hostId,
              clients: Array.from(room.clients.keys()),
              snapshot: {
                format: room.format,
                map: room.map,
                placedBlocks: Array.from(room.worldBlocks.values()),
              },
            },
          }));

          // Notify existing peers
          broadcastToRoom(room, {
            type: 'PEER_JOINED',
            sender: 'server',
            timestamp: Date.now(),
            payload: {
              clientId: ws.id,
              playerName,
            },
          }, ws);
          break;
        }

        // Room Listing
        case 'ROOM_LIST': {
          const list = Array.from(rooms.values()).map((r) => ({
            code: r.code,
            clientCount: r.clients.size,
            format: r.format,
            map: r.map,
            createdAt: r.createdAt,
          }));
          ws.send(JSON.stringify({
            type: 'ROOM_LIST',
            sender: 'server',
            timestamp: Date.now(),
            payload: { rooms: list },
          }));
          break;
        }

        // Room Leave
        case 'ROOM_LEAVE': {
          removeClientFromRoom(ws);
          ws.send(JSON.stringify({
            type: 'ROOM_LEFT',
            sender: 'server',
            timestamp: Date.now(),
            payload: { success: true },
          }));
          break;
        }

        // Packet Relay: BLOCK_PLACE
        case 'BLOCK_PLACE': {
          if (!ws.roomCode || !rooms.has(ws.roomCode)) return;
          const room = rooms.get(ws.roomCode);

          if (payload.x !== undefined && payload.y !== undefined && payload.z !== undefined) {
            const key = `${payload.x},${payload.y},${payload.z}`;
            room.worldBlocks.set(key, {
              x: payload.x,
              y: payload.y,
              z: payload.z,
              blockType: payload.blockType,
            });
          }

          broadcastToRoom(room, {
            type: 'BLOCK_PLACE',
            sender: ws.id,
            timestamp: packet.timestamp || Date.now(),
            payload,
          }, ws);
          break;
        }

        // Packet Relay: BLOCK_BREAK
        case 'BLOCK_BREAK': {
          if (!ws.roomCode || !rooms.has(ws.roomCode)) return;
          const room = rooms.get(ws.roomCode);

          if (payload.x !== undefined && payload.y !== undefined && payload.z !== undefined) {
            const key = `${payload.x},${payload.y},${payload.z}`;
            room.worldBlocks.delete(key);
          }

          broadcastToRoom(room, {
            type: 'BLOCK_BREAK',
            sender: ws.id,
            timestamp: packet.timestamp || Date.now(),
            payload,
          }, ws);
          break;
        }

        // Packet Relay: BED_DESTROY
        case 'BED_DESTROY': {
          if (!ws.roomCode || !rooms.has(ws.roomCode)) return;
          const room = rooms.get(ws.roomCode);
          broadcastToRoom(room, {
            type: 'BED_DESTROY',
            sender: ws.id,
            timestamp: packet.timestamp || Date.now(),
            payload,
          }, ws);
          break;
        }

        // Packet Relay: PLAYER_TRANSFORM
        case 'PLAYER_TRANSFORM': {
          if (!ws.roomCode || !rooms.has(ws.roomCode)) return;
          const room = rooms.get(ws.roomCode);
          broadcastToRoom(room, {
            type: 'PLAYER_TRANSFORM',
            sender: ws.id,
            timestamp: packet.timestamp || Date.now(),
            payload,
          }, ws);
          break;
        }

        // Packet Relay: PLAYER_DAMAGE
        case 'PLAYER_DAMAGE': {
          if (!ws.roomCode || !rooms.has(ws.roomCode)) return;
          const room = rooms.get(ws.roomCode);
          broadcastToRoom(room, {
            type: 'PLAYER_DAMAGE',
            sender: ws.id,
            timestamp: packet.timestamp || Date.now(),
            payload,
          }, ws);
          break;
        }

        // Packet Relay: CHAT_MESSAGE
        case 'CHAT_MESSAGE': {
          if (!ws.roomCode || !rooms.has(ws.roomCode)) return;
          const room = rooms.get(ws.roomCode);
          broadcastToRoom(room, {
            type: 'CHAT_MESSAGE',
            sender: ws.id,
            timestamp: packet.timestamp || Date.now(),
            payload,
          }); // Broadcast to everyone including sender for confirmation
          break;
        }

        // Packet Relay: MUTATION_SYNC
        case 'MUTATION_SYNC': {
          if (!ws.roomCode || !rooms.has(ws.roomCode)) return;
          const room = rooms.get(ws.roomCode);
          broadcastToRoom(room, {
            type: 'MUTATION_SYNC',
            sender: ws.id,
            timestamp: packet.timestamp || Date.now(),
            payload,
          }, ws);
          break;
        }

        // Application-level Heartbeat / Ping
        case 'PING': {
          ws.send(JSON.stringify({
            type: 'PONG',
            sender: 'server',
            timestamp: Date.now(),
          }));
          break;
        }

        // Default: relay generic valid packet to room
        default: {
          if (ws.roomCode && rooms.has(ws.roomCode)) {
            const room = rooms.get(ws.roomCode);
            broadcastToRoom(room, {
              type,
              sender: ws.id,
              timestamp: packet.timestamp || Date.now(),
              payload,
            }, ws);
          }
          break;
        }
      }
    });

    ws.on('close', () => {
      removeClientFromRoom(ws);
    });

    ws.on('error', () => {
      removeClientFromRoom(ws);
    });
  });

  // 30-second Ping / Pong heartbeat monitor to clean stale connections
  const heartbeatInterval = setInterval(() => {
    wss.clients.forEach((ws) => {
      if (ws.isAlive === false) {
        removeClientFromRoom(ws);
        return ws.terminate();
      }
      ws.isAlive = false;
      ws.ping();
    });
  }, 30000);

  return new Promise((resolve, reject) => {
    server.listen(port, host, () => {
      const address = server.address();
      const actualPort = typeof address === 'object' && address ? address.port : port;

      const close = () => new Promise((done) => {
        clearInterval(heartbeatInterval);
        for (const ws of wss.clients) {
          try { ws.terminate(); } catch (e) {}
        }
        wss.close(() => {
          server.close(() => done());
        });
      });

      resolve({
        server,
        wss,
        rooms,
        port: actualPort,
        close,
      });
    });

    server.on('error', (err) => {
      reject(err);
    });
  });
}

// Auto-start server if executed directly from CLI: `node server/index.js`
const isMain = process.argv[1] && (
  process.argv[1].endsWith('server/index.js') ||
  process.argv[1].endsWith('server\\index.js') ||
  process.argv[1].endsWith('index.js')
);

if (isMain) {
  const port = parseInt(process.env.PORT, 10) || 8080;
  startServer({ port }).then(({ port }) => {
    console.log(`[Voxel Bedwars Server] Online on port ${port}`);
    console.log(`[Healthcheck] GET http://localhost:${port}/ping`);
    console.log(`[WebSocket] ws://localhost:${port}`);
  }).catch((err) => {
    console.error('[Voxel Bedwars Server] Failed to start:', err);
    process.exit(1);
  });
}
