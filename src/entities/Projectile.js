import * as THREE from 'three';
import { BLOCK_TYPES } from '../engine/VoxelWorld.js';

export class ProjectileManager {
  constructor(scene, world, physics, sound, particles) {
    this.scene = scene;
    this.world = world;
    this.physics = physics;
    this.sound = sound;
    this.particles = particles;
    this.projectiles = []; // array of active projectiles
  }

  spawnFireball(owner, origin, direction) {
    const mesh = new THREE.Mesh(
      new THREE.SphereGeometry(0.35, 8, 8),
      new THREE.MeshBasicMaterial({ color: 0xff4400 })
    );
    mesh.position.copy(origin);
    this.scene.add(mesh);

    this.projectiles.push({
      type: 'fireball',
      owner,
      mesh,
      velocity: direction.clone().multiplyScalar(22.0),
      gravity: 3.0,
      life: 6.0,
      radius: 3.5,
    });

    if (this.sound) this.sound.playSwordSwing();
  }

  spawnPearl(owner, origin, direction) {
    const mesh = new THREE.Mesh(
      new THREE.SphereGeometry(0.2, 8, 8),
      new THREE.MeshBasicMaterial({ color: 0x00f0ff })
    );
    mesh.position.copy(origin);
    this.scene.add(mesh);

    this.projectiles.push({
      type: 'pearl',
      owner,
      mesh,
      velocity: direction.clone().multiplyScalar(20.0),
      gravity: 16.0,
      life: 5.0,
    });
  }

  spawnBridgeEgg(owner, origin, direction, woolBlockType = BLOCK_TYPES.WOOL_RED) {
    const mesh = new THREE.Mesh(
      new THREE.SphereGeometry(0.22, 8, 8),
      new THREE.MeshBasicMaterial({ color: 0xffffff })
    );
    mesh.position.copy(origin);
    this.scene.add(mesh);

    this.projectiles.push({
      type: 'bridge_egg',
      owner,
      woolBlockType,
      mesh,
      velocity: direction.clone().multiplyScalar(15.0),
      gravity: 6.0,
      life: 4.0,
      trailTimer: 0,
    });
  }

  spawnTNT(pos, owner = null) {
    const mesh = new THREE.Mesh(
      new THREE.BoxGeometry(0.98, 0.98, 0.98),
      new THREE.MeshLambertMaterial({ color: 0xff2222 })
    );
    mesh.position.set(pos.x + 0.5, pos.y + 0.5, pos.z + 0.5);
    this.scene.add(mesh);

    this.projectiles.push({
      type: 'tnt',
      owner,
      mesh,
      fuse: 2.5,
      flashTimer: 0,
    });
  }

  update(delta, entities = []) {
    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      const p = this.projectiles[i];

      // TNT FUSE HANDLING
      if (p.type === 'tnt') {
        p.fuse -= delta;
        p.flashTimer += delta * 8;
        // Flashing white/red
        const isWhite = Math.sin(p.flashTimer) > 0;
        p.mesh.material.color.setHex(isWhite ? 0xffffff : 0xff2222);

        if (p.fuse <= 0) {
          const center = p.mesh.position.clone();
          this.scene.remove(p.mesh);
          this.projectiles.splice(i, 1);

          this.physics.applyExplosion(center, 4.5, 20.0, entities);
          if (this.sound) this.sound.playExplosion();
          this.particles.spawnExplosion(center, 40);
          continue;
        }
        continue;
      }

      // FLYING PROJECTILES
      p.life -= delta;
      if (p.life <= 0) {
        this.scene.remove(p.mesh);
        this.projectiles.splice(i, 1);
        continue;
      }

      p.velocity.y -= p.gravity * delta;
      const step = p.velocity.clone().multiplyScalar(delta);
      const nextPos = p.mesh.position.clone().add(step);

      // Check collision with voxel blocks
      const hit = this.world.raycast(p.mesh.position, step.clone().normalize(), step.length());

      // Bridge egg lays blocks along its path
      if (p.type === 'bridge_egg') {
        p.trailTimer += delta;
        if (p.trailTimer >= 0.05) {
          p.trailTimer = 0;
          const bx = Math.floor(p.mesh.position.x);
          const by = Math.floor(p.mesh.position.y - 1.0);
          const bz = Math.floor(p.mesh.position.z);
          if (this.world.getBlock(bx, by, bz) === BLOCK_TYPES.AIR) {
            this.world.setBlock(bx, by, bz, p.woolBlockType);
          }
        }
      }

      if (hit.hit || p.mesh.position.y < -15) {
        // Impact!
        const impactPos = hit.point || nextPos;

        if (p.type === 'fireball') {
          this.physics.applyExplosion(impactPos, p.radius, 18.0, entities);
          if (this.sound) this.sound.playExplosion();
          this.particles.spawnExplosion(impactPos, 35);
        } else if (p.type === 'pearl') {
          if (p.owner && p.owner.isAlive) {
            p.owner.position.copy(impactPos).add(new THREE.Vector3(0, 0.5, 0));
            p.owner.takeDamage(4, 'pearl');
            if (this.sound) this.sound.playFootstep();
          }
        }

        this.scene.remove(p.mesh);
        this.projectiles.splice(i, 1);
        continue;
      }

      p.mesh.position.copy(nextPos);
    }
  }

  clear() {
    for (const p of this.projectiles) {
      this.scene.remove(p.mesh);
    }
    this.projectiles = [];
  }
}
