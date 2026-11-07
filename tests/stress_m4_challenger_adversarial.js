/**
 * tests/stress_m4_challenger_adversarial.js
 * Empirical Adversarial Stress Harness for Milestone 4 (Networking & Dedicated Server)
 * 
 * Conducts stress testing across 4 core adversarial dimensions:
 * 1. High-throughput packet bursts (hundreds of packets per second across concurrent clients)
 * 2. Room lifecycle under adversarial conditions (concurrent creations, non-existent joins, multi-client scaling, host teardown & migration)
 * 3. HTTP /ping endpoint under rapid concurrency (100 parallel requests, monotonicity, CORS, headers)
 * 4. Invalid packet fuzzing (malformed JSON, binary garbage, missing types, out-of-bounds coordinates, prototype pollution)
 */

import http from 'http';
import crypto from 'crypto';
import { WebSocket } from 'ws';
import { startServer } from '../server/index.js';
import { BLOCK_TYPES } from '../src/engine/VoxelWorld.js';

let passed = 0;
let failed = 0;
const failures = [];

function assert(condition, message) {
  if (!condition) {
    throw new Error(`Assertion Failed: ${message}`);
  }
}

function assertEqual(actual, expected, message = '') {
  if (actual !== expected) {
    throw new Error(`Expected ${JSON.stringify(expected)} but got ${JSON.stringify(actual)}. ${message}`);
  }
}

async function runTest(name, fn) {
  try {
    await fn();
    passed++;
    console.log(`  [PASS] Test ${passed}: ${name}`);
  } catch (err) {
    failed++;
    failures.push({ name, error: err });
    console.error(`  [FAIL] Test FAILED: ${name}`);
    console.error(`         ${err.message}`);
  }
}

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

function httpRequest(url, method = 'GET') {
  return new Promise((resolve, reject) => {
    const parsed = new URL(url);
    const req = http.request({
      hostname: parsed.hostname,
      port: parsed.port,
      path: parsed.pathname + parsed.search,
      method,
    }, (res) => {
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
    });
    req.on('error', reject);
    req.end();
  });
}

function createClient(port) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(`ws://localhost:${port}`);
    ws.on('open', () => resolve(ws));
    ws.on('error', reject);
  });
}

function awaitPacket(ws, expectedType, timeoutMs = 4000) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      ws.off('message', handler);
      reject(new Error(`Timed out waiting for packet type '${expectedType}'`));
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

function sendAndAwaitPacket(ws, packet, expectedType, timeoutMs = 4000) {
  const p = awaitPacket(ws, expectedType, timeoutMs);
  ws.send(typeof packet === 'string' ? packet : JSON.stringify(packet));
  return p;
}

async function runAdversarialSuite() {
  console.log('╔══════════════════════════════════════════════════════════════════════╗');
  console.log('║       CHALLENGER EMPIRICAL ADVERSARIAL STRESS TEST SUITE             ║');
  console.log('║       Milestone 4: Dedicated WebSocket Server & Dual-Layer Net       ║');
  console.log('╚══════════════════════════════════════════════════════════════════════╝\n');

  let serverInstance = null;
  let port = 0;

  try {
    serverInstance = await startServer({ port: 0 });
    port = serverInstance.port;
    console.log(`Dedicated server running on ephemeral port: ${port}\n`);

    // ========================================================================
    // Dimension 1: Rapid Consecutive HTTP /ping Endpoint Concurrency
    // ========================================================================
    console.log('► Dimension 1: Rapid Consecutive HTTP /ping Endpoint Concurrency');

    await runTest('100 concurrent HTTP GET /ping requests all return HTTP 200 with valid JSON', async () => {
      const requests = Array.from({ length: 100 }, () => httpGet(`http://localhost:${port}/ping`));
      const results = await Promise.all(requests);
      assertEqual(results.length, 100);
      for (const res of results) {
        assertEqual(res.statusCode, 200);
        assertEqual(res.headers['access-control-allow-origin'], '*');
        assert(res.json !== null, 'Response body must be valid JSON');
        assertEqual(res.json.status, 'ok');
        assert(typeof res.json.uptime === 'number' && res.json.uptime > 0, 'Uptime must be positive float');
        assert(typeof res.json.timestamp === 'number' && res.json.timestamp > 0, 'Timestamp must be positive');
        assert(typeof res.json.rooms === 'number', 'Rooms must be number');
      }
    });

    await runTest('Process uptime monotonicity across 50 sequential /ping requests', async () => {
      let previousUptime = 0;
      let previousTimestamp = 0;
      for (let i = 0; i < 50; i++) {
        const res = await httpGet(`http://localhost:${port}/ping`);
        assertEqual(res.statusCode, 200);
        assert(res.json.uptime >= previousUptime, `Uptime decreased! prev=${previousUptime}, curr=${res.json.uptime}`);
        assert(res.json.timestamp >= previousTimestamp, `Timestamp decreased! prev=${previousTimestamp}, curr=${res.json.timestamp}`);
        previousUptime = res.json.uptime;
        previousTimestamp = res.json.timestamp;
      }
    });

    await runTest('HTTP OPTIONS /ping preflight returns 204 with full CORS headers', async () => {
      const res = await httpRequest(`http://localhost:${port}/ping`, 'OPTIONS');
      assertEqual(res.statusCode, 204);
      assertEqual(res.headers['access-control-allow-origin'], '*');
      assert(res.headers['access-control-allow-methods'].includes('GET'), 'CORS must allow GET');
      assert(res.headers['access-control-allow-methods'].includes('OPTIONS'), 'CORS must allow OPTIONS');
    });

    await runTest('HTTP POST /ping responds with 200 OK and valid JSON (non-GET resilience)', async () => {
      const res = await httpRequest(`http://localhost:${port}/ping`, 'POST');
      assertEqual(res.statusCode, 200);
      assertEqual(res.json?.status, 'ok');
    });

    await runTest('HTTP GET /health and / endpoints return 200 OK with server stats', async () => {
      const resHealth = await httpGet(`http://localhost:${port}/health`);
      assertEqual(resHealth.statusCode, 200);
      assertEqual(resHealth.json?.status, 'online');
      assertEqual(resHealth.json?.name, 'voxel-bedwars-server');

      const resRoot = await httpGet(`http://localhost:${port}/`);
      assertEqual(resRoot.statusCode, 200);
      assertEqual(resRoot.json?.status, 'online');
    });

    await runTest('HTTP non-existent route returns 404 with JSON error', async () => {
      const res404 = await httpGet(`http://localhost:${port}/non-existent-endpoint`);
      assertEqual(res404.statusCode, 404);
      assertEqual(res404.json?.error, 'Not Found');
    });

    // ========================================================================
    // Dimension 2: Room Lifecycle Under Adversarial Conditions
    // ========================================================================
    console.log('\n► Dimension 2: Room Lifecycle Under Adversarial Conditions');

    let createdCodes = new Set();
    const concurrentClients = [];

    await runTest('30 concurrent clients simultaneously create rooms without code collision', async () => {
      const clients = await Promise.all(
        Array.from({ length: 30 }, () => createClient(port))
      );
      concurrentClients.push(...clients);

      const creationPromises = clients.map((ws, idx) =>
        sendAndAwaitPacket(ws, {
          type: 'ROOM_CREATE',
          payload: { format: '4v4', map: 'speedway', hostName: `Host_${idx}` },
        }, 'ROOM_CREATED')
      );

      const results = await Promise.all(creationPromises);
      assertEqual(results.length, 30);

      createdCodes = new Set(results.map(r => r.payload.roomCode));
      assertEqual(createdCodes.size, 30, 'Every generated room code must be unique (0 collisions)');

      for (const code of createdCodes) {
        assert(code.startsWith('BW-'), `Room code '${code}' must start with BW-`);
        assertEqual(code.length, 7, `Room code '${code}' must be 7 characters`);
        assert(serverInstance.rooms.has(code), `Server rooms map must contain '${code}'`);
      }
    });

    await runTest('HTTP /ping dynamically reflects exactly 30 active rooms', async () => {
      const res = await httpGet(`http://localhost:${port}/ping`);
      assertEqual(res.json?.rooms, 30);
    });

    await runTest('Joining non-existent rooms with diverse adversarial inputs fails gracefully', async () => {
      const adversary = await createClient(port);
      const testCases = [
        'BW-0000',
        'BW-9999',
        '',
        '   ',
        '../../evil/path',
        'BW-!@#$%^',
        'A'.repeat(5000),
      ];

      for (const badCode of testCases) {
        const errPkt = await sendAndAwaitPacket(adversary, {
          type: 'ROOM_JOIN',
          payload: { roomCode: badCode, playerName: 'Rogue' },
        }, 'ERROR');
        assertEqual(errPkt.payload.code, 'ROOM_NOT_FOUND', `Expected ROOM_NOT_FOUND for input: '${badCode.slice(0, 20)}'`);
      }
      adversary.terminate();
    });

    await runTest('12 concurrent guests join a single room; server broadcasts snapshot & peer joins', async () => {
      const targetRoomCode = Array.from(createdCodes)[0];
      const guests = await Promise.all(
        Array.from({ length: 12 }, () => createClient(port))
      );

      const joinPromises = guests.map((ws, i) =>
        sendAndAwaitPacket(ws, {
          type: 'ROOM_JOIN',
          payload: { roomCode: targetRoomCode, playerName: `Guest_${i}` },
        }, 'ROOM_JOINED')
      );

      const results = await Promise.all(joinPromises);
      assertEqual(results.length, 12);

      const room = serverInstance.rooms.get(targetRoomCode);
      // 1 host + 12 guests = 13 clients
      assertEqual(room.clients.size, 13, 'Room must contain exactly 13 clients (1 host + 12 guests)');

      for (const res of results) {
        assertEqual(res.payload.roomCode, targetRoomCode);
        assert(Array.isArray(res.payload.clients), 'Snapshot must include clients array');
        assert(res.payload.clients.length >= 1, 'Clients array must be populated');
      }

      // Cleanup the 12 guests
      for (const g of guests) g.terminate();
      await new Promise(r => setTimeout(r, 80));
      assertEqual(room.clients.size, 1, 'Room should return to 1 client after guests terminate');
    });

    await runTest('Host termination causes automatic host migration when guests remain', async () => {
      const testHost = await createClient(port);
      const hostRoom = await sendAndAwaitPacket(testHost, {
        type: 'ROOM_CREATE',
        payload: { format: '2v2', map: 'colosseum', hostName: 'OriginalHost' },
      }, 'ROOM_CREATED');

      const roomCode = hostRoom.payload.roomCode;
      const originalHostId = hostRoom.payload.hostId;

      const guest1 = await createClient(port);
      const guestJoin = await sendAndAwaitPacket(guest1, {
        type: 'ROOM_JOIN',
        payload: { roomCode, playerName: 'GuestOne' },
      }, 'ROOM_JOINED');
      const guestId = guestJoin.payload.clientId;

      // Listen for HOST_MIGRATED on guest1
      const migrationPromise = awaitPacket(guest1, 'HOST_MIGRATED');

      // Host terminates
      testHost.terminate();

      const migration = await migrationPromise;
      assertEqual(migration.payload.newHostId, guestId, 'GuestOne must become the new host');

      const room = serverInstance.rooms.get(roomCode);
      assert(room !== undefined, 'Room must still exist after host migration');
      assertEqual(room.hostId, guestId, 'Server room hostId must be updated to new host');

      // Cleanup
      guest1.terminate();
      await new Promise(r => setTimeout(r, 80));
      assert(!serverInstance.rooms.has(roomCode), 'Room must be destroyed after last peer terminates');
    });

    await runTest('Single host terminates; server automatically tears down room completely', async () => {
      const soloHost = await createClient(port);
      const soloRoom = await sendAndAwaitPacket(soloHost, {
        type: 'ROOM_CREATE',
        payload: { format: '1v1', map: 'colosseum' },
      }, 'ROOM_CREATED');

      const code = soloRoom.payload.roomCode;
      assert(serverInstance.rooms.has(code), 'Room must exist initially');

      soloHost.terminate();
      await new Promise(r => setTimeout(r, 80));

      assert(!serverInstance.rooms.has(code), `Room ${code} must be deleted from rooms map`);
    });

    await runTest('Clean up all 30 initial concurrent clients and verify rooms map drains to 0', async () => {
      for (const ws of concurrentClients) {
        ws.terminate();
      }
      await new Promise(r => setTimeout(r, 150));
      assertEqual(serverInstance.rooms.size, 0, 'All rooms must be cleared');

      const ping = await httpGet(`http://localhost:${port}/ping`);
      assertEqual(ping.json?.rooms, 0, '/ping must report 0 rooms');
    });

    // ========================================================================
    // Dimension 3: Invalid Packet Handling, Fuzzing & Server Crash Resistance
    // ========================================================================
    console.log('\n► Dimension 3: Invalid Packet Handling, Fuzzing & Server Crash Resistance');

    let fuzzClient = null;

    await runTest('Connect fuzzing client and establish active room', async () => {
      fuzzClient = await createClient(port);
      await sendAndAwaitPacket(fuzzClient, {
        type: 'ROOM_CREATE',
        payload: { format: '4v4', map: 'speedway' },
      }, 'ROOM_CREATED');
      assert(fuzzClient.readyState === WebSocket.OPEN);
    });

    await runTest('Server rejects truncated JSON with structured ERROR and remains alive', async () => {
      const err = await sendAndAwaitPacket(fuzzClient, '{"type": "BLOCK_PLACE"', 'ERROR');
      assertEqual(err.payload.message, 'Invalid JSON packet');
      assert(fuzzClient.readyState === WebSocket.OPEN, 'Socket must remain open after malformed JSON');
    });

    await runTest('Server rejects random non-JSON strings with structured ERROR', async () => {
      const err = await sendAndAwaitPacket(fuzzClient, '<<<NOT_JSON_AT_ALL>>>!@#$%', 'ERROR');
      assertEqual(err.payload.message, 'Invalid JSON packet');
    });

    await runTest('Server rejects binary buffer fuzz data with structured ERROR without crash', async () => {
      const randomBuffer = crypto.randomBytes(512);
      const errPromise = awaitPacket(fuzzClient, 'ERROR');
      fuzzClient.send(randomBuffer);
      const err = await errPromise;
      assertEqual(err.payload.message, 'Invalid JSON packet');
    });

    await runTest('Server ignores primitive JSON values (number, boolean, null, array) without crash', async () => {
      const primitives = ['12345', 'true', 'false', 'null', '["array", "values"]'];
      for (const p of primitives) {
        fuzzClient.send(p);
      }
      // Send a valid PING to ensure event loop is functioning normally
      const pong = await sendAndAwaitPacket(fuzzClient, { type: 'PING' }, 'PONG');
      assertEqual(pong.type, 'PONG');
    });

    await runTest('Server ignores empty or typeless object packets without crash', async () => {
      fuzzClient.send(JSON.stringify({}));
      fuzzClient.send(JSON.stringify({ type: null }));
      fuzzClient.send(JSON.stringify({ type: '' }));
      fuzzClient.send(JSON.stringify({ type: 1234 }));
      fuzzClient.send(JSON.stringify({ payload: { foo: 'bar' } }));

      const pong = await sendAndAwaitPacket(fuzzClient, { type: 'PING' }, 'PONG');
      assertEqual(pong.type, 'PONG');
    });

    await runTest('Server withstands prototype pollution attempt without mutating Object.prototype', async () => {
      fuzzClient.send(JSON.stringify({
        type: '__proto__',
        payload: { polluted: true },
      }));
      fuzzClient.send(JSON.stringify({
        type: 'constructor',
        payload: { prototype: { polluted: true } },
      }));

      await new Promise(r => setTimeout(r, 50));
      assertEqual(({}).polluted, undefined, 'Object.prototype must not be polluted');
    });

    await runTest('Server withstands out-of-bounds, NaN, and negative coordinates across game packets', async () => {
      const adversarialPackets = [
        // Out of bounds coordinates
        { type: 'BLOCK_PLACE', payload: { x: NaN, y: Infinity, z: -Infinity, blockType: null } },
        { type: 'BLOCK_PLACE', payload: { x: 1e12, y: -1e12, z: 999999999999, blockType: 1 } },
        { type: 'BLOCK_PLACE', payload: { x: 'invalid', y: [1, 2], z: { nested: true } } },
        { type: 'BLOCK_PLACE', payload: null },
        { type: 'BLOCK_BREAK', payload: { x: NaN, y: 1e15, z: -1e15 } },
        { type: 'PLAYER_TRANSFORM', payload: { x: NaN, y: Infinity, z: -Infinity, yaw: NaN, pitch: NaN } },
        { type: 'PLAYER_DAMAGE', payload: { targetId: null, amount: -999999 } },
        { type: 'PLAYER_DAMAGE', payload: { targetId: '', amount: Infinity } },
        { type: 'BED_DESTROY', payload: { team: 12345 } },
        { type: 'BED_DESTROY', payload: null },
        { type: 'MUTATION_SYNC', payload: { activeMutations: null } },
      ];

      for (const pkt of adversarialPackets) {
        fuzzClient.send(JSON.stringify(pkt));
      }

      // Verify server is completely healthy and responsive
      const pong = await sendAndAwaitPacket(fuzzClient, { type: 'PING' }, 'PONG');
      assertEqual(pong.type, 'PONG');
      const ping = await httpGet(`http://localhost:${port}/ping`);
      assertEqual(ping.statusCode, 200);
      assertEqual(ping.json?.status, 'ok');
    });

    await runTest('Server withstands oversized 100 KB payload without event loop blockage', async () => {
      const largeText = 'A'.repeat(100 * 1024);
      fuzzClient.send(JSON.stringify({
        type: 'CHAT_MESSAGE',
        payload: { text: largeText },
      }));

      const pong = await sendAndAwaitPacket(fuzzClient, { type: 'PING' }, 'PONG');
      assertEqual(pong.type, 'PONG');
    });

    fuzzClient.terminate();
    await new Promise(r => setTimeout(r, 80));

    // ========================================================================
    // Dimension 4: High-Throughput Packet Bursts
    // ========================================================================
    console.log('\n► Dimension 4: High-Throughput Packet Bursts (Stress & Relay)');

    await runTest('Burst of 500 packets across 5 concurrent clients relays seamlessly without packet drop or lag', async () => {
      const host = await createClient(port);
      const hostRoom = await sendAndAwaitPacket(host, {
        type: 'ROOM_CREATE',
        payload: { format: '4v4', map: 'speedway', hostName: 'BurstHost' },
      }, 'ROOM_CREATED');
      const burstRoomCode = hostRoom.payload.roomCode;

      // Connect 4 guests
      const guests = await Promise.all(
        Array.from({ length: 4 }, () => createClient(port))
      );

      for (let i = 0; i < guests.length; i++) {
        await sendAndAwaitPacket(guests[i], {
          type: 'ROOM_JOIN',
          payload: { roomCode: burstRoomCode, playerName: `BurstGuest_${i}` },
        }, 'ROOM_JOINED');
      }

      // Count received packets on guest 0
      let receivedTransforms = 0;
      let receivedBlocks = 0;
      let receivedDamages = 0;

      guests[0].on('message', (data) => {
        try {
          const p = JSON.parse(data.toString());
          if (p.type === 'PLAYER_TRANSFORM') receivedTransforms++;
          if (p.type === 'BLOCK_PLACE') receivedBlocks++;
          if (p.type === 'PLAYER_DAMAGE') receivedDamages++;
        } catch (e) {}
      });

      const TOTAL_TRANSFORMS = 250;
      const TOTAL_BLOCKS = 150;
      const TOTAL_DAMAGES = 100;
      const TOTAL_PACKETS = TOTAL_TRANSFORMS + TOTAL_BLOCKS + TOTAL_DAMAGES; // 500 packets

      const burstStartTime = Date.now();

      // Send 500 packets in rapid succession from host
      for (let i = 0; i < TOTAL_TRANSFORMS; i++) {
        host.send(JSON.stringify({
          type: 'PLAYER_TRANSFORM',
          sender: hostRoom.payload.hostId,
          timestamp: Date.now(),
          payload: { x: 10 + i * 0.1, y: 64, z: 20 - i * 0.05, yaw: i * 0.02, pitch: 0 },
        }));
      }

      for (let i = 0; i < TOTAL_BLOCKS; i++) {
        host.send(JSON.stringify({
          type: 'BLOCK_PLACE',
          sender: hostRoom.payload.hostId,
          timestamp: Date.now(),
          payload: { x: 50 + i, y: 10, z: 50, blockType: BLOCK_TYPES.WOOL_RED },
        }));
      }

      for (let i = 0; i < TOTAL_DAMAGES; i++) {
        host.send(JSON.stringify({
          type: 'PLAYER_DAMAGE',
          sender: hostRoom.payload.hostId,
          timestamp: Date.now(),
          payload: { targetId: 'BurstGuest_0', amount: 2.5 },
        }));
      }

      // Await processing of all packets on guest 0
      const pollStart = Date.now();
      while (
        (receivedTransforms < TOTAL_TRANSFORMS ||
         receivedBlocks < TOTAL_BLOCKS ||
         receivedDamages < TOTAL_DAMAGES) &&
        Date.now() - pollStart < 4000
      ) {
        await new Promise(r => setTimeout(r, 20));
      }

      const burstDuration = Date.now() - burstStartTime;
      const rate = Math.round((TOTAL_PACKETS / (burstDuration / 1000)));

      console.log(`     Processed ${TOTAL_PACKETS} packets in ${burstDuration}ms (~${rate} packets/sec)`);
      console.log(`     Guest 0 received: ${receivedTransforms} transforms, ${receivedBlocks} blocks, ${receivedDamages} damages`);

      assertEqual(receivedTransforms, TOTAL_TRANSFORMS, 'All 250 transforms must be relayed');
      assertEqual(receivedBlocks, TOTAL_BLOCKS, 'All 150 block placements must be relayed');
      assertEqual(receivedDamages, TOTAL_DAMAGES, 'All 100 damage packets must be relayed');

      // Verify server retains all placed blocks in room worldBlocks map
      const room = serverInstance.rooms.get(burstRoomCode);
      assertEqual(room.worldBlocks.size, TOTAL_BLOCKS, 'Room snapshot must retain all placed blocks');

      // Check /ping responds immediately during/after burst
      const ping = await httpGet(`http://localhost:${port}/ping`);
      assertEqual(ping.statusCode, 200);
      assertEqual(ping.json?.rooms, 1);

      // Teardown
      host.terminate();
      for (const g of guests) g.terminate();
      await new Promise(r => setTimeout(r, 100));
      assertEqual(serverInstance.rooms.size, 0, 'Room must be cleaned up');
    });

    await runTest('Concurrent join/leave churn under active packet flood does not cause unhandled socket errors', async () => {
      const host = await createClient(port);
      const hostRoom = await sendAndAwaitPacket(host, {
        type: 'ROOM_CREATE',
        payload: { format: '4v4', map: 'speedway', hostName: 'ChurnHost' },
      }, 'ROOM_CREATED');
      const churnRoomCode = hostRoom.payload.roomCode;

      let floodActive = true;
      let packetsSent = 0;

      // Start asynchronous background packet flood from host
      const floodPromise = (async () => {
        while (floodActive && packetsSent < 400) {
          packetsSent++;
          host.send(JSON.stringify({
            type: 'PLAYER_TRANSFORM',
            sender: hostRoom.payload.hostId,
            timestamp: Date.now(),
            payload: { x: packetsSent, y: 64, z: 0 },
          }));
          await new Promise(r => setTimeout(r, 1));
        }
      })();

      // Rapidly join and disconnect 8 clients concurrently mid-flood
      const churners = await Promise.all(
        Array.from({ length: 8 }, async (_, i) => {
          const client = await createClient(port);
          await sendAndAwaitPacket(client, {
            type: 'ROOM_JOIN',
            payload: { roomCode: churnRoomCode, playerName: `Churn_${i}` },
          }, 'ROOM_JOINED');
          // Wait briefly, receive a few packets, then abruptly terminate
          await new Promise(r => setTimeout(r, 15));
          client.terminate();
          return client;
        })
      );

      floodActive = false;
      await floodPromise;

      console.log(`     Transmitted ${packetsSent} packets during 8-client concurrent join/leave churn`);
      host.terminate();
      await new Promise(r => setTimeout(r, 100));
      assertEqual(serverInstance.rooms.size, 0, 'Room drained cleanly after churn');
    });

    await runTest('Rapid creation and deletion of 50 ephemeral rooms in succession drains cleanly to 0', async () => {
      for (let i = 0; i < 50; i++) {
        const client = await createClient(port);
        const res = await sendAndAwaitPacket(client, {
          type: 'ROOM_CREATE',
          payload: { format: '1v1', map: 'colosseum' },
        }, 'ROOM_CREATED');
        assert(res.payload.roomCode.startsWith('BW-'));
        client.terminate();
      }
      await new Promise(r => setTimeout(r, 150));
      assertEqual(serverInstance.rooms.size, 0, 'All 50 ephemeral rooms must be deleted');
      const ping = await httpGet(`http://localhost:${port}/ping`);
      assertEqual(ping.json?.rooms, 0, '/ping confirms 0 rooms remaining');
    });

  } finally {
    if (serverInstance) {
      await serverInstance.close();
      console.log('\nServer instance cleanly shut down.');
    }
  }

  // ========================================================================
  // Final Challenger Verdict Summary
  // ========================================================================
  console.log('\n╔══════════════════════════════════════════════════════════════════════╗');
  console.log(`║   CHALLENGER SUITE SUMMARY: ${passed} PASSED / ${failed} FAILED                 ║`);
  console.log('╚══════════════════════════════════════════════════════════════════════╝');

  if (failed > 0) {
    console.error(`\n❌ ${failed} ADVERSARIAL STRESS TEST(S) FAILED:`);
    failures.forEach((f, idx) => {
      console.error(`  ${idx + 1}. ${f.name}`);
      console.error(`     -> ${f.error.message}`);
    });
    process.exit(1);
  } else {
    console.log(`\n🎉 ALL ${passed} ADVERSARIAL STRESS TESTS PASSED WITH 100% SUCCESS!`);
    process.exit(0);
  }
}

runAdversarialSuite();
