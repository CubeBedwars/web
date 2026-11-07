/**
 * tests/stress_m4_challenger.js
 * Adversarial Empirical Stress Test Suite for Milestone 4:
 * Dual-Layer Networking, Fallback, LAN Discovery, and Packet Roundtrip.
 * 
 * Tests:
 * 1. Simulated WebSocket outage / unreachable server & automatic WebRTC fallback
 * 2. LAN IP and Port validation with extensive adversarial strings
 * 3. Direct IP:Port URL formatting & error conditions
 * 4. Full packet roundtrip across client adapters (BLOCK_PLACE, BLOCK_BREAK, BED_DESTROY, PLAYER_DAMAGE, PLAYER_TRANSFORM)
 * 5. NetworkManager packet routing & GameManager state synchronization fidelity
 */

import http from 'http';
import { WebSocket } from 'ws';
import { startServer } from '../server/index.js';
import { NetworkManager } from '../src/net/NetworkManager.js';
import { WebSocketAdapter } from '../src/net/WebSocketAdapter.js';
import { WebRTCAdapter } from '../src/net/WebRTCAdapter.js';
import { LanDiscovery, validateLanAddress, formatDirectUrl } from '../src/net/LanDiscovery.js';
import { BLOCK_TYPES } from '../src/engine/VoxelWorld.js';

let passed = 0;
let failed = 0;
const testErrors = [];

function assert(cond, msg) {
  if (!cond) throw new Error(`Assertion Failed: ${msg}`);
}

function assertEqual(actual, expected, msg = '') {
  if (actual !== expected) {
    throw new Error(`Expected ${JSON.stringify(expected)} but got ${JSON.stringify(actual)}. ${msg}`);
  }
}

function assertTrue(cond, msg = '') {
  if (cond !== true) throw new Error(`Expected true but got ${cond}. ${msg}`);
}

function assertFalse(cond, msg = '') {
  if (cond !== false) throw new Error(`Expected false but got ${cond}. ${msg}`);
}

async function runTest(name, fn) {
  try {
    await fn();
    passed++;
    console.log(`  ✔ [PASS] ${name}`);
  } catch (err) {
    failed++;
    testErrors.push({ name, error: err });
    console.error(`  ✖ [FAIL] ${name}`);
    console.error(`    Error: ${err.message}`);
  }
}

async function main() {
  console.log('======================================================================');
  console.log('   EMPIRICAL CHALLENGER: MILESTONE 4 ADVERSARIAL STRESS TEST SUITE   ');
  console.log('======================================================================\n');

  // ==========================================================================
  // Section 1: Simulated WebSocket Outage & WebRTC Fallback
  // ==========================================================================
  console.log('--- SECTION 1: Simulated WebSocket Outage & WebRTC Fallback ---');

  await runTest('WebSocketAdapter throws timeout when server is unreachable', async () => {
    // Port 59123 has nothing listening
    const deadAdapter = new WebSocketAdapter('ws://127.0.0.1:59123');
    let caught = null;
    const startTime = Date.now();
    try {
      await deadAdapter.connect(null, 300);
    } catch (e) {
      caught = e;
    }
    const duration = Date.now() - startTime;
    assertTrue(caught !== null, 'Expected connection to fail');
    assertTrue(duration < 2500, `Expected fast failure or timeout, took ${duration}ms`);
    assertFalse(deadAdapter.isConnected, 'Adapter should not be marked connected');
    assertFalse(deadAdapter.isConnecting, 'Adapter should not remain in connecting state');
  });

  await runTest('NetworkManager.createRoom initiates fallbackToWebRTC when WebSocket fails', async () => {
    const net = new NetworkManager(null, {
      wsUrl: 'ws://127.0.0.1:59124',
      wsTimeoutMs: 200,
    });

    let fallbackCalled = false;
    let fallbackAction = null;
    net.fallbackToWebRTC = async (action, options, onSuccess, onError) => {
      fallbackCalled = true;
      fallbackAction = action;
      net.activeTransport = 'webrtc';
      net.isFallbackActive = true;
      net.roomCode = 'BW-MOCK1';
      net.clientId = 'BW-MOCK1';
      net.isHost = true;
      net.hudBadge = 'WebRTC (Fallback)';
      if (onSuccess) onSuccess('BW-MOCK1');
      return { roomCode: 'BW-MOCK1', hostId: 'BW-MOCK1', transport: 'webrtc' };
    };

    let callbackCode = null;
    const res = await net.createRoom({ hostName: 'ChallengerHost' }, (code) => {
      callbackCode = code;
    });

    assertTrue(fallbackCalled, 'Expected fallbackToWebRTC to be invoked');
    assertEqual(fallbackAction, 'create');
    assertEqual(net.activeTransport, 'webrtc');
    assertTrue(net.isFallbackActive);
    assertEqual(net.getTransportName(), 'WebRTC (Fallback)');
    assertEqual(res.roomCode, 'BW-MOCK1');
    assertEqual(callbackCode, 'BW-MOCK1');
  });

  await runTest('NetworkManager.joinRoom initiates fallbackToWebRTC when WebSocket fails', async () => {
    const net = new NetworkManager(null, {
      wsUrl: 'ws://127.0.0.1:59125',
      wsTimeoutMs: 200,
    });

    let fallbackCalled = false;
    let fallbackAction = null;
    net.fallbackToWebRTC = async (action, options, onSuccess, onError) => {
      fallbackCalled = true;
      fallbackAction = action;
      net.activeTransport = 'webrtc';
      net.isFallbackActive = true;
      net.roomCode = options.roomCode;
      net.isHost = false;
      net.hudBadge = 'WebRTC (Fallback)';
      if (onSuccess) onSuccess({ roomCode: options.roomCode });
      return { roomCode: options.roomCode, transport: 'webrtc' };
    };

    let callbackRes = null;
    const res = await net.joinRoom('BW-9999', { playerName: 'ChallengerGuest' }, (r) => {
      callbackRes = r;
    });

    assertTrue(fallbackCalled, 'Expected fallbackToWebRTC on joinRoom failure');
    assertEqual(fallbackAction, 'join');
    assertEqual(net.activeTransport, 'webrtc');
    assertTrue(net.isFallbackActive);
    assertEqual(net.roomCode, 'BW-9999');
    assertEqual(callbackRes.roomCode, 'BW-9999');
  });

  await runTest('Non-responsive server ROOM_CREATE timeout triggers WebRTC fallback', async () => {
    // Start dummy server that accepts TCP/WebSocket connection but never sends any message
    const silentServer = http.createServer();
    await new Promise((res) => silentServer.listen(0, res));
    const silentPort = silentServer.address().port;
    const wss = new (await import('ws')).WebSocketServer({ server: silentServer });

    // Client connects, server accepts connection, does nothing
    const net = new NetworkManager(null, {
      wsUrl: `ws://localhost:${silentPort}`,
      wsTimeoutMs: 1000,
    });

    let fallbackTriggered = false;
    net.fallbackToWebRTC = async (action) => {
      fallbackTriggered = true;
      net.activeTransport = 'webrtc';
      net.isFallbackActive = true;
      return { roomCode: 'BW-FALLBACK', transport: 'webrtc' };
    };

    // Override adapter createRoom timeout for fast test execution
    const origCreateRoom = net.wsAdapter.createRoom.bind(net.wsAdapter);
    net.wsAdapter.createRoom = function(options) {
      return new Promise((resolve, reject) => {
        setTimeout(() => reject(new Error('Room creation response timed out')), 200);
      });
    };

    const res = await net.createRoom({ hostName: 'SilentTest' });
    assertTrue(fallbackTriggered, 'Fallback should trigger when server does not respond');
    assertEqual(net.activeTransport, 'webrtc');
    assertEqual(res.roomCode, 'BW-FALLBACK');

    // Clean up silent server
    await new Promise((r) => wss.close(r));
    await new Promise((r) => silentServer.close(r));
  });

  // ==========================================================================
  // Section 2: LAN IP & Port Validation (validateLanAddress)
  // ==========================================================================
  console.log('\n--- SECTION 2: LAN IP & Port Validation ---');

  // 2.1 Valid IPv4 addresses with standard/custom ports
  const validCases = [
    { ip: '192.168.1.1', port: 8080, desc: 'standard private C gateway' },
    { ip: '192.168.0.254', port: 8766, desc: 'standard desktop UDP discovery port' },
    { ip: '10.0.0.5', port: 9000, desc: 'private class A host' },
    { ip: '10.255.255.255', port: 80, desc: 'class A broadcast' },
    { ip: '172.16.0.1', port: 443, desc: 'private class B lower' },
    { ip: '172.31.255.254', port: 65535, desc: 'private class B upper boundary port' },
    { ip: '127.0.0.1', port: 8080, desc: 'loopback with 8080' },
    { ip: '127.0.0.1', port: 1, desc: 'loopback with min valid port 1' },
    { ip: '127.0.0.1', port: 65535, desc: 'loopback with max valid port 65535' },
    { ip: '0.0.0.0', port: 8080, desc: 'all interfaces IPv4' },
    { ip: '255.255.255.255', port: 8080, desc: 'limited broadcast IPv4' },
    { ip: '1.1.1.1', port: 53, desc: 'public IPv4' },
    { ip: '  192.168.1.50  ', port: 8080, desc: 'IPv4 with leading/trailing whitespace' },
    { ip: '192.168.1.1', port: '8080', desc: 'numeric string port' },
  ];

  for (const c of validCases) {
    await runTest(`validateLanAddress accepts: ${c.ip}:${c.port} (${c.desc})`, async () => {
      assertTrue(validateLanAddress(c.ip, c.port), `Should accept valid LAN address ${c.ip}:${c.port}`);
    });
  }

  // 2.2 Adversarial Invalid IP Strings
  const invalidIpCases = [
    // Out-of-range octets
    { ip: '256.0.0.1', desc: 'first octet 256 (>255)' },
    { ip: '192.168.1.256', desc: 'fourth octet 256 (>255)' },
    { ip: '192.168.300.1', desc: 'third octet 300 (>255)' },
    { ip: '999.999.999.999', desc: 'all octets 999' },
    { ip: '1.2.3.1000', desc: 'fourth octet 1000' },
    { ip: '-1.0.0.1', desc: 'negative octet -1' },
    { ip: '192.-168.1.1', desc: 'negative octet inside' },
    // Structural / count errors
    { ip: '192.168.1', desc: 'only 3 octets' },
    { ip: '192.168.1.1.1', desc: '5 octets' },
    { ip: '192.168', desc: 'only 2 octets' },
    { ip: '192', desc: 'single octet' },
    { ip: '192.168.1.', desc: 'trailing dot' },
    { ip: '.192.168.1.1', desc: 'leading dot' },
    { ip: '192..168.1.1', desc: 'consecutive dots' },
    { ip: '...', desc: 'only dots' },
    { ip: '', desc: 'empty string' },
    { ip: '   ', desc: 'whitespace only' },
    // Domain names
    { ip: 'localhost', desc: 'localhost hostname' },
    { ip: 'bedwars.lan', desc: 'LAN domain name' },
    { ip: 'example.com', desc: 'FQDN domain name' },
    { ip: 'google.com', desc: 'public domain name' },
    // URL schemes / prefixes
    { ip: 'ws://192.168.1.1', desc: 'ws:// prefix' },
    { ip: 'http://192.168.1.1', desc: 'http:// prefix' },
    { ip: 'https://192.168.1.1', desc: 'https:// prefix' },
    // IPv6 addresses
    { ip: '::1', desc: 'IPv6 loopback' },
    { ip: 'fe80::1', desc: 'IPv6 link-local' },
    { ip: '2001:db8::1', desc: 'IPv6 documentation' },
    { ip: '[::1]', desc: 'IPv6 bracketed' },
    // XSS Payloads
    { ip: '<script>alert(1)</script>', desc: 'script tag XSS' },
    { ip: '"><img src=x onerror=alert(1)>', desc: 'img tag XSS' },
    { ip: 'javascript:alert(1)', desc: 'javascript pseudo-protocol' },
    { ip: '<svg onload=alert(1)>', desc: 'svg onload XSS' },
    // Injection / Special characters
    { ip: '192.168.1.1; rm -rf /', desc: 'shell injection attempt' },
    { ip: '192.168.1.1\r\nHost: evil.com', desc: 'CRLF header injection' },
    { ip: '192.168.1.1:8080', desc: 'port included in IP parameter' },
    { ip: '192.168.1.1/24', desc: 'CIDR notation' },
    { ip: '192.168.1.1#fragment', desc: 'URL fragment' },
    { ip: '192.168.1.1?query=1', desc: 'URL query parameter' },
    // Type mismatches
    { ip: null, desc: 'null type' },
    { ip: undefined, desc: 'undefined type' },
    { ip: 127001, desc: 'number type' },
    { ip: {}, desc: 'object type' },
    { ip: [], desc: 'array type' },
    { ip: true, desc: 'boolean type' },
  ];

  for (const c of invalidIpCases) {
    await runTest(`validateLanAddress rejects invalid IP: ${String(c.ip)} (${c.desc})`, async () => {
      assertFalse(validateLanAddress(c.ip, 8080), `Should reject invalid IP: ${c.ip}`);
    });
  }

  // 2.3 Adversarial Invalid Ports
  const invalidPortCases = [
    { port: 0, desc: 'port 0 (reserved/invalid in TCP)' },
    { port: 65536, desc: 'port 65536 (exceeds 16-bit uint)' },
    { port: 70000, desc: 'port 70000' },
    { port: 100000, desc: 'port 100000' },
    { port: -1, desc: 'negative port -1' },
    { port: -8080, desc: 'negative port -8080' },
    { port: 80.5, desc: 'floating point port 80.5' },
    { port: 8080.99, desc: 'floating point port 8080.99' },
    { port: '8080abc', desc: 'alphanumeric string port' },
    { port: 'xyz', desc: 'non-numeric string port' },
    { port: '', desc: 'empty string port' },
    { port: ' ', desc: 'whitespace port' },
    { port: null, desc: 'null port' },
    { port: undefined, desc: 'undefined port' },
    { port: NaN, desc: 'NaN port' },
    { port: Infinity, desc: 'Infinity port' },
    { port: -Infinity, desc: '-Infinity port' },
    { port: {}, desc: 'object port' },
    { port: [], desc: 'array port' },
    { port: '<script>', desc: 'XSS script tag port' },
  ];

  for (const c of invalidPortCases) {
    await runTest(`validateLanAddress rejects invalid port: ${String(c.port)} (${c.desc})`, async () => {
      assertFalse(validateLanAddress('192.168.1.1', c.port), `Should reject invalid port: ${c.port}`);
    });
  }

  // ==========================================================================
  // Section 3: Direct IP:Port URL Formatting (formatDirectUrl)
  // ==========================================================================
  console.log('\n--- SECTION 3: Direct IP:Port URL Formatting ---');

  await runTest('formatDirectUrl formats valid standard IPv4 address and port', async () => {
    assertEqual(formatDirectUrl('192.168.1.1', 8080), 'ws://192.168.1.1:8080');
    assertEqual(formatDirectUrl('10.0.0.5', 9000), 'ws://10.0.0.5:9000');
    assertEqual(formatDirectUrl('127.0.0.1', 8766), 'ws://127.0.0.1:8766');
  });

  await runTest('formatDirectUrl trims leading and trailing whitespace from IP', async () => {
    assertEqual(formatDirectUrl('   192.168.1.100   ', 8080), 'ws://192.168.1.100:8080');
  });

  await runTest('formatDirectUrl formats boundary ports 1 and 65535 correctly', async () => {
    assertEqual(formatDirectUrl('192.168.1.1', 1), 'ws://192.168.1.1:1');
    assertEqual(formatDirectUrl('192.168.1.1', 65535), 'ws://192.168.1.1:65535');
  });

  await runTest('formatDirectUrl throws Error on invalid IP address', async () => {
    let threw = false;
    try {
      formatDirectUrl('256.0.0.1', 8080);
    } catch (e) {
      threw = true;
      assertTrue(e.message.includes('Invalid LAN IP:Port'));
    }
    assertTrue(threw, 'Should have thrown on 256.0.0.1');
  });

  await runTest('formatDirectUrl throws Error on invalid port', async () => {
    let threw = false;
    try {
      formatDirectUrl('192.168.1.1', 65536);
    } catch (e) {
      threw = true;
      assertTrue(e.message.includes('Invalid LAN IP:Port'));
    }
    assertTrue(threw, 'Should have thrown on port 65536');
  });

  await runTest('formatDirectUrl throws Error on XSS or domain payload', async () => {
    let threwXss = false;
    try {
      formatDirectUrl('<script>alert(1)</script>', 8080);
    } catch (e) {
      threwXss = true;
    }
    assertTrue(threwXss, 'Should have thrown on XSS payload');

    let threwDomain = false;
    try {
      formatDirectUrl('localhost', 8080);
    } catch (e) {
      threwDomain = true;
    }
    assertTrue(threwDomain, 'Should have thrown on localhost domain');
  });

  // ==========================================================================
  // Section 4: Packet Roundtrip Across Client Adapters
  // ==========================================================================
  console.log('\n--- SECTION 4: Packet Roundtrip Across Client Adapters ---');

  // Spin up real dedicated server for roundtrip tests
  const server = await startServer(0);
  const serverPort = server.port;

  const hostAdapter = new WebSocketAdapter(`ws://localhost:${serverPort}`);
  const clientAdapter = new WebSocketAdapter(`ws://localhost:${serverPort}`);

  await hostAdapter.connect();
  const roomRes = await hostAdapter.createRoom({
    format: '2v2',
    map: 'speedway',
    hostName: 'HostPlayer',
  });
  const roomCode = roomRes.roomCode;
  const hostId = roomRes.hostId;

  await clientAdapter.connect();
  const joinRes = await clientAdapter.joinRoom(roomCode, { playerName: 'ClientPlayer' });
  const clientId = joinRes.clientId;

  // Helper: wait for packet on adapter
  function waitForPacket(adapter, type, timeoutMs = 3000) {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        adapter.offPacket(type, handler);
        reject(new Error(`Timed out waiting for packet: ${type}`));
      }, timeoutMs);

      function handler(packet) {
        clearTimeout(timer);
        adapter.offPacket(type, handler);
        resolve(packet);
      }
      adapter.onPacket(type, handler);
    });
  }

  // 4.1 BLOCK_PLACE packet roundtrip
  await runTest('Packet roundtrip: BLOCK_PLACE from host to client', async () => {
    const packetPromise = waitForPacket(clientAdapter, 'BLOCK_PLACE');
    const sent = hostAdapter.sendPacket('BLOCK_PLACE', {
      x: 15,
      y: 22,
      z: -30,
      blockType: BLOCK_TYPES.WOOL_RED,
    });
    assertTrue(sent, 'sendPacket should return true');

    const received = await packetPromise;
    assertEqual(received.type, 'BLOCK_PLACE');
    assertEqual(received.sender, hostId);
    assertTrue(typeof received.timestamp === 'number');
    assertEqual(received.payload.x, 15);
    assertEqual(received.payload.y, 22);
    assertEqual(received.payload.z, -30);
    assertEqual(received.payload.blockType, BLOCK_TYPES.WOOL_RED);
  });

  // 4.2 BLOCK_BREAK packet roundtrip
  await runTest('Packet roundtrip: BLOCK_BREAK from client to host', async () => {
    const packetPromise = waitForPacket(hostAdapter, 'BLOCK_BREAK');
    const sent = clientAdapter.sendPacket('BLOCK_BREAK', {
      x: 15,
      y: 22,
      z: -30,
    });
    assertTrue(sent);

    const received = await packetPromise;
    assertEqual(received.type, 'BLOCK_BREAK');
    assertEqual(received.sender, clientId);
    assertTrue(typeof received.timestamp === 'number');
    assertEqual(received.payload.x, 15);
    assertEqual(received.payload.y, 22);
    assertEqual(received.payload.z, -30);
  });

  // 4.3 BED_DESTROY packet roundtrip
  await runTest('Packet roundtrip: BED_DESTROY from client to host', async () => {
    const packetPromise = waitForPacket(hostAdapter, 'BED_DESTROY');
    const sent = clientAdapter.sendPacket('BED_DESTROY', {
      team: 'blue',
    });
    assertTrue(sent);

    const received = await packetPromise;
    assertEqual(received.type, 'BED_DESTROY');
    assertEqual(received.sender, clientId);
    assertEqual(received.payload.team, 'blue');
  });

  // 4.4 PLAYER_DAMAGE packet roundtrip
  await runTest('Packet roundtrip: PLAYER_DAMAGE from host to client', async () => {
    const packetPromise = waitForPacket(clientAdapter, 'PLAYER_DAMAGE');
    const sent = hostAdapter.sendPacket('PLAYER_DAMAGE', {
      targetId: clientId,
      amount: 6.5,
    });
    assertTrue(sent);

    const received = await packetPromise;
    assertEqual(received.type, 'PLAYER_DAMAGE');
    assertEqual(received.sender, hostId);
    assertEqual(received.payload.targetId, clientId);
    assertEqual(received.payload.amount, 6.5);
  });

  // 4.5 PLAYER_TRANSFORM packet roundtrip
  await runTest('Packet roundtrip: PLAYER_TRANSFORM from client to host', async () => {
    const packetPromise = waitForPacket(hostAdapter, 'PLAYER_TRANSFORM');
    const sent = clientAdapter.sendPacket('PLAYER_TRANSFORM', {
      x: 3.1415,
      y: 20.0,
      z: -18.25,
      yaw: 1.57,
      pitch: -0.2,
    });
    assertTrue(sent);

    const received = await packetPromise;
    assertEqual(received.type, 'PLAYER_TRANSFORM');
    assertEqual(received.sender, clientId);
    assertEqual(received.payload.x, 3.1415);
    assertEqual(received.payload.y, 20.0);
    assertEqual(received.payload.z, -18.25);
    assertEqual(received.payload.yaw, 1.57);
    assertEqual(received.payload.pitch, -0.2);
  });

  // ==========================================================================
  // Section 5: NetworkManager Packet Routing & GameManager State Synchronization
  // ==========================================================================
  console.log('\n--- SECTION 5: NetworkManager Dispatch & State Sync ---');

  // Construct mock GameManager to test handlePacket state changes
  const mockWorld = {
    blocks: new Map(),
    rebuiltCount: 0,
    setBlock(x, y, z, bt) {
      this.blocks.set(`${x},${y},${z}`, bt);
    },
    getBlock(x, y, z) {
      return this.blocks.get(`${x},${y},${z}`) || 0;
    },
    rebuildMeshes() {
      this.rebuiltCount++;
    },
  };

  const mockSounds = {
    placed: 0,
    broken: 0,
    bedDestroyed: 0,
    hit: 0,
    playBlockPlace() { this.placed++; },
    playBlockBreak() { this.broken++; },
    playBedDestroyed() { this.bedDestroyed++; },
    playHit() { this.hit++; },
  };

  const mockParticles = {
    spawns: [],
    spawnBlockBreak(pos, color, count) {
      this.spawns.push({ pos, color, count });
    },
  };

  const mockTeams = {
    beds: { red: true, blue: true, green: true, yellow: true },
    destroyBed(t) {
      this.beds[t] = false;
    },
  };

  const mockLocalPlayer = {
    id: 'local_player_id',
    team: 'red',
    health: 20,
    damageTaken: [],
    takeDamage(amt) {
      this.health -= amt;
      this.damageTaken.push(amt);
    },
  };

  const mockHud = {
    announcements: [],
    chatMessages: [],
    networkStatus: null,
    showAnnouncement(title, sub) {
      this.announcements.push({ title, sub });
    },
    displayChatMessage(sender, text) {
      this.chatMessages.push({ sender, text });
    },
    updateNetworkStatus(name, code) {
      this.networkStatus = { name, code };
    },
  };

  const mockGM = {
    world: mockWorld,
    sound: mockSounds,
    particles: mockParticles,
    teamManager: mockTeams,
    localPlayer: mockLocalPlayer,
    hud: mockHud,
    players: [
      { id: 'remote_peer_1', position: { x: 0, y: 0, z: 0 } },
    ],
  };

  const manager = new NetworkManager(mockGM, {
    wsUrl: `ws://localhost:${serverPort}`,
  });
  manager.clientId = 'local_player_id';

  await runTest('NetworkManager.handlePacket routes BLOCK_PLACE to world and sound', async () => {
    manager.handlePacket({
      type: 'BLOCK_PLACE',
      sender: 'remote_peer_1',
      payload: { x: 10, y: 25, z: -5, blockType: BLOCK_TYPES.WOOD },
    });
    assertEqual(mockWorld.getBlock(10, 25, -5), BLOCK_TYPES.WOOD);
    assertEqual(mockSounds.placed, 1);
    assertEqual(mockWorld.rebuiltCount, 1);
  });

  await runTest('NetworkManager.handlePacket routes BLOCK_BREAK to world, sound and particles', async () => {
    mockWorld.setBlock(10, 25, -5, BLOCK_TYPES.WOOD);
    manager.handlePacket({
      type: 'BLOCK_BREAK',
      sender: 'remote_peer_1',
      payload: { x: 10, y: 25, z: -5 },
    });
    assertEqual(mockWorld.getBlock(10, 25, -5), BLOCK_TYPES.AIR);
    assertEqual(mockSounds.broken, 1);
    assertEqual(mockParticles.spawns.length, 1);
    assertEqual(mockParticles.spawns[0].pos.x, 10);
  });

  await runTest('NetworkManager.handlePacket routes BED_DESTROY to teamManager, sound and HUD', async () => {
    assertTrue(mockTeams.beds.blue);
    manager.handlePacket({
      type: 'BED_DESTROY',
      sender: 'remote_peer_1',
      payload: { team: 'blue' },
    });
    assertFalse(mockTeams.beds.blue);
    assertEqual(mockSounds.bedDestroyed, 1);
    assertEqual(mockHud.announcements.length, 1);
    assertTrue(mockHud.announcements[0].title.includes('BLUE BED DESTROYED'));
  });

  await runTest('NetworkManager.handlePacket routes PLAYER_DAMAGE to localPlayer when targeted', async () => {
    assertEqual(mockLocalPlayer.health, 20);
    manager.handlePacket({
      type: 'PLAYER_DAMAGE',
      sender: 'remote_peer_1',
      payload: { targetId: 'local_player_id', amount: 5.0 },
    });
    assertEqual(mockLocalPlayer.health, 15);
    assertEqual(mockSounds.hit, 1);
  });

  await runTest('NetworkManager.handlePacket ignores PLAYER_DAMAGE targeting other peers', async () => {
    manager.handlePacket({
      type: 'PLAYER_DAMAGE',
      sender: 'remote_peer_1',
      payload: { targetId: 'some_other_player', amount: 8.0 },
    });
    assertEqual(mockLocalPlayer.health, 15, 'Health should not change for damage to others');
  });

  await runTest('NetworkManager.handlePacket routes PLAYER_TRANSFORM to remote player position', async () => {
    manager.handlePacket({
      type: 'PLAYER_TRANSFORM',
      sender: 'remote_peer_1',
      payload: { x: 42.5, y: 19.0, z: -88.1 },
    });
    assertEqual(mockGM.players[0].position.x, 42.5);
    assertEqual(mockGM.players[0].position.y, 19.0);
    assertEqual(mockGM.players[0].position.z, -88.1);
  });

  await runTest('NetworkManager.handlePacket suppresses own echoed packets', async () => {
    const prevPlaced = mockSounds.placed;
    manager.handlePacket({
      type: 'BLOCK_PLACE',
      sender: 'local_player_id', // same as manager.clientId
      payload: { x: 99, y: 99, z: 99, blockType: BLOCK_TYPES.STONE },
    });
    assertEqual(mockSounds.placed, prevPlaced, 'Own echoed packet should be ignored');
  });

  await runTest('NetworkManager.handlePacket is resilient to malformed packets without crashing', async () => {
    // None of these should throw or crash
    manager.handlePacket(null);
    manager.handlePacket(undefined);
    manager.handlePacket('string_packet');
    manager.handlePacket(12345);
    manager.handlePacket({});
    manager.handlePacket({ type: null });
    manager.handlePacket({ type: 'UNKNOWN_TYPE_XYZ', payload: {} });
    manager.handlePacket({ type: 'BLOCK_PLACE' }); // missing payload
    assertTrue(true, 'Handled all malformed frames without throwing');
  });

  // Clean up
  hostAdapter.disconnect();
  clientAdapter.disconnect();
  manager.disconnect();
  await server.close();

  // ==========================================================================
  // Summary
  // ==========================================================================
  console.log('\n======================================================================');
  console.log(`   CHALLENGER RESULTS: ${passed} PASSED / ${failed} FAILED`);
  console.log('======================================================================');

  if (failed > 0) {
    console.error('\nFAILED TESTS:');
    testErrors.forEach((t) => console.error(`  - ${t.name}: ${t.error.message}`));
    process.exit(1);
  } else {
    console.log('\n🎉 ALL EMPIRICAL CHALLENGES PASSED! ZERO CRASHES, ACCURATE FALLBACK & ROBUST LAN PARSING.');
    process.exit(0);
  }
}

main().catch((err) => {
  console.error('Fatal test runner error:', err);
  process.exit(1);
});
