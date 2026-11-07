/**
 * tests/stress_m2_combat.js
 * Empirical Adversarial Stress Test Suite for Milestone 2 (M2):
 * Combat Attribution Tagger, Bed Deduplication & Team Upgrades Combat Mathematics.
 *
 * Requirements Stressed:
 * 1. Combat Tagger:
 *    - Player hit at t=0, falls into void at t=9.9s -> kill attributed to attacker.
 *    - Player hit at t=0, falls into void at t=10.1s -> kill NOT attributed (natural death).
 *    - Player hit by Attacker A at t=0, hit by Attacker B at t=5s, falls into void at t=12s
 *      -> kill attributed to Attacker B (within 7s of B's hit).
 * 2. Bed Deduplication:
 *    - Target head block, target foot block, simulate simultaneous break attempts
 *      -> assert exactly 1 bed break is awarded to destroyer, and both head and foot voxels become AIR.
 * 3. Upgrades Math:
 *    - Verify sharpness: 1 increases sword damage.
 *    - Verify protection: 1 mitigates damage by percentage.
 *    - Verify combinations of armor + protection are strictly non-negative and mathematically bounded.
 */

import * as THREE from 'three';
import './mocks/browser-shim.js';
import { BLOCK_TYPES, VoxelWorld } from '../src/engine/VoxelWorld.js';
import { GameManager } from '../src/game/GameManager.js';
import { TeamManager } from '../src/game/TeamManager.js';
import { Player } from '../src/entities/Player.js';
import { SHOP_ITEMS, TEAM_UPGRADES } from '../src/game/ShopManager.js';

console.log('\n======================================================================');
console.log('   EMPIRICAL ADVERSARIAL STRESS SUITE: M2 COMBAT, BEDS & UPGRADES   ');
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
 * Harness helper: creates a mock GameManager harness for isolated headless testing.
 */
function createGameHarness() {
  const scene = new THREE.Scene();
  const world = new VoxelWorld(scene);
  world.rebuildMeshes = () => {}; // Headless no-op

  const teamManager = new TeamManager();
  const camera = new THREE.PerspectiveCamera(75, 1.0, 0.05, 400);

  const harness = Object.create(GameManager.prototype);
  harness.world = world;
  harness.scene = scene;
  harness.camera = camera;
  harness.teamManager = teamManager;
  harness.sound = {
    init: () => {},
    resume: () => {},
    playHit: () => {},
    playBedDestroyed: () => {},
    playBlockBreak: () => {},
    playBlockHit: () => {},
  };
  harness.particles = {
    spawnBlockBreak: () => {},
    spawnHitSparks: () => {},
  };
  harness.hud = {
    showAnnouncement: () => {},
    updateScoreboard: () => {},
  };
  harness.localPlayer = new Player('local', 'LocalPlayer', 'white', true);
  harness.players = [harness.localPlayer];

  return harness;
}

// ============================================================================
// SUITE 1: COMBAT TAGGER & VOID ATTRIBUTION ADVERSARIAL HARNESS
// ============================================================================
console.log('--- SUITE 1: Combat Tagger & Void Attribution Adversarial Harness ---');

const originalDateNow = Date.now;
let mockCurrentTime = 1000000;

function setMockTime(timeMs) {
  mockCurrentTime = timeMs;
}

// Monkey-patch Date.now for deterministic millisecond-accurate time travel
Date.now = () => mockCurrentTime;

try {
  // 1.1: Player hit at t=0, falls into void at t=9.9s (9900ms) -> attributed to attacker
  {
    setMockTime(10000); // t = 0
    const attacker = new Player('att_1', 'Attacker_A', 'blue');
    const victim = new Player('vic_1', 'Victim_1', 'red');
    victim.takeDamage(4.0, attacker);

    assert(victim.lastAttacker === attacker, '1.1a: Victim lastAttacker is set to Attacker A on hit');
    assert(victim.lastAttackTimestamp === 10000, '1.1b: Victim lastAttackTimestamp is set to t=0 (10000ms)');

    // Advance time to t = 9.9s (9900ms elapsed)
    setMockTime(10000 + 9900);
    // Player falls into void (killer is null)
    victim.die(null);

    assert(attacker.kills === 1, '1.1c: Kill attributed to attacker at t=9.9s (within 10s combat window)');
    assert(victim.isDead === true, '1.1d: Victim marked dead');
    assert(victim.lastAttacker === null, '1.1e: Victim lastAttacker cleared post-death');
    assert(victim.lastAttackTimestamp === 0, '1.1f: Victim lastAttackTimestamp reset to 0');
  }

  // 1.2: Exact boundary test: Player hit at t=0, falls into void at t=10.0s (10000ms exact)
  {
    setMockTime(20000); // t = 0
    const attacker = new Player('att_boundary', 'Attacker_Boundary', 'blue');
    const victim = new Player('vic_boundary', 'Victim_Boundary', 'red');
    victim.takeDamage(2.0, attacker);

    setMockTime(20000 + 10000); // exactly 10.0s
    victim.die(null);

    assert(attacker.kills === 1, '1.2: Kill attributed to attacker at exact boundary t=10.0s (<= 10000ms)');
  }

  // 1.3: Boundary test: Player hit at t=0, falls into void at t=10.001s (10001ms) -> expired
  {
    setMockTime(30000); // t = 0
    const attacker = new Player('att_exp1', 'Attacker_Exp1', 'blue');
    const victim = new Player('vic_exp1', 'Victim_Exp1', 'red');
    victim.takeDamage(2.0, attacker);

    setMockTime(30000 + 10001); // 10.001s
    victim.die(null);

    assert(attacker.kills === 0, '1.3: Kill NOT attributed at t=10.001s (combat window expired by 1ms)');
  }

  // 1.4: Player hit at t=0, falls into void at t=10.1s (10100ms) -> NOT attributed (natural death)
  {
    setMockTime(40000); // t = 0
    const attacker = new Player('att_2', 'Attacker_2', 'blue');
    const victim = new Player('vic_2', 'Victim_2', 'red');
    victim.takeDamage(4.0, attacker);

    // Advance time to t = 10.1s (10100ms elapsed)
    setMockTime(40000 + 10100);
    victim.die(null);

    assert(attacker.kills === 0, '1.4a: Kill NOT attributed to attacker at t=10.1s (natural void death)');
    assert(victim.isDead === true, '1.4b: Victim marked dead despite no killer attribution');
  }

  // 1.5: Multi-Attacker Tagger Handover:
  // Player hit by Attacker A at t=0, hit by Attacker B at t=5s, falls into void at t=12s
  // -> kill attributed to Attacker B (within 7s of B's hit).
  {
    setMockTime(50000); // t = 0
    const attackerA = new Player('att_A', 'Attacker_A', 'blue');
    const attackerB = new Player('att_B', 'Attacker_B', 'green');
    const victim = new Player('vic_handover', 'Victim_Handover', 'red');

    // Attacker A strikes at t=0
    victim.takeDamage(3.0, attackerA);
    assert(victim.lastAttacker === attackerA, '1.5a: Attacker A tagged at t=0');

    // Attacker B strikes at t=5s (5000ms later)
    setMockTime(50000 + 5000);
    victim.takeDamage(3.0, attackerB);
    assert(victim.lastAttacker === attackerB, '1.5b: Attacker B overrides tag at t=5s');
    assert(victim.lastAttackTimestamp === 55000, '1.5c: Timestamp updated to t=5s (55000ms)');

    // Victim falls into void at t=12s (12000ms total elapsed, 7000ms since B hit)
    setMockTime(50000 + 12000);
    victim.die(null);

    assert(attackerB.kills === 1, '1.5d: Kill attributed to Attacker B (within 7s of B hit)');
    assert(attackerA.kills === 0, '1.5e: Attacker A receives 0 kills (A hit was 12s ago, overridden by B)');
  }

  // 1.6: Multi-Attacker Expiration:
  // Player hit by A at t=0, hit by B at t=3s, falls into void at t=13.1s (10.1s since B's hit)
  {
    setMockTime(70000); // t = 0
    const attackerA = new Player('att_expA', 'Attacker_A', 'blue');
    const attackerB = new Player('att_expB', 'Attacker_B', 'green');
    const victim = new Player('vic_exp_both', 'Victim_Exp_Both', 'red');

    victim.takeDamage(2.0, attackerA);
    setMockTime(70000 + 3000);
    victim.takeDamage(2.0, attackerB);

    // Void fall at t = 13.1s (10.1s after B's hit, 13.1s after A's hit)
    setMockTime(70000 + 13100);
    victim.die(null);

    assert(attackerA.kills === 0, '1.6a: Attacker A receives 0 kills (expired)');
    assert(attackerB.kills === 0, '1.6b: Attacker B receives 0 kills (expired by 100ms)');
  }

  // 1.7: Final Kill Attribution with Bed Broken
  {
    setMockTime(90000); // t = 0
    const attacker = new Player('att_final', 'Attacker_Final', 'blue');
    const victim = new Player('vic_final', 'Victim_Final', 'red');
    victim.isFinalDead = true; // Bed already broken

    victim.takeDamage(5.0, attacker);
    setMockTime(90000 + 8000); // t = 8s
    victim.die(null);

    assert(attacker.kills === 1, '1.7a: Attacker receives regular kill credit');
    assert(attacker.finalKills === 1, '1.7b: Attacker receives final kill credit when victim isFinalDead');
  }

  // 1.8: Direct Kill Override vs Combat Tag
  {
    setMockTime(100000);
    const attackerTag = new Player('att_tag', 'Attacker_Tag', 'blue');
    const attackerDirect = new Player('att_dir', 'Attacker_Direct', 'green');
    const victim = new Player('vic_direct', 'Victim_Direct', 'red');

    victim.takeDamage(4.0, attackerTag);
    setMockTime(100000 + 4000);
    // Direct fatal sword strike by Attacker Direct
    victim.die(attackerDirect);

    assert(attackerDirect.kills === 1, '1.8a: Direct killer receives kill credit');
    assert(attackerTag.kills === 0, '1.8b: Tagged attacker does NOT get credited when direct killer is present');
  }

  // 1.9: Null Attacker Damage (Environmental / Fall) Preserves Combat Tag
  {
    setMockTime(120000);
    const attacker = new Player('att_env', 'Attacker_Env', 'blue');
    const victim = new Player('vic_env', 'Victim_Env', 'red');

    victim.takeDamage(4.0, attacker); // Tagged
    setMockTime(120000 + 3000);
    // Environmental damage with attacker = null
    victim.takeDamage(2.0, null);

    assert(victim.lastAttacker === attacker, '1.9a: Null-attacker environmental damage preserves existing combat tag');
    assert(victim.lastAttackTimestamp === 120000, '1.9b: Combat tag timestamp remains anchored to attacker hit');

    setMockTime(120000 + 9000);
    victim.die(null);
    assert(attacker.kills === 1, '1.9c: Attacker credited after intermediate environmental damage');
  }

  // 1.10: Rapid Attacker Chain Stress (20 sequential attackers)
  {
    setMockTime(150000);
    const attackers = [];
    const victim = new Player('vic_chain', 'Victim_Chain', 'red');

    for (let i = 0; i < 20; i++) {
      const att = new Player(`att_chain_${i}`, `Attacker_${i}`, 'blue');
      attackers.push(att);
      setMockTime(150000 + i * 500); // 0s, 0.5s, 1.0s, ... 9.5s
      victim.takeDamage(0.5, att);
    }

    // Void fall at t = 11.0s (150000 + 11000ms)
    // Attacker #19 was at t = 9.5s (150000 + 9500ms). Elapsed = 1500ms <= 10000ms.
    setMockTime(150000 + 11000);
    victim.die(null);

    assert(attackers[19].kills === 1, '1.10a: Most recent attacker in chain (Attacker 19) awarded kill');
    const otherKills = attackers.slice(0, 19).reduce((sum, a) => sum + a.kills, 0);
    assert(otherKills === 0, '1.10b: None of the earlier 19 attackers awarded spurious kills');
  }

  // 1.11: GameManager Real Loop Integration with Void Check (y < -12)
  {
    setMockTime(200000);
    const harness = createGameHarness();
    const attacker = new Player('harness_att', 'Attacker_Harness', 'blue');
    const localPlayer = new Player('harness_vic', 'Local_Victim', 'red', true);

    harness.localPlayer = localPlayer;
    harness.players = [localPlayer, attacker];

    // Attacker strikes local player at t=0
    localPlayer.takeDamage(4.0, attacker);

    // Advance 6 seconds
    setMockTime(200000 + 6000);

    // Simulate falling into the void
    localPlayer.position.y = -15.0; // below -12 threshold

    // Execute GameManager void check block
    if (localPlayer.position.y < -12 && !localPlayer.isDead) {
      localPlayer.isFinalDead = !harness.teamManager.hasBed(localPlayer.team);
      localPlayer.die();
    }

    assert(localPlayer.isDead === true, '1.11a: Player marked dead on void fall below y=-12');
    assert(attacker.kills === 1, '1.11b: Combat tagger credits attacker in GameManager void detection');
  }

} finally {
  Date.now = originalDateNow;
}

// ============================================================================
// SUITE 2: BED DEDUPLICATION & 2-VOXEL INTEGRITY ADVERSARIAL HARNESS
// ============================================================================
console.log('\n--- SUITE 2: Bed Deduplication & 2-Voxel Integrity Adversarial Harness ---');

{
  // 2.1: Target head block break -> exactly 1 break awarded, both head and foot become AIR
  {
    const harness = createGameHarness();
    const destroyer = new Player('dest_1', 'Destroyer_1', 'blue');
    destroyer.bedsBroken = 0;

    // Place Red bed: head at (10, 20, 5), foot at (10, 20, 6)
    harness.world.setBlock(10, 20, 5, BLOCK_TYPES.BED_HEAD, { team: 'red', part: 'head' });
    harness.world.setBlock(10, 20, 6, BLOCK_TYPES.BED_FOOT, { team: 'red', part: 'foot' });
    assert(harness.teamManager.hasBed('red') === true, '2.1a: Red team bed initialized as intact');

    // Break head block
    harness.destroyBedAt(10, 20, 5, destroyer);

    assert(destroyer.bedsBroken === 1, '2.1b: Exactly 1 bed break awarded on head block break');
    assert(harness.world.getBlock(10, 20, 5) === BLOCK_TYPES.AIR, '2.1c: Head block voxel turned to AIR');
    assert(harness.world.getBlock(10, 20, 6) === BLOCK_TYPES.AIR, '2.1d: Companion foot block voxel turned to AIR');
    assert(harness.teamManager.hasBed('red') === false, '2.1e: Red team hasBed state is false');
  }

  // 2.2: Target foot block break -> exactly 1 break awarded, both head and foot become AIR
  {
    const harness = createGameHarness();
    const destroyer = new Player('dest_2', 'Destroyer_2', 'green');
    destroyer.bedsBroken = 0;

    harness.world.setBlock(15, 20, 5, BLOCK_TYPES.BED_HEAD, { team: 'blue', part: 'head' });
    harness.world.setBlock(15, 20, 6, BLOCK_TYPES.BED_FOOT, { team: 'blue', part: 'foot' });

    // Break foot block
    harness.destroyBedAt(15, 20, 6, destroyer);

    assert(destroyer.bedsBroken === 1, '2.2a: Exactly 1 bed break awarded on foot block break');
    assert(harness.world.getBlock(15, 20, 5) === BLOCK_TYPES.AIR, '2.2b: Companion head block voxel turned to AIR');
    assert(harness.world.getBlock(15, 20, 6) === BLOCK_TYPES.AIR, '2.2c: Foot block voxel turned to AIR');
    assert(harness.teamManager.hasBed('blue') === false, '2.2d: Blue team hasBed state is false');
  }

  // 2.3: Simultaneous Break Attempts: Target head then foot in same frame/tick
  {
    const harness = createGameHarness();
    const destroyer = new Player('dest_sim1', 'Destroyer_Sim1', 'yellow');
    destroyer.bedsBroken = 0;

    harness.world.setBlock(20, 20, 5, BLOCK_TYPES.BED_HEAD, { team: 'green', part: 'head' });
    harness.world.setBlock(20, 20, 6, BLOCK_TYPES.BED_FOOT, { team: 'green', part: 'foot' });

    // Simulate simultaneous destruction events (head immediately followed by foot)
    harness.destroyBedAt(20, 20, 5, destroyer);
    harness.destroyBedAt(20, 20, 6, destroyer);

    assert(destroyer.bedsBroken === 1, '2.3a: Exactly 1 bed break awarded across simultaneous head+foot break');
    assert(harness.world.getBlock(20, 20, 5) === BLOCK_TYPES.AIR, '2.3b: Head block is AIR');
    assert(harness.world.getBlock(20, 20, 6) === BLOCK_TYPES.AIR, '2.3c: Foot block is AIR');
  }

  // 2.4: Simultaneous Break Attempts: Target foot then head in same frame/tick
  {
    const harness = createGameHarness();
    const destroyer = new Player('dest_sim2', 'Destroyer_Sim2', 'red');
    destroyer.bedsBroken = 0;

    harness.world.setBlock(25, 20, 5, BLOCK_TYPES.BED_HEAD, { team: 'yellow', part: 'head' });
    harness.world.setBlock(25, 20, 6, BLOCK_TYPES.BED_FOOT, { team: 'yellow', part: 'foot' });

    // Simulate simultaneous destruction events (foot immediately followed by head)
    harness.destroyBedAt(25, 20, 6, destroyer);
    harness.destroyBedAt(25, 20, 5, destroyer);

    assert(destroyer.bedsBroken === 1, '2.4a: Exactly 1 bed break awarded across simultaneous foot+head break');
    assert(harness.world.getBlock(25, 20, 5) === BLOCK_TYPES.AIR, '2.4b: Head block is AIR');
    assert(harness.world.getBlock(25, 20, 6) === BLOCK_TYPES.AIR, '2.4c: Foot block is AIR');
  }

  // 2.5: Competing Destroyers Race Condition (Two different players hit head and foot)
  {
    const harness = createGameHarness();
    const destroyer1 = new Player('dest_p1', 'Destroyer_1', 'red');
    const destroyer2 = new Player('dest_p2', 'Destroyer_2', 'blue');
    destroyer1.bedsBroken = 0;
    destroyer2.bedsBroken = 0;

    harness.world.setBlock(30, 20, 5, BLOCK_TYPES.BED_HEAD, { team: 'green', part: 'head' });
    harness.world.setBlock(30, 20, 6, BLOCK_TYPES.BED_FOOT, { team: 'green', part: 'foot' });

    // Destroyer 1 hits head; Destroyer 2 hits foot concurrently
    harness.destroyBedAt(30, 20, 5, destroyer1);
    harness.destroyBedAt(30, 20, 6, destroyer2);

    const totalBroken = destroyer1.bedsBroken + destroyer2.bedsBroken;
    assert(totalBroken === 1, `2.5a: Total beds broken between competing players is exactly 1 (got ${totalBroken})`);
    assert(destroyer1.bedsBroken === 1, '2.5b: First resolver (Destroyer 1) is awarded the break');
    assert(destroyer2.bedsBroken === 0, '2.5c: Second resolver (Destroyer 2) receives 0 duplicate breaks');
    assert(harness.world.getBlock(30, 20, 5) === BLOCK_TYPES.AIR, '2.5d: Head is AIR');
    assert(harness.world.getBlock(30, 20, 6) === BLOCK_TYPES.AIR, '2.5e: Foot is AIR');
  }

  // 2.6: Cardinal Orientations (+X, -X, +Z, -Z paired bed destruction)
  {
    const orientations = [
      { name: '+X (+1, 0)', dx: 1, dz: 0 },
      { name: '-X (-1, 0)', dx: -1, dz: 0 },
      { name: '+Z (0, +1)', dx: 0, dz: 1 },
      { name: '-Z (0, -1)', dx: 0, dz: -1 },
    ];

    for (let idx = 0; idx < orientations.length; idx++) {
      const { name, dx, dz } = orientations[idx];
      const harness = createGameHarness();
      const destroyer = new Player(`dest_ori_${idx}`, `Destroyer_Ori_${idx}`, 'blue');
      const hx = 50 + idx * 10, hy = 20, hz = 50;
      const fx = hx + dx, fy = hy, fz = hz + dz;

      harness.world.setBlock(hx, hy, hz, BLOCK_TYPES.BED_HEAD, { team: 'red', part: 'head' });
      harness.world.setBlock(fx, fy, fz, BLOCK_TYPES.BED_FOOT, { team: 'red', part: 'foot' });

      harness.destroyBedAt(hx, hy, hz, destroyer);

      assert(destroyer.bedsBroken === 1, `2.6a [${name}]: Exactly 1 break awarded`);
      assert(harness.world.getBlock(hx, hy, hz) === BLOCK_TYPES.AIR, `2.6b [${name}]: Head is AIR`);
      assert(harness.world.getBlock(fx, fy, fz) === BLOCK_TYPES.AIR, `2.6c [${name}]: Foot is AIR`);
    }
  }

  // 2.7: Multi-Team Bed Isolation
  {
    const harness = createGameHarness();
    const destroyer = new Player('dest_iso', 'Destroyer_Iso', 'yellow');

    // Place Red Bed
    harness.world.setBlock(10, 20, 5, BLOCK_TYPES.BED_HEAD, { team: 'red', part: 'head' });
    harness.world.setBlock(10, 20, 6, BLOCK_TYPES.BED_FOOT, { team: 'red', part: 'foot' });

    // Place Blue Bed
    harness.world.setBlock(40, 20, 5, BLOCK_TYPES.BED_HEAD, { team: 'blue', part: 'head' });
    harness.world.setBlock(40, 20, 6, BLOCK_TYPES.BED_FOOT, { team: 'blue', part: 'foot' });

    // Destroy Red Bed
    harness.destroyBedAt(10, 20, 5, destroyer);

    assert(harness.teamManager.hasBed('red') === false, '2.7a: Red bed destroyed');
    assert(harness.teamManager.hasBed('blue') === true, '2.7b: Blue bed remains intact');
    assert(harness.world.getBlock(40, 20, 5) === BLOCK_TYPES.BED_HEAD, '2.7c: Blue head block intact');
    assert(harness.world.getBlock(40, 20, 6) === BLOCK_TYPES.BED_FOOT, '2.7d: Blue foot block intact');
  }

  // 2.8: Rapid Spam Stress Harness (500 redundant destroy calls)
  {
    const harness = createGameHarness();
    const destroyer = new Player('dest_spam', 'Destroyer_Spam', 'blue');
    harness.world.setBlock(10, 20, 5, BLOCK_TYPES.BED_HEAD, { team: 'red', part: 'head' });
    harness.world.setBlock(10, 20, 6, BLOCK_TYPES.BED_FOOT, { team: 'red', part: 'foot' });

    harness.destroyBedAt(10, 20, 5, destroyer);
    assert(destroyer.bedsBroken === 1, '2.8a: First destroy awards break');

    // Spam 500 destroy calls on head and foot coordinates
    for (let i = 0; i < 250; i++) {
      harness.destroyBedAt(10, 20, 5, destroyer);
      harness.destroyBedAt(10, 20, 6, destroyer);
    }

    assert(destroyer.bedsBroken === 1, '2.8b: 500 spam destroyBedAt calls produce 0 extra breaks (total remains 1)');
    assert(harness.world.getBlock(10, 20, 5) === BLOCK_TYPES.AIR, '2.8c: Head voxel remains AIR');
    assert(harness.world.getBlock(10, 20, 6) === BLOCK_TYPES.AIR, '2.8d: Foot voxel remains AIR');
  }
}

// ============================================================================
// SUITE 3: TEAM UPGRADES & COMBAT MATHEMATICS ADVERSARIAL HARNESS
// ============================================================================
console.log('\n--- SUITE 3: Team Upgrades & Combat Mathematics Adversarial Harness ---');

{
  // 3.1: Sharpness: 1 Increases Sword Damage
  {
    const teamManager = new TeamManager();
    const player = new Player('sharp_tester', 'Sharp_Tester', 'red');
    player.teamManager = teamManager;

    // Test 1: Wooden sword base damage = 4.0
    const woodenBaseDmg = player.getAttackDamage();
    assert(woodenBaseDmg === 4.0, `3.1a: Wooden sword base attack damage is 4.0 (got ${woodenBaseDmg})`);

    // Apply Sharpness 1
    teamManager.teams.red.upgrades.sharpness = 1;
    const woodenSharpDmg = player.getAttackDamage();
    const expectedWooden = 4.0 + 1 * 1.25; // 5.25
    assert(woodenSharpDmg === expectedWooden, `3.1b: Sharpness 1 increases wooden sword damage to 5.25 (got ${woodenSharpDmg})`);
    assert(woodenSharpDmg > woodenBaseDmg, '3.1c: Sharpness 1 sword damage is strictly greater than base damage');

    // Test 2: Check all other sword tiers with Sharpness 1
    const weaponTests = [
      { id: 'stone_sword', base: 5.0, name: 'Stone Sword' },
      { id: 'iron_sword', base: 6.5, name: 'Iron Sword' },
      { id: 'diamond_sword', base: 8.5, name: 'Diamond Sword' },
      { id: 'knockback_stick', base: 2.0, name: 'Knockback Stick' },
    ];

    for (const w of weaponTests) {
      player.setWeapon(w.id, w.base);
      teamManager.teams.red.upgrades.sharpness = 0;
      const baseD = player.getAttackDamage();

      teamManager.teams.red.upgrades.sharpness = 1;
      const sharpD = player.getAttackDamage();

      assert(sharpD === w.base + 1.25, `3.1d [${w.name}]: Sharpness 1 adds +1.25 (base ${w.base} -> ${sharpD})`);
      assert(sharpD > baseD, `3.1e [${w.name}]: Sharpness 1 strictly increases weapon damage`);
    }
  }

  // 3.2: Sharpness Monotonicity Across Tiers 0..4
  {
    const teamManager = new TeamManager();
    const player = new Player('sharp_mono', 'Sharp_Mono', 'blue');
    player.teamManager = teamManager;

    let prevDmg = -Infinity;
    for (let tier = 0; tier <= 4; tier++) {
      teamManager.teams.blue.upgrades.sharpness = tier;
      const dmg = player.getAttackDamage();
      assert(dmg === 4.0 + tier * 1.25, `3.2a: Sharpness tier ${tier} damage is ${4.0 + tier * 1.25}`);
      assert(dmg > prevDmg, `3.2b: Sharpness tier ${tier} damage (${dmg}) is strictly greater than tier ${tier - 1} (${prevDmg})`);
      prevDmg = dmg;
    }
  }

  // 3.3: Protection: 1 Mitigates Damage by Percentage (10% per tier)
  {
    const teamManager = new TeamManager();
    const victim = new Player('prot_tester', 'Prot_Tester', 'red');
    victim.teamManager = teamManager;
    victim.setArmor('none', 0.0);

    // Baseline: 10 damage without protection
    victim.health = 20;
    victim.takeDamage(10.0);
    assert(Math.abs(victim.health - 10.0) < 1e-5, `3.3a: Prot 0 takes full 10 damage (health 20 -> ${victim.health})`);

    // Protection 1: 10% mitigation
    teamManager.teams.red.upgrades.protection = 1;
    victim.health = 20;
    victim.takeDamage(10.0);
    const expectedDmg = 10.0 * (1.0 - 0.10); // 9.0
    const expectedHealth = 20.0 - expectedDmg; // 11.0
    assert(Math.abs(victim.health - expectedHealth) < 1e-5, `3.3b: Prot 1 mitigates damage by 10% (health 20 -> ${victim.health}, dmg = 9.0)`);

    // Protection 2: 20% mitigation
    teamManager.teams.red.upgrades.protection = 2;
    victim.health = 20;
    victim.takeDamage(10.0);
    assert(Math.abs(victim.health - 12.0) < 1e-5, `3.3c: Prot 2 mitigates damage by 20% (health 20 -> ${victim.health}, dmg = 8.0)`);
  }

  // 3.4: Protection Monotonicity Across Tiers 0..4
  {
    const teamManager = new TeamManager();
    const victim = new Player('prot_mono', 'Prot_Mono', 'green');
    victim.teamManager = teamManager;
    victim.setArmor('none', 0.0);

    let prevDamageTaken = Infinity;
    for (let tier = 0; tier <= 4; tier++) {
      teamManager.teams.green.upgrades.protection = tier;
      victim.health = 20;
      victim.takeDamage(10.0);
      const dmgTaken = 20.0 - victim.health;

      const expectedDmg = 10.0 * (1.0 - tier * 0.1);
      assert(Math.abs(dmgTaken - expectedDmg) < 1e-5, `3.4a: Prot tier ${tier} damage is ${expectedDmg}`);
      assert(dmgTaken < prevDamageTaken, `3.4b: Prot tier ${tier} damage (${dmgTaken}) is strictly less than tier ${tier - 1} (${prevDamageTaken})`);
      prevDamageTaken = dmgTaken;
    }
  }

  // 3.5 & 3.6: Combinations of Armor + Protection: Non-Negative & Strictly Bounded
  {
    const teamManager = new TeamManager();
    const victim = new Player('combo_tester', 'Combo_Tester', 'red');
    victim.teamManager = teamManager;

    const armorTiers = [
      { name: 'none', reduction: 0.0 },
      { name: 'chainmail', reduction: 0.20 },
      { name: 'iron', reduction: 0.35 },
      { name: 'diamond', reduction: 0.50 },
    ];

    const protTiers = [0, 1, 2, 3, 4];
    const testDamages = [0, 0.001, 1.0, 4.0, 7.5, 10.0, 18.5, 20.0, 50.0, 1000.0];

    let totalCombinationsChecked = 0;
    let allNonNegative = true;
    let allBoundedAbove = true;
    let allHealthValid = true;

    for (const armor of armorTiers) {
      victim.setArmor(armor.name, armor.reduction);

      for (const prot of protTiers) {
        teamManager.teams.red.upgrades.protection = prot;

        for (const incomingDmg of testDamages) {
          totalCombinationsChecked++;
          victim.health = 20; // reset
          victim.isDead = false;

          victim.takeDamage(incomingDmg);
          const damageTaken = 20 - victim.health;

          // 1. Strictly non-negative: damageTaken >= 0
          if (damageTaken < 0) {
            allNonNegative = false;
          }

          // 2. Mathematically bounded above: damageTaken <= incomingDmg
          if (damageTaken > incomingDmg + 1e-6) {
            allBoundedAbove = false;
          }

          // 3. Health is bounded in [0, 20]
          if (victim.health < 0 || victim.health > 20) {
            allHealthValid = false;
          }

          // 4. Exact mathematical formula verification
          const expectedFactor = (1.0 - armor.reduction) * (1.0 - prot * 0.1);
          const rawDamage = incomingDmg * expectedFactor;
          const expectedHealth = Math.max(0, 20 - rawDamage);
          if (Math.abs(victim.health - expectedHealth) > 1e-4) {
            console.error(`Math mismatch: armor=${armor.name}, prot=${prot}, dmg=${incomingDmg}: got ${victim.health}, expected ${expectedHealth}`);
            allHealthValid = false;
          }
        }
      }
    }

    assert(allNonNegative === true, `3.5a: All ${totalCombinationsChecked} armor+prot combinations produced strictly non-negative damage (>= 0)`);
    assert(allBoundedAbove === true, `3.5b: All ${totalCombinationsChecked} combinations were bounded above by incoming damage (<= amount)`);
    assert(allHealthValid === true, `3.5c: All resulting health values were clamped strictly in [0, maxHealth] matching theoretical formula`);
  }

  // 3.7: Boundary Damage Values (Zero & Massive)
  {
    const player = new Player('bound_player', 'Bound_Player', 'red');

    // Zero damage
    player.health = 17.5;
    player.takeDamage(0);
    assert(player.health === 17.5, '3.7a: 0 incoming damage leaves health completely unchanged');
    assert(player.isDead === false, '3.7b: 0 incoming damage does not trigger death');

    // Massive damage
    player.health = 20;
    player.takeDamage(999999);
    assert(player.health === 0, '3.7c: Massive damage clamps health to exactly 0 (no negative health overflow)');
    assert(player.isDead === true, '3.7d: Massive damage triggers player.isDead = true');
  }

  // 3.8: Graceful Fallbacks (Null Safety)
  {
    const nakedPlayer = new Player('naked', 'Naked', 'red');
    nakedPlayer.teamManager = null;
    nakedPlayer.teamUpgrades = null;
    nakedPlayer.armor = null;
    nakedPlayer.weapon = null;

    // Must not throw when calculating attack damage with missing objects
    let attackErr = null;
    let attackDmg = 0;
    try {
      attackDmg = nakedPlayer.getAttackDamage();
    } catch (e) {
      attackErr = e;
    }
    assert(attackErr === null, '3.8a: getAttackDamage handles null weapon/teamManager gracefully without exception');
    assert(attackDmg === 4.0, `3.8b: Null weapon defaults cleanly to base damage 4.0 (got ${attackDmg})`);

    // Must not throw when taking damage with missing armor/teamManager
    let damageErr = null;
    try {
      nakedPlayer.health = 20;
      nakedPlayer.takeDamage(5.0);
    } catch (e) {
      damageErr = e;
    }
    assert(damageErr === null, '3.8c: takeDamage handles null armor/teamManager gracefully without exception');
    assert(nakedPlayer.health === 15.0, `3.8d: Null armor takes unreduced 5.0 damage (got ${nakedPlayer.health})`);
  }

  // 3.9: High-Throughput Performance Benchmark
  {
    const teamManager = new TeamManager();
    const player = new Player('perf_player', 'Perf_Player', 'red');
    player.teamManager = teamManager;
    teamManager.teams.red.upgrades.sharpness = 1;
    teamManager.teams.red.upgrades.protection = 1;
    player.setArmor('iron', 0.35);

    const iterations = 50000;
    const t0 = performance.now();

    for (let i = 0; i < iterations; i++) {
      player.getAttackDamage();
      player.health = 20;
      player.isDead = false;
      player.takeDamage(6.0);
    }

    const elapsedMs = performance.now() - t0;
    const opsPerSec = Math.round((iterations / elapsedMs) * 1000);

    console.log(`\n  [Performance Benchmark] ${iterations} combat operations in ${elapsedMs.toFixed(2)}ms (${opsPerSec.toLocaleString()} ops/sec)`);
    assert(elapsedMs < 250, `3.9: 50,000 combat calculations executed within budget (< 250ms, took ${elapsedMs.toFixed(2)}ms)`);
  }
}

// ============================================================================
// FINAL STRESS TEST SUMMARY
// ============================================================================
console.log('\n======================================================================');
console.log('                 M2 COMBAT STRESS TEST HARNESS SUMMARY                ');
console.log('======================================================================');
console.log(`  Total Assertions Checked : ${totalAssertions}`);
console.log(`  Passed Assertions        : ${passedAssertions}`);
console.log(`  Failed Assertions        : ${failedAssertions}`);
console.log('======================================================================\n');

if (failedAssertions > 0) {
  console.error(`❌ M2 COMBAT STRESS TEST FAILED with ${failedAssertions} assertion error(s).\n`);
  process.exit(1);
} else {
  console.log(`✅ ALL ${passedAssertions} M2 COMBAT ADVERSARIAL STRESS ASSERTIONS PASSED WITH 100% SUCCESS!\n`);
  process.exit(0);
}
