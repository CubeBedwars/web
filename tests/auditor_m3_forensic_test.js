/**
 * tests/auditor_m3_forensic_test.js
 * Independent Forensic Audit & Adversarial Stress Suite for Milestone 3 (M3).
 * Authored by teamwork_auditor.
 */

import * as THREE from 'three';
import './mocks/browser-shim.js';
import { BLOCK_TYPES, BLOCK_PROPS, VoxelWorld } from '../src/engine/VoxelWorld.js';
import { MAP_PRESETS } from '../src/game/MapPresets.js';
import { TeamManager, TEAM_PALETTE } from '../src/game/TeamManager.js';
import { Player } from '../src/entities/Player.js';
import { LocalPlayer } from '../src/entities/LocalPlayer.js';
import { Projectile } from '../src/entities/Projectile.js';
import { MutationManager, GUN_GAME_TIERS, MUTATION_DEFINITIONS } from '../src/game/MutationManager.js';
import { Physics } from '../src/engine/Physics.js';
import { GameManager } from '../src/game/GameManager.js';

console.log('\n======================================================================');
console.log('       FORENSIC AUDITOR INDEPENDENT VERIFICATION SUITE: M3            ');
console.log('======================================================================\n');

let checksTotal = 0;
let checksPassed = 0;
let checksFailed = 0;

function reportCheck(name, pass, details = '') {
  checksTotal++;
  if (pass) {
    checksPassed++;
    console.log(`  [PASS] ${name}${details ? ` -> ${details}` : ''}`);
  } else {
    checksFailed++;
    console.error(`  [FAIL] ${name}${details ? ` -> ${details}` : ''}`);
  }
}

// ----------------------------------------------------------------------------
// 1. STATIC INTEGRITY: MapPresets.js Procedural Geometry
// ----------------------------------------------------------------------------
console.log('--- 1. MapPresets Procedural Geometry & Team Layouts ---');
{
  const scene = new THREE.Scene();
  const world = new VoxelWorld(scene);
  world.rebuildMeshes = () => {};

  // Colosseum (1v1)
  MAP_PRESETS.colosseum.generateGeometry(world);
  const redBed = MAP_PRESETS.colosseum.beds.red;
  const blueBed = MAP_PRESETS.colosseum.beds.blue;
  const redHeadBlock = world.getBlock(redBed.head.x, redBed.head.y, redBed.head.z);
  const blueHeadBlock = world.getBlock(blueBed.head.x, blueBed.head.y, blueBed.head.z);
  const colEmeraldBlock = world.getBlock(0, 20, 4);
  const colDiamondBlock = world.getBlock(0, 20, -4);
  reportCheck('Colosseum 1v1 Beds Placed', redHeadBlock === BLOCK_TYPES.BED_HEAD && blueHeadBlock === BLOCK_TYPES.BED_HEAD, `RedBed=${redHeadBlock}, BlueBed=${blueHeadBlock}`);
  reportCheck('Colosseum Center Emerald & Diamond Pillars', colEmeraldBlock === BLOCK_TYPES.EMERALD_BLOCK && colDiamondBlock === BLOCK_TYPES.DIAMOND_BLOCK);

  // Octagon (8 Teams)
  MAP_PRESETS.octagon.generateGeometry(world);
  const octBedsPlaced = MAP_PRESETS.octagon.teams.every(t => {
    const b = MAP_PRESETS.octagon.beds[t];
    return world.getBlock(b.head.x, b.head.y, b.head.z) === BLOCK_TYPES.BED_HEAD;
  });
  reportCheck('Octagon 8-Team Radial Beds Placed in World', octBedsPlaced);

  const octEmeraldCitadel = world.getBlock(-3, 21, 0) === BLOCK_TYPES.EMERALD_BLOCK && world.getBlock(3, 21, 0) === BLOCK_TYPES.EMERALD_BLOCK;
  reportCheck('Octagon Center Emerald Citadel Pillars', octEmeraldCitadel);
}

// ----------------------------------------------------------------------------
// 2. STATIC INTEGRITY: TeamManager Dynamic Scaling & Palette
// ----------------------------------------------------------------------------
console.log('\n--- 2. TeamManager Dynamic Scaling & Palette ---');
{
  const allTeams = ['red', 'blue', 'green', 'yellow', 'aqua', 'white', 'pink', 'gray'];
  const tm8 = new TeamManager(allTeams);
  reportCheck('TeamManager 8 teams initialized', Object.keys(tm8.teams).length === 8);
  reportCheck('TeamManager 8 distinct wool block types assigned', new Set(allTeams.map(t => tm8.teams[t].woolType)).size === 8);

  const tm2 = new TeamManager(['red', 'blue']);
  reportCheck('TeamManager dynamic 2 teams initialized', Object.keys(tm2.teams).length === 2 && tm2.teams.yellow === undefined);
}

// ----------------------------------------------------------------------------
// 3. BEHAVIORAL INTEGRITY: Projectile Ballistics & Explosive AoE
// ----------------------------------------------------------------------------
console.log('\n--- 3. Projectile Ballistics & Explosive Physics ---');
{
  const scene = new THREE.Scene();
  const world = new VoxelWorld(scene);
  world.rebuildMeshes = () => {};
  const physics = new Physics(world);

  // Ballistics integration check: x = x0 + vx*dt, vy = vy0 + g*dt
  const proj = new Projectile({
    scene,
    position: new THREE.Vector3(0, 20, 0),
    velocity: new THREE.Vector3(15, 8, 0),
    gravity: -16,
    damage: 10,
  });
  proj.update(0.25, world);
  reportCheck('Projectile Ballistic Integration (dt=0.25s)', Math.abs(proj.position.x - 3.75) < 1e-4 && Math.abs(proj.velocity.y - 4.0) < 1e-4);

  // Explosive blast resistance test
  world.setBlock(10, 20, 0, BLOCK_TYPES.WOOL_RED);
  world.setBlock(10, 20, 1, BLOCK_TYPES.WOOD);
  world.setBlock(10, 20, 2, BLOCK_TYPES.OBSIDIAN);
  world.setBlock(10, 20, -1, BLOCK_TYPES.BEDROCK);

  const fireball = new Projectile({
    scene,
    position: new THREE.Vector3(10, 20, 0),
    velocity: new THREE.Vector3(0, 0, 0),
    damage: 15,
    explosive: true,
    explosionRadius: 3.0,
    type: 'fireball',
  });
  fireball.triggerExplosion(new THREE.Vector3(10, 20, 0), world, [], physics);

  const woolDestroyed = world.getBlock(10, 20, 0) === BLOCK_TYPES.AIR;
  const woodDestroyed = world.getBlock(10, 20, 1) === BLOCK_TYPES.AIR;
  const obsidianResisted = world.getBlock(10, 20, 2) === BLOCK_TYPES.OBSIDIAN;
  const bedrockResisted = world.getBlock(10, 20, -1) === BLOCK_TYPES.BEDROCK;

  reportCheck('Fireball AoE destroys weak blocks (Wool, Wood)', woolDestroyed && woodDestroyed);
  reportCheck('Obsidian and Bedrock resist explosive blast intact', obsidianResisted && bedrockResisted);
}

// ----------------------------------------------------------------------------
// 4. BEHAVIORAL INTEGRITY: MutationManager Lifecycle & Modifiers
// ----------------------------------------------------------------------------
console.log('\n--- 4. MutationManager All 9 Mutators & Lifecycle Hooks ---');
{
  const mut = new MutationManager();
  const all9 = Object.keys(MUTATION_DEFINITIONS);
  all9.forEach(m => mut.enable(m));

  reportCheck('All 9 named mutators recognized and enabled', mut.getActiveMutations().length === 9);
  reportCheck('Supercharged: initial generator tier is 2', mut.getInitialGeneratorTier() === 2);
  reportCheck('Launch Rush: base launchpads enabled', mut.hasBaseLaunchpads() === true);
  reportCheck('Low Gravity: gravity reduced to -8.0 m/s^2', mut.getGravity() === -8.0);
  reportCheck('Speed Demon: speed multiplier is 1.5x', mut.getSpeedMultiplier() === 1.5);
  reportCheck('Lethal Strike: damage multiplier is 2.0x', mut.getDamageMultiplier() === 2.0);
  reportCheck('Vampirism: 25% damage restoration on attack', mut.applyVampirismDamage(10.0) === 2.5);
  reportCheck('Vampirism: 5 HP restored on kill', mut.applyVampirismKill() === 5.0);
  reportCheck('Sudden Death: triggers at 600 seconds', mut.isSuddenDeathTriggered(600, 600) === true);

  // Gun Game progression
  const ggPlayer = new Player('p_gg', 'PlayerGG', 'red');
  mut.equipGunGameWeapon(ggPlayer, 1);
  reportCheck('Gun Game Tier 1 is Slingshot', ggPlayer.weapon.name === 'Wooden Slingshot');
  mut.onKill(ggPlayer, new Player('v1', 'V1', 'blue'), {});
  reportCheck('Gun Game Tier 2 auto-upgrade on kill is Iron Crossbow', ggPlayer.weapon.name === 'Iron Crossbow');
  mut.onKill(ggPlayer, new Player('v2', 'V2', 'blue'), {});
  reportCheck('Gun Game Tier 3 auto-upgrade is Fireball Launcher', ggPlayer.weapon.name === 'Fireball Launcher');
  mut.onKill(ggPlayer, new Player('v3', 'V3', 'blue'), {});
  reportCheck('Gun Game Tier 4 auto-upgrade is Plasma Blaster', ggPlayer.weapon.name === 'Plasma Blaster');
}

// ----------------------------------------------------------------------------
// 5. ADVERSARIAL INTEGRATION STRESS TEST: GameManager Interaction
// ----------------------------------------------------------------------------
console.log('\n--- 5. Adversarial Integration Test: GameManager handleRightClick ---');
{
  const gm = Object.create(GameManager.prototype);
  gm.studioEditor = { isActive: false };
  gm.mapPreset = { shopkeepers: [] };
  gm.localPlayer = {
    position: new THREE.Vector3(0, 20, 0),
    getSelectedItem: () => ({ type: 'block', blockType: BLOCK_TYPES.WOOL_RED }),
    consumeSelectedItem: () => {},
  };
  gm.hud = { updateHotbar: () => {}, openShop: () => {} };
  gm.players = [];

  let rightClickThrewReferenceError = false;
  let capturedError = null;

  try {
    gm.handleRightClick();
  } catch (err) {
    if (err instanceof ReferenceError && err.message.includes('item')) {
      rightClickThrewReferenceError = true;
      capturedError = err;
    } else {
      throw err;
    }
  }

  if (rightClickThrewReferenceError) {
    console.error('  ⚠️ CONFIRMED ADVERSARIAL REGRESSION: GameManager.handleRightClick threw ReferenceError: item is not defined!');
    console.error(`     Error details: ${capturedError.stack.split('\n')[0]}`);
    console.error(`     Location: ${capturedError.stack.split('\n')[1]}`);
    reportCheck('Adversarial Regression Diagnostic: Missing item declaration in GameManager.handleRightClick', false, 'Throws ReferenceError: item is not defined');
  } else {
    reportCheck('GameManager handleRightClick executes cleanly', true);
  }
}

console.log('\n======================================================================');
console.log(`TOTAL FORENSIC CHECKS : ${checksTotal}`);
console.log(`PASSED CHECKS         : ${checksPassed}`);
console.log(`FAILED / FLAGGED      : ${checksFailed}`);
console.log('======================================================================\n');
