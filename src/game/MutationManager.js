import * as THREE from 'three';
import { BLOCK_TYPES, BLOCK_PROPS } from '../engine/VoxelWorld.js';

export const GUN_GAME_TIERS = [
  { tier: 1, name: 'Wooden Slingshot', damage: 3.5, speed: 20, type: 'slingshot', explosive: false },
  { tier: 2, name: 'Iron Crossbow', damage: 6.0, speed: 30, type: 'crossbow', explosive: false },
  { tier: 3, name: 'Fireball Launcher', damage: 10.0, speed: 25, type: 'fireball', explosive: true },
  { tier: 4, name: 'Plasma Blaster', damage: 15.0, speed: 45, type: 'plasma', explosive: true },
];

export const MUTATION_DEFINITIONS = {
  Supercharged: {
    id: 'Supercharged',
    name: 'Supercharged',
    icon: '⚡',
    description: 'All team forges and resource generators start at Level 2 from match onset.',
  },
  'Launch Rush': {
    id: 'Launch Rush',
    name: 'Launch Rush',
    icon: '🚀',
    description: 'Every team base island is equipped with launchpads for aerial leaps.',
  },
  'Gun Game': {
    id: 'Gun Game',
    name: 'Gun Game',
    icon: '🔫',
    description: 'Players spawn with projectile weapons that upgrade on securing kills.',
  },
  'Lethal Strike': {
    id: 'Lethal Strike',
    name: 'Lethal Strike',
    icon: '💀',
    description: 'Attacks deal 2.0x increased damage for fast, high-stakes combat.',
  },
  'Low Gravity': {
    id: 'Low Gravity',
    name: 'Low Gravity',
    icon: '🌙',
    description: 'Moon-like reduced gravity enabling floaty leaps and aerial bridging.',
  },
  'Speed Demon': {
    id: 'Speed Demon',
    name: 'Speed Demon',
    icon: '🏃💨',
    description: 'All players receive a permanent 1.5x movement speed boost.',
  },
  Vampirism: {
    id: 'Vampirism',
    name: 'Vampirism',
    icon: '🩸',
    description: 'Players regenerate health upon damaging opponents or securing kills.',
  },
  'Sudden Death': {
    id: 'Sudden Death',
    name: 'Sudden Death',
    icon: '⏱️💣',
    description: 'Timed universal bed destruction and progressive arena perimeter decay.',
  },
  'Lucky Chaos': {
    id: 'Lucky Chaos',
    name: 'Lucky Chaos',
    icon: '❓✨',
    description: 'Spawns lucky blocks and unpredictable arena item events across islands.',
  },
};

export class MutationManager {
  constructor() {
    this.activeMutations = new Set();
    this.launchpads = [];
    this.launchCooldowns = new Map(); // entityId -> timestamp
    this.suddenDeathTriggered = false;
    this.decayTimer = 0;
    this.decayRadius = 45;
    this.luckyBlockTimer = 0;
  }

  enable(name) {
    this.activeMutations.add(name);
  }

  disable(name) {
    this.activeMutations.delete(name);
  }

  has(name) {
    return this.activeMutations.has(name);
  }

  getActiveMutations() {
    return Array.from(this.activeMutations);
  }

  // --- QUERY HELPERS (COMPATIBLE WITH TEST HARNESSES) ---

  getInitialGeneratorTier() {
    return this.has('Supercharged') ? 2 : 1;
  }

  hasBaseLaunchpads() {
    return this.has('Launch Rush');
  }

  getGravity() {
    return this.has('Low Gravity') ? -8.0 : -24.0;
  }

  getSpeedMultiplier() {
    return this.has('Speed Demon') ? 1.5 : 1.0;
  }

  getDamageMultiplier() {
    return this.has('Lethal Strike') ? 2.0 : 1.0;
  }

  applyVampirismDamage(damageDealt) {
    if (!this.has('Vampirism')) return 0;
    return Math.max(0.5, Math.floor(damageDealt * 0.25 * 2) / 2);
  }

  applyVampirismKill() {
    if (!this.has('Vampirism')) return 0;
    return 5.0; // Restores 5 HP upon eliminating an opponent
  }

  isSuddenDeathTriggered(matchSeconds, limitSeconds = 600) {
    if (!this.has('Sudden Death')) return false;
    return matchSeconds >= limitSeconds;
  }

  // --- LIFECYCLE HOOKS ---

  onMatchStart(gameManager) {
    this.suddenDeathTriggered = false;
    this.decayTimer = 0;
    this.decayRadius = 45;
    this.luckyBlockTimer = 0;
    this.launchCooldowns.clear();

    // 1. Supercharged: Set all team forges to Tier 2 and accelerate generators
    if (this.has('Supercharged')) {
      if (gameManager.teamManager?.teams) {
        for (const team of Object.values(gameManager.teamManager.teams)) {
          if (team.upgrades) team.upgrades.forgeTier = 2.0;
        }
      }
      if (gameManager.generatorManager?.spawners) {
        for (const sp of gameManager.generatorManager.spawners) {
          if (sp.type === 'diamond' || sp.type === 'emerald') {
            sp.interval = Math.max(5, sp.interval * 0.65);
          }
        }
      }
    }

    // 2. Low Gravity: Adjust physics gravity
    if (this.has('Low Gravity')) {
      if (gameManager.physics) {
        gameManager.physics.gravity = -8.0;
      }
    } else {
      if (gameManager.physics) {
        gameManager.physics.gravity = -24.0;
      }
    }

    // 3. Launch Rush: Setup launchpad locations at each team base
    if (this.has('Launch Rush')) {
      this.launchpads = [];
      const spawns = gameManager.mapPreset?.spawns || {};
      for (const [tName, sPos] of Object.entries(spawns)) {
        // Place launchpad toward center
        const spawnDist = Math.hypot(sPos.x, sPos.z);
        const dirToCenter = spawnDist > 0.001
          ? new THREE.Vector3(-sPos.x / spawnDist, 0, -sPos.z / spawnDist)
          : new THREE.Vector3(0, 0, -1);
        const padPos = {
          x: sPos.x + dirToCenter.x * 5,
          y: sPos.y,
          z: sPos.z + dirToCenter.z * 5,
          forward: dirToCenter,
          team: tName,
        };
        this.launchpads.push(padPos);

        // Place visual gold/emerald pad block in world
        const bx = Math.floor(padPos.x);
        const by = Math.floor(padPos.y) - 1;
        const bz = Math.floor(padPos.z);
        if (gameManager.world?.setBlock) {
          gameManager.world.setBlock(bx, by, bz, BLOCK_TYPES.GOLD_BLOCK);
        }
      }
      if (gameManager.world?.rebuildMeshes) {
        gameManager.world.rebuildMeshes();
      }
    }

    // 4. Gun Game: Equip starting Tier 1 weapon on all players
    if (this.has('Gun Game')) {
      const tier1 = GUN_GAME_TIERS[0];
      for (const p of gameManager.players) {
        p.gunGameTier = 1;
        this.equipGunGameWeapon(p, 1);
      }
    }

    // 5. Lucky Chaos: Spawn initial lucky blocks
    if (this.has('Lucky Chaos')) {
      this.spawnLuckyBlocks(gameManager, 8);
    }
  }

  equipGunGameWeapon(player, tierNum) {
    const tier = GUN_GAME_TIERS[tierNum - 1] || GUN_GAME_TIERS[0];
    player.gunGameTier = tier.tier;
    const item = {
      type: 'weapon',
      id: `gun_${tier.type}`,
      name: tier.name,
      damage: tier.damage,
      isGun: true,
      gunType: tier.type,
      speed: tier.speed,
      explosive: tier.explosive,
      count: 1,
    };
    player.hotbar[0] = item;
    player.weapon = {
      id: item.id,
      name: item.name,
      damage: item.damage,
      knockback: 10,
    };
  }

  onTick(dt, gameManager) {
    const matchTime = gameManager.matchTime || 0;

    // 1. Launch Rush physics check
    if (this.has('Launch Rush') && this.launchpads.length > 0) {
      const now = Date.now();
      for (const p of gameManager.players) {
        if (p.isDead) continue;
        const lastLaunch = this.launchCooldowns.get(p.id) || 0;
        if (now - lastLaunch < 1000) continue; // 1s cooldown

        for (const pad of this.launchpads) {
          const dist = Math.hypot(p.position.x - pad.x, p.position.z - pad.z);
          if (dist < 2.0 && Math.abs(p.position.y - pad.y) < 1.5) {
            this.launchCooldowns.set(p.id, now);
            p.velocity.y = 18.0;
            p.velocity.x = pad.forward.x * 16.0;
            p.velocity.z = pad.forward.z * 16.0;
            p.onGround = false;

            if (gameManager.sound) gameManager.sound.playItemPickup?.();
            if (gameManager.particles) gameManager.particles.spawnBlockBreak?.(pad, 0xfacc15, 12);
            if (p.isLocal) {
              gameManager.hud?.showAnnouncement?.('LAUNCHPAD BOOST!', 'Soaring toward the arena center!');
            }
            break;
          }
        }
      }
    }

    // 2. Sudden Death: Universal Bed Breakdown & Arena Decay
    if (this.has('Sudden Death')) {
      const limitSeconds = 600; // 10 minutes
      if (!this.suddenDeathTriggered && this.isSuddenDeathTriggered(matchTime, limitSeconds)) {
        this.suddenDeathTriggered = true;
        if (gameManager.teamManager?.teams) {
          for (const t of Object.keys(gameManager.teamManager.teams)) {
            gameManager.teamManager.destroyBed(t);
          }
        }
        if (gameManager.sound) gameManager.sound.playBedDestroyed?.();
        gameManager.hud?.showAnnouncement?.('SUDDEN DEATH!', 'All beds have been destroyed! No respawns!');
      }

      // Arena Decay when sudden death is active
      if (this.suddenDeathTriggered) {
        this.decayTimer += dt;
        if (this.decayTimer >= 2.0 && this.decayRadius > 15) {
          this.decayTimer = 0;
          this.decayRadius -= 2;
          this.decayArenaPerimeter(gameManager, this.decayRadius);
        }
      }
    }

    // 3. Lucky Chaos periodic spawns
    if (this.has('Lucky Chaos')) {
      this.luckyBlockTimer += dt;
      if (this.luckyBlockTimer >= 30.0) {
        this.luckyBlockTimer = 0;
        this.spawnLuckyBlocks(gameManager, 4);
      }
    }
  }

  decayArenaPerimeter(gameManager, safeRadius) {
    const world = gameManager.world;
    if (!world || typeof world.getBlock !== 'function') return;

    let destroyedCount = 0;
    const rOuter = Math.max(safeRadius + 6, 50);
    for (let x = -rOuter; x <= rOuter; x++) {
      for (let z = -rOuter; z <= rOuter; z++) {
        const dist = Math.hypot(x, z);
        if (dist > safeRadius) {
          for (let y = 16; y <= 26; y++) {
            const b = world.getBlock(x, y, z);
            if (b && b !== BLOCK_TYPES.AIR && b !== BLOCK_TYPES.BEDROCK) {
              world.setBlock(x, y, z, BLOCK_TYPES.AIR);
              destroyedCount++;
            }
          }
        }
      }
    }
    if (destroyedCount > 0 && typeof world.rebuildMeshes === 'function') {
      world.rebuildMeshes();
    }
  }

  spawnLuckyBlocks(gameManager, count = 4) {
    const world = gameManager.world;
    if (!world || typeof world.setBlock !== 'function') return;

    // Spawn on base islands and center
    const spawns = gameManager.mapPreset?.spawns || {};
    const coords = Object.values(spawns).map(s => ({ x: s.x + 3, y: s.y, z: s.z + 3 }));
    coords.push({ x: 0, y: 21, z: 0 }, { x: 2, y: 21, z: 2 }, { x: -2, y: 21, z: -2 });

    for (let i = 0; i < Math.min(count, coords.length); i++) {
      const c = coords[i];
      world.setBlock(Math.floor(c.x), Math.floor(c.y), Math.floor(c.z), BLOCK_TYPES.LUCKY_BLOCK);
    }
    if (typeof world.rebuildMeshes === 'function') {
      world.rebuildMeshes();
    }
  }

  onDamage(attacker, victim, damage, gameManager) {
    let finalDamage = damage;

    // 1. Lethal Strike: 2.0x damage scaling
    if (this.has('Lethal Strike')) {
      finalDamage *= this.getDamageMultiplier();
    }

    // 2. Vampirism: Attacker heals for 25% of damage dealt
    if (this.has('Vampirism') && attacker && attacker !== victim && !attacker.isDead) {
      const heal = this.applyVampirismDamage(finalDamage);
      attacker.health = Math.min(attacker.maxHealth, attacker.health + heal);
      if (attacker.isLocal && gameManager?.particles) {
        gameManager.particles.spawnHitSparks?.(attacker.position);
      }
    }

    return finalDamage;
  }

  onKill(killer, victim, gameManager) {
    if (!killer) return;

    // 1. Gun Game weapon advancement
    if (this.has('Gun Game')) {
      const currentTier = killer.gunGameTier || 1;
      if (currentTier < GUN_GAME_TIERS.length) {
        const nextTier = currentTier + 1;
        this.equipGunGameWeapon(killer, nextTier);
        if (gameManager.sound) gameManager.sound.playItemPickup?.();
        const tierName = GUN_GAME_TIERS[nextTier - 1].name;
        if (killer.isLocal) {
          gameManager.hud?.showAnnouncement?.('WEAPON UPGRADED!', `Secured a kill! Advanced to ${tierName}!`);
        }
      }
    }

    // 2. Vampirism kill bonus: +5 HP
    if (this.has('Vampirism') && !killer.isDead) {
      const heal = this.applyVampirismKill();
      killer.health = Math.min(killer.maxHealth, killer.health + heal);
      if (killer.isLocal) {
        gameManager.hud?.showAnnouncement?.('VAMPIRIC RESTORATION!', `+${heal} HP restored from kill!`);
      }
    }
  }

  onBlockBreak(player, x, y, z, blockType, gameManager) {
    // Lucky Chaos drop table
    if (this.has('Lucky Chaos') && blockType === BLOCK_TYPES.LUCKY_BLOCK) {
      const roll = Math.random();
      if (roll < 0.25) {
        player.addResource('diamond', 3);
        gameManager.hud?.showAnnouncement?.('LUCKY DROP!', '+3 Diamonds!');
      } else if (roll < 0.50) {
        player.addResource('emerald', 2);
        gameManager.hud?.showAnnouncement?.('LUCKY DROP!', '+2 Emeralds!');
      } else if (roll < 0.75) {
        player.addItem({ type: 'consumable', id: 'gapple', name: 'Golden Apple', count: 1 });
        gameManager.hud?.showAnnouncement?.('LUCKY DROP!', '+1 Golden Apple!');
      } else {
        player.addItem({ type: 'projectile', id: 'fireball', name: 'Fireball', count: 2 });
        gameManager.hud?.showAnnouncement?.('LUCKY DROP!', '+2 Fireballs!');
      }
      if (gameManager.sound) gameManager.sound.playExplosion?.();
    }
  }

  onCleanup(gameManager) {
    if (gameManager.physics) {
      gameManager.physics.gravity = -24.0;
    }
    this.launchpads = [];
    this.launchCooldowns.clear();
  }
}
