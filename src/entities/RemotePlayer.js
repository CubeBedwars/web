import * as THREE from 'three';
import { Player } from './Player.js';
import { TEAMS } from '../game/TeamManager.js';

export class RemotePlayer extends Player {
  constructor(id, name, teamId, scene) {
    super(id, name, teamId, false);
    this.scene = scene;

    // Interpolation targets for smooth network sync
    this.targetPosition = new THREE.Vector3();
    this.targetYaw = 0;

    // Build 3D voxel character
    this.characterGroup = new THREE.Group();
    this.initCharacterMesh();
    this.scene.add(this.characterGroup);

    // Nametag sprite
    this.nametag = this.createNametagSprite();
    this.characterGroup.add(this.nametag);

    this.walkAnimTimer = 0;
  }

  initCharacterMesh() {
    const teamDef = Object.values(TEAMS).find(t => t.id === this.teamId);
    const teamColor = teamDef ? teamDef.colorNum : 0x00f0ff;

    const skinMat = new THREE.MeshLambertMaterial({ color: 0xdeb887 });
    const clothesMat = new THREE.MeshLambertMaterial({ color: teamColor });
    const pantsMat = new THREE.MeshLambertMaterial({ color: 0x223355 });

    // Head (0.5 x 0.5 x 0.5)
    this.head = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.5, 0.5), skinMat);
    this.head.position.set(0, 1.55, 0);
    this.characterGroup.add(this.head);

    // Torso (0.5 x 0.75 x 0.25)
    this.torso = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.75, 0.25), clothesMat);
    this.torso.position.set(0, 0.95, 0);
    this.characterGroup.add(this.torso);

    // Left Arm
    this.leftArm = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.75, 0.2), clothesMat);
    this.leftArm.position.set(-0.35, 0.95, 0);
    this.characterGroup.add(this.leftArm);

    // Right Arm (weapon hand)
    this.rightArm = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.75, 0.2), clothesMat);
    this.rightArm.position.set(0.35, 0.95, 0);
    this.characterGroup.add(this.rightArm);

    // Left Leg
    this.leftLeg = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.75, 0.22), pantsMat);
    this.leftLeg.position.set(-0.13, 0.38, 0);
    this.characterGroup.add(this.leftLeg);

    // Right Leg
    this.rightLeg = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.75, 0.22), pantsMat);
    this.rightLeg.position.set(0.13, 0.38, 0);
    this.characterGroup.add(this.rightLeg);
  }

  createNametagSprite() {
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 64;
    const ctx = canvas.getContext('2d');

    // Background pill
    ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
    ctx.roundRect(10, 10, 236, 44, 12);
    ctx.fill();

    // Text
    const teamDef = Object.values(TEAMS).find(t => t.id === this.teamId);
    ctx.fillStyle = teamDef ? teamDef.colorHex : '#ffffff';
    ctx.font = 'bold 22px Outfit, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(this.name, 128, 32);

    const texture = new THREE.CanvasTexture(canvas);
    const spriteMat = new THREE.SpriteMaterial({ map: texture, depthTest: false });
    const sprite = new THREE.Sprite(spriteMat);
    sprite.position.set(0, 2.1, 0);
    sprite.scale.set(2.0, 0.5, 1.0);
    return sprite;
  }

  setNetworkState(pos, yaw, isMoving = false) {
    this.targetPosition.copy(pos);
    this.targetYaw = yaw;
    this.isMoving = isMoving;
  }

  update(delta) {
    if (!this.isAlive) {
      this.characterGroup.visible = false;
      return;
    }
    this.characterGroup.visible = true;

    // Smooth position interpolation
    this.position.lerp(this.targetPosition, 0.25);
    this.characterGroup.position.copy(this.position);

    // Yaw rotation
    this.characterGroup.rotation.y = this.targetYaw;

    // Walking animation
    if (this.isMoving) {
      this.walkAnimTimer += delta * 10;
      const swing = Math.sin(this.walkAnimTimer) * 0.6;
      this.leftLeg.rotation.x = swing;
      this.rightLeg.rotation.x = -swing;
      this.leftArm.rotation.x = -swing;
      this.rightArm.rotation.x = swing;
    } else {
      this.leftLeg.rotation.x = 0;
      this.rightLeg.rotation.x = 0;
      this.leftArm.rotation.x = 0;
      this.rightArm.rotation.x = 0;
    }
  }

  dispose() {
    this.scene.remove(this.characterGroup);
  }
}
