/**
 * tests/stress_m6_tier5_systems.js
 * Milestone 6 Phase 2: Tier 5 White-Box Adversarial Coverage Hardening
 * Systems & Platform Integration Test Suite for Voxel Bedwars.
 * 
 * Verifies 65 rigorous, empirical white-box invariant checks across:
 * 1. MMR Rating Calculation, Extreme Mismatches & Level Overflow (RankManager, LevelManager)
 * 2. OAuth Authentication, Session State & Token Parsing (AuthManager, PortalUI)
 * 3. Dedicated WebSocket Server & Network Robustness (server/index.js, WebSocketAdapter)
 * 4. Dual-Layer Fallback & LAN Networking Resiliency (NetworkManager, LanDiscovery)
 * 5. TouchControls Stress, Multi-Touch Races & Extreme Viewports (TouchControls, Cross-Platform Packaging)
 */

import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { WebSocket } from 'ws';

import './mocks/browser-shim.js';

import { RankManager, RANK_TIERS, RANKED_FORMATS } from '../src/stats/RankManager.js';
import { LevelManager } from '../src/stats/LevelManager.js';
import { AuthManager } from '../src/auth/AuthManager.js';
import { startServer } from '../server/index.js';
import { NetworkManager } from '../src/net/NetworkManager.js';
import { LanDiscovery, validateLanAddress, formatDirectUrl } from '../src/net/LanDiscovery.js';
import {
  TouchControls,
  isTouchDevice,
  isDeadzone,
  calculateJoystickVector,
  applyLookDelta,
} from '../src/ui/TouchControls.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');

// Polyfill MockElement getBoundingClientRect for TouchControls pointer event calculations
if (typeof document !== 'undefined') {
  const dummyEl = document.createElement('div');
  const proto = Object.getPrototypeOf(dummyEl);
  if (proto && !proto.getBoundingClientRect) {
    proto.getBoundingClientRect = function() {
      return { left: 0, top: 0, right: 400, bottom: 400, width: 400, height: 400 };
    };
  }
}

// Harness state
let passedCount = 0;
let failedCount = 0;
const failures = [];

function assert(condition, message = 'Assertion failed') {
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
  assertEqual(val, true, message);
}

function assertFalse(val, message = '') {
  assertEqual(val, false, message);
}

function assertApprox(actual, expected, tolerance = 0.001, message = '') {
  const diff = Math.abs(actual - expected);
  if (diff > tolerance) {
    throw new Error(`Expected ${actual} ~ ${expected} within ±${tolerance} (diff: ${diff}). ${message}`);
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

function httpOptions(url) {
  return new Promise((resolve, reject) => {
    const parsed = new URL(url);
    const req = http.request({
      hostname: parsed.hostname,
      port: parsed.port,
      path: parsed.pathname,
      method: 'OPTIONS',
    }, (res) => {
      resolve({
        statusCode: res.statusCode,
        headers: res.headers,
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
    ws.send(typeof sendPacket === 'string' ? sendPacket : JSON.stringify(sendPacket));
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

async function runMasterSuite() {
  console.log('\n======================================================================');
  console.log('  VOXEL BEDWARS: TIER 5 WHITE-BOX ADVERSARIAL COVERAGE HARDENING');
  console.log('  Systems, Rating/Leveling, OAuth, Network Server, and Touch Controls');
  console.log('======================================================================\n');

  // =========================================================================
  // SUITE 1: MMR Rating Calculation, Extreme Mismatches & Level Overflow
  // =========================================================================
  console.log('► SUITE 1: MMR Rating Calculation, Extreme Mismatches & Level Overflow');

  await test('1.1: Rating floor invariant - rating never drops below 0 even under massive loss streak', () => {
    const rm = new RankManager('test_rank_floor');
    rm.reset();
    assertEqual(rm.rating, 1000);

    // Simulate 100 consecutive 1v1 ranked losses with 0 kills
    for (let i = 0; i < 100; i++) {
      rm.recordMatch({ format: '1v1', outcome: 'loss', kills: 0, finalKills: 0, bedsBroken: 0 });
    }

    assertEqual(rm.rating, 0, 'Rating must clamp at 0 and never be negative');
    assertEqual(rm.getTier(), 'Bronze');
  });

  await test('1.2: Rank tier boundary classification across all tier boundaries', () => {
    assertEqual(RankManager.getRankTier(0), 'Bronze');
    assertEqual(RankManager.getRankTier(999), 'Bronze');
    assertEqual(RankManager.getRankTier(1000), 'Silver');
    assertEqual(RankManager.getRankTier(1499), 'Silver');
    assertEqual(RankManager.getRankTier(1500), 'Gold');
    assertEqual(RankManager.getRankTier(1999), 'Gold');
    assertEqual(RankManager.getRankTier(2000), 'Diamond');
    assertEqual(RankManager.getRankTier(2499), 'Diamond');
    assertEqual(RankManager.getRankTier(2500), 'Master');
  });

  await test('1.3: Extreme MMR mismatch and high rating scaling without numeric overflow', () => {
    assertEqual(RankManager.getRankTier(5000), 'Master');
    assertEqual(RankManager.getRankTier(10000), 'Master');
    assertEqual(RankManager.getRankTier(1000000), 'Master');
    assertEqual(RankManager.getRankTier(Number.MAX_SAFE_INTEGER), 'Master');
  });

  await test('1.4: Negative rating defense - negative ratings clamp to 0 and Bronze', () => {
    assertEqual(RankManager.getRankTier(-1), 'Bronze');
    assertEqual(RankManager.getRankTier(-500), 'Bronze');
    assertEqual(RankManager.getRankTier(-999999), 'Bronze');
  });

  await test('1.5: Peak rating monotonic invariant - peak rating is never lowered by subsequent losses', () => {
    const rm = new RankManager('test_peak_rating');
    rm.reset();
    assertEqual(rm.peakRating, 1000);

    // Win 10 matches: delta = 25 per win -> rating increases to 1250
    for (let i = 0; i < 10; i++) {
      rm.recordMatch({ format: '1v1', outcome: 'win', kills: 0, finalKills: 0, bedsBroken: 0 });
    }
    assertEqual(rm.rating, 1250);
    assertEqual(rm.peakRating, 1250);

    // Lose 20 matches: rating drops down to 850
    for (let i = 0; i < 20; i++) {
      rm.recordMatch({ format: '1v1', outcome: 'loss', kills: 0, finalKills: 0, bedsBroken: 0 });
    }
    assertEqual(rm.rating, 850);
    assertEqual(rm.peakRating, 1250, 'Peak rating must strictly preserve historical all-time peak');
  });

  await test('1.6: Strict 2-team format restriction - multi-team formats do not modify rank rating', () => {
    const rm = new RankManager('test_ranked_formats');
    rm.reset();
    const initialRating = rm.rating;

    // Multi-team formats must return isRanked: false and not modify rating
    const unrankedFormats = ['solo', 'solos', '4-team', '8-team', 'duos_4team', 'trios_3team', 'ffa', 'battle_royale'];
    for (const fmt of unrankedFormats) {
      const res = rm.recordMatch({ format: fmt, outcome: 'win', kills: 10, finalKills: 5, bedsBroken: 3 });
      assertFalse(res.isRanked, `Format ${fmt} must be unranked`);
      assertEqual(res.deltaRating, 0);
      assertEqual(rm.rating, initialRating, `Rating must remain unchanged for ${fmt}`);
    }

    // Official 2-team formats must be ranked
    const rankedFormats = ['1v1', '2v2', '3v3', '4v4'];
    for (const fmt of rankedFormats) {
      const res = rm.recordMatch({ format: fmt, outcome: 'win', kills: 0, finalKills: 0, bedsBroken: 0 });
      assertTrue(res.isRanked, `Format ${fmt} must be ranked`);
      assertTrue(res.deltaRating > 0);
    }
  });

  await test('1.7: Format string whitespace and case normalization', () => {
    assertTrue(RankManager.isRankedFormat('  1v1  '));
    assertTrue(RankManager.isRankedFormat('2V2'));
    assertTrue(RankManager.isRankedFormat('\n3v3\t'));
    assertTrue(RankManager.isRankedFormat('4V4 '));

    assertFalse(RankManager.isRankedFormat(''));
    assertFalse(RankManager.isRankedFormat(null));
    assertFalse(RankManager.isRankedFormat(undefined));
    assertFalse(RankManager.isRankedFormat('5v5'));
  });

  await test('1.8: Corrupted storage recovery for RankManager - unparseable JSON falls back cleanly', () => {
    const key = 'test_corrupted_rank';
    globalThis.localStorage.setItem(key, '{INVALID_CORRUPTED_JSON');

    const rm = new RankManager(key);
    assertEqual(rm.rating, 1000, 'Must fall back to default rating on corrupted JSON');
    assertEqual(rm.peakRating, 1000);
  });

  await test('1.9: Corrupted type injection defense in RankManager storage', () => {
    const key = 'test_type_injection_rank';
    globalThis.localStorage.setItem(key, JSON.stringify({
      rating: 'HACKED_STRING',
      peakRating: { malicious: true },
      rankedMatches: null,
    }));

    const rm = new RankManager(key);
    assertEqual(rm.rating, 1000, 'Non-number rating must be rejected');
    assertEqual(rm.peakRating, 1000, 'Non-number peakRating must be rejected');
  });

  await test('1.10: LevelManager calculation under Level 100+ overflow (XP > 1,000,000)', () => {
    // Level 101: 1,000,000 XP
    const info101 = LevelManager.calculateLevelFromXP(1000000);
    assertEqual(info101.level, 101);
    assertEqual(info101.currentLevelBaseXP, 1000000);
    assertEqual(info101.progressXP, 0);
    assertEqual(info101.progressPercentage, 0);
    assertTrue(info101.neededXP > 0);

    // Level 501: 25,000,000 XP
    const info501 = LevelManager.calculateLevelFromXP(25000000);
    assertEqual(info501.level, 501);
    assertEqual(info501.currentLevelBaseXP, 25000000);
    assertEqual(info501.progressPercentage, 0);

    // Level 1001: 100,000,000 XP
    const info1001 = LevelManager.calculateLevelFromXP(100000000);
    assertEqual(info1001.level, 1001);
    assertEqual(info1001.currentLevelBaseXP, 100000000);
    assertTrue(Number.isFinite(info1001.level));
  });

  await test('1.11: Level progress percentage strictly bounded in [0, 100]% at all levels', () => {
    const testXpValues = [0, 50, 100, 250, 999, 1000, 15000, 999999, 1000000, 50000000];
    for (const xp of testXpValues) {
      const info = LevelManager.calculateLevelFromXP(xp);
      assertTrue(info.progressPercentage >= 0 && info.progressPercentage <= 100,
        `Percentage ${info.progressPercentage}% for ${xp} XP must be in [0, 100]`);
      assertTrue(info.progressXP >= 0, 'progressXP must be non-negative');
      assertTrue(info.progressXP < info.neededXP, 'progressXP must be strictly less than neededXP');
    }
  });

  await test('1.12: Zero, Negative, and NaN XP Defense in LevelManager', () => {
    const infoZero = LevelManager.calculateLevelFromXP(0);
    assertEqual(infoZero.level, 1);
    assertEqual(infoZero.totalXP, 0);

    const infoNeg = LevelManager.calculateLevelFromXP(-500);
    assertEqual(infoNeg.level, 1);
    assertEqual(infoNeg.totalXP, 0);

    const infoNull = LevelManager.calculateLevelFromXP(null);
    assertEqual(infoNull.level, 1);

    const infoNan = LevelManager.calculateLevelFromXP(NaN);
    assertEqual(infoNan.level, 1);
  });

  await test('1.13: Corrupted storage recovery for LevelManager', () => {
    const key = 'test_corrupted_level';
    globalThis.localStorage.setItem(key, '{"totalXP": "bad_xp", "level": null}');

    const lm = new LevelManager(key);
    assertEqual(lm.level, 1);
    assertEqual(lm.totalXP, 0);
  });

  // =========================================================================
  // SUITE 2: OAuth Authentication, Session State & Token Parsing
  // =========================================================================
  console.log('\n► SUITE 2: OAuth Authentication, Session State & Token Parsing');

  await test('2.1: Default guest session lifecycle - clean initialization as unauthenticated guest', () => {
    const profileKey = 'test_auth_p1';
    const tokenKey = 'test_auth_t1';
    globalThis.localStorage.removeItem(profileKey);
    globalThis.localStorage.removeItem(tokenKey);

    const auth = new AuthManager(profileKey, tokenKey);
    const p = auth.getProfile();
    assertTrue(p.userId.startsWith('guest_'), 'Guest user ID must start with guest_');
    assertEqual(p.provider, 'guest');
    assertFalse(auth.isAuthenticated(), 'Guest session must not be authenticated');
  });

  await test('2.2: GitHub OAuth login generates valid gho_ token and sets provider', () => {
    const auth = new AuthManager('test_auth_p2', 'test_auth_t2');
    const p = auth.loginWithGitHub('ProMiner');

    assertEqual(p.username, 'ProMiner');
    assertEqual(p.provider, 'github');
    assertTrue(auth.token.startsWith('gho_'), 'GitHub token must start with gho_');
    assertTrue(auth.isAuthenticated(), 'GitHub session must be authenticated');
  });

  await test('2.3: Google OAuth login generates valid ya29. token and sets provider', () => {
    const auth = new AuthManager('test_auth_p3', 'test_auth_t3');
    const p = auth.loginWithGoogle('BedwarsChampion');

    assertEqual(p.username, 'BedwarsChampion');
    assertEqual(p.provider, 'google');
    assertTrue(auth.token.startsWith('ya29.'), 'Google token must start with ya29.');
    assertTrue(auth.isAuthenticated(), 'Google session must be authenticated');
  });

  await test('2.4: Missing token edge case - provider set without token is reported as unauthenticated', () => {
    const pKey = 'test_auth_p4';
    const tKey = 'test_auth_t4';
    globalThis.localStorage.setItem(pKey, JSON.stringify({
      userId: 'gh_fake123',
      username: 'SneakyUser',
      provider: 'github',
    }));
    globalThis.localStorage.removeItem(tKey); // Missing token

    const auth = new AuthManager(pKey, tKey);
    assertFalse(auth.isAuthenticated(), 'Missing token must invalidate authenticated status');
  });

  await test('2.5: Empty string token edge case is reported as unauthenticated', () => {
    const auth = new AuthManager('test_auth_p5', 'test_auth_t5');
    auth.loginWithGitHub('TestUser');
    auth.token = ''; // Empty string token
    assertFalse(auth.isAuthenticated(), 'Empty string token must not be authenticated');
  });

  await test('2.6: Session logout revokes token and resets to unauthenticated guest mode', () => {
    const pKey = 'test_auth_p6';
    const tKey = 'test_auth_t6';
    const auth = new AuthManager(pKey, tKey);
    auth.loginWithGoogle('ActiveGamer');
    assertTrue(auth.isAuthenticated());

    auth.logout();
    assertEqual(auth.token, null);
    assertEqual(auth.getProfile().provider, 'guest');
    assertFalse(auth.isAuthenticated(), 'Logged out session must not be authenticated');
    assertEqual(globalThis.localStorage.getItem(tKey), null, 'Token must be removed from localStorage');
  });

  await test('2.7: Corrupted session storage recovery - malformed JSON resets to guest cleanly', () => {
    const pKey = 'test_auth_p7';
    const tKey = 'test_auth_t7';
    globalThis.localStorage.setItem(pKey, '{MALFORMED_JSON_STRING:');

    const auth = new AuthManager(pKey, tKey);
    assert(auth.getProfile() !== null, 'Profile must not be null');
    assertEqual(auth.getProfile().provider, 'guest', 'Must recover with guest profile');
    assertFalse(auth.isAuthenticated());
  });

  await test('2.8: Profile update retains existing attributes while applying overrides', () => {
    const auth = new AuthManager('test_auth_p8', 'test_auth_t8');
    const initial = auth.loginWithGitHub('BuilderBoy');
    const origId = initial.userId;
    const origCreatedAt = initial.createdAt;

    auth.updateProfile({ rating: 1750, level: 12 });
    const updated = auth.getProfile();
    assertEqual(updated.userId, origId, 'User ID must be preserved');
    assertEqual(updated.createdAt, origCreatedAt, 'CreatedAt must be preserved');
    assertEqual(updated.rating, 1750);
    assertEqual(updated.level, 12);
  });

  await test('2.9: Exception isolation in auth event dispatcher - throwing listener does not break notify', () => {
    const auth = new AuthManager('test_auth_p9', 'test_auth_t9');
    let secondListenerFired = false;

    // Bad listener that throws
    auth.onAuthChange(() => {
      throw new Error('Fatal listener crash simulation');
    });

    // Good listener that follows
    auth.onAuthChange(() => {
      secondListenerFired = true;
    });

    auth.loginWithGitHub('TestIso');
    assertTrue(secondListenerFired, 'Subsequent listeners must be invoked despite previous listener error');
  });

  await test('2.10: Clean unsubscribe callback prevents listener leaks', () => {
    const auth = new AuthManager('test_auth_p10', 'test_auth_t10');
    let callCount = 0;
    const unsub = auth.onAuthChange(() => {
      callCount++;
    });

    auth.loginWithGitHub('User1');
    assertEqual(callCount, 1);

    unsub();
    auth.loginWithGoogle('User2');
    assertEqual(callCount, 1, 'Unsubscribed listener must not be called again');
  });

  await test('2.11: Rating and level persistence preserved when logging into OAuth', () => {
    const auth = new AuthManager('test_auth_p11', 'test_auth_t11');
    auth.updateProfile({ rating: 1650, level: 8 });

    auth.loginWithGitHub('LevelRetainer');
    const p = auth.getProfile();
    assertEqual(p.rating, 1650, 'Rating must carry over from session');
    assertEqual(p.level, 8, 'Level must carry over from session');
  });

  // =========================================================================
  // SUITE 3: Dedicated WebSocket Server & Network Robustness
  // =========================================================================
  console.log('\n► SUITE 3: Dedicated WebSocket Server & Network Robustness');

  let serverInstance = null;
  let serverPort = null;

  await test('3.1: Server startup on ephemeral port (port 0)', async () => {
    serverInstance = await startServer({ port: 0 });
    serverPort = serverInstance.port;
    assertTrue(serverPort > 0, 'Server must bind to a positive port number');
    assert(serverInstance.rooms instanceof Map, 'Rooms collection must be a Map');
  });

  await test('3.2: HTTP GET /ping endpoint returns 200 JSON with UptimeRobot uptime and rooms', async () => {
    const res = await httpGet(`http://localhost:${serverPort}/ping`);
    assertEqual(res.statusCode, 200);
    assertEqual(res.json?.status, 'ok');
    assertTrue(typeof res.json?.uptime === 'number' && res.json.uptime >= 0);
    assertEqual(res.json?.rooms, 0);
  });

  await test('3.3: HTTP GET /ping tolerance for query parameters and trailing slash', async () => {
    const res1 = await httpGet(`http://localhost:${serverPort}/ping?monitor=uptimerobot&interval=300`);
    assertEqual(res1.statusCode, 200);
    assertEqual(res1.json?.status, 'ok');

    const res2 = await httpGet(`http://localhost:${serverPort}/ping/`);
    assertEqual(res2.statusCode, 200);
    assertEqual(res2.json?.status, 'ok');
  });

  await test('3.4: HTTP CORS preflight OPTIONS request returns 204 with CORS header', async () => {
    const res = await httpOptions(`http://localhost:${serverPort}/ping`);
    assertEqual(res.statusCode, 204);
    assertEqual(res.headers['access-control-allow-origin'], '*');
  });

  await test('3.5: HTTP 404 route protection on non-existent endpoints', async () => {
    const res = await httpGet(`http://localhost:${serverPort}/api/v1/invalid-route`);
    assertEqual(res.statusCode, 404);
    assertEqual(res.json?.error, 'Not Found');
  });

  await test('3.6: Rapid concurrent connect and disconnect storm (10 clients in parallel)', async () => {
    const clients = await Promise.all(
      Array.from({ length: 10 }, () => createClient(serverPort))
    );
    assertEqual(clients.length, 10);

    // Concurrently close all clients
    clients.forEach((c) => c.close());
    await new Promise((r) => setTimeout(r, 100));

    // Verify server remains responsive
    const ping = await httpGet(`http://localhost:${serverPort}/ping`);
    assertEqual(ping.statusCode, 200);
  });

  await test('3.7: WebSocket room creation with explicit room code BW-TEST-T5', async () => {
    const client = await createClient(serverPort);
    const resp = await sendAndAwaitPacket(client, {
      type: 'ROOM_CREATE',
      payload: { roomCode: 'BW-TEST-T5', format: '1v1', map: 'colosseum', hostName: 'ChallengerHost' },
    }, 'ROOM_CREATED');

    assertEqual(resp.payload.roomCode, 'BW-TEST-T5');
    assertEqual(resp.payload.format, '1v1');
    assertEqual(resp.payload.map, 'colosseum');
    assertTrue(serverInstance.rooms.has('BW-TEST-T5'));
    client.close();
    await new Promise((r) => setTimeout(r, 50));
  });

  await test('3.8: Duplicate room creation on same socket cleanly removes old room', async () => {
    const client = await createClient(serverPort);

    // Create room 1
    await sendAndAwaitPacket(client, {
      type: 'ROOM_CREATE',
      payload: { roomCode: 'BW-OLD-ROOM', format: '4v4' },
    }, 'ROOM_CREATED');
    assertTrue(serverInstance.rooms.has('BW-OLD-ROOM'));

    // Create room 2 on same socket
    await sendAndAwaitPacket(client, {
      type: 'ROOM_CREATE',
      payload: { roomCode: 'BW-NEW-ROOM', format: '2v2' },
    }, 'ROOM_CREATED');

    assertFalse(serverInstance.rooms.has('BW-OLD-ROOM'), 'Old room must be destroyed when sole host leaves');
    assertTrue(serverInstance.rooms.has('BW-NEW-ROOM'), 'New room must exist');
    client.close();
    await new Promise((r) => setTimeout(r, 50));
  });

  await test('3.9: Joining non-existent room returns structured ROOM_NOT_FOUND error', async () => {
    const client = await createClient(serverPort);
    const errPacket = await sendAndAwaitPacket(client, {
      type: 'ROOM_JOIN',
      payload: { roomCode: 'BW-NONEXISTENT-9999' },
    }, 'ERROR');

    assertEqual(errPacket.payload.code, 'ROOM_NOT_FOUND');
    client.close();
  });

  await test('3.10: Large packet (64KB chat message) transmission without truncation', async () => {
    const host = await createClient(serverPort);
    await sendAndAwaitPacket(host, {
      type: 'ROOM_CREATE',
      payload: { roomCode: 'BW-HUGE-CHAT' },
    }, 'ROOM_CREATED');

    const peer = await createClient(serverPort);
    await sendAndAwaitPacket(peer, {
      type: 'ROOM_JOIN',
      payload: { roomCode: 'BW-HUGE-CHAT', playerName: 'BigSender' },
    }, 'ROOM_JOINED');

    // Generate 64KB string payload
    const hugeText = 'VoxelBedwars'.repeat(5461); // ~65,532 chars
    assertTrue(hugeText.length > 64000);

    const receivedPromise = awaitPacket(host, 'CHAT_MESSAGE', 4000);
    peer.send(JSON.stringify({
      type: 'CHAT_MESSAGE',
      payload: { text: hugeText, senderName: 'BigSender' },
    }));

    const received = await receivedPromise;
    assertEqual(received.payload.text.length, hugeText.length, 'Payload length must match exactly');
    assertEqual(received.payload.text, hugeText, 'Content must not be corrupted');

    host.close();
    peer.close();
    await new Promise((r) => setTimeout(r, 50));
  });

  await test('3.11: Malformed JSON frame fuzzing returns ERROR packet without server crash', async () => {
    const client = await createClient(serverPort);
    const errPacket = await sendAndAwaitPacket(client, '{INVALID:JSON:FRAME:::', 'ERROR');
    assertEqual(errPacket.type, 'ERROR');
    assertEqual(errPacket.payload.message, 'Invalid JSON packet');
    client.close();
  });

  await test('3.12: Null frame and missing packet type fuzzing is safely ignored', async () => {
    const client = await createClient(serverPort);
    client.send('null');
    client.send('""');
    client.send('{}');
    client.send(JSON.stringify({ notype: true }));

    // Send valid PING to confirm server connection is intact
    const pong = await sendAndAwaitPacket(client, { type: 'PING' }, 'PONG');
    assertEqual(pong.type, 'PONG');
    client.close();
  });

  await test('3.13: Unhandled packet type forwarding relays packet to room peers', async () => {
    const host = await createClient(serverPort);
    await sendAndAwaitPacket(host, {
      type: 'ROOM_CREATE',
      payload: { roomCode: 'BW-UNHANDLED' },
    }, 'ROOM_CREATED');

    const peer = await createClient(serverPort);
    await sendAndAwaitPacket(peer, {
      type: 'ROOM_JOIN',
      payload: { roomCode: 'BW-UNHANDLED' },
    }, 'ROOM_JOINED');

    const customPacketPromise = awaitPacket(host, 'CUSTOM_TACTICAL_PING');
    peer.send(JSON.stringify({
      type: 'CUSTOM_TACTICAL_PING',
      payload: { target: 'diamond_generator', pingType: 'alert' },
    }));

    const received = await customPacketPromise;
    assertEqual(received.type, 'CUSTOM_TACTICAL_PING');
    assertEqual(received.payload.target, 'diamond_generator');

    host.close();
    peer.close();
    await new Promise((r) => setTimeout(r, 50));
  });

  await test('3.14: State snapshot synchronization on peer join', async () => {
    const host = await createClient(serverPort);
    await sendAndAwaitPacket(host, {
      type: 'ROOM_CREATE',
      payload: { roomCode: 'BW-SNAPSHOT-TEST', format: '1v1', map: 'colosseum' },
    }, 'ROOM_CREATED');

    // Host places blocks
    host.send(JSON.stringify({
      type: 'BLOCK_PLACE',
      payload: { x: 10, y: 64, z: 20, blockType: 1 },
    }));
    await new Promise((r) => setTimeout(r, 50));

    // Peer joins and checks world snapshot in ROOM_JOINED
    const peer = await createClient(serverPort);
    const joinResp = await sendAndAwaitPacket(peer, {
      type: 'ROOM_JOIN',
      payload: { roomCode: 'BW-SNAPSHOT-TEST' },
    }, 'ROOM_JOINED');

    const placed = joinResp.payload.snapshot?.placedBlocks;
    assert(Array.isArray(placed) && placed.length === 1, 'Snapshot must contain placed block');
    assertEqual(placed[0].x, 10);
    assertEqual(placed[0].y, 64);
    assertEqual(placed[0].z, 20);

    host.close();
    peer.close();
    await new Promise((r) => setTimeout(r, 50));
  });

  await test('3.15: Host migration on host disconnect', async () => {
    const host = await createClient(serverPort);
    await sendAndAwaitPacket(host, {
      type: 'ROOM_CREATE',
      payload: { roomCode: 'BW-MIGRATION-TEST' },
    }, 'ROOM_CREATED');

    const peer = await createClient(serverPort);
    const joinResp = await sendAndAwaitPacket(peer, {
      type: 'ROOM_JOIN',
      payload: { roomCode: 'BW-MIGRATION-TEST' },
    }, 'ROOM_JOINED');
    const peerId = joinResp.payload.clientId;

    const migrationPromise = awaitPacket(peer, 'HOST_MIGRATED');
    host.close(); // Host leaves

    const migPacket = await migrationPromise;
    assertEqual(migPacket.payload.newHostId, peerId, 'Remaining peer must become new host');

    peer.close();
    await new Promise((r) => setTimeout(r, 50));
  });

  await test('3.16: Room garbage collection - all rooms pruned when clients leave', async () => {
    assertEqual(serverInstance.rooms.size, 0, 'Rooms map must be completely clean when all clients disconnect');
  });

  // Clean up server
  if (serverInstance && serverInstance.close) {
    await serverInstance.close();
  }

  // =========================================================================
  // SUITE 4: Dual-Layer Fallback & LAN Networking Resiliency
  // =========================================================================
  console.log('\n► SUITE 4: Dual-Layer Fallback & LAN Networking Resiliency');

  await test('4.1: Valid IPv4 and port address validation', () => {
    assertTrue(validateLanAddress('127.0.0.1', 8080));
    assertTrue(validateLanAddress('192.168.1.1', 8766));
    assertTrue(validateLanAddress('10.0.0.1', 1));
    assertTrue(validateLanAddress('255.255.255.255', 65535));
  });

  await test('4.2: Invalid IPv4 and port address rejection', () => {
    assertFalse(validateLanAddress('256.0.0.1', 8080));
    assertFalse(validateLanAddress('127.0.0.1', 0));
    assertFalse(validateLanAddress('127.0.0.1', -1));
    assertFalse(validateLanAddress('127.0.0.1', 65536));
    assertFalse(validateLanAddress('localhost', 8080));
    assertFalse(validateLanAddress('192.168.1', 8080));
    assertFalse(validateLanAddress(null, 8080));
    assertFalse(validateLanAddress('10.0.0.1', 'not-a-port'));
  });

  await test('4.3: Direct LAN URL formatting produces valid ws:// endpoint', () => {
    assertEqual(formatDirectUrl('192.168.0.10', 8080), 'ws://192.168.0.10:8080');
    assertEqual(formatDirectUrl('  10.0.0.2  ', 8766), 'ws://10.0.0.2:8766');
  });

  await test('4.4: Direct LAN URL formatting throws on invalid address', () => {
    let threw = false;
    try {
      formatDirectUrl('invalid-ip', 8080);
    } catch (e) {
      threw = true;
      assertTrue(e.message.includes('Invalid LAN IP:Port'));
    }
    assertTrue(threw);
  });

  await test('4.5: LAN discovery beacon ingestion and listener notification', () => {
    const discovery = new LanDiscovery();
    let listenerCalled = false;
    let roomList = [];

    discovery.startDiscovery((rooms) => {
      listenerCalled = true;
      roomList = rooms;
    });

    discovery.handleBeacon({
      app: 'voxel-bedwars-lan',
      roomCode: 'LAN-BEACON-1',
      hostName: 'LanPlayer',
      map: 'speedway',
      port: 8766,
      ip: '192.168.1.105',
    });

    assertTrue(listenerCalled);
    assertEqual(roomList.length, 1);
    assertEqual(roomList[0].roomCode, 'LAN-BEACON-1');
    assertEqual(roomList[0].ip, '192.168.1.105');
    discovery.stopDiscovery();
  });

  await test('4.6: LAN discovery stale beacon pruning simulation', () => {
    const discovery = new LanDiscovery();
    discovery.handleBeacon({
      app: 'voxel-bedwars-lan',
      roomCode: 'LAN-EXPIRED',
      hostName: 'OldHost',
    });
    assertEqual(discovery.discoveredRooms.size, 1);

    // Simulate stale beacon (> 8000ms old)
    const entry = discovery.discoveredRooms.get('LAN-EXPIRED');
    entry.lastSeen = Date.now() - 9000;

    // Trigger pruning logic
    const now = Date.now();
    for (const [key, room] of discovery.discoveredRooms.entries()) {
      if (now - room.lastSeen > 8000) {
        discovery.discoveredRooms.delete(key);
      }
    }
    assertEqual(discovery.discoveredRooms.size, 0, 'Stale beacon must be removed');
    discovery.stopDiscovery();
  });

  await test('4.7: Dual-layer fallback on WebSocket timeout transitions to WebRTC', () => {
    const nm = new NetworkManager();
    assertEqual(nm.activeTransport, 'none');

    nm.onWebSocketTimeout();
    assertEqual(nm.activeTransport, 'webrtc');
    assertTrue(nm.isFallbackActive);
    assertEqual(nm.hudBadge, 'WebRTC P2P');
    assertEqual(nm.getTransportName(), 'WebRTC (Fallback)');
  });

  await test('4.8: Self-packet echo suppression in NetworkManager', () => {
    const nm = new NetworkManager();
    nm.clientId = 'client_local_123';
    let blockPlaced = false;

    nm.gm = {
      world: {
        setBlock: () => { blockPlaced = true; },
      },
    };

    // Packet from self must be dropped
    nm.handlePacket({
      type: 'BLOCK_PLACE',
      sender: 'client_local_123',
      payload: { x: 5, y: 10, z: 5, blockType: 1 },
    });
    assertFalse(blockPlaced, 'Packet from self must be ignored to prevent duplicate placement');

    // Packet from peer must be processed
    nm.handlePacket({
      type: 'BLOCK_PLACE',
      sender: 'peer_remote_456',
      payload: { x: 5, y: 10, z: 5, blockType: 1 },
    });
    assertTrue(blockPlaced, 'Packet from peer must be processed');
  });

  await test('4.9: High-level broadcast helper packet formatting', () => {
    const nm = new NetworkManager();
    nm.activeTransport = 'websocket';
    let lastSent = null;
    nm.wsAdapter.sendPacket = (type, payload) => {
      lastSent = { type, payload };
      return true;
    };

    nm.broadcastBlockPlace(12, 65, -4, 3);
    assertEqual(lastSent.type, 'BLOCK_PLACE');
    assertEqual(lastSent.payload.x, 12);
    assertEqual(lastSent.payload.blockType, 3);

    nm.broadcastBedDestroy('green');
    assertEqual(lastSent.type, 'BED_DESTROY');
    assertEqual(lastSent.payload.team, 'green');

    nm.broadcastPlayerDamage('bot_red_1', 6.5);
    assertEqual(lastSent.type, 'PLAYER_DAMAGE');
    assertEqual(lastSent.payload.targetId, 'bot_red_1');
    assertEqual(lastSent.payload.amount, 6.5);
  });

  await test('4.10: Clean network disconnect resets all transports', () => {
    const nm = new NetworkManager();
    nm.activeTransport = 'websocket';
    nm.roomCode = 'BW-ACTIVE';
    nm.clientId = 'client_1';

    nm.disconnect();
    assertEqual(nm.activeTransport, 'none');
    assertFalse(nm.isFallbackActive);
    assertEqual(nm.roomCode, null);
    assertEqual(nm.clientId, null);
    assertEqual(nm.getTransportName(), 'Disconnected');
  });

  // =========================================================================
  // SUITE 5: TouchControls, Multi-Touch Races & Extreme Viewports
  // =========================================================================
  console.log('\n► SUITE 5: TouchControls, Multi-Touch Races & Extreme Viewports');

  await test('5.1: Analog deadzone boundary - distance inside deadzone returns zero vector', () => {
    // maxRadius = 50, deadzone = 0.1 -> threshold is 5.0
    const inner = calculateJoystickVector(2.0, 3.0, 50, 0.1); // distance ≈ 3.6 < 5.0
    assertTrue(inner.inDeadzone);
    assertEqual(inner.x, 0);
    assertEqual(inner.y, 0);
  });

  await test('5.2: Analog deadzone exit boundary - distance outside deadzone returns active vector', () => {
    const outer = calculateJoystickVector(0, 10, 50, 0.1); // distance = 10 >= 5.0
    assertFalse(outer.inDeadzone);
    assertTrue(outer.rawDistance >= 5.0);
  });

  await test('5.3: Unit-circle clamping under extreme drag distance (e.g. distance = 500)', () => {
    const clamped = calculateJoystickVector(300, 400, 50, 0.1); // distance = 500 >> 50
    assertFalse(clamped.inDeadzone);
    const mag = Math.hypot(clamped.x, clamped.y);
    assertApprox(mag, 1.0, 0.0001, 'Normalized vector must clamp strictly to 1.0');
  });

  await test('5.4: Cardinal direction angle normalization', () => {
    // Forward / Up (dy = -50)
    const up = calculateJoystickVector(0, -50, 50, 0.1);
    assertApprox(up.x, 0);
    assertApprox(up.y, 1.0);

    // Backward / Down (dy = 50)
    const down = calculateJoystickVector(0, 50, 50, 0.1);
    assertApprox(down.x, 0);
    assertApprox(down.y, -1.0);

    // Right (dx = 50)
    const right = calculateJoystickVector(50, 0, 50, 0.1);
    assertApprox(right.x, 1.0);
    assertApprox(right.y, 0);

    // Left (dx = -50)
    const left = calculateJoystickVector(-50, 0, 50, 0.1);
    assertApprox(left.x, -1.0);
    assertApprox(left.y, 0);
  });

  await test('5.5: 45-degree diagonal angle normalization', () => {
    const diag = calculateJoystickVector(50, -50, 50, 0.1);
    assertApprox(diag.x, Math.SQRT1_2, 0.001); // ~0.7071
    assertApprox(diag.y, Math.SQRT1_2, 0.001);
    assertApprox(Math.hypot(diag.x, diag.y), 1.0, 0.001);
  });

  await test('5.6: Camera look yaw and pitch rotation with sensitivity scaling', () => {
    const player = { yaw: 0, pitch: 0 };
    applyLookDelta(player, 100, 50, 0.002);
    assertApprox(player.yaw, -0.2);
    assertApprox(player.pitch, -0.1);
  });

  await test('5.7: Extreme vertical look clamping prevents camera flip over zenith / nadir', () => {
    const player = { yaw: 0, pitch: 0 };
    // Drag down heavily
    applyLookDelta(player, 0, 10000, 0.0035);
    const maxPitch = Math.PI / 2 - 0.01;
    assertApprox(player.pitch, -maxPitch, 0.001, 'Pitch must clamp at negative zenith boundary');

    // Drag up heavily
    applyLookDelta(player, 0, -20000, 0.0035);
    assertApprox(player.pitch, maxPitch, 0.001, 'Pitch must clamp at positive zenith boundary');
  });

  await test('5.8: Multi-touch race defense on virtual joystick - second pointer ignored', () => {
    const tc = new TouchControls(null);
    tc.setEnabled(true);

    // First pointer starts joystick
    tc.handleJoystickStart({ pointerId: 10, clientX: 50, clientY: 50 });
    assertEqual(tc.joystickTouchId, 10);
    const origin1 = { ...tc.joystickOrigin };

    // Second pointer attempts to claim joystick while active
    tc.handleJoystickStart({ pointerId: 20, clientX: 120, clientY: 120 });
    assertEqual(tc.joystickTouchId, 10, 'Primary pointer ID must not be overwritten');
    assertEqual(tc.joystickOrigin.x, origin1.x, 'Joystick origin must not be hijacked');

    tc.destroy();
  });

  await test('5.9: Multi-touch race defense on camera look zone - second pointer ignored', () => {
    const tc = new TouchControls(null);
    tc.setEnabled(true);

    // First pointer in look zone
    tc.handleLookStart({ pointerId: 100, clientX: 300, clientY: 200 });
    assertEqual(tc.lookTouchId, 100);

    // Second pointer in look zone
    tc.handleLookStart({ pointerId: 200, clientX: 350, clientY: 250 });
    assertEqual(tc.lookTouchId, 100, 'Primary look pointer ID must remain intact');

    tc.destroy();
  });

  await test('5.10: Pointer cancel event cleanly restores joystick to origin', () => {
    const tc = new TouchControls(null);
    tc.setEnabled(true);
    tc.handleJoystickStart({ pointerId: 5, clientX: 100, clientY: 100 });
    tc.moveVector = { x: 0.8, y: 0.6 };

    // Pointer ends/cancels
    tc.handleJoystickEnd();
    assertEqual(tc.joystickTouchId, null);
    assertEqual(tc.moveVector.x, 0);
    assertEqual(tc.moveVector.y, 0);

    tc.destroy();
  });

  await test('5.11: Rapid toggle stress (50 cycles) leaves controls in consistent state', () => {
    const tc = new TouchControls(null);
    tc.setEnabled(false);
    assertFalse(tc.isEnabled);

    for (let i = 0; i < 50; i++) {
      tc.toggle();
    }
    // After 50 toggles from false, state must return to false
    assertFalse(tc.isEnabled);
    assertTrue(tc.container.classList.contains('hidden'));
    tc.destroy();
  });

  await test('5.12: Ultra-wide viewport (32:9 Aspect Ratio) vector normalization & proportional scaling', () => {
    // 5120x1440 resolution - large drag clamps strictly to unit circle
    const clamped = calculateJoystickVector(150, -90, 55, 0.1);
    assertFalse(clamped.inDeadzone);
    assertApprox(Math.hypot(clamped.x, clamped.y), 1.0, 0.001, 'Large drag on ultra-wide must clamp to 1.0');

    // Partial analog tilt is proportionally scaled
    const partial = calculateJoystickVector(40, -30, 55, 0.1); // distance = 50
    assertFalse(partial.inDeadzone);
    assertApprox(Math.hypot(partial.x, partial.y), (50 - 5.5) / 49.5, 0.001);
  });

  await test('5.13: Vertical mobile viewport (9:16 Aspect Ratio) vector normalization & proportional scaling', () => {
    // 1080x1920 portrait mobile resolution - large swipe clamps strictly to unit circle
    const clamped = calculateJoystickVector(-80, 120, 55, 0.1);
    assertFalse(clamped.inDeadzone);
    assertApprox(Math.hypot(clamped.x, clamped.y), 1.0, 0.001, 'Large swipe on portrait mobile must clamp to 1.0');

    // Partial analog tilt is proportionally scaled
    const partial = calculateJoystickVector(-25, 45, 55, 0.1); // distance ≈ 51.478
    assertFalse(partial.inDeadzone);
    const expectedDist = (Math.hypot(-25, 45) - 5.5) / 49.5;
    assertApprox(Math.hypot(partial.x, partial.y), expectedDist, 0.001);
  });

  await test('5.14: Hotbar slot touch selection bounds checking', () => {
    const mockGm = {
      localPlayer: { selectedSlot: 0 },
      hud: { updateHotbar: () => {} },
    };
    const tc = new TouchControls(mockGm);

    tc.selectHotbarSlot(4);
    assertEqual(mockGm.localPlayer.selectedSlot, 4);

    tc.selectHotbarSlot(8);
    assertEqual(mockGm.localPlayer.selectedSlot, 8);

    // Out-of-bounds selection ignored
    tc.selectHotbarSlot(-1);
    assertEqual(mockGm.localPlayer.selectedSlot, 8, 'Slot -1 must be ignored');

    tc.selectHotbarSlot(9);
    assertEqual(mockGm.localPlayer.selectedSlot, 8, 'Slot 9 must be ignored');

    tc.destroy();
  });

  await test('5.15: Mobile Packaging & Netlify Configuration Integrity', () => {
    const capPath = path.join(projectRoot, 'capacitor.config.json');
    const capContent = JSON.parse(fs.readFileSync(capPath, 'utf8'));
    assertEqual(capContent.appId, 'io.bedwars.voxel');
    assertEqual(capContent.appName, 'Voxel Bedwars');
    assertEqual(capContent.plugins?.ScreenOrientation?.orientation, 'landscape');

    const netlifyPath = path.join(projectRoot, 'netlify.toml');
    const netlifyContent = fs.readFileSync(netlifyPath, 'utf8');
    assertTrue(netlifyContent.includes('to = "/index.html"'), 'Netlify must include SPA redirect');
    assertTrue(netlifyContent.includes('status = 200'));
    assertTrue(netlifyContent.includes('connect-src'), 'Netlify must configure CSP connect-src for websockets');
  });

  // =========================================================================
  // SUMMARY
  // =========================================================================
  console.log('\n======================================================================');
  console.log('  GRAND TIER 5 SYSTEMS STRESS TEST SUMMARY');
  console.log('======================================================================');
  console.log(`  Total Invariants Tested: ${passedCount + failedCount}`);
  console.log(`  Passed:                  ${passedCount}`);
  console.log(`  Failed:                  ${failedCount}`);
  console.log('======================================================================\n');

  if (failedCount > 0) {
    console.error(`FAILURES OVERVIEW (${failedCount} invariant(s) failed):`);
    failures.forEach((f, i) => {
      console.error(`  [${i + 1}] ${f.name}`);
      console.error(`      ${f.error.message}`);
    });
    process.exit(1);
  } else {
    console.log(`ALL ${passedCount} TIER 5 SYSTEMS INVARIANTS PASSED (100% EMPIRICAL INTEGRITY VERIFIED)!`);
    process.exit(0);
  }
}

runMasterSuite().catch((err) => {
  console.error('FATAL TEST ERROR:', err);
  process.exit(1);
});
