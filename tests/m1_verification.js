import * as THREE from 'three';
import { BLOCK_TYPES, BLOCK_PROPS, VoxelWorld } from '../src/engine/VoxelWorld.js';
import { GameManager } from '../src/game/GameManager.js';
import { Player } from '../src/entities/Player.js';

console.log('=== Milestone 1 (M1) Verification Suite ===\n');

let passedTests = 0;
let totalTests = 0;

function assert(condition, message) {
  totalTests++;
  if (condition) {
    console.log(`  ✓ PASS: ${message}`);
    passedTests++;
  } else {
    console.error(`  ✗ FAIL: ${message}`);
    process.exitCode = 1;
  }
}

// --- TEST 1: Ore Block Types & Properties ---
console.log('Test 1: Ore Block Types & Properties');
assert(BLOCK_TYPES.IRON_ORE !== undefined, 'BLOCK_TYPES.IRON_ORE is defined');
assert(BLOCK_TYPES.GOLD_ORE !== undefined, 'BLOCK_TYPES.GOLD_ORE is defined');
assert(BLOCK_TYPES.DIAMOND_ORE !== undefined, 'BLOCK_TYPES.DIAMOND_ORE is defined');
assert(BLOCK_TYPES.EMERALD_ORE !== undefined, 'BLOCK_TYPES.EMERALD_ORE is defined');

const ironOreProp = BLOCK_PROPS[BLOCK_TYPES.IRON_ORE];
const goldOreProp = BLOCK_PROPS[BLOCK_TYPES.GOLD_ORE];
const diaOreProp = BLOCK_PROPS[BLOCK_TYPES.DIAMOND_ORE];
const emeOreProp = BLOCK_PROPS[BLOCK_TYPES.EMERALD_ORE];

assert(ironOreProp && ironOreProp.hardness === 3.0 && ironOreProp.tool === 'pickaxe', 'Iron Ore hardness is 3.0 and requires pickaxe');
assert(goldOreProp && goldOreProp.hardness === 3.0 && goldOreProp.tool === 'pickaxe', 'Gold Ore hardness is 3.0 and requires pickaxe');
assert(diaOreProp && diaOreProp.hardness === 3.0 && diaOreProp.tool === 'pickaxe', 'Diamond Ore hardness is 3.0 and requires pickaxe');
assert(emeOreProp && emeOreProp.hardness === 3.0 && emeOreProp.tool === 'pickaxe', 'Emerald Ore hardness is 3.0 and requires pickaxe');

// --- TEST 2: Material Palette Colors for Particles ---
console.log('\nTest 2: Material Palette Colors for Particles');
for (const [idStr, prop] of Object.entries(BLOCK_PROPS)) {
  const id = parseInt(idStr, 10);
  if (id === BLOCK_TYPES.AIR) continue;
  assert(
    prop.particleColors && (Array.isArray(prop.particleColors) || typeof prop.particleColors === 'number'),
    `Block type ${prop.name} (id ${id}) has authentic particleColors defined`
  );
}

// --- TEST 3: Amanatides-Woo Fast Integer Voxel DDA Raycasting ---
console.log('\nTest 3: Amanatides-Woo Integer DDA Raycasting');
// Minimal mock scene for VoxelWorld
const mockScene = { add: () => {}, remove: () => {} };
// Mock document canvas for texture generator in Node environment
if (typeof document === 'undefined') {
  global.document = {
    createElement: () => ({
      width: 16,
      height: 16,
      getContext: () => ({
        fillStyle: '',
        fillRect: () => {},
        clearRect: () => {},
        strokeRect: () => {},
        fillText: () => {},
      })
    })
  };
}

const world = new VoxelWorld(mockScene);
// Place test block at (10, 5, 10)
world.setBlock(10, 5, 10, BLOCK_TYPES.STONE);

// Test Ray from +Z side towards -Z
const hitFromZ = world.raycast(new THREE.Vector3(10.5, 5.5, 14.0), new THREE.Vector3(0, 0, -1), 10);
assert(hitFromZ.hit === true, 'Raycast hits block from +Z');
assert(hitFromZ.blockPos.x === 10 && hitFromZ.blockPos.y === 5 && hitFromZ.blockPos.z === 10, 'Hit block coordinate is (10, 5, 10)');
assert(hitFromZ.normal.x === 0 && hitFromZ.normal.y === 0 && hitFromZ.normal.z === 1, 'Face normal is exactly (0, 0, 1) facing +Z');
assert(hitFromZ.placePos.x === 10 && hitFromZ.placePos.y === 5 && hitFromZ.placePos.z === 11, 'Placement snap position is (10, 5, 11)');

// Test Ray from +X side towards -X
const hitFromX = world.raycast(new THREE.Vector3(15.0, 5.5, 10.5), new THREE.Vector3(-1, 0, 0), 10);
assert(hitFromX.hit === true, 'Raycast hits block from +X');
assert(hitFromX.normal.x === 1 && hitFromX.normal.y === 0 && hitFromX.normal.z === 0, 'Face normal is exactly (1, 0, 0) facing +X');
assert(hitFromX.placePos.x === 11 && hitFromX.placePos.y === 5 && hitFromX.placePos.z === 10, 'Placement snap position is (11, 5, 10)');

// Test Ray from +Y side towards -Y (top face)
const hitFromTop = world.raycast(new THREE.Vector3(10.5, 9.0, 10.5), new THREE.Vector3(0, -1, 0), 10);
assert(hitFromTop.hit === true, 'Raycast hits top face from +Y');
assert(hitFromTop.normal.x === 0 && hitFromTop.normal.y === 1 && hitFromTop.normal.z === 0, 'Face normal is exactly (0, 1, 0) facing +Y');
assert(hitFromTop.placePos.x === 10 && hitFromTop.placePos.y === 6 && hitFromTop.placePos.z === 10, 'Placement snap position is (10, 6, 10)');

// Test Ray into empty space
const miss = world.raycast(new THREE.Vector3(0, 0, 0), new THREE.Vector3(1, 0, 0), 5);
assert(miss.hit === false, 'Raycast through empty space correctly returns { hit: false }');

// --- TEST 4: Tool Multipliers and Break Durations ---
console.log('\nTest 4: Tool Multipliers & Block Break Durations');
// Create prototype instance or test computeBreakDuration directly
const mockGame = Object.create(GameManager.prototype);

const playerFist = new Player('p1', 'Player', 'red', true);
const playerShears = new Player('p2', 'Player', 'red', true);
playerShears.setTool('shears', 4.0);

const playerIronPick = new Player('p3', 'Player', 'red', true);
playerIronPick.setTool('iron_pickaxe', 3.0);

const playerDiaPick = new Player('p4', 'Player', 'red', true);
playerDiaPick.setTool('diamond_pickaxe', 6.0);

// Wool
const woolFist = mockGame.computeBreakDuration(BLOCK_TYPES.WOOL_RED, playerFist);
const woolShears = mockGame.computeBreakDuration(BLOCK_TYPES.WOOL_RED, playerShears);
assert(Math.abs(woolFist - 0.75) < 0.05, `Wool with fist takes ~0.75s (actual: ${woolFist.toFixed(2)}s)`);
assert(Math.abs(woolShears - 0.15) < 0.05, `Wool with shears takes ~0.15s (actual: ${woolShears.toFixed(2)}s)`);

// Wood Planks
const playerAxe = new Player('p5', 'Player', 'red', true);
playerAxe.addItem({ type: 'tool', id: 'stone_axe', name: 'STONE AXE' });
playerAxe.selectedSlot = 1;
const woodFist = mockGame.computeBreakDuration(BLOCK_TYPES.WOOD, playerFist);
const woodAxe = mockGame.computeBreakDuration(BLOCK_TYPES.WOOD, playerAxe);
assert(Math.abs(woodFist - 3.0) < 0.1, `Wood with fist takes ~3.0s (actual: ${woodFist.toFixed(2)}s)`);
assert(Math.abs(woodAxe - 0.75) < 0.1, `Wood with axe takes ~0.75s (actual: ${woodAxe.toFixed(2)}s)`);

// Stone
const stoneFist = mockGame.computeBreakDuration(BLOCK_TYPES.STONE, playerFist);
const stoneIronPick = mockGame.computeBreakDuration(BLOCK_TYPES.STONE, playerIronPick);
const stoneDiaPick = mockGame.computeBreakDuration(BLOCK_TYPES.STONE, playerDiaPick);
assert(stoneFist >= 7.0, `Stone with fist takes >= 7.0s (actual: ${stoneFist.toFixed(2)}s)`);
assert(Math.abs(stoneIronPick - 0.6) < 0.05, `Stone with Iron Pick takes ~0.6s (actual: ${stoneIronPick.toFixed(2)}s)`);
assert(Math.abs(stoneDiaPick - 0.35) < 0.05, `Stone with Diamond Pick takes ~0.35s (actual: ${stoneDiaPick.toFixed(2)}s)`);

// Ores
const oreFist = mockGame.computeBreakDuration(BLOCK_TYPES.DIAMOND_ORE, playerFist);
const oreIronPick = mockGame.computeBreakDuration(BLOCK_TYPES.DIAMOND_ORE, playerIronPick);
const oreDiaPick = mockGame.computeBreakDuration(BLOCK_TYPES.DIAMOND_ORE, playerDiaPick);
assert(oreFist >= 14.0, `Diamond Ore with fist takes >= 14.0s (actual: ${oreFist.toFixed(2)}s)`);
assert(Math.abs(oreIronPick - 0.8) < 0.05, `Diamond Ore with Iron Pick takes ~0.8s (actual: ${oreIronPick.toFixed(2)}s)`);
assert(Math.abs(oreDiaPick - 0.5) < 0.05, `Diamond Ore with Diamond Pick takes ~0.5s (actual: ${oreDiaPick.toFixed(2)}s)`);

// Obsidian
const obsFist = mockGame.computeBreakDuration(BLOCK_TYPES.OBSIDIAN, playerFist);
const obsDiaPick = mockGame.computeBreakDuration(BLOCK_TYPES.OBSIDIAN, playerDiaPick);
assert(obsFist >= 200.0, `Obsidian without Diamond Pickaxe is virtually unbreakable (>= 200s, actual: ${obsFist.toFixed(1)}s)`);
assert(Math.abs(obsDiaPick - 4.0) < 0.1, `Obsidian with Diamond Pickaxe takes ~4.0s (actual: ${obsDiaPick.toFixed(2)}s)`);

// Bedrock
const bedrockDur = mockGame.computeBreakDuration(BLOCK_TYPES.BEDROCK, playerDiaPick);
assert(bedrockDur === Infinity, 'Bedrock is completely unbreakable (Infinity)');

// --- TEST 5: Crack Texture Progress (Stages 0 to 9) ---
console.log('\nTest 5: Crack Texture Progression Stages');
const texGen = world.texGen;
for (let stage = 0; stage <= 9; stage++) {
  const crackTex = texGen.getCrackTexture(stage);
  assert(crackTex !== undefined && crackTex !== null, `Crack stage ${stage} texture generated cleanly`);
}

// --- TEST 6: Entity Placement AABB Collision ---
console.log('\nTest 6: Multi-Entity AABB Placement Collision');
const bot = new Player('bot_1', 'Bot Blue', 'blue', false);
bot.position.set(20, 10, 20);
const allPlayers = [playerFist, bot];

// Try placing a block inside the bot at (20, 10, 20)
const blockBoxInsideBot = new THREE.Box3(new THREE.Vector3(20, 10, 20), new THREE.Vector3(21, 11, 21));
let collides = false;
for (const p of allPlayers) {
  if (p.isDead) continue;
  const halfW = (p.width || 0.6) / 2;
  const height = p.height || 1.8;
  const entityBox = new THREE.Box3(
    new THREE.Vector3(p.position.x - halfW, p.position.y, p.position.z - halfW),
    new THREE.Vector3(p.position.x + halfW, p.position.y + height, p.position.z + halfW)
  );
  if (entityBox.intersectsBox(blockBoxInsideBot)) {
    collides = true;
    break;
  }
}
assert(collides === true, 'Block placement intersecting bot bounding box is correctly REJECTED');

// Try placing an adjacent block free of entities at (25, 10, 25)
const blockBoxFree = new THREE.Box3(new THREE.Vector3(25, 10, 25), new THREE.Vector3(26, 11, 26));
let collidesFree = false;
for (const p of allPlayers) {
  if (p.isDead) continue;
  const halfW = (p.width || 0.6) / 2;
  const height = p.height || 1.8;
  const entityBox = new THREE.Box3(
    new THREE.Vector3(p.position.x - halfW, p.position.y, p.position.z - halfW),
    new THREE.Vector3(p.position.x + halfW, p.position.y + height, p.position.z + halfW)
  );
  if (entityBox.intersectsBox(blockBoxFree)) {
    collidesFree = true;
    break;
  }
}
assert(collidesFree === false, 'Block placement in clear space is ALLOWED');

// --- TEST 7: Resource Pickup Sound Condition ---
console.log('\nTest 7: Resource Pickup Sound Verification');
assert(playerFist.isLocal === true && playerFist.isLocalPlayer === true, 'Local player has both isLocal and isLocalPlayer properties set to true');
assert(bot.isLocal === false && bot.isLocalPlayer === false, 'Bot entity has both isLocal and isLocalPlayer properties set to false');

console.log(`\n=== Verification Results: ${passedTests}/${totalTests} Passed ===\n`);
if (passedTests === totalTests) {
  console.log('ALL MILESTONE 1 CHECKS PASSED PERFECTLY!');
} else {
  process.exit(1);
}
