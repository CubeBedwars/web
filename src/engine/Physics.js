import * as THREE from 'three';

export class Physics {
  constructor(world) {
    this.world = world;
    this.gravity = -24.0;
  }

  // Resolves AABB collision for an entity moving with velocity over delta time
  moveEntity(entity, dt) {
    if (entity.isFlying) {
      // Free fly mode (Studio editor)
      entity.position.addScaledVector(entity.velocity, dt);
      return;
    }

    // Apply gravity
    entity.velocity.y += this.gravity * dt;
    if (entity.velocity.y < -35) entity.velocity.y = -35;

    const width = entity.width || 0.6;
    const height = entity.height || 1.8;
    const halfW = width / 2;

    // Movement breakdown by axis for clean wall-sliding
    // 1. Move along X
    entity.position.x += entity.velocity.x * dt;
    if (this.checkCollision(entity.position, halfW, height)) {
      entity.position.x -= entity.velocity.x * dt;
      entity.velocity.x = 0;
    }

    // 2. Move along Z
    entity.position.z += entity.velocity.z * dt;
    if (this.checkCollision(entity.position, halfW, height)) {
      entity.position.z -= entity.velocity.z * dt;
      entity.velocity.z = 0;
    }

    // 3. Move along Y
    entity.position.y += entity.velocity.y * dt;
    entity.onGround = false;

    if (this.checkCollision(entity.position, halfW, height)) {
      if (entity.velocity.y < 0) {
        // Landed on floor
        entity.onGround = true;
        // Snap to nearest voxel surface
        entity.position.y = Math.ceil(entity.position.y);
      } else if (entity.velocity.y > 0) {
        // Hit ceiling
        entity.position.y = Math.floor(entity.position.y + height) - height;
      }
      entity.velocity.y = 0;
    }

    // Ground friction when on surface
    if (entity.onGround) {
      entity.velocity.x *= 0.7;
      entity.velocity.z *= 0.7;
    } else {
      entity.velocity.x *= 0.92;
      entity.velocity.z *= 0.92;
    }
  }

  checkCollision(pos, halfW, height) {
    const minX = Math.floor(pos.x - halfW);
    const maxX = Math.floor(pos.x + halfW);
    const minY = Math.floor(pos.y);
    const maxY = Math.floor(pos.y + height);
    const minZ = Math.floor(pos.z - halfW);
    const maxZ = Math.floor(pos.z + halfW);

    for (let x = minX; x <= maxX; x++) {
      for (let y = minY; y <= maxY; y++) {
        for (let z = minZ; z <= maxZ; z++) {
          if (this.world.isSolid(x, y, z)) {
            return true;
          }
        }
      }
    }
    return false;
  }

  // Knockback impulse applicator
  applyKnockback(entity, sourcePos, strength = 10, verticalBoost = 6) {
    const dir = new THREE.Vector3().subVectors(entity.position, sourcePos);
    dir.y = 0;
    if (dir.lengthSq() < 0.001) {
      dir.set(Math.random() - 0.5, 0, Math.random() - 0.5);
    }
    dir.normalize();

    entity.velocity.x += dir.x * strength;
    entity.velocity.z += dir.z * strength;
    entity.velocity.y = verticalBoost;
    entity.onGround = false;
  }
}
