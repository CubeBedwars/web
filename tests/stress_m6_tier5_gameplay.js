/**
 * tests/stress_m6_tier5_gameplay.js
 * 
 * ==============================================================================
 * MILESTONE 6 PHASE 2: TIER 5 WHITE-BOX ADVERSARIAL COVERAGE HARDENING
 * Voxel Bedwars — Gameplay Core, Physics, Projectiles, Textures, Maps, Mutations
 * ==============================================================================
 * 
 * Empirical challenger test harness asserting 64+ rigorous invariant checks across:
 * 1. High-Velocity Projectile Ballistics, Extremes & Boundary Stepping
 * 2. Compound, Conflicting & Concurrently Active Mutator Modifiers
 * 3. Voxel World Coordinate Extremes, Integer Raycasting & Map Beds
 * 4. Team Manager Lifecycle, Elimination Edge Cases & Combat State Machine
 */

import * as THREE from 'three';
import './mocks/browser-shim.js';
import { BLOCK_TYPES, BLOCK_PROPS, VoxelWorld } from '../src/engine/VoxelWorld.js';
import { TextureGenerator } from '../src/engine/TextureGenerator.js';
import { Projectile } from '../src/entities/Projectile.js';
import { Player } from '../src/entities/Player.js';
import { LocalPlayer } from '../src/entities/LocalPlayer.js';
import { MAP_PRESETS } from '../src/game/MapPresets.js';
import { TeamManager } from '../src/game/TeamManager.js';
import { MutationManager, GUN_GAME_TIERS } from '../src/game/MutationManager.js';
import { GameManager } from '../src/game/GameManager.js';

// ANSI terminal colors
const C = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  cyan: '\x1b[36m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  dim: '\x1b[2m',
};

console.log(`\n${C.bold}${C.cyan}╔══════════════════════════════════════════════════════════════════════╗${C.reset}`);
console.log(`${C.bold}${C.cyan}║   MILESTONE 6: TIER 5 WHITE-BOX ADVERSARIAL STRESS TEST HARNESS      ║${C.reset}`);
console.log(`${C.bold}${C.cyan}║       Deep Gameplay Invariants, Mutator Stacks & Boundary Checks     ║${C.reset}`);
console.log(`${C.bold}${C.cyan}╚══════════════════════════════════════════════════════════════════════╝${C.reset}\n`);

let totalChecks = 0;
let passedChecks = 0;
let failedChecks = 0;
const failures = [];
const startTime = Date.now();

function assert(condition, testId, message, details = '') {
  totalChecks++;
  if (condition) {
    passedChecks++;
    console.log(`  ${C.green}✔ [${testId}]${C.reset} ${message}`);
  } else {
    failedChecks++;
    const err = `[${testId}] ${message}${details ? ' -> ' + details : ''}`;
    console.error(`  ${C.red}✘ ${err}${C.reset}`);
    failures.push(err);
  }
}

function assertClose(actual, expected, tolerance = 1e-3, testId, message) {
  const diff = Math.abs(actual - expected);
  assert(diff <= tolerance, testId, `${message} (expected ~${expected}, got ${actual}, diff ${diff.toFixed(6)})`);
}

// ==============================================================================
// SUITE 1: HIGH-VELOCITY PROJECTILE BALLISTICS, BOUNDARY STEPPING & EXTREMES
// ==============================================================================
console.log(`\n${C.bold}${C.yellow}► SUITE 1: High-Velocity Projectile Ballistics, Extremes & Boundary Stepping${C.reset}`);

// 1.1 Zero Velocity & Pure Gravitational Fall
{
  const proj = new Projectile({
    position: new THREE.Vector3(0, 30, 0),
    velocity: new THREE.Vector3(0, 0, 0),
    gravity: -9.8,
  });

  const dt = 0.1;
  proj.update(dt, null, []);

  assert(proj.velocity.x === 0 && proj.velocity.z === 0, '1.1a', 'Zero initial velocity preserves horizontal x/z stationary state');
  assertClose(proj.velocity.y, -0.98, 1e-4, '1.1b', 'Velocity y integrates exact gravitational acceleration: v = g * dt');
  assertClose(proj.position.y, 30 - 0.098, 1e-4, '1.1c', 'Position y drops purely downwards along -Y axis');
}

// 1.2 Extreme Velocity & Discretized Stepping
{
  const scene = new THREE.Scene();
  const world = new VoxelWorld(scene);
  // Create thick barrier: blocks at x=8, 9, 10
  world.setBlock(8, 20, 0, BLOCK_TYPES.STONE);
  world.setBlock(9, 20, 0, BLOCK_TYPES.STONE);
  world.setBlock(10, 20, 0, BLOCK_TYPES.STONE);

  const proj = new Projectile({
    position: new THREE.Vector3(0.5, 20.5, 0.5),
    velocity: new THREE.Vector3(100, 0, 0),
    gravity: 0,
    radius: 0.3,
  });

  // dt = 0.08 -> displacement = 8.0 units -> reaches x=8.5 (inside stone barrier)
  const hit = proj.update(0.08, world, []);
  assert(hit !== null && hit.type.startsWith('hit_block'), '1.2a', 'High-velocity projectile landing inside multi-block barrier detects collision');
  assert(hit?.position.x >= 8 && hit?.position.x <= 10, '1.2b', 'Impact position corresponds to expected barrier voxel coordinate');

  // Verify discrete Euler displacement invariant
  const projTunnel = new Projectile({
    position: new THREE.Vector3(0.5, 20.5, 0.5),
    velocity: new THREE.Vector3(200, 0, 0),
    gravity: 0,
  });
  // 1-block thin wall at x=5
  const worldThin = new VoxelWorld(scene);
  worldThin.setBlock(5, 20, 0, BLOCK_TYPES.WOOL_RED);
  const stepDt = 0.1; // moves 20 blocks in one step
  const tunnelHit = projTunnel.update(stepDt, worldThin, []);
  assert(projTunnel.position.x === 20.5, '1.2c', 'Discrete integration step displaces exactly by velocity * dt');
  assert(tunnelHit === null, '1.2d', 'Discrete Euler stepping over 1-block thin wall skips collision when step > wall thickness (tunneling boundary)');
}

// 1.3 Zero and Negative DeltaTimes
{
  const proj = new Projectile({
    position: new THREE.Vector3(10, 10, 10),
    velocity: new THREE.Vector3(5, 2, -3),
    gravity: -10,
  });

  // Zero dt
  proj.update(0, null, []);
  assert(proj.position.x === 10 && proj.position.y === 10 && proj.position.z === 10, '1.3a', 'dt = 0 maintains exact position invariant');
  assert(proj.velocity.x === 5 && proj.velocity.y === 2 && proj.velocity.z === -3, '1.3b', 'dt = 0 maintains exact velocity invariant');
  assert(proj.lifetime === 0, '1.3c', 'dt = 0 advances lifetime by zero');

  // Negative dt
  proj.update(-1.0, null, []);
  assert(proj.position.x === 5, '1.3d', 'dt = -1.0 reverses position displacement along velocity vector');
  assert(proj.lifetime === -1.0, '1.3e', 'dt < 0 updates lifetime without NaN or exception');
}

// 1.4 Explosive Blast Hardness Selectivity
{
  const scene = new THREE.Scene();
  const world = new VoxelWorld(scene);
  const center = new THREE.Vector3(0, 20, 0);

  // Place fragile blocks
  world.setBlock(1, 20, 0, BLOCK_TYPES.WOOL_RED);
  world.setBlock(0, 21, 0, BLOCK_TYPES.WOOD);
  world.setBlock(-1, 20, 0, BLOCK_TYPES.DIRT);

  // Place blastProof & high hardness blocks
  world.setBlock(0, 19, 0, BLOCK_TYPES.OBSIDIAN);
  world.setBlock(0, 20, 1, BLOCK_TYPES.BEDROCK);
  world.setBlock(0, 20, -1, BLOCK_TYPES.GLASS);

  const fireball = new Projectile({
    position: center,
    explosive: true,
    explosionRadius: 2.5,
    damage: 15,
  });

  fireball.triggerExplosion(center, world, []);

  assert(world.getBlock(1, 20, 0) === BLOCK_TYPES.AIR, '1.4a', 'Fireball explosion obliterates fragile Wool blocks in blast radius');
  assert(world.getBlock(0, 21, 0) === BLOCK_TYPES.AIR, '1.4b', 'Fireball explosion obliterates Wood blocks in blast radius');
  assert(world.getBlock(-1, 20, 0) === BLOCK_TYPES.AIR, '1.4c', 'Fireball explosion obliterates Dirt blocks in blast radius');
  assert(world.getBlock(0, 19, 0) === BLOCK_TYPES.OBSIDIAN, '1.4d', 'Obsidian (hardness 12, blastProof) strictly resists fireball explosion');
  assert(world.getBlock(0, 20, 1) === BLOCK_TYPES.BEDROCK, '1.4e', 'Bedrock (hardness 99999) strictly resists fireball explosion');
  assert(world.getBlock(0, 20, -1) === BLOCK_TYPES.GLASS, '1.4f', 'Blast-Proof Glass (blastProof: true) strictly resists fireball explosion');
}

// 1.5 Projectile Entity Collision & Lifetime Expiration
{
  const owner = new Player('p_owner', 'Owner', 'red');
  const enemy = new Player('p_enemy', 'Enemy', 'blue');
  owner.position.set(0, 20, 0);
  enemy.position.set(5, 20, 0);

  const proj = new Projectile({
    position: new THREE.Vector3(0.5, 20.5, 0),
    velocity: new THREE.Vector3(10, 0, 0),
    gravity: 0,
    owner: owner,
    damage: 8,
    radius: 0.3,
  });

  // Collision with owner is ignored
  const hitOwner = proj.update(0.01, null, [owner]);
  assert(hitOwner === null, '1.5a', 'Projectile ignores shooter entity (no self-collision)');

  // Collision with dead enemy is ignored
  enemy.isDead = true;
  const hitDead = proj.update(0.45, null, [enemy]); // moves near x=5
  assert(hitDead === null, '1.5b', 'Projectile ignores dead players without triggering impact');

  // Revive enemy and test direct hit
  enemy.isDead = false;
  enemy.position.set(10, 20, 0);
  const proj2 = new Projectile({
    position: new THREE.Vector3(9.5, 20.5, 0),
    velocity: new THREE.Vector3(10, 0, 0),
    gravity: 0,
    owner: owner,
    damage: 6,
    explosive: false,
    radius: 0.3,
  });

  const hitEnemy = proj2.update(0.1, null, [enemy]);
  assert(hitEnemy !== null && hitEnemy.type === 'hit_player', '1.5c', 'Projectile impacts living enemy player');
  assert(enemy.health < 20, '1.5d', 'Enemy player takes direct damage from projectile hit');

  // Lifetime expiration
  const timedProj = new Projectile({ maxLifetime: 2.0 });
  timedProj.update(1.5, null, []);
  assert(!timedProj.isDead, '1.5e', 'Projectile remains active while lifetime < maxLifetime');
  timedProj.update(0.6, null, []);
  assert(timedProj.isDead, '1.5f', 'Projectile automatically self-destructs upon reaching maxLifetime');
}

// ==============================================================================
// SUITE 2: COMPOUND, CONFLICTING & CONCURRENTLY ACTIVE MUTATOR MODIFIERS
// ==============================================================================
console.log(`\n${C.bold}${C.yellow}► SUITE 2: Compound & Concurrently Active Mutator Modifiers${C.reset}`);

// 2.1 Hyper-Stack of All 9 Mutators Active Simultaneously
{
  const mm = new MutationManager();
  const allMutators = [
    'Supercharged', 'Launch Rush', 'Gun Game',
    'Lethal Strike', 'Low Gravity', 'Speed Demon',
    'Vampirism', 'Sudden Death', 'Lucky Chaos'
  ];

  allMutators.forEach(m => mm.enable(m));
  assert(mm.getActiveMutations().length === 9, '2.1a', 'All 9 mutators simultaneously registered in MutationManager active set');
  assert(mm.getGravity() === -8.0, '2.1b', 'Low Gravity active in hyper-stack sets physics gravity to -8.0');
  assert(mm.getSpeedMultiplier() === 1.5, '2.1c', 'Speed Demon active in hyper-stack sets player speed multiplier to 1.5');
  assert(mm.getDamageMultiplier() === 2.0, '2.1d', 'Lethal Strike active in hyper-stack sets damage multiplier to 2.0');
  assert(mm.getInitialGeneratorTier() === 2, '2.1e', 'Supercharged active in hyper-stack sets starting generator tier to 2');
}

// 2.2 Lethal Strike + Vampirism Compound Combat Invariants
{
  const mm = new MutationManager();
  mm.enable('Lethal Strike');
  mm.enable('Vampirism');

  const attacker = new Player('atk', 'Attacker', 'red');
  const victim = new Player('vic', 'Victim', 'blue');
  attacker.health = 10;
  victim.health = 20;

  // Base 6.0 damage -> Lethal Strike multiplies by 2.0 -> 12.0
  const finalDmg = mm.onDamage(attacker, victim, 6.0);
  assert(finalDmg === 12.0, '2.2a', 'Lethal Strike scales base 6.0 damage to 12.0');

  // Vampirism restores floor(12.0 * 0.25 * 2) / 2 = 3.0 HP
  assert(attacker.health === 13.0, '2.2b', 'Vampirism restores exactly 25% of the lethal-scaled damage (10 -> 13 HP)');

  // Health ceiling clamp check
  attacker.health = 19.0;
  mm.onDamage(attacker, victim, 10.0);
  assert(attacker.health === 20.0, '2.2c', 'Vampirism hit healing strictly respects maxHealth ceiling (never exceeds 20 HP)');

  // Kill bonus check
  attacker.health = 12.0;
  mm.onKill(attacker, victim);
  assert(attacker.health === 17.0, '2.2d', 'Vampirism onKill awards +5 HP restoration bonus');

  // Dead attacker cannot vampire-heal
  attacker.isDead = true;
  attacker.health = 0;
  mm.onDamage(attacker, victim, 10.0);
  assert(attacker.health === 0 && attacker.isDead, '2.2e', 'Dead attacker cannot gain health or resurrect via Vampirism onDamage');
  mm.onKill(attacker, victim);
  assert(attacker.health === 0 && attacker.isDead, '2.2f', 'Dead attacker cannot gain health or resurrect via Vampirism onKill');
}

// 2.3 Gun Game Kill Tier Upgrades Under Active Mutators
{
  const mm = new MutationManager();
  mm.enable('Gun Game');

  const p = new Player('p_gun', 'Gunner', 'green');
  mm.equipGunGameWeapon(p, 1);

  assert(p.gunGameTier === 1, '2.3a', 'Player starts with Tier 1 Gun Game weapon');
  assert(p.hotbar[0].id === 'gun_slingshot', '2.3b', 'Tier 1 weapon is Slingshot');

  const mockGm = { sound: {}, hud: {} };

  // 1st Kill -> Tier 2 Iron Crossbow
  mm.onKill(p, new Player('e1', 'E1', 'blue'), mockGm);
  assert(p.gunGameTier === 2 && p.hotbar[0].id === 'gun_crossbow', '2.3c', 'First kill upgrades to Tier 2: Iron Crossbow');

  // 2nd Kill -> Tier 3 Fireball Launcher
  mm.onKill(p, new Player('e2', 'E2', 'blue'), mockGm);
  assert(p.gunGameTier === 3 && p.hotbar[0].id === 'gun_fireball', '2.3d', 'Second kill upgrades to Tier 3: Fireball Launcher');

  // 3rd Kill -> Tier 4 Plasma Blaster
  mm.onKill(p, new Player('e3', 'E3', 'blue'), mockGm);
  assert(p.gunGameTier === 4 && p.hotbar[0].id === 'gun_plasma', '2.3e', 'Third kill upgrades to Tier 4: Plasma Blaster');

  // 4th+ Kill -> Caps cleanly at Tier 4
  mm.onKill(p, new Player('e4', 'E4', 'blue'), mockGm);
  assert(p.gunGameTier === 4 && p.hotbar[0].id === 'gun_plasma', '2.3f', 'Subsequent kills cap safely at maximum tier (Tier 4 Plasma Blaster)');
}

// 2.4 Sudden Death Bed Breakdown & Arena Decay Hardening
{
  const mm = new MutationManager();
  mm.enable('Sudden Death');

  assert(!mm.isSuddenDeathTriggered(599), '2.4a', 'Sudden Death is NOT triggered before 600 seconds');
  assert(mm.isSuddenDeathTriggered(600), '2.4b', 'Sudden Death triggers at exactly 600 seconds');
  assert(mm.isSuddenDeathTriggered(650), '2.4c', 'Sudden Death remains active past 600 seconds');

  // Test arena decay preservation of bedrock
  const scene = new THREE.Scene();
  const world = new VoxelWorld(scene);
  const gm = { world };

  // Place outer blocks at dist = 48 (safeRadius is 40, within rOuter scan window)
  world.setBlock(48, 20, 0, BLOCK_TYPES.STONE);
  world.setBlock(48, 18, 0, BLOCK_TYPES.BEDROCK);

  mm.decayArenaPerimeter(gm, 40);
  assert(world.getBlock(48, 20, 0) === BLOCK_TYPES.AIR, '2.4d', 'Sudden Death arena decay disintegrates perimeter stone blocks');
  assert(world.getBlock(48, 18, 0) === BLOCK_TYPES.BEDROCK, '2.4e', 'Sudden Death arena decay strictly preserves BEDROCK');
}

// ==============================================================================
// SUITE 3: VOXEL ENGINE COORDINATE EXTREMES, INTEGER RAYCASTING & MAP BEDS
// ==============================================================================
console.log(`\n${C.bold}${C.yellow}► SUITE 3: Voxel Engine Coordinate Extremes, Integer Raycasting & Map Beds${C.reset}`);

// 3.1 Voxel Grid Extremes & Memory Cleanup
{
  const scene = new THREE.Scene();
  const world = new VoxelWorld(scene);

  // Far negative and far positive coordinates
  world.setBlock(-10000, -64, -10000, BLOCK_TYPES.OBSIDIAN, { custom: 'neg' });
  world.setBlock(10000, 255, 10000, BLOCK_TYPES.DIAMOND_BLOCK, { custom: 'pos' });

  assert(world.getBlock(-10000, -64, -10000) === BLOCK_TYPES.OBSIDIAN, '3.1a', 'Stores and retrieves block at extreme negative coordinates (-10000, -64, -10000)');
  assert(world.getBlock(10000, 255, 10000) === BLOCK_TYPES.DIAMOND_BLOCK, '3.1b', 'Stores and retrieves block at extreme positive coordinates (10000, 255, 10000)');
  assert(world.getBlockData(-10000, -64, -10000)?.custom === 'neg', '3.1c', 'Metadata preserved at extreme negative coordinates');

  // Deleting blocks (setting to AIR) frees internal map storage
  world.setBlock(-10000, -64, -10000, BLOCK_TYPES.AIR);
  assert(world.getBlock(-10000, -64, -10000) === BLOCK_TYPES.AIR, '3.1d', 'Setting AIR clears block from voxel grid');
  assert(world.getBlockData(-10000, -64, -10000) === null, '3.1e', 'Setting AIR cleans up associated metadata');
}

// 3.2 Fast DDA Integer Raycasting Boundary Conditions
{
  const scene = new THREE.Scene();
  const world = new VoxelWorld(scene);

  // Place block at origin (0, 0, 0)
  world.setBlock(0, 0, 0, BLOCK_TYPES.STONE);

  // Ray from negative X towards +X
  const hitNegX = world.raycast(new THREE.Vector3(-4.5, 0.5, 0.5), new THREE.Vector3(1, 0, 0), 10);
  assert(hitNegX.hit === true, '3.2a', 'DDA raycast crossing negative to positive coordinate boundary registers hit');
  assert(hitNegX.blockPos.x === 0 && hitNegX.blockPos.y === 0 && hitNegX.blockPos.z === 0, '3.2b', 'Hit block coordinates accurately identify targeted voxel');
  assert(hitNegX.normal.x === -1 && hitNegX.normal.y === 0 && hitNegX.normal.z === 0, '3.2c', 'Hit face normal accurately returns (-1, 0, 0)');
  assert(hitNegX.placePos.x === -1 && hitNegX.placePos.y === 0 && hitNegX.placePos.z === 0, '3.2d', 'Adjacent placement position correctly computes blockPos + normal');

  // Ray originating precisely on integer boundary (-2.0, 0.5, 0.5)
  const hitBoundary = world.raycast(new THREE.Vector3(-2.0, 0.5, 0.5), new THREE.Vector3(1, 0, 0), 5);
  assert(hitBoundary.hit === true, '3.2e', 'DDA raycast starting exactly on integer boundary runs without deadlock or skip');

  // Zero direction vector
  const hitZero = world.raycast(new THREE.Vector3(0, 5, 0), new THREE.Vector3(0, 0, 0), 10);
  assert(hitZero.hit === false, '3.2f', 'Zero-length direction vector gracefully returns hit: false without NaN');

  // Beyond maxDistance
  const hitFar = world.raycast(new THREE.Vector3(-10, 0.5, 0.5), new THREE.Vector3(1, 0, 0), 5);
  assert(hitFar.hit === false, '3.2g', 'Target exceeding maxDistance returns hit: false');
}

// 3.3 Multi-Map Bed Geometry Integrity & Dual-Voxel Deduplication
{
  const presets = ['speedway', 'colosseum', 'octagon'];

  for (const pName of presets) {
    const preset = MAP_PRESETS[pName];
    assert(preset !== undefined, `3.3a_${pName}`, `Map preset "${pName}" exists`);
    assert(Array.isArray(preset.teams) && preset.teams.length >= 2, `3.3b_${pName}`, `Map "${pName}" defines at least 2 teams`);

    // Verify bed coordinates for each team
    for (const team of preset.teams) {
      const bed = preset.beds[team];
      assert(bed && bed.head && bed.foot, `3.3c_${pName}_${team}`, `Map "${pName}" team "${team}" defines head and foot bed coordinates`);
      // Head and foot must be adjacent (Manhattan distance === 1)
      const dist = Math.abs(bed.head.x - bed.foot.x) + Math.abs(bed.head.y - bed.foot.y) + Math.abs(bed.head.z - bed.foot.z);
      assert(dist === 1, `3.3d_${pName}_${team}`, `Bed head and foot are strictly adjacent (Manhattan dist = 1) for team "${team}" in "${pName}"`);
    }
  }

  // Bed breaking deduplication
  const tm = new TeamManager(['red', 'blue']);
  assert(tm.hasBed('red') === true, '3.3e', 'Team bed initializes with hasBed = true');
  const firstBreak = tm.destroyBed('red');
  assert(firstBreak === true && tm.hasBed('red') === false, '3.3f', 'First bed destruction transitions hasBed to false');
  const secondBreak = tm.destroyBed('red');
  assert(tm.hasBed('red') === false, '3.3g', 'Second bed destruction maintains hasBed = false without toggling');

  // Bedrock hardness invariant
  assert(BLOCK_PROPS[BLOCK_TYPES.BEDROCK].hardness >= 99999, '3.3h', 'Bedrock block hardness is configured to >= 99999 (unbreakable)');
}

// ==============================================================================
// SUITE 4: TEAM MANAGER LIFECYCLE, ELIMINATION EDGE CASES & COMBAT STATE MACHINE
// ==============================================================================
console.log(`\n${C.bold}${C.yellow}► SUITE 4: Team Manager Lifecycle & Combat State Machine Invariants${C.reset}`);

// 4.1 Simultaneous Elimination of All Teams
{
  const tm = new TeamManager(['red', 'blue', 'green', 'yellow']);
  const players = [
    new Player('p1', 'R1', 'red'),
    new Player('p2', 'B1', 'blue'),
    new Player('p3', 'G1', 'green'),
    new Player('p4', 'Y1', 'yellow'),
  ];

  players.forEach(p => tm.registerPlayer(p));
  assert(tm.getAliveTeams().length === 4, '4.1a', 'All 4 teams initially reported alive in getAliveTeams()');

  // Destroy all beds
  ['red', 'blue', 'green', 'yellow'].forEach(t => tm.destroyBed(t));

  // Simultaneous mutual wipeout: all players final-killed
  players.forEach(p => {
    p.isDead = true;
    p.isFinalDead = true;
  });

  const aliveAfterWipeout = tm.getAliveTeams();
  assert(aliveAfterWipeout.length === 0, '4.1b', 'Simultaneous wipeout of all teams results in empty alive teams list ([])');
  assert(tm.isTeamEliminated('red') === true, '4.1c', 'Red team reported eliminated');
  assert(tm.isTeamEliminated('blue') === true, '4.1d', 'Blue team reported eliminated');

  // Team with bed INTACT is NOT eliminated even if all its players are dead
  const tm2 = new TeamManager(['red']);
  const pRed = new Player('pr', 'Red', 'red');
  tm2.registerPlayer(pRed);
  pRed.isDead = true;
  assert(tm2.isTeamEliminated('red') === false, '4.1e', 'Team with bed INTACT is NOT eliminated when players are dead (awaiting respawn)');
}

// 4.2 Player Registration & State Transitions
{
  const tm = new TeamManager(['red']);
  const p = new Player('p1', 'Tester', 'red');

  tm.registerPlayer(p);
  tm.registerPlayer(p); // Duplicate registration attempt
  assert(tm.getTeam('red').players.length === 1, '4.2a', 'Duplicate registerPlayer call is idempotent (avoids array duplication)');

  // Re-registering dead player maintains dead state
  p.isDead = true;
  p.isFinalDead = true;
  tm.registerPlayer(p);
  assert(p.isDead === true && p.isFinalDead === true, '4.2b', 'Re-registering does not reset dead or finalDead state');

  // Resource spending bounds
  p.resources.iron = 10;
  assert(p.spendResource('iron', 5) === true && p.resources.iron === 5, '4.2c', 'spendResource deducts exact amount when available');
  assert(p.spendResource('iron', 10) === false && p.resources.iron === 5, '4.2d', 'spendResource rejects overspending and preserves balance');
}

// 4.3 Combat Attribution Window (10-Second Tagger)
{
  const killer = new Player('k', 'Killer', 'red');
  const victim = new Player('v', 'Victim', 'blue');

  // Attack and tag victim
  victim.takeDamage(5.0, killer);
  assert(victim.lastAttacker === killer, '4.3a', 'takeDamage tags attacker for combat attribution');
  assert(victim.lastAttackTimestamp > 0, '4.3b', 'takeDamage records attack timestamp');

  // Victim dies immediately (e.g. void fall within 10s window) without direct killer argument
  victim.die(null);
  assert(killer.kills === 1, '4.3c', 'Combat tagger credits kill to attacker within 10-second attribution window');

  // Final kill attribution check
  victim.isDead = false;
  victim.isFinalDead = true;
  victim.takeDamage(5.0, killer);
  victim.die(killer);
  assert(killer.finalKills === 1, '4.3d', 'Final kill counter increments when victim has isFinalDead = true');

  // Expired attribution window (>10 seconds)
  victim.isDead = false;
  victim.takeDamage(5.0, killer);
  victim.lastAttackTimestamp = Date.now() - 15000; // 15 seconds ago
  const killsBefore = killer.kills;
  victim.die(null);
  assert(killer.kills === killsBefore, '4.3e', 'Combat attribution expires after 10 seconds (no kill credited to stale attacker)');
}

// 4.4 Combat Upgrades: Sharpness & Protection Integration
{
  const tm = new TeamManager(['red', 'blue']);
  const attacker = new Player('atk', 'Sharp', 'red');
  const defender = new Player('def', 'Prot', 'blue');
  attacker.teamManager = tm;
  defender.teamManager = tm;

  // Base attack damage
  const baseDmg = attacker.getAttackDamage(tm);
  assert(baseDmg === 4.0, '4.4a', 'Base attack damage defaults to 4.0 (Wooden Sword)');

  // Apply Sharpness Tier 1 (+1.25)
  tm.teams.red.upgrades.sharpness = 1;
  assert(attacker.getAttackDamage(tm) === 5.25, '4.4b', 'Sharpness Tier 1 increases weapon damage to 5.25 (+1.25)');

  // Apply Protection Tier 2 (20% reduction) + Iron Armor (20% reduction)
  tm.teams.blue.upgrades.protection = 2;
  defender.setArmor('iron', 0.20);
  const healthBefore = defender.health;
  // Attack for 10 base damage
  defender.takeDamage(10.0, null, null, tm);
  const damageTaken = healthBefore - defender.health;
  // Expected: 10 * (1 - 0.2) * (1 - 0.2) = 6.4 damage
  assertClose(damageTaken, 6.4, 1e-3, '4.4c', 'Compound Armor (20%) + Protection Tier 2 (20%) reduces 10 damage to 6.4');
  assert(defender.health >= 0, '4.4d', 'Compounded protection never generates negative damage');
}

// ==============================================================================
// TEST EXECUTION SUMMARY
// ==============================================================================
const durationMs = Date.now() - startTime;

console.log(`\n${C.bold}${C.yellow}══════════════════════════════════════════════════════════════════════${C.reset}`);
console.log(`${C.bold}MILESTONE 6 PHASE 2 TIER 5 TEST HARNESS SUMMARY:${C.reset}`);
console.log(`  Total Checks:    ${C.bold}${totalChecks}${C.reset}`);
console.log(`  Passed:          ${C.green}${C.bold}${passedChecks}${C.reset}`);
console.log(`  Failed:          ${failedChecks > 0 ? C.red : C.green}${C.bold}${failedChecks}${C.reset}`);
console.log(`  Duration:        ${durationMs}ms`);
console.log(`${C.bold}${C.yellow}══════════════════════════════════════════════════════════════════════${C.reset}\n`);

if (failedChecks > 0) {
  console.error(`${C.bold}${C.red}FAILURES IDENTIFIED:${C.reset}`);
  failures.forEach(f => console.error(`  - ${f}`));
  process.exit(1);
} else {
  console.log(`${C.bold}${C.green}ALL ${totalChecks} TIER 5 INVARIANT CHECKS PASSED EMPIRICALLY!${C.reset}\n`);
  process.exit(0);
}
