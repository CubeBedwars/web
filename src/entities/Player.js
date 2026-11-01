import * as THREE from 'three';
import { BLOCK_TYPES } from '../engine/VoxelWorld.js';

export class Inventory {
  constructor(player) {
    this.player = player;
    this.slots = new Array(9).fill(null); // 9 hotbar slots
  }

  addItem(itemData) {
    // Check if item already exists and is stackable
    for (let i = 0; i < 9; i++) {
      const slot = this.slots[i];
      if (slot && slot.id === itemData.id && slot.stackable !== false) {
        slot.count = (slot.count || 1) + (itemData.count || 1);
        if (this.player.onInventoryChange) this.player.onInventoryChange();
        return true;
      }
    }

    // Find first empty slot
    for (let i = 0; i < 9; i++) {
      if (!this.slots[i]) {
        this.slots[i] = { ...itemData, count: itemData.count || 1 };
        if (this.player.onInventoryChange) this.player.onInventoryChange();
        return true;
      }
    }

    return false; // hotbar full
  }

  removeItem(slotIndex, count = 1) {
    const slot = this.slots[slotIndex];
    if (!slot) return null;

    if (slot.count > count) {
      slot.count -= count;
    } else {
      this.slots[slotIndex] = null;
    }

    if (this.player.onInventoryChange) this.player.onInventoryChange();
    return slot;
  }

  getSlot(slotIndex) {
    return this.slots[slotIndex] || null;
  }
}

export class Player {
  constructor(id, name, teamId, isLocal = false) {
    this.id = id;
    this.name = name;
    this.teamId = teamId;
    this.isLocal = isLocal;

    // Transform
    this.position = new THREE.Vector3(0, 20, 0);
    this.velocity = new THREE.Vector3(0, 0, 0);
    this.rotation = new THREE.Euler(0, 0, 0, 'YXZ'); // pitch, yaw, roll

    // Dimensions
    this.boundingBox = { halfWidth: 0.35, height: 1.8 };
    this.onGround = false;

    // Movement speeds
    this.walkSpeed = 4.3;
    this.sprintSpeed = 6.8;
    this.jumpForce = 8.5;
    this.isSprinting = false;

    // Vitals
    this.maxHealth = 20;
    this.health = 20;
    this.isAlive = true;
    this.respawnTimer = 0;

    // Gear & Economy
    this.resources = { iron: 0, gold: 0, diamond: 0, emerald: 0 };
    this.armorTier = 'none'; // 'none' | 'chainmail' | 'iron' | 'diamond'
    this.armorDefense = 0;
    this.activeSlotIndex = 0;

    this.inventory = new Inventory(this);

    // Give default wooden sword
    this.inventory.addItem({
      id: 'wood_sword',
      name: 'Wooden Sword',
      icon: '🗡️',
      itemType: 'weapon',
      damage: 4,
      stackable: false,
    });
  }

  addResource(type, count = 1) {
    if (this.resources[type] !== undefined) {
      this.resources[type] += count;
      if (this.onResourceChange) this.onResourceChange();
    }
  }

  getActiveItem() {
    return this.inventory.getSlot(this.activeSlotIndex);
  }

  takeDamage(amount, source = 'attack') {
    if (!this.isAlive) return false;

    // Apply armor defense reduction
    const defensePercent = this.armorDefense / 100.0;
    const finalDamage = Math.max(amount * (1.0 - defensePercent * 0.7), 1);

    this.health -= finalDamage;

    if (this.onDamaged) {
      this.onDamaged(finalDamage, source);
    }

    if (this.health <= 0) {
      this.health = 0;
      this.die(source);
      return true; // died
    }

    return false;
  }

  die(source = 'unknown') {
    this.isAlive = false;
    this.health = 0;

    // Drop resources or lose percentage on death
    this.resources.iron = 0;
    this.resources.gold = 0;

    if (this.onDeath) {
      this.onDeath(source);
    }
  }

  respawn(spawnPos) {
    this.health = this.maxHealth;
    this.isAlive = true;
    this.position.copy(spawnPos);
    this.velocity.set(0, 0, 0);

    if (this.onRespawn) {
      this.onRespawn();
    }
  }
}
