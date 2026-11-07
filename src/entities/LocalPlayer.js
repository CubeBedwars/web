import * as THREE from 'three';
import { Player } from './Player.js';
import { BLOCK_TYPES, BLOCK_PROPS } from '../engine/VoxelWorld.js';

export class LocalPlayer extends Player {
  constructor(id, name, team, camera, canvas) {
    super(id, name, team, true);
    this.camera = camera;
    this.canvas = canvas;

    // First person head bob & swing
    this.walkCycle = 0;
    this.isSwinging = false;
    this.swingProgress = 0;

    // Keys state
    this.keys = {
      forward: false,
      backward: false,
      left: false,
      right: false,
      jump: false,
      sprint: false,
    };

    // Block mining state
    this.isMining = false;
    this.miningProgress = 0;
    this.currentMiningPos = null;

    // Setup input listeners
    this.initControls();
    this.createArmMesh();
  }

  createArmMesh() {
    this.armGroup = new THREE.Group();
    // Voxel sword / arm mesh
    const armGeo = new THREE.BoxGeometry(0.18, 0.5, 0.18);
    const armMat = new THREE.MeshLambertMaterial({ color: 0xef4444 });
    const arm = new THREE.Mesh(armGeo, armMat);
    arm.position.set(0.35, -0.3, -0.6);
    arm.rotation.set(0.4, -0.2, 0.1);
    this.armGroup.add(arm);
    this.camera.add(this.armGroup);
  }

  initControls() {
    // Mouse Pointer Lock
    this.canvas.addEventListener('click', () => {
      if (!document.pointerLockElement) {
        this.canvas.requestPointerLock();
      }
    });

    document.addEventListener('mousemove', (e) => {
      if (document.pointerLockElement === this.canvas) {
        const sens = 0.0022;
        this.yaw -= e.movementX * sens;
        this.pitch -= e.movementY * sens;
        this.pitch = Math.max(-Math.PI / 2 + 0.01, Math.min(Math.PI / 2 - 0.01, this.pitch));
      }
    });

    // Keyboard bindings
    window.addEventListener('keydown', (e) => {
      switch (e.code) {
        case 'KeyW': this.keys.forward = true; break;
        case 'KeyS': this.keys.backward = true; break;
        case 'KeyA': this.keys.left = true; break;
        case 'KeyD': this.keys.right = true; break;
        case 'Space': this.keys.jump = true; break;
        case 'ShiftLeft':
        case 'ShiftRight': this.keys.sprint = true; break;
        // Hotbar selection 1-9
        case 'Digit1': this.selectedSlot = 0; break;
        case 'Digit2': this.selectedSlot = 1; break;
        case 'Digit3': this.selectedSlot = 2; break;
        case 'Digit4': this.selectedSlot = 3; break;
        case 'Digit5': this.selectedSlot = 4; break;
        case 'Digit6': this.selectedSlot = 5; break;
        case 'Digit7': this.selectedSlot = 6; break;
        case 'Digit8': this.selectedSlot = 7; break;
        case 'Digit9': this.selectedSlot = 8; break;
      }
    });

    window.addEventListener('keyup', (e) => {
      switch (e.code) {
        case 'KeyW': this.keys.forward = false; break;
        case 'KeyS': this.keys.backward = false; break;
        case 'KeyA': this.keys.left = false; break;
        case 'KeyD': this.keys.right = false; break;
        case 'Space': this.keys.jump = false; break;
        case 'ShiftLeft':
        case 'ShiftRight': this.keys.sprint = false; break;
      }
    });
  }

  triggerSwing() {
    this.isSwinging = true;
    this.swingProgress = 0;
  }

  update(dt, physics) {
    if (this.isDead) return;

    // 1. Calculate intended movement direction based on camera yaw
    const forward = new THREE.Vector3(-Math.sin(this.yaw), 0, -Math.cos(this.yaw));
    const right = new THREE.Vector3(Math.cos(this.yaw), 0, -Math.sin(this.yaw));

    const moveDir = new THREE.Vector3();
    if (this.keys.forward) moveDir.add(forward);
    if (this.keys.backward) moveDir.sub(forward);
    if (this.keys.right) moveDir.add(right);
    if (this.keys.left) moveDir.sub(right);

    if (moveDir.lengthSq() > 0.001) {
      moveDir.normalize();
      const speed = this.keys.sprint ? 7.2 : 4.8;
      this.velocity.x = moveDir.x * speed;
      this.velocity.z = moveDir.z * speed;
      if (this.onGround) this.walkCycle += dt * (this.keys.sprint ? 14 : 10);
    }

    // 2. Jumping
    if (this.keys.jump && this.onGround) {
      this.velocity.y = 8.5;
      this.onGround = false;
    }

    // 3. Apply physics
    physics.moveEntity(this, dt);

    // 4. Update Camera position & rotation
    const bobOffset = Math.sin(this.walkCycle) * 0.04;
    this.camera.position.set(
      this.position.x,
      this.position.y + 1.62 + (this.onGround ? bobOffset : 0),
      this.position.z
    );

    const euler = new THREE.Euler(this.pitch, this.yaw, 0, 'YXZ');
    this.camera.quaternion.setFromEuler(euler);

    // 5. Weapon swing animation
    if (this.isSwinging) {
      this.swingProgress += dt * 8.0;
      if (this.swingProgress >= Math.PI) {
        this.isSwinging = false;
        this.swingProgress = 0;
        this.armGroup.rotation.set(0, 0, 0);
      } else {
        this.armGroup.rotation.x = Math.sin(this.swingProgress) * 0.8;
        this.armGroup.rotation.y = -Math.sin(this.swingProgress) * 0.4;
      }
    }
  }

  getSelectedItem() {
    return this.hotbar[this.selectedSlot] || null;
  }

  consumeSelectedItem() {
    const item = this.getSelectedItem();
    if (!item) return;
    item.count--;
    if (item.count <= 0) {
      this.hotbar[this.selectedSlot] = null;
    }
  }
}
