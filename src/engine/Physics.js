import * as THREE from 'three';
import { BLOCK_TYPES, BLOCK_PROPERTIES } from './VoxelWorld.js';

export class Physics {
  constructor(world) {
    this.world = world;
    this.gravity = 24.0; // standard gravity in blocks/s^2
    this.terminalVelocity = 40.0;
    this.voidY = -15; // Y coordinate below which player dies
  }

  setGravityMultiplier(multiplier) {
    this.gravity = 24.0 * multiplier;
  }

  setVoidLevel(y) {
    this.voidY = y;
  }

  // Update entity movement with AABB vs Voxel World collision
  updateEntity(entity, delta, moveInput, cameraYaw) {
    // 1. Calculate desired horizontal velocity
    const speed = entity.isSprinting ? entity.sprintSpeed : entity.walkSpeed;
    const forward = new THREE.Vector3(-Math.sin(cameraYaw), 0, -Math.cos(cameraYaw));
    const right = new THREE.Vector3(Math.cos(cameraYaw), 0, -Math.sin(cameraYaw));

    const wishDir = new THREE.Vector3();
    if (moveInput.forward) wishDir.add(forward);
    if (moveInput.backward) wishDir.sub(forward);
    if (moveInput.right) wishDir.add(right);
    if (moveInput.left) wishDir.sub(right);

    if (wishDir.lengthSq() > 0) {
      wishDir.normalize();
    }

    // Ground acceleration / air acceleration
    const accel = entity.onGround ? 65.0 : 25.0;
    const friction = entity.onGround ? 12.0 : 2.5;

    // Apply friction to current horizontal velocity
    entity.velocity.x -= entity.velocity.x * friction * delta;
    entity.velocity.z -= entity.velocity.z * friction * delta;

    // Accelerate
    entity.velocity.x += wishDir.x * speed * accel * delta;
    entity.velocity.z += wishDir.z * speed * accel * delta;

    // Jump handling
    if (moveInput.jump && entity.onGround) {
      entity.velocity.y = entity.jumpForce;
      entity.onGround = false;
      if (entity.onJump) entity.onJump();
    }

    // Apply gravity
    entity.velocity.y -= this.gravity * delta;
    if (entity.velocity.y < -this.terminalVelocity) {
      entity.velocity.y = -this.terminalVelocity;
    }

    // 2. Perform swept AABB collision resolution per axis (Y, X, Z)
    this.moveAndCollide(entity, delta);

    // 3. Void check
    if (entity.position.y < this.voidY) {
      if (entity.onVoidFall) {
        entity.onVoidFall();
      }
    }
  }

  moveAndCollide(entity, delta) {
    const box = entity.boundingBox; // { halfWidth: 0.35, height: 1.8 }
    const hw = box.halfWidth;
    const h = box.height;

    // --- Y AXIS MOVEMENT & COLLISION ---
    const dy = entity.velocity.y * delta;
    entity.position.y += dy;

    if (dy < 0) {
      // Falling down: check blocks underneath
      const minX = Math.floor(entity.position.x - hw);
      const maxX = Math.floor(entity.position.x + hw);
      const minZ = Math.floor(entity.position.z - hw);
      const maxZ = Math.floor(entity.position.z + hw);
      const testY = Math.floor(entity.position.y);

      let collided = false;
      for (let x = minX; x <= maxX; x++) {
        for (let z = minZ; z <= maxZ; z++) {
          const block = this.world.getBlock(x, testY, z);
          if (this.world.isSolid(x, testY, z)) {
            // Check for trampoline bounce block
            if (block === BLOCK_TYPES.TRAMPOLINE) {
              entity.velocity.y = Math.abs(entity.velocity.y) * 1.5 + 8;
              if (entity.onBounce) entity.onBounce();
              collided = true;
              break;
            } else {
              entity.position.y = testY + 1.0;
              entity.velocity.y = 0;
              entity.onGround = true;
              collided = true;
              break;
            }
          }
        }
        if (collided) break;
      }
      if (!collided) {
        entity.onGround = false;
      }
    } else if (dy > 0) {
      // Jumping up: check blocks overhead
      const minX = Math.floor(entity.position.x - hw);
      const maxX = Math.floor(entity.position.x + hw);
      const minZ = Math.floor(entity.position.z - hw);
      const maxZ = Math.floor(entity.position.z + hw);
      const testY = Math.floor(entity.position.y + h);

      for (let x = minX; x <= maxX; x++) {
        for (let z = minZ; z <= maxZ; z++) {
          if (this.world.isSolid(x, testY, z)) {
            entity.position.y = testY - h - 0.01;
            entity.velocity.y = 0;
            break;
          }
        }
      }
    }

    // --- X AXIS MOVEMENT & COLLISION ---
    const dx = entity.velocity.x * delta;
    entity.position.x += dx;
    const testX = dx > 0 ? Math.floor(entity.position.x + hw) : Math.floor(entity.position.x - hw);
    const minY = Math.floor(entity.position.y + 0.1);
    const maxY = Math.floor(entity.position.y + h - 0.1);
    const minZ = Math.floor(entity.position.z - hw);
    const maxZ = Math.floor(entity.position.z + hw);

    for (let y = minY; y <= maxY; y++) {
      for (let z = minZ; z <= maxZ; z++) {
        if (this.world.isSolid(testX, y, z)) {
          if (dx > 0) {
            entity.position.x = testX - hw - 0.001;
          } else {
            entity.position.x = testX + 1.0 + hw + 0.001;
          }
          entity.velocity.x = 0;
          break;
        }
      }
    }

    // --- Z AXIS MOVEMENT & COLLISION ---
    const dz = entity.velocity.z * delta;
    entity.position.z += dz;
    const testZ = dz > 0 ? Math.floor(entity.position.z + hw) : Math.floor(entity.position.z - hw);
    const minX_z = Math.floor(entity.position.x - hw);
    const maxX_z = Math.floor(entity.position.x + hw);

    for (let y = minY; y <= maxY; y++) {
      for (let x = minX_z; x <= maxX_z; x++) {
        if (this.world.isSolid(x, y, testZ)) {
          if (dz > 0) {
            entity.position.z = testZ - hw - 0.001;
          } else {
            entity.position.z = testZ + 1.0 + hw + 0.001;
          }
          entity.velocity.z = 0;
          break;
        }
      }
    }
  }

  // Knockback impulse (from sword hits or arrows)
  applyKnockback(target, sourcePos, horizontalStrength = 8.0, verticalStrength = 5.0) {
    const dir = new THREE.Vector3().subVectors(target.position, sourcePos);
    dir.y = 0;
    if (dir.lengthSq() > 0.001) {
      dir.normalize();
    } else {
      dir.set(0, 0, 1);
    }

    target.velocity.x += dir.x * horizontalStrength;
    target.velocity.z += dir.z * horizontalStrength;
    target.velocity.y = Math.max(target.velocity.y, 0) + verticalStrength;
    target.onGround = false;
  }

  // Explosive impulse (TNT & Fireballs)
  applyExplosion(center, radius = 4.5, maxKnockback = 18.0, entities = []) {
    // 1. Destroy non-blast-proof blocks in radius
    const minX = Math.floor(center.x - radius);
    const maxX = Math.ceil(center.x + radius);
    const minY = Math.floor(center.y - radius);
    const maxY = Math.ceil(center.y + radius);
    const minZ = Math.floor(center.z - radius);
    const maxZ = Math.ceil(center.z + radius);

    const destroyedBlocks = [];

    for (let x = minX; x <= maxX; x++) {
      for (let y = minY; y <= maxY; y++) {
        for (let z = minZ; z <= maxZ; z++) {
          const distSq = (x + 0.5 - center.x) ** 2 + (y + 0.5 - center.y) ** 2 + (z + 0.5 - center.z) ** 2;
          if (distSq <= radius * radius) {
            const block = this.world.getBlock(x, y, z);
            if (block !== BLOCK_TYPES.AIR) {
              const prop = BLOCK_PROPERTIES[block];
              if (prop && !prop.blastProof && block !== BLOCK_TYPES.BEDROCK) {
                this.world.setBlock(x, y, z, BLOCK_TYPES.AIR);
                destroyedBlocks.push({ x, y, z, type: block });
              }
            }
          }
        }
      }
    }

    // 2. Launch entities away with inverse-distance knockback
    for (const entity of entities) {
      const dist = entity.position.distanceTo(center);
      if (dist < radius * 1.5) {
        const factor = 1.0 - Math.min(dist / (radius * 1.5), 1.0);
        const force = maxKnockback * factor;
        const dir = new THREE.Vector3().subVectors(entity.position, center).normalize();
        
        entity.velocity.x += dir.x * force;
        entity.velocity.z += dir.z * force;
        entity.velocity.y = Math.max(entity.velocity.y, 0) + force * 0.7;
        entity.onGround = false;

        // Explosion damage
        const damage = Math.round(14 * factor);
        if (entity.takeDamage) {
          entity.takeDamage(damage, 'explosion');
        }
      }
    }

    return destroyedBlocks;
  }
}
