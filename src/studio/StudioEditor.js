import * as THREE from 'three';
import { BLOCK_TYPES, BLOCK_PROPS } from '../engine/VoxelWorld.js';

export class StudioEditor {
  constructor(gameManager) {
    this.gm = gameManager;
    this.isActive = false;

    this.selectedBlock = BLOCK_TYPES.WOOL_RED;
    this.brushMode = 'single'; // single, 3x3, erase
    this.entityToPlace = null; // null or 'spawn_red', 'bed_red', 'forge', 'diamond_gen', 'emerald_gen', 'shop'

    this.flySpeed = 16.0;
    this.customEntities = {
      spawns: {},
      beds: {},
      generators: [],
      shopkeepers: [],
    };
  }

  open() {
    this.isActive = true;
    this.gm.isMatchRunning = false;
    this.gm.localPlayer.isFlying = true;
    this.gm.localPlayer.velocity.set(0, 0, 0);

    // Show studio UI toolbar and hide in-game HUD
    document.getElementById('studio-toolbar')?.classList.remove('hidden');
    document.getElementById('hud')?.classList.add('hidden');
    document.getElementById('main-menu')?.classList.add('hidden');
    document.getElementById('crosshair')?.classList.remove('hidden');
  }

  close() {
    this.isActive = false;
    this.gm.localPlayer.isFlying = false;
    document.getElementById('studio-toolbar')?.classList.add('hidden');
  }

  handlePlacement(raycastResult) {
    if (!this.isActive || !raycastResult.hit) return;

    if (this.brushMode === 'erase') {
      const { x, y, z } = raycastResult.blockPos;
      this.gm.world.setBlock(x, y, z, BLOCK_TYPES.AIR);
      this.gm.world.rebuildMeshes();
      if (this.gm.sound) this.gm.sound.playBlockBreak();
      return;
    }

    if (this.entityToPlace) {
      const { x, y, z } = raycastResult.placePos;
      this.placeEntityMarker(this.entityToPlace, x, y, z);
      return;
    }

    // Voxel placement
    const { x, y, z } = raycastResult.placePos;
    if (this.brushMode === 'single') {
      this.gm.world.setBlock(x, y, z, this.selectedBlock);
    } else if (this.brushMode === '3x3') {
      for (let dx = -1; dx <= 1; dx++) {
        for (let dz = -1; dz <= 1; dz++) {
          this.gm.world.setBlock(x + dx, y, z + dz, this.selectedBlock);
        }
      }
    }
    this.gm.world.rebuildMeshes();
    if (this.gm.sound) this.gm.sound.playBlockPlace();
  }

  placeEntityMarker(type, x, y, z) {
    if (type.startsWith('spawn_')) {
      const team = type.replace('spawn_', '');
      this.customEntities.spawns[team] = { x, y: y + 1, z };
      this.gm.world.setBlock(x, y, z, BLOCK_TYPES.WOOL_WHITE);
    } else if (type.startsWith('bed_')) {
      const team = type.replace('bed_', '');
      this.gm.world.setBlock(x, y, z, BLOCK_TYPES.BED_HEAD, { team, part: 'head' });
      this.gm.world.setBlock(x + 1, y, z, BLOCK_TYPES.BED_FOOT, { team, part: 'foot' });
      this.customEntities.beds[team] = { head: { x, y, z }, foot: { x: x + 1, y, z } };
    } else if (type === 'forge') {
      this.gm.world.setBlock(x, y, z, BLOCK_TYPES.IRON_BLOCK);
      this.customEntities.generators.push({ type: 'forge', pos: { x, y: y + 1, z }, interval: 3 });
    } else if (type === 'diamond_gen') {
      this.gm.world.setBlock(x, y, z, BLOCK_TYPES.DIAMOND_BLOCK);
      this.customEntities.generators.push({ type: 'diamond', pos: { x, y: y + 1, z }, interval: 15 });
    } else if (type === 'emerald_gen') {
      this.gm.world.setBlock(x, y, z, BLOCK_TYPES.EMERALD_BLOCK);
      this.customEntities.generators.push({ type: 'emerald', pos: { x, y: y + 1, z }, interval: 30 });
    }
    this.gm.world.rebuildMeshes();
    if (this.gm.sound) this.gm.sound.playBlockPlace();
  }

  exportMapJSON() {
    const blocksArray = [];
    for (const [key, type] of this.gm.world.blocks.entries()) {
      const [x, y, z] = key.split(',').map(Number);
      const data = this.gm.world.getBlockData(x, y, z);
      blocksArray.push({ x, y, z, type, data });
    }

    const mapData = {
      name: 'Custom Bedwars Arena',
      version: '1.0',
      blocks: blocksArray,
      entities: this.customEntities,
    };

    const blob = new Blob([JSON.stringify(mapData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'custom_bedwars_map.json';
    a.click();
    URL.revokeObjectURL(url);
  }

  importMapJSON(jsonString) {
    try {
      const data = JSON.parse(jsonString);
      this.gm.world.clear();
      for (const b of data.blocks) {
        this.gm.world.setBlock(b.x, b.y, b.z, b.type, b.data);
      }
      this.customEntities = data.entities || this.customEntities;
      this.gm.world.rebuildMeshes();
      alert('Map imported successfully!');
    } catch (err) {
      alert('Invalid Map JSON: ' + err.message);
    }
  }

  testPlay() {
    this.close();
    this.gm.startMatch('solo', true);
  }
}
