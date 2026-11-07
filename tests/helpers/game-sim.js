/**
 * tests/helpers/game-sim.js
 * Authoritative headless simulation helpers, mathematical models, and contract validators
 * derived from ORIGINAL_REQUEST.md and PROJECT.md specifications.
 */

import * as THREE from 'three';
import { BLOCK_TYPES, BLOCK_PROPS } from '../../src/engine/VoxelWorld.js';

// ============================================================================
// 1. ENGINE & BLOCK MECHANICS (Features 1 - 7)
// ============================================================================

export const TOOL_MULTIPLIERS = {
  fist: 1.0,
  wooden_pickaxe: 0.5,
  stone_pickaxe: 0.33,
  iron_pickaxe: 0.2,
  diamond_pickaxe: 0.125,
  shears: 0.1, // for wool
  wooden_axe: 0.6,
};

export function calculateBreakTime(blockType, tool = 'fist') {
  const prop = BLOCK_PROPS[blockType];
  if (!prop || !prop.solid) return 0;
  if (prop.hardness >= 99999) return Infinity; // Bedrock is unbreakable

  let mult = TOOL_MULTIPLIERS[tool] || 1.0;

  // Tool effectiveness check: if tool does not match required tool, apply penalty
  if (prop.tool && !tool.includes(prop.tool)) {
    if (prop.tool === 'shears' && tool !== 'shears') mult = 1.0;
    else if (prop.tool === 'pickaxe' && !tool.includes('pickaxe')) mult = 1.5;
  }

  return prop.hardness * mult;
}

export function calculateCrackStage(progress, breakTime) {
  if (breakTime <= 0) return -1;
  const ratio = Math.min(1.0, Math.max(0.0, progress / breakTime));
  return Math.min(9, Math.floor(ratio * 10));
}

export const BLOCK_PALETTES = {
  [BLOCK_TYPES.WOOD]: ['#854d0e', '#a16207', '#713f12'],
  [BLOCK_TYPES.OBSIDIAN]: ['#1e1b4b', '#312e81', '#0f172a'],
  [BLOCK_TYPES.WOOL_RED]: ['#ef4444', '#dc2626', '#b91c1c'],
  [BLOCK_TYPES.WOOL_BLUE]: ['#3b82f6', '#2563eb', '#1d4ed8'],
  [BLOCK_TYPES.DIAMOND_BLOCK]: ['#06b6d4', '#22d3ee', '#67e8f9'],
  [BLOCK_TYPES.EMERALD_BLOCK]: ['#10b981', '#34d399', '#059669'],
  [BLOCK_TYPES.GOLD_BLOCK]: ['#eab308', '#facc15', '#ca8a04'],
  [BLOCK_TYPES.IRON_BLOCK]: ['#d1d5db', '#e5e7eb', '#9ca3af'],
};

export function getBlockBreakParticles(blockType) {
  return BLOCK_PALETTES[blockType] || ['#9ca3af', '#6b7280', '#4b5563'];
}

export function performDDA(origin, direction, maxDistance = 6, worldBlocks = new Map()) {
  let x = Math.floor(origin.x);
  let y = Math.floor(origin.y);
  let z = Math.floor(origin.z);

  const stepX = Math.sign(direction.x);
  const stepY = Math.sign(direction.y);
  const stepZ = Math.sign(direction.z);

  const tDeltaX = stepX !== 0 ? Math.abs(1 / direction.x) : Infinity;
  const tDeltaY = stepY !== 0 ? Math.abs(1 / direction.y) : Infinity;
  const tDeltaZ = stepZ !== 0 ? Math.abs(1 / direction.z) : Infinity;

  let tMaxX = stepX > 0 ? (x + 1 - origin.x) * tDeltaX : (origin.x - x) * tDeltaX;
  let tMaxY = stepY > 0 ? (y + 1 - origin.y) * tDeltaY : (origin.y - y) * tDeltaY;
  let tMaxZ = stepZ > 0 ? (z + 1 - origin.z) * tDeltaZ : (origin.z - z) * tDeltaZ;

  let normal = { x: 0, y: 0, z: 0 };
  let distance = 0;

  while (distance <= maxDistance) {
    const key = `${x},${y},${z}`;
    if (worldBlocks.has(key) && worldBlocks.get(key) !== BLOCK_TYPES.AIR) {
      return {
        hit: true,
        position: { x, y, z },
        normal,
        blockType: worldBlocks.get(key),
        distance,
      };
    }

    if (tMaxX < tMaxY) {
      if (tMaxX < tMaxZ) {
        x += stepX;
        distance = tMaxX;
        tMaxX += tDeltaX;
        normal = { x: -stepX, y: 0, z: 0 };
      } else {
        z += stepZ;
        distance = tMaxZ;
        tMaxZ += tDeltaZ;
        normal = { x: 0, y: 0, z: -stepZ };
      }
    } else {
      if (tMaxY < tMaxZ) {
        y += stepY;
        distance = tMaxY;
        tMaxY += tDeltaY;
        normal = { x: 0, y: -stepY, z: 0 };
      } else {
        z += stepZ;
        distance = tMaxZ;
        tMaxZ += tDeltaZ;
        normal = { x: 0, y: 0, z: -stepZ };
      }
    }
  }

  return { hit: false, position: null, normal: null, blockType: BLOCK_TYPES.AIR, distance };
}

// ============================================================================
// 2. HUD, STATS, RANKING & AUTH (Features 8 - 14)
// ============================================================================

export function calculateHearts(health, maxHealth = 20) {
  const hearts = [];
  const fullCount = Math.floor(health / 2);
  const hasHalf = health % 2 >= 1;
  const emptyCount = Math.floor((maxHealth - health) / 2);

  for (let i = 0; i < fullCount; i++) hearts.push('full');
  if (hasHalf) hearts.push('half');
  while (hearts.length < 10) hearts.push('empty');
  return hearts;
}

export function formatTimer(seconds) {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}

export const RANKED_FORMATS = new Set(['1v1', '2v2', '3v3', '4v4']);

export function calculateRankDelta(format, outcome, kills = 0, finalKills = 0, bedsBroken = 0) {
  if (!RANKED_FORMATS.has(format)) {
    return { isRanked: false, deltaRating: 0 };
  }

  let delta = 0;
  if (outcome === 'win') {
    delta = 25 + kills * 2 + finalKills * 5 + bedsBroken * 10;
  } else if (outcome === 'loss') {
    delta = -20 + kills * 1 + finalKills * 2;
  } else {
    // draw
    delta = 5 + kills * 1;
  }

  return { isRanked: true, deltaRating: delta };
}

export function getRankTier(rating) {
  if (rating < 1000) return 'Bronze';
  if (rating < 1500) return 'Silver';
  if (rating < 2000) return 'Gold';
  if (rating < 2500) return 'Diamond';
  return 'Master';
}

export function calculateLevelFromXP(totalXP) {
  // Progressive XP formula: level = floor(sqrt(totalXP / 100)) + 1
  const level = Math.max(1, Math.floor(Math.sqrt(totalXP / 100)) + 1);
  const currentLevelBaseXP = Math.pow(level - 1, 2) * 100;
  const nextLevelXP = Math.pow(level, 2) * 100;
  const progressXP = totalXP - currentLevelBaseXP;
  const neededXP = nextLevelXP - currentLevelBaseXP;
  return {
    level,
    totalXP,
    progressXP,
    neededXP,
    nextLevelXP,
  };
}

export function calculateMatchXP(outcome, kills = 0, finalKills = 0, bedsBroken = 0) {
  const baseXP = outcome === 'win' ? 100 : 30;
  return baseXP + kills * 15 + finalKills * 35 + bedsBroken * 50;
}

// Combat tagger & attribution
export class CombatTagger {
  constructor(timeoutMs = 10000) {
    this.timeoutMs = timeoutMs;
    this.tags = new Map(); // targetId -> { attackerId, timestamp }
  }

  tag(targetId, attackerId, now = Date.now()) {
    this.tags.set(targetId, { attackerId, timestamp: now });
  }

  getAttributedKiller(targetId, now = Date.now()) {
    if (!this.tags.has(targetId)) return null;
    const tag = this.tags.get(targetId);
    if (now - tag.timestamp <= this.timeoutMs) {
      return tag.attackerId;
    }
    this.tags.delete(targetId);
    return null;
  }

  clear(targetId) {
    this.tags.delete(targetId);
  }
}

// ============================================================================
// 3. MAPS, FORMATS, PROJECTILES & MUTATIONS (Features 15 - 26)
// ============================================================================

export class ProjectileSimulation {
  constructor({ position, velocity, gravity = -12.0, radius = 0.25, damage = 10, maxLifetime = 10 }) {
    this.position = new THREE.Vector3().copy(position);
    this.velocity = new THREE.Vector3().copy(velocity);
    this.gravity = gravity;
    this.radius = radius;
    this.damage = damage;
    this.lifetime = 0;
    this.maxLifetime = maxLifetime;
    this.isDead = false;
  }

  update(dt, worldBlocks = new Map()) {
    if (this.isDead) return null;
    this.lifetime += dt;
    if (this.lifetime >= this.maxLifetime) {
      this.isDead = true;
      return null;
    }

    this.velocity.y += this.gravity * dt;
    this.position.addScaledVector(this.velocity, dt);

    // Collision check against world blocks
    const bx = Math.floor(this.position.x);
    const by = Math.floor(this.position.y);
    const bz = Math.floor(this.position.z);
    const key = `${bx},${by},${bz}`;

    if (worldBlocks.has(key) && worldBlocks.get(key) !== BLOCK_TYPES.AIR) {
      this.isDead = true;
      return {
        type: 'hit_block',
        position: { x: bx, y: by, z: bz },
        damage: this.damage,
      };
    }
    return null;
  }
}

export const GUN_GAME_TIERS = [
  { tier: 1, name: 'Wooden Slingshot', damage: 3.5, speed: 20 },
  { tier: 2, name: 'Iron Crossbow', damage: 6.0, speed: 30 },
  { tier: 3, name: 'Fireball Launcher', damage: 10.0, speed: 25, explosive: true },
  { tier: 4, name: 'Plasma Blaster', damage: 15.0, speed: 45, explosive: true },
];

export class MutationHarness {
  constructor() {
    this.activeMutations = new Set();
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
}

// ============================================================================
// 4. NETWORKING, PACKETS, SYNC & LAN (Features 27 - 31)
// ============================================================================

export const PACKET_TYPES = {
  BLOCK_PLACE: 'BLOCK_PLACE',
  BLOCK_BREAK: 'BLOCK_BREAK',
  BED_DESTROY: 'BED_DESTROY',
  PLAYER_TRANSFORM: 'PLAYER_TRANSFORM',
  PLAYER_DAMAGE: 'PLAYER_DAMAGE',
  CHAT_MESSAGE: 'CHAT_MESSAGE',
};

export function validatePacket(packet) {
  if (!packet || typeof packet !== 'object') return false;
  if (!packet.type || typeof packet.type !== 'string') return false;
  if (!packet.sender || typeof packet.sender !== 'string') return false;
  if (typeof packet.timestamp !== 'number') return false;
  if (!packet.payload || typeof packet.payload !== 'object') return false;

  switch (packet.type) {
    case PACKET_TYPES.BLOCK_PLACE: {
      const p = packet.payload;
      return typeof p.x === 'number' && typeof p.y === 'number' && typeof p.z === 'number' && typeof p.blockType === 'number';
    }
    case PACKET_TYPES.BLOCK_BREAK: {
      const p = packet.payload;
      return typeof p.x === 'number' && typeof p.y === 'number' && typeof p.z === 'number';
    }
    case PACKET_TYPES.BED_DESTROY: {
      const p = packet.payload;
      return typeof p.team === 'string';
    }
    case PACKET_TYPES.PLAYER_TRANSFORM: {
      const p = packet.payload;
      return typeof p.x === 'number' && typeof p.y === 'number' && typeof p.z === 'number';
    }
    case PACKET_TYPES.PLAYER_DAMAGE: {
      const p = packet.payload;
      return typeof p.targetId === 'string' && typeof p.amount === 'number';
    }
    case PACKET_TYPES.CHAT_MESSAGE: {
      const p = packet.payload;
      return typeof p.text === 'string';
    }
    default:
      return false;
  }
}

export function validateLanAddress(ip, port) {
  // IPv4 simple regex and port check 1..65535
  const ipv4Pattern = /^(25[0-5]|2[0-4]\d|[01]?\d\d?)\.(25[0-5]|2[0-4]\d|[01]?\d\d?)\.(25[0-5]|2[0-4]\d|[01]?\d\d?)\.(25[0-5]|2[0-4]\d|[01]?\d\d?)$/;
  if (!ipv4Pattern.test(ip)) return false;
  if (!Number.isInteger(port) || port < 1 || port > 65535) return false;
  return true;
}
