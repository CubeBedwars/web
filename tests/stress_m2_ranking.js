/**
 * tests/stress_m2_ranking.js
 * Empirical Adversarial Stress Harness for Milestone 2:
 * RankManager, LevelManager, and Storage Serialization/Corruption Recovery.
 *
 * Objectives:
 * 1. Test non-2-team formats: 4-team and 8-team solo, 4-team squads, custom/garbage formats.
 *    Assert that calculateDelta strictly returns isRanked: false and deltaRating: 0 in 100% of cases.
 * 2. Test official 2-team formats: 1v1, 2v2, 3v3, 4v4 under normal & extreme kill/bed counts (e.g. 50 kills, 10 beds).
 * 3. Test floor rating invariant: Consecutive losses from rating 10, 5, 0 must NEVER drop below 0.
 * 4. Test leveling progression: Award 1,000,000 XP in small increments and assert that level strictly increases monotonically without rollover or NaN.
 * 5. Test storage serialization, deserialization, and corruption recovery under malicious/malformed inputs and storage throws.
 */

import { performance } from 'perf_hooks';
import './mocks/browser-shim.js';
import { RankManager, RANKED_FORMATS, RANK_TIERS } from '../src/stats/RankManager.js';
import { LevelManager } from '../src/stats/LevelManager.js';

console.log('\n======================================================================');
console.log('  MILESTONE 2 EMPIRICAL ADVERSARIAL STRESS SUITE: RANKING & LEVELING  ');
console.log('======================================================================\n');

let totalAssertions = 0;
let passedAssertions = 0;
let failedAssertions = 0;
const failureDetails = [];

function assert(condition, message, context = {}) {
  totalAssertions++;
  if (condition) {
    passedAssertions++;
  } else {
    failedAssertions++;
    const detail = `FAIL [Assert #${totalAssertions}]: ${message} | Context: ${JSON.stringify(context)}`;
    console.error(`  \x1b[31m✗ ${detail}\x1b[0m`);
    failureDetails.push(detail);
  }
}

function assertEqual(actual, expected, message) {
  assert(actual === expected, `${message} (Expected: ${expected}, Got: ${actual})`, { actual, expected });
}

function assertTrue(actual, message) {
  assert(actual === true, message, { actual });
}

function assertFalse(actual, message) {
  assert(actual === false, message, { actual });
}

const suiteStart = performance.now();

// ============================================================================
// SUITE 1: NON-2-TEAM FORMATS ADVERSARIAL ENFORCEMENT
// ============================================================================
console.log('\x1b[33m--- [Suite 1] Stress-Testing Non-2-Team Formats (Strict Unranked Enforcement) ---\x1b[0m');

const NON_RANKED_FORMATS = [
  // 4-team variations
  '4v4v4v4', 'solos_4team', 'solo-4team', '4-team', '4teams', 'squads-4team', 'quads', '4team', '4-teams', 'squads',
  '4v4v4', '4v4v4v4v4', '4x4', '4-way', 'four-teams',
  // 8-team variations
  '8-team', 'solos', 'solo', '8team', '8-team-solo', 'octagon_8team', '8v8v8v8v8v8v8v8', 'duos-8team', 'octo',
  '8-way', 'eight-teams', '8-player-solo',
  // Multi-team combinations
  '2v2v2v2', '3v3v3v3', '2v2v2', '3v3v3', '5v5', '6v6', '10v10', '100v100',
  // Casual / Free-For-All / Battle Royale
  'ffa', 'battle_royale', 'custom', 'sandbox', 'creative', 'deathmatch', 'tournament_custom',
  // Garbage, special characters, injection patterns
  '', '   ', '\t\n', '1v1_custom', '2v2_unranked', 'RANKED_FALSE', '1v1v1', 'null', 'undefined',
  '1v1; DROP TABLE users;', '<script>alert(1)</script>', '!@#$%^&*()', '1v1-mutations-all',
  '2-team-fake',
  // Edge types
  null, undefined,
];

let suite1Checks = 0;
const rankMgr1 = new RankManager('stress_test_unranked_profile');
rankMgr1.reset();
const initialRating = rankMgr1.rating;

for (const fmt of NON_RANKED_FORMATS) {
  for (const outcome of ['win', 'loss', 'draw', 'abandon', 'custom_outcome', '']) {
    for (const [kills, finalKills, beds] of [
      [0, 0, 0],
      [1, 0, 0],
      [10, 5, 2],
      [50, 20, 8],
      [100, 50, 25],
    ]) {
      suite1Checks++;
      // 1. Static calculateDelta check
      const delta = RankManager.calculateDelta(fmt, outcome, kills, finalKills, beds);
      assertFalse(delta.isRanked, `Format "${fmt}" with outcome "${outcome}" must be isRanked: false`);
      assertEqual(delta.deltaRating, 0, `Format "${fmt}" with outcome "${outcome}" must have deltaRating: 0`);

      // 2. Instance recordMatch check
      const rec = rankMgr1.recordMatch({
        format: fmt,
        outcome,
        kills,
        finalKills,
        bedsBroken: beds,
      });

      assertFalse(rec.isRanked, `Instance recordMatch for format "${fmt}" must return isRanked: false`);
      assertEqual(rec.deltaRating, 0, `Instance recordMatch for format "${fmt}" must return deltaRating: 0`);
      assertEqual(rankMgr1.rating, initialRating, `Instance rating must NOT change on unranked match (remains ${initialRating})`);
      assertEqual(rankMgr1.rankedMatches, 0, `rankedMatches counter must NOT increment on unranked match`);
      assertEqual(rankMgr1.rankedWins, 0, `rankedWins counter must NOT increment on unranked match`);
      assertEqual(rankMgr1.rankedLosses, 0, `rankedLosses counter must NOT increment on unranked match`);
      assertEqual(rankMgr1.rankedKills, 0, `rankedKills counter must NOT increment on unranked match`);
      assertEqual(rankMgr1.rankedFinalKills, 0, `rankedFinalKills counter must NOT increment on unranked match`);
      assertEqual(rankMgr1.rankedBedsBroken, 0, `rankedBedsBroken counter must NOT increment on unranked match`);
    }
  }
}

console.log(`  ✔ Tested ${suite1Checks} combinations of non-2-team format scenarios: 100% strictly unranked.`);

// ============================================================================
// SUITE 2: OFFICIAL 2-TEAM FORMATS UNDER EXTREME COMBAT STATISTICS
// ============================================================================
console.log('\n\x1b[33m--- [Suite 2] Stress-Testing Official 2-Team Formats (1v1, 2v2, 3v3, 4v4) ---\x1b[0m');

const OFFICIAL_2TEAM_FORMATS = ['1v1', '2v2', '3v3', '4v4'];
const FORMAT_CASE_VARIANTS = ['1v1', '1V1', ' 1v1 ', '2v2', '2V2', '  2V2  ', '3v3', '3V3', '4v4', '4V4', ' 4v4 '];

for (const variant of FORMAT_CASE_VARIANTS) {
  assertTrue(RankManager.isRankedFormat(variant), `Variant "${variant}" must be recognized as ranked format`);
}

// Stress win/loss calculations under extreme kill and bed counts
const extremeScenarios = [
  { kills: 0, finalKills: 0, beds: 0 },
  { kills: 1, finalKills: 0, beds: 0 },
  { kills: 0, finalKills: 1, beds: 1 },
  { kills: 10, finalKills: 4, beds: 2 },
  { kills: 50, finalKills: 10, beds: 5 },
  { kills: 100, finalKills: 50, beds: 10 },
  { kills: 1000, finalKills: 200, beds: 50 },
  { kills: 10000, finalKills: 5000, beds: 1000 },
];

for (const fmt of OFFICIAL_2TEAM_FORMATS) {
  for (const scen of extremeScenarios) {
    // 1. Win calculation
    const winDelta = RankManager.calculateDelta(fmt, 'win', scen.kills, scen.finalKills, scen.beds);
    const expectedWinDelta = 25 + (scen.kills * 2) + (scen.finalKills * 5) + (scen.beds * 10);
    assertTrue(winDelta.isRanked, `${fmt} win must be ranked`);
    assertEqual(winDelta.deltaRating, expectedWinDelta, `${fmt} win delta formula mismatch for kills=${scen.kills}, beds=${scen.beds}`);
    assertTrue(Number.isFinite(winDelta.deltaRating), `Win delta must be finite`);
    assertFalse(Number.isNaN(winDelta.deltaRating), `Win delta must not be NaN`);

    // 2. Loss calculation
    const lossDelta = RankManager.calculateDelta(fmt, 'loss', scen.kills, scen.finalKills, scen.beds);
    const expectedLossDelta = -20 + (scen.kills * 1) + (scen.finalKills * 2);
    assertTrue(lossDelta.isRanked, `${fmt} loss must be ranked`);
    assertEqual(lossDelta.deltaRating, expectedLossDelta, `${fmt} loss delta formula mismatch for kills=${scen.kills}`);
    assertTrue(Number.isFinite(lossDelta.deltaRating), `Loss delta must be finite`);
    assertFalse(Number.isNaN(lossDelta.deltaRating), `Loss delta must not be NaN`);

    // 3. Draw / tie calculation
    const drawDelta = RankManager.calculateDelta(fmt, 'draw', scen.kills, scen.finalKills, scen.beds);
    const expectedDrawDelta = 5 + (scen.kills * 1);
    assertTrue(drawDelta.isRanked, `${fmt} draw must be ranked`);
    assertEqual(drawDelta.deltaRating, expectedDrawDelta, `${fmt} draw delta formula mismatch`);
  }
}

// Tier mapping thresholds check
const tierThresholds = [
  { rating: 0, expected: 'Bronze' },
  { rating: 500, expected: 'Bronze' },
  { rating: 999, expected: 'Bronze' },
  { rating: 1000, expected: 'Silver' },
  { rating: 1250, expected: 'Silver' },
  { rating: 1499, expected: 'Silver' },
  { rating: 1500, expected: 'Gold' },
  { rating: 1800, expected: 'Gold' },
  { rating: 1999, expected: 'Gold' },
  { rating: 2000, expected: 'Diamond' },
  { rating: 2250, expected: 'Diamond' },
  { rating: 2499, expected: 'Diamond' },
  { rating: 2500, expected: 'Master' },
  { rating: 3000, expected: 'Master' },
  { rating: 10000, expected: 'Master' },
  { rating: 100000, expected: 'Master' },
  // Negative inputs should safely map to Bronze
  { rating: -1, expected: 'Bronze' },
  { rating: -1000, expected: 'Bronze' },
];

for (const t of tierThresholds) {
  const tier = RankManager.getRankTier(t.rating);
  assertEqual(tier, t.expected, `Rating ${t.rating} should map to tier ${t.expected}`);
}

console.log(`  ✔ Verified extreme combat statistics & tier boundaries across all 2-team formats.`);

// ============================================================================
// SUITE 3: FLOOR RATING INVARIANT (RATING NEVER DROPS BELOW ZERO)
// ============================================================================
console.log('\n\x1b[33m--- [Suite 3] Stress-Testing Floor Rating Invariant (Rating >= 0) ---\x1b[0m');

const floorMgr = new RankManager('stress_test_floor_profile');
floorMgr.reset();

// Test 1: Drop from exactly 10 rating
floorMgr.rating = 10;
floorMgr.peakRating = 10;
const resFrom10 = floorMgr.recordMatch({ format: '1v1', outcome: 'loss', kills: 0, finalKills: 0, bedsBroken: 0 });
assertEqual(resFrom10.deltaRating, -20, 'Loss delta without kills must be -20');
assertEqual(floorMgr.rating, 0, 'Rating must clamp to 0 when 10 - 20 = -10');
assertEqual(resFrom10.rating, 0, 'Returned rating must be 0');

// Test 2: Drop from exactly 5 rating
floorMgr.rating = 5;
const resFrom5 = floorMgr.recordMatch({ format: '2v2', outcome: 'loss', kills: 0, finalKills: 0, bedsBroken: 0 });
assertEqual(floorMgr.rating, 0, 'Rating must clamp to 0 when 5 - 20 = -15');

// Test 3: Loss from exactly 0 rating
const resFrom0 = floorMgr.recordMatch({ format: '3v3', outcome: 'loss', kills: 0, finalKills: 0, bedsBroken: 0 });
assertEqual(floorMgr.rating, 0, 'Rating must remain 0 when 0 - 20 = -20');

// Test 4: 500 consecutive losses from rating 1000
floorMgr.reset();
assertEqual(floorMgr.rating, 1000, 'Fresh profile starts at 1000 rating');

for (let lossIndex = 1; lossIndex <= 500; lossIndex++) {
  const out = floorMgr.recordMatch({ format: '4v4', outcome: 'loss', kills: 0, finalKills: 0, bedsBroken: 0 });
  assertTrue(floorMgr.rating >= 0, `Floor invariant violated at loss #${lossIndex}: rating=${floorMgr.rating}`);
  assertTrue(Number.isFinite(floorMgr.rating), `Rating must remain finite at loss #${lossIndex}`);
  assertFalse(Number.isNaN(floorMgr.rating), `Rating must not be NaN at loss #${lossIndex}`);

  if (lossIndex >= 50) {
    assertEqual(floorMgr.rating, 0, `After >= 50 losses (-20 each from 1000), rating must remain clamped at 0`);
  }
}

// Verify peakRating remained 1000 throughout all consecutive losses
assertEqual(floorMgr.peakRating, 1000, 'peakRating must not decay on losses');
assertEqual(floorMgr.rankedLosses, 500, 'Ranked losses counter must be accurate');
assertEqual(floorMgr.rankedWins, 0, 'Ranked wins counter must remain 0');
assertEqual(floorMgr.getTier(), 'Bronze', 'Rating 0 must evaluate to Bronze tier');

console.log(`  ✔ Verified floor rating invariant: 500+ consecutive losses strictly clamped at rating 0.`);

// ============================================================================
// SUITE 4: LEVELING PROGRESSION (1,000,000 XP MONOTONICITY & ROLLOVER STRESS)
// ============================================================================
console.log('\n\x1b[33m--- [Suite 4] Stress-Testing Leveling Progression & Monotonicity (1,000,000 XP) ---\x1b[0m');

// 1. Analytical Level Formula Verification
// Formula: level = Math.max(1, Math.floor(Math.sqrt(totalXP / 100)) + 1)
const expectedLevelAnchors = [
  { xp: 0, level: 1 },
  { xp: 99, level: 1 },
  { xp: 100, level: 2 },
  { xp: 399, level: 2 },
  { xp: 400, level: 3 },
  { xp: 899, level: 3 },
  { xp: 900, level: 4 },
  { xp: 10000, level: 11 },    // sqrt(100) + 1 = 11
  { xp: 40000, level: 21 },    // sqrt(400) + 1 = 21
  { xp: 90000, level: 31 },    // sqrt(900) + 1 = 31
  { xp: 1000000, level: 101 }, // sqrt(10000) + 1 = 101
  { xp: 4000000, level: 201 }, // sqrt(40000) + 1 = 201
];

for (const anchor of expectedLevelAnchors) {
  const info = LevelManager.calculateLevelFromXP(anchor.xp);
  assertEqual(info.level, anchor.level, `Level at ${anchor.xp} XP must be ${anchor.level}`);
  assertEqual(info.totalXP, anchor.xp, `totalXP reflected accurately`);
  assertTrue(info.progressXP >= 0, `progressXP must be >= 0 at ${anchor.xp} XP`);
  assertTrue(info.progressXP < info.neededXP || (anchor.xp === 0 && info.progressXP === 0), `progressXP must be < neededXP`);
  assertTrue(info.progressPercentage >= 0 && info.progressPercentage <= 100, `progressPercentage must be in [0, 100]`);
  assertEqual(info.currentLevelBaseXP, Math.pow(anchor.level - 1, 2) * 100, `currentLevelBaseXP formula exact`);
  assertEqual(info.nextLevelXP, Math.pow(anchor.level, 2) * 100, `nextLevelXP formula exact`);
}

// 2. Incremental 1,000,000 XP Monotonicity Loop
const levelMgr = new LevelManager('stress_test_level_profile');
levelMgr.reset();

const XP_TARGET = 1000000;
const stepSizes = [10, 25, 30, 47, 50, 75, 100, 137, 215, 350, 500];
let stepIndex = 0;
let prevLevel = levelMgr.level;
let prevTotalXP = levelMgr.totalXP;
let totalMatchesSimulated = 0;

const xpLoopStart = performance.now();

while (levelMgr.totalXP < XP_TARGET) {
  const currentStep = stepSizes[stepIndex % stepSizes.length];
  stepIndex++;

  // Derive simulated match statistics matching currentStep
  // calculateMatchXP(outcome, kills, finalKills, bedsBroken) = base + kills*15 + finalKills*35 + beds*50
  // Or directly award via recordMatch
  const outcome = (stepIndex % 3 === 0) ? 'win' : 'loss';
  const kills = (stepIndex % 4);
  const finalKills = (stepIndex % 5 === 0) ? 1 : 0;
  const beds = (stepIndex % 7 === 0) ? 1 : 0;

  const result = levelMgr.recordMatch({
    outcome,
    kills,
    finalKills,
    bedsBroken: beds,
  });
  totalMatchesSimulated++;

  // INVARIANTS CHECKED AT EVERY STEP:
  // 1. Total XP strictly increases
  assertTrue(levelMgr.totalXP > prevTotalXP, `Total XP must strictly increase at step ${totalMatchesSimulated}`);
  assertEqual(levelMgr.totalXP, prevTotalXP + result.xpEarned, `Total XP must exactly match prev + earned`);

  // 2. Level must be monotonically non-decreasing (NEVER roll over, drop, or become NaN)
  assertTrue(levelMgr.level >= prevLevel, `Level must never decrease! Was ${prevLevel}, now ${levelMgr.level}`);
  assertTrue(Number.isInteger(levelMgr.level), `Level must remain integer: ${levelMgr.level}`);
  assertFalse(Number.isNaN(levelMgr.level), `Level must never be NaN`);
  assertTrue(Number.isFinite(levelMgr.level), `Level must be finite`);

  // 3. Level up boolean indicator consistency
  if (levelMgr.level > prevLevel) {
    assertTrue(result.leveledUp, `result.leveledUp must be true when level advances from ${prevLevel} to ${levelMgr.level}`);
  } else {
    assertFalse(result.leveledUp, `result.leveledUp must be false when level does not advance`);
  }

  // 4. Progress percentage range
  assertTrue(result.progressPercentage >= 0 && result.progressPercentage <= 100, `Progress percentage must be 0-100%`);

  // 5. XP boundaries consistency
  assertTrue(levelMgr.totalXP >= result.currentLevelBaseXP, `totalXP >= currentLevelBaseXP`);
  assertTrue(levelMgr.totalXP < result.nextLevelXP, `totalXP < nextLevelXP`);
  assertEqual(result.progressXP, levelMgr.totalXP - result.currentLevelBaseXP, `progressXP computation`);
  assertEqual(result.neededXP, result.nextLevelXP - result.currentLevelBaseXP, `neededXP computation`);

  prevLevel = levelMgr.level;
  prevTotalXP = levelMgr.totalXP;
}

const xpLoopDuration = ((performance.now() - xpLoopStart)).toFixed(2);
console.log(`  ✔ Leveling Monotonicity: Awarded ${levelMgr.totalXP.toLocaleString()} XP across ${totalMatchesSimulated.toLocaleString()} matches.`);
console.log(`  ✔ Final Level reached: ${levelMgr.level} (Expected >= 101, zero rollover, zero NaN) in ${xpLoopDuration}ms.`);

// 3. Extreme XP Stress (100,000,000 XP)
const extremeXPInfo = LevelManager.calculateLevelFromXP(100000000);
assertEqual(extremeXPInfo.level, 1001, '100,000,000 XP must compute to Level 1,001');
assertTrue(Number.isFinite(extremeXPInfo.progressPercentage), 'Extreme XP progressPercentage is finite');

// 4. Negative / NaN XP inputs to calculateLevelFromXP
const negXPInfo = LevelManager.calculateLevelFromXP(-500);
assertEqual(negXPInfo.level, 1, 'Negative XP must safely return Level 1');
const nullXPInfo = LevelManager.calculateLevelFromXP(null);
assertEqual(nullXPInfo.level, 1, 'Null XP must safely return Level 1');
const nanXPInfo = LevelManager.calculateLevelFromXP(NaN);
assertEqual(nanXPInfo.level, 1, 'NaN XP must safely return Level 1');

// ============================================================================
// SUITE 5: STORAGE SERIALIZATION, DESERIALIZATION & CORRUPTION RECOVERY
// ============================================================================
console.log('\n\x1b[33m--- [Suite 5] Stress-Testing Storage Serialization & Corruption Recovery ---\x1b[0m');

// 1. Clean Round-Trip Test
const roundTripRankKey = 'stress_rt_rank_key';
const roundTripLevelKey = 'stress_rt_level_key';

const r1 = new RankManager(roundTripRankKey);
r1.reset();
r1.rating = 2150;
r1.peakRating = 2300;
r1.rankedMatches = 45;
r1.rankedWins = 30;
r1.rankedLosses = 15;
r1.rankedKills = 120;
r1.rankedFinalKills = 40;
r1.rankedBedsBroken = 25;
r1.save();

// Load into new instance
const r2 = new RankManager(roundTripRankKey);
assertEqual(r2.rating, 2150, 'Round-trip rating match');
assertEqual(r2.peakRating, 2300, 'Round-trip peakRating match');
assertEqual(r2.rankedMatches, 45, 'Round-trip rankedMatches match');
assertEqual(r2.rankedWins, 30, 'Round-trip rankedWins match');
assertEqual(r2.rankedLosses, 15, 'Round-trip rankedLosses match');
assertEqual(r2.rankedKills, 120, 'Round-trip rankedKills match');
assertEqual(r2.rankedFinalKills, 40, 'Round-trip rankedFinalKills match');
assertEqual(r2.rankedBedsBroken, 25, 'Round-trip rankedBedsBroken match');
assertEqual(r2.getTier(), 'Diamond', 'Round-trip tier match');

const l1 = new LevelManager(roundTripLevelKey);
l1.reset();
l1.totalXP = 54321;
l1.totalMatches = 99;
l1.wins = 70;
l1.losses = 29;
l1.totalKills = 350;
l1.totalFinalKills = 110;
l1.totalBedsBroken = 45;
l1.save();

const l2 = new LevelManager(roundTripLevelKey);
assertEqual(l2.totalXP, 54321, 'Round-trip totalXP match');
assertEqual(l2.level, LevelManager.calculateLevelFromXP(54321).level, 'Round-trip level match');
assertEqual(l2.totalMatches, 99, 'Round-trip totalMatches match');
assertEqual(l2.wins, 70, 'Round-trip wins match');
assertEqual(l2.losses, 29, 'Round-trip losses match');
assertEqual(l2.totalKills, 350, 'Round-trip totalKills match');

// 2. Corrupted & Malicious Storage Payloads (Syntax errors, non-objects, wrong types)
const CORRUPTED_STORAGE_PAYLOADS = [
  '{ bad: json, unterminated',
  '{"rating": 1000', // truncated JSON
  'undefined',
  'null',
  '',
  '   ',
  '<html><body>502 Bad Gateway</body></html>',
  '{"rating": "NOT_A_NUMBER", "peakRating": null}',
  '{"totalXP": "ONE_MILLION"}',
  '{"rating": true, "peakRating": false}',
  '{"totalXP": true}',
  '[1, 2, 3, 4]',
  '"just a plain string"',
  '123456789',
  'true',
  'false',
  '{"rating": {"nested": "object"}}',
  '{"totalXP": [100, 200]}',
];

const corruptKey = 'stress_corrupted_key';

for (let i = 0; i < CORRUPTED_STORAGE_PAYLOADS.length; i++) {
  const payload = CORRUPTED_STORAGE_PAYLOADS[i];
  globalThis.localStorage.setItem(corruptKey, payload);

  // RankManager load under corruption
  let rankMgrCorrupt;
  try {
    rankMgrCorrupt = new RankManager(corruptKey);
    assertTrue(true, `RankManager instantiated without error on payload #${i}`);
  } catch (err) {
    assert(false, `RankManager crashed on corrupted payload #${i}: ${err.message}`);
  }

  // Verify safe fallback state (defaults preserved when payload has syntax errors or invalid types)
  assertTrue(Number.isFinite(rankMgrCorrupt.rating), `Rating must be finite on payload #${i}`);
  assertEqual(rankMgrCorrupt.rating, 1000, `Default rating 1000 must be preserved on corrupt payload #${i}`);
  assertEqual(rankMgrCorrupt.peakRating, 1000, `Default peakRating 1000 must be preserved on corrupt payload #${i}`);
  assertEqual(rankMgrCorrupt.rankedMatches, 0, `Default rankedMatches 0 must be preserved on corrupt payload #${i}`);
  assertEqual(rankMgrCorrupt.getTier(), 'Silver', `Default rating 1000 evaluates to Silver tier`);

  // Test that subsequent recordMatch works cleanly despite prior corruption
  const postCorruptRec = rankMgrCorrupt.recordMatch({
    format: '1v1',
    outcome: 'win',
    kills: 2,
    finalKills: 1,
    bedsBroken: 1,
  });
  assertTrue(postCorruptRec.isRanked, `Must record ranked match after corruption recovery`);
  assertEqual(postCorruptRec.deltaRating, 44, `Delta rating computed accurately (25 + 4 + 5 + 10)`);
  assertEqual(rankMgrCorrupt.rating, 1044, `Rating increments cleanly from default 1000 to 1044`);

  // LevelManager load under corruption
  let levelMgrCorrupt;
  try {
    levelMgrCorrupt = new LevelManager(corruptKey);
    assertTrue(true, `LevelManager instantiated without error on payload #${i}`);
  } catch (err) {
    assert(false, `LevelManager crashed on corrupted payload #${i}: ${err.message}`);
  }

  assertTrue(Number.isFinite(levelMgrCorrupt.totalXP), `totalXP must be finite on payload #${i}`);
  assertEqual(levelMgrCorrupt.totalXP, 0, `Default totalXP 0 must be preserved on corrupt payload #${i}`);
  assertEqual(levelMgrCorrupt.level, 1, `Default Level 1 must be preserved on corrupt payload #${i}`);

  // Subsequent match works
  const postCorruptLevelRec = levelMgrCorrupt.recordMatch({
    outcome: 'win',
    kills: 3,
    finalKills: 1,
    bedsBroken: 1,
  });
  assertTrue(postCorruptLevelRec.xpEarned > 0, `Must earn XP after corruption recovery`);
  assertEqual(postCorruptLevelRec.xpEarned, 230, `Win XP computed accurately (100 + 45 + 35 + 50)`);
  assertEqual(levelMgrCorrupt.totalXP, 230, `totalXP increments cleanly from 0 to 230`);
  assertEqual(levelMgrCorrupt.level, 2, `Level updates from 1 to 2 at 230 XP`);
}

// 2b. Partial Payload Handling (Missing properties default gracefully)
const partialKey = 'stress_partial_key';
globalThis.localStorage.setItem(partialKey, JSON.stringify({ rating: 1750 })); // peakRating, matches, etc. missing
const partialRank = new RankManager(partialKey);
assertEqual(partialRank.rating, 1750, 'Parsed provided rating');
assertEqual(partialRank.peakRating, 1000, 'Unprovided peakRating retained default');
assertEqual(partialRank.rankedMatches, 0, 'Unprovided rankedMatches retained default');
assertEqual(partialRank.getTier(), 'Gold', '1750 maps to Gold tier');

globalThis.localStorage.setItem(partialKey, JSON.stringify({ totalXP: 2500 })); // matches, wins missing
const partialLevel = new LevelManager(partialKey);
assertEqual(partialLevel.totalXP, 2500, 'Parsed provided totalXP');
assertEqual(partialLevel.level, 6, 'Derived level 6 from 2500 XP (sqrt(25) + 1 = 6)');
assertEqual(partialLevel.totalMatches, 0, 'Unprovided totalMatches retained default');

// 3. Storage Exceptions (QuotaExceededError & SecurityError simulation)
const origLocalStorage = globalThis.localStorage;

// Simulate throwing localStorage
const throwingStorage = {
  getItem() {
    throw new Error('DOMException: SecurityError: The operation is insecure.');
  },
  setItem() {
    throw new Error('DOMException: QuotaExceededError: The quota has been exceeded.');
  },
  removeItem() {
    throw new Error('DOMException: SecurityError');
  },
  clear() {
    throw new Error('DOMException: SecurityError');
  },
};

globalThis.localStorage = throwingStorage;

try {
  const rmThrow = new RankManager('throwing_key');
  rmThrow.recordMatch({ format: '1v1', outcome: 'win', kills: 5 });
  rmThrow.save();
  rmThrow.reset();
  assertTrue(true, 'RankManager survived throwing localStorage without uncaught exception');

  const lmThrow = new LevelManager('throwing_key');
  lmThrow.recordMatch({ outcome: 'win', kills: 5 });
  lmThrow.save();
  lmThrow.reset();
  assertTrue(true, 'LevelManager survived throwing localStorage without uncaught exception');
} catch (err) {
  assert(false, `Throwing storage caused uncaught error: ${err.message}`);
} finally {
  // Restore original mock localStorage
  globalThis.localStorage = origLocalStorage;
}

// 4. Undefined localStorage environment
const savedStorage = globalThis.localStorage;
delete globalThis.localStorage;

try {
  const rmNoStorage = new RankManager('no_storage_key');
  rmNoStorage.recordMatch({ format: '1v1', outcome: 'win', kills: 3 });
  rmNoStorage.save();
  rmNoStorage.reset();
  assertTrue(true, 'RankManager survived undefined localStorage');

  const lmNoStorage = new LevelManager('no_storage_key');
  lmNoStorage.recordMatch({ outcome: 'win', kills: 3 });
  lmNoStorage.save();
  lmNoStorage.reset();
  assertTrue(true, 'LevelManager survived undefined localStorage');
} catch (err) {
  assert(false, `Undefined storage caused uncaught error: ${err.message}`);
} finally {
  globalThis.localStorage = savedStorage;
}

console.log(`  ✔ Verified clean serialization, corrupted JSON recovery, and throwing storage resilience.`);

// ============================================================================
// SUITE 6: HIGH-THROUGHPUT PERFORMANCE BENCHMARK
// ============================================================================
console.log('\n\x1b[33m--- [Suite 6] High-Throughput Performance Benchmark ---\x1b[0m');

const BENCH_ITERATIONS = 100000;
const benchStart = performance.now();

for (let i = 0; i < BENCH_ITERATIONS; i++) {
  const fmt = (i % 2 === 0) ? '1v1' : 'solos_4team';
  const outcome = (i % 3 === 0) ? 'win' : 'loss';
  RankManager.calculateDelta(fmt, outcome, i % 10, i % 5, i % 2);
}

const benchDeltaDuration = performance.now() - benchStart;
const opsPerSecDelta = Math.floor((BENCH_ITERATIONS / benchDeltaDuration) * 1000);
console.log(`  ⚡ RankManager.calculateDelta: ${BENCH_ITERATIONS.toLocaleString()} ops in ${benchDeltaDuration.toFixed(2)}ms (~${opsPerSecDelta.toLocaleString()} ops/sec)`);

const levelBenchStart = performance.now();
for (let i = 0; i < BENCH_ITERATIONS; i++) {
  LevelManager.calculateLevelFromXP(i * 100);
}
const benchLevelDuration = performance.now() - levelBenchStart;
const opsPerSecLevel = Math.floor((BENCH_ITERATIONS / benchLevelDuration) * 1000);
console.log(`  ⚡ LevelManager.calculateLevelFromXP: ${BENCH_ITERATIONS.toLocaleString()} ops in ${benchLevelDuration.toFixed(2)}ms (~${opsPerSecLevel.toLocaleString()} ops/sec)`);

assertTrue(opsPerSecDelta > 50000, 'calculateDelta throughput exceeds 50,000 ops/sec');
assertTrue(opsPerSecLevel > 50000, 'calculateLevelFromXP throughput exceeds 50,000 ops/sec');

// ============================================================================
// SUMMARY & VERDICT
// ============================================================================
const suiteDuration = ((performance.now() - suiteStart) / 1000).toFixed(2);

console.log('\n======================================================================');
console.log('                 ADVERSARIAL STRESS TEST SUMMARY                      ');
console.log('======================================================================');
console.log(`  Total Assertions Checked : ${totalAssertions.toLocaleString()}`);
console.log(`  Passed Assertions        : \x1b[32m${passedAssertions.toLocaleString()}\x1b[0m`);
console.log(`  Failed Assertions        : ${failedAssertions > 0 ? `\x1b[31m${failedAssertions}\x1b[0m` : '\x1b[32m0\x1b[0m'}`);
console.log(`  Duration                 : ${suiteDuration}s`);
console.log('======================================================================\n');

if (failedAssertions > 0) {
  console.error(`\x1b[31mADVERSARIAL STRESS TEST FAILED: ${failedAssertions} assertion(s) violated!\x1b[0m`);
  process.exit(1);
} else {
  console.log('\x1b[32m✔ ALL ADVERSARIAL STRESS ASSERTIONS PASSED WITH 100% SUCCESS.\x1b[0m\n');
  process.exit(0);
}
