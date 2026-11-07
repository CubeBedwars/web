/**
 * tests/stress_m3_gen2_challenger.js
 * 
 * EMPIRICAL ADVERSARIAL STRESS TEST SUITE — CHALLENGER M3 GEN2
 * Milestone 3: Multi-Map System, Match Formats, and Match Mutation Modifiers
 * 
 * Scope:
 * 1. Map geometry of all 3 maps (Colosseum, Speedway, Octagon):
 *    - Bed head and foot coordinates, orthogonal adjacency (dist == 1.0)
 *    - Solid foundation underneath both head and foot (y = head.y - 1) for all teams
 *      (Especially Octagon all 8 teams: red, blue, green, yellow, aqua, white, pink, gray)
 *    - Forge coordinates, diamond generator coordinates, emerald generator coordinates, shopkeepers
 * 2. GameManager.prototype.handleRightClick:
 *    - Holding a block, projectile (fireball/gun), consumable (gapple), weapon/tool, or null/empty slot
 *    - Player collision rejection, entity ignore when dead, shopkeeper distance checks
 *    - Verification that NO unhandled ReferenceError, TypeError, or crash occurs
 * 3. Dynamic Team Formats in TeamManager:
 *    - Solos (1v1v1v1 / 8-team solo)
 *    - Duos (2v2v2v2)
 *    - Trios (3v3v3v3)
 *    - 4v4 Ranked
 *    - 1v1 Duels
 *    - Team elimination with 0-player teams when bed broken
 */

import * as THREE from 'three';
import './mocks/browser-shim.js';
import { BLOCK_TYPES, VoxelWorld } from '../src/engine/VoxelWorld.js';
import { MAP_PRESETS } from '../src/game/MapPresets.js';
import { GameManager } from '../src/game/GameManager.js';
import { TeamManager } from '../src/game/TeamManager.js';

console.log('\n╔══════════════════════════════════════════════════════════════════════╗');
console.log('║       CHALLENGER M3 GEN 2: EMPIRICAL ADVERSARIAL STRESS SUITE         ║');
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

// ============================================================================
// SUITE 1: MAP GEOMETRY & VOXEL FOUNDATION STRESS TEST (Colosseum, Speedway, Octagon)
// ============================================================================
console.log('--- SUITE 1: Map Geometry & Voxel Foundation Stress Test ---');

const mapNames = ['colosseum', 'speedway', 'octagon'];

for (const mapKey of mapNames) {
  const preset = MAP_PRESETS[mapKey];
  assert(preset !== undefined, `1.0: Preset '${mapKey}' exists in MAP_PRESETS`);

  const scene = new THREE.Scene();
  const world = new VoxelWorld(scene);
  world.rebuildMeshes = () => {}; // headless mock
  preset.generateGeometry(world);

  console.log(`\n  Checking Map '${mapKey}' (${preset.name}) with ${preset.teams.length} teams...`);

  // 1.1 Team Beds & Solid Foundations
  for (const team of preset.teams) {
    const bed = preset.beds[team];
    assert(bed !== undefined, `1.1a [${mapKey}/${team}]: Bed definition exists`);
    assert(bed.head !== undefined && bed.foot !== undefined, `1.1b [${mapKey}/${team}]: Head and Foot defined`);

    const h = bed.head;
    const f = bed.foot;

    // Head and foot must be on same horizontal plane (y level)
    assert(h.y === f.y, `1.1c [${mapKey}/${team}]: Bed head and foot have identical Y level (${h.y} === ${f.y})`);

    // Orthogonal adjacency: Euclidean distance === 1.0 and Manhattan distance === 1
    const dx = Math.abs(h.x - f.x);
    const dy = Math.abs(h.y - f.y);
    const dz = Math.abs(h.z - f.z);
    const manhattanDist = dx + dy + dz;
    const euclideanDist = Math.hypot(h.x - f.x, h.y - f.y, h.z - f.z);

    assert(manhattanDist === 1, `1.1d [${mapKey}/${team}]: Manhattan distance between head and foot is strictly 1 (got ${manhattanDist})`);
    assert(Math.abs(euclideanDist - 1.0) < 1e-5, `1.1e [${mapKey}/${team}]: Euclidean distance is strictly 1.0 (got ${euclideanDist})`);

    // Verify bed head and foot voxels populated in world
    const headBlock = world.getBlock(h.x, h.y, h.z);
    const footBlock = world.getBlock(f.x, f.y, f.z);
    assert(headBlock === BLOCK_TYPES.BED_HEAD, `1.1f [${mapKey}/${team}]: Voxel at head (${h.x},${h.y},${h.z}) is BED_HEAD (${headBlock} === ${BLOCK_TYPES.BED_HEAD})`);
    assert(footBlock === BLOCK_TYPES.BED_FOOT, `1.1g [${mapKey}/${team}]: Voxel at foot (${f.x},${f.y},${f.z}) is BED_FOOT (${footBlock} === ${BLOCK_TYPES.BED_FOOT})`);

    // CRITICAL: Solid foundation directly underneath head and foot (y = head.y - 1)
    const underHead = world.getBlock(h.x, h.y - 1, h.z);
    const underFoot = world.getBlock(f.x, f.y - 1, f.z);

    assert(
      underHead !== BLOCK_TYPES.AIR && underHead !== undefined && underHead > 0,
      `1.1h [${mapKey}/${team}]: Solid foundation directly under bed head (block type ${underHead} !== AIR)`,
      `Found block ${underHead} under head at (${h.x}, ${h.y - 1}, ${h.z})`
    );
    assert(
      underFoot !== BLOCK_TYPES.AIR && underFoot !== undefined && underFoot > 0,
      `1.1i [${mapKey}/${team}]: Solid foundation directly under bed foot (block type ${underFoot} !== AIR)`,
      `Found block ${underFoot} under foot at (${f.x}, ${f.y - 1}, ${f.z})`
    );
  }

  // 1.2 Forge Generators
  const forges = preset.generators.filter(g => g.type === 'forge');
  assert(forges.length === preset.teams.length, `1.2a [${mapKey}]: Exactly ${preset.teams.length} forges defined (found ${forges.length})`);
  for (const forge of forges) {
    assert(preset.teams.includes(forge.team), `1.2b [${mapKey}]: Forge assigned to valid team '${forge.team}'`);
    const underForge = world.getBlock(forge.pos.x, forge.pos.y - 1, forge.pos.z);
    assert(
      underForge !== BLOCK_TYPES.AIR && underForge !== undefined && underForge > 0,
      `1.2c [${mapKey}/${forge.team}]: Solid foundation directly under forge at (${forge.pos.x}, ${forge.pos.y - 1}, ${forge.pos.z})`
    );
  }

  // 1.3 Diamond Generators
  const diamonds = preset.generators.filter(g => g.type === 'diamond');
  assert(diamonds.length > 0, `1.3a [${mapKey}]: Map has diamond generators (count: ${diamonds.length})`);
  for (let idx = 0; idx < diamonds.length; idx++) {
    const d = diamonds[idx];
    const atOrUnder = world.getBlock(d.pos.x, d.pos.y, d.pos.z) || world.getBlock(d.pos.x, d.pos.y - 1, d.pos.z);
    assert(
      atOrUnder !== BLOCK_TYPES.AIR && atOrUnder !== undefined && atOrUnder > 0,
      `1.3b [${mapKey}]: Diamond spawner #${idx + 1} has solid pillar or foundation (block ${atOrUnder})`
    );
  }

  // 1.4 Emerald Generators
  const emeralds = preset.generators.filter(g => g.type === 'emerald');
  assert(emeralds.length > 0, `1.4a [${mapKey}]: Map has emerald generators (count: ${emeralds.length})`);
  for (let idx = 0; idx < emeralds.length; idx++) {
    const em = emeralds[idx];
    const atOrUnder = world.getBlock(em.pos.x, em.pos.y, em.pos.z) || world.getBlock(em.pos.x, em.pos.y - 1, em.pos.z);
    assert(
      atOrUnder !== BLOCK_TYPES.AIR && atOrUnder !== undefined && atOrUnder > 0,
      `1.4b [${mapKey}]: Emerald spawner #${idx + 1} has solid pillar or foundation (block ${atOrUnder})`
    );
  }

  // 1.5 Shopkeepers
  assert(preset.shopkeepers.length === preset.teams.length, `1.5a [${mapKey}]: Exactly ${preset.teams.length} shopkeepers defined`);
  for (const shop of preset.shopkeepers) {
    assert(preset.teams.includes(shop.team), `1.5b [${mapKey}]: Shopkeeper assigned to valid team '${shop.team}'`);
    const underShop = world.getBlock(shop.pos.x, shop.pos.y - 1, shop.pos.z);
    assert(
      underShop !== BLOCK_TYPES.AIR && underShop !== undefined && underShop > 0,
      `1.5c [${mapKey}/${shop.team}]: Solid foundation directly under shopkeeper at (${shop.pos.x}, ${shop.pos.y - 1}, ${shop.pos.z})`
    );

    // Verify shopkeeper is within reasonable walking distance of team spawn
    const spawn = preset.spawns[shop.team];
    const distToSpawn = Math.hypot(shop.pos.x - spawn.x, shop.pos.z - spawn.z);
    assert(
      distToSpawn <= 15,
      `1.5d [${mapKey}/${shop.team}]: Shopkeeper is within base perimeter of spawn (dist ${distToSpawn.toFixed(2)} <= 15 blocks)`
    );
  }
}

// Special check: Octagon all 8 teams foundation guarantee
console.log('\n  Deep verification of all 8 Octagon teams specifically...');
{
  const octWorld = new VoxelWorld(new THREE.Scene());
  octWorld.rebuildMeshes = () => {};
  MAP_PRESETS.octagon.generateGeometry(octWorld);

  const octTeams = ['red', 'blue', 'green', 'yellow', 'aqua', 'white', 'pink', 'gray'];
  for (const t of octTeams) {
    const bed = MAP_PRESETS.octagon.beds[t];
    const blockUnderHead = octWorld.getBlock(bed.head.x, bed.head.y - 1, bed.head.z);
    const blockUnderFoot = octWorld.getBlock(bed.foot.x, bed.foot.y - 1, bed.foot.z);
    assert(
      blockUnderHead === BLOCK_TYPES.GRASS,
      `1.6a [Octagon/${t}]: Block under bed head is solid GRASS (block type ${blockUnderHead})`
    );
    assert(
      blockUnderFoot === BLOCK_TYPES.GRASS,
      `1.6b [Octagon/${t}]: Block under bed foot is solid GRASS (block type ${blockUnderFoot})`
    );
  }
}

// ============================================================================
// SUITE 2: GAMEMANAGER.PROTOTYPE.HANDLERIGHTCLICK RUNTIME ROBUSTNESS
// ============================================================================
console.log('\n--- SUITE 2: GameManager.prototype.handleRightClick Runtime Robustness ---');

{
  function createMockGameManager() {
    const gm = Object.create(GameManager.prototype);
    gm.studioEditor = { isActive: false, handlePlacement: () => {} };
    gm.mapPreset = {
      shopkeepers: [
        { team: 'red', pos: { x: 0, y: 20, z: 0 }, name: 'Red Shopkeeper' },
      ],
    };
    gm.world = {
      setBlock: (x, y, z, bt) => { gm.world.lastPlaced = { x, y, z, bt }; },
      rebuildMeshes: () => {},
      lastPlaced: null,
    };
    gm.sound = {
      playBlockPlace: () => { gm.sound.blockPlaced = true; },
      playItemPickup: () => { gm.sound.itemPicked = true; },
      blockPlaced: false,
      itemPicked: false,
    };
    gm.hud = {
      openShopCalled: false,
      updateHotbarCalled: false,
      lastAnnouncement: null,
      openShop: () => { gm.hud.openShopCalled = true; },
      updateHotbar: () => { gm.hud.updateHotbarCalled = true; },
      showAnnouncement: (t, m) => { gm.hud.lastAnnouncement = { t, m }; },
    };
    gm.players = [];
    gm.projectilesFired = [];
    gm.fireProjectile = (shooter, item) => {
      gm.projectilesFired.push({ shooter, item });
    };
    gm.aimRaycastResult = { hit: false };
    gm.getAimRaycast = () => gm.aimRaycastResult;
    return gm;
  }

  // 2.1: Shopkeeper proximity interaction (< 4.0 blocks)
  {
    const gm = createMockGameManager();
    gm.localPlayer = {
      position: new THREE.Vector3(1, 20, 1), // dist to (0,20,0) is ~1.414 < 4.0
      getSelectedItem: () => ({ type: 'block', blockType: BLOCK_TYPES.WOOL_RED }),
    };

    let err = null;
    try {
      gm.handleRightClick();
    } catch (e) {
      err = e;
    }
    assert(err === null, '2.1a: Proximity to shopkeeper does not throw error');
    assert(gm.hud.openShopCalled === true, '2.1b: Proximity to shopkeeper triggers hud.openShop()');
    assert(gm.world.lastPlaced === null, '2.1c: Block was NOT placed while opening shopkeeper');
  }

  // 2.2: Projectile Launching (Fireball)
  {
    const gm = createMockGameManager();
    let consumed = false;
    gm.localPlayer = {
      position: new THREE.Vector3(20, 20, 20), // far from shopkeeper
      getSelectedItem: () => ({ type: 'projectile', id: 'fireball', damage: 15 }),
      consumeSelectedItem: () => { consumed = true; },
    };

    let err = null;
    try {
      gm.handleRightClick();
    } catch (e) {
      err = e;
    }
    assert(err === null, '2.2a: Launching fireball projectile does not throw ReferenceError');
    assert(gm.projectilesFired.length === 1, '2.2b: Exactly one projectile launched');
    assert(gm.projectilesFired[0].item.id === 'fireball', '2.2c: Fired item is fireball');
    assert(consumed === true, '2.2d: Fireball was consumed from inventory');
    assert(gm.hud.updateHotbarCalled === true, '2.2e: HUD hotbar updated');
  }

  // 2.3: Gun Game Projectile Weapon (Infinite ammo / no consume)
  {
    const gm = createMockGameManager();
    let consumed = false;
    gm.localPlayer = {
      position: new THREE.Vector3(20, 20, 20),
      getSelectedItem: () => ({ isGun: true, type: 'gun_game_weapon', id: 'iron_crossbow' }),
      consumeSelectedItem: () => { consumed = true; },
    };

    let err = null;
    try {
      gm.handleRightClick();
    } catch (e) {
      err = e;
    }
    assert(err === null, '2.3a: Firing Gun Game weapon does not throw error');
    assert(gm.projectilesFired.length === 1, '2.3b: Projectile fired for Gun Game weapon');
    assert(consumed === false, '2.3c: Gun Game projectile weapon is NOT consumed (infinite ammo)');
  }

  // 2.4: Block Placement - Normal clear space
  {
    const gm = createMockGameManager();
    let consumed = false;
    gm.localPlayer = {
      position: new THREE.Vector3(20, 20, 20),
      getSelectedItem: () => ({ type: 'block', blockType: BLOCK_TYPES.WOOD }),
      consumeSelectedItem: () => { consumed = true; },
    };
    gm.aimRaycastResult = { hit: true, placePos: { x: 10, y: 20, z: 10 } };
    gm.players = [
      { position: new THREE.Vector3(20, 20, 20), width: 0.6, height: 1.8, isDead: false }, // far away
    ];

    let err = null;
    try {
      gm.handleRightClick();
    } catch (e) {
      err = e;
    }
    assert(err === null, '2.4a: Placing block in open space does not throw error');
    assert(gm.world.lastPlaced !== null && gm.world.lastPlaced.x === 10, '2.4b: Block placed in world');
    assert(gm.world.lastPlaced.bt === BLOCK_TYPES.WOOD, '2.4c: Correct block type placed');
    assert(consumed === true, '2.4d: Block item consumed from hotbar');
    assert(gm.sound.blockPlaced === true, '2.4e: Block place sound played');
  }

  // 2.5: Block Placement - Obstructed by living player AABB
  {
    const gm = createMockGameManager();
    let consumed = false;
    gm.localPlayer = {
      position: new THREE.Vector3(20, 20, 20),
      getSelectedItem: () => ({ type: 'block', blockType: BLOCK_TYPES.WOOL_RED }),
      consumeSelectedItem: () => { consumed = true; },
    };
    gm.aimRaycastResult = { hit: true, placePos: { x: 10, y: 20, z: 10 } };
    // Entity positioned inside the placed block bounds [10..11, 20..21, 10..11]
    gm.players = [
      { position: new THREE.Vector3(10.2, 20.0, 10.2), width: 0.6, height: 1.8, isDead: false },
    ];

    let err = null;
    try {
      gm.handleRightClick();
    } catch (e) {
      err = e;
    }
    assert(err === null, '2.5a: Intersecting block placement does not throw error');
    assert(gm.world.lastPlaced === null, '2.5b: Block placement rejected when colliding with living entity');
    assert(consumed === false, '2.5c: Item not consumed when placement rejected');
  }

  // 2.6: Block Placement - Obstructed only by DEAD player (should allow placement)
  {
    const gm = createMockGameManager();
    let consumed = false;
    gm.localPlayer = {
      position: new THREE.Vector3(20, 20, 20),
      getSelectedItem: () => ({ type: 'block', blockType: BLOCK_TYPES.WOOL_BLUE }),
      consumeSelectedItem: () => { consumed = true; },
    };
    gm.aimRaycastResult = { hit: true, placePos: { x: 10, y: 20, z: 10 } };
    gm.players = [
      { position: new THREE.Vector3(10.2, 20.0, 10.2), width: 0.6, height: 1.8, isDead: true }, // DEAD entity
    ];

    let err = null;
    try {
      gm.handleRightClick();
    } catch (e) {
      err = e;
    }
    assert(err === null, '2.6a: Block placement over dead entity does not throw error');
    assert(gm.world.lastPlaced !== null, '2.6b: Dead entity does not block voxel placement');
    assert(consumed === true, '2.6c: Item consumed after placing over dead entity');
  }

  // 2.7: Consumable Golden Apple (eating)
  {
    const gm = createMockGameManager();
    let consumed = false;
    gm.localPlayer = {
      position: new THREE.Vector3(20, 20, 20),
      getSelectedItem: () => ({ type: 'consumable', id: 'gapple' }),
      consumeSelectedItem: () => { consumed = true; },
      health: 10,
      maxHealth: 20,
    };

    let err = null;
    try {
      gm.handleRightClick();
    } catch (e) {
      err = e;
    }
    assert(err === null, '2.7a: Consuming golden apple does not throw error');
    assert(gm.localPlayer.health === 18, '2.7b: Golden apple restored +8 HP (10 -> 18)');
    assert(consumed === true, '2.7c: Golden apple consumed');
    assert(gm.sound.itemPicked === true, '2.7d: Audio sound played');
    assert(gm.hud.lastAnnouncement !== null, '2.7e: HUD announcement triggered');

    // Test health clamping at maxHealth (19 + 8 -> capped at 20)
    consumed = false;
    gm.localPlayer.health = 19;
    gm.handleRightClick();
    assert(gm.localPlayer.health === 20, '2.7f: Golden apple heal clamped strictly to maxHealth (20)');
  }

  // 2.8: Weapon / Tool (Sword, Shears, Pickaxe) - Should be safe no-op on right click
  {
    const gm = createMockGameManager();
    let consumed = false;
    gm.localPlayer = {
      position: new THREE.Vector3(20, 20, 20),
      getSelectedItem: () => ({ type: 'weapon', id: 'diamond_sword', damage: 8 }),
      consumeSelectedItem: () => { consumed = true; },
    };

    let err = null;
    try {
      gm.handleRightClick();
    } catch (e) {
      err = e;
    }
    assert(err === null, '2.8a: Right-clicking with weapon does not throw error');
    assert(consumed === false, '2.8b: Weapon is not consumed');
    assert(gm.world.lastPlaced === null, '2.8c: Weapon does not place blocks');
    assert(gm.projectilesFired.length === 0, '2.8d: Weapon does not fire projectile');
  }

  // 2.9: Null, undefined, empty slot, malformed item
  {
    const adversarialSlots = [
      null,
      undefined,
      {},
      { type: 'unknown' },
      { type: 'consumable', id: 'unknown_potion' },
    ];

    for (const [idx, badItem] of adversarialSlots.entries()) {
      const gm = createMockGameManager();
      gm.localPlayer = {
        position: new THREE.Vector3(20, 20, 20),
        hotbar: [badItem],
        selectedSlot: 0,
        getSelectedItem: () => badItem,
        consumeSelectedItem: () => {},
      };

      let err = null;
      try {
        gm.handleRightClick();
      } catch (e) {
        err = e;
      }
      assert(err === null, `2.9.${idx + 1}: Adversarial item input (${JSON.stringify(badItem)}) handled cleanly without crash`);
    }

    // What if localPlayer has NO getSelectedItem method and empty hotbar?
    const gmFallback = createMockGameManager();
    gmFallback.localPlayer = {
      position: new THREE.Vector3(20, 20, 20),
      hotbar: [null, null],
      selectedSlot: 0,
    };
    let errFallback = null;
    try {
      gmFallback.handleRightClick();
    } catch (e) {
      errFallback = e;
    }
    assert(errFallback === null, '2.9.6: Fallback when getSelectedItem is undefined executes without error');
  }

  // 2.10: Studio Editor Active
  {
    const gm = createMockGameManager();
    let studioPlaced = false;
    gm.studioEditor = {
      isActive: true,
      handlePlacement: (ray) => { studioPlaced = true; },
    };
    gm.localPlayer = {
      position: new THREE.Vector3(20, 20, 20),
      getSelectedItem: () => ({ type: 'block', blockType: BLOCK_TYPES.STONE }),
    };

    gm.handleRightClick();
    assert(studioPlaced === true, '2.10: When studioEditor.isActive is true, right click delegates to studioEditor');
  }
}

// ============================================================================
// SUITE 3: DYNAMIC TEAM FORMATS IN TEAMMANAGER
// ============================================================================
console.log('\n--- SUITE 3: Dynamic Team Formats in TeamManager ---');

// Helper to create mock player
function createMockPlayer(id, team) {
  return {
    id,
    team,
    isDead: false,
    isFinalDead: false,
  };
}

// 3.1: Format: 1v1 Duels (Colosseum - 2 teams of 1 player)
{
  const tm = new TeamManager(['red', 'blue']);
  const pRed = createMockPlayer('p_red', 'red');
  const pBlue = createMockPlayer('p_blue', 'blue');

  tm.registerPlayer(pRed);
  tm.registerPlayer(pBlue);

  assert(tm.getAliveTeams().length === 2, '3.1a [1v1]: Initially 2 teams alive');

  // Red dies with bed intact
  pRed.isDead = true;
  assert(tm.isTeamEliminated('red') === false, '3.1b [1v1]: Red not eliminated while bed intact (can respawn)');

  // Red respawns
  pRed.isDead = false;

  // Blue breaks Red bed
  tm.destroyBed('red');
  assert(tm.hasBed('red') === false, '3.1c [1v1]: Red bed broken');
  assert(tm.isTeamEliminated('red') === false, '3.1d [1v1]: Red not eliminated yet while player is alive');

  // Red player final killed
  pRed.isDead = true;
  pRed.isFinalDead = true;
  assert(tm.isTeamEliminated('red') === true, '3.1e [1v1]: Red eliminated after bed broken and player final dead');
  const alive = tm.getAliveTeams();
  assert(alive.length === 1 && alive[0] === 'blue', '3.1f [1v1]: Blue is lone survivor / victor');
}

// 3.2: Format: Solos (4-team Speedway: 1v1v1v1)
{
  const teams = ['red', 'blue', 'green', 'yellow'];
  const tm = new TeamManager(teams);
  const players = {};
  for (const t of teams) {
    const p = createMockPlayer(`p_${t}`, t);
    players[t] = p;
    tm.registerPlayer(p);
  }

  assert(tm.getAliveTeams().length === 4, '3.2a [Solos 4-team]: 4 alive teams initially');

  // Eliminate Green
  tm.destroyBed('green');
  players.green.isDead = true;
  assert(tm.isTeamEliminated('green') === true, '3.2b [Solos 4-team]: Green eliminated');
  assert(tm.getAliveTeams().length === 3, '3.2c [Solos 4-team]: 3 alive teams remaining');

  // Eliminate Yellow
  tm.destroyBed('yellow');
  players.yellow.isDead = true;
  assert(tm.isTeamEliminated('yellow') === true, '3.2d [Solos 4-team]: Yellow eliminated');
  assert(tm.getAliveTeams().length === 2, '3.2e [Solos 4-team]: 2 alive teams remaining');

  // Eliminate Blue
  tm.destroyBed('blue');
  players.blue.isDead = true;
  assert(tm.isTeamEliminated('blue') === true, '3.2f [Solos 4-team]: Blue eliminated');

  // Red wins
  const alive = tm.getAliveTeams();
  assert(alive.length === 1 && alive[0] === 'red', '3.2g [Solos 4-team]: Red wins solos match');
}

// 3.3: Format: Duos (2v2v2v2 - 4 teams of 2 players)
{
  const tm = new TeamManager(['red', 'blue', 'green', 'yellow']);
  const pRed1 = createMockPlayer('p_red_1', 'red');
  const pRed2 = createMockPlayer('p_red_2', 'red');
  tm.registerPlayer(pRed1);
  tm.registerPlayer(pRed2);

  // Red bed is destroyed
  tm.destroyBed('red');

  // Player 1 dies, Player 2 is still alive
  pRed1.isDead = true;
  pRed2.isDead = false;
  assert(
    tm.isTeamEliminated('red') === false,
    '3.3a [Duos]: Team with 1 dead and 1 alive player is NOT eliminated even if bed is broken'
  );

  // Player 2 also dies
  pRed2.isDead = true;
  assert(
    tm.isTeamEliminated('red') === true,
    '3.3b [Duos]: Team is eliminated only when ALL players are dead'
  );
}

// 3.4: Format: Trios (3v3v3v3 - 4 teams of 3 players)
{
  const tm = new TeamManager(['red', 'blue', 'green', 'yellow']);
  const p1 = createMockPlayer('p_green_1', 'green');
  const p2 = createMockPlayer('p_green_2', 'green');
  const p3 = createMockPlayer('p_green_3', 'green');
  tm.registerPlayer(p1);
  tm.registerPlayer(p2);
  tm.registerPlayer(p3);

  tm.destroyBed('green');

  p1.isDead = true;
  p2.isDead = true;
  p3.isDead = false;
  assert(tm.isTeamEliminated('green') === false, '3.4a [Trios]: 2 players dead, 1 player alive -> NOT eliminated');

  p3.isDead = true;
  assert(tm.isTeamEliminated('green') === true, '3.4b [Trios]: All 3 players dead -> Green eliminated');
}

// 3.5: Format: 4v4 Ranked (2 teams of 4 players: Red vs Blue)
{
  const tm = new TeamManager(['red', 'blue']);
  const redPlayers = [];
  const bluePlayers = [];
  for (let i = 1; i <= 4; i++) {
    const pr = createMockPlayer(`red_${i}`, 'red');
    const pb = createMockPlayer(`blue_${i}`, 'blue');
    redPlayers.push(pr);
    bluePlayers.push(pb);
    tm.registerPlayer(pr);
    tm.registerPlayer(pb);
  }

  assert(tm.getTeam('red').players.length === 4, '3.5a [4v4]: Red team has exactly 4 registered players');
  assert(tm.getTeam('blue').players.length === 4, '3.5b [4v4]: Blue team has exactly 4 registered players');

  tm.destroyBed('blue');

  // Knock out blue players 1, 2, 3
  bluePlayers[0].isDead = true;
  bluePlayers[1].isDead = true;
  bluePlayers[2].isDead = true;
  assert(tm.isTeamEliminated('blue') === false, '3.5c [4v4]: 3 of 4 blue players dead -> Blue team still alive');

  // Knock out final blue player 4
  bluePlayers[3].isDead = true;
  assert(tm.isTeamEliminated('blue') === true, '3.5d [4v4]: 4 of 4 blue players dead -> Blue team eliminated');
  assert(tm.getAliveTeams().length === 1 && tm.getAliveTeams()[0] === 'red', '3.5e [4v4]: Red team wins 4v4 match');
}

// 3.6: Format: 8-Team Solos (Octagon 1x8)
{
  const octTeams = ['red', 'blue', 'green', 'yellow', 'aqua', 'white', 'pink', 'gray'];
  const tm = new TeamManager(octTeams);
  for (const t of octTeams) {
    tm.registerPlayer(createMockPlayer(`p_${t}`, t));
  }
  assert(tm.getAliveTeams().length === 8, '3.6a [8-Team Solos]: 8 active teams alive at match start');

  // Break beds and eliminate 7 teams one by one
  for (let i = 1; i < octTeams.length; i++) {
    const t = octTeams[i];
    tm.destroyBed(t);
    tm.getTeam(t).players[0].isDead = true;
    assert(tm.isTeamEliminated(t) === true, `3.6b [8-Team Solos]: Team ${t} eliminated`);
    assert(tm.getAliveTeams().length === 8 - i, `3.6c [8-Team Solos]: Alive teams count correctly decremented to ${8 - i}`);
  }
  assert(tm.getAliveTeams()[0] === 'red', '3.6d [8-Team Solos]: Red is the last surviving team');
}

// 3.7: Adversarial Edge Cases: 0-player teams and invalid team queries
{
  const tm = new TeamManager(['red', 'blue', 'green', 'yellow', 'aqua', 'white', 'pink', 'gray']);

  // Red and Blue have players. Green through Gray have 0 players.
  tm.registerPlayer(createMockPlayer('p_red', 'red'));
  tm.registerPlayer(createMockPlayer('p_blue', 'blue'));

  assert(tm.getTeam('aqua').players.length === 0, '3.7a [0-player team]: Team aqua has 0 players');
  assert(tm.hasBed('aqua') === true, '3.7b [0-player team]: Team aqua bed is intact initially');
  assert(tm.isTeamEliminated('aqua') === false, '3.7c [0-player team]: Team aqua is NOT eliminated while bed stands');

  // Now break aqua's bed (e.g. enemy destroys empty base bed or Sudden Death)
  tm.destroyBed('aqua');
  assert(tm.hasBed('aqua') === false, '3.7d [0-player team]: Team aqua bed destroyed');
  assert(
    tm.isTeamEliminated('aqua') === true,
    '3.7e [0-player team]: Team aqua with 0 players is immediately eliminated once bed is broken'
  );

  // Sudden death destroys all beds
  for (const t of ['green', 'yellow', 'white', 'pink', 'gray']) {
    tm.destroyBed(t);
    assert(tm.isTeamEliminated(t) === true, `3.7f [0-player team]: Team ${t} (0 players) eliminated upon bed destruction`);
  }

  // Only Red and Blue remain alive
  const alive = tm.getAliveTeams();
  assert(alive.length === 2 && alive.includes('red') && alive.includes('blue'), '3.7g: Only populated teams (red, blue) remain alive');

  // Query non-existent team
  assert(tm.isTeamEliminated('purple') === true, '3.7h: Non-existent team query returns true (eliminated)');
  assert(tm.getTeam('nonexistent') === null, '3.7i: Non-existent team lookup returns null');
}

// ============================================================================
// FINAL STRESS TEST SUMMARY
// ============================================================================
console.log('\n======================================================================');
console.log('             CHALLENGER M3 GEN 2 STRESS HARNESS SUMMARY               ');
console.log('======================================================================');
console.log(`  Total Assertions Checked : ${totalAssertions}`);
console.log(`  Passed Assertions        : ${passedAssertions}`);
console.log(`  Failed Assertions        : ${failedAssertions}`);
console.log('======================================================================\n');

if (failedAssertions > 0) {
  console.error(`❌ STRESS TEST FAILED: ${failedAssertions} assertions failed:`);
  for (const f of failures) console.error(f);
  process.exit(1);
} else {
  console.log(`✅ ALL ${totalAssertions} CHALLENGER ADVERSARIAL STRESS ASSERTIONS PASSED WITH 100% SUCCESS!`);
}
