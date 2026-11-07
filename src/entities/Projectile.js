import * as THREE from 'three';
import { BLOCK_TYPES, BLOCK_PROPS } from '../engine/VoxelWorld.js';

export class Projectile {
  constructor(options = {}) {
    const {
      scene = null,
      position = new THREE.Vector3(0, 20, 0),
      velocity = new THREE.Vector3(0, 0, 0),
      gravity = -12.0,
      radius = 0.3,
      damage = 10.0,
      explosive = false,
      explosionRadius = 2.5,
      owner = null,
      type = 'fireball', // 'fireball', 'slingshot', 'crossbow', 'plasma'
      maxLifetime = 8.0,
    } = options;

    this.scene = scene;
    this.position = new THREE.Vector3().copy(position);
    this.velocity = new THREE.Vector3().copy(velocity);
    this.gravity = gravity;
    this.radius = radius;
    this.damage = damage;
    this.type = type;
    this.explosive = options.explosive !== undefined ? options.explosive : (type === 'fireball' || type === 'plasma');
    this.explosionRadius = explosionRadius;
    this.owner = owner;
    this.type = type;
    this.maxLifetime = maxLifetime;
    this.lifetime = 0;
    this.isDead = false;
    this.mutationManager = options.mutationManager || null;
    this.gameManager = options.gameManager || null;

    this.mesh = this.createMesh();
    if (this.scene && this.mesh) {
      this.mesh.position.copy(this.position);
      this.scene.add(this.mesh);
    }
  }

  createMesh() {
    let geo;
    let mat;

    switch (this.type) {
      case 'slingshot':
        geo = new THREE.SphereGeometry(this.radius || 0.18, 8, 8);
        mat = new THREE.MeshLambertMaterial({ color: 0x78350f });
        break;
      case 'crossbow':
        geo = new THREE.CylinderGeometry(0.04, 0.04, 0.5, 6);
        geo.rotateX(Math.PI / 2);
        mat = new THREE.MeshLambertMaterial({ color: 0x94a3b8 });
        break;
      case 'plasma':
        geo = new THREE.SphereGeometry(this.radius || 0.35, 12, 12);
        mat = new THREE.MeshBasicMaterial({ color: 0x06b6d4, wireframe: false });
        break;
      case 'fireball':
      default:
        geo = new THREE.SphereGeometry(this.radius || 0.3, 10, 10);
        mat = new THREE.MeshBasicMaterial({ color: 0xf97316 });
        break;
    }

    const mesh = new THREE.Mesh(geo, mat);
    mesh.castShadow = true;
    return mesh;
  }

  update(dt, world, players = [], physics = null, sound = null, particles = null, teamManager = null, mutationManager = null, gameManager = null) {
    if (this.isDead) return null;

    const mm = mutationManager || this.mutationManager || gameManager?.mutationManager || this.owner?.teamManager?.gameManager?.mutationManager || null;
    const gm = gameManager || this.gameManager || this.owner?.teamManager?.gameManager || null;

    this.lifetime += dt;
    if (this.lifetime >= this.maxLifetime) {
      this.destroy();
      return null;
    }

    // 1. Physics integration
    this.velocity.y += this.gravity * dt;
    this.position.addScaledVector(this.velocity, dt);

    if (this.mesh) {
      this.mesh.position.copy(this.position);
    }

    // 2. Collision with Players / Bots
    for (const p of players) {
      if (p === this.owner || p.isDead) continue;
      const pHalfW = (p.width || 0.6) / 2;
      const pHeight = p.height || 1.8;

      // Approximate player bounding cylinder/box check
      const dx = this.position.x - p.position.x;
      const dz = this.position.z - p.position.z;
      const horizDistSq = dx * dx + dz * dz;
      const thresholdRadius = this.radius + pHalfW;

      if (horizDistSq <= thresholdRadius * thresholdRadius) {
        if (this.position.y >= p.position.y && this.position.y <= p.position.y + pHeight) {
          // Direct hit!
          let hitResult;
          if (this.explosive) {
            this.triggerExplosion(this.position, world, players, physics, sound, particles, teamManager, mm, gm);
            hitResult = { type: 'hit_player_explosive', target: p, position: this.position.clone(), damage: this.damage };
          } else {
            let directDmg = this.damage;
            if (mm && typeof mm.onDamage === 'function') {
              directDmg = mm.onDamage(this.owner, p, directDmg, gm);
            }
            p.takeDamage(directDmg, this.owner, physics, teamManager);
            if (sound) sound.playHit?.();
            if (particles) particles.spawnHitSparks?.(p.position);
            hitResult = { type: 'hit_player', target: p, position: this.position.clone(), damage: directDmg };
          }
          this.destroy();
          return hitResult;
        }
      }
    }

    // 3. Collision with Voxel World
    if (world) {
      const bx = Math.floor(this.position.x);
      const by = Math.floor(this.position.y);
      const bz = Math.floor(this.position.z);

      const blockType = typeof world.getBlock === 'function'
        ? world.getBlock(bx, by, bz)
        : (world.get?.(`${bx},${by},${bz}`) ?? BLOCK_TYPES.AIR);

      if (blockType !== BLOCK_TYPES.AIR && blockType !== undefined) {
        const hitPos = { x: bx, y: by, z: bz };
        let hitResult;
        if (this.explosive) {
          this.triggerExplosion(this.position, world, players, physics, sound, particles, teamManager, mm, gm);
          hitResult = { type: 'hit_block_explosive', position: hitPos, damage: this.damage };
        } else {
          if (sound) sound.playBlockHit?.();
          if (particles) particles.spawnBlockBreak?.(hitPos, 0x94a3b8, 6);
          hitResult = { type: 'hit_block', position: hitPos, damage: this.damage };
        }
        this.destroy();
        return hitResult;
      }
    }

    return null;
  }

  triggerExplosion(center, world, players = [], physics = null, sound = null, particles = null, teamManager = null, mutationManager = null, gameManager = null) {
    if (sound) sound.playExplosion?.();
    if (particles) particles.spawnExplosion?.(center);

    const radius = this.explosionRadius;
    const rInt = Math.ceil(radius);
    const cx = Math.floor(center.x);
    const cy = Math.floor(center.y);
    const cz = Math.floor(center.z);

    // 1. Destroy weak blocks in blast volume
    let anyBlocksDestroyed = false;
    if (world && typeof world.getBlock === 'function') {
      for (let dx = -rInt; dx <= rInt; dx++) {
        for (let dy = -rInt; dy <= rInt; dy++) {
          for (let dz = -rInt; dz <= rInt; dz++) {
            const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
            if (dist <= radius) {
              const x = cx + dx;
              const y = cy + dy;
              const z = cz + dz;
              const bType = world.getBlock(x, y, z);
              if (bType && bType !== BLOCK_TYPES.AIR) {
                const prop = BLOCK_PROPS[bType];
                // Obsidian, Bedrock, and blastProof blocks resist explosions
                const isBlastProof = prop?.blastProof || bType === BLOCK_TYPES.OBSIDIAN || bType === BLOCK_TYPES.BEDROCK || (prop?.hardness >= 10);
                if (!isBlastProof) {
                  world.setBlock(x, y, z, BLOCK_TYPES.AIR);
                  anyBlocksDestroyed = true;
                  if (particles) {
                    particles.spawnBlockBreak?.({ x, y, z }, prop?.particleColors || 0xef4444, 8);
                  }
                }
              }
            }
          }
        }
      }
      if (anyBlocksDestroyed && typeof world.rebuildMeshes === 'function') {
        world.rebuildMeshes();
      }
    }

    // 2. Deal AoE damage and knockback to all nearby players
    for (const p of players) {
      if (p.isDead) continue;
      const dist = p.position.distanceTo(center);
      if (dist <= radius * 1.5) {
        const falloff = Math.max(0, 1 - dist / (radius * 1.5));
        let finalDamage = this.damage * falloff;
        if (finalDamage > 0.5) {
          const mm = mutationManager || this.mutationManager || gameManager?.mutationManager || this.owner?.teamManager?.gameManager?.mutationManager || null;
          const gm = gameManager || this.gameManager || this.owner?.teamManager?.gameManager || null;
          if (mm && typeof mm.onDamage === 'function') {
            finalDamage = mm.onDamage(this.owner, p, finalDamage, gm);
          }
          p.takeDamage(finalDamage, this.owner, physics, teamManager);
          if (physics && typeof physics.applyKnockback === 'function') {
            const kbStrength = 14 * falloff;
            const vertBoost = 8 * falloff;
            physics.applyKnockback(p, center, kbStrength, vertBoost);
          }
        }
      }
    }
  }

  destroy() {
    this.isDead = true;
    if (this.scene && this.mesh) {
      this.scene.remove(this.mesh);
      if (this.mesh.geometry) this.mesh.geometry.dispose();
      if (this.mesh.material) {
        if (Array.isArray(this.mesh.material)) {
          this.mesh.material.forEach(m => m.dispose());
        } else {
          this.mesh.material.dispose();
        }
      }
      this.mesh = null;
    }
  }
}
