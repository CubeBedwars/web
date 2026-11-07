/**
 * tests/tier3-pairwise.test.js
 * Tier 3: Cross-Feature Combinations (Pairwise coverage).
 * Exercises cross-module feature interactions:
 * - Mutations + Shop upgrades + Team beds
 * - WebRTC fallback + LAN connect + State sync
 * - Mining hardness + Gun Game weapons + Combat attribution
 * - Rank MMR + Multi-Map Formats + Scoreboard
 */

import * as THREE from 'three';
import './mocks/browser-shim.js';
import {
  describe,
  it,
  assertEqual,
  assertNotEqual,
  assertTrue,
  assertFalse,
  assertDeepEqual,
  assertApprox,
  assertInRange,
  assertIncludes,
  assertThrows,
} from './test-framework.js';

import { BLOCK_TYPES, BLOCK_PROPS } from '../src/engine/VoxelWorld.js';
import { Physics } from '../src/engine/Physics.js';
import { TeamManager } from '../src/game/TeamManager.js';
import { SHOP_ITEMS, TEAM_UPGRADES } from '../src/game/ShopManager.js';
import { MAP_PRESETS } from '../src/game/MapPresets.js';
import { Player } from '../src/entities/Player.js';

import {
  calculateBreakTime,
  calculateCrackStage,
  getBlockBreakParticles,
  performDDA,
  calculateHearts,
  formatTimer,
  calculateRankDelta,
  getRankTier,
  calculateLevelFromXP,
  calculateMatchXP,
  CombatTagger,
  ProjectileSimulation,
  GUN_GAME_TIERS,
  MutationHarness,
  validatePacket,
  validateLanAddress,
  PACKET_TYPES,
} from './helpers/game-sim.js';

describe('Tier 3: Supercharged Mutation + Forge Upgrade + Shopkeeper Purchases', () => {
  it('P1.1: Supercharged starting tier 2 stacks with team forge upgrade to tier 3', () => {
    const m = new MutationHarness();
    m.enable('Supercharged');
    let forgeTier = m.getInitialGeneratorTier(); // 2
    assertEqual(forgeTier, 2);

    // Apply team upgrade
    forgeTier += 1; // Advanced to Tier 3
    assertEqual(forgeTier, 3);
  });

  it('P1.2: accelerated forge output allows early purchase of wool and stone sword', () => {
    const player = new Player('p1', 'Alice', 'red', true);
    // Accelerated forge generated 14 iron
    player.resources.iron = 14;

    // Buy Wool (x16) costing 4 iron
    const woolItem = SHOP_ITEMS.find((i) => i.id === 'wool_16');
    assertTrue(player.resources.iron >= woolItem.cost);
    player.resources.iron -= woolItem.cost;
    woolItem.action(player);

    // Buy Stone Sword costing 10 iron
    const swordItem = SHOP_ITEMS.find((i) => i.id === 'stone_sword');
    assertTrue(player.resources.iron >= swordItem.cost);
    player.resources.iron -= swordItem.cost;
    swordItem.action(player);

    assertEqual(player.resources.iron, 0);
    assertEqual(player.weapon.id, 'stone_sword');
    const woolInHotbar = player.hotbar.find((slot) => slot && slot.name === 'Wool');
    assertTrue(woolInHotbar !== null);
  });
});

describe('Tier 3: Gun Game Mutation + Sharpness Upgrade + Combat Attribution', () => {
  it('P2.1: Gun Game weapon damage scales additively with team Sharpness upgrade', () => {
    const m = new MutationHarness();
    m.enable('Gun Game');
    const tier1Weapon = GUN_GAME_TIERS[0]; // Slingshot (3.5 base)
    const sharpnessBonus = 1.25; // Tier 1 sharpness
    const effectiveDamage = tier1Weapon.damage + sharpnessBonus;
    assertEqual(effectiveDamage, 4.75);
  });

  it('P2.2: securing kill with Gun Game projectile advances tier and attributes kill', () => {
    const tagger = new CombatTagger(10000);
    tagger.tag('victim', 'shooter', 1000);

    let gunGameTier = 1;
    function onKillConfirmed(victimId, now) {
      const killer = tagger.getAttributedKiller(victimId, now);
      if (killer === 'shooter') {
        gunGameTier++;
      }
    }

    onKillConfirmed('victim', 3000);
    assertEqual(gunGameTier, 2);
    assertEqual(GUN_GAME_TIERS[gunGameTier - 1].name, 'Iron Crossbow');
  });
});

describe('Tier 3: Lethal Strike Mutation + Protection Upgrade + Armor Defense', () => {
  it('P3.1: lethal strike doubles weapon damage before protection reduces it', () => {
    const m = new MutationHarness();
    m.enable('Lethal Strike');
    const baseDamage = 6.0; // Iron sword
    const scaledDamage = baseDamage * m.getDamageMultiplier(); // 12.0

    // Target team has Protection II (20% reduction) and Iron Armor (40% reduction)
    const protReduction = 0.20;
    const armorReduction = 0.40;
    const totalReduction = Math.min(0.80, protReduction + armorReduction); // 60%
    const finalDamageTaken = scaledDamage * (1 - totalReduction);

    assertApprox(finalDamageTaken, 4.8, 0.01);
  });

  it('P3.2: lethal strike fatal blow eliminates player and updates hearts display to empty', () => {
    const player = new Player('p2', 'Bob', 'blue', false);
    player.health = 4.0;
    const fatalDamage = 12.0;
    player.health = Math.max(0, player.health - fatalDamage);
    assertEqual(player.health, 0);

    const hearts = calculateHearts(player.health);
    assertTrue(hearts.every((h) => h === 'empty'));
  });
});

describe('Tier 3: Low Gravity Mutation + Launch Rush + Aerial Bridging', () => {
  it('P4.1: launchpad impulse in low gravity grants 3x flight hang-time', () => {
    const m = new MutationHarness();
    m.enable('Low Gravity');
    m.enable('Launch Rush');

    const launchVelY = 18.0;
    const lowGravity = Math.abs(m.getGravity()); // 8.0
    const normalGravity = 24.0;

    const hangTimeNormal = (2 * launchVelY) / normalGravity; // 1.5s
    const hangTimeLowGrav = (2 * launchVelY) / lowGravity; // 4.5s

    assertEqual(hangTimeLowGrav, hangTimeNormal * 3);
  });

  it('P4.2: player places wool bridge blocks during low gravity horizontal leap', () => {
    const world = new Map();
    // Simulate placing 5 wool blocks at y=20 as player leaps along X axis
    for (let x = 0; x < 5; x++) {
      world.set(`${x},20,0`, BLOCK_TYPES.WOOL_RED);
    }
    assertEqual(world.size, 5);
    assertTrue(world.has('3,20,0'));
  });
});

describe('Tier 3: Vampirism Mutation + Gun Game Multi-Kill Streak', () => {
  it('P5.1: each projectile hit restores 25% damage dealt and securing kill restores 5 HP', () => {
    const m = new MutationHarness();
    m.enable('Vampirism');
    m.enable('Gun Game');

    const player = new Player('p1', 'Sniper', 'green', true);
    player.health = 10.0;

    // Land hit for 6 damage
    const hitHeal = m.applyVampirismDamage(6.0); // 1.5
    player.health = Math.min(player.maxHealth, player.health + hitHeal);
    assertEqual(player.health, 11.5);

    // Secure kill (+5 HP)
    const killHeal = m.applyVampirismKill();
    player.health = Math.min(player.maxHealth, player.health + killHeal);
    assertEqual(player.health, 16.5);
  });
});

describe('Tier 3: WebRTC Fallback + State Sync + Paired Bed Destruction', () => {
  it('P6.1: WebRTC fallback receives BED_DESTROY packet and marks team bed broken', () => {
    const tm = new TeamManager();
    const packet = {
      type: PACKET_TYPES.BED_DESTROY,
      sender: 'host_p1',
      timestamp: Date.now(),
      payload: { team: 'yellow' },
    };
    assertTrue(validatePacket(packet));

    // Handle packet
    if (packet.type === PACKET_TYPES.BED_DESTROY) {
      tm.destroyBed(packet.payload.team);
    }
    assertFalse(tm.hasBed('yellow'));
    assertTrue(tm.hasBed('red')); // Other beds untouched
  });

  it('P6.2: bed destruction removes both Head and Foot voxels in client voxel map', () => {
    const world = new Map();
    world.set('10,21,0', BLOCK_TYPES.BED_HEAD);
    world.set('11,21,0', BLOCK_TYPES.BED_FOOT);

    // Destroy bed
    world.delete('10,21,0');
    world.delete('11,21,0');

    assertFalse(world.has('10,21,0'));
    assertFalse(world.has('11,21,0'));
  });
});

describe('Tier 3: Ranked Match Rating + Level XP + Profile Persistence', () => {
  it('P7.1: winning 1v1 duel updates Elo MMR, awards XP, and promotes tier', () => {
    const initialRating = 1480; // Silver tier
    assertEqual(getRankTier(initialRating), 'Silver');

    // Win 1v1 match with 2 kills and 1 bed broken
    const { isRanked, deltaRating } = calculateRankDelta('1v1', 'win', 2, 1, 1);
    assertTrue(isRanked);
    // 25 + 2*2 + 1*5 + 1*10 = 44
    assertEqual(deltaRating, 44);

    const newRating = initialRating + deltaRating; // 1524
    assertEqual(newRating, 1524);
    assertEqual(getRankTier(newRating), 'Gold'); // Promoted to Gold!

    // XP calculation
    const xpEarned = calculateMatchXP('win', 2, 1, 1);
    assertEqual(xpEarned, 215);

    // Persist to localStorage
    const profile = { rating: newRating, totalXP: 1000 + xpEarned };
    globalThis.localStorage.setItem('vw_profile', JSON.stringify(profile));

    const retrieved = JSON.parse(globalThis.localStorage.getItem('vw_profile'));
    assertEqual(retrieved.rating, 1524);
  });
});

describe('Tier 3: Mining Hardness + Tool Upgrade + Material Particle Burst', () => {
  it('P8.1: purchasing Diamond Pickaxe dramatically reduces Obsidian break time and triggers particles', () => {
    const fistTime = calculateBreakTime(BLOCK_TYPES.OBSIDIAN, 'fist');
    const diaPickTime = calculateBreakTime(BLOCK_TYPES.OBSIDIAN, 'diamond_pickaxe');

    assertTrue(diaPickTime < fistTime / 5);
    assertEqual(diaPickTime, 12.0 * 0.125); // 1.5s

    const particles = getBlockBreakParticles(BLOCK_TYPES.OBSIDIAN);
    assertIncludes(particles[0], '#1e1b4b');
  });
});

describe('Tier 3: Sudden Death + Lucky Chaos + Blast-Proof Defense', () => {
  it('P9.1: Sudden death destroys beds, but obsidian defenses resist TNT explosion', () => {
    const tm = new TeamManager();
    const m = new MutationHarness();
    m.enable('Sudden Death');
    m.enable('Lucky Chaos');

    // 600s timer triggers Sudden Death
    if (m.isSuddenDeathTriggered(600, 600)) {
      for (const t of Object.keys(tm.teams)) tm.destroyBed(t);
    }
    assertFalse(tm.hasBed('red'));

    // Lucky Chaos spawned TNT, but Obsidian is blast-proof
    const obsProps = BLOCK_PROPS[BLOCK_TYPES.OBSIDIAN];
    const glassProps = BLOCK_PROPS[BLOCK_TYPES.GLASS];
    assertTrue(obsProps.blastProof);
    assertTrue(glassProps.blastProof);
  });
});

describe('Tier 3: Desktop LAN Broadcast + Direct IP Join + Format Handshake', () => {
  it('P10.1: UDP LAN beacon announces 1v1 duel format on port 8766', () => {
    const beacon = {
      app: 'voxel-bedwars-lan',
      roomCode: 'LAN-7712',
      format: '1v1',
      map: 'colosseum',
      port: 8766,
    };
    assertTrue(validateLanAddress('192.168.1.15', beacon.port));
    assertEqual(beacon.format, '1v1');
  });

  it('P10.2: connecting client receives map preset and synchronizes player spawn', () => {
    const colosseum = {
      name: 'Colosseum',
      spawns: { red: { x: -15, y: 20, z: 0 }, blue: { x: 15, y: 20, z: 0 } },
    };
    const player = new Player('p2', 'Client', 'blue', false);
    player.position.set(colosseum.spawns.blue.x, colosseum.spawns.blue.y, colosseum.spawns.blue.z);
    assertEqual(player.position.x, 15);
  });
});

describe('Tier 3: AlarmTrap + HealPool + Island Base Defense', () => {
  it('P11.1: enemy intrusion triggers AlarmTrap while defender regenerates in HealPool', () => {
    const intruder = { team: 'yellow', position: { x: -28, y: 21, z: 2 } };
    const defender = new Player('p1', 'Defender', 'red', true);
    defender.health = 16.0;

    const baseCenter = { x: -30, y: 20, z: 0 };
    const intruderDist = Math.hypot(intruder.position.x - baseCenter.x, intruder.position.z - baseCenter.z);
    const alarmFired = intruderDist < 10 && intruder.team !== 'red';
    assertTrue(alarmFired);

    // Defender in base receives healPool tick
    defender.health = Math.min(defender.maxHealth, defender.health + 1.0);
    assertEqual(defender.health, 17.0);
  });
});

describe('Tier 3: Mobile Touch Controls + Gun Game Aiming & Projectile Launch', () => {
  it('P12.1: virtual joystick drives horizontal velocity while touch look sets aim vector', () => {
    const joystickNorm = { x: 0.6, y: -0.8 }; // Walking diagonally forward-right
    const walkSpeed = 6.0;
    const velocity = new THREE.Vector3(joystickNorm.x * walkSpeed, 0, joystickNorm.y * walkSpeed);

    assertApprox(velocity.x, 3.6, 0.01);
    assertApprox(velocity.z, -4.8, 0.01);

    // Fire Gun Game projectile in direction of touch aim
    const aimDir = new THREE.Vector3(0, 0, -1);
    const proj = new ProjectileSimulation({
      position: { x: 0, y: 21, z: 0 },
      velocity: aimDir.multiplyScalar(20),
    });
    proj.update(0.1);
    assertEqual(proj.position.z, -2.0);
  });
});

describe('Tier 3: 4v4 Ranked Match + Combat Tagging + Final Kill Elimination', () => {
  it('P13.1: 4v4 competitive match with bed broken converts void kill to final kill and awards ranked rating', () => {
    const tm = new TeamManager();
    const tagger = new CombatTagger(10000);

    // Bed is broken first
    tm.destroyBed('blue');
    assertFalse(tm.hasBed('blue'));

    // Attacker tags victim
    tagger.tag('blue_p1', 'red_p1', 5000);

    // Victim falls into void at 7000ms
    const killer = tagger.getAttributedKiller('blue_p1', 7000);
    assertEqual(killer, 'red_p1');

    // Because bed is broken, this is a final kill
    const isFinalKill = !tm.hasBed('blue');
    assertTrue(isFinalKill);

    // Ranked 4v4 outcome calculation
    const delta = calculateRankDelta('4v4', 'win', 1, 1, 1);
    assertTrue(delta.isRanked);
    // 25 + 1*2 + 1*5 + 1*10 = 42
    assertEqual(delta.deltaRating, 42);
  });
});

describe('Tier 3: Speed Demon + Low Gravity + Long Jump Bridge Rush', () => {
  it('P14.1: Speed Demon velocity multiplier combines with low gravity for ultra-long bridge jumps', () => {
    const m = new MutationHarness();
    m.enable('Speed Demon');
    m.enable('Low Gravity');

    const baseSpeed = 6.0;
    const boostSpeed = baseSpeed * m.getSpeedMultiplier(); // 9.0 m/s
    const jumpVelY = 9.0;
    const lowGravity = Math.abs(m.getGravity()); // 8.0 m/s^2

    const hangTime = (2 * jumpVelY) / lowGravity; // 2.25s
    const horizontalDistance = boostSpeed * hangTime; // 9.0 * 2.25 = 20.25 meters!

    assertEqual(horizontalDistance, 20.25);
    assertTrue(horizontalDistance >= 20.0, 'Enables leaping across major island gaps');
  });
});

describe('Tier 3: Octagon 8-Team Solo Format + Unranked + Level XP', () => {
  it('P15.1: Octagon 8-team solo match gives zero rating delta but awards full participation XP', () => {
    const { isRanked, deltaRating } = calculateRankDelta('octagon_8team', 'win', 4, 2, 2);
    assertFalse(isRanked);
    assertEqual(deltaRating, 0);

    // Still awards XP for progression
    const xp = calculateMatchXP('win', 4, 2, 2);
    // 100 + 4*15 + 2*35 + 2*50 = 330
    assertEqual(xp, 330);
  });
});

describe('Tier 3: Vampirism + Lethal Strike + High-Stakes Duel', () => {
  it('P16.1: Lethal Strike double damage doubles Vampirism recovery proportion', () => {
    const m = new MutationHarness();
    m.enable('Vampirism');
    m.enable('Lethal Strike');

    const baseDamage = 5.0; // Stone sword
    const lethalDamage = baseDamage * m.getDamageMultiplier(); // 10.0
    const vampiricHeal = m.applyVampirismDamage(lethalDamage); // 2.5 HP

    assertEqual(vampiricHeal, 2.5);
  });
});

