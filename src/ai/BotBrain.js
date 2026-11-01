import * as THREE from 'three';
import { BLOCK_TYPES } from '../engine/VoxelWorld.js';
import { ShopManager } from '../game/ShopManager.js';

export class BotBrain {
  constructor(bot, game) {
    this.bot = bot;
    this.game = game;
    this.world = game.world;
    this.pathfinder = game.pathfinder;

    this.state = 'COLLECT_FORGE'; // 'COLLECT_FORGE' | 'VISIT_SHOP' | 'DEFEND_BED' | 'EXPAND' | 'ATTACK' | 'COMBAT'
    this.stateTimer = 0;
    this.currentPath = [];
    this.pathIndex = 0;
    this.targetPos = new THREE.Vector3();

    this.bridgeCooldown = 0;
    this.attackCooldown = 0;
    this.chatCooldown = Math.random() * 20 + 15;
  }

  update(delta) {
    if (!this.bot.isAlive) return;

    this.stateTimer += delta;
    this.bridgeCooldown -= delta;
    this.attackCooldown -= delta;
    this.chatCooldown -= delta;

    // Trigger occasional bot banter / alerts
    if (this.chatCooldown <= 0) {
      this.triggerBotChat();
      this.chatCooldown = 30 + Math.random() * 40;
    }

    // 1. Check for immediate combat threats (enemies within 12 blocks)
    const nearestEnemy = this.findNearestEnemy(12.0);
    if (nearestEnemy) {
      this.handleCombat(nearestEnemy, delta);
      return;
    }

    // 2. High-level state machine evaluation
    this.evaluateState();

    // 3. Execute navigation towards target
    this.executeNavigation(delta);
  }

  evaluateState() {
    const team = this.game.teamManager.getTeam(this.bot.teamId);
    if (!team) return;

    // Check if we have enough resources to shop
    const hasEnoughForWool = this.bot.resources.iron >= 4;
    const hasEnoughForSword = this.bot.resources.iron >= 10;
    const hasWoolBlocks = this.bot.inventory.slots.some(s => s && s.itemType === 'block' && s.count > 0);

    if (this.state === 'COLLECT_FORGE') {
      // If we've collected enough resources, go to shop or expand
      if ((hasEnoughForWool && !hasWoolBlocks) || hasEnoughForSword || this.stateTimer > 18) {
        this.state = 'VISIT_SHOP';
        this.stateTimer = 0;
        this.setDestination(team.spawnPos || this.bot.position);
      } else {
        // Stay near forge
        const forgeGen = this.game.generatorManager.generators.find(g => g.type === 'forge' && g.teamId === this.bot.teamId);
        if (forgeGen) {
          this.setDestination(forgeGen.pos);
        }
      }
    } else if (this.state === 'VISIT_SHOP') {
      // Simulate buying blocks & sword
      if (this.bot.resources.iron >= 4 && !hasWoolBlocks) {
        this.bot.resources.iron -= 4;
        this.bot.inventory.addItem({
          id: 'wool',
          name: 'Team Wool',
          count: 16,
          icon: '🧶',
          itemType: 'block',
          blockType: team.woolBlock || BLOCK_TYPES.WOOL_RED,
        });
      }

      if (this.bot.resources.iron >= 10 && !this.bot.inventory.slots.some(s => s && s.id === 'stone_sword')) {
        this.bot.resources.iron -= 10;
        this.bot.inventory.addItem({
          id: 'stone_sword',
          name: 'Stone Sword',
          count: 1,
          icon: '🗡️',
          itemType: 'weapon',
          damage: 5,
        });
      }

      // Decide next goal: attack enemy bed or bridge to diamond
      const targetBed = this.findTargetEnemyBed();
      if (targetBed) {
        this.state = 'ATTACK';
        this.stateTimer = 0;
        this.setDestination(targetBed);
      } else {
        this.state = 'COLLECT_FORGE';
        this.stateTimer = 0;
      }
    } else if (this.state === 'ATTACK') {
      // Periodically refresh target
      if (this.stateTimer > 25 || this.currentPath.length === 0) {
        this.state = 'COLLECT_FORGE';
        this.stateTimer = 0;
      }
    }
  }

  setDestination(pos) {
    this.targetPos.copy(pos);
    this.currentPath = this.pathfinder.findPath(this.bot.position, pos);
    this.pathIndex = 0;
  }

  executeNavigation(delta) {
    if (!this.currentPath || this.pathIndex >= this.currentPath.length) {
      return;
    }

    const nextWaypoint = this.currentPath[this.pathIndex];
    const distToWaypoint = new THREE.Vector2(
      nextWaypoint.x - this.bot.position.x,
      nextWaypoint.z - this.bot.position.z
    ).length();

    // Check if reached waypoint
    if (distToWaypoint < 0.6) {
      this.pathIndex++;
      return;
    }

    // Look at waypoint
    const dir = new THREE.Vector3().subVectors(nextWaypoint, this.bot.position);
    dir.y = 0;
    dir.normalize();
    this.bot.yaw = Math.atan2(-dir.x, -dir.z);

    // Check if we need to bridge across a void gap
    const forwardX = Math.floor(this.bot.position.x + dir.x * 1.1);
    const forwardY = Math.floor(this.bot.position.y - 1.0);
    const forwardZ = Math.floor(this.bot.position.z + dir.z * 1.1);

    if (!this.world.isSolid(forwardX, forwardY, forwardZ)) {
      // Need to bridge! Check if bot has wool blocks
      const blockSlotIdx = this.bot.inventory.slots.findIndex(s => s && s.itemType === 'block' && s.count > 0);
      if (blockSlotIdx !== -1 && this.bridgeCooldown <= 0) {
        const slot = this.bot.inventory.slots[blockSlotIdx];
        this.world.setBlock(forwardX, forwardY, forwardZ, slot.blockType || BLOCK_TYPES.WOOL_RED);
        slot.count--;
        if (slot.count <= 0) this.bot.inventory.slots[blockSlotIdx] = null;
        this.bridgeCooldown = 0.35; // bridging pace
        this.bot.triggerSwing();
        if (this.game.sound) this.game.sound.playBlockPlace();
      }
    }

    // Move forward
    this.bot.input.forward = true;
    this.bot.isSprinting = true;

    // Auto-jump 1 block obstacles
    const obstacleX = Math.floor(this.bot.position.x + dir.x * 0.8);
    const obstacleY = Math.floor(this.bot.position.y);
    const obstacleZ = Math.floor(this.bot.position.z + dir.z * 0.8);

    if (this.world.isSolid(obstacleX, obstacleY, obstacleZ) && this.bot.onGround) {
      this.bot.input.jump = true;
    } else {
      this.bot.input.jump = false;
    }
  }

  handleCombat(enemy, delta) {
    const dist = this.bot.position.distanceTo(enemy.position);

    // Face enemy
    const dir = new THREE.Vector3().subVectors(enemy.position, this.bot.position);
    dir.y = 0;
    dir.normalize();
    this.bot.yaw = Math.atan2(-dir.x, -dir.z);

    // Move towards enemy
    this.bot.input.forward = dist > 2.0;
    this.bot.isSprinting = true;

    // Melee strike if in reach (< 3.2 blocks)
    if (dist <= 3.2 && this.attackCooldown <= 0) {
      this.attackCooldown = 0.55;
      this.bot.triggerSwing();

      const weapon = this.bot.inventory.slots.find(s => s && s.itemType === 'weapon');
      const damage = weapon ? weapon.damage : 3;

      enemy.takeDamage(damage, 'bot_attack');
      this.game.physics.applyKnockback(enemy, this.bot.position, 10.0, 5.0);

      if (this.game.sound) {
        this.game.sound.playSwordSwing();
        this.game.sound.playHitDing();
      }
    }
  }

  findNearestEnemy(maxDist = 15.0) {
    let nearest = null;
    let minD = maxDist;

    for (const player of this.game.players) {
      if (player === this.bot || !player.isAlive || player.teamId === this.bot.teamId) {
        continue;
      }
      const d = this.bot.position.distanceTo(player.position);
      if (d < minD) {
        minD = d;
        nearest = player;
      }
    }

    return nearest;
  }

  findTargetEnemyBed() {
    const teams = this.game.teamManager.getAllTeams().filter(
      t => t.id !== this.bot.teamId && t.bedAlive && t.bedPos
    );
    if (teams.length === 0) return null;
    // Target the closest enemy bed
    teams.sort((a, b) => {
      const da = this.bot.position.distanceTo(new THREE.Vector3(a.bedPos.x, a.bedPos.y, a.bedPos.z));
      const db = this.bot.position.distanceTo(new THREE.Vector3(b.bedPos.x, b.bedPos.y, b.bedPos.z));
      return da - db;
    });

    const target = teams[0].bedPos;
    return new THREE.Vector3(target.x, target.y, target.z);
  }

  triggerBotChat() {
    const lines = [
      "Defending our base with wool!",
      "Gathering iron at the forge.",
      "Bridging towards diamond generator!",
      "Watch your back, rusher coming!",
      "Need 2 more diamonds for sharpness.",
      "gg nicely played!",
      "Protect the bed!",
    ];
    const line = lines[Math.floor(Math.random() * lines.length)];
    this.game.chat.addPlayerMessage(this.bot.name, line, this.bot.teamId);
  }
}
