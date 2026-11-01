import * as THREE from 'three';
import { BLOCK_TYPES, BLOCK_PROPERTIES } from '../engine/VoxelWorld.js';

export class StudioEditor {
  constructor(game) {
    this.game = game;
    this.scene = game.scene;
    this.world = game.world;
    this.camera = game.camera;

    this.active = false;
    this.currentTool = 'place'; // 'place' | 'erase' | 'box' | 'entity'
    this.brushSize = 1; // 1, 3, 5
    this.selectedBlock = BLOCK_TYPES.STONE;
    this.selectedEntity = null; // 'bed_red' | 'gen_diamond' etc.

    // Fly-cam flight parameters
    this.flySpeed = 16.0;
    this.flyFast = false;
    this.flyVelocity = new THREE.Vector3();

    // Map metadata for export
    this.mapMetadata = {
      name: 'Custom Studio Arena',
      author: 'Studio Creator',
      teams: ['red', 'blue'],
      generators: [],
      beds: {},
      spawns: {},
      npcs: [],
    };

    // Entity visual preview markers in Studio
    this.markerGroup = new THREE.Group();
    this.scene.add(this.markerGroup);

    this.initUI();
  }

  initUI() {
    // Connect toolbar buttons
    const toolBtns = document.querySelectorAll('.palette-btn');
    toolBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        toolBtns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        this.currentTool = btn.dataset.tool;
        this.selectedEntity = null;
      });
    });

    const sizeBtns = document.querySelectorAll('.size-btn');
    sizeBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        sizeBtns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        this.brushSize = parseInt(btn.dataset.size);
      });
    });

    // Populate Block Picker
    const picker = document.getElementById('studio-block-picker');
    if (picker) {
      picker.innerHTML = '';
      const sampleBlocks = [
        BLOCK_TYPES.STONE,
        BLOCK_TYPES.WOOD,
        BLOCK_TYPES.END_STONE,
        BLOCK_TYPES.OBSIDIAN,
        BLOCK_TYPES.GLASS,
        BLOCK_TYPES.WOOL_RED,
        BLOCK_TYPES.WOOL_BLUE,
        BLOCK_TYPES.WOOL_GREEN,
        BLOCK_TYPES.WOOL_YELLOW,
        BLOCK_TYPES.LUCKY_BLOCK,
        BLOCK_TYPES.TRAMPOLINE,
      ];

      sampleBlocks.forEach(type => {
        const prop = BLOCK_PROPERTIES[type];
        const swatch = document.createElement('div');
        swatch.className = 'block-swatch' + (type === this.selectedBlock ? ' active' : '');
        swatch.style.backgroundColor = '#' + (prop.color || 0xcccccc).toString(16).padStart(6, '0');
        swatch.title = prop.name;

        swatch.addEventListener('click', () => {
          document.querySelectorAll('.block-swatch').forEach(s => s.classList.remove('active'));
          swatch.classList.add('active');
          this.selectedBlock = type;
          this.currentTool = 'place';
          this.selectedEntity = null;
        });

        picker.appendChild(swatch);
      });
    }

    // Entity placer buttons
    const entityBtns = document.querySelectorAll('.entity-btn');
    entityBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        this.currentTool = 'entity';
        this.selectedEntity = btn.dataset.entity;
      });
    });

    // Actions
    document.getElementById('btn-studio-test')?.addEventListener('click', () => {
      this.testPlayMap();
    });

    document.getElementById('btn-studio-export')?.addEventListener('click', () => {
      this.exportMapJSON();
    });

    document.getElementById('btn-studio-import')?.addEventListener('click', () => {
      document.getElementById('studio-file-input')?.click();
    });

    document.getElementById('studio-file-input')?.addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (file) this.importMapJSON(file);
    });

    document.getElementById('btn-studio-clear')?.addEventListener('click', () => {
      if (confirm('Clear the entire world and reset?')) {
        this.world.clear();
        this.markerGroup.clear();
      }
    });

    document.getElementById('btn-studio-exit')?.addEventListener('click', () => {
      this.close();
      this.game.openMainMenu();
    });
  }

  open() {
    this.active = true;
    document.getElementById('studio-toolbar')?.classList.remove('hidden');
    document.getElementById('crosshair')?.classList.remove('hidden');
    document.getElementById('hud')?.classList.add('hidden');
    document.getElementById('main-menu')?.classList.add('hidden');

    this.camera.position.set(0, 30, 35);
    this.camera.lookAt(0, 15, 0);
  }

  close() {
    this.active = false;
    document.getElementById('studio-toolbar')?.classList.add('hidden');
  }

  handleMouseClick(isRightClick) {
    if (!this.active) return;
    const hit = this.game.raycaster.currentHit;
    if (!hit || !hit.hit) return;

    if (this.currentTool === 'entity') {
      this.placeEntityMarker(hit.blockPos, this.selectedEntity);
      return;
    }

    if (isRightClick) {
      // Place block / box
      if (hit.placePos) {
        this.applyBrush(hit.placePos, this.selectedBlock);
      }
    } else {
      // Erase block / box
      this.applyBrush(hit.blockPos, BLOCK_TYPES.AIR);
    }
  }

  applyBrush(center, blockType) {
    const half = Math.floor(this.brushSize / 2);
    for (let dx = -half; dx <= half; dx++) {
      for (let dy = -half; dy <= half; dy++) {
        for (let dz = -half; dz <= half; dz++) {
          this.world.setBlock(center.x + dx, center.y + dy, center.z + dz, blockType);
        }
      }
    }
    if (this.game.sound) {
      if (blockType === BLOCK_TYPES.AIR) this.game.sound.playBlockBreak();
      else this.game.sound.playBlockPlace();
    }
  }

  placeEntityMarker(pos, entityType) {
    // Create visual marker
    const geo = new THREE.CylinderGeometry(0.3, 0.3, 0.8, 8);
    let color = 0xffffff;
    if (entityType.includes('red')) color = 0xff3b30;
    else if (entityType.includes('blue')) color = 0x007aff;
    else if (entityType.includes('diamond')) color = 0x00f0ff;
    else if (entityType.includes('emerald')) color = 0x00f59b;
    else if (entityType.includes('shop')) color = 0xffd700;

    const marker = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color, wireframe: true }));
    marker.position.set(pos.x + 0.5, pos.y + 1.4, pos.z + 0.5);
    this.markerGroup.add(marker);

    // Save into metadata
    if (entityType === 'bed_red') this.mapMetadata.beds['red'] = { ...pos };
    else if (entityType === 'bed_blue') this.mapMetadata.beds['blue'] = { ...pos };
    else if (entityType === 'gen_diamond') this.mapMetadata.generators.push({ type: 'diamond', ...pos });
    else if (entityType === 'gen_emerald') this.mapMetadata.generators.push({ type: 'emerald', ...pos });
    else if (entityType === 'gen_forge') this.mapMetadata.generators.push({ type: 'forge', teamId: 'red', ...pos });

    if (this.game.sound) this.game.sound.playBlockPlace();
  }

  update(delta) {
    if (!this.active) return;

    // Fly-cam movement
    const speed = this.flyFast ? this.flySpeed * 2.5 : this.flySpeed;
    const forward = new THREE.Vector3();
    this.camera.getWorldDirection(forward);

    const right = new THREE.Vector3().crossVectors(forward, new THREE.Vector3(0, 1, 0)).normalize();
    const up = new THREE.Vector3(0, 1, 0);

    const input = this.game.localPlayer.input;
    const move = new THREE.Vector3();

    if (input.forward) move.add(forward);
    if (input.backward) move.sub(forward);
    if (input.right) move.add(right);
    if (input.left) move.sub(right);
    if (input.jump) move.add(up);
    if (this.game.localPlayer.isSprinting) move.sub(up); // Shift down

    if (move.lengthSq() > 0) {
      move.normalize().multiplyScalar(speed * delta);
      this.camera.position.add(move);
      this.game.localPlayer.position.copy(this.camera.position);
    }
  }

  exportMapJSON() {
    const data = {
      version: '1.0',
      metadata: this.mapMetadata,
      blocks: this.world.serialize(),
    };

    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `bedwars_map_${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  importMapJSON(file) {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const json = JSON.parse(e.target.result);
        if (json.blocks) {
          this.world.deserialize(json.blocks);
        }
        if (json.metadata) {
          this.mapMetadata = json.metadata;
        }
        alert('Map imported successfully!');
      } catch (err) {
        alert('Invalid Map JSON: ' + err.message);
      }
    };
    reader.readAsText(file);
  }

  testPlayMap() {
    this.close();
    this.game.startMatch('solo', true); // test match with bots
  }
}
