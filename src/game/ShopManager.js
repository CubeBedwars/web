import { BLOCK_TYPES } from '../engine/VoxelWorld.js';

export const SHOP_CATEGORIES = [
  { id: 'blocks', name: 'Blocks' },
  { id: 'weapons', name: 'Weapons' },
  { id: 'armor', name: 'Armor' },
  { id: 'tools', name: 'Tools' },
  { id: 'ranged', name: 'Ranged' },
  { id: 'utility', name: 'Utility' },
];

export const SHOP_ITEMS = [
  // --- BLOCKS ---
  {
    id: 'wool',
    name: 'Team Wool',
    category: 'blocks',
    currency: 'iron',
    cost: 4,
    count: 16,
    icon: '🧶',
    desc: 'Basic building block. Colored to your team.',
    itemType: 'block',
    blockType: BLOCK_TYPES.WOOL_RED, // adjusted per player team
  },
  {
    id: 'wood',
    name: 'Oak Wood',
    category: 'blocks',
    currency: 'gold',
    cost: 4,
    count: 16,
    icon: '🪵',
    desc: 'Axe required to break quickly. Good bed defense.',
    itemType: 'block',
    blockType: BLOCK_TYPES.WOOD,
  },
  {
    id: 'end_stone',
    name: 'End Stone',
    category: 'blocks',
    currency: 'iron',
    cost: 24,
    count: 12,
    icon: '🪨',
    desc: 'High blast resistance. Pickaxe required.',
    itemType: 'block',
    blockType: BLOCK_TYPES.END_STONE,
  },
  {
    id: 'glass',
    name: 'Blast-Proof Glass',
    category: 'blocks',
    currency: 'iron',
    cost: 12,
    count: 4,
    icon: '🪟',
    desc: 'Immune to TNT and fireball explosions!',
    itemType: 'block',
    blockType: BLOCK_TYPES.GLASS,
  },
  {
    id: 'obsidian',
    name: 'Obsidian',
    category: 'blocks',
    currency: 'emerald',
    cost: 4,
    count: 4,
    icon: '⬛',
    desc: 'Ultimate defense. Requires diamond pickaxe to break.',
    itemType: 'block',
    blockType: BLOCK_TYPES.OBSIDIAN,
  },
  {
    id: 'trampoline',
    name: 'Trampoline Block',
    category: 'blocks',
    currency: 'iron',
    cost: 8,
    count: 4,
    icon: '🟣',
    desc: 'Bounces players high into the air upon landing.',
    itemType: 'block',
    blockType: BLOCK_TYPES.TRAMPOLINE,
  },
  {
    id: 'lucky_block',
    name: 'Lucky Block',
    category: 'blocks',
    currency: 'iron',
    cost: 16,
    count: 1,
    icon: '🍀',
    desc: 'Break to trigger random loot, traps, or wild surprises!',
    itemType: 'block',
    blockType: BLOCK_TYPES.LUCKY_BLOCK,
  },

  // --- WEAPONS ---
  {
    id: 'stone_sword',
    name: 'Stone Sword',
    category: 'weapons',
    currency: 'iron',
    cost: 10,
    count: 1,
    icon: '🗡️',
    desc: '+5 Damage. Reliable early weapon.',
    itemType: 'weapon',
    damage: 5,
  },
  {
    id: 'iron_sword',
    name: 'Iron Sword',
    category: 'weapons',
    currency: 'gold',
    cost: 7,
    count: 1,
    icon: '⚔️',
    desc: '+6 Damage. Standard battle weapon.',
    itemType: 'weapon',
    damage: 6,
  },
  {
    id: 'diamond_sword',
    name: 'Diamond Sword',
    category: 'weapons',
    currency: 'emerald',
    cost: 4,
    count: 1,
    icon: '💠',
    desc: '+7.5 Damage. Deadly forged blade.',
    itemType: 'weapon',
    damage: 7.5,
  },
  {
    id: 'kb_stick',
    name: 'Knockback Stick',
    category: 'weapons',
    currency: 'gold',
    cost: 5,
    count: 1,
    icon: '🥢',
    desc: 'Sends opponents flying into the void!',
    itemType: 'weapon',
    knockback: 18.0,
    damage: 2,
  },

  // --- ARMOR ---
  {
    id: 'armor_chain',
    name: 'Chainmail Armor',
    category: 'armor',
    currency: 'iron',
    cost: 40,
    count: 1,
    icon: '⛓️',
    desc: 'Permanent upgrade. Reduces damage by 20%.',
    itemType: 'armor',
    tier: 'chainmail',
    defense: 20,
  },
  {
    id: 'armor_iron',
    name: 'Iron Armor',
    category: 'armor',
    currency: 'gold',
    cost: 12,
    count: 1,
    icon: '🛡️',
    desc: 'Permanent upgrade. Reduces damage by 40%.',
    itemType: 'armor',
    tier: 'iron',
    defense: 40,
  },
  {
    id: 'armor_diamond',
    name: 'Diamond Armor',
    category: 'armor',
    currency: 'emerald',
    cost: 6,
    count: 1,
    icon: '💎',
    desc: 'Permanent upgrade. Reduces damage by 60%.',
    itemType: 'armor',
    tier: 'diamond',
    defense: 60,
  },

  // --- TOOLS ---
  {
    id: 'shears',
    name: 'Permanent Shears',
    category: 'tools',
    currency: 'iron',
    cost: 20,
    count: 1,
    icon: '✂️',
    desc: 'Cuts wool blocks almost instantly.',
    itemType: 'tool',
    toolType: 'shears',
  },
  {
    id: 'pickaxe_wood',
    name: 'Wooden Pickaxe',
    category: 'tools',
    currency: 'iron',
    cost: 10,
    count: 1,
    icon: '⛏️',
    desc: 'Breaks stone and endstone blocks.',
    itemType: 'tool',
    toolType: 'pickaxe',
  },
  {
    id: 'axe_wood',
    name: 'Wooden Axe',
    category: 'tools',
    currency: 'iron',
    cost: 10,
    count: 1,
    icon: '🪓',
    desc: 'Breaks wooden defenses quickly.',
    itemType: 'tool',
    toolType: 'axe',
  },

  // --- RANGED ---
  {
    id: 'bow',
    name: 'Standard Bow',
    category: 'ranged',
    currency: 'gold',
    cost: 12,
    count: 1,
    icon: '🏹',
    desc: 'Long-range weapon for sniping bridge builders.',
    itemType: 'bow',
  },
  {
    id: 'arrow',
    name: 'Arrows (x8)',
    category: 'ranged',
    currency: 'gold',
    cost: 2,
    count: 8,
    icon: '🎯',
    desc: 'Ammunition for your bow.',
    itemType: 'arrow',
  },

  // --- UTILITY ---
  {
    id: 'golden_apple',
    name: 'Golden Apple',
    category: 'utility',
    currency: 'gold',
    cost: 3,
    count: 1,
    icon: '🍏',
    desc: 'Instantly restores 4 hearts + gives 10s Absorption.',
    itemType: 'consumable',
    effect: 'gapple',
  },
  {
    id: 'fireball',
    name: 'Fireball',
    category: 'utility',
    currency: 'iron',
    cost: 40,
    count: 1,
    icon: '🔥',
    desc: 'Right-click to launch explosive fireball with knockback!',
    itemType: 'projectile',
    projectileType: 'fireball',
  },
  {
    id: 'tnt',
    name: 'TNT',
    category: 'utility',
    currency: 'gold',
    cost: 4,
    count: 1,
    icon: '🧨',
    desc: 'Explodes after 3 seconds, tearing through defenses.',
    itemType: 'block',
    blockType: BLOCK_TYPES.TNT_BLOCK,
  },
  {
    id: 'ender_pearl',
    name: 'Ender Pearl',
    category: 'utility',
    currency: 'emerald',
    cost: 4,
    count: 1,
    icon: '🔮',
    desc: 'Teleports you to wherever it impacts!',
    itemType: 'projectile',
    projectileType: 'pearl',
  },
  {
    id: 'grappling_hook',
    name: 'Grappling Hook',
    category: 'utility',
    currency: 'emerald',
    cost: 2,
    count: 1,
    icon: '🪝',
    desc: 'Launch a hook to swing across sky voids!',
    itemType: 'grapple',
  },
  {
    id: 'rocket_launcher',
    name: 'Voxel Rocket Launcher',
    category: 'utility',
    currency: 'emerald',
    cost: 6,
    count: 1,
    icon: '🚀',
    desc: 'Fires high-velocity explosive rockets.',
    itemType: 'projectile',
    projectileType: 'rocket',
  },
];

export class ShopManager {
  static getItemsByCategory(category) {
    return SHOP_ITEMS.filter(item => item.category === category);
  }

  static getItemById(id) {
    return SHOP_ITEMS.find(item => item.id === id);
  }

  static canAfford(player, item) {
    const cur = item.currency;
    return player.resources[cur] >= item.cost;
  }

  static purchase(player, item) {
    if (!this.canAfford(player, item)) {
      return { success: false, reason: 'Not enough resources!' };
    }

    player.resources[item.currency] -= item.cost;

    // Apply purchase effect
    if (item.itemType === 'armor') {
      player.armorTier = item.tier;
      player.armorDefense = item.defense;
    } else {
      player.inventory.addItem(item);
    }

    return { success: true, item };
  }
}
