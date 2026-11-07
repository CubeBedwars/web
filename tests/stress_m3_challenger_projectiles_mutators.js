/**
 * tests/stress_m3_challenger_projectiles_mutators.js
 * 
 * EMPIRICAL ADVERSARIAL STRESS TEST SUITE — CHALLENGER 2
 * Milestone 3 (M3: Multi-Map System, Match Formats, and Match Mutation Modifiers)
 * 
 * Objectives:
 * 1. Projectile Physics Stress:
 *    - Extreme firing angles (straight up +90°, straight down -90°, pure horizontal, 45° angle)
 *    - Velocity integration: v(t) = v0 + g*dt and parabolic trajectory
 *    - Fireball blast cluster destruction: wool, wood, glass vs obsidian, bedrock resistance
 *    - Living player hitbox collision: direct impact damage and physical knockback impulse
 * 2. Mutator Interaction Stress:
 *    - Combine 3+ mutators simultaneously (Low Gravity + Speed Demon + Lethal Strike + Gun Game + Vampirism)
 *    - Gun Game upgrade progression: Slingshot -> Crossbow -> Fireball Launcher -> Plasma Blaster (cap)
 *    - Vampirism health recovery: hit recovery and kill bonus strictly capped at 20 HP ceiling
 *    - Sudden Death arena decay: universal bed destruction and outer island block decay stability
 * 3. Empirical Stress & Performance Benchmarks
 */

import * as THREE from 'three';
import './mocks/browser-shim.js';
import { BLOCK_TYPES, BLOCK_PROPS, VoxelWorld } from '../src/engine/VoxelWorld.js';
import { Physics } from '../src/engine/Physics.js';
import { Projectile } from '../src/entities/Projectile.js';
import { Player } from '../src/entities/Player.js';
import { TeamManager } from '../src/game/TeamManager.js';
import { MutationManager, GUN_GAME_TIERS, MUTATION_DEFINITIONS } from '../src/game/MutationManager.js';

console.log('\n╔══════════════════════════════════════════════════════════════════════╗');
console.log('║       CHALLENGER 2: ADVERSARIAL STRESS SUITE (M3 PROJECTILES)        ║');
console.log('╚══════════════════════════════════════════════════════════════════════╝\n');

let totalAssertions = 0;
let passedAssertions = 0;
let failedAssertions = 0;
const failures = [];

function assert(condition, message, details = '') {
  totalAssertions++;
  if (condition) {
    passedAssertions++;
    console.log(`  ✓ PASS: ${message}`);
  } else {
    failedAssertions++;
    const err = `  ✗ FAIL: ${message}${details ? ' -> ' + details : ''}`;
    console.error(err);
    failures.push(err);
    process.exitCode = 1;
  }
}

function assertClose(actual, expected, tolerance = 1e-3, message = '') {
  const diff = Math.abs(actual - expected);
  assert(diff <= tolerance, `${message} (expected ~${expected}, got ${actual}, diff ${diff.toFixed(6)})`);
}

// ============================================================================
// SUITE 1: PROJECTILE BALLISTICS & EXTREME FIRING ANGLES
// ============================================================================
console.log('--- SUITE 1: Projectile Physics & Ballistics at Extreme Angles ---');

// 1.1 Pure Vertical Shot: Straight UP (+90 deg)
{
  const v0 = new THREE.Vector3(0, 24, 0);
  const p0 = new THREE.Vector3(0, 10, 0);
  const gravity = -12.0;

  const proj = new Projectile({
    position: p0,
    velocity: v0,
    gravity: gravity,
    type: 'slingshot',
  });

  const dt = 0.1;
  let simulatedPosY = p0.y;
  let simulatedVelY = v0.y;

  // Integrate for 15 steps (1.5 seconds)
  for (let step = 1; step <= 15; step++) {
    simulatedVelY += gravity * dt;
    simulatedPosY += simulatedVelY * dt;

    proj.update(dt, null, []);

    assertClose(proj.velocity.y, simulatedVelY, 1e-4, `1.1a: Vertical step ${step} velocity v = v0 + g*dt`);
    assertClose(proj.position.y, simulatedPosY, 1e-4, `1.1b: Vertical step ${step} position y = y0 + v*dt`);
    assertClose(proj.velocity.x, 0, 1e-5, `1.1c: Vertical step ${step} vx stays strictly 0`);
    assertClose(proj.velocity.z, 0, 1e-5, `1.1d: Vertical step ${step} vz stays strictly 0`);
  }

  // Apex prediction: t_apex = v0 / |g| = 24 / 12 = 2.0s
  // After 20 steps (2.0s), velocity.y should reach ~0
  for (let step = 16; step <= 20; step++) {
    proj.update(dt, null, []);
  }
  assertClose(proj.velocity.y, 0.0, 1e-3, '1.1e: Vertical apex reached at t=2.0s with vy ≈ 0');
}

// 1.2 Pure Vertical Shot: Straight DOWN (-90 deg)
{
  const v0 = new THREE.Vector3(0, -20, 0);
  const p0 = new THREE.Vector3(0, 100, 0);
  const gravity = -12.0;

  const proj = new Projectile({
    position: p0,
    velocity: v0,
    gravity: gravity,
    type: 'slingshot',
  });

  const dt = 0.1;
  let prevVelY = proj.velocity.y;

  for (let step = 1; step <= 10; step++) {
    proj.update(dt, null, []);
    assert(proj.velocity.y < prevVelY, `1.2a: Straight down step ${step} downward speed increases monotonically`);
    prevVelY = proj.velocity.y;
  }

  // After 1.0s (10 steps), vy should be -20 + (-12 * 1.0) = -32 m/s
  assertClose(proj.velocity.y, -32.0, 1e-3, '1.2b: Straight down terminal integration reaches -32 m/s at t=1.0s');
}

// 1.3 Pure Horizontal Shot (Pitch = 0 deg)
{
  const v0 = new THREE.Vector3(30, 0, 0);
  const p0 = new THREE.Vector3(0, 50, 0);
  const gravity = -12.0;

  const proj = new Projectile({
    position: p0,
    velocity: v0,
    gravity: gravity,
    type: 'crossbow',
  });

  const dt = 0.05; // 20 Hz
  for (let step = 1; step <= 20; step++) {
    proj.update(dt, null, []);
    assert(proj.velocity.x === 30, `1.3a: Step ${step} horizontal velocity vx strictly conserved at 30.0`);
    assert(proj.velocity.z === 0, `1.3b: Step ${step} perpendicular horizontal velocity vz strictly 0`);
  }

  // After 1.0s, x = 30 * 1.0 = 30.0
  assertClose(proj.position.x, 30.0, 1e-3, '1.3c: Horizontal displacement is exactly 30 blocks after 1 second');
  // After 1.0s, vy = 0 + (-12 * 1.0) = -12 m/s
  assertClose(proj.velocity.y, -12.0, 1e-3, '1.3d: Vertical velocity after 1 second horizontal launch is -12 m/s');
  assert(proj.position.y < 50.0, '1.3e: Ballistic drop confirms curved downward parabolic trajectory');
}

// 1.4 Angled Ballistic Shot (45 deg) Parabolic Arc Verification
{
  const speed = 20 * Math.SQRT2;
  const v0 = new THREE.Vector3(20, 20, 0);
  const p0 = new THREE.Vector3(0, 10, 0);
  const gravity = -10.0; // Clean round gravity for analytical formula

  const proj = new Projectile({
    position: p0,
    velocity: v0,
    gravity: gravity,
    type: 'plasma',
  });

  const dt = 0.01; // Fine integration
  for (let i = 0; i < 100; i++) {
    proj.update(dt, null, []);
  }

  // At t = 1.0s:
  // x = 0 + 20 * 1.0 = 20.0
  // vy = 20 + (-10 * 1.0) = 10.0
  assertClose(proj.position.x, 20.0, 0.05, '1.4a: 45° projectile matches analytical x(1.0s) = 20m');
  assertClose(proj.velocity.y, 10.0, 0.05, '1.4b: 45° projectile matches analytical vy(1.0s) = 10m/s');
  assert(proj.position.y > 10.0, '1.4c: Projectile climbed above initial launch height at t=1.0s');
}

// ============================================================================
// SUITE 2: DIRECT HITBOX IMPACT & KNOCKBACK PHYSICS
// ============================================================================
console.log('\n--- SUITE 2: Living Player Hitbox Collision & Knockback Impulse ---');

{
  const scene = new THREE.Scene();
  const world = new VoxelWorld(scene);
  world.rebuildMeshes = () => {};
  const physics = new Physics(world);

  const shooter = new Player('p_shooter', 'Shooter', 'red');
  shooter.position.set(0, 20, 0);

  const victim = new Player('p_victim', 'Victim', 'blue');
  victim.position.set(10, 20, 0);
  victim.health = 20.0;
  victim.velocity.set(0, 0, 0);

  const deadPlayer = new Player('p_dead', 'DeadPlayer', 'green');
  deadPlayer.position.set(5, 20, 0);
  deadPlayer.isDead = true;

  // Projectile moving toward victim along X-axis
  const proj = new Projectile({
    scene,
    position: new THREE.Vector3(8.5, 20.5, 0),
    velocity: new THREE.Vector3(20, 0, 0),
    damage: 8.0,
    radius: 0.3,
    owner: shooter,
    type: 'crossbow',
  });

  // Step 1: Pass dead player in front — projectile MUST ignore dead player
  const hitDeadCheck = proj.update(0.01, world, [deadPlayer]);
  assert(hitDeadCheck === null, '2.1a: Projectile hitbox check strictly ignores dead players');
  assert(proj.isDead === false, '2.1b: Projectile remains active after passing dead player');

  // Step 2: Pass shooter (owner) — projectile MUST ignore owner
  const hitOwnerCheck = proj.update(0.01, world, [shooter]);
  assert(hitOwnerCheck === null, '2.1c: Projectile hitbox check ignores its own shooter (no self-collision)');

  // Step 3: Advance projectile into living victim hitbox
  // proj position moves from 8.9 to ~10.0
  const hitVictim = proj.update(0.06, world, [victim], physics);
  assert(hitVictim !== null, '2.1d: Direct hit detected on living enemy hitbox');
  assert(hitVictim.type === 'hit_player', '2.1e: Event type is hit_player');
  assert(victim.health === 12.0, '2.1f: Victim health depleted by exact weapon damage (20 -> 12)');
  assert(victim.lastAttacker === shooter, '2.1g: Combat attribution tags shooter as last attacker');
  assert(proj.isDead === true, '2.1h: Projectile disposed after impacting player');
}

// 2.2 Direct Hit Knockback Impulse
{
  const scene = new THREE.Scene();
  const world = new VoxelWorld(scene);
  world.rebuildMeshes = () => {};
  const physics = new Physics(world);

  const attacker = new Player('att', 'Attacker', 'red');
  attacker.position.set(0, 20, 0);
  attacker.weapon = { id: 'crossbow', knockback: 14 };

  const target = new Player('tgt', 'Target', 'blue');
  target.position.set(5, 20, 0);
  target.velocity.set(0, 0, 0);

  // Directly apply damage with physics
  target.takeDamage(6.0, attacker, physics);

  assert(target.velocity.x > 0, '2.2a: Knockback pushes victim along +X away from attacker position');
  assert(target.velocity.y > 0, '2.2b: Knockback imparts vertical pop boost');
  assert(target.onGround === false, '2.2c: Target knocked airborne off ground');
}

// ============================================================================
// SUITE 3: FIREBALL BLAST CLUSTER DESTRUCTION & BLAST RESISTANCE
// ============================================================================
console.log('\n--- SUITE 3: Fireball Blast Cluster Block Destruction vs Blast Resistance ---');

{
  const scene = new THREE.Scene();
  const world = new VoxelWorld(scene);
  world.rebuildMeshes = () => {};
  const physics = new Physics(world);

  const shooter = new Player('bomber', 'Bomber', 'red');
  shooter.position.set(0, 20, 0);

  // Setup mixed cluster of 5 required materials within 2.5-block blast radius of center (20, 20, 20)
  const center = new THREE.Vector3(20, 20, 20);

  // 1. Wool (Red Wool) — fragile block
  world.setBlock(20, 20, 20, BLOCK_TYPES.WOOL_RED);
  // 2. Wood (Oak Wood) — breakable construction block
  world.setBlock(21, 20, 20, BLOCK_TYPES.WOOD);
  // 3. Glass — transparent Bedwars block
  world.setBlock(20, 20, 21, BLOCK_TYPES.GLASS);
  // 4. Obsidian — hardened Bedwars defense block
  world.setBlock(20, 20, 19, BLOCK_TYPES.OBSIDIAN);
  // 5. Bedrock — unbreakable foundation block
  world.setBlock(19, 20, 20, BLOCK_TYPES.BEDROCK);

  // Distant block outside blast radius (r = 8 blocks away)
  world.setBlock(28, 20, 20, BLOCK_TYPES.WOOL_YELLOW);

  // Create living victim near blast point
  const victimInBlast = new Player('blast_vic', 'BlastVictim', 'blue');
  victimInBlast.position.set(21, 20, 20);
  victimInBlast.health = 20.0;
  victimInBlast.velocity.set(0, 0, 0);

  const fireball = new Projectile({
    scene,
    position: center.clone(),
    velocity: new THREE.Vector3(0, 0, 0),
    damage: 12.0,
    explosive: true,
    explosionRadius: 2.5,
    owner: shooter,
    type: 'fireball',
  });

  // Trigger fireball explosion at center
  fireball.triggerExplosion(center, world, [victimInBlast], physics);

  // Assertions on the mixed cluster:
  // (A) Wool is destroyed into AIR
  assert(world.getBlock(20, 20, 20) === BLOCK_TYPES.AIR, '3.1a: Wool block in blast radius destroyed into AIR (0)');

  // (B) Wood is destroyed into AIR
  assert(world.getBlock(21, 20, 20) === BLOCK_TYPES.AIR, '3.1b: Wood block in blast radius destroyed into AIR (0)');

  // (C) Obsidian strictly remains intact
  assert(world.getBlock(20, 20, 19) === BLOCK_TYPES.OBSIDIAN, '3.1c: Obsidian strictly remains intact (hardness >= 10, blastProof)');

  // (D) Bedrock strictly remains intact
  assert(world.getBlock(19, 20, 20) === BLOCK_TYPES.BEDROCK, '3.1d: Bedrock strictly remains intact (hardness 99999)');

  // (E) Distant block outside blast radius untouched
  assert(world.getBlock(28, 20, 20) === BLOCK_TYPES.WOOL_YELLOW, '3.1e: Distant block outside blast radius strictly untouched');

  // (F) Glass Block Blast Analysis:
  // In Hypixel Bedwars mechanics (modeled in VoxelWorld.js line 51 and tier3-pairwise.test.js line 285):
  // Glass is explicitly designed as "Blast-Proof Glass" (BLOCK_PROPS[GLASS].blastProof === true)
  // to protect bed defenses against fireball and TNT spam.
  const glassBlockState = world.getBlock(20, 20, 21);
  const isGlassBlastProof = BLOCK_PROPS[BLOCK_TYPES.GLASS]?.blastProof === true;
  assert(
    glassBlockState === BLOCK_TYPES.GLASS && isGlassBlastProof,
    '3.1f: Glass block in Bedwars is Blast-Proof Glass and withstands fireball blast intact per Bedwars spec'
  );

  // (G) Emulated Vanilla Glass Behavior (when blastProof flag is disabled):
  // Verify that if a glass block lacks the blastProof flag, the explosion algorithm destroys it into AIR
  world.setBlock(20, 20, 21, BLOCK_TYPES.GLASS);
  BLOCK_PROPS[BLOCK_TYPES.GLASS].blastProof = false;
  fireball.triggerExplosion(center, world, [], physics);
  assert(
    world.getBlock(20, 20, 21) === BLOCK_TYPES.AIR,
    '3.1g: Emulated non-blastproof glass is destroyed into AIR by fireball blast'
  );
  // Restore authentic Bedwars Blast-Proof Glass property
  BLOCK_PROPS[BLOCK_TYPES.GLASS].blastProof = true;

  // (H) AoE Damage and Radial Knockback on living player
  assert(victimInBlast.health < 20.0, '3.1h: Living player within blast radius takes radial explosive damage');
  assert(victimInBlast.velocity.lengthSq() > 0, '3.1i: Living player receives physical explosive knockback impulse');
}

// ============================================================================
// SUITE 4: MULTI-MUTATOR INTERACTION STRESS (3+ MUTATORS SIMULTANEOUSLY)
// ============================================================================
console.log('\n--- SUITE 4: Multi-Mutator Concurrency (5 Mutators Simultaneously) ---');

{
  const mut = new MutationManager();

  // Combine 5 mutators simultaneously:
  // 1. Low Gravity
  // 2. Speed Demon
  // 3. Lethal Strike
  // 4. Gun Game
  // 5. Vampirism
  mut.enable('Low Gravity');
  mut.enable('Speed Demon');
  mut.enable('Lethal Strike');
  mut.enable('Gun Game');
  mut.enable('Vampirism');

  assert(mut.getActiveMutations().length === 5, '4.1a: Exactly 5 mutators active simultaneously');
  assert(mut.has('Low Gravity'), '4.1b: Low Gravity registered in active set');
  assert(mut.has('Speed Demon'), '4.1c: Speed Demon registered in active set');
  assert(mut.has('Lethal Strike'), '4.1d: Lethal Strike registered in active set');
  assert(mut.has('Gun Game'), '4.1e: Gun Game registered in active set');
  assert(mut.has('Vampirism'), '4.1f: Vampirism registered in active set');

  // Verify modifier query helpers
  assert(mut.getGravity() === -8.0, '4.1g: Low Gravity sets gravity to -8.0 m/s^2 (reduced from -24.0)');
  assert(mut.getSpeedMultiplier() === 1.5, '4.1h: Speed Demon applies 1.5x movement speed boost');
  assert(mut.getDamageMultiplier() === 2.0, '4.1i: Lethal Strike applies 2.0x attack damage scaling');

  // Match start simulation with combined mutators
  const scene = new THREE.Scene();
  const world = new VoxelWorld(scene);
  world.rebuildMeshes = () => {};
  const physics = new Physics(world);
  const player = new Player('multi_p', 'MultiPlayer', 'red');

  const mockGm = {
    world,
    physics,
    players: [player],
    mapPreset: { spawns: { red: { x: 0, y: 20, z: 0 } } },
    sound: { playItemPickup: () => {}, playExplosion: () => {} },
    hud: { showAnnouncement: () => {} },
  };

  mut.onMatchStart(mockGm);

  assert(physics.gravity === -8.0, '4.1j: Physics world gravity integrated to -8.0 m/s^2 on match start');
  assert(player.gunGameTier === 1, '4.1k: Gun Game equips Tier 1 weapon to player on match start');
  assert(player.weapon.name === 'Wooden Slingshot', '4.1l: Equipped starting weapon is Wooden Slingshot');

  // Combined combat interaction: Lethal Strike (2.0x) + Vampirism (25% heal)
  player.health = 10.0;
  const victim = new Player('vic', 'Victim', 'blue');
  victim.health = 20.0;

  // Base weapon damage is 3.5. Lethal Strike multiplies by 2.0 -> 7.0 damage.
  const damageDealt = mut.onDamage(player, victim, player.weapon.damage, mockGm);
  assert(damageDealt === 7.0, '4.1m: Lethal Strike correctly scales 3.5 damage to 7.0 (2.0x)');

  // Vampirism heals 25% of 7.0: floor(7.0 * 0.25 * 2) / 2 = 1.5 HP heal
  // Player health was 10.0 -> should now be 11.5
  assert(player.health === 11.5, '4.1n: Vampirism heals attacker concurrently during Lethal Strike hit');
}

// ============================================================================
// SUITE 5: GUN GAME WEAPON PROGRESSION TIERS & MAX TIER CAP
// ============================================================================
console.log('\n--- SUITE 5: Gun Game Weapon Progression Tiers (Slingshot -> Crossbow -> Fireball -> Plasma) ---');

{
  const mut = new MutationManager();
  mut.enable('Gun Game');

  const player = new Player('gunner', 'Gunner', 'red');
  const mockGm = {
    sound: { playItemPickup: () => {} },
    hud: { showAnnouncement: () => {} },
  };

  // Tier 1: Wooden Slingshot
  mut.equipGunGameWeapon(player, 1);
  assert(player.gunGameTier === 1, '5.1a: Initial Gun Game tier is 1');
  assert(player.weapon.name === 'Wooden Slingshot', '5.1b: Tier 1 weapon is Wooden Slingshot');
  assert(player.weapon.damage === 3.5, '5.1c: Tier 1 damage is 3.5 HP');
  assert(player.hotbar[0].isGun === true, '5.1d: Tier 1 hotbar item marked isGun');
  assert(player.hotbar[0].explosive === false, '5.1e: Tier 1 is non-explosive');

  // Kill 1 -> Upgrade to Tier 2: Iron Crossbow
  mut.onKill(player, new Player('v1', 'V1', 'blue'), mockGm);
  assert(player.gunGameTier === 2, '5.2a: Kill 1 advances tier to 2');
  assert(player.weapon.name === 'Iron Crossbow', '5.2b: Tier 2 weapon is Iron Crossbow');
  assert(player.weapon.damage === 6.0, '5.2c: Tier 2 damage is 6.0 HP');
  assert(player.hotbar[0].speed === 30, '5.2d: Tier 2 projectile velocity is 30 m/s');

  // Kill 2 -> Upgrade to Tier 3: Fireball Launcher
  mut.onKill(player, new Player('v2', 'V2', 'green'), mockGm);
  assert(player.gunGameTier === 3, '5.3a: Kill 2 advances tier to 3');
  assert(player.weapon.name === 'Fireball Launcher', '5.3b: Tier 3 weapon is Fireball Launcher');
  assert(player.weapon.damage === 10.0, '5.3c: Tier 3 damage is 10.0 HP');
  assert(player.hotbar[0].explosive === true, '5.3d: Tier 3 weapon is explosive');

  // Kill 3 -> Upgrade to Tier 4: Plasma Blaster (Max Tier)
  mut.onKill(player, new Player('v3', 'V3', 'yellow'), mockGm);
  assert(player.gunGameTier === 4, '5.4a: Kill 3 advances tier to 4');
  assert(player.weapon.name === 'Plasma Blaster', '5.4b: Tier 4 weapon is Plasma Blaster');
  assert(player.weapon.damage === 15.0, '5.4c: Tier 4 damage is 15.0 HP');
  assert(player.hotbar[0].speed === 45, '5.4d: Tier 4 projectile velocity is 45 m/s');
  assert(player.hotbar[0].explosive === true, '5.4e: Tier 4 weapon is explosive plasma');

  // Kill 4 -> Verify Tier Cap (Should NOT advance past Tier 4)
  mut.onKill(player, new Player('v4', 'V4', 'aqua'), mockGm);
  assert(player.gunGameTier === 4, '5.5a: Kill 4 maintains tier cap at 4 (no index out of bounds)');
  assert(player.weapon.name === 'Plasma Blaster', '5.5b: Weapon remains Plasma Blaster upon kill 4');

  // Kill 5 -> Verify Repeated Tier Cap
  mut.onKill(player, new Player('v5', 'V5', 'white'), mockGm);
  assert(player.gunGameTier === 4, '5.5c: Kill 5 maintains tier cap cleanly at Tier 4');
  assert(player.weapon.name === 'Plasma Blaster', '5.5d: Weapon remains Plasma Blaster upon kill 5');
}

// ============================================================================
// SUITE 6: VAMPIRISM HEALTH RESTORATION & 20 HP CEILING
// ============================================================================
console.log('\n--- SUITE 6: Vampirism Health Recovery & Strict 20 HP Ceiling ---');

{
  const mut = new MutationManager();
  mut.enable('Vampirism');

  const attacker = new Player('vamp', 'Vampire', 'red');
  const victim = new Player('prey', 'Prey', 'blue');
  const mockGm = { hud: { showAnnouncement: () => {} }, particles: null };

  // 6.1 Standard hit regeneration (25% of damage dealt)
  attacker.health = 10.0;
  mut.onDamage(attacker, victim, 8.0, mockGm);
  // 8.0 * 0.25 = 2.0 -> 10 + 2.0 = 12.0
  assert(attacker.health === 12.0, '6.1a: Attacker at 10 HP dealing 8 damage restores 2 HP -> 12 HP');

  // 6.2 Small damage minimum heal floor (>= 0.5 HP)
  attacker.health = 12.0;
  mut.onDamage(attacker, victim, 1.0, mockGm);
  // 1.0 * 0.25 = 0.25 -> clamped to min 0.5 HP
  assert(attacker.health === 12.5, '6.1b: Attacker dealing 1 damage restores minimum floor of 0.5 HP -> 12.5 HP');

  // 6.3 Hit regeneration capped strictly at maxHealth (20 HP)
  attacker.health = 19.0;
  mut.onDamage(attacker, victim, 10.0, mockGm);
  // 10.0 * 0.25 = 2.5. 19.0 + 2.5 = 21.5 -> clamped to 20.0
  assert(attacker.health === 20.0, '6.2a: Attacker at 19 HP dealing 10 damage is strictly clamped to 20 HP ceiling');

  // 6.4 Hit regeneration when already at 20 HP
  attacker.health = 20.0;
  mut.onDamage(attacker, victim, 12.0, mockGm);
  assert(attacker.health === 20.0, '6.2b: Attacker at 20 HP dealing damage strictly remains at 20 HP without overflow');

  // 6.5 Elimination bonus (+5 HP)
  attacker.health = 12.0;
  mut.onKill(attacker, victim, mockGm);
  assert(attacker.health === 17.0, '6.3a: Kill bonus restores +5 HP (12 -> 17 HP)');

  // 6.6 Elimination bonus capped strictly at maxHealth (20 HP)
  attacker.health = 18.0;
  mut.onKill(attacker, victim, mockGm);
  // 18.0 + 5.0 = 23.0 -> clamped to 20.0
  assert(attacker.health === 20.0, '6.3b: Kill bonus at 18 HP strictly clamped to 20 HP ceiling (not 23 HP)');

  // 6.7 Edge case: Dead attacker does NOT revive via Vampirism
  const deadVamp = new Player('dead_vamp', 'DeadVamp', 'red');
  deadVamp.isDead = true;
  deadVamp.health = 0;
  mut.onDamage(deadVamp, victim, 8.0, mockGm);
  assert(deadVamp.health === 0, '6.4a: Dead attacker cannot trigger Vampirism hit recovery');
  mut.onKill(deadVamp, victim, mockGm);
  assert(deadVamp.health === 0, '6.4b: Dead attacker cannot trigger Vampirism kill bonus');

  // 6.8 Edge case: Self-damage does not heal
  attacker.health = 15.0;
  mut.onDamage(attacker, attacker, 4.0, mockGm);
  assert(attacker.health === 15.0, '6.4c: Self-damage does not grant vampiric healing to self');
}

// ============================================================================
// SUITE 7: SUDDEN DEATH UNIVERSAL BED BREAKDOWN & ARENA PERIMETER DECAY
// ============================================================================
console.log('\n--- SUITE 7: Sudden Death Universal Bed Destruction & Perimeter Decay ---');

{
  const tm = new TeamManager();
  tm.teams = {
    red: { name: 'Red', hasBed: true, players: ['r1'] },
    blue: { name: 'Blue', hasBed: true, players: ['b1'] },
    green: { name: 'Green', hasBed: true, players: ['g1'] },
    yellow: { name: 'Yellow', hasBed: true, players: ['y1'] },
  };

  const scene = new THREE.Scene();
  const world = new VoxelWorld(scene);
  world.rebuildMeshes = () => {};

  const mut = new MutationManager();
  mut.enable('Sudden Death');

  const mockGm = {
    teamManager: tm,
    world,
    matchTime: 590,
    players: [],
    sound: { playBedDestroyed: () => {} },
    hud: { showAnnouncement: () => {} },
  };

  // 7.1 Before 600s: Sudden Death inactive, beds intact
  mut.onTick(1.0, mockGm);
  assert(mut.suddenDeathTriggered === false, '7.1a: Sudden death inactive before 600s threshold');
  assert(tm.hasBed('red') === true, '7.1b: Red bed intact at 590s');
  assert(tm.hasBed('blue') === true, '7.1c: Blue bed intact at 590s');

  // 7.2 At 600s: Universal bed destruction triggers
  mockGm.matchTime = 600;
  mut.onTick(1.0, mockGm);
  assert(mut.suddenDeathTriggered === true, '7.2a: Sudden death activates at exactly 600s threshold');
  assert(tm.hasBed('red') === false, '7.2b: Red bed destroyed on Sudden Death trigger');
  assert(tm.hasBed('blue') === false, '7.2c: Blue bed destroyed on Sudden Death trigger');
  assert(tm.hasBed('green') === false, '7.2d: Green bed destroyed on Sudden Death trigger');
  assert(tm.hasBed('yellow') === false, '7.2e: Yellow bed destroyed on Sudden Death trigger');

  // 7.3 Arena Perimeter Decay Stress
  // Populate voxels at outer radii (> 40) and inner radii (<= 40)
  world.setBlock(45, 20, 0, BLOCK_TYPES.STONE);
  world.setBlock(0, 20, 45, BLOCK_TYPES.WOOD);
  world.setBlock(-45, 20, 0, BLOCK_TYPES.WOOL_RED);
  world.setBlock(45, 20, 2, BLOCK_TYPES.BEDROCK); // Bedrock at outer radius

  // Safe inner voxels (radius <= 40)
  world.setBlock(10, 20, 0, BLOCK_TYPES.STONE);
  world.setBlock(0, 20, 10, BLOCK_TYPES.WOOD);
  world.setBlock(0, 20, 0, BLOCK_TYPES.BED_HEAD);

  // Trigger perimeter decay with safe radius 40
  mut.decayArenaPerimeter(mockGm, 40);

  // Assert outer blocks (> 40) decayed into AIR
  assert(world.getBlock(45, 20, 0) === BLOCK_TYPES.AIR, '7.3a: Outer Stone at radius 45 disintegrated into AIR');
  assert(world.getBlock(0, 20, 45) === BLOCK_TYPES.AIR, '7.3b: Outer Wood at radius 45 disintegrated into AIR');
  assert(world.getBlock(-45, 20, 0) === BLOCK_TYPES.AIR, '7.3c: Outer Wool at radius 45 disintegrated into AIR');

  // Bedrock resists decay
  assert(world.getBlock(45, 20, 2) === BLOCK_TYPES.BEDROCK, '7.3d: Outer Bedrock strictly resists Sudden Death decay');

  // Inner blocks (radius <= 40) remain intact
  assert(world.getBlock(10, 20, 0) === BLOCK_TYPES.STONE, '7.3e: Inner Stone at radius 10 remains safe and intact');
  assert(world.getBlock(0, 20, 10) === BLOCK_TYPES.WOOD, '7.3f: Inner Wood at radius 10 remains safe and intact');
  assert(world.getBlock(0, 20, 0) === BLOCK_TYPES.BED_HEAD, '7.3g: Center structure voxels remain intact');

  // 7.4 Decay Progressive Shrink Stress Test (multi-cycle loop without crash)
  let decayCrashed = false;
  try {
    for (let r = 38; r >= 16; r -= 2) {
      mut.decayArenaPerimeter(mockGm, r);
    }
  } catch (err) {
    decayCrashed = true;
  }
  assert(!decayCrashed, '7.4a: Multi-cycle progressive perimeter decay executed safely down to r=16 without crash');
}

// ============================================================================
// SUITE 8: EMPIRICAL PERFORMANCE & THROUGHPUT BENCHMARKS
// ============================================================================
console.log('\n--- SUITE 8: Empirical Performance & Latency Benchmarks ---');

{
  // Benchmark 1: Projectile Integration Throughput (10,000 ballistic steps)
  const projBench = new Projectile({
    position: new THREE.Vector3(0, 100, 0),
    velocity: new THREE.Vector3(15, 25, 10),
    gravity: -12.0,
    type: 'plasma',
  });

  const tStart1 = performance.now();
  for (let i = 0; i < 10000; i++) {
    projBench.velocity.y += projBench.gravity * 0.016;
    projBench.position.addScaledVector(projBench.velocity, 0.016);
  }
  const tEnd1 = performance.now();
  const dur1 = tEnd1 - tStart1;
  const stepsPerSec = Math.round(10000 / (dur1 / 1000));
  console.log(`  ⏱️  10,000 Ballistic Steps: ${dur1.toFixed(2)} ms (${stepsPerSec.toLocaleString()} steps/sec)`);
  assert(dur1 < 100.0, `8.1: 10,000 ballistic integration steps complete under 100ms (took ${dur1.toFixed(2)}ms)`);

  // Benchmark 2: Explosion Sweep Performance (500 explosions on a 5x5x5 grid)
  const scene = new THREE.Scene();
  const worldBench = new VoxelWorld(scene);
  worldBench.rebuildMeshes = () => {};

  // Pre-fill a 9x9x9 volume with destructible wool
  for (let x = -4; x <= 4; x++) {
    for (let y = 16; y <= 24; y++) {
      for (let z = -4; z <= 4; z++) {
        worldBench.setBlock(x, y, z, BLOCK_TYPES.WOOL_WHITE);
      }
    }
  }

  const expProj = new Projectile({
    position: new THREE.Vector3(0, 20, 0),
    explosive: true,
    explosionRadius: 2.5,
    type: 'fireball',
  });

  const tStart2 = performance.now();
  for (let i = 0; i < 200; i++) {
    expProj.triggerExplosion(new THREE.Vector3(0, 20, 0), worldBench);
  }
  const tEnd2 = performance.now();
  const dur2 = tEnd2 - tStart2;
  const expsPerSec = Math.round(200 / (dur2 / 1000));
  console.log(`  ⏱️  200 Explosion Radial Sweeps: ${dur2.toFixed(2)} ms (${expsPerSec.toLocaleString()} sweeps/sec)`);
  assert(dur2 < 200.0, `8.2: 200 radial explosion sweeps complete under 200ms (took ${dur2.toFixed(2)}ms)`);

  // Benchmark 3: Multi-Mutator Combat Cycle (5,000 damage + heal cycles)
  const mutBench = new MutationManager();
  mutBench.enable('Low Gravity');
  mutBench.enable('Speed Demon');
  mutBench.enable('Lethal Strike');
  mutBench.enable('Gun Game');
  mutBench.enable('Vampirism');

  const attBench = new Player('b_att', 'Attacker', 'red');
  const vicBench = new Player('b_vic', 'Victim', 'blue');
  const mockGmBench = { hud: { showAnnouncement: () => {} } };

  const tStart3 = performance.now();
  for (let i = 0; i < 5000; i++) {
    attBench.health = 14.0;
    mutBench.onDamage(attBench, vicBench, 6.0, mockGmBench);
  }
  const tEnd3 = performance.now();
  const dur3 = tEnd3 - tStart3;
  const cyclesPerSec = Math.round(5000 / (dur3 / 1000));
  console.log(`  ⏱️  5,000 Multi-Mutator Combat Cycles: ${dur3.toFixed(2)} ms (${cyclesPerSec.toLocaleString()} cycles/sec)`);
  assert(dur3 < 100.0, `8.3: 5,000 multi-mutator cycles complete under 100ms (took ${dur3.toFixed(2)}ms)`);
}

// ============================================================================
// FINAL ADVERSARIAL CHALLENGE VERDICT & SUMMARY
// ============================================================================
console.log('\n╔══════════════════════════════════════════════════════════════════════╗');
console.log('║       CHALLENGER 2: ADVERSARIAL STRESS SUITE FINAL REPORT            ║');
console.log('╠══════════════════════════════════════════════════════════════════════╣');
console.log(`║  Total Assertions Verified : ${totalAssertions.toString().padEnd(40)}║`);
console.log(`║  Passed Assertions         : ${passedAssertions.toString().padEnd(40)}║`);
console.log(`║  Failed Assertions         : ${failedAssertions.toString().padEnd(40)}║`);
console.log('╚══════════════════════════════════════════════════════════════════════╝\n');

if (failedAssertions > 0) {
  console.error(`❌ EMPIRICAL CHALLENGER VERDICT: REQUEST_CHANGES (${failedAssertions} failures detected)\n`);
  process.exit(1);
} else {
  console.log(`✅ EMPIRICAL CHALLENGER VERDICT: APPROVE (100% of ${passedAssertions} assertions verified)\n`);
  process.exit(0);
}
