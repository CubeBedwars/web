import * as THREE from 'three';
import { BLOCK_TYPES } from '../engine/VoxelWorld.js';

export class BotBrain {
  constructor(bot) {
    this.bot = bot;
    this.state = 'GATHER'; // GATHER -> SHOP -> BRIDGE -> ATTACK_BED -> PVP
    this.targetPos = new THREE.Vector3();
    this.targetBed = null;
    this.attackCooldown = 0;
    this.bridgeCooldown = 0;
    this.stateTimer = 0;
  }

  update(dt, gm) {
    this.attackCooldown = Math.max(0, this.attackCooldown - dt);
    this.bridgeCooldown = Math.max(0, this.bridgeCooldown - dt);
    this.stateTimer += dt;

    // 1. High priority: check if any enemy is very close (< 6 blocks) -> Engage in PVP!
    const enemyNearby = this.findNearestEnemy(gm, 6.0);
    if (enemyNearby && !enemyNearby.isDead) {
      this.handleCombat(enemyNearby, gm, dt);
      return;
    }

    // 2. Normal State Machine
    switch (this.state) {
      case 'GATHER':
        this.handleGather(gm, dt);
        break;
      case 'SHOP':
        this.handleShop(gm, dt);
        break;
      case 'BRIDGE':
        this.handleBridge(gm, dt);
        break;
      case 'ATTACK_BED':
        this.handleAttackBed(gm, dt);
        break;
    }
  }

  findNearestEnemy(gm, maxDist = 20) {
    let nearest = null;
    let minDist = maxDist;

    for (const p of gm.players) {
      if (p === this.bot || p.team === this.bot.team || p.isDead) continue;
      const d = this.bot.position.distanceTo(p.position);
      if (d < minDist) {
        minDist = d;
        nearest = p;
      }
    }
    return nearest;
  }

  handleCombat(target, gm, dt) {
    // Face target
    const dir = new THREE.Vector3().subVectors(target.position, this.bot.position);
    this.bot.yaw = Math.atan2(-dir.x, -dir.z);

    // Move toward target
    const dist = dir.length();
    if (dist > 1.8) {
      const speed = 4.5;
      dir.y = 0;
      dir.normalize();
      this.bot.velocity.x = dir.x * speed;
      this.bot.velocity.z = dir.z * speed;
      // Sprint jump occasionally
      if (this.bot.onGround && Math.random() < 0.05) {
        this.bot.velocity.y = 7.5;
      }
    }

    // Attack if close enough
    if (dist <= 2.8 && this.attackCooldown <= 0) {
      this.attackCooldown = 0.6;
      target.takeDamage(this.bot.weapon.damage || 4.0, this.bot, gm.physics);
      if (gm.sound) gm.sound.playHit();
      gm.particles.spawnHitSparks(target.position);
    }
  }

  handleGather(gm, dt) {
    // Walk around home forge spawner
    const forge = gm.mapPreset.generators.find(g => g.type === 'forge' && g.team === this.bot.team);
    if (forge) {
      this.moveTo(forge.pos.x, forge.pos.z, 2.8);
    }

    // Once collected >= 8 iron, switch to SHOP state
    if (this.bot.resources.iron >= 8 || this.stateTimer > 25) {
      this.state = 'SHOP';
      this.stateTimer = 0;
    }
  }

  handleShop(gm, dt) {
    const shop = gm.mapPreset.shopkeepers.find(s => s.team === this.bot.team);
    if (!shop) {
      this.state = 'BRIDGE';
      return;
    }

    const dist = this.moveTo(shop.pos.x, shop.pos.z, 3.0);
    if (dist < 3.5 || this.stateTimer > 10) {
      // Buy wool blocks if affordable
      if (this.bot.resources.iron >= 4) {
        this.bot.spendResource('iron', 4);
        this.bot.addItem({ type: 'block', blockType: this.bot.teamWoolType, count: 16 });
      }
      // Buy sword if affordable
      if (this.bot.resources.iron >= 10 && this.bot.weapon.id === 'fist') {
        this.bot.spendResource('iron', 10);
        this.bot.setWeapon('stone_sword', 5.0);
      }
      this.state = 'BRIDGE';
      this.stateTimer = 0;
    }
  }

  handleBridge(gm, dt) {
    // Pick an opponent bed to bridge towards
    if (!this.targetBed) {
      const otherTeams = Object.keys(gm.teamManager.teams).filter(t => t !== this.bot.team && gm.teamManager.hasBed(t));
      if (otherTeams.length > 0) {
        const targetTeam = otherTeams[0];
        this.targetBed = gm.mapPreset.beds[targetTeam]?.head;
      } else {
        // Fallback: bridge to center
        this.targetBed = { x: 0, y: 21, z: 0 };
      }
    }

    if (!this.targetBed) return;

    // Check if we reached the target island
    const distToBed = this.bot.position.distanceTo(new THREE.Vector3(this.targetBed.x, this.targetBed.y, this.targetBed.z));
    if (distToBed < 8) {
      this.state = 'ATTACK_BED';
      return;
    }

    // Move toward target bed
    const dir = new THREE.Vector3(this.targetBed.x - this.bot.position.x, 0, this.targetBed.z - this.bot.position.z).normalize();
    this.bot.yaw = Math.atan2(-dir.x, -dir.z);

    // Look 1 block ahead in walk direction
    const aheadX = Math.floor(this.bot.position.x + dir.x * 1.2);
    const aheadY = Math.floor(this.bot.position.y - 1);
    const aheadZ = Math.floor(this.bot.position.z + dir.z * 1.2);

    // If there is no floor block ahead (void drop) and bot has wool -> PLACE BLOCK!
    if (!gm.world.isSolid(aheadX, aheadY, aheadZ) && this.bridgeCooldown <= 0) {
      gm.world.setBlock(aheadX, aheadY, aheadZ, this.bot.teamWoolType);
      gm.world.rebuildMeshes();
      if (gm.sound) gm.sound.playBlockPlace();
      this.bridgeCooldown = 0.4;
    }

    // Move forward
    this.bot.velocity.x = dir.x * 3.2;
    this.bot.velocity.z = dir.z * 3.2;
  }

  handleAttackBed(gm, dt) {
    if (!this.targetBed) {
      this.state = 'GATHER';
      return;
    }

    const bedPos = new THREE.Vector3(this.targetBed.x, this.targetBed.y, this.targetBed.z);
    const dist = this.moveTo(bedPos.x, bedPos.z, 2.5);

    if (dist < 3.2 && this.attackCooldown <= 0) {
      this.attackCooldown = 0.7;
      // Strike bed!
      gm.destroyBedAt(this.targetBed.x, this.targetBed.y, this.targetBed.z, this.bot);
      this.state = 'GATHER';
      this.targetBed = null;
    }
  }

  moveTo(tx, tz, speed = 3.0) {
    const dx = tx - this.bot.position.x;
    const dz = tz - this.bot.position.z;
    const dist = Math.sqrt(dx * dx + dz * dz);
    if (dist > 0.5) {
      this.bot.yaw = Math.atan2(-dx, -dz);
      this.bot.velocity.x = (dx / dist) * speed;
      this.bot.velocity.z = (dz / dist) * speed;
    }
    return dist;
  }
}
