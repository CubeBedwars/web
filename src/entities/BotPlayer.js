import * as THREE from 'three';
import { Player } from './Player.js';
import { BotBrain } from '../ai/BotBrain.js';
import { TEAMS } from '../game/TeamManager.js';

export class BotPlayer extends Player {
  constructor(id, name, teamId, game) {
    super(id, name, teamId, false);
    this.game = game;
    this.scene = game.scene;

    // Brain AI
    this.brain = new BotBrain(this, game);

    // AI movement simulated input
    this.input = {
      forward: false,
      backward: false,
      left: false,
      right: false,
      jump: false,
      sprint: false,
    };

    this.yaw = 0;
    this.pitch = 0;

    // 3D Visual Mesh
    this.characterGroup = new THREE.Group();
    this.initVisualMesh();
    this.scene.add(this.characterGroup);

    // Nametag
    this.nametag = this.createNametagSprite();
    this.characterGroup.add(this.nametag);

    this.walkAnimTimer = 0;
    this.isSwinging = false;
    this.swingTimer = 0;
  }

  initVisualMesh() {
    const teamDef = Object.values(TEAMS).find(t => t.id === this.teamId);
    const teamColor = teamDef ? teamDef.colorNum : 0x00f0ff;

    const skinMat = new THREE.MeshLambertMaterial({ color: 0xd2a679 });
    const clothesMat = new THREE.MeshLambertMaterial({ color: teamColor });
    const pantsMat = new THREE.MeshLambertMaterial({ color: 0x1f2a38 });

    // Head
    this.head = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.5, 0.5), skinMat);
    this.head.position.set(0, 1.55, 0);
    this.characterGroup.add(this.head);

    // Torso
    this.torso = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.75, 0.25), clothesMat);
    this.torso.position.set(0, 0.95, 0);
    this.characterGroup.add(this.torso);

    // Left Arm
    this.leftArm = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.75, 0.2), clothesMat);
    this.leftArm.position.set(-0.35, 0.95, 0);
    this.characterGroup.add(this.leftArm);

    // Right Arm (weapon arm)
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

    ctx.fillStyle = 'rgba(0, 0, 0, 0.65)';
    ctx.roundRect(10, 10, 236, 44, 12);
    ctx.fill();

    const teamDef = Object.values(TEAMS).find(t => t.id === this.teamId);
    ctx.fillStyle = teamDef ? teamDef.colorHex : '#ffffff';
    ctx.font = 'bold 20px Outfit, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(`🤖 ${this.name}`, 128, 32);

    const texture = new THREE.CanvasTexture(canvas);
    const spriteMat = new THREE.SpriteMaterial({ map: texture, depthTest: false });
    const sprite = new THREE.Sprite(spriteMat);
    sprite.position.set(0, 2.1, 0);
    sprite.scale.set(2.0, 0.5, 1.0);
    return sprite;
  }

  triggerSwing() {
    this.isSwinging = true;
    this.swingTimer = 0;
  }

  update(delta) {
    if (!this.isAlive) {
      this.characterGroup.visible = false;
      return;
    }
    this.characterGroup.visible = true;

    // Update AI behavior brain
    this.brain.update(delta);

    // Update Physics
    this.game.physics.updateEntity(this, delta, this.input, this.yaw);

    // Update 3D Visual Position
    this.characterGroup.position.copy(this.position);
    this.characterGroup.rotation.y = this.yaw;

    // Swing animation
    if (this.isSwinging) {
      this.swingTimer += delta * 10;
      this.rightArm.rotation.x = Math.sin(this.swingTimer * Math.PI) * 1.2;
      if (this.swingTimer >= 1.0) {
        this.isSwinging = false;
        this.rightArm.rotation.x = 0;
      }
    }

    // Walking animation
    if (this.input.forward && this.onGround) {
      this.walkAnimTimer += delta * 10;
      const swing = Math.sin(this.walkAnimTimer) * 0.6;
      this.leftLeg.rotation.x = swing;
      this.rightLeg.rotation.x = -swing;
      if (!this.isSwinging) this.rightArm.rotation.x = swing;
      this.leftArm.rotation.x = -swing;
    } else {
      this.leftLeg.rotation.x = 0;
      this.rightLeg.rotation.x = 0;
    }
  }

  dispose() {
    this.scene.remove(this.characterGroup);
  }
}
