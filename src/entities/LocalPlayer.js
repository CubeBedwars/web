import * as THREE from 'three';
import { Player } from './Player.js';
import { BLOCK_TYPES, BLOCK_PROPERTIES } from '../engine/VoxelWorld.js';

export class LocalPlayer extends Player {
  constructor(id, name, teamId, camera, domElement) {
    super(id, name, teamId, true);
    this.camera = camera;
    this.domElement = domElement;

    // Camera angles
    this.pitch = 0;
    this.yaw = 0;
    this.mouseSensitivity = 0.0022;

    // Movement state
    this.input = {
      forward: false,
      backward: false,
      left: false,
      right: false,
      jump: false,
      sprint: false,
    };

    // First person arm / held item mesh
    this.heldItemGroup = new THREE.Group();
    this.initHeldItem();
    this.camera.add(this.heldItemGroup);

    // Swing animation
    this.swingProgress = 0;
    this.isSwinging = false;

    // Walk bobbing
    this.bobTimer = 0;

    // Bind event listeners
    this.initControls();
  }

  initHeldItem() {
    this.heldItemMesh = new THREE.Mesh(
      new THREE.BoxGeometry(0.14, 0.45, 0.14),
      new THREE.MeshLambertMaterial({ color: 0xa06d40 }) // wooden sword default
    );
    this.heldItemMesh.position.set(0.35, -0.32, -0.55);
    this.heldItemMesh.rotation.set(0.2, -0.3, 0.4);
    this.heldItemGroup.add(this.heldItemMesh);
  }

  updateHeldItemVisual() {
    const item = this.getActiveItem();
    if (!item) {
      this.heldItemMesh.visible = false;
      return;
    }
    this.heldItemMesh.visible = true;

    if (item.itemType === 'block') {
      this.heldItemMesh.geometry.dispose();
      this.heldItemMesh.geometry = new THREE.BoxGeometry(0.25, 0.25, 0.25);
      const prop = BLOCK_PROPERTIES[item.blockType];
      this.heldItemMesh.material.color.setHex(prop ? prop.color : 0xffffff);
    } else {
      this.heldItemMesh.geometry.dispose();
      this.heldItemMesh.geometry = new THREE.BoxGeometry(0.12, 0.5, 0.12);
      if (item.id.includes('diamond')) {
        this.heldItemMesh.material.color.setHex(0x00f0ff);
      } else if (item.id.includes('iron')) {
        this.heldItemMesh.material.color.setHex(0xdddddd);
      } else if (item.id.includes('stone')) {
        this.heldItemMesh.material.color.setHex(0x888888);
      } else {
        this.heldItemMesh.material.color.setHex(0xa06d40);
      }
    }
  }

  initControls() {
    // Pointer Lock
    this.domElement.addEventListener('click', () => {
      if (document.pointerLockElement !== this.domElement && this.isAlive) {
        this.domElement.requestPointerLock();
      }
    });

    document.addEventListener('mousemove', (e) => {
      if (document.pointerLockElement === this.domElement) {
        this.yaw -= e.movementX * this.mouseSensitivity;
        this.pitch -= e.movementY * this.mouseSensitivity;

        // Clamp pitch to prevent flipping
        const maxPitch = Math.PI / 2 - 0.05;
        this.pitch = Math.max(-maxPitch, Math.min(maxPitch, this.pitch));
      }
    });

    window.addEventListener('keydown', (e) => {
      if (document.activeElement.tagName === 'INPUT') return; // chat/input typing

      switch (e.code) {
        case 'KeyW': this.input.forward = true; break;
        case 'KeyS': this.input.backward = true; break;
        case 'KeyA': this.input.left = true; break;
        case 'KeyD': this.input.right = true; break;
        case 'Space': this.input.jump = true; break;
        case 'ShiftLeft':
        case 'ShiftRight':
          this.isSprinting = true;
          break;
        case 'Digit1': this.setActiveSlot(0); break;
        case 'Digit2': this.setActiveSlot(1); break;
        case 'Digit3': this.setActiveSlot(2); break;
        case 'Digit4': this.setActiveSlot(3); break;
        case 'Digit5': this.setActiveSlot(4); break;
        case 'Digit6': this.setActiveSlot(5); break;
        case 'Digit7': this.setActiveSlot(6); break;
        case 'Digit8': this.setActiveSlot(7); break;
        case 'Digit9': this.setActiveSlot(8); break;
      }
    });

    window.addEventListener('keyup', (e) => {
      switch (e.code) {
        case 'KeyW': this.input.forward = false; break;
        case 'KeyS': this.input.backward = false; break;
        case 'KeyA': this.input.left = false; break;
        case 'KeyD': this.input.right = false; break;
        case 'Space': this.input.jump = false; break;
        case 'ShiftLeft':
        case 'ShiftRight':
          this.isSprinting = false;
          break;
      }
    });

    // Mouse wheel hotbar switching
    window.addEventListener('wheel', (e) => {
      if (document.pointerLockElement === this.domElement) {
        let newSlot = this.activeSlotIndex + (e.deltaY > 0 ? 1 : -1);
        if (newSlot < 0) newSlot = 8;
        if (newSlot > 8) newSlot = 0;
        this.setActiveSlot(newSlot);
      }
    });
  }

  setActiveSlot(index) {
    this.activeSlotIndex = index;
    this.updateHeldItemVisual();
    if (this.onSlotChange) this.onSlotChange(index);
  }

  triggerSwing() {
    this.isSwinging = true;
    this.swingProgress = 0;
  }

  update(delta) {
    if (!this.isAlive) return;

    // Update Camera position (Eye height: 1.62)
    this.camera.position.set(
      this.position.x,
      this.position.y + 1.62,
      this.position.z
    );

    // Apply Camera rotations
    this.camera.rotation.set(0, 0, 0);
    this.camera.rotation.y = this.yaw;
    this.camera.rotation.x = this.pitch;

    // Swing animation
    if (this.isSwinging) {
      this.swingProgress += delta * 12.0;
      const angle = Math.sin(this.swingProgress * Math.PI) * 0.7;
      this.heldItemMesh.rotation.x = 0.2 + angle;
      this.heldItemMesh.position.z = -0.55 + Math.sin(this.swingProgress * Math.PI) * 0.15;

      if (this.swingProgress >= 1.0) {
        this.isSwinging = false;
        this.heldItemMesh.rotation.set(0.2, -0.3, 0.4);
        this.heldItemMesh.position.set(0.35, -0.32, -0.55);
      }
    }

    // Walking bobbing animation
    const isMoving = this.input.forward || this.input.backward || this.input.left || this.input.right;
    if (isMoving && this.onGround) {
      this.bobTimer += delta * (this.isSprinting ? 14 : 9);
      const bobY = Math.sin(this.bobTimer) * 0.04;
      const bobX = Math.cos(this.bobTimer * 0.5) * 0.03;
      this.heldItemGroup.position.set(bobX, bobY, 0);
    } else {
      this.heldItemGroup.position.set(0, 0, 0);
    }
  }
}
