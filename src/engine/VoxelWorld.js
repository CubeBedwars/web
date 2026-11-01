// Voxel block types and definitions
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
  
  // Wool colors (teams & building)
  WOOL_WHITE: 9,
  WOOL_RED: 10,
  WOOL_BLUE: 11,
  WOOL_GREEN: 12,
  WOOL_YELLOW: 13,
  WOOL_AQUA: 14,
  WOOL_PINK: 15,
  WOOL_GRAY: 16,

  // Special blocks
  LUCKY_BLOCK: 17,
  DIAMOND_BLOCK: 18,
  EMERALD_BLOCK: 19,
  GOLD_BLOCK: 20,
  IRON_BLOCK: 21,
  BED_HEAD: 22,
  BED_FOOT: 23,
  TRAMPOLINE: 24,
  TNT_BLOCK: 25,
  LAVA: 26,
};

export const BLOCK_PROPERTIES = {
  [BLOCK_TYPES.AIR]: { name: 'Air', solid: false, hardness: 0 },
  [BLOCK_TYPES.BEDROCK]: { name: 'Bedrock', solid: true, hardness: 99999, color: 0x333333 },
  [BLOCK_TYPES.STONE]: { name: 'Stone', solid: true, hardness: 1.5, tool: 'pickaxe', color: 0x888888 },
  [BLOCK_TYPES.DIRT]: { name: 'Dirt', solid: true, hardness: 0.5, tool: 'shovel', color: 0x866043 },
  [BLOCK_TYPES.GRASS]: { name: 'Grass', solid: true, hardness: 0.6, tool: 'shovel', color: 0x4caf50 },
  [BLOCK_TYPES.WOOD]: { name: 'Oak Wood', solid: true, hardness: 2.0, tool: 'axe', color: 0xa06d40 },
  [BLOCK_TYPES.END_STONE]: { name: 'End Stone', solid: true, hardness: 3.0, tool: 'pickaxe', color: 0xe6e6aa },
  [BLOCK_TYPES.OBSIDIAN]: { name: 'Obsidian', solid: true, hardness: 10.0, tool: 'diamond_pickaxe', blastProof: true, color: 0x1a1128 },
  [BLOCK_TYPES.GLASS]: { name: 'Blast Glass', solid: true, hardness: 0.3, transparent: true, blastProof: true, color: 0xcfe8ff },
  
  [BLOCK_TYPES.WOOL_WHITE]: { name: 'White Wool', solid: true, hardness: 0.8, tool: 'shears', color: 0xeeeeee },
  [BLOCK_TYPES.WOOL_RED]: { name: 'Red Wool', solid: true, hardness: 0.8, tool: 'shears', color: 0xff3b30 },
  [BLOCK_TYPES.WOOL_BLUE]: { name: 'Blue Wool', solid: true, hardness: 0.8, tool: 'shears', color: 0x007aff },
  [BLOCK_TYPES.WOOL_GREEN]: { name: 'Green Wool', solid: true, hardness: 0.8, tool: 'shears', color: 0x34c759 },
  [BLOCK_TYPES.WOOL_YELLOW]: { name: 'Yellow Wool', solid: true, hardness: 0.8, tool: 'shears', color: 0xffcc00 },
  [BLOCK_TYPES.WOOL_AQUA]: { name: 'Aqua Wool', solid: true, hardness: 0.8, tool: 'shears', color: 0x5ac8fa },
  [BLOCK_TYPES.WOOL_PINK]: { name: 'Pink Wool', solid: true, hardness: 0.8, tool: 'shears', color: 0xff2d55 },
  [BLOCK_TYPES.WOOL_GRAY]: { name: 'Gray Wool', solid: true, hardness: 0.8, tool: 'shears', color: 0x8e8e93 },

  [BLOCK_TYPES.LUCKY_BLOCK]: { name: 'Lucky Block', solid: true, hardness: 0.5, lucky: true, color: 0xffaa00 },
  [BLOCK_TYPES.DIAMOND_BLOCK]: { name: 'Diamond Block', solid: true, hardness: 4.0, tool: 'pickaxe', color: 0x48e7ff },
  [BLOCK_TYPES.EMERALD_BLOCK]: { name: 'Emerald Block', solid: true, hardness: 4.0, tool: 'pickaxe', color: 0x00f59b },
  [BLOCK_TYPES.GOLD_BLOCK]: { name: 'Gold Block', solid: true, hardness: 2.5, tool: 'pickaxe', color: 0xffd700 },
  [BLOCK_TYPES.IRON_BLOCK]: { name: 'Iron Block', solid: true, hardness: 3.5, tool: 'pickaxe', color: 0xdddddd },
  [BLOCK_TYPES.BED_HEAD]: { name: 'Bed', solid: true, hardness: 1.2, isBed: true, color: 0xff2222 },
  [BLOCK_TYPES.BED_FOOT]: { name: 'Bed Foot', solid: true, hardness: 1.2, isBed: true, color: 0xffffff },
  [BLOCK_TYPES.TRAMPOLINE]: { name: 'Trampoline Block', solid: true, hardness: 0.5, bounciness: 1.8, color: 0xff00d4 },
  [BLOCK_TYPES.TNT_BLOCK]: { name: 'TNT', solid: true, hardness: 0.1, color: 0xff2a2a },
  [BLOCK_TYPES.LAVA]: { name: 'Lava', solid: false, lethal: true, color: 0xff5500 },
};

import * as THREE from 'three';

export class VoxelWorld {
  constructor(scene) {
    this.scene = scene;
    this.blocks = new Map(); // key: "x,y,z" -> blockId
    this.blockData = new Map(); // key: "x,y,z" -> { team, metadata }
    
    // Instanced meshes by block type for blazing 60+ FPS
    this.instancedMeshes = new Map();
    this.maxInstancesPerType = 8000;
    this.boxGeometry = new THREE.BoxGeometry(1, 1, 1);
    
    // Create materials for each block type
    this.materials = new Map();
    this.initMaterials();
    
    // Group container for all voxel chunks
    this.voxelGroup = new THREE.Group();
    this.scene.add(this.voxelGroup);

    this.dummy = new THREE.Object3D();
    this.isDirty = false;
  }

  initMaterials() {
    for (const [idStr, prop] of Object.entries(BLOCK_PROPERTIES)) {
      const id = parseInt(idStr);
      if (id === BLOCK_TYPES.AIR) continue;
      
      const mat = new THREE.MeshLambertMaterial({
        color: prop.color || 0xcccccc,
        transparent: !!prop.transparent,
        opacity: prop.transparent ? 0.6 : 1.0,
        roughness: 0.8,
      });

      if (id === BLOCK_TYPES.LUCKY_BLOCK) {
        mat.emissive = new THREE.Color(0x553300);
      } else if (id === BLOCK_TYPES.DIAMOND_BLOCK) {
        mat.emissive = new THREE.Color(0x004455);
      } else if (id === BLOCK_TYPES.EMERALD_BLOCK) {
        mat.emissive = new THREE.Color(0x004422);
      }

      this.materials.set(id, mat);
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
    const prop = BLOCK_PROPERTIES[type];
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

  rebuildMeshes() {
    // Clear old instanced meshes
    for (const mesh of this.instancedMeshes.values()) {
      this.voxelGroup.remove(mesh);
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
      
      // Simple face culling: only render if at least one neighbor is air or transparent
      if (this.isExposed(x, y, z)) {
        blocksByType.get(type).push({ x, y, z });
      }
    }

    // Build instanced mesh for each type
    for (const [type, positions] of blocksByType.entries()) {
      const material = this.materials.get(type) || this.materials.get(BLOCK_TYPES.STONE);
      const count = positions.length;
      if (count === 0) continue;

      const instancedMesh = new THREE.InstancedMesh(this.boxGeometry, material, count);
      instancedMesh.castShadow = true;
      instancedMesh.receiveShadow = true;

      for (let i = 0; i < count; i++) {
        const { x, y, z } = positions[i];
        this.dummy.position.set(x + 0.5, y + 0.5, z + 0.5);
        this.dummy.rotation.set(0, 0, 0);
        this.dummy.scale.set(1, 1, 1);
        this.dummy.updateMatrix();
        instancedMesh.setMatrixAt(i, this.dummy.matrix);
      }

      instancedMesh.instanceMatrix.needsUpdate = true;
      this.instancedMeshes.set(type, instancedMesh);
      this.voxelGroup.add(instancedMesh);
    }

    this.isDirty = false;
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

  update() {
    if (this.isDirty) {
      this.rebuildMeshes();
    }
  }

  // Raycast against voxel blocks
  raycast(origin, direction, maxDistance = 6) {
    let t = 0.0;
    const step = 0.08;
    const current = new THREE.Vector3();

    let lastAirPos = null;

    while (t < maxDistance) {
      current.copy(origin).addScaledVector(direction, t);
      const bx = Math.floor(current.x);
      const by = Math.floor(current.y);
      const bz = Math.floor(current.z);

      const block = this.getBlock(bx, by, bz);
      if (block !== BLOCK_TYPES.AIR) {
        return {
          hit: true,
          point: current.clone(),
          blockPos: { x: bx, y: by, z: bz },
          placePos: lastAirPos ? { ...lastAirPos } : null,
          blockType: block,
          distance: t,
        };
      }

      lastAirPos = { x: bx, y: by, z: bz };
      t += step;
    }

    return { hit: false };
  }

  // Serialization for map editor and save/load
  serialize() {
    const list = [];
    for (const [key, type] of this.blocks.entries()) {
      const [x, y, z] = key.split(',').map(Number);
      const data = this.blockData.get(key) || null;
      list.push({ x, y, z, t: type, d: data });
    }
    return list;
  }

  deserialize(list) {
    this.clear();
    for (const item of list) {
      const key = this.getKey(item.x, item.y, item.z);
      this.blocks.set(key, item.t);
      if (item.d) this.blockData.set(key, item.d);
    }
    this.rebuildMeshes();
  }
}
