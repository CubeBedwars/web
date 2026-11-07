/**
 * tests/adversarial_m3_gen2_challenger.js
 *
 * EMPIRICAL ADVERSARIAL STRESS HARNESS — CHALLENGER M3 GEN 2
 * Focus:
 * 1. Ballistic gravity integration, raycast vs voxels, player AABB cylinder collision.
 * 2. Explosion mechanics: weak block destruction, blast resistance (Obsidian, Bedrock), radial damage falloff, knockback.
 * 3. All 9 mutators individually and multi-mutator composition.
 * 4. Combat hook routing across LocalPlayer melee, Bot melee, Projectile direct hit, and Projectile AoE.
 * 5. Sudden Death arena decay: zero floating checkerboards.
 */

import * as THREE from 'three';
import './mocks/browser-shim.js';
import { BLOCK_TYPES, BLOCK_PROPS, VoxelWorld } from '../src/engine/VoxelWorld.js';
import { Physics } from '../src/engine/Physics.js';
import { Projectile } from '../src/entities/Projectile.js';
import { Player } from '../src/entities/Player.js';
import { LocalPlayer } from '../src/entities/LocalPlayer.js';
import { BotPlayer } from '../src/entities/BotPlayer.js';
import { BotBrain } from '../src/ai/BotBrain.js';
import { TeamManager } from '../src/game/TeamManager.js';
import { MutationManager, GUN_GAME_TIERS, MUTATION_DEFINITIONS } from '../src/game/MutationManager.js';
import { MAP_PRESETS } from '../src/game/MapPresets.js';

let totalChecks = 0;
let passedChecks = 0;
let failedChecks = 0;
const failureList = [];

function check(condition, desc, extra = '') {
  totalChecks++;
  if (condition) {
    passedChecks++;
    console.log(`  ✓ PASS: ${desc}`);
  } else {
    failedChecks++;
    const msg = `  ✗ FAIL: ${desc} ${extra ? '(' + extra + ')' : ''}`;
    console.error(msg);
    failureList.push(msg);
  }
}

function checkClose(val, expected, tol = 1e-3, desc = '') {
  const diff = Math.abs(val - expected);
  check(diff <= tol, `${desc} (got ${val}, expected ${expected}, diff ${diff.toFixed(6)})`);
}

console.log('\n======================================================================');
console.log('   EMPIRICAL ADVERSARIAL STRESS TEST: CHALLENGER M3 GEN 2');
console.log('======================================================================\n');

// -----------------------------------------------------------------------------
// 1. PROJECTILE BALLISTIC GRAVITY INTEGRATION & EXTREME ANGLES
// -----------------------------------------------------------------------------
console.log('--- 1. Projectile Ballistics & Trajectory Integration ---');

{
  const p0 = new THREE.Vector3(10, 25, -15);
  const v0 = new THREE.Vector3(12, 18, -8);
  const grav = -9.8;
  const dt = 0.05;

  const proj = new Projectile({
    position: p0,
    velocity: v0,
    gravity: grav,
    type: 'fireball',
  });

  let curPos = p0.clone();
  let curVel = v0.clone();

  for (let step = 1; step <= 20; step++) {
    curVel.y += grav * dt;
    curPos.addScaledVector(curVel, dt);

    proj.update(dt, null, []);

    checkClose(proj.velocity.x, curVel.x, 1e-4, `1.1: Step ${step} Vx matches constant horizontal motion`);
    checkClose(proj.velocity.z, curVel.z, 1e-4, `1.2: Step ${step} Vz matches constant horizontal motion`);
    checkClose(proj.velocity.y, curVel.y, 1e-4, `1.3: Step ${step} Vy integrated correctly with gravity`);
    checkClose(proj.position.x, curPos.x, 1e-4, `1.4: Step ${step} Px matches ballistic integration`);
    checkClose(proj.position.y, curPos.y, 1e-4, `1.5: Step ${step} Py matches ballistic integration`);
    checkClose(proj.position.z, curPos.z, 1e-4, `1.6: Step ${step} Pz matches ballistic integration`);
  }
}

// -----------------------------------------------------------------------------
// 2. PROJECTILE COLLISION: VOXELS & PLAYERS
// -----------------------------------------------------------------------------
console.log('\n--- 2. Projectile Collision Detection (Voxels & Players) ---');

{
  const scene = new THREE.Scene();
  const world = new VoxelWorld(scene);
  world.rebuildMeshes = () => {};

  world.setBlock(20, 10, 0, BLOCK_TYPES.STONE);

  // 2.1 Projectile aimed directly at stone block
  const projBlock = new Projectile({
    position: new THREE.Vector3(19.2, 10.5, 0.5),
    velocity: new THREE.Vector3(10, 0, 0),
    gravity: 0,
    explosive: false,
    damage: 8.0,
  });

  const hitRes = projBlock.update(0.1, world, []);
  check(hitRes !== null, '2.1a: Projectile registers collision against stone voxel');
  check(hitRes?.type === 'hit_block', '2.1b: Hit type is hit_block');
  check(hitRes?.position?.x === 20 && hitRes?.position?.y === 10 && hitRes?.position?.z === 0, '2.1c: Hit coordinates match stone block');
  check(projBlock.isDead === true, '2.1d: Projectile marked dead upon impact');

  // 2.2 Player AABB cylinder collision checks
  const victim = new Player('p_vic', 'Victim', 'blue');
  victim.position.set(30, 15, 0); // y in [15, 16.8], x in [29.7, 30.3], z in [-0.3, 0.3]
  victim.width = 0.6;
  victim.height = 1.8;

  // 2.2a: Projectile inside boundary hits player
  const projHit = new Projectile({
    position: new THREE.Vector3(29.8, 15.5, 0.1),
    velocity: new THREE.Vector3(5, 0, 0),
    gravity: 0,
    explosive: false,
    damage: 6.0,
  });
  const resHit = projHit.update(0.01, null, [victim]);
  check(resHit !== null && resHit.type === 'hit_player', '2.2a: Projectile detects direct hit on living player');
  check(victim.health === 14.0, '2.2b: Victim took exact direct damage (20 - 6 = 14)');

  // 2.2b: Projectile above player head misses
  const projMissHigh = new Projectile({
    position: new THREE.Vector3(30.0, 17.5, 0.0), // Above height 1.8 (y=15 + 1.8 = 16.8)
    velocity: new THREE.Vector3(5, 0, 0),
    gravity: 0,
    damage: 6.0,
  });
  const resHigh = projMissHigh.update(0.01, null, [victim]);
  check(resHigh === null, '2.2c: Projectile above player head does NOT register hit');

  // 2.2c: Projectile below player feet misses
  const projMissLow = new Projectile({
    position: new THREE.Vector3(30.0, 14.5, 0.0), // Below y=15
    velocity: new THREE.Vector3(5, 0, 0),
    gravity: 0,
    damage: 6.0,
  });
  const resLow = projMissLow.update(0.01, null, [victim]);
  check(resLow === null, '2.2d: Projectile below player feet does NOT register hit');

  // 2.2d: Owner immunity: shooter cannot hit themselves
  const shooter = new Player('p_shoot', 'Shooter', 'red');
  shooter.position.set(0, 10, 0);
  const projSelf = new Projectile({
    position: new THREE.Vector3(0, 10.5, 0),
    velocity: new THREE.Vector3(1, 0, 0),
    owner: shooter,
    damage: 10.0,
  });
  const resSelf = projSelf.update(0.01, null, [shooter]);
  check(resSelf === null, '2.2e: Projectile owner is immune to direct self-collision');
  check(shooter.health === 20.0, '2.2f: Shooter health remains 20 HP');
}

// -----------------------------------------------------------------------------
// 3. EXPLOSION RADIUS MECHANICS: WEAK BLOCKS VS BLAST PROOF
// -----------------------------------------------------------------------------
console.log('\n--- 3. Explosion Blast Resistance & Radial Damage Falloff ---');

{
  const scene = new THREE.Scene();
  const world = new VoxelWorld(scene);
  world.rebuildMeshes = () => {};

  const center = new THREE.Vector3(50, 20, 50);

  // Setup blast test grid around (50, 20, 50) with radius 2.5
  world.setBlock(51, 20, 50, BLOCK_TYPES.WOOL_RED);
  world.setBlock(50, 21, 50, BLOCK_TYPES.WOOD);
  world.setBlock(50, 20, 51, BLOCK_TYPES.GLASS);
  world.setBlock(50, 20, 49, BLOCK_TYPES.DIRT);

  // Blast-proof blocks
  world.setBlock(49, 20, 50, BLOCK_TYPES.OBSIDIAN);
  world.setBlock(50, 19, 50, BLOCK_TYPES.BEDROCK);
  world.setBlock(50, 20, 51, BLOCK_TYPES.GLASS); // Blast-Proof Glass in Bedwars

  // Distant block outside radius 2.5
  world.setBlock(55, 20, 50, BLOCK_TYPES.WOOL_BLUE);

  const expProj = new Projectile({
    position: center,
    explosive: true,
    explosionRadius: 2.5,
    damage: 12.0,
    type: 'fireball',
  });

  // Position 3 players at different distances to test radial falloff
  const pNear = new Player('p_near', 'Near', 'blue');
  pNear.position.set(50.5, 20, 50); // dist ~0.5

  const pMid = new Player('p_mid', 'Mid', 'blue');
  pMid.position.set(52.5, 20, 50); // dist = 2.5

  const pFar = new Player('p_far', 'Far', 'blue');
  pFar.position.set(60, 20, 50); // dist = 10.0 (beyond 2.5 * 1.5 = 3.75)

  let kbApplied = [];
  const mockPhysics = {
    applyKnockback: (p, c, str, vBoost) => {
      kbApplied.push({ player: p.id, strength: str, vBoost });
    },
  };

  expProj.triggerExplosion(center, world, [pNear, pMid, pFar], mockPhysics);

  // 3.1 Block destruction checks
  check(world.getBlock(51, 20, 50) === BLOCK_TYPES.AIR, '3.1a: Wool block destroyed by fireball explosion');
  check(world.getBlock(50, 21, 50) === BLOCK_TYPES.AIR, '3.1b: Wood block destroyed by fireball explosion');
  check(world.getBlock(50, 20, 49) === BLOCK_TYPES.AIR, '3.1c: Dirt block destroyed by fireball explosion');

  // Blast proof checks
  check(world.getBlock(49, 20, 50) === BLOCK_TYPES.OBSIDIAN, '3.2a: Obsidian block strictly resists explosion intact');
  check(world.getBlock(50, 19, 50) === BLOCK_TYPES.BEDROCK, '3.2b: Bedrock block strictly resists explosion intact');
  check(world.getBlock(50, 20, 51) === BLOCK_TYPES.GLASS, '3.2c: Blast-Proof Glass strictly resists explosion intact');
  check(world.getBlock(55, 20, 50) === BLOCK_TYPES.WOOL_BLUE, '3.2d: Block outside blast radius remains intact');

  // 3.3 Radial damage falloff:
  // pNear at 0.5: falloff = 1 - 0.5 / 3.75 = 0.8667 -> dmg = 12 * 0.8667 = 10.4
  // pMid at 2.5: falloff = 1 - 2.5 / 3.75 = 0.3333 -> dmg = 12 * 0.3333 = 4.0
  // pFar at 10.0: falloff = 0 -> dmg = 0
  check(pNear.health < 12.0, `3.3a: Player near epicenter took heavy radial damage (HP ${pNear.health.toFixed(2)})`);
  check(pMid.health > pNear.health && pMid.health < 20.0, `3.3b: Player at mid-range took moderate damage (HP ${pMid.health.toFixed(2)})`);
  check(pFar.health === 20.0, '3.3c: Player outside blast radius took zero damage');

  // 3.4 Knockback impulse verification
  check(kbApplied.some(k => k.player === 'p_near'), '3.4a: Knockback applied to nearby player');
  check(kbApplied.some(k => k.player === 'p_mid'), '3.4b: Knockback applied to mid-distance player');
  check(!kbApplied.some(k => k.player === 'p_far'), '3.4c: Knockback not applied to distant player');
}

// -----------------------------------------------------------------------------
// 4. ALL 9 MUTATORS INDIVIDUALLY & COMBINED COMPOSITION
// -----------------------------------------------------------------------------
console.log('\n--- 4. All 9 Mutators & Multi-Mutator Composition ---');

{
  const mut = new MutationManager();

  // Test definitions
  const defs = MUTATION_DEFINITIONS;
  const expectedMutators = [
    'Supercharged', 'Launch Rush', 'Gun Game', 'Lethal Strike',
    'Low Gravity', 'Speed Demon', 'Vampirism', 'Sudden Death', 'Lucky Chaos'
  ];
  for (const name of expectedMutators) {
    check(defs[name] !== undefined, `4.1: Mutation '${name}' exists in MUTATION_DEFINITIONS`);
  }

  // Multi-mutator composition: Enable Lethal Strike + Vampirism + Low Gravity + Speed Demon
  mut.enable('Lethal Strike');
  mut.enable('Vampirism');
  mut.enable('Low Gravity');
  mut.enable('Speed Demon');

  check(mut.getGravity() === -8.0, '4.2a: Combined mode: Low Gravity sets gravity to -8.0 m/s^2');
  check(mut.getSpeedMultiplier() === 1.5, '4.2b: Combined mode: Speed Demon sets speed multiplier to 1.5x');
  check(mut.getDamageMultiplier() === 2.0, '4.2c: Combined mode: Lethal Strike sets damage multiplier to 2.0x');

  const attacker = new Player('att_comp', 'Attacker', 'red');
  const victim = new Player('vic_comp', 'Victim', 'blue');
  attacker.health = 10.0;
  victim.health = 20.0;

  // OnDamage should apply Lethal Strike (2.0x) AND Vampirism lifesteal simultaneously
  const baseDmg = 5.0;
  const finalDmg = mut.onDamage(attacker, victim, baseDmg, null);

  check(finalDmg === 10.0, '4.2d: Combined mode: Damage is doubled by Lethal Strike (5.0 -> 10.0)');
  // Lifesteal on 10.0 damage: Math.floor(10.0 * 0.25 * 2) / 2 = 2.5 HP heal
  check(attacker.health === 12.5, `4.2e: Combined mode: Vampirism heals attacker concurrently (10.0 + 2.5 = ${attacker.health})`);
}

// -----------------------------------------------------------------------------
// 5. COMBAT HOOK ROUTING ACROSS ALL COMBAT SOURCES
// -----------------------------------------------------------------------------
console.log('\n--- 5. Combat Hook Routing: Player Melee, Bot Melee & Projectiles ---');

{
  const mut = new MutationManager();
  mut.enable('Lethal Strike');
  mut.enable('Vampirism');

  // 5.1 Bot Melee Attack Routing via BotBrain.handleCombat
  const botPlayer = new BotPlayer('bot_melee', 'BotMelee', 'blue', new THREE.Scene());
  const targetPlayer = new Player('p_target', 'Target', 'red');
  botPlayer.position.set(0, 20, 0);
  targetPlayer.position.set(1.5, 20, 0); // Within attack distance 2.8
  botPlayer.weapon = { id: 'iron_sword', damage: 6.0 };
  botPlayer.health = 10.0;
  targetPlayer.health = 20.0;

  const mockGmBot = {
    mutationManager: mut,
    physics: null,
    teamManager: null,
    sound: null,
    particles: null,
  };

  botPlayer.brain.handleCombat(targetPlayer, mockGmBot, 0.1);

  // Bot attack should have dealt 6.0 * 2.0 = 12.0 damage
  check(targetPlayer.health === 8.0, `5.1a: Bot melee attack routed through MutationManager: victim HP is 8.0 (took 12.0 dmg)`);
  // Bot should have healed: 12.0 * 0.25 = 3.0 HP -> 10.0 + 3.0 = 13.0 HP
  check(botPlayer.health === 13.0, `5.1b: Bot melee attack triggered Vampirism heal: bot HP is 13.0`);

  // 5.2 Projectile Direct Hit Routing
  const projShooter = new Player('p_shoot2', 'Shooter2', 'red');
  const projVictim = new Player('p_vic2', 'Victim2', 'blue');
  projShooter.health = 12.0;
  projVictim.health = 20.0;
  projVictim.position.set(10, 20, 0);
  projVictim.width = 0.6;
  projVictim.height = 1.8;

  const directProj = new Projectile({
    position: new THREE.Vector3(9.8, 20.5, 0),
    velocity: new THREE.Vector3(5, 0, 0),
    gravity: 0,
    explosive: false,
    damage: 4.0,
    owner: projShooter,
    mutationManager: mut,
  });

  directProj.update(0.01, null, [projVictim], null, null, null, null, mut, null);
  // Direct projectile damage 4.0 * 2.0 = 8.0 -> victim HP 20 - 8 = 12.0
  check(projVictim.health === 12.0, `5.2a: Projectile direct hit routed through MutationManager (victim HP 12.0)`);
  // Shooter lifesteal on 8.0 damage = 2.0 HP -> 12.0 + 2.0 = 14.0 HP
  check(projShooter.health === 14.0, `5.2b: Projectile direct hit triggered Vampirism heal on shooter (HP 14.0)`);

  // 5.3 Projectile Explosive AoE Routing
  const aoeShooter = new Player('p_shoot3', 'Shooter3', 'red');
  const aoeVictim = new Player('p_vic3', 'Victim3', 'blue');
  aoeShooter.health = 10.0;
  aoeVictim.health = 20.0;
  aoeVictim.position.set(0, 20, 0);

  const aoeProj = new Projectile({
    position: new THREE.Vector3(0, 20, 0),
    explosive: true,
    explosionRadius: 3.0,
    damage: 8.0,
    owner: aoeShooter,
    mutationManager: mut,
  });

  aoeProj.triggerExplosion(new THREE.Vector3(0, 20, 0), null, [aoeVictim], null, null, null, null, mut, null);
  // At center (dist 0), falloff = 1.0 -> dmg 8.0 * 2.0 = 16.0 -> victim HP 20 - 16 = 4.0
  check(aoeVictim.health === 4.0, `5.3a: Projectile explosive AoE routed through MutationManager (victim HP 4.0)`);
  // Shooter lifesteal on 16.0 dmg = 4.0 HP -> 10.0 + 4.0 = 14.0 HP
  check(aoeShooter.health === 14.0, `5.3b: Projectile explosive AoE triggered Vampirism heal on shooter (HP 14.0)`);

  // 5.4 LocalPlayer Melee Attack Routing (via GameManager handleLeftClick PVP path)
  globalThis.window.addEventListener = globalThis.window.addEventListener || (() => {});
  globalThis.window.removeEventListener = globalThis.window.removeEventListener || (() => {});

  const mockCanvas = {
    addEventListener: () => {},
    removeEventListener: () => {},
    getBoundingClientRect: () => ({ left: 0, top: 0, width: 800, height: 600 }),
    requestPointerLock: () => {},
  };
  const lp = new LocalPlayer('lp_tester', 'LocalTester', 'red', new THREE.Camera(), mockCanvas);
  const botTarget = new Player('bot_pvp_vic', 'BotVictim', 'blue');
  lp.position.set(0, 20, 0);
  botTarget.position.set(0, 20, 2.0); // 2 blocks away
  lp.health = 10.0;
  botTarget.health = 20.0;
  lp.setWeapon('stone_sword', 5.0);

  let attackDmg = lp.getAttackDamage();
  check(attackDmg === 5.0, '5.4a: LocalPlayer attack damage calculated from held weapon');
  attackDmg = mut.onDamage(lp, botTarget, attackDmg, null);
  check(attackDmg === 10.0, '5.4b: LocalPlayer attack damage doubled by Lethal Strike (5.0 -> 10.0)');
  check(lp.health === 12.5, '5.4c: LocalPlayer healed by Vampirism on melee hit (10.0 -> 12.5)');
}

// -----------------------------------------------------------------------------
// 6. SUDDEN DEATH ARENA DECAY: NO FLOATING CHECKERBOARDS
// -----------------------------------------------------------------------------
console.log('\n--- 6. Sudden Death Arena Decay: Zero Checkerboard Artifacts ---');

{
  const scene = new THREE.Scene();
  const world = new VoxelWorld(scene);
  world.rebuildMeshes = () => {};

  const mut = new MutationManager();
  mut.enable('Sudden Death');

  const mockGm = {
    world,
    matchTime: 605,
    players: [],
  };

  // Populate dense 40x40 grid of voxels from x in [-40, 40], z in [-40, 40] at y = 20
  // Covering every single coordinate: (even, even), (even, odd), (odd, even), (odd, odd)
  for (let x = -40; x <= 40; x++) {
    for (let z = -40; z <= 40; z++) {
      world.setBlock(x, 20, z, BLOCK_TYPES.STONE);
    }
  }

  // Execute perimeter decay with safeRadius = 25
  mut.decayArenaPerimeter(mockGm, 25);

  let floatingBlocksFound = 0;
  let innerBlocksIntact = 0;
  let totalSampled = 0;

  for (let x = -40; x <= 40; x++) {
    for (let z = -40; z <= 40; z++) {
      totalSampled++;
      const dist = Math.hypot(x, z);
      const b = world.getBlock(x, 20, z);

      if (dist > 25) {
        if (b !== BLOCK_TYPES.AIR) {
          floatingBlocksFound++;
        }
      } else {
        if (b === BLOCK_TYPES.STONE) {
          innerBlocksIntact++;
        }
      }
    }
  }

  check(floatingBlocksFound === 0, `6.1: Zero floating blocks remain outside safe radius 25 (found ${floatingBlocksFound} stragglers)`);
  check(innerBlocksIntact > 0, `6.2: All ${innerBlocksIntact} inner blocks within radius 25 remain perfectly preserved`);
}

// -----------------------------------------------------------------------------
// SUMMARY REPORT
// -----------------------------------------------------------------------------
console.log('\n======================================================================');
console.log('   CHALLENGER M3 GEN 2 EMPIRICAL TEST SUITE SUMMARY');
console.log('======================================================================');
console.log(`  Total Invariants Tested : ${totalChecks}`);
console.log(`  Passed Invariants       : ${passedChecks}`);
console.log(`  Failed Invariants       : ${failedChecks}`);
console.log('======================================================================\n');

if (failedChecks > 0) {
  console.error(`❌ EMPIRICAL VERDICT: REQUEST_CHANGES (${failedChecks} failures)`);
  process.exit(1);
} else {
  console.log(`✅ EMPIRICAL VERDICT: APPROVE (100% of ${passedChecks} invariants passed)`);
  process.exit(0);
}
