import * as THREE from 'three';
import { Player } from './Player.js';
import { BotBrain } from '../ai/BotBrain.js';

export class BotPlayer extends Player {
  constructor(id, name, team, scene) {
    super(id, name, team, false);
    this.scene = scene;
    this.brain = new BotBrain(this);

    // Build 3D Voxel Character Model
    this.group = new THREE.Group();
    this.createCharacterMesh();
    this.scene.add(this.group);

    this.walkAnimTime = 0;
  }

  createCharacterMesh() {
    const teamColors = {
      red: 0xef4444,
      blue: 0x3b82f6,
      green: 0x22c55e,
      yellow: 0xeab308,
    };
    const teamColor = teamColors[this.team] || 0xffffff;

    // Head
    const headGeo = new THREE.BoxGeometry(0.5, 0.5, 0.5);
    const headMat = new THREE.MeshLambertMaterial({ color: 0xfbcfe8 });
    this.headMesh = new THREE.Mesh(headGeo, headMat);
    this.headMesh.position.y = 1.5;
    this.group.add(this.headMesh);

    // Team Helmet / Cap
    const helmGeo = new THREE.BoxGeometry(0.52, 0.2, 0.52);
    const helmMat = new THREE.MeshLambertMaterial({ color: teamColor });
    const helm = new THREE.Mesh(helmGeo, helmMat);
    helm.position.y = 1.65;
    this.group.add(helm);

    // Body / Torso
    const bodyGeo = new THREE.BoxGeometry(0.5, 0.7, 0.3);
    const bodyMat = new THREE.MeshLambertMaterial({ color: teamColor });
    this.bodyMesh = new THREE.Mesh(bodyGeo, bodyMat);
    this.bodyMesh.position.y = 0.95;
    this.group.add(this.bodyMesh);

    // Left & Right Arms
    const armGeo = new THREE.BoxGeometry(0.2, 0.6, 0.2);
    const armMat = new THREE.MeshLambertMaterial({ color: teamColor });

    this.leftArm = new THREE.Mesh(armGeo, armMat);
    this.leftArm.position.set(-0.38, 0.95, 0);
    this.group.add(this.leftArm);

    this.rightArm = new THREE.Mesh(armGeo, armMat);
    this.rightArm.position.set(0.38, 0.95, 0);
    this.group.add(this.rightArm);

    // Left & Right Legs
    const legGeo = new THREE.BoxGeometry(0.22, 0.65, 0.22);
    const legMat = new THREE.MeshLambertMaterial({ color: 0x1e293b });

    this.leftLeg = new THREE.Mesh(legGeo, legMat);
    this.leftLeg.position.set(-0.14, 0.32, 0);
    this.group.add(this.leftLeg);

    this.rightLeg = new THREE.Mesh(legGeo, legMat);
    this.rightLeg.position.set(0.14, 0.32, 0);
    this.group.add(this.rightLeg);
  }

  update(dt, gameManager) {
    if (this.isDead) {
      this.group.visible = false;
      return;
    }
    this.group.visible = true;

    // AI decision update
    this.brain.update(dt, gameManager);

    // Apply physics
    gameManager.physics.moveEntity(this, dt);

    // Sync 3D mesh position
    this.group.position.copy(this.position);
    this.group.rotation.y = this.yaw;

    // Walking limbs swing animation
    const speed = Math.sqrt(this.velocity.x * this.velocity.x + this.velocity.z * this.velocity.z);
    if (speed > 0.5 && this.onGround) {
      this.walkAnimTime += dt * 10;
      const legAngle = Math.sin(this.walkAnimTime) * 0.6;
      this.leftLeg.rotation.x = legAngle;
      this.rightLeg.rotation.x = -legAngle;
      this.leftArm.rotation.x = -legAngle;
      this.rightArm.rotation.x = legAngle;
    } else {
      this.leftLeg.rotation.x = 0;
      this.rightLeg.rotation.x = 0;
      this.leftArm.rotation.x = 0;
      this.rightArm.rotation.x = 0;
    }
  }

  destroy() {
    this.scene.remove(this.group);
  }
}
