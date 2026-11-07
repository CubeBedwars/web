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
};

export const BLOCK_PROPS = {
  [BLOCK_TYPES.AIR]: { name: 'Air', solid: false, hardness: 0 },
  [BLOCK_TYPES.BEDROCK]: { name: 'Bedrock', solid: true, hardness: 99999 },
  [BLOCK_TYPES.STONE]: { name: 'Stone', solid: true, hardness: 1.5, tool: 'pickaxe', tex: 'stone' },
  [BLOCK_TYPES.DIRT]: { name: 'Dirt', solid: true, hardness: 0.5, tool: 'shovel', tex: 'dirt' },
  [BLOCK_TYPES.GRASS]: { name: 'Grass', solid: true, hardness: 0.6, tool: 'shovel', tex: 'grass' },
  [BLOCK_TYPES.WOOD]: { name: 'Oak Wood', solid: true, hardness: 2.0, tool: 'axe', tex: 'wood' },
  [BLOCK_TYPES.END_STONE]: { name: 'End Stone', solid: true, hardness: 3.0, tool: 'pickaxe', tex: 'end_stone' },
  [BLOCK_TYPES.OBSIDIAN]: { name: 'Obsidian', solid: true, hardness: 12.0, tool: 'diamond_pickaxe', blastProof: true, tex: 'obsidian' },
  [BLOCK_TYPES.GLASS]: { name: 'Blast-Proof Glass', solid: true, hardness: 0.3, transparent: true, blastProof: true, tex: 'glass' },

  [BLOCK_TYPES.WOOL_WHITE]: { name: 'White Wool', solid: true, hardness: 0.8, tool: 'shears', tex: 'wool_white' },
  [BLOCK_TYPES.WOOL_RED]: { name: 'Red Wool', solid: true, hardness: 0.8, tool: 'shears', tex: 'wool_red' },
  [BLOCK_TYPES.WOOL_BLUE]: { name: 'Blue Wool', solid: true, hardness: 0.8, tool: 'shears', tex: 'wool_blue' },
  [BLOCK_TYPES.WOOL_GREEN]: { name: 'Green Wool', solid: true, hardness: 0.8, tool: 'shears', tex: 'wool_green' },
  [BLOCK_TYPES.WOOL_YELLOW]: { name: 'Yellow Wool', solid: true, hardness: 0.8, tool: 'shears', tex: 'wool_yellow' },
  [BLOCK_TYPES.WOOL_AQUA]: { name: 'Aqua Wool', solid: true, hardness: 0.8, tool: 'shears', tex: 'wool_aqua' },
  [BLOCK_TYPES.WOOL_PINK]: { name: 'Pink Wool', solid: true, hardness: 0.8, tool: 'shears', tex: 'wool_pink' },
  [BLOCK_TYPES.WOOL_GRAY]: { name: 'Gray Wool', solid: true, hardness: 0.8, tool: 'shears', tex: 'wool_gray' },

  [BLOCK_TYPES.LUCKY_BLOCK]: { name: 'Lucky Block', solid: true, hardness: 0.6, tex: 'lucky_block', lucky: true },
  [BLOCK_TYPES.DIAMOND_BLOCK]: { name: 'Diamond Block', solid: true, hardness: 4.0, tool: 'pickaxe', tex: 'diamond_block' },
  [BLOCK_TYPES.EMERALD_BLOCK]: { name: 'Emerald Block', solid: true, hardness: 4.0, tool: 'pickaxe', tex: 'emerald_block' },
  [BLOCK_TYPES.GOLD_BLOCK]: { name: 'Gold Block', solid: true, hardness: 2.5, tool: 'pickaxe', tex: 'gold_block' },
  [BLOCK_TYPES.IRON_BLOCK]: { name: 'Iron Block', solid: true, hardness: 3.5, tool: 'pickaxe', tex: 'iron_block' },
  [BLOCK_TYPES.BED_HEAD]: { name: 'Bed Head', solid: true, hardness: 1.2, isBed: true, tex: 'bed_head' },
  [BLOCK_TYPES.BED_FOOT]: { name: 'Bed Foot', solid: true, hardness: 1.2, isBed: true, tex: 'bed_foot' },
  [BLOCK_TYPES.TNT]: { name: 'TNT', solid: true, hardness: 0.1, tex: 'tnt' },
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

  // Fast raycast through voxel grid with DDA (Digital Differential Analyzer)
  raycast(origin, direction, maxDistance = 6) {
    let t = 0;
    const step = 0.05;
    const current = new THREE.Vector3();
    let prevX = Math.floor(origin.x);
    let prevY = Math.floor(origin.y);
    let prevZ = Math.floor(origin.z);

    while (t < maxDistance) {
      current.copy(origin).addScaledVector(direction, t);
      const bx = Math.floor(current.x);
      const by = Math.floor(current.y);
      const bz = Math.floor(current.z);

      if (bx !== prevX || by !== prevY || bz !== prevZ) {
        const type = this.getBlock(bx, by, bz);
        if (type !== BLOCK_TYPES.AIR) {
          // Calculate face normal based on previous step
          const normal = new THREE.Vector3(prevX - bx, prevY - by, prevZ - bz);
          // Normalize normal to 1 in primary axis
          if (normal.lengthSq() > 1) {
            if (Math.abs(normal.x) >= Math.abs(normal.y) && Math.abs(normal.x) >= Math.abs(normal.z)) normal.set(Math.sign(normal.x), 0, 0);
            else if (Math.abs(normal.y) >= Math.abs(normal.x) && Math.abs(normal.y) >= Math.abs(normal.z)) normal.set(0, Math.sign(normal.y), 0);
            else normal.set(0, 0, Math.sign(normal.z));
          }

          return {
            hit: true,
            point: current.clone(),
            blockPos: { x: bx, y: by, z: bz },
            placePos: { x: bx + normal.x, y: by + normal.y, z: bz + normal.z },
            normal: normal,
            type: type,
            data: this.getBlockData(bx, by, bz)
          };
        }
        prevX = bx;
        prevY = by;
        prevZ = bz;
      }
      t += step;
    }

    return { hit: false };
  }
}
