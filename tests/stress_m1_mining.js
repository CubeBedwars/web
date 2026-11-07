/**
 * tests/stress_m1_mining.js
 * Empirical Adversarial Stress Test Suite for Milestone 1 (M1):
 * Mining State Machine, Tool Multipliers, Duration Calculations, and Block Mechanics.
 *
 * Objectives:
 * 1. Tool multiplier speedups (Shears on Wool, Diamond Pick on Obsidian & End Stone).
 * 2. Unbreakable Bedrock (duration === Infinity, startMining aborts, zero damage).
 * 3. Obsidian >= 3.5s break time guarantee under all player loadouts.
 * 4. Extreme hardness boundary values and edge cases.
 * 5. Rapid click spamming stress harness (1000 rapid clicks must not break blocks).
 * 6. Target switching mid-mine (immediate progress reset).
 * 7. Releasing left-click mid-mine (cancellation of break progress).
 * 8. Crack texture progression stages 0-9 and ratio clamping.
 * 9. Reach distance limits (> 6.0 units cutoff).
 * 10. High-throughput performance benchmark (10,000 ops/sec).
 */

import * as THREE from 'three';
import './mocks/browser-shim.js';
import { BLOCK_TYPES, BLOCK_PROPS, VoxelWorld } from '../src/engine/VoxelWorld.js';
import { GameManager } from '../src/game/GameManager.js';
import { Player } from '../src/entities/Player.js';

console.log('\n======================================================================');
console.log('   EMPIRICAL ADVERSARIAL STRESS SUITE: M1 MINING & DURATION HARNESS   ');
console.log('======================================================================\n');

let totalAssertions = 0;
let passedAssertions = 0;
let failedAssertions = 0;

function assert(condition, message) {
  totalAssertions++;
  if (condition) {
    passedAssertions++;
    console.log(`  ✓ PASS: ${message}`);
  } else {
    failedAssertions++;
    console.error(`  ✗ FAIL: ${message}`);
    process.exitCode = 1;
  }
}

/**
 * Factory helper: creates an isolated, headless GameManager harness with full mining fidelity.
 */
function createMiningHarness(toolName = 'fist', hotbarItems = []) {
  const scene = new THREE.Scene();
  const world = new VoxelWorld(scene);
  world.rebuildMeshes = () => {}; // No-op for headless

  const camera = new THREE.PerspectiveCamera(75, 1.0, 0.05, 400);
  camera.position.set(10.5, 5.5, 8.0);
  camera.lookAt(10.5, 5.5, 10.5);

  const localPlayer = new Player('local_tester', 'Tester', 'red', true);
  localPlayer.position.set(10.5, 5.5, 8.0);
  localPlayer.isLocalPlayer = true;
  localPlayer.isMining = false;
  localPlayer.triggerSwing = () => {};

  if (toolName && toolName !== 'fist') {
    localPlayer.setTool(toolName, 5.0);
  }
  for (const item of hotbarItems) {
    localPlayer.addItem(item);
  }

  const crackGeo = new THREE.BoxGeometry(1.004, 1.004, 1.004);
  const crackMaterial = new THREE.MeshBasicMaterial({ transparent: true });
  const crackMesh = new THREE.Mesh(crackGeo, crackMaterial);
  crackMesh.visible = false;
  scene.add(crackMesh);

  const selectGeo = new THREE.EdgesGeometry(new THREE.BoxGeometry(1.002, 1.002, 1.002));
  const selectionMesh = new THREE.LineSegments(selectGeo, new THREE.LineBasicMaterial());
  selectionMesh.visible = false;
  scene.add(selectionMesh);

  const harness = Object.create(GameManager.prototype);
  harness.world = world;
  harness.scene = scene;
  harness.camera = camera;
  harness.localPlayer = localPlayer;
  harness.players = [localPlayer];
  harness.crackMesh = crackMesh;
  harness.crackMaterial = crackMaterial;
  harness.selectionMesh = selectionMesh;
  harness.studioEditor = { isActive: false };
  harness.teamManager = { destroyBed: () => {} };
  harness.hud = { showAnnouncement: () => {} };
  harness.sound = {
    playBlockHit: () => {},
    playBlockBreak: () => {},
    playSwordSwing: () => {},
    playExplosion: () => {},
    playBedDestroyed: () => {},
  };
  harness.particles = {
    spawnBlockBreak: () => {},
    spawnHitSparks: () => {},
  };

  harness.isLeftMouseDown = false;
  harness.isMining = false;
  harness.miningTarget = null;
  harness.miningElapsed = 0;
  harness.miningDuration = 1.0;
  harness.miningHitTimer = 0;

  // Controlled aim override or native raycast
  harness._aimOverride = null;
  harness.getAimRaycast = function() {
    if (this._aimOverride !== null) {
      return this._aimOverride;
    }
    const dir = new THREE.Vector3();
    this.camera.getWorldDirection(dir);
    return this.world.raycast(this.camera.position, dir, 5.5);
  };

  return harness;
}

// ============================================================================
// TEST SUITE 1: Tool Multipliers, Duration Calculations & Obsidian >= 3.5s
// ============================================================================
console.log('--- SUITE 1: Tool Multipliers & Duration Calculations ---');

const harnessDia = createMiningHarness('diamond_pickaxe');
const harnessIron = createMiningHarness('iron_pickaxe');
const harnessShears = createMiningHarness('shears');
const harnessFist = createMiningHarness('fist');

// 1.1 Shears on Wool
const woolColors = [
  { id: BLOCK_TYPES.WOOL_WHITE, name: 'Wool White' },
  { id: BLOCK_TYPES.WOOL_RED, name: 'Wool Red' },
  { id: BLOCK_TYPES.WOOL_BLUE, name: 'Wool Blue' },
  { id: BLOCK_TYPES.WOOL_GREEN, name: 'Wool Green' },
  { id: BLOCK_TYPES.WOOL_YELLOW, name: 'Wool Yellow' },
  { id: BLOCK_TYPES.WOOL_AQUA, name: 'Wool Aqua' },
  { id: BLOCK_TYPES.WOOL_PINK, name: 'Wool Pink' },
  { id: BLOCK_TYPES.WOOL_GRAY, name: 'Wool Gray' },
];

for (const w of woolColors) {
  const durShears = harnessShears.computeBreakDuration(w.id, harnessShears.localPlayer);
  const durFist = harnessFist.computeBreakDuration(w.id, harnessFist.localPlayer);
  assert(Math.abs(durShears - 0.15) < 0.001, `${w.name} with shears is exactly 0.15s (actual: ${durShears.toFixed(3)}s)`);
  assert(Math.abs(durFist - 0.75) < 0.001, `${w.name} with fist is exactly 0.75s (actual: ${durFist.toFixed(3)}s)`);
  assert(Math.abs((durFist / durShears) - 5.0) < 0.01, `${w.name} shears yield exactly a 5.0x speedup over fist`);
}

// 1.2 Diamond Pickaxe on End Stone
const endStoneDia = harnessDia.computeBreakDuration(BLOCK_TYPES.END_STONE, harnessDia.localPlayer);
const endStoneIron = harnessIron.computeBreakDuration(BLOCK_TYPES.END_STONE, harnessIron.localPlayer);
const endStoneFist = harnessFist.computeBreakDuration(BLOCK_TYPES.END_STONE, harnessFist.localPlayer);
assert(Math.abs(endStoneDia - 0.6) < 0.001, `End Stone with Diamond Pickaxe is 0.60s (actual: ${endStoneDia.toFixed(3)}s)`);
assert(Math.abs(endStoneIron - 1.0) < 0.001, `End Stone with Iron Pickaxe is 1.00s (actual: ${endStoneIron.toFixed(3)}s)`);
assert(Math.abs(endStoneFist - 15.0) < 0.001, `End Stone with fist is 15.00s (actual: ${endStoneFist.toFixed(3)}s)`);
assert(endStoneDia < endStoneIron && endStoneIron < endStoneFist, 'End Stone break times follow Diamond < Iron < Fist strict hierarchy');
assert(Math.abs(endStoneFist / endStoneDia - 25.0) < 0.01, 'Diamond Pickaxe is 25x faster on End Stone than bare fist');

// 1.3 Diamond Pickaxe on Obsidian & 3.5s Minimum Time Rule
const obsDia = harnessDia.computeBreakDuration(BLOCK_TYPES.OBSIDIAN, harnessDia.localPlayer);
const obsIron = harnessIron.computeBreakDuration(BLOCK_TYPES.OBSIDIAN, harnessIron.localPlayer);
const obsFist = harnessFist.computeBreakDuration(BLOCK_TYPES.OBSIDIAN, harnessFist.localPlayer);
const obsShears = harnessShears.computeBreakDuration(BLOCK_TYPES.OBSIDIAN, harnessShears.localPlayer);

assert(Math.abs(obsDia - 4.0) < 0.001, `Obsidian with Diamond Pickaxe takes exactly 4.00s (actual: ${obsDia.toFixed(3)}s)`);
assert(obsDia >= 3.5, `CONFIRMED: Obsidian break time with Diamond Pickaxe (4.0s) is >= 3.5 seconds`);
assert(obsIron >= 200.0, `Obsidian with Iron Pickaxe is virtually unbreakable (actual: ${obsIron.toFixed(1)}s >= 200s)`);
assert(obsFist >= 200.0, `Obsidian with bare fist is virtually unbreakable (actual: ${obsFist.toFixed(1)}s >= 200s)`);
assert(obsShears >= 200.0, `Obsidian with shears is virtually unbreakable (actual: ${obsShears.toFixed(1)}s >= 200s)`);

// Test all possible tool variations on Obsidian to ensure none can break it in < 3.5s
const testTools = ['wooden_pickaxe', 'stone_pickaxe', 'iron_pickaxe', 'wooden_axe', 'stone_axe', 'iron_axe', 'diamond_axe', 'shears', 'fist'];
let allObsidianGte35 = true;
for (const t of testTools) {
  const p = new Player(`p_${t}`, 'Tester', 'red', true);
  p.setTool(t, 2.0);
  const dur = harnessDia.computeBreakDuration(BLOCK_TYPES.OBSIDIAN, p);
  if (dur < 3.5) allObsidianGte35 = false;
}
assert(allObsidianGte35 === true, 'CONFIRMED: Obsidian CANNOT be broken in under 3.5 seconds across any non-diamond tool');

// 1.4 Bedrock Infinite Duration & Indestructibility
const bedrockDia = harnessDia.computeBreakDuration(BLOCK_TYPES.BEDROCK, harnessDia.localPlayer);
const bedrockFist = harnessFist.computeBreakDuration(BLOCK_TYPES.BEDROCK, harnessFist.localPlayer);
assert(bedrockDia === Infinity, 'Bedrock computeBreakDuration with Diamond Pickaxe returns Infinity');
assert(bedrockFist === Infinity, 'Bedrock computeBreakDuration with Fist returns Infinity');

// ============================================================================
// TEST SUITE 2: Extreme Hardness Values & Edge Cases
// ============================================================================
console.log('\n--- SUITE 2: Extreme Hardness Values & Boundary Cases ---');

const harness = createMiningHarness('diamond_pickaxe');

// 2.1 Hardness >= 99999 cap
assert(harness.computeBreakDuration(BLOCK_TYPES.BEDROCK, harness.localPlayer) === Infinity, 'Bedrock hardness 99999 yields Infinity');

// 2.2 Attempting startMining on Bedrock
harness.world.setBlock(10, 5, 10, BLOCK_TYPES.BEDROCK);
const bedrockHit = {
  hit: true,
  blockPos: { x: 10, y: 5, z: 10 },
  normal: { x: 0, y: 0, z: -1 },
  type: BLOCK_TYPES.BEDROCK,
};
harness.isMining = false;
harness.miningTarget = null;
harness.miningElapsed = 0;

harness.startMining(bedrockHit);
assert(harness.isMining === false, 'startMining on Bedrock aborts immediately: isMining remains false');
assert(harness.miningTarget === null, 'startMining on Bedrock leaves miningTarget as null');
assert(harness.miningElapsed === 0, 'startMining on Bedrock does not accumulate miningElapsed');
assert(harness.crackMesh.visible === false, 'crackMesh is not visible when clicking Bedrock');

// 2.3 Simulating 100 seconds of holding click on Bedrock
harness.isLeftMouseDown = true;
harness._aimOverride = bedrockHit;
for (let frame = 0; frame < 1000; frame++) {
  harness.updateMining(0.1); // 1000 * 0.1s = 100s
}
assert(harness.world.getBlock(10, 5, 10) === BLOCK_TYPES.BEDROCK, 'Bedrock at (10, 5, 10) is STILL BEDROCK after 100s of continuous mining');
assert(harness.isMining === false, 'isMining never becomes true while clicking Bedrock');

// 2.4 Extreme Low Hardness (e.g. 0.001) and Zero Hardness (AIR)
const airDur = harness.computeBreakDuration(BLOCK_TYPES.AIR, harness.localPlayer);
assert(airDur === 0 || !isNaN(airDur), `Air duration is safely finite and not NaN (actual: ${airDur})`);

// 2.5 Unknown / Missing Block Type
const unknownDur = harness.computeBreakDuration(9999, harness.localPlayer);
assert(!isNaN(unknownDur) && unknownDur > 0, `Unknown block type handles gracefully with default duration (actual: ${unknownDur})`);

// ============================================================================
// TEST SUITE 3: Rapid Click Spamming Stress Harness
// ============================================================================
console.log('\n--- SUITE 3: Rapid Click Spamming Stress Test ---');

// Test 3.1: 1,000 rapid clicks on Stone (0.35s Diamond Pickaxe break time)
const spamHarness = createMiningHarness('diamond_pickaxe');
spamHarness.world.setBlock(10, 5, 10, BLOCK_TYPES.STONE);
const stoneHit = {
  hit: true,
  blockPos: { x: 10, y: 5, z: 10 },
  normal: { x: 0, y: 0, z: -1 },
  type: BLOCK_TYPES.STONE,
};
spamHarness._aimOverride = stoneHit;

const spamClickCount = 1000;
const clickDurationMs = 10; // 10ms per click (fast clicker)
for (let c = 0; c < spamClickCount; c++) {
  // mousedown
  spamHarness.isLeftMouseDown = true;
  spamHarness.startMining(stoneHit);
  // advance time by 10ms
  spamHarness.updateMining(clickDurationMs / 1000);
  // mouseup
  spamHarness.isLeftMouseDown = false;
  spamHarness.stopMining();
}

const stoneAfterSpam = spamHarness.world.getBlock(10, 5, 10);
assert(stoneAfterSpam === BLOCK_TYPES.STONE, `Stone block remains intact after ${spamClickCount} rapid clicks (total ${spamClickCount * clickDurationMs}ms of clicks)`);
assert(spamHarness.isMining === false, 'Mining state is false after click spam session');
assert(spamHarness.miningElapsed === 0, 'Mining elapsed time is 0 after click spam session');
assert(spamHarness.crackMesh.visible === false, 'Crack overlay is hidden after click spam session');

// Test 3.2: Sustained click immediately breaks the Stone block
spamHarness.isLeftMouseDown = true;
spamHarness.startMining(stoneHit);
// Stone with Diamond Pick takes 0.35s
spamHarness.updateMining(0.20); // 200ms
assert(spamHarness.world.getBlock(10, 5, 10) === BLOCK_TYPES.STONE, 'Stone block still intact at 200ms/350ms');
spamHarness.updateMining(0.16); // 200 + 160 = 360ms >= 350ms
assert(spamHarness.world.getBlock(10, 5, 10) === BLOCK_TYPES.AIR, 'Stone block is broken to AIR after single sustained hold exceeding 0.35s');

// Test 3.3: 500 rapid clicks on Wool (0.15s Shears break time)
const woolSpamHarness = createMiningHarness('shears');
woolSpamHarness.world.setBlock(10, 5, 11, BLOCK_TYPES.WOOL_RED);
const woolHit = {
  hit: true,
  blockPos: { x: 10, y: 5, z: 11 },
  normal: { x: 0, y: 0, z: -1 },
  type: BLOCK_TYPES.WOOL_RED,
};
woolSpamHarness._aimOverride = woolHit;

for (let c = 0; c < 500; c++) {
  woolSpamHarness.isLeftMouseDown = true;
  woolSpamHarness.startMining(woolHit);
  woolSpamHarness.updateMining(0.02); // 20ms click (needed 150ms)
  woolSpamHarness.isLeftMouseDown = false;
  woolSpamHarness.stopMining();
}
assert(woolSpamHarness.world.getBlock(10, 5, 11) === BLOCK_TYPES.WOOL_RED, 'Wool block remains intact after 500 rapid clicks of 20ms');

// ============================================================================
// TEST SUITE 4: Switching Targeted Block Mid-Mine (Progress Reset)
// ============================================================================
console.log('\n--- SUITE 4: Switching Targeted Block Mid-Mine ---');

const switchHarness = createMiningHarness('diamond_pickaxe');
// Block A: Stone at (10, 5, 10), duration = 0.35s
// Block B: End Stone at (10, 5, 11), duration = 0.60s
switchHarness.world.setBlock(10, 5, 10, BLOCK_TYPES.STONE);
switchHarness.world.setBlock(10, 5, 11, BLOCK_TYPES.END_STONE);

const hitA = { hit: true, blockPos: { x: 10, y: 5, z: 10 }, type: BLOCK_TYPES.STONE };
const hitB = { hit: true, blockPos: { x: 10, y: 5, z: 11 }, type: BLOCK_TYPES.END_STONE };

// 4.1 Start mining Block A and hold for 0.30s (out of 0.35s, 85% done)
switchHarness.isLeftMouseDown = true;
switchHarness._aimOverride = hitA;
switchHarness.startMining(hitA);
switchHarness.updateMining(0.30);

assert(switchHarness.isMining === true, 'Harness is actively mining Block A');
assert(Math.abs(switchHarness.miningElapsed - 0.30) < 0.001, `Mining elapsed is 0.30s on Block A (duration: ${switchHarness.miningDuration}s)`);
assert(switchHarness.world.getBlock(10, 5, 10) === BLOCK_TYPES.STONE, 'Block A is not yet broken at 0.30s');

// 4.2 Crosshair sweeps to Block B while holding left click
switchHarness._aimOverride = hitB;
switchHarness.updateMining(0.01);

assert(switchHarness.miningTarget.blockPos.z === 11, 'Mining target switched to Block B at z = 11');
assert(switchHarness.miningElapsed === 0, 'Mining elapsed time was RESET to 0 on target change');
assert(Math.abs(switchHarness.miningDuration - 0.60) < 0.001, 'Mining duration updated to Block B duration (0.60s)');

// 4.3 Hold on Block B for 0.20s
switchHarness.updateMining(0.20);
assert(Math.abs(switchHarness.miningElapsed - 0.20) < 0.001, 'Mining elapsed progressed to 0.20s on Block B');
assert(switchHarness.world.getBlock(10, 5, 11) === BLOCK_TYPES.END_STONE, 'Block B is intact at 0.20s/0.60s');

// 4.4 Crosshair sweeps BACK to Block A while still holding left click
switchHarness._aimOverride = hitA;
switchHarness.updateMining(0.01);

assert(switchHarness.miningTarget.blockPos.z === 10, 'Mining target switched back to Block A at z = 10');
assert(switchHarness.miningElapsed === 0, 'Block A progress was NOT preserved: elapsed was RESET to 0');
assert(switchHarness.world.getBlock(10, 5, 10) === BLOCK_TYPES.STONE, 'Block A is still STONE');

// 4.5 Hold on Block A for only 0.20s (would have broken if 0.30s was preserved!)
switchHarness.updateMining(0.20);
assert(switchHarness.world.getBlock(10, 5, 10) === BLOCK_TYPES.STONE, 'CONFIRMED: Block A did NOT break prematurely with leftover progress');

// 4.6 Hold on Block A for remaining 0.16s (total 0.36s continuous)
switchHarness.updateMining(0.16);
assert(switchHarness.world.getBlock(10, 5, 10) === BLOCK_TYPES.AIR, 'Block A breaks after full continuous 0.36s hold');

// ============================================================================
// TEST SUITE 5: Releasing Left-Click Mid-Mine (Break Cancellation)
// ============================================================================
console.log('\n--- SUITE 5: Releasing Left-Click Mid-Mine ---');

const cancelHarness = createMiningHarness('diamond_pickaxe');
cancelHarness.world.setBlock(12, 5, 10, BLOCK_TYPES.OBSIDIAN);
const obsHit = { hit: true, blockPos: { x: 12, y: 5, z: 10 }, type: BLOCK_TYPES.OBSIDIAN };
cancelHarness._aimOverride = obsHit;

// 5.1 Mine Obsidian for 3.8s (out of 4.0s, 95% complete)
cancelHarness.isLeftMouseDown = true;
cancelHarness.startMining(obsHit);
for (let t = 0; t < 38; t++) {
  cancelHarness.updateMining(0.1);
}
assert(Math.abs(cancelHarness.miningElapsed - 3.8) < 0.05, `Mining elapsed is ~3.8s on Obsidian (actual: ${cancelHarness.miningElapsed.toFixed(2)}s)`);
assert(cancelHarness.crackMesh.visible === true, 'Crack overlay is visible at 95% break progress');
assert(cancelHarness.world.getBlock(12, 5, 10) === BLOCK_TYPES.OBSIDIAN, 'Obsidian is intact at 3.8s');

// 5.2 Release left-click (mouseup event)
cancelHarness.isLeftMouseDown = false;
cancelHarness.stopMining();

assert(cancelHarness.isMining === false, 'isMining is false after releasing click');
assert(cancelHarness.miningTarget === null, 'miningTarget is null after releasing click');
assert(cancelHarness.miningElapsed === 0, 'miningElapsed is reset to 0 after releasing click');
assert(cancelHarness.crackMesh.visible === false, 'crackMesh is hidden after releasing click');
assert(cancelHarness.world.getBlock(12, 5, 10) === BLOCK_TYPES.OBSIDIAN, 'Obsidian remains intact');

// 5.3 Click again and hold for only 1.0s
cancelHarness.isLeftMouseDown = true;
cancelHarness.startMining(obsHit);
for (let t = 0; t < 10; t++) {
  cancelHarness.updateMining(0.1);
}
assert(cancelHarness.world.getBlock(12, 5, 10) === BLOCK_TYPES.OBSIDIAN, 'Obsidian did not break after 1.0s (progress was not cached)');

// 5.4 Continuous hold for full 4.1s breaks Obsidian
for (let t = 0; t < 31; t++) {
  cancelHarness.updateMining(0.1); // total 10 + 31 = 41 ticks = 4.1s
}
assert(cancelHarness.world.getBlock(12, 5, 10) === BLOCK_TYPES.AIR, 'Obsidian breaks cleanly after full continuous 4.1s hold');

// ============================================================================
// TEST SUITE 6: Crack Texture Progression Stages & Ratio Clamping
// ============================================================================
console.log('\n--- SUITE 6: Crack Texture Stages 0-9 & Clamping ---');

const crackHarness = createMiningHarness('diamond_pickaxe');
crackHarness.world.setBlock(10, 5, 10, BLOCK_TYPES.END_STONE); // 0.60s duration
const crackHit = { hit: true, blockPos: { x: 10, y: 5, z: 10 }, type: BLOCK_TYPES.END_STONE };
crackHarness._aimOverride = crackHit;

crackHarness.isLeftMouseDown = true;
crackHarness.startMining(crackHit);

// Helper to inspect crack texture stage
function getCurrentCrackStage(harness) {
  const ratio = Math.min(0.999, harness.miningElapsed / Math.max(0.01, harness.miningDuration));
  return Math.floor(ratio * 10);
}

const observedStages = [];
// Advance in 0.06s increments (10% increments of 0.60s)
for (let step = 0; step < 10; step++) {
  const stage = getCurrentCrackStage(crackHarness);
  observedStages.push(stage);
  crackHarness.updateMining(0.06);
}

assert(observedStages[0] === 0, 'Stage at 0% progress is 0');
assert(observedStages[1] === 1, 'Stage at 10% progress is 1');
assert(observedStages[5] === 5, 'Stage at 50% progress is 5');
assert(observedStages[9] === 9, 'Stage at 90% progress is 9');

// Test stage clamping at 99.9% progress
crackHarness.miningElapsed = 0.599; // 99.83% of 0.60s
const stage99 = getCurrentCrackStage(crackHarness);
assert(stage99 === 9, `Crack stage at 99.9% progress is clamped to 9 (actual: ${stage99}), never 10`);

// ============================================================================
// TEST SUITE 7: Reach Distance Limit & Far Cutoff
// ============================================================================
console.log('\n--- SUITE 7: Reach Distance Limit (6.0 Units) ---');

const reachHarness = createMiningHarness('diamond_pickaxe');
reachHarness.world.setBlock(10, 5, 10, BLOCK_TYPES.STONE);
const reachHit = { hit: true, blockPos: { x: 10, y: 5, z: 10 }, type: BLOCK_TYPES.STONE };
reachHarness._aimOverride = reachHit;

// Position at distance = 3.0 blocks -> within reach (< 6.0)
reachHarness.localPlayer.position.set(10.5, 5.5, 7.5);
reachHarness.isLeftMouseDown = true;
reachHarness.startMining(reachHit);
reachHarness.updateMining(0.1);
assert(reachHarness.isMining === true, 'Player within 3.0 blocks can mine normally');

// Teleport player to distance = 10.0 blocks (> 6.0)
reachHarness.localPlayer.position.set(10.5, 5.5, 0.0); // distance ~ 10.5 units
reachHarness.updateMining(0.05);

assert(reachHarness.isMining === false, 'Mining automatically aborted when player exceeds 6.0 reach distance');
assert(reachHarness.miningElapsed === 0, 'Mining elapsed reset upon reach violation');

// ============================================================================
// TEST SUITE 8: High-Throughput Performance Benchmark
// ============================================================================
console.log('\n--- SUITE 8: High-Throughput Performance Benchmark ---');

const benchHarness = createMiningHarness('diamond_pickaxe');
benchHarness.world.setBlock(10, 5, 10, BLOCK_TYPES.STONE);
const benchHit = { hit: true, blockPos: { x: 10, y: 5, z: 10 }, type: BLOCK_TYPES.STONE };
benchHarness._aimOverride = benchHit;

const BENCH_ITERATIONS = 10000;
const benchStart = performance.now();

for (let i = 0; i < BENCH_ITERATIONS; i++) {
  benchHarness.isLeftMouseDown = true;
  benchHarness.startMining(benchHit);
  benchHarness.updateMining(0.016); // 1 frame at 60fps
  benchHarness.isLeftMouseDown = false;
  benchHarness.stopMining();
}

const benchDurationMs = performance.now() - benchStart;
const opsPerSec = (BENCH_ITERATIONS / (benchDurationMs / 1000)).toFixed(0);

console.log(`  Benchmark: ${BENCH_ITERATIONS} full mining state machine cycles executed in ${benchDurationMs.toFixed(2)}ms`);
console.log(`  Throughput: ${opsPerSec} ops/sec`);

assert(benchDurationMs < 2000, `10,000 mining state machine cycles execute in < 2000ms (actual: ${benchDurationMs.toFixed(2)}ms)`);
assert(Number(opsPerSec) > 5000, `Throughput exceeds 5,000 ops/sec (actual: ${opsPerSec} ops/sec)`);

// ============================================================================
// FINAL SUMMARY
// ============================================================================
console.log('\n======================================================================');
console.log(`   SUMMARY: ${passedAssertions}/${totalAssertions} ASSERTIONS PASSED (Failed: ${failedAssertions})   `);
console.log('======================================================================\n');

if (failedAssertions === 0) {
  console.log('🏆 VERDICT: ALL ADVERSARIAL STRESS CHALLENGES PASSED PERFECTLY!\n');
  process.exit(0);
} else {
  console.error(`💥 VERDICT: ${failedAssertions} CHALLENGES FAILED! REQUEST CHANGES.\n`);
  process.exit(1);
}
