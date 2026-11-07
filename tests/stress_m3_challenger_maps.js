/**
 * tests/stress_m3_challenger_maps.js
 * Empirical Adversarial Verification Suite for Milestone 3 (M3):
 * Map Presets Integrity, Bed Adjacency, Spawn Floor Safety, Map Symmetry,
 * and Bot Spawner Match Format Stress.
 *
 * Authored by: teamwork_challenger (Challenger 1)
 */

import * as THREE from 'three';
import './mocks/browser-shim.js';
import { BLOCK_TYPES, BLOCK_PROPS, VoxelWorld } from '../src/engine/VoxelWorld.js';
import { MAP_PRESETS } from '../src/game/MapPresets.js';
import { TeamManager } from '../src/game/TeamManager.js';
import { GameManager } from '../src/game/GameManager.js';
import { MutationManager } from '../src/game/MutationManager.js';
import { Player } from '../src/entities/Player.js';
import { BotPlayer } from '../src/entities/BotPlayer.js';

console.log('\n======================================================================');
console.log('   EMPIRICAL ADVERSARIAL STRESS SUITE: M3 MAPS, SYMMETRY & FORMATS    ');
console.log('======================================================================\n');

let totalAssertions = 0;
let passedAssertions = 0;
let failedAssertions = 0;
const failureDetails = [];

function assert(condition, message, detail = null) {
  totalAssertions++;
  if (condition) {
    passedAssertions++;
    console.log(`  ✓ PASS: ${message}`);
  } else {
    failedAssertions++;
    const errMsg = `  ✗ FAIL: ${message}${detail ? ` -> ${detail}` : ''}`;
    console.error(errMsg);
    failureDetails.push({ message, detail });
    process.exitCode = 1;
  }
}

// Helper to create headless mock GameManager for match format tests
function createMockGameManager(scene, world) {
  const localPlayer = new Player('player_local', 'You', 'red');
  localPlayer.respawn = (pos) => {
    localPlayer.position.set(pos.x, pos.y, pos.z);
  };

  const mockGM = {
    sound: {
      init() {},
      resume() {},
      playBedDestroyed() {},
    },
    teamManager: new TeamManager(),
    scene,
    world,
    generatorManager: {
      loadSpawners() {},
    },
    mutationManager: new MutationManager(),
    localPlayer,
    players: [localPlayer],
    hud: {
      show() {},
      showAnnouncement() {},
    },
    particles: {
      spawnBlockBreak() {},
    },
    canvas: {
      requestPointerLock() {},
    },
    startMatch: GameManager.prototype.startMatch,
    destroyBedAt: GameManager.prototype.destroyBedAt,
  };

  return mockGM;
}

// ============================================================================
// SUITE 1: MAP PRESETS & STRICT BED ADJACENCY (distance === 1.0)
// ============================================================================
console.log('--- SUITE 1: Map Presets & Bed Adjacency Stress ---');

const presets = ['speedway', 'colosseum', 'octagon'];

for (const presetKey of presets) {
  const preset = MAP_PRESETS[presetKey];
  assert(!!preset, `1.${presetKey}.1: Preset ${presetKey} exists in MAP_PRESETS`);
  assert(Array.isArray(preset.teams) && preset.teams.length > 0, `1.${presetKey}.2: Preset ${presetKey} defines team array`);

  // Check every team bed
  for (const team of preset.teams) {
    const bed = preset.beds[team];
    assert(!!bed, `1.${presetKey}.3: Team ${team} defines bed coordinates`);
    if (!bed) continue;

    const dx = bed.head.x - bed.foot.x;
    const dy = bed.head.y - bed.foot.y;
    const dz = bed.head.z - bed.foot.z;
    const euclideanDist = Math.hypot(dx, dy, dz);
    const manhattanDist = Math.abs(dx) + Math.abs(dy) + Math.abs(dz);

    assert(
      Math.abs(euclideanDist - 1.0) < 1e-6,
      `1.${presetKey}.4: Bed for ${team} on ${presetKey} is strictly adjacent (dist === 1.0)`,
      `Expected dist === 1.0, got Euclidean=${euclideanDist.toFixed(4)}, Manhattan=${manhattanDist}, head=(${bed.head.x},${bed.head.y},${bed.head.z}), foot=(${bed.foot.x},${bed.foot.y},${bed.foot.z})`
    );

    assert(
      bed.head.y === bed.foot.y,
      `1.${presetKey}.5: Bed head and foot for ${team} on ${presetKey} are on same horizontal plane`,
      `head.y=${bed.head.y}, foot.y=${bed.foot.y}`
    );
  }

  // Geometry verification & paired bed destruction test
  const scene = new THREE.Scene();
  const world = new VoxelWorld(scene);
  world.rebuildMeshes = () => {};
  preset.generateGeometry(world);

  for (const team of preset.teams) {
    const bed = preset.beds[team];
    if (!bed) continue;

    const headBlock = world.getBlock(bed.head.x, bed.head.y, bed.head.z);
    const footBlock = world.getBlock(bed.foot.x, bed.foot.y, bed.foot.z);

    assert(headBlock === BLOCK_TYPES.BED_HEAD, `1.${presetKey}.6: Bed head for ${team} placed in world (got ${headBlock})`);
    assert(footBlock === BLOCK_TYPES.BED_FOOT, `1.${presetKey}.7: Bed foot for ${team} placed in world (got ${footBlock})`);

    // Test paired bed destruction logic
    const testWorld = new VoxelWorld(new THREE.Scene());
    testWorld.rebuildMeshes = () => {};
    preset.generateGeometry(testWorld);

    const mockGM = createMockGameManager(scene, testWorld);
    mockGM.teamManager.initTeams(preset.teams);

    // Destroy bed via head
    mockGM.destroyBedAt(bed.head.x, bed.head.y, bed.head.z, mockGM.localPlayer);

    const remainingHead = testWorld.getBlock(bed.head.x, bed.head.y, bed.head.z);
    const remainingFoot = testWorld.getBlock(bed.foot.x, bed.foot.y, bed.foot.z);

    assert(
      remainingHead === BLOCK_TYPES.AIR && remainingFoot === BLOCK_TYPES.AIR,
      `1.${presetKey}.8: Destroying bed head for ${team} on ${presetKey} destroys BOTH head and foot voxels`,
      `remainingHead=${remainingHead} (expected 0), remainingFoot=${remainingFoot} (expected 0)`
    );
  }
}

// ============================================================================
// SUITE 2: SPAWN POSITION GROUND SAFETY (Above Solid Blocks, Not Void)
// ============================================================================
console.log('\n--- SUITE 2: Spawn Ground Safety (Solid Floor, No Void Spawns) ---');

for (const presetKey of presets) {
  const preset = MAP_PRESETS[presetKey];
  const scene = new THREE.Scene();
  const world = new VoxelWorld(scene);
  world.rebuildMeshes = () => {};
  preset.generateGeometry(world);

  for (const team of preset.teams) {
    const spawn = preset.spawns[team];
    assert(!!spawn, `2.${presetKey}.1: Spawn coordinates exist for team ${team}`);
    if (!spawn) continue;

    // Scan vertically downwards beneath spawn column
    let solidFound = false;
    let solidBlockType = BLOCK_TYPES.AIR;
    let solidBlockY = -1;

    for (let y = Math.floor(spawn.y) - 1; y >= 0; y--) {
      const bt = world.getBlock(spawn.x, y, spawn.z);
      if (bt !== BLOCK_TYPES.AIR && BLOCK_PROPS[bt]?.solid) {
        solidFound = true;
        solidBlockType = bt;
        solidBlockY = y;
        break;
      }
    }

    assert(
      solidFound,
      `2.${presetKey}.2: Spawn for ${team} on ${presetKey} has solid block beneath (not suspended in void)`,
      `No solid block found between y=${spawn.y - 1} and y=0 at x=${spawn.x}, z=${spawn.z}`
    );

    if (solidFound) {
      const dropDistance = spawn.y - solidBlockY;
      assert(
        dropDistance <= 3,
        `2.${presetKey}.3: Spawn drop distance for ${team} on ${presetKey} is safe (<= 3 blocks)`,
        `Drop distance is ${dropDistance} (spawn.y=${spawn.y}, ground.y=${solidBlockY})`
      );
    }
  }
}

// ============================================================================
// SUITE 3: TEAM SYMMETRY STRESS
// ============================================================================
console.log('\n--- SUITE 3: Team Symmetry Stress ---');

// 3.1 Colosseum Red vs Blue Symmetry
{
  const colosseum = MAP_PRESETS.colosseum;
  const diamondGen = colosseum.generators.find((g) => g.type === 'diamond');
  const emeraldGen = colosseum.generators.find((g) => g.type === 'emerald');

  assert(!!diamondGen, '3.1a: Colosseum defines center diamond generator');
  assert(!!emeraldGen, '3.1b: Colosseum defines center emerald generator');

  if (diamondGen) {
    const redSpawn = colosseum.spawns.red;
    const blueSpawn = colosseum.spawns.blue;

    const redDistToDia = Math.hypot(redSpawn.x - diamondGen.pos.x, redSpawn.y - diamondGen.pos.y, redSpawn.z - diamondGen.pos.z);
    const blueDistToDia = Math.hypot(blueSpawn.x - diamondGen.pos.x, blueSpawn.y - diamondGen.pos.y, blueSpawn.z - diamondGen.pos.z);

    const diff = Math.abs(redDistToDia - blueDistToDia);
    assert(
      diff < 1e-6,
      `3.1c: Colosseum Red and Blue spawn distances to center diamond generator are exactly equal`,
      `redDist=${redDistToDia.toFixed(4)}, blueDist=${blueDistToDia.toFixed(4)}, diff=${diff}`
    );

    // Bed symmetry
    const redBed = colosseum.beds.red;
    const blueBed = colosseum.beds.blue;
    const redBedDist = Math.hypot(redBed.head.x - diamondGen.pos.x, redBed.head.z - diamondGen.pos.z);
    const blueBedDist = Math.hypot(blueBed.head.x - diamondGen.pos.x, blueBed.head.z - diamondGen.pos.z);
    assert(
      Math.abs(redBedDist - blueBedDist) < 1e-6,
      `3.1d: Colosseum Red and Blue bed distances to center diamond generator are exactly equal`,
      `redBedDist=${redBedDist.toFixed(4)}, blueBedDist=${blueBedDist.toFixed(4)}`
    );

    // Forge symmetry
    const redForge = colosseum.generators.find((g) => g.type === 'forge' && g.team === 'red');
    const blueForge = colosseum.generators.find((g) => g.type === 'forge' && g.team === 'blue');
    const redForgeDist = Math.hypot(redForge.pos.x - diamondGen.pos.x, redForge.pos.z - diamondGen.pos.z);
    const blueForgeDist = Math.hypot(blueForge.pos.x - diamondGen.pos.x, blueForge.pos.z - diamondGen.pos.z);
    assert(
      Math.abs(redForgeDist - blueForgeDist) < 1e-6,
      `3.1e: Colosseum Red and Blue forge distances to center diamond generator are exactly equal`,
      `redForgeDist=${redForgeDist.toFixed(4)}, blueForgeDist=${blueForgeDist.toFixed(4)}`
    );
  }
}

// 3.2 Octagon 8-Team Radial Symmetry from Center Citadel (0, 0)
{
  const octagon = MAP_PRESETS.octagon;
  const citadelCenter = { x: 0, z: 0 };
  const teamRadialDists = {};

  for (const team of octagon.teams) {
    const spawn = octagon.spawns[team];
    const rDist = Math.hypot(spawn.x - citadelCenter.x, spawn.z - citadelCenter.z);
    teamRadialDists[team] = rDist;
  }

  console.log('   Octagon 8-team radial spawn distances from center citadel:');
  for (const [t, d] of Object.entries(teamRadialDists)) {
    console.log(`     - Team ${t.padEnd(7)}: distance = ${d.toFixed(4)}`);
  }

  // Check integer voxel grid symmetry (rounded to nearest integer)
  for (const team of octagon.teams) {
    const d = teamRadialDists[team];
    assert(
      Math.round(d) === 50,
      `3.2a: Octagon team ${team} radial spawn distance rounds to nominal 50 voxels`,
      `Got ${d.toFixed(4)}, round=${Math.round(d)}`
    );
  }

  // Mathematical exact equality check across all 8 teams
  const distValues = Object.values(teamRadialDists);
  const minDist = Math.min(...distValues);
  const maxDist = Math.max(...distValues);
  const spread = maxDist - minDist;

  assert(
    spread < 1e-4,
    `3.2b: Octagon 8-team radial distances from center citadel are mathematically equal`,
    `minDist=${minDist.toFixed(4)}, maxDist=${maxDist.toFixed(4)}, spread=${spread.toFixed(4)} (Cardinal=50.0000 vs Diagonal=49.4975, discrepancy ~0.5025 voxels)`
  );
}

// ============================================================================
// SUITE 4: BOT SPAWNER & MATCH FORMATS STRESS
// ============================================================================
console.log('\n--- SUITE 4: Bot Spawner & Match Formats Stress ---');

const formatSpecifications = [
  {
    name: '1v1 Duels',
    mode: '1v1',
    format: '1v1',
    expectedTeams: ['red', 'blue'],
    expectedPlayerCount: 2,
    expectedPlayersPerTeam: 1,
    expectedAlliedBots: 0,
    expectedEnemyBots: 1,
  },
  {
    name: 'Solos (1v1v1v1)',
    mode: 'solo',
    format: '1v1v1v1',
    expectedTeams: ['red', 'blue', 'green', 'yellow'],
    expectedPlayerCount: 4,
    expectedPlayersPerTeam: 1,
    expectedAlliedBots: 0,
    expectedEnemyBots: 3,
  },
  {
    name: 'Duos (2v2v2v2)',
    mode: 'duos',
    format: '2v2v2v2',
    expectedTeams: ['red', 'blue', 'green', 'yellow'],
    expectedPlayerCount: 8,
    expectedPlayersPerTeam: 2,
    expectedAlliedBots: 1,
    expectedEnemyBots: 6,
  },
  {
    name: 'Trios (3v3v3v3)',
    mode: 'trios',
    format: '3v3v3v3',
    expectedTeams: ['red', 'blue', 'green', 'yellow'],
    expectedPlayerCount: 12,
    expectedPlayersPerTeam: 3,
    expectedAlliedBots: 2,
    expectedEnemyBots: 9,
  },
  {
    name: '4v4',
    mode: '4v4',
    format: '4v4',
    expectedTeams: ['red', 'blue'],
    expectedPlayerCount: 8,
    expectedPlayersPerTeam: 4,
    expectedAlliedBots: 3,
    expectedEnemyBots: 4,
  },
];

for (const spec of formatSpecifications) {
  const scene = new THREE.Scene();
  const world = new VoxelWorld(scene);
  world.rebuildMeshes = () => {};
  const mockGM = createMockGameManager(scene, world);

  mockGM.startMatch(spec.mode, true, spec.format);

  const activeTeams = Object.keys(mockGM.teamManager.teams);
  const totalPlayers = mockGM.players.length;

  console.log(`\n  Checking format: ${spec.name}`);
  console.log(`    Active teams: [${activeTeams.join(', ')}]`);
  console.log(`    Total players spawned: ${totalPlayers} (expected ${spec.expectedPlayerCount})`);

  // 4.1 Total player count
  assert(
    totalPlayers === spec.expectedPlayerCount,
    `4.${spec.name}.1: Total player count matches format specification (${spec.expectedPlayerCount})`,
    `Got ${totalPlayers} players, expected ${spec.expectedPlayerCount}`
  );

  // 4.2 Active teams count
  assert(
    activeTeams.length === spec.expectedTeams.length,
    `4.${spec.name}.2: Team count matches format specification (${spec.expectedTeams.length})`,
    `Got ${activeTeams.length} teams (${activeTeams.join(',')}), expected ${spec.expectedTeams.length} (${spec.expectedTeams.join(',')})`
  );

  // 4.3 Players per team
  for (const tName of spec.expectedTeams) {
    const teamObj = mockGM.teamManager.teams[tName];
    const teamPlayerCount = teamObj?.players?.length || 0;
    assert(
      teamPlayerCount === spec.expectedPlayersPerTeam,
      `4.${spec.name}.3: Team ${tName} has ${spec.expectedPlayersPerTeam} players`,
      `Team ${tName} has ${teamPlayerCount} players, expected ${spec.expectedPlayersPerTeam}`
    );
  }

  // 4.4 Player ID Uniqueness (no duplicate players)
  const playerIds = mockGM.players.map((p) => p.id);
  const uniqueIds = new Set(playerIds);
  assert(
    uniqueIds.size === playerIds.length,
    `4.${spec.name}.4: All player IDs are unique (no duplicates in match)`,
    `Total IDs: ${playerIds.length}, Unique IDs: ${uniqueIds.size}`
  );

  // 4.5 No missing spawns (every player placed at valid coordinates)
  let missingSpawn = false;
  let missingDetail = null;
  for (const p of mockGM.players) {
    if (isNaN(p.position.x) || isNaN(p.position.y) || isNaN(p.position.z)) {
      missingSpawn = true;
      missingDetail = `Player ${p.id} has NaN position: (${p.position.x}, ${p.position.y}, ${p.position.z})`;
      break;
    }
  }
  assert(!missingSpawn, `4.${spec.name}.5: All spawned players have valid 3D coordinates (no missing spawns)`, missingDetail);
}

// ============================================================================
// SUITE 5: PERFORMANCE & BENCHMARK NUMBERS
// ============================================================================
console.log('\n--- SUITE 5: Performance Benchmarking ---');

// Benchmark 1: Map geometry generation (100 iterations)
{
  const iters = 100;
  for (const pKey of presets) {
    const preset = MAP_PRESETS[pKey];
    const scene = new THREE.Scene();
    const t0 = performance.now();
    for (let i = 0; i < iters; i++) {
      const w = new VoxelWorld(scene);
      w.rebuildMeshes = () => {};
      preset.generateGeometry(w);
    }
    const tTotal = performance.now() - t0;
    const avgMs = tTotal / iters;
    console.log(`  ⚡ Map [${pKey.padEnd(9)}] Geometry Build: ${avgMs.toFixed(3)} ms/build (${iters} iterations in ${tTotal.toFixed(1)} ms)`);
    assert(avgMs < 10.0, `5.1: ${pKey} geometry generation is fast (< 10 ms/build, got ${avgMs.toFixed(3)} ms)`);
  }
}

// Benchmark 2: Match format start setup (100 match starts)
{
  const iters = 100;
  const scene = new THREE.Scene();
  const world = new VoxelWorld(scene);
  world.rebuildMeshes = () => {};
  const mockGM = createMockGameManager(scene, world);

  const t0 = performance.now();
  for (let i = 0; i < iters; i++) {
    mockGM.startMatch('solo', true, '1v1v1v1');
  }
  const tTotal = performance.now() - t0;
  const avgMs = tTotal / iters;
  console.log(`  ⚡ Match Setup Loop : ${avgMs.toFixed(3)} ms/start (${iters} iterations in ${tTotal.toFixed(1)} ms)`);
  assert(avgMs < 5.0, `5.2: Match start initialization is fast (< 5 ms/start, got ${avgMs.toFixed(3)} ms)`);
}

// ============================================================================
// SUMMARY & VERDICT
// ============================================================================
console.log('\n======================================================================');
console.log('                 M3 CHALLENGER STRESS HARNESS SUMMARY                 ');
console.log('======================================================================');
console.log(`  Total Assertions Checked : ${totalAssertions}`);
console.log(`  Passed Assertions        : ${passedAssertions}`);
console.log(`  Failed Assertions        : ${failedAssertions}`);
console.log('======================================================================\n');

if (failureDetails.length > 0) {
  console.log('CRITICAL DEFECTS IDENTIFIED:');
  failureDetails.forEach((f, idx) => {
    console.log(`  ${idx + 1}. ${f.message}`);
    if (f.detail) console.log(`     -> ${f.detail}`);
  });
  console.log('\nVERDICT: REQUEST_CHANGES (Defects must be resolved by implementation worker)\n');
} else {
  console.log('VERDICT: APPROVE (All empirical challenger assertions passed)\n');
}
