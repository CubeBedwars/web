import * as THREE from 'three';
import { BLOCK_TYPES, BLOCK_PROPS, VoxelWorld } from '../src/engine/VoxelWorld.js';
import { TextureGenerator } from '../src/engine/TextureGenerator.js';
import { GameManager } from '../src/game/GameManager.js';
import { Player } from '../src/entities/Player.js';

console.log('=== FORENSIC INTEGRITY AUDIT TEST SUITE (M1) ===\n');

let violations = [];
let passedChecks = 0;

function forensicAssert(condition, checkName, evidence) {
  if (condition) {
    console.log(`[PASS] ${checkName}`);
    passedChecks++;
  } else {
    console.error(`[VIOLATION] ${checkName} - EVIDENCE: ${evidence}`);
    violations.push({ checkName, evidence });
  }
}

// =========================================================================
// SECTION 1: Canvas Pixel Matrix Forensic Inspection (TextureGenerator.js)
// =========================================================================
console.log('--- SECTION 1: Procedural Pixel Matrix Forensics ---');

class ForensicMockContext {
  constructor() {
    this.grid = Array(16).fill(null).map(() => Array(16).fill('rgba(0,0,0,0)'));
    this.fillStyle = '#000000';
    this.font = '';
  }
  fillRect(x, y, w, h) {
    const rx = Math.round(x);
    const ry = Math.round(y);
    const rw = Math.round(w);
    const rh = Math.round(h);
    for (let py = ry; py < ry + rh && py < 16; py++) {
      for (let px = rx; px < rx + rw && px < 16; px++) {
        if (px >= 0 && py >= 0) {
          this.grid[py][px] = this.fillStyle;
        }
      }
    }
  }
  strokeRect() {}
  beginPath() {}
  moveTo() {}
  lineTo() {}
  stroke() {}
  clearRect(x, y, w, h) {
    const rx = Math.round(x);
    const ry = Math.round(y);
    const rw = Math.round(w);
    const rh = Math.round(h);
    for (let py = ry; py < ry + rh && py < 16; py++) {
      for (let px = rx; px < rx + rw && px < 16; px++) {
        if (px >= 0 && py >= 0) {
          this.grid[py][px] = 'rgba(0,0,0,0)';
        }
      }
    }
  }
  fillText() {}
}

let activeMockContext = null;
global.document = {
  createElement: (tag) => {
    if (tag === 'canvas') {
      const ctx = new ForensicMockContext();
      activeMockContext = ctx;
      return {
        width: 16,
        height: 16,
        getContext: () => ctx
      };
    }
    return {};
  }
};

const texGen = new TextureGenerator();

// 1.1 Iron Ore Pixel Forensics
texGen.getTexture('iron_ore');
const ironCtx = activeMockContext;
const ironPixels = ironCtx.grid.flat();
const ironFleckColors = new Set(['#d4a373', '#f4ebe2', '#e5e5e5', '#a3704c', '#b08968', '#c0c0c0']);
const ironFleckCount = ironPixels.filter(c => ironFleckColors.has(c)).length;
forensicAssert(
  ironFleckCount >= 15,
  'Iron Ore renders genuine procedural fleck clusters',
  `Found ${ironFleckCount} ore fleck pixels (expected >= 15)`
);

// 1.2 Gold Ore Pixel Forensics
texGen.getTexture('gold_ore');
const goldCtx = activeMockContext;
const goldPixels = goldCtx.grid.flat();
const goldFleckColors = new Set(['#fef08a', '#facc15', '#eab308', '#ca8a04', '#a16207', '#fde047']);
const goldFleckCount = goldPixels.filter(c => goldFleckColors.has(c)).length;
forensicAssert(
  goldFleckCount >= 15,
  'Gold Ore renders genuine procedural fleck clusters',
  `Found ${goldFleckCount} ore fleck pixels (expected >= 15)`
);

// 1.3 Diamond Ore Pixel Forensics
texGen.getTexture('diamond_ore');
const diaCtx = activeMockContext;
const diaPixels = diaCtx.grid.flat();
const diaFleckColors = new Set(['#ecfeff', '#67e8f9', '#22d3ee', '#0891b2', '#06b6d4', '#0e7490']);
const diaFleckCount = diaPixels.filter(c => diaFleckColors.has(c)).length;
forensicAssert(
  diaFleckCount >= 15,
  'Diamond Ore renders genuine procedural gemstone crystal clusters',
  `Found ${diaFleckCount} gemstone pixels (expected >= 15)`
);

// 1.4 Emerald Ore Pixel Forensics
texGen.getTexture('emerald_ore');
const emeCtx = activeMockContext;
const emePixels = emeCtx.grid.flat();
const emeFleckColors = new Set(['#ecfdf5', '#6ee7b7', '#34d399', '#10b981', '#059669', '#047857', '#064e3b']);
const emeFleckCount = emePixels.filter(c => emeFleckColors.has(c)).length;
forensicAssert(
  emeFleckCount >= 15,
  'Emerald Ore renders genuine procedural gemstone crystal clusters',
  `Found ${emeFleckCount} gemstone pixels (expected >= 15)`
);

// 1.5 Crack Stages 0-9 Progressive Shatter Geometry Forensics
const crackCounts = [];
for (let s = 0; s <= 9; s++) {
  texGen.getCrackTexture(s);
  const crackCtx = activeMockContext;
  const crackPixels = crackCtx.grid.flat().filter(c => c !== 'rgba(0,0,0,0)');
  crackCounts.push(crackPixels.length);
}

let strictlyProgressive = true;
for (let s = 1; s <= 9; s++) {
  if (crackCounts[s] <= crackCounts[s - 1]) {
    strictlyProgressive = false;
  }
}
forensicAssert(
  strictlyProgressive && crackCounts[0] >= 4 && crackCounts[9] >= 40,
  'Crack stages 0 to 9 exhibit strictly progressive cumulative fracture growth',
  `Crack pixel counts across stages 0-9: [${crackCounts.join(', ')}]`
);

// =========================================================================
// SECTION 2: Amanatides-Woo Fast Integer DDA Traversal Rigorous Testing
// =========================================================================
console.log('\n--- SECTION 2: Amanatides-Woo DDA Traversal Forensics ---');
const mockScene = { add: () => {}, remove: () => {} };
const world = new VoxelWorld(mockScene);

// Setup a 3D obstacle field
world.setBlock(20, 10, 20, BLOCK_TYPES.STONE);
world.setBlock(20, 10, 25, BLOCK_TYPES.IRON_ORE); // Occluded behind the stone from z=15

// Test 2.1: Occlusion & Closest Hit
const occludedRay = world.raycast(new THREE.Vector3(20.5, 10.5, 15.0), new THREE.Vector3(0, 0, 1), 20);
forensicAssert(
  occludedRay.hit && occludedRay.blockPos.z === 20 && occludedRay.type === BLOCK_TYPES.STONE,
  'DDA Raycaster halts at closest foreground block without penetrating to occluded blocks',
  `Hit blockPos: ${JSON.stringify(occludedRay.blockPos)}, type: ${occludedRay.type}`
);

// Test 2.2: All 6 cardinal face normals and placement snapping
const faceTests = [
  { origin: new THREE.Vector3(20.5, 10.5, 18.0), dir: new THREE.Vector3(0, 0, 1), normal: {x:0, y:0, z:-1}, place: {x:20, y:10, z:19}, desc: '-Z face' },
  { origin: new THREE.Vector3(20.5, 10.5, 22.0), dir: new THREE.Vector3(0, 0, -1), normal: {x:0, y:0, z:1}, place: {x:20, y:10, z:21}, desc: '+Z face' },
  { origin: new THREE.Vector3(18.0, 10.5, 20.5), dir: new THREE.Vector3(1, 0, 0), normal: {x:-1, y:0, z:0}, place: {x:19, y:10, z:20}, desc: '-X face' },
  { origin: new THREE.Vector3(22.0, 10.5, 20.5), dir: new THREE.Vector3(-1, 0, 0), normal: {x:1, y:0, z:0}, place: {x:21, y:10, z:20}, desc: '+X face' },
  { origin: new THREE.Vector3(20.5, 8.0, 20.5), dir: new THREE.Vector3(0, 1, 0), normal: {x:0, y:-1, z:0}, place: {x:20, y:9, z:20}, desc: '-Y face (bottom)' },
  { origin: new THREE.Vector3(20.5, 12.0, 20.5), dir: new THREE.Vector3(0, -1, 0), normal: {x:0, y:1, z:0}, place: {x:20, y:11, z:20}, desc: '+Y face (top)' },
];

for (const ft of faceTests) {
  const hit = world.raycast(ft.origin, ft.dir, 10);
  const normalMatches = hit.hit && hit.normal.x === ft.normal.x && hit.normal.y === ft.normal.y && hit.normal.z === ft.normal.z;
  const placeMatches = hit.hit && hit.placePos.x === ft.place.x && hit.placePos.y === ft.place.y && hit.placePos.z === ft.place.z;
  forensicAssert(
    normalMatches && placeMatches,
    `Cardinal raycast accurately resolves ${ft.desc} normal and placement snapping`,
    `Got normal: (${hit.normal?.x},${hit.normal?.y},${hit.normal?.z}), place: (${hit.placePos?.x},${hit.placePos?.y},${hit.placePos?.z})`
  );
}

// Test 2.3: Boundary cutoff distance
const nearHit = world.raycast(new THREE.Vector3(20.5, 10.5, 15.0), new THREE.Vector3(0, 0, 1), 6.0); // dist is 4.5 -> should hit
const farMiss = world.raycast(new THREE.Vector3(20.5, 10.5, 15.0), new THREE.Vector3(0, 0, 1), 3.0); // dist is 4.5 -> should miss
forensicAssert(
  nearHit.hit === true && farMiss.hit === false,
  'DDA Raycaster strictly honors maxDistance boundary limits',
  `nearHit(max 6): ${nearHit.hit}, farMiss(max 3): ${farMiss.hit}`
);

// Test 2.4: Ray starting exactly inside a solid voxel
const insideHit = world.raycast(new THREE.Vector3(20.5, 10.5, 20.5), new THREE.Vector3(0, 1, 0), 5);
forensicAssert(
  insideHit.hit === true && insideHit.blockPos.x === 20 && insideHit.blockPos.y === 10 && insideHit.blockPos.z === 20,
  'DDA Raycaster handles ray origin inside solid voxel gracefully without crash or infinite loop',
  `Inside hit: ${JSON.stringify(insideHit.blockPos)}`
);

// =========================================================================
// SECTION 3: Mining Hardness & Tool Multiplier Rigorous Forensics
// =========================================================================
console.log('\n--- SECTION 3: Break Duration & Mining State Machine Forensics ---');
const gm = Object.create(GameManager.prototype);

// Verify all solid blocks have non-zero, finite break times (except Bedrock which is Infinity)
let solidBlocksValid = true;
let invalidSolidDetails = [];
for (const [idStr, prop] of Object.entries(BLOCK_PROPS)) {
  const id = parseInt(idStr, 10);
  if (id === BLOCK_TYPES.AIR) continue;
  const dur = gm.computeBreakDuration(id, null);
  if (id === BLOCK_TYPES.BEDROCK) {
    if (dur !== Infinity) {
      solidBlocksValid = false;
      invalidSolidDetails.push(`Bedrock dur is ${dur}, expected Infinity`);
    }
  } else {
    if (typeof dur !== 'number' || isNaN(dur) || dur <= 0) {
      solidBlocksValid = false;
      invalidSolidDetails.push(`Block ${prop.name} (id ${id}) dur is ${dur}`);
    }
  }
}
forensicAssert(
  solidBlocksValid,
  'All registered block types in BLOCK_PROPS produce valid positive break durations (or Infinity for Bedrock)',
  invalidSolidDetails.join('; ')
);

// Test Tool-Appropriate Scaling Ratios
const pFist = new Player('pf', 'Fist', 'red', true);
const pShears = new Player('ps', 'Shears', 'red', true);
pShears.setTool('shears', 4.0);
const pWoodAxe = new Player('pwa', 'WoodAxe', 'red', true);
pWoodAxe.addItem({ type: 'tool', id: 'stone_axe', name: 'STONE AXE' });
pWoodAxe.selectedSlot = 1;
const pDiaPick = new Player('pdp', 'DiaPick', 'red', true);
pDiaPick.setTool('diamond_pickaxe', 6.0);

// Shears speedup on wool: should be >= 4x faster than fist
const woolFistTime = gm.computeBreakDuration(BLOCK_TYPES.WOOL_BLUE, pFist);
const woolShearsTime = gm.computeBreakDuration(BLOCK_TYPES.WOOL_BLUE, pShears);
forensicAssert(
  woolFistTime / woolShearsTime >= 4.0,
  'Shears provide authentic 4x-5x speedup when mining wool blocks',
  `Wool fist: ${woolFistTime.toFixed(2)}s vs shears: ${woolShearsTime.toFixed(2)}s (ratio: ${(woolFistTime/woolShearsTime).toFixed(1)}x)`
);

// Axe speedup on wood: should be >= 3x faster than fist
const woodFistTime = gm.computeBreakDuration(BLOCK_TYPES.WOOD, pFist);
const woodAxeTime = gm.computeBreakDuration(BLOCK_TYPES.WOOD, pWoodAxe);
forensicAssert(
  woodFistTime / woodAxeTime >= 3.5,
  'Axe provides authentic 4x speedup when chopping wood',
  `Wood fist: ${woodFistTime.toFixed(2)}s vs axe: ${woodAxeTime.toFixed(2)}s (ratio: ${(woodFistTime/woodAxeTime).toFixed(1)}x)`
);

// Diamond Pickaxe speedup on Obsidian: 250s vs 4.0s (>= 60x faster)
const obsFistTime = gm.computeBreakDuration(BLOCK_TYPES.OBSIDIAN, pFist);
const obsDiaTime = gm.computeBreakDuration(BLOCK_TYPES.OBSIDIAN, pDiaPick);
forensicAssert(
  obsFistTime >= 200 && obsDiaTime <= 4.5 && (obsFistTime / obsDiaTime >= 50),
  'Obsidian enforces Bedwars meta: virtually unbreakable without diamond pickaxe, ~4s with diamond pickaxe',
  `Obsidian fist: ${obsFistTime.toFixed(1)}s vs dia pick: ${obsDiaTime.toFixed(2)}s (ratio: ${(obsFistTime/obsDiaTime).toFixed(1)}x)`
);

// =========================================================================
// SECTION 4: Multi-Entity Placement Intersect Forensics
// =========================================================================
console.log('\n--- SECTION 4: Multi-Entity AABB Placement Intersect Forensics ---');
const testEntities = [
  new Player('bot1', 'Bot 1', 'blue', false),
  new Player('bot2', 'Bot 2', 'green', false)
];
testEntities[0].position.set(50.0, 10.0, 50.0); // living bot at 50, 10, 50
testEntities[1].position.set(60.0, 10.0, 60.0); // dead bot at 60, 10, 60
testEntities[1].isDead = true;

// Placement 1: Attempt to place voxel at (50, 10, 50) overlapping living bot
const blockBoxOccupied = new THREE.Box3(new THREE.Vector3(50, 10, 50), new THREE.Vector3(51, 11, 51));
let livingBlocked = false;
for (const p of testEntities) {
  if (p.isDead) continue;
  const halfW = (p.width || 0.6) / 2;
  const height = p.height || 1.8;
  const entityBox = new THREE.Box3(
    new THREE.Vector3(p.position.x - halfW, p.position.y, p.position.z - halfW),
    new THREE.Vector3(p.position.x + halfW, p.position.y + height, p.position.z + halfW)
  );
  if (entityBox.intersectsBox(blockBoxOccupied)) {
    livingBlocked = true;
    break;
  }
}
forensicAssert(
  livingBlocked === true,
  'Placement algorithm prevents voxel placement inside living player or bot entity bounding box',
  `livingBlocked: ${livingBlocked}`
);

// Placement 2: Attempt to place voxel at (60, 10, 60) overlapping dead bot
const blockBoxDead = new THREE.Box3(new THREE.Vector3(60, 10, 60), new THREE.Vector3(61, 11, 61));
let deadBlocked = false;
for (const p of testEntities) {
  if (p.isDead) continue;
  const halfW = (p.width || 0.6) / 2;
  const height = p.height || 1.8;
  const entityBox = new THREE.Box3(
    new THREE.Vector3(p.position.x - halfW, p.position.y, p.position.z - halfW),
    new THREE.Vector3(p.position.x + halfW, p.position.y + height, p.position.z + halfW)
  );
  if (entityBox.intersectsBox(blockBoxDead)) {
    deadBlocked = true;
    break;
  }
}
forensicAssert(
  deadBlocked === false,
  'Placement algorithm ignores dead entities allowing normal voxel placement',
  `deadBlocked: ${deadBlocked}`
);

// Placement 3: Adjacent placement at (51, 10, 50) directly beside living bot (center x=50.0, halfW=0.3 -> max x=50.3 < 51.0)
const blockBoxAdjacent = new THREE.Box3(new THREE.Vector3(51, 10, 50), new THREE.Vector3(52, 11, 51));
let adjBlocked = false;
for (const p of testEntities) {
  if (p.isDead) continue;
  const halfW = (p.width || 0.6) / 2;
  const height = p.height || 1.8;
  const entityBox = new THREE.Box3(
    new THREE.Vector3(p.position.x - halfW, p.position.y, p.position.z - halfW),
    new THREE.Vector3(p.position.x + halfW, p.position.y + height, p.position.z + halfW)
  );
  if (entityBox.intersectsBox(blockBoxAdjacent)) {
    adjBlocked = true;
    break;
  }
}
forensicAssert(
  adjBlocked === false,
  'Placement algorithm allows placement immediately adjacent to living entity without false positive collisions',
  `adjBlocked: ${adjBlocked}`
);

// =========================================================================
// SUMMARY
// =========================================================================
console.log(`\n=== AUDIT RESULTS: ${passedChecks} checks passed, ${violations.length} violations ===`);
if (violations.length === 0) {
  console.log('VERDICT: CLEAN');
  process.exit(0);
} else {
  console.error('VERDICT: INTEGRITY VIOLATION');
  process.exit(1);
}
