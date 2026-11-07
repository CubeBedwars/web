/**
 * tests/stress_m4_networking.js
 * Comprehensive Milestone 4 Network & Dedicated Server Test Suite.
 * 
 * Verifies 70+ rigorous network, packet, uptime monitoring, and dual-layer invariants:
 * 1. Dedicated server startup on ephemeral port
 * 2. HTTP GET /ping endpoint (UptimeRobot 5-min healthcheck specifications)
 * 3. Dedicated WebSocket room creation, joining, and listing
 * 4. Real-time state packet relay (BLOCK_PLACE, BLOCK_BREAK, BED_DESTROY, PLAYER_TRANSFORM, PLAYER_DAMAGE, CHAT_MESSAGE, MUTATION_SYNC)
 * 5. Automatic WebRTC failover upon simulated WebSocket connection timeout
 * 6. Local Area Network (LAN) Direct IP:Port validation, URL formatting & beacon discovery
 * 7. Disconnection, host migration, and room cleanup lifecycle
 */

import http from 'http';
import { WebSocket } from 'ws';
import { startServer } from '../server/index.js';
import { NetworkManager } from '../src/net/NetworkManager.js';
import { WebSocketAdapter } from '../src/net/WebSocketAdapter.js';
import { LanDiscovery, validateLanAddress, formatDirectUrl } from '../src/net/LanDiscovery.js';
import { BLOCK_TYPES } from '../src/engine/VoxelWorld.js';
import { validatePacket, PACKET_TYPES } from './helpers/game-sim.js';

// Headless test harness
let passedCount = 0;
let failedCount = 0;
const failures = [];

function assert(condition, message) {
  if (!condition) {
    throw new Error(`Assertion failed: ${message}`);
  }
}

function assertEqual(actual, expected, message = '') {
  if (actual !== expected) {
    throw new Error(`Expected ${JSON.stringify(expected)} but got ${JSON.stringify(actual)}. ${message}`);
  }
}

function assertTrue(val, message = '') {
  if (val !== true) {
    throw new Error(`Expected true but got ${val}. ${message}`);
  }
}

function assertFalse(val, message = '') {
  if (val !== false) {
    throw new Error(`Expected false but got ${val}. ${message}`);
  }
}

async function test(name, fn) {
  try {
    await fn();
    passedCount++;
    console.log(`  ✔ Invariant ${passedCount}: ${name}`);
  } catch (err) {
    failedCount++;
    failures.push({ name, error: err });
    console.error(`  ✖ Invariant FAILED: ${name}`);
    console.error(`    -> ${err.message}`);
  }
}

// HTTP request helper for testing /ping
function httpGet(url) {
  return new Promise((resolve, reject) => {
    http.get(url, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        let json = null;
        try { json = JSON.parse(data); } catch (e) {}
        resolve({
          statusCode: res.statusCode,
          headers: res.headers,
          data,
          json,
        });
      });
    }).on('error', reject);
  });
}

// WebSocket client helper
function createClient(port) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(`ws://localhost:${port}`);
    ws.on('open', () => resolve(ws));
    ws.on('error', reject);
  });
}

function sendAndAwaitPacket(ws, sendPacket, expectedType, timeoutMs = 3000) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      ws.off('message', handler);
      reject(new Error(`Timed out waiting for packet type ${expectedType}`));
    }, timeoutMs);

    function handler(data) {
      try {
        const parsed = JSON.parse(data.toString());
        if (parsed.type === expectedType) {
          clearTimeout(timer);
          ws.off('message', handler);
          resolve(parsed);
        }
      } catch (e) {}
    }

    ws.on('message', handler);
    ws.send(JSON.stringify(sendPacket));
  });
}

function awaitPacket(ws, expectedType, timeoutMs = 3000) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      ws.off('message', handler);
      reject(new Error(`Timed out waiting for packet type ${expectedType}`));
    }, timeoutMs);

    function handler(data) {
      try {
        const parsed = JSON.parse(data.toString());
        if (parsed.type === expectedType) {
          clearTimeout(timer);
          ws.off('message', handler);
          resolve(parsed);
        }
      } catch (e) {}
    }

    ws.on('message', handler);
  });
}

async function runSuite() {
  console.log('╔══════════════════════════════════════════════════════════════════════╗');
  console.log('║       MILESTONE 4: DUAL-LAYER NETWORKING & DEDICATED SERVER          ║');
  console.log('║          Comprehensive Automated Test Suite (70+ Invariants)         ║');
  console.log('╚══════════════════════════════════════════════════════════════════════╝\n');

  let serverInstance = null;
  let serverPort = 0;
  let client1 = null;
  let client2 = null;
  let client3 = null;
  let createdRoomCode = null;
  let hostId = null;
  let guestId = null;

  try {
    // ========================================================================
    // Group 1: Dedicated Server Startup & HTTP Monitoring (UptimeRobot /ping)
    // ========================================================================
    console.log('► Group 1: Dedicated Server & UptimeRobot HTTP /ping Endpoint');

    await test('Server boots on ephemeral port > 0', async () => {
      serverInstance = await startServer({ port: 0 });
      serverPort = serverInstance.port;
      assertTrue(serverPort > 0, `Expected positive port, got ${serverPort}`);
    });

    let pingRes = null;
    await test('HTTP GET /ping returns 200 OK', async () => {
      pingRes = await httpGet(`http://localhost:${serverPort}/ping`);
      assertEqual(pingRes.statusCode, 200);
    });

    await test('HTTP GET /ping sets Content-Type: application/json', async () => {
      assertTrue(pingRes.headers['content-type'].includes('application/json'));
    });

    await test('HTTP GET /ping sets Access-Control-Allow-Origin: * for cross-origin monitoring', async () => {
      assertEqual(pingRes.headers['access-control-allow-origin'], '*');
    });

    await test('HTTP OPTIONS /ping preflight returns 204 No Content with CORS', async () => {
      const optionsRes = await new Promise((resolve, reject) => {
        const req = http.request(`http://localhost:${serverPort}/ping`, { method: 'OPTIONS' }, (res) => {
          resolve({ statusCode: res.statusCode, headers: res.headers });
        });
        req.on('error', reject);
        req.end();
      });
      assertEqual(optionsRes.statusCode, 204);
      assertEqual(optionsRes.headers['access-control-allow-origin'], '*');
    });

    await test('HTTP GET /ping payload contains status: "ok"', async () => {
      assertEqual(pingRes.json?.status, 'ok');
    });

    await test('HTTP GET /ping payload returns positive process uptime', async () => {
      assertTrue(typeof pingRes.json?.uptime === 'number' && pingRes.json.uptime > 0);
    });

    await test('HTTP GET /ping payload returns valid millisecond timestamp', async () => {
      assertTrue(typeof pingRes.json?.timestamp === 'number');
      assertTrue(Date.now() - pingRes.json.timestamp < 5000);
    });

    await test('HTTP GET /ping payload returns active rooms count === 0 on fresh startup', async () => {
      assertEqual(pingRes.json?.rooms, 0);
    });

    await test('HTTP GET / root endpoint returns online service metadata', async () => {
      const rootRes = await httpGet(`http://localhost:${serverPort}/`);
      assertEqual(rootRes.statusCode, 200);
      assertEqual(rootRes.json?.name, 'voxel-bedwars-server');
      assertEqual(rootRes.json?.status, 'online');
    });

    await test('HTTP GET /unknown route returns 404 Not Found', async () => {
      const notFoundRes = await httpGet(`http://localhost:${serverPort}/unknown-route`);
      assertEqual(notFoundRes.statusCode, 404);
    });

    // ========================================================================
    // Group 2: Room Creation, Listing & Joining Protocol
    // ========================================================================
    console.log('\n► Group 2: WebSocket Room Creation, Listing & Joining Protocol');

    await test('Host client connects to dedicated WebSocket server', async () => {
      client1 = await createClient(serverPort);
      assertTrue(client1.readyState === WebSocket.OPEN);
    });

    let roomCreatedPacket = null;
    await test('Host sends ROOM_CREATE and receives ROOM_CREATED confirmation', async () => {
      roomCreatedPacket = await sendAndAwaitPacket(client1, {
        type: 'ROOM_CREATE',
        payload: { format: '4v4', map: 'speedway', hostName: 'Alpha_Host' },
      }, 'ROOM_CREATED');
      assertTrue(!!roomCreatedPacket);
    });

    await test('ROOM_CREATED payload generates 7-character alphanumeric room code starting with BW-', async () => {
      createdRoomCode = roomCreatedPacket.payload.roomCode;
      hostId = roomCreatedPacket.payload.hostId;
      assertTrue(createdRoomCode.startsWith('BW-'));
      assertEqual(createdRoomCode.length, 7);
      assertTrue(typeof hostId === 'string' && hostId.length > 0);
    });

    await test('Server internally registers room with 1 active host client', async () => {
      const room = serverInstance.rooms.get(createdRoomCode);
      assertTrue(!!room);
      assertEqual(room.clients.size, 1);
      assertEqual(room.hostId, hostId);
    });

    await test('HTTP GET /ping dynamically reflects rooms: 1 after room creation', async () => {
      const dynamicPing = await httpGet(`http://localhost:${serverPort}/ping`);
      assertEqual(dynamicPing.json?.rooms, 1);
    });

    await test('ROOM_CREATE with specified custom code and 1v1 map preserves parameters', async () => {
      const tempHost = await createClient(serverPort);
      const customPkt = await sendAndAwaitPacket(tempHost, {
        type: 'ROOM_CREATE',
        payload: { roomCode: 'BW-5555', format: '1v1', map: 'colosseum' },
      }, 'ROOM_CREATED');
      assertEqual(customPkt.payload.roomCode, 'BW-5555');
      assertEqual(customPkt.payload.format, '1v1');
      assertEqual(customPkt.payload.map, 'colosseum');
      tempHost.terminate();
      await new Promise((r) => setTimeout(r, 60));
    });

    await test('Client 2 connects to dedicated WebSocket server', async () => {
      client2 = await createClient(serverPort);
      assertTrue(client2.readyState === WebSocket.OPEN);
    });

    await test('Client 2 queries ROOM_LIST and receives active room in registry', async () => {
      const listPacket = await sendAndAwaitPacket(client2, { type: 'ROOM_LIST' }, 'ROOM_LIST');
      const rooms = listPacket.payload.rooms;
      assertTrue(Array.isArray(rooms));
      assertTrue(rooms.some((r) => r.code === createdRoomCode));
    });

    let peerJoinedPromise = null;
    let roomJoinedPacket = null;
    await test('Client 2 sends ROOM_JOIN and joins host room with snapshot', async () => {
      peerJoinedPromise = awaitPacket(client1, 'PEER_JOINED');
      roomJoinedPacket = await sendAndAwaitPacket(client2, {
        type: 'ROOM_JOIN',
        payload: { roomCode: createdRoomCode, playerName: 'Beta_Guest' },
      }, 'ROOM_JOINED');

      guestId = roomJoinedPacket.payload.clientId;
      assertEqual(roomJoinedPacket.payload.roomCode, createdRoomCode);
      assertEqual(roomJoinedPacket.payload.hostId, hostId);
      assertEqual(roomJoinedPacket.payload.snapshot.map, 'speedway');
    });

    await test('Host receives PEER_JOINED notification identifying Client 2', async () => {
      const peerJoined = await peerJoinedPromise;
      assertEqual(peerJoined.payload.clientId, guestId);
      assertEqual(peerJoined.payload.playerName, 'Beta_Guest');
    });

    await test('Server room reflects exactly 2 connected peers', async () => {
      const room = serverInstance.rooms.get(createdRoomCode);
      assertEqual(room.clients.size, 2);
    });

    await test('Attempting to join non-existent room returns ROOM_NOT_FOUND error', async () => {
      const rogueClient = await createClient(serverPort);
      const errPacket = await sendAndAwaitPacket(rogueClient, {
        type: 'ROOM_JOIN',
        payload: { roomCode: 'BW-9999' },
      }, 'ERROR');
      assertEqual(errPacket.payload.code, 'ROOM_NOT_FOUND');
      rogueClient.terminate();
    });

    // ========================================================================
    // Group 3: Real-Time State Packet Relay & World Synchronization
    // ========================================================================
    console.log('\n► Group 3: Real-Time State Packet Relay & World Synchronization');

    await test('Validates BLOCK_PLACE packet schema requirements', async () => {
      const valid = {
        type: PACKET_TYPES.BLOCK_PLACE,
        sender: hostId,
        timestamp: Date.now(),
        payload: { x: 10, y: 20, z: 5, blockType: BLOCK_TYPES.WOOL_RED },
      };
      assertTrue(validatePacket(valid));
    });

    await test('validatePacket accepts valid BLOCK_BREAK packet', async () => {
      assertTrue(validatePacket({
        type: PACKET_TYPES.BLOCK_BREAK,
        sender: 'p_1',
        timestamp: Date.now(),
        payload: { x: 10, y: 20, z: 5 },
      }));
    });

    await test('validatePacket accepts valid BED_DESTROY packet', async () => {
      assertTrue(validatePacket({
        type: PACKET_TYPES.BED_DESTROY,
        sender: 'p_1',
        timestamp: Date.now(),
        payload: { team: 'yellow' },
      }));
    });

    await test('validatePacket accepts valid PLAYER_TRANSFORM packet', async () => {
      assertTrue(validatePacket({
        type: PACKET_TYPES.PLAYER_TRANSFORM,
        sender: 'p_1',
        timestamp: Date.now(),
        payload: { x: 10, y: 20, z: 30 },
      }));
    });

    await test('validatePacket accepts valid PLAYER_DAMAGE packet', async () => {
      assertTrue(validatePacket({
        type: PACKET_TYPES.PLAYER_DAMAGE,
        sender: 'p_1',
        timestamp: Date.now(),
        payload: { targetId: 'p_2', amount: 5.0 },
      }));
    });

    await test('validatePacket accepts valid CHAT_MESSAGE packet', async () => {
      assertTrue(validatePacket({
        type: PACKET_TYPES.CHAT_MESSAGE,
        sender: 'p_1',
        timestamp: Date.now(),
        payload: { text: 'Hello Bedwars' },
      }));
    });

    await test('validatePacket rejects packet with missing timestamp', async () => {
      assertFalse(validatePacket({
        type: PACKET_TYPES.BLOCK_PLACE,
        sender: 'p_1',
        payload: { x: 1, y: 2, z: 3, blockType: 1 },
      }));
    });

    await test('validatePacket rejects packet with missing sender', async () => {
      assertFalse(validatePacket({
        type: PACKET_TYPES.BLOCK_PLACE,
        timestamp: Date.now(),
        payload: { x: 1, y: 2, z: 3, blockType: 1 },
      }));
    });

    await test('validatePacket rejects packet with unknown type', async () => {
      assertFalse(validatePacket({
        type: 'INVALID_UNKNOWN_PACKET',
        sender: 'p_1',
        timestamp: Date.now(),
        payload: {},
      }));
    });

    let guestBlockPromise = null;
    await test('Host places block and packet relays to Client 2', async () => {
      guestBlockPromise = awaitPacket(client2, 'BLOCK_PLACE');
      client1.send(JSON.stringify({
        type: 'BLOCK_PLACE',
        sender: hostId,
        timestamp: Date.now(),
        payload: { x: 10, y: 20, z: 5, blockType: BLOCK_TYPES.WOOL_RED },
      }));

      const received = await guestBlockPromise;
      assertEqual(received.payload.x, 10);
      assertEqual(received.payload.y, 20);
      assertEqual(received.payload.z, 5);
      assertEqual(received.payload.blockType, BLOCK_TYPES.WOOL_RED);
      assertEqual(received.sender, hostId);
    });

    await test('Server retains placed block in room worldBlocks map', async () => {
      const room = serverInstance.rooms.get(createdRoomCode);
      assertTrue(room.worldBlocks.has('10,20,5'));
      assertEqual(room.worldBlocks.get('10,20,5').blockType, BLOCK_TYPES.WOOL_RED);
    });

    await test('Late-joining Client 3 receives previously placed blocks in snapshot', async () => {
      client3 = await createClient(serverPort);
      const snapshotPacket = await sendAndAwaitPacket(client3, {
        type: 'ROOM_JOIN',
        payload: { roomCode: createdRoomCode, playerName: 'Gamma_Late' },
      }, 'ROOM_JOINED');

      const blocks = snapshotPacket.payload.snapshot.placedBlocks;
      assertTrue(blocks.some((b) => b.x === 10 && b.y === 20 && b.z === 5 && b.blockType === BLOCK_TYPES.WOOL_RED));
    });

    let hostBreakPromise = null;
    await test('Client 2 breaks block and packet relays to Host', async () => {
      hostBreakPromise = awaitPacket(client1, 'BLOCK_BREAK');
      client2.send(JSON.stringify({
        type: 'BLOCK_BREAK',
        sender: guestId,
        timestamp: Date.now(),
        payload: { x: 10, y: 20, z: 5 },
      }));

      const received = await hostBreakPromise;
      assertEqual(received.payload.x, 10);
      assertEqual(received.payload.y, 20);
      assertEqual(received.payload.z, 5);
      assertEqual(received.sender, guestId);
    });

    await test('Server deletes broken block from room snapshot map', async () => {
      const room = serverInstance.rooms.get(createdRoomCode);
      assertFalse(room.worldBlocks.has('10,20,5'));
    });

    let hostBedPromise = null;
    await test('Client 2 destroys Red bed and packet broadcasts to Host', async () => {
      hostBedPromise = awaitPacket(client1, 'BED_DESTROY');
      client2.send(JSON.stringify({
        type: 'BED_DESTROY',
        sender: guestId,
        timestamp: Date.now(),
        payload: { team: 'red' },
      }));

      const received = await hostBedPromise;
      assertEqual(received.payload.team, 'red');
      assertEqual(received.sender, guestId);
    });

    let guestTransformPromise = null;
    await test('Host moves and PLAYER_TRANSFORM packet relays to Client 2', async () => {
      guestTransformPromise = awaitPacket(client2, 'PLAYER_TRANSFORM');
      client1.send(JSON.stringify({
        type: 'PLAYER_TRANSFORM',
        sender: hostId,
        timestamp: Date.now(),
        payload: { x: 14.5, y: 22.0, z: -3.5, yaw: 1.57, pitch: -0.1 },
      }));

      const received = await guestTransformPromise;
      assertEqual(received.payload.x, 14.5);
      assertEqual(received.payload.y, 22.0);
      assertEqual(received.payload.yaw, 1.57);
    });

    let hostDamagePromise = null;
    await test('Client 2 attacks Host and PLAYER_DAMAGE packet relays to Host', async () => {
      hostDamagePromise = awaitPacket(client1, 'PLAYER_DAMAGE');
      client2.send(JSON.stringify({
        type: 'PLAYER_DAMAGE',
        sender: guestId,
        timestamp: Date.now(),
        payload: { targetId: hostId, amount: 7.5 },
      }));

      const received = await hostDamagePromise;
      assertEqual(received.payload.targetId, hostId);
      assertEqual(received.payload.amount, 7.5);
    });

    let guestChatPromise = null;
    await test('Chat message relays to all clients in room', async () => {
      guestChatPromise = awaitPacket(client2, 'CHAT_MESSAGE');
      client1.send(JSON.stringify({
        type: 'CHAT_MESSAGE',
        sender: hostId,
        timestamp: Date.now(),
        payload: { text: 'GG Bedwars!', senderName: 'Host' },
      }));

      const received = await guestChatPromise;
      assertEqual(received.payload.text, 'GG Bedwars!');
      assertEqual(received.payload.senderName, 'Host');
    });

    await test('Relays MUTATION_SYNC packet across room peers', async () => {
      const mutPromise = awaitPacket(client2, 'MUTATION_SYNC');
      client1.send(JSON.stringify({
        type: 'MUTATION_SYNC',
        sender: hostId,
        timestamp: Date.now(),
        payload: { activeMutations: ['Supercharged', 'Vampirism'] },
      }));
      const received = await mutPromise;
      assertEqual(received.payload.activeMutations.length, 2);
    });

    await test('Application-level PING returns PONG heartbeat', async () => {
      const pong = await sendAndAwaitPacket(client1, { type: 'PING' }, 'PONG');
      assertTrue(typeof pong.timestamp === 'number');
    });

    await test('Rejects malformed JSON without crashing server', async () => {
      const errPromise = awaitPacket(client1, 'ERROR');
      client1.send('THIS_IS_NOT_VALID_JSON{]');
      const err = await errPromise;
      assertEqual(err.payload.message, 'Invalid JSON packet');
    });

    // ========================================================================
    // Group 4: Dual-Layer Fallback & Transport Management
    // ========================================================================
    console.log('\n► Group 4: Dual-Layer Fallback & Transport Management');

    let netManager = null;
    await test('NetworkManager initializes in unassigned state', async () => {
      netManager = new NetworkManager(null, { wsUrl: `ws://localhost:${serverPort}` });
      assertEqual(netManager.activeTransport, 'none');
      assertFalse(netManager.isFallbackActive);
    });

    await test('getTransportName() returns "Disconnected" initially', async () => {
      assertEqual(netManager.getTransportName(), 'Disconnected');
    });

    await test('Primary adapter connects to dedicated WebSocket server', async () => {
      const res = await netManager.createRoom({ hostName: 'NetMan_Host' });
      assertEqual(netManager.activeTransport, 'websocket');
      assertEqual(netManager.getTransportName(), 'WebSocket');
      assertFalse(netManager.isFallbackActive);
      assertTrue(res.roomCode.startsWith('BW-'));
    });

    await test('WebSocketAdapter queues messages before connection is established', async () => {
      const queuedAdapter = new WebSocketAdapter(`ws://localhost:${serverPort}`);
      queuedAdapter.sendPacket('CHAT_MESSAGE', { text: 'queued test' });
      assertEqual(queuedAdapter.pendingQueue.length, 1);
    });

    await test('NetworkManager gracefully disconnects', async () => {
      netManager.disconnect();
      assertEqual(netManager.activeTransport, 'none');
      assertEqual(netManager.getTransportName(), 'Disconnected');
    });

    let fallbackManager = null;
    await test('Simulated WebSocket timeout triggers automatic WebRTC failover', async () => {
      fallbackManager = new NetworkManager(null, {
        wsUrl: 'ws://127.0.0.1:1', // Unreachable port
        wsTimeoutMs: 150,
      });

      fallbackManager.onWebSocketTimeout();
      assertEqual(fallbackManager.activeTransport, 'webrtc');
      assertTrue(fallbackManager.isFallbackActive);
      assertTrue(fallbackManager.getTransportName().includes('WebRTC'));
    });

    await test('WebRTC fallback preserves packet routing API', async () => {
      let routedPacket = null;
      fallbackManager.rtcAdapter.sendPacket = (type, payload) => {
        routedPacket = { type, payload };
        return true;
      };

      const sent = fallbackManager.broadcastBedDestroy('green');
      assertTrue(sent);
      assertEqual(routedPacket.type, 'BED_DESTROY');
      assertEqual(routedPacket.payload.team, 'green');
    });

    // ========================================================================
    // Group 5: Local Area Network (LAN) Multiplayer & Direct Join
    // ========================================================================
    console.log('\n► Group 5: LAN Multiplayer, Direct IP:Port Validation & Discovery');

    await test('validateLanAddress accepts standard 192.168.x.x IPv4 subnet', async () => {
      assertTrue(validateLanAddress('192.168.1.105', 8080));
      assertTrue(validateLanAddress('192.168.0.1', 8766));
    });

    await test('validateLanAddress accepts 10.x.x.x private class A subnet', async () => {
      assertTrue(validateLanAddress('10.0.0.25', 3000));
    });

    await test('validateLanAddress accepts loopback 127.0.0.1 address', async () => {
      assertTrue(validateLanAddress('127.0.0.1', 8080));
    });

    await test('validateLanAddress accepts boundary ports 1 and 65535', async () => {
      assertTrue(validateLanAddress('192.168.1.50', 1));
      assertTrue(validateLanAddress('192.168.1.50', 65535));
    });

    await test('validateLanAddress rejects invalid IP octave > 255', async () => {
      assertFalse(validateLanAddress('192.168.1.256', 8080));
      assertFalse(validateLanAddress('300.1.1.1', 8080));
    });

    await test('validateLanAddress rejects non-numeric or malformed host strings', async () => {
      assertFalse(validateLanAddress('my-lan-host', 8080));
      assertFalse(validateLanAddress('192.168.1', 8080));
    });

    await test('validateLanAddress rejects port 0', async () => {
      assertFalse(validateLanAddress('192.168.1.50', 0));
    });

    await test('validateLanAddress rejects port > 65535', async () => {
      assertFalse(validateLanAddress('192.168.1.50', 65536));
      assertFalse(validateLanAddress('192.168.1.50', 99999));
    });

    await test('formatDirectUrl formats valid IP and port into WebSocket URL', async () => {
      const url = formatDirectUrl('192.168.1.100', 8766);
      assertEqual(url, 'ws://192.168.1.100:8766');
    });

    await test('formatDirectUrl throws Error on invalid parameters', async () => {
      let threw = false;
      try {
        formatDirectUrl('not-an-ip', 8080);
      } catch (e) {
        threw = true;
      }
      assertTrue(threw);
    });

    let lanDiscovery = null;
    await test('LanDiscovery.startBroadcast constructs active broadcast beacon', async () => {
      const lan = new LanDiscovery({ port: 8766 });
      lan.startBroadcast({ roomCode: 'LAN-9900', hostName: 'BeaconTest', map: 'octagon', port: 8766 });
      assertTrue(lan.broadcastTimer !== null);
      lan.stopBroadcast();
      assertEqual(lan.broadcastTimer, null);
    });

    await test('LanDiscovery ingests incoming UDP/subnet beacon', async () => {
      lanDiscovery = new LanDiscovery({ port: 8766 });
      let discoveredList = [];
      lanDiscovery.startDiscovery((list) => {
        discoveredList = list;
      });

      lanDiscovery.handleBeacon({
        app: 'voxel-bedwars-lan',
        roomCode: 'LAN-7721',
        hostName: "Charlie's Bedwars",
        map: 'speedway',
        port: 8766,
        ip: '192.168.1.120',
      });

      assertEqual(discoveredList.length, 1);
      assertEqual(discoveredList[0].roomCode, 'LAN-7721');
      assertEqual(discoveredList[0].hostName, "Charlie's Bedwars");
    });

    await test('LanDiscovery ignores non-matching beacon tags', async () => {
      lanDiscovery.handleBeacon({
        app: 'other-unrelated-app',
        roomCode: 'OTHER-1234',
      });
      assertEqual(lanDiscovery.discoveredRooms.size, 1);
    });

    await test('LanDiscovery cleans up discovery timers on stopDiscovery()', async () => {
      lanDiscovery.stopDiscovery();
      assertEqual(lanDiscovery.discoveredRooms.size, 0);
    });

    // ========================================================================
    // Group 6: Disconnection, Host Migration & Room Cleanup Lifecycle
    // ========================================================================
    console.log('\n► Group 6: Disconnection, Host Migration & Room Cleanup Lifecycle');

    let peerLeftPromise = null;
    await test('Client 3 disconnects and server broadcasts PEER_LEFT to remaining clients', async () => {
      peerLeftPromise = awaitPacket(client1, 'PEER_LEFT');
      client3.terminate();
      const leftNotification = await peerLeftPromise;
      assertTrue(!!leftNotification.payload.clientId);
    });

    await test('Server room client count decreases appropriately', async () => {
      const room = serverInstance.rooms.get(createdRoomCode);
      assertEqual(room.clients.size, 2);
    });

    let hostMigratedPromise = null;
    await test('Host disconnects and server migrates host role to Client 2', async () => {
      hostMigratedPromise = awaitPacket(client2, 'HOST_MIGRATED');
      client1.terminate();

      const migration = await hostMigratedPromise;
      assertEqual(migration.payload.newHostId, guestId);

      const room = serverInstance.rooms.get(createdRoomCode);
      assertEqual(room.hostId, guestId);
    });

    await test('Client sends ROOM_LEAVE and receives ROOM_LEFT confirmation', async () => {
      const leaverClient = await createClient(serverPort);
      await sendAndAwaitPacket(leaverClient, {
        type: 'ROOM_CREATE',
        payload: { format: '1v1', map: 'colosseum' },
      }, 'ROOM_CREATED');

      const left = await sendAndAwaitPacket(leaverClient, {
        type: 'ROOM_LEAVE',
      }, 'ROOM_LEFT');

      assertTrue(left.payload.success);
      leaverClient.terminate();
    });

    await test('Last client disconnects and server completely deletes empty room', async () => {
      client2.terminate();
      await new Promise((r) => setTimeout(r, 100));
      assertFalse(serverInstance.rooms.has(createdRoomCode));
    });

    await test('HTTP GET /ping confirms rooms count returns to 0 after cleanup', async () => {
      const cleanupPing = await httpGet(`http://localhost:${serverPort}/ping`);
      assertEqual(cleanupPing.json?.rooms, 0);
    });

    await test('Ephemeral server closes cleanly', async () => {
      await serverInstance.close();
      assertTrue(true);
    });

  } catch (uncaughtErr) {
    console.error('Uncaught Suite Error:', uncaughtErr);
    failedCount++;
    failures.push({ name: 'Uncaught Suite Exception', error: uncaughtErr });
  }

  // ========================================================================
  // Test Summary
  // ========================================================================
  console.log('\n╔══════════════════════════════════════════════════════════════════════╗');
  console.log(`║   MILESTONE 4 SUITE RESULTS: ${passedCount} PASSED / ${failedCount} FAILED               ║`);
  console.log('╚══════════════════════════════════════════════════════════════════════╝');

  if (failedCount > 0) {
    console.error(`\n❌ ${failedCount} TEST INVARIANTS FAILED:`);
    failures.forEach((f, idx) => {
      console.error(`  ${idx + 1}. ${f.name}: ${f.error.message}`);
    });
    process.exit(1);
  } else {
    console.log(`\n🎉 ALL ${passedCount} INVARIANTS VERIFIED SUCCESSFULLY (0 FAILURES)!`);
    process.exit(0);
  }
}

runSuite();
