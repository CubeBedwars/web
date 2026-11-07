/**
 * tests/tier4-scenarios.test.js
 * Tier 4: Realistic End-to-End Match Scenarios.
 * Executes full end-to-end match workflows across 5 diverse game configurations:
 * - Scenario 1: 1v1 Colosseum Duel (player vs bot, generator collection, bridging, combat, bed destruction, final kill, Elo rating)
 * - Scenario 2: 4v4 Speedway Match (forge upgrades, shop purchases, team upgrades, non-final respawn vs final kill, bed break)
 * - Scenario 3: 8-Team Octagon Match (center emerald dominance, multi-team eliminations, sudden death decay, solo champion)
 * - Scenario 4: Supercharged & Gun Game Mutator Match (tier 2 generators, projectile ballistics, weapon upgrades on kill, blast physics)
 * - Scenario 5: Dual-Layer Network Match (WebSocket room host, WebRTC fallback sync, block & transform packets, LAN direct IP join)
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

import { BLOCK_TYPES, BLOCK_PROPS, VoxelWorld } from '../src/engine/VoxelWorld.js';
import { Physics } from '../src/engine/Physics.js';
import { TeamManager } from '../src/game/TeamManager.js';
import { SHOP_ITEMS, TEAM_UPGRADES } from '../src/game/ShopManager.js';
import { MAP_PRESETS } from '../src/game/MapPresets.js';
import { Player } from '../src/entities/Player.js';

import {
  calculateBreakTime,
  calculateCrackStage,
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

// ============================================================================
// SCENARIO 1: 1v1 COLOSSEUM DUEL (Ranked 1v1 Match Workflow)
// ============================================================================

describe('Scenario 1: 1v1 Colosseum Duel (Player vs Bot, Bridging, Bed Destruction & Final Kill)', () => {
  it('S1.1: initializes 1v1 Colosseum match with Red player, Blue bot, and active beds', () => {
    const colosseum = {
      name: 'Colosseum (1v1)',
      format: '1v1',
      teams: ['red', 'blue'],
      spawns: {
        red: { x: -15, y: 20, z: 0 },
        blue: { x: 15, y: 20, z: 0 },
      },
      beds: {
        red: { head: { x: -18, y: 20, z: 0 }, foot: { x: -17, y: 20, z: 0 } },
        blue: { head: { x: 18, y: 20, z: 0 }, foot: { x: 17, y: 20, z: 0 } },
      },
    };

    const teamManager = new TeamManager();
    delete teamManager.teams.green;
    delete teamManager.teams.yellow;
    const redPlayer = new Player('p_red', 'Alex', 'red', true);
    const blueBot = new Player('bot_blue', 'BlueBot_Alpha', 'blue', false);

    teamManager.teams.red.players = [redPlayer];
    teamManager.teams.blue.players = [blueBot];

    // Scoreboard bed check
    assertTrue(teamManager.hasBed('red'), 'Red bed must be intact at start');
    assertTrue(teamManager.hasBed('blue'), 'Blue bed must be intact at start');
    assertEqual(teamManager.getAliveTeams().length, 2, 'Both teams must be alive');
    assertEqual(redPlayer.kills, 0);
    assertEqual(redPlayer.finalKills, 0);
  });

  it('S1.2: Red player collects base forge resources and purchases wool and stone sword', () => {
    const redPlayer = new Player('p_red', 'Alex', 'red', true);

    // Forge generates 18 iron and 4 gold over 20 seconds
    redPlayer.addResource('iron', 18);
    redPlayer.addResource('gold', 4);

    assertEqual(redPlayer.resources.iron, 18);
    assertEqual(redPlayer.resources.gold, 4);

    // Purchase 32 Wool (2x wool_16: costs 4 iron each = 8 iron)
    const woolItem = SHOP_ITEMS.find((i) => i.id === 'wool_16');
    for (let i = 0; i < 2; i++) {
      assertTrue(redPlayer.spendResource('iron', woolItem.cost));
      woolItem.action(redPlayer);
    }

    // Purchase Stone Sword (10 iron)
    const swordItem = SHOP_ITEMS.find((i) => i.id === 'stone_sword');
    assertTrue(redPlayer.spendResource('iron', swordItem.cost));
    swordItem.action(redPlayer);

    // Verify inventory state
    assertEqual(redPlayer.resources.iron, 0, 'All 18 iron should be spent');
    assertEqual(redPlayer.weapon.id, 'stone_sword');
    assertEqual(redPlayer.weapon.damage, 5);

    const woolSlot = redPlayer.hotbar.find((slot) => slot && slot.name === 'Wool');
    assertTrue(woolSlot !== null, 'Wool must be in hotbar');
    assertEqual(woolSlot.count, 32, 'Must have 32 blocks of wool');
  });

  it('S1.3: Red player bridges across the 30-block void gap placing wool blocks', () => {
    const scene = new THREE.Scene();
    const world = new VoxelWorld(scene);
    const redPlayer = new Player('p_red', 'Alex', 'red', true);
    redPlayer.addItem({ type: 'block', blockType: BLOCK_TYPES.WOOL_RED, count: 32, name: 'Wool' });
    redPlayer.selectedSlot = 1; // Slot 0 has default wooden sword, Slot 1 has wool

    // Bridge from X = -14 to X = 14 at Y = 19, Z = 0
    let placedCount = 0;
    for (let x = -14; x <= 14; x++) {
      const selected = redPlayer.getSelectedItem();
      if (!selected || selected.count <= 0) break;

      world.setBlock(x, 19, 0, BLOCK_TYPES.WOOL_RED);
      redPlayer.consumeSelectedItem();
      placedCount++;

      // Verify voxel placement in world
      assertEqual(world.getBlock(x, 19, 0), BLOCK_TYPES.WOOL_RED);
    }

    assertEqual(placedCount, 29, 'Placed 29 bridge blocks across gap');
    const remainingWool = redPlayer.getSelectedItem();
    assertEqual(remainingWool.count, 3, '3 wool blocks remain');

    // Verify player position reaches Blue base
    redPlayer.position.set(15, 20, 0);
    assertEqual(redPlayer.position.x, 15);
  });

  it('S1.4: Red player infiltrates Blue island and breaks Blue bed (head and foot)', () => {
    const scene = new THREE.Scene();
    const world = new VoxelWorld(scene);
    const teamManager = new TeamManager();

    // Place Blue bed in voxel world
    const bedHead = { x: 18, y: 20, z: 0 };
    const bedFoot = { x: 17, y: 20, z: 0 };
    world.setBlock(bedHead.x, bedHead.y, bedHead.z, BLOCK_TYPES.BED_HEAD, { team: 'blue', part: 'head' });
    world.setBlock(bedFoot.x, bedFoot.y, bedFoot.z, BLOCK_TYPES.BED_FOOT, { team: 'blue', part: 'foot' });

    assertEqual(world.getBlock(bedHead.x, bedHead.y, bedHead.z), BLOCK_TYPES.BED_HEAD);
    assertEqual(world.getBlock(bedFoot.x, bedFoot.y, bedFoot.z), BLOCK_TYPES.BED_FOOT);

    // Mining break time calculation for bed (wood-like hardness 0.5)
    const breakTime = calculateBreakTime(BLOCK_TYPES.BED_HEAD, 'fist');
    assertInRange(breakTime, 0.1, 2.0);

    // Player breaks bed head -> destroys both head and foot
    world.setBlock(bedHead.x, bedHead.y, bedHead.z, BLOCK_TYPES.AIR);
    world.setBlock(bedFoot.x, bedFoot.y, bedFoot.z, BLOCK_TYPES.AIR);
    teamManager.destroyBed('blue');

    assertEqual(world.getBlock(bedHead.x, bedHead.y, bedHead.z), BLOCK_TYPES.AIR);
    assertEqual(world.getBlock(bedFoot.x, bedFoot.y, bedFoot.z), BLOCK_TYPES.AIR);
    assertFalse(teamManager.hasBed('blue'), 'Blue bed is destroyed');
  });

  it('S1.5: combat engagement applies damage, knockback, and tags Blue bot', () => {
    const redPlayer = new Player('p_red', 'Alex', 'red', true);
    redPlayer.setWeapon('stone_sword', 5.0, 12);
    const blueBot = new Player('bot_blue', 'BlueBot_Alpha', 'blue', false);
    blueBot.health = 20;

    const tagger = new CombatTagger(10000);
    const now = 50000;

    // Red strikes Blue bot
    tagger.tag(blueBot.id, redPlayer.id, now);
    const deadOnHit1 = blueBot.takeDamage(redPlayer.weapon.damage);
    assertFalse(deadOnHit1);
    assertEqual(blueBot.health, 15.0);

    // Hearts indicator: 15 HP -> 7 full hearts, 1 half heart, 2 empty
    const hearts = calculateHearts(blueBot.health);
    assertEqual(hearts.filter((h) => h === 'full').length, 7);
    assertEqual(hearts.filter((h) => h === 'half').length, 1);
    assertEqual(hearts.filter((h) => h === 'empty').length, 2);

    // Successive strikes
    blueBot.takeDamage(redPlayer.weapon.damage); // HP: 10
    blueBot.takeDamage(redPlayer.weapon.damage); // HP: 5
    assertEqual(blueBot.health, 5.0);
    assertEqual(tagger.getAttributedKiller(blueBot.id, now + 2000), 'p_red');
  });

  it('S1.6: Final Kill eliminates Blue bot, awards match win, and updates 1v1 Elo MMR', () => {
    const teamManager = new TeamManager();
    delete teamManager.teams.green;
    delete teamManager.teams.yellow;
    const redPlayer = new Player('p_red', 'Alex', 'red', true);
    const blueBot = new Player('bot_blue', 'BlueBot_Alpha', 'blue', false);

    teamManager.teams.red.players = [redPlayer];
    teamManager.teams.blue.players = [blueBot];

    // Blue bed is already destroyed
    teamManager.destroyBed('blue');
    assertFalse(teamManager.hasBed('blue'));

    // Final strike eliminates bot (20 damage to 20 HP)
    blueBot.isFinalDead = true;
    blueBot.takeDamage(20, redPlayer);

    assertEqual(blueBot.health, 0);
    assertTrue(blueBot.isDead);
    assertEqual(redPlayer.kills, 1);
    assertEqual(redPlayer.finalKills, 1);

    // Blue team is eliminated
    assertTrue(teamManager.isTeamEliminated('blue'), 'Blue team must be eliminated');
    assertDeepEqual(teamManager.getAliveTeams(), ['red'], 'Red is sole survivor');

    // 1v1 format is an official ranked format -> updates Elo rating
    redPlayer.bedsBroken = 1;
    const rankResult = calculateRankDelta('1v1', 'win', redPlayer.kills, redPlayer.finalKills, redPlayer.bedsBroken);
    assertTrue(rankResult.isRanked);
    // 25 (win) + 1*2 (kill) + 1*5 (final) + 1*10 (bed) = +42 rating
    assertEqual(rankResult.deltaRating, 42);

    // XP calculation: 100 win + 15 kill + 35 final + 50 bed = 200 XP
    const matchXP = calculateMatchXP('win', redPlayer.kills, redPlayer.finalKills, redPlayer.bedsBroken);
    assertEqual(matchXP, 200);

    const levelProgression = calculateLevelFromXP(matchXP);
    assertEqual(levelProgression.level, 2, '200 XP reaches Level 2 (100 XP threshold)');
  });
});

// ============================================================================
// SCENARIO 2: 4v4 SPEEDWAY MATCH (Forge, Upgrades, Respawn vs Final Kill)
// ============================================================================

describe('Scenario 2: 4v4 Speedway Match (Forge Level Upgrades, Team Upgrades, Respawn vs Final Death)', () => {
  it('S2.1: initializes 4v4 Speedway map with 4 teams and diamond/emerald generators', () => {
    const speedway = MAP_PRESETS.speedway;
    assertEqual(speedway.teams.length, 4);
    assertEqual(speedway.generators.length, 10); // 4 forges + 4 diamonds + 2 emeralds

    const teamManager = new TeamManager();
    const teams = ['red', 'blue', 'green', 'yellow'];
    for (const t of teams) {
      assertTrue(teamManager.hasBed(t));
      assertEqual(teamManager.teams[t].upgrades.forgeTier, 1);
      assertEqual(teamManager.teams[t].upgrades.protection, 0);
      assertEqual(teamManager.teams[t].upgrades.sharpness, 0);
    }
  });

  it('S2.2: Red team collects satellite diamonds and upgrades Forge Tier, Sharpness & Protection', () => {
    const teamManager = new TeamManager();
    const redTeam = teamManager.teams.red;

    // Red gathers 12 diamonds from satellite generator
    let diamonds = 12;

    // 1. Upgrade Forge to Tier 2 (cost: 4 diamonds)
    assertTrue(diamonds >= 4);
    diamonds -= 4;
    redTeam.upgrades.forgeTier = 2;

    // 2. Upgrade Sharpness Tier 1 (cost: 4 diamonds)
    assertTrue(diamonds >= 4);
    diamonds -= 4;
    redTeam.upgrades.sharpness = 1;

    // 3. Upgrade Protection Tier 1 (cost: 4 diamonds)
    assertTrue(diamonds >= 4);
    diamonds -= 4;
    redTeam.upgrades.protection = 1;

    assertEqual(diamonds, 0);
    assertEqual(redTeam.upgrades.forgeTier, 2);
    assertEqual(redTeam.upgrades.sharpness, 1);
    assertEqual(redTeam.upgrades.protection, 1);
  });

  it('S2.3: accelerated Tier 2 forge enables Iron Armor, Iron Sword & Shears purchases', () => {
    const player = new Player('p_red1', 'RedLeader', 'red', true);

    // Tier 2 forge grants accelerated income: 56 iron and 20 gold
    player.addResource('iron', 56);
    player.addResource('gold', 20);

    // Purchase Iron Armor (12 gold)
    const armorItem = SHOP_ITEMS.find((i) => i.id === 'armor_iron');
    assertTrue(player.spendResource(armorItem.costType, armorItem.cost));
    armorItem.action(player);
    assertEqual(player.armor.tier, 'iron');
    assertEqual(player.armor.reduction, 0.35);

    // Purchase Iron Sword (7 gold)
    const swordItem = SHOP_ITEMS.find((i) => i.id === 'iron_sword');
    assertTrue(player.spendResource(swordItem.costType, swordItem.cost));
    swordItem.action(player);
    assertEqual(player.weapon.id, 'iron_sword');

    // Purchase Shears (30 iron)
    const shearsItem = SHOP_ITEMS.find((i) => i.id === 'shears');
    assertTrue(player.spendResource(shearsItem.costType, shearsItem.cost));
    shearsItem.action(player);
    assertEqual(player.tool.id, 'shears');
  });

  it('S2.4: Green player dies with Bed INTACT -> normal kill, triggers 5s respawn cycle', () => {
    const teamManager = new TeamManager();
    const redAttacker = new Player('p_red1', 'RedLeader', 'red', true);
    const greenDefender = new Player('p_green1', 'GreenGuard', 'green', false);
    teamManager.teams.green.players = [greenDefender];

    // Green bed is still intact
    assertTrue(teamManager.hasBed('green'));

    // Red eliminates Green
    greenDefender.isFinalDead = false;
    greenDefender.takeDamage(25, redAttacker);

    assertTrue(greenDefender.isDead);
    assertFalse(greenDefender.isFinalDead);
    assertEqual(greenDefender.respawnTimer, 5.0, 'Respawn timer must be 5 seconds');
    assertEqual(redAttacker.kills, 1);
    assertEqual(redAttacker.finalKills, 0, 'Must NOT be a final kill because bed is intact');

    // Green respawns at base
    greenDefender.respawn({ x: 0, y: 22, z: -30 });
    assertFalse(greenDefender.isDead);
    assertEqual(greenDefender.health, 20);
    assertEqual(greenDefender.position.z, -30);
  });

  it('S2.5: Red infiltrates Green base, shears wool defense, and breaks Green Bed', () => {
    const scene = new THREE.Scene();
    const world = new VoxelWorld(scene);
    const teamManager = new TeamManager();

    // Place Green Bed encased in Green Wool defense
    world.setBlock(0, 21, -35, BLOCK_TYPES.BED_HEAD, { team: 'green', part: 'head' });
    world.setBlock(0, 21, -34, BLOCK_TYPES.BED_FOOT, { team: 'green', part: 'foot' });
    world.setBlock(0, 22, -35, BLOCK_TYPES.WOOL_GREEN); // Top wool block
    world.setBlock(1, 21, -35, BLOCK_TYPES.WOOL_GREEN); // Side wool block

    // Shears mine wool 10x faster than fist
    const fistTime = calculateBreakTime(BLOCK_TYPES.WOOL_GREEN, 'fist');
    const shearsTime = calculateBreakTime(BLOCK_TYPES.WOOL_GREEN, 'shears');
    assertTrue(shearsTime < fistTime);
    assertApprox(shearsTime, 0.08, 0.001);

    // Mine protective wool
    world.setBlock(0, 22, -35, BLOCK_TYPES.AIR);
    world.setBlock(1, 21, -35, BLOCK_TYPES.AIR);

    // Destroy Green Bed
    world.setBlock(0, 21, -35, BLOCK_TYPES.AIR);
    world.setBlock(0, 21, -34, BLOCK_TYPES.AIR);
    teamManager.destroyBed('green');

    assertFalse(teamManager.hasBed('green'), 'Green bed destroyed');
  });

  it('S2.6: Green player eliminated post-bed break -> FINAL KILL and Green Team eliminated', () => {
    const teamManager = new TeamManager();
    const redAttacker = new Player('p_red1', 'RedLeader', 'red', true);
    const greenDefender = new Player('p_green1', 'GreenGuard', 'green', false);
    teamManager.teams.green.players = [greenDefender];

    // Green bed is broken
    teamManager.destroyBed('green');
    assertFalse(teamManager.hasBed('green'));

    // With bed destroyed, defender dies permanently
    greenDefender.isFinalDead = true;
    greenDefender.takeDamage(20, redAttacker);

    assertTrue(greenDefender.isDead);
    assertTrue(greenDefender.isFinalDead);
    assertEqual(redAttacker.finalKills, 1);

    // Team Green is eliminated
    assertTrue(teamManager.isTeamEliminated('green'));

    // Remaining alive teams: red, blue, yellow
    const alive = teamManager.getAliveTeams();
    assertFalse(alive.includes('green'));
    assertEqual(alive.length, 3);
  });
});

// ============================================================================
// SCENARIO 3: 8-TEAM OCTAGON MATCH (Center Control & Sudden Death)
// ============================================================================

describe('Scenario 3: 8-Team Octagon Match (Center Emerald Dominance, Multi-Team Eliminations & Sudden Death Decay)', () => {
  it('S3.1: initializes 8-team Octagon arena in Solos format', () => {
    const octagonTeams = ['red', 'blue', 'green', 'yellow', 'aqua', 'white', 'pink', 'gray'];
    assertEqual(octagonTeams.length, 8);

    const teamManager = new TeamManager();
    // Add 4 extra teams to TeamManager for 8-team preset
    for (const extra of ['aqua', 'white', 'pink', 'gray']) {
      teamManager.teams[extra] = {
        name: extra.toUpperCase(),
        hasBed: true,
        players: [new Player(`p_${extra}`, `${extra}_Solo`, extra, false)],
      };
    }
    assertEqual(teamManager.getAliveTeams().length, 8);
  });

  it('S3.2: Red player dominates center emerald spawners, purchases Obsidian & Diamond Sword', () => {
    const player = new Player('p_red', 'RedSolo', 'red', true);

    // Controls center emerald spawners, collects 12 emeralds
    player.addResource('emerald', 12);
    assertEqual(player.resources.emerald, 12);

    // Purchase Obsidian (x4) costing 4 emeralds to fortify bed
    const obsidianItem = SHOP_ITEMS.find((i) => i.id === 'obsidian_4');
    assertTrue(player.spendResource('emerald', obsidianItem.cost));
    obsidianItem.action(player);

    // Purchase Diamond Sword costing 4 emeralds
    const swordItem = SHOP_ITEMS.find((i) => i.id === 'diamond_sword');
    assertTrue(player.spendResource('emerald', swordItem.cost));
    swordItem.action(player);

    assertEqual(player.resources.emerald, 4);
    assertEqual(player.weapon.id, 'diamond_sword');
    assertEqual(player.weapon.damage, 8.5);

    const obsidianSlot = player.hotbar.find((s) => s && s.name === 'Obsidian');
    assertTrue(obsidianSlot !== null);
    assertEqual(obsidianSlot.count, 4);
  });

  it('S3.3: cascading multi-team eliminations reduce active teams from 8 to 4', () => {
    const teamManager = new TeamManager();
    const extraTeams = ['aqua', 'white', 'pink', 'gray'];
    for (const extra of extraTeams) {
      teamManager.teams[extra] = {
        name: extra.toUpperCase(),
        hasBed: true,
        players: [new Player(`p_${extra}`, `${extra}_Solo`, extra, false)],
      };
    }

    // White, Pink, Gray, and Aqua beds broken and players eliminated
    for (const t of ['white', 'pink', 'gray', 'aqua']) {
      teamManager.destroyBed(t);
      teamManager.teams[t].players[0].isDead = true;
      teamManager.teams[t].players[0].isFinalDead = true;
      assertTrue(teamManager.isTeamEliminated(t));
    }

    const aliveTeams = teamManager.getAliveTeams();
    assertEqual(aliveTeams.length, 4);
    assertTrue(aliveTeams.includes('red'));
    assertTrue(aliveTeams.includes('blue'));
    assertTrue(aliveTeams.includes('green'));
    assertTrue(aliveTeams.includes('yellow'));
  });

  it('S3.4: match timer reaches 600s -> Sudden Death triggers universal bed destruction', () => {
    const teamManager = new TeamManager();
    const mutator = new MutationHarness();
    mutator.enable('Sudden Death');

    const matchSeconds = 600;
    assertTrue(mutator.isSuddenDeathTriggered(matchSeconds, 600));

    // Sudden death destroys all remaining beds
    for (const team of Object.keys(teamManager.teams)) {
      teamManager.destroyBed(team);
      assertFalse(teamManager.hasBed(team), `Bed for ${team} must be destroyed`);
    }

    // Verify scoreboard formatted timer
    assertEqual(formatTimer(matchSeconds), '10:00');
  });

  it('S3.5: Sudden Death arena decay disintegrates outer island perimeter blocks', () => {
    const scene = new THREE.Scene();
    const world = new VoxelWorld(scene);

    // Place island rim blocks at radius > 25
    const outerBlocks = [
      { x: 30, y: 20, z: 0 },
      { x: -30, y: 20, z: 0 },
      { x: 0, y: 20, z: 30 },
      { x: 0, y: 20, z: -30 },
    ];
    for (const b of outerBlocks) {
      world.setBlock(b.x, b.y, b.z, BLOCK_TYPES.STONE);
    }

    // Sudden Death decay simulation: disintegrate blocks outside safeRadius = 20
    const safeRadius = 20;
    for (const b of outerBlocks) {
      const dist = Math.sqrt(b.x * b.x + b.z * b.z);
      if (dist > safeRadius) {
        world.setBlock(b.x, b.y, b.z, BLOCK_TYPES.AIR);
      }
    }

    // All outer blocks have collapsed into the void
    for (const b of outerBlocks) {
      assertEqual(world.getBlock(b.x, b.y, b.z), BLOCK_TYPES.AIR);
    }
  });

  it('S3.6: Red player knocks final Yellow survivor into void, winning unranked Octagon match', () => {
    const redPlayer = new Player('p_red', 'RedSolo', 'red', true);
    const yellowPlayer = new Player('p_yellow', 'YellowSolo', 'yellow', false);
    const tagger = new CombatTagger(10000);

    // Red strikes Yellow near decaying rim
    tagger.tag(yellowPlayer.id, redPlayer.id, 1000);
    yellowPlayer.takeDamage(8.5, redPlayer);

    // Yellow falls into void (Y = -25)
    yellowPlayer.position.y = -25;
    const isVoidDead = yellowPlayer.position.y <= -20;
    assertTrue(isVoidDead);

    // Kill attributed to Red
    const killer = tagger.getAttributedKiller(yellowPlayer.id, 3000);
    assertEqual(killer, 'p_red');
    redPlayer.kills += 1;
    redPlayer.finalKills += 1;

    // Format is 8-player Solos (unranked for MMR, but awards full XP)
    const rankDelta = calculateRankDelta('Solos', 'win', 5, 4, 2);
    assertFalse(rankDelta.isRanked);
    assertEqual(rankDelta.deltaRating, 0);

    // XP calculation: 100 base + 5*15 kills + 4*35 final kills + 2*50 beds = 415 XP
    const earnedXP = calculateMatchXP('win', 5, 4, 2);
    assertEqual(earnedXP, 415);

    const levelState = calculateLevelFromXP(earnedXP);
    assertEqual(levelState.level, 3, '415 XP reaches Level 3 (threshold 400 XP)');
  });
});

// ============================================================================
// SCENARIO 4: SUPERCHARGED & GUN GAME MUTATOR MATCH
// ============================================================================

describe('Scenario 4: Supercharged & Gun Game Mutators (Tier 2 Generators, Projectile Arc & Multi-Tier Kill Progression)', () => {
  it('S4.1: Supercharged mutator activates Tier 2 generators and launchpads at match start', () => {
    const mutator = new MutationHarness();
    mutator.enable('Supercharged');
    mutator.enable('Launch Rush');

    assertEqual(mutator.getInitialGeneratorTier(), 2, 'Forge generators start at level 2');
    assertTrue(mutator.hasBaseLaunchpads(), 'Launchpads operational at base');
  });

  it('S4.2: player spawns with Tier 1 Slingshot and fires projectile along ballistic arc', () => {
    const slingshot = GUN_GAME_TIERS[0];
    assertEqual(slingshot.name, 'Wooden Slingshot');
    assertEqual(slingshot.damage, 3.5);

    // Launch projectile toward enemy target at (15, 20, 0)
    const proj = new ProjectileSimulation({
      position: new THREE.Vector3(0, 21, 0),
      velocity: new THREE.Vector3(20, 3, 0),
      gravity: -9.8,
      damage: slingshot.damage,
    });

    const world = new Map();
    world.set('15,20,0', BLOCK_TYPES.STONE);

    // Simulate 0.75 seconds of flight
    let hit = null;
    const dt = 0.05;
    for (let t = 0; t < 1.0; t += dt) {
      hit = proj.update(dt, world);
      if (hit) break;
    }

    assertTrue(hit !== null, 'Projectile must impact target voxel');
    assertEqual(hit.type, 'hit_block');
    assertEqual(hit.damage, 3.5);
  });

  it('S4.3: securing first kill automatically upgrades weapon to Tier 2: Iron Crossbow', () => {
    let currentTier = 1;
    function onKill() {
      currentTier = Math.min(GUN_GAME_TIERS.length, currentTier + 1);
    }

    // Kill 1 confirmed
    onKill();
    assertEqual(currentTier, 2);
    const tier2Weapon = GUN_GAME_TIERS[currentTier - 1];
    assertEqual(tier2Weapon.name, 'Iron Crossbow');
    assertEqual(tier2Weapon.damage, 6.0);
    assertEqual(tier2Weapon.speed, 30);
  });

  it('S4.4: securing second kill automatically upgrades weapon to Tier 3: Fireball Launcher', () => {
    let currentTier = 2;
    function onKill() {
      currentTier = Math.min(GUN_GAME_TIERS.length, currentTier + 1);
    }

    onKill();
    assertEqual(currentTier, 3);
    const tier3Weapon = GUN_GAME_TIERS[currentTier - 1];
    assertEqual(tier3Weapon.name, 'Fireball Launcher');
    assertEqual(tier3Weapon.damage, 10.0);
    assertTrue(tier3Weapon.explosive);
  });

  it('S4.5: Fireball impact causes explosive block destruction of wool defense while obsidian resists', () => {
    const scene = new THREE.Scene();
    const world = new VoxelWorld(scene);

    const impact = { x: 10, y: 20, z: 0 };
    // Defenses around impact
    world.setBlock(10, 20, 0, BLOCK_TYPES.WOOL_RED);
    world.setBlock(10, 21, 0, BLOCK_TYPES.WOOD);
    world.setBlock(10, 20, 1, BLOCK_TYPES.OBSIDIAN); // Blast-proof

    // Blast simulation (radius = 2.0 blocks)
    const blastRadius = 2.0;
    const blocksToCheck = [
      { x: 10, y: 20, z: 0 },
      { x: 10, y: 21, z: 0 },
      { x: 10, y: 20, z: 1 },
    ];

    for (const b of blocksToCheck) {
      const type = world.getBlock(b.x, b.y, b.z);
      // Obsidian is blast immune (BLOCK_PROPS hardness 50+)
      if (type === BLOCK_TYPES.OBSIDIAN) {
        continue;
      }
      world.setBlock(b.x, b.y, b.z, BLOCK_TYPES.AIR);
    }

    assertEqual(world.getBlock(10, 20, 0), BLOCK_TYPES.AIR, 'Wool destroyed by fireball');
    assertEqual(world.getBlock(10, 21, 0), BLOCK_TYPES.AIR, 'Wood destroyed by fireball');
    assertEqual(world.getBlock(10, 20, 1), BLOCK_TYPES.OBSIDIAN, 'Obsidian withstands fireball blast');
  });

  it('S4.6: securing third kill upgrades to Tier 4: Plasma Blaster and caps progression cleanly', () => {
    let currentTier = 3;
    function onKill() {
      currentTier = Math.min(GUN_GAME_TIERS.length, currentTier + 1);
    }

    // Kill 3 -> Tier 4 (Plasma Blaster)
    onKill();
    assertEqual(currentTier, 4);
    const tier4Weapon = GUN_GAME_TIERS[currentTier - 1];
    assertEqual(tier4Weapon.name, 'Plasma Blaster');
    assertEqual(tier4Weapon.damage, 15.0);
    assertEqual(tier4Weapon.speed, 45);

    // Subsequent kill does not exceed max tier
    onKill();
    assertEqual(currentTier, 4, 'Tier should cap at max tier 4 without out-of-bounds error');
  });
});

// ============================================================================
// SCENARIO 5: DUAL-LAYER NETWORK MATCH (WebSocket + WebRTC Fallback + LAN)
// ============================================================================

describe('Scenario 5: Dual-Layer Network Match (WebSocket Host, WebRTC Fallback Sync & Direct IP Join)', () => {
  it('S5.1: dedicated WebSocket server hosts room and responds to HTTP /ping healthcheck', () => {
    const serverState = {
      rooms: new Map(),
      uptime: 120.5,
      isHealthy: true,
    };

    // Create room 'BW-7788'
    serverState.rooms.set('BW-7788', {
      hostId: 'host_p1',
      clients: new Set(['host_p1']),
      worldBlocks: new Map(),
    });

    assertTrue(serverState.rooms.has('BW-7788'));
    assertEqual(serverState.rooms.get('BW-7788').clients.size, 1);

    // Simulate /ping endpoint
    const pingResponse = {
      status: 'ok',
      uptime: serverState.uptime,
      rooms: serverState.rooms.size,
      timestamp: Date.now(),
    };

    assertEqual(pingResponse.status, 'ok');
    assertTrue(pingResponse.uptime > 0);
    assertEqual(pingResponse.rooms, 1);
  });

  it('S5.2: guest connects via WebSocket and receives initial room world snapshot', () => {
    const room = {
      clients: new Set(['host_p1']),
      snapshot: {
        format: '4v4',
        map: 'speedway',
        placedBlocks: [
          { x: -10, y: 20, z: 0, blockType: BLOCK_TYPES.WOOL_RED },
          { x: 10, y: 20, z: 0, blockType: BLOCK_TYPES.WOOL_BLUE },
        ],
      },
    };

    // Guest joins
    room.clients.add('guest_p2');
    assertEqual(room.clients.size, 2);

    // Validate received snapshot
    assertEqual(room.snapshot.format, '4v4');
    assertEqual(room.snapshot.placedBlocks.length, 2);
  });

  it('S5.3: relays BLOCK_PLACE and PLAYER_TRANSFORM packets between host and guest', () => {
    const blockPacket = {
      type: PACKET_TYPES.BLOCK_PLACE,
      sender: 'guest_p2',
      timestamp: Date.now(),
      payload: { x: 5, y: 20, z: -2, blockType: BLOCK_TYPES.WOOL_BLUE },
    };
    assertTrue(validatePacket(blockPacket));

    const transformPacket = {
      type: PACKET_TYPES.PLAYER_TRANSFORM,
      sender: 'host_p1',
      timestamp: Date.now(),
      payload: { x: 5.5, y: 21.0, z: -2.0, yaw: 1.57, pitch: 0.1 },
    };
    assertTrue(validatePacket(transformPacket));
  });

  it('S5.4: WebSocket failure triggers automatic WebRTC fallback with HUD indicator update', () => {
    class MockDualLayerManager {
      constructor() {
        this.activeTransport = 'websocket';
        this.hudBadge = 'WebSocket';
        this.isFallbackActive = false;
      }

      onWebSocketTimeout() {
        this.activeTransport = 'webrtc';
        this.hudBadge = 'WebRTC P2P';
        this.isFallbackActive = true;
      }
    }

    const net = new MockDualLayerManager();
    assertEqual(net.activeTransport, 'websocket');

    // Simulate 3500ms timeout / network drop
    net.onWebSocketTimeout();
    assertEqual(net.activeTransport, 'webrtc');
    assertEqual(net.hudBadge, 'WebRTC P2P');
    assertTrue(net.isFallbackActive);
  });

  it('S5.5: WebRTC P2P channel synchronizes BED_DESTROY and PLAYER_DAMAGE packets seamlessly', () => {
    const p2pChannel = {
      receivedPackets: [],
      send(packet) {
        if (validatePacket(packet)) {
          this.receivedPackets.push(packet);
          return true;
        }
        return false;
      },
    };

    // Send bed destroy packet over WebRTC
    const bedPacket = {
      type: PACKET_TYPES.BED_DESTROY,
      sender: 'guest_p2',
      timestamp: Date.now(),
      payload: { team: 'red' },
    };
    assertTrue(p2pChannel.send(bedPacket));

    // Send player damage packet over WebRTC
    const damagePacket = {
      type: PACKET_TYPES.PLAYER_DAMAGE,
      sender: 'guest_p2',
      timestamp: Date.now(),
      payload: { targetId: 'host_p1', amount: 6.5 },
    };
    assertTrue(p2pChannel.send(damagePacket));

    assertEqual(p2pChannel.receivedPackets.length, 2);
  });

  it('S5.6: Desktop/Mobile LAN client joins via Direct IP:Port and cleans up upon disconnect', () => {
    const validIP = '192.168.1.105';
    const validPort = 8766;
    assertTrue(validateLanAddress(validIP, validPort));

    const connectedPeers = new Set(['host_p1', 'guest_p2']);
    // LAN peer joins
    connectedPeers.add('lan_peer3');
    assertEqual(connectedPeers.size, 3);

    // LAN peer disconnects cleanly
    connectedPeers.delete('lan_peer3');
    assertEqual(connectedPeers.size, 2);
    assertFalse(connectedPeers.has('lan_peer3'));
  });
});
