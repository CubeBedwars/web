import * as THREE from 'three';
import { TextureGenerator } from './TextureGenerator.js';

export const BLOCK_TYPES = {
  AIR: 0,
  BEDROCK: 1,
  STONE: 2,
  DIRT: 3,
  GRASS: 4,
  WOOD: 5,
  END_STONE: 6,
  OBSIDIAN: 7,
  GLASS: 8,

  // Wool (Teams & Bridging)
  WOOL_WHITE: 9,
  WOOL_RED: 10,
  WOOL_BLUE: 11,
  WOOL_GREEN: 12,
  WOOL_YELLOW: 13,
  WOOL_AQUA: 14,
  WOOL_PINK: 15,
  WOOL_GRAY: 16,

  // Economy & Special
  LUCKY_BLOCK: 17,
  DIAMOND_BLOCK: 18,
  EMERALD_BLOCK: 19,
  GOLD_BLOCK: 20,
  IRON_BLOCK: 21,
  BED_HEAD: 22,
  BED_FOOT: 23,
  TNT: 24,

  // Ores
  IRON_ORE: 25,
  GOLD_ORE: 26,
  DIAMOND_ORE: 27,
  EMERALD_ORE: 28,
};

export const BLOCK_PROPS = {
  [BLOCK_TYPES.AIR]: { name: 'Air', solid: false, hardness: 0 },
  [BLOCK_TYPES.BEDROCK]: { name: 'Bedrock', solid: true, hardness: 99999, particleColors: [0x334155, 0x1e293b] },
  [BLOCK_TYPES.STONE]: { name: 'Stone', solid: true, hardness: 1.5, tool: 'pickaxe', tex: 'stone', particleColors: [0x64748b, 0x475569, 0x94a3b8] },
  [BLOCK_TYPES.DIRT]: { name: 'Dirt', solid: true, hardness: 0.5, tool: 'shovel', tex: 'dirt', particleColors: [0x78350f, 0x92400e, 0x542308] },
  [BLOCK_TYPES.GRASS]: { name: 'Grass', solid: true, hardness: 0.6, tool: 'shovel', tex: 'grass', particleColors: [0x4ade80, 0x22c55e, 0x78350f] },
  [BLOCK_TYPES.WOOD]: { name: 'Oak Wood', solid: true, hardness: 2.0, tool: 'axe', tex: 'wood', particleColors: [0xb45309, 0x78350f, 0xd97706] },
  [BLOCK_TYPES.END_STONE]: { name: 'End Stone', solid: true, hardness: 3.0, tool: 'pickaxe', tex: 'end_stone', particleColors: [0xfef08a, 0xfde047, 0xca8a04] },
  [BLOCK_TYPES.OBSIDIAN]: { name: 'Obsidian', solid: true, hardness: 12.0, tool: 'diamond_pickaxe', blastProof: true, tex: 'obsidian', particleColors: [0x1e1b4b, 0x312e81, 0x4338ca, 0x0f0e26] },
  [BLOCK_TYPES.GLASS]: { name: 'Blast-Proof Glass', solid: true, hardness: 0.3, transparent: true, blastProof: true, tex: 'glass', particleColors: [0xbae6fd, 0xe0f2fe, 0xffffff] },

  [BLOCK_TYPES.WOOL_WHITE]: { name: 'White Wool', solid: true, hardness: 0.8, tool: 'shears', tex: 'wool_white', particleColors: [0xf8fafc, 0xe2e8f0, 0xcbd5e1] },
  [BLOCK_TYPES.WOOL_RED]: { name: 'Red Wool', solid: true, hardness: 0.8, tool: 'shears', tex: 'wool_red', particleColors: [0xef4444, 0xdc2626, 0xb91c1c] },
  [BLOCK_TYPES.WOOL_BLUE]: { name: 'Blue Wool', solid: true, hardness: 0.8, tool: 'shears', tex: 'wool_blue', particleColors: [0x3b82f6, 0x2563eb, 0x1d4ed8] },
  [BLOCK_TYPES.WOOL_GREEN]: { name: 'Green Wool', solid: true, hardness: 0.8, tool: 'shears', tex: 'wool_green', particleColors: [0x22c55e, 0x16a34a, 0x15803d] },
  [BLOCK_TYPES.WOOL_YELLOW]: { name: 'Yellow Wool', solid: true, hardness: 0.8, tool: 'shears', tex: 'wool_yellow', particleColors: [0xeab308, 0xca8a04, 0xa16207] },
  [BLOCK_TYPES.WOOL_AQUA]: { name: 'Aqua Wool', solid: true, hardness: 0.8, tool: 'shears', tex: 'wool_aqua', particleColors: [0x06b6d4, 0x0891b2, 0x0e7490] },
  [BLOCK_TYPES.WOOL_PINK]: { name: 'Pink Wool', solid: true, hardness: 0.8, tool: 'shears', tex: 'wool_pink', particleColors: [0xec4899, 0xdb2777, 0xbe185d] },
  [BLOCK_TYPES.WOOL_GRAY]: { name: 'Gray Wool', solid: true, hardness: 0.8, tool: 'shears', tex: 'wool_gray', particleColors: [0x64748b, 0x475569, 0x334155] },

  [BLOCK_TYPES.LUCKY_BLOCK]: { name: 'Lucky Block', solid: true, hardness: 0.6, tex: 'lucky_block', lucky: true, particleColors: [0xf59e0b, 0xd97706, 0xffffff] },
  [BLOCK_TYPES.DIAMOND_BLOCK]: { name: 'Diamond Block', solid: true, hardness: 4.0, tool: 'pickaxe', tex: 'diamond_block', particleColors: [0x25d6ec, 0x57f2ff, 0x0b8296] },
  [BLOCK_TYPES.EMERALD_BLOCK]: { name: 'Emerald Block', solid: true, hardness: 4.0, tool: 'pickaxe', tex: 'emerald_block', particleColors: [0x10b981, 0x34d399, 0x065f46] },
  [BLOCK_TYPES.GOLD_BLOCK]: { name: 'Gold Block', solid: true, hardness: 2.5, tool: 'pickaxe', tex: 'gold_block', particleColors: [0xeab308, 0xfacc15, 0xa16207] },
  [BLOCK_TYPES.IRON_BLOCK]: { name: 'Iron Block', solid: true, hardness: 3.5, tool: 'pickaxe', tex: 'iron_block', particleColors: [0xd1d5db, 0xf3f4f6, 0x9ca3af] },
  [BLOCK_TYPES.BED_HEAD]: { name: 'Bed Head', solid: true, hardness: 1.2, isBed: true, tex: 'bed_head', particleColors: [0xef4444, 0xf8fafc, 0x78350f] },
  [BLOCK_TYPES.BED_FOOT]: { name: 'Bed Foot', solid: true, hardness: 1.2, isBed: true, tex: 'bed_foot', particleColors: [0xef4444, 0x78350f] },
  [BLOCK_TYPES.TNT]: { name: 'TNT', solid: true, hardness: 0.1, tex: 'tnt', particleColors: [0xdc2626, 0xffffff, 0x78350f] },

  [BLOCK_TYPES.IRON_ORE]: { name: 'Iron Ore', solid: true, hardness: 3.0, tool: 'pickaxe', tex: 'iron_ore', particleColors: [0x64748b, 0xd4a373, 0xf4ebe2, 0xc0c0c0] },
  [BLOCK_TYPES.GOLD_ORE]: { name: 'Gold Ore', solid: true, hardness: 3.0, tool: 'pickaxe', tex: 'gold_ore', particleColors: [0x64748b, 0xfacc15, 0xeab308, 0xfef08a] },
  [BLOCK_TYPES.DIAMOND_ORE]: { name: 'Diamond Ore', solid: true, hardness: 3.0, tool: 'pickaxe', tex: 'diamond_ore', particleColors: [0x64748b, 0x22d3ee, 0x67e8f9, 0xecfeff] },
  [BLOCK_TYPES.EMERALD_ORE]: { name: 'Emerald Ore', solid: true, hardness: 3.0, tool: 'pickaxe', tex: 'emerald_ore', particleColors: [0x64748b, 0x34d399, 0x10b981, 0xecfdf5] },
};

export class VoxelWorld {
  constructor(scene) {
    this.scene = scene;
    this.blocks = new Map(); // "x,y,z" -> blockId
    this.blockData = new Map(); // "x,y,z" -> { team, metadata }
    this.texGen = new TextureGenerator();

    this.materials = new Map();
    this.initMaterials();

    this.voxelGroup = new THREE.Group();
    this.scene.add(this.voxelGroup);

    this.instancedMeshes = new Map();
    this.dummy = new THREE.Object3D();
    this.isDirty = false;
  }

  initMaterials() {
    for (const [idStr, prop] of Object.entries(BLOCK_PROPS)) {
      const id = parseInt(idStr);
      if (id === BLOCK_TYPES.AIR) continue;

      if (prop.tex === 'grass') {
        const top = this.texGen.getTexture('grass', 'top');
        const side = this.texGen.getTexture('grass', 'side');
        const bottom = this.texGen.getTexture('grass', 'bottom');
        // px, nx, py, ny, pz, nz
        const mats = [
          new THREE.MeshLambertMaterial({ map: side }),
          new THREE.MeshLambertMaterial({ map: side }),
          new THREE.MeshLambertMaterial({ map: top }),
          new THREE.MeshLambertMaterial({ map: bottom }),
          new THREE.MeshLambertMaterial({ map: side }),
          new THREE.MeshLambertMaterial({ map: side }),
        ];
        this.materials.set(id, mats);
      } else if (prop.tex === 'bed_head' || prop.tex === 'bed_foot' || prop.tex === 'tnt') {
        const top = this.texGen.getTexture(prop.tex, 'top');
        const side = this.texGen.getTexture(prop.tex, 'side');
        const bottom = this.texGen.getTexture(prop.tex, 'bottom');
        const mats = [
          new THREE.MeshLambertMaterial({ map: side }),
          new THREE.MeshLambertMaterial({ map: side }),
          new THREE.MeshLambertMaterial({ map: top }),
          new THREE.MeshLambertMaterial({ map: bottom }),
          new THREE.MeshLambertMaterial({ map: side }),
          new THREE.MeshLambertMaterial({ map: side }),
        ];
        this.materials.set(id, mats);
      } else {
        const tex = this.texGen.getTexture(prop.tex || 'stone');
        const mat = new THREE.MeshLambertMaterial({
          map: tex,
          transparent: !!prop.transparent,
          opacity: prop.transparent ? 0.7 : 1.0,
        });
        if (id === BLOCK_TYPES.LUCKY_BLOCK) {
          mat.emissive = new THREE.Color(0x332200);
        } else if (id === BLOCK_TYPES.DIAMOND_BLOCK) {
          mat.emissive = new THREE.Color(0x003344);
        } else if (id === BLOCK_TYPES.EMERALD_BLOCK) {
          mat.emissive = new THREE.Color(0x003311);
        } else if (id === BLOCK_TYPES.DIAMOND_ORE) {
          mat.emissive = new THREE.Color(0x001a24);
        } else if (id === BLOCK_TYPES.EMERALD_ORE) {
          mat.emissive = new THREE.Color(0x001f10);
        }
        this.materials.set(id, mat);
      }
    }
  }

  getKey(x, y, z) {
    return `${Math.floor(x)},${Math.floor(y)},${Math.floor(z)}`;
  }

  getBlock(x, y, z) {
    const key = this.getKey(x, y, z);
    return this.blocks.get(key) || BLOCK_TYPES.AIR;
  }

  getBlockData(x, y, z) {
    const key = this.getKey(x, y, z);
    return this.blockData.get(key) || null;
  }

  isSolid(x, y, z) {
    const type = this.getBlock(x, y, z);
    const prop = BLOCK_PROPS[type];
    return prop ? prop.solid : false;
  }

  setBlock(x, y, z, type, data = null) {
    const key = this.getKey(x, y, z);
    if (type === BLOCK_TYPES.AIR) {
      this.blocks.delete(key);
      this.blockData.delete(key);
    } else {
      this.blocks.set(key, type);
      if (data) this.blockData.set(key, data);
    }
    this.isDirty = true;
  }

  clear() {
    this.blocks.clear();
    this.blockData.clear();
    this.rebuildMeshes();
  }

  isExposed(x, y, z) {
    // Check 6 cardinal neighbors
    return (
      !this.isSolid(x + 1, y, z) ||
      !this.isSolid(x - 1, y, z) ||
      !this.isSolid(x, y + 1, z) ||
      !this.isSolid(x, y - 1, z) ||
      !this.isSolid(x, y, z + 1) ||
      !this.isSolid(x, y, z - 1)
    );
  }

  rebuildMeshes() {
    // Remove old meshes from scene
    for (const mesh of this.instancedMeshes.values()) {
      this.voxelGroup.remove(mesh);
      // Clean up the instance geometry safely without breaking other objects
      mesh.geometry.dispose();
    }
    this.instancedMeshes.clear();

    // Group blocks by type
    const blocksByType = new Map();
    for (const [key, type] of this.blocks.entries()) {
      if (type === BLOCK_TYPES.AIR) continue;
      if (!blocksByType.has(type)) {
        blocksByType.set(type, []);
      }
      const [x, y, z] = key.split(',').map(Number);
      if (this.isExposed(x, y, z)) {
        blocksByType.get(type).push({ x, y, z });
      }
    }

    // Build new InstancedMesh for each block type with its own dedicated BoxGeometry
    for (const [type, positions] of blocksByType.entries()) {
      const material = this.materials.get(type) || this.materials.get(BLOCK_TYPES.STONE);
      const count = positions.length;
      if (count === 0) continue;

      // Independent geometry per instanced mesh to prevent disposal cross-contamination
      const geo = new THREE.BoxGeometry(1, 1, 1);
      const mesh = new THREE.InstancedMesh(geo, material, count);
      mesh.castShadow = true;
      mesh.receiveShadow = true;

      for (let i = 0; i < count; i++) {
        const { x, y, z } = positions[i];
        this.dummy.position.set(x + 0.5, y + 0.5, z + 0.5);
        this.dummy.rotation.set(0, 0, 0);
        this.dummy.scale.set(1, 1, 1);
        this.dummy.updateMatrix();
        mesh.setMatrixAt(i, this.dummy.matrix);
      }

      mesh.instanceMatrix.needsUpdate = true;
      this.instancedMeshes.set(type, mesh);
      this.voxelGroup.add(mesh);
    }

    this.isDirty = false;
  }

  update() {
    if (this.isDirty) {
      this.rebuildMeshes();
    }
  }

  // Amanatides-Woo Fast Integer Voxel DDA (Digital Differential Analyzer)
  raycast(origin, direction, maxDistance = 6) {
    if (!direction || direction.lengthSq() === 0) return { hit: false };

    const dir = direction.clone().normalize();
    const ox = origin.x;
    const oy = origin.y;
    const oz = origin.z;

    let x = Math.floor(ox);
    let y = Math.floor(oy);
    let z = Math.floor(oz);

    // Initial check: if ray origin is inside a solid/non-air block
    const initialType = this.getBlock(x, y, z);
    if (initialType !== BLOCK_TYPES.AIR) {
      return {
        hit: true,
        point: origin.clone(),
        blockPos: { x, y, z },
        placePos: { x, y: y + 1, z },
        normal: new THREE.Vector3(0, 1, 0),
        type: initialType,
        data: this.getBlockData(x, y, z)
      };
    }

    const stepX = dir.x > 0 ? 1 : (dir.x < 0 ? -1 : 0);
    const stepY = dir.y > 0 ? 1 : (dir.y < 0 ? -1 : 0);
    const stepZ = dir.z > 0 ? 1 : (dir.z < 0 ? -1 : 0);

    const tDeltaX = dir.x !== 0 ? Math.abs(1 / dir.x) : Infinity;
    const tDeltaY = dir.y !== 0 ? Math.abs(1 / dir.y) : Infinity;
    const tDeltaZ = dir.z !== 0 ? Math.abs(1 / dir.z) : Infinity;

    let tMaxX = dir.x > 0 ? (Math.floor(ox) + 1 - ox) * tDeltaX : (dir.x < 0 ? (ox - Math.floor(ox)) * tDeltaX : Infinity);
    let tMaxY = dir.y > 0 ? (Math.floor(oy) + 1 - oy) * tDeltaY : (dir.y < 0 ? (oy - Math.floor(oy)) * tDeltaY : Infinity);
    let tMaxZ = dir.z > 0 ? (Math.floor(oz) + 1 - oz) * tDeltaZ : (dir.z < 0 ? (oz - Math.floor(oz)) * tDeltaZ : Infinity);

    let normalX = 0;
    let normalY = 0;
    let normalZ = 0;
    let currentDist = 0;

    while (currentDist <= maxDistance) {
      if (tMaxX < tMaxY) {
        if (tMaxX < tMaxZ) {
          x += stepX;
          currentDist = tMaxX;
          tMaxX += tDeltaX;
          normalX = -stepX;
          normalY = 0;
          normalZ = 0;
        } else {
          z += stepZ;
          currentDist = tMaxZ;
          tMaxZ += tDeltaZ;
          normalX = 0;
          normalY = 0;
          normalZ = -stepZ;
        }
      } else {
        if (tMaxY < tMaxZ) {
          y += stepY;
          currentDist = tMaxY;
          tMaxY += tDeltaY;
          normalX = 0;
          normalY = -stepY;
          normalZ = 0;
        } else {
          z += stepZ;
          currentDist = tMaxZ;
          tMaxZ += tDeltaZ;
          normalX = 0;
          normalY = 0;
          normalZ = -stepZ;
        }
      }

      if (currentDist > maxDistance) break;

      const type = this.getBlock(x, y, z);
      if (type !== BLOCK_TYPES.AIR) {
        const hitPoint = origin.clone().addScaledVector(dir, currentDist);
        return {
          hit: true,
          point: hitPoint,
          blockPos: { x, y, z },
          placePos: { x: x + normalX, y: y + normalY, z: z + normalZ },
          normal: new THREE.Vector3(normalX, normalY, normalZ),
          type: type,
          data: this.getBlockData(x, y, z)
        };
      }
    }

    return { hit: false };
  }
}
