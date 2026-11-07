import * as THREE from 'three';
import { BLOCK_TYPES } from '../engine/VoxelWorld.js';

export class Player {
  constructor(id, name, team, isLocal = false) {
    this.id = id;
    this.name = name;
    this.team = team;
    this.isLocal = isLocal;
    this.isLocalPlayer = isLocal;

    // Movement state
    this.position = new THREE.Vector3(0, 25, 0);
    this.velocity = new THREE.Vector3(0, 0, 0);
    this.yaw = 0;
    this.pitch = 0;
    this.onGround = false;
    this.isDead = false;
    this.isFinalDead = false;
    this.respawnTimer = 0;

    // Vitals
    this.maxHealth = 20;
    this.health = 20;
    this.kills = 0;
    this.finalKills = 0;
    this.bedsBroken = 0;

    // Combat attribution (10-second tagger)
    this.lastAttacker = null;
    this.lastAttackTimestamp = 0;
    this.teamManager = null;
    this.teamUpgrades = null;
    this.mutationManager = null;
    this.gameManager = null;
    this.onDamageTaken = null;

    // Bedwars Resources (Iron, Gold, Diamonds, Emeralds)
    this.resources = {
      iron: 0,
      gold: 0,
      diamond: 0,
      emerald: 0,
    };

    // Gear
    this.weapon = { id: 'wooden_sword', name: 'Wooden Sword', damage: 4.0, knockback: 10 };
    this.armor = { tier: 'none', reduction: 0 };
    this.tool = { id: 'fist', speed: 1.0 };

    // Inventory Hotbar (9 slots)
    this.hotbar = new Array(9).fill(null);
    this.selectedSlot = 0;

    // Team wool type based on team color
    this.teamWoolType = this.resolveTeamWool(team);

    // Initial hotbar load
    this.addItem({ type: 'weapon', id: 'wooden_sword', name: 'Wooden Sword', damage: 4.0, count: 1 });
  }

  resolveTeamWool(team) {
    switch (team) {
      case 'red': return BLOCK_TYPES.WOOL_RED;
      case 'blue': return BLOCK_TYPES.WOOL_BLUE;
      case 'green': return BLOCK_TYPES.WOOL_GREEN;
      case 'yellow': return BLOCK_TYPES.WOOL_YELLOW;
      case 'aqua': return BLOCK_TYPES.WOOL_AQUA;
      case 'white': return BLOCK_TYPES.WOOL_WHITE;
      case 'pink': return BLOCK_TYPES.WOOL_PINK;
      case 'gray': return BLOCK_TYPES.WOOL_GRAY;
      default: return BLOCK_TYPES.WOOL_WHITE;
    }
  }

  addResource(type, amount = 1) {
    if (this.resources[type] !== undefined) {
      this.resources[type] += amount;
    }
  }

  spendResource(type, amount) {
    if (this.resources[type] >= amount) {
      this.resources[type] -= amount;
      return true;
    }
    return false;
  }

  addItem(item) {
    // If stackable block, find existing slot
    if (item.type === 'block') {
      for (let i = 0; i < 9; i++) {
        if (this.hotbar[i] && this.hotbar[i].type === 'block' && this.hotbar[i].blockType === item.blockType) {
          this.hotbar[i].count += item.count;
          return true;
        }
      }
    }

    // Place in first empty slot
    for (let i = 0; i < 9; i++) {
      if (!this.hotbar[i]) {
        this.hotbar[i] = { ...item };
        return true;
      }
    }
    return false;
  }

  setWeapon(id, damage, knockback = 12) {
    this.weapon = { id, damage, knockback };
    this.hotbar[0] = { type: 'weapon', id, name: id.replace('_', ' ').toUpperCase(), damage };
  }

  setArmor(tier, reduction) {
    this.armor = { tier, reduction };
  }

  setTool(id, speed) {
    this.tool = { id, speed };
    this.addItem({ type: 'tool', id, speed, name: id.toUpperCase(), count: 1 });
  }

  getSelectedItem() {
    return this.hotbar[this.selectedSlot] || null;
  }

  consumeSelectedItem() {
    const item = this.getSelectedItem();
    if (!item) return;
    item.count--;
    if (item.count <= 0) {
      this.hotbar[this.selectedSlot] = null;
    }
  }

  getAttackDamage(teamManager = null) {
    let baseDamage = 4.0;
    const selected = this.getSelectedItem ? this.getSelectedItem() : null;
    if (selected && typeof selected.damage === 'number') {
      baseDamage = selected.damage;
    } else if (this.weapon && typeof this.weapon.damage === 'number') {
      baseDamage = this.weapon.damage;
    }
    const tm = teamManager || this.teamManager;
    const sharpnessTier = (tm?.teams?.[this.team]?.upgrades?.sharpness) ?? (this.teamUpgrades?.sharpness || 0);
    const sharpnessBonus = sharpnessTier * 1.25;
    return baseDamage + sharpnessBonus;
  }

  takeDamage(amount, attacker = null, physics = null, teamManager = null, mutationManager = null, gameManager = null) {
    if (this.isDead) return false;

    // Route combat hook onDamage if mutationManager provided and attacker exists
    let effectiveAmount = amount;
    const mm = mutationManager || this.mutationManager;
    const gm = gameManager || this.gameManager || this.teamManager?.gameManager;
    if (mm && typeof mm.onDamage === 'function' && attacker) {
      effectiveAmount = mm.onDamage(attacker, this, amount, gm);
    }

    // Combat tagging (10-second attribution window)
    if (attacker) {
      this.lastAttacker = attacker;
      this.lastAttackTimestamp = Date.now();
    }

    // Apply team protection upgrade (10% reduction per tier) and armor reduction
    const tm = teamManager || this.teamManager;
    const protTier = (tm?.teams?.[this.team]?.upgrades?.protection) ?? (this.teamUpgrades?.protection || 0);
    const protReduction = protTier * 0.1;
    const armorReduction = this.armor?.reduction || 0;
    const finalDamage = effectiveAmount * (1.0 - armorReduction) * (1.0 - protReduction);

    this.health = Math.max(0, this.health - finalDamage);

    if (this.onDamageTaken) {
      this.onDamageTaken(finalDamage, attacker);
    }

    // Apply knockback if attacker provided
    if (attacker && physics) {
      const kb = attacker.weapon?.knockback || 10;
      physics.applyKnockback(this, attacker.position, kb, 5);
    }

    if (this.health <= 0) {
      this.die(attacker);
      return true;
    }
    return false;
  }

  die(killer = null) {
    this.isDead = true;
    this.respawnTimer = 5.0; // 5 seconds
    this.velocity.set(0, 0, 0);

    // Drop or lose a portion of resources
    this.resources.iron = Math.floor(this.resources.iron / 2);
    this.resources.gold = Math.floor(this.resources.gold / 2);

    // Combat tagger attribution fallback (e.g. void falls or indirect deaths within 10s)
    const now = Date.now();
    if (!killer && this.lastAttacker && (now - this.lastAttackTimestamp <= 10000)) {
      killer = this.lastAttacker;
    }

    if (killer) {
      killer.kills++;
      if (this.isFinalDead) {
        killer.finalKills++;
      }
      const gm = killer.teamManager?.gameManager || this.teamManager?.gameManager;
      if (gm?.mutationManager) {
        gm.mutationManager.onKill(killer, this, gm);
      }
    }

    this.lastAttacker = null;
    this.lastAttackTimestamp = 0;
  }

  respawn(spawnPos) {
    this.isDead = false;
    this.health = this.maxHealth;
    this.position.set(spawnPos.x, spawnPos.y, spawnPos.z);
    this.velocity.set(0, 0, 0);
  }
}
