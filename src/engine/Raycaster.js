import * as THREE from 'three';
import { BLOCK_TYPES, BLOCK_PROPERTIES } from './VoxelWorld.js';

export class VoxelRaycaster {
  constructor(scene, world) {
    this.scene = scene;
    this.world = world;

    // Highlight wireframe box for targeted voxel
    const boxGeo = new THREE.BoxGeometry(1.005, 1.005, 1.005);
    const edges = new THREE.EdgesGeometry(boxGeo);
    this.highlightMesh = new THREE.LineSegments(
      edges,
      new THREE.LineBasicMaterial({ color: 0x00f0ff, linewidth: 2 })
    );
    this.highlightMesh.visible = false;
    this.scene.add(this.highlightMesh);

    // Crack stage wireframe box
    this.crackMesh = new THREE.Mesh(
      new THREE.BoxGeometry(1.01, 1.01, 1.01),
      new THREE.MeshBasicMaterial({
        color: 0x000000,
        wireframe: true,
        transparent: true,
        opacity: 0.5,
      })
    );
    this.crackMesh.visible = false;
    this.scene.add(this.crackMesh);

    this.currentHit = null;
    this.breakProgress = 0; // 0.0 to 1.0
    this.breakingBlockPos = null;
  }

  update(camera, maxDistance = 5.5) {
    const origin = camera.position;
    const direction = new THREE.Vector3();
    camera.getWorldDirection(direction);

    this.currentHit = this.world.raycast(origin, direction, maxDistance);

    if (this.currentHit.hit) {
      const { x, y, z } = this.currentHit.blockPos;
      this.highlightMesh.position.set(x + 0.5, y + 0.5, z + 0.5);
      this.highlightMesh.visible = true;

      // Reset breaking if aimed at another block
      if (
        this.breakingBlockPos &&
        (this.breakingBlockPos.x !== x ||
          this.breakingBlockPos.y !== y ||
          this.breakingBlockPos.z !== z)
      ) {
        this.resetBreak();
      }
    } else {
      this.highlightMesh.visible = false;
      this.resetBreak();
    }

    return this.currentHit;
  }

  // Returns true if block was broken
  progressBreak(delta, equippedTool = 'fist') {
    if (!this.currentHit || !this.currentHit.hit) {
      this.resetBreak();
      return false;
    }

    const { x, y, z } = this.currentHit.blockPos;
    const blockType = this.currentHit.blockType;
    const prop = BLOCK_PROPERTIES[blockType];
    if (!prop || blockType === BLOCK_TYPES.BEDROCK) return false;

    this.breakingBlockPos = { x, y, z };

    // Calculate break speed based on tool
    let speed = 1.0;
    if (prop.tool === 'shears' && equippedTool.includes('shears')) speed = 5.0;
    else if (prop.tool === 'pickaxe' && equippedTool.includes('pickaxe')) speed = 4.0;
    else if (prop.tool === 'axe' && equippedTool.includes('axe')) speed = 4.0;
    else if (equippedTool.includes('diamond_pickaxe')) speed = 6.0;

    const breakTime = Math.max(prop.hardness / speed, 0.2);
    this.breakProgress += delta / breakTime;

    // Update crack visualizer
    this.crackMesh.position.set(x + 0.5, y + 0.5, z + 0.5);
    this.crackMesh.visible = true;
    this.crackMesh.material.opacity = Math.min(this.breakProgress * 0.9, 0.95);

    if (this.breakProgress >= 1.0) {
      this.resetBreak();
      return true;
    }

    return false;
  }

  resetBreak() {
    this.breakProgress = 0;
    this.breakingBlockPos = null;
    this.crackMesh.visible = false;
  }
}
