export const TEAM_UPGRADES = [
  {
    id: 'sharpness',
    name: 'Sharpened Swords',
    cost: 4,
    icon: '⚔️',
    desc: 'All team swords deal +1.5 extra damage permanently!',
    type: 'toggle',
  },
  {
    id: 'protection',
    name: 'Reinforced Armor',
    tiers: [
      { level: 1, cost: 2, desc: 'Protection I: +10% damage reduction' },
      { level: 2, cost: 4, desc: 'Protection II: +20% damage reduction' },
      { level: 3, cost: 8, desc: 'Protection III: +30% damage reduction' },
      { level: 4, cost: 16, desc: 'Protection IV: +40% damage reduction' },
    ],
    icon: '🛡️',
    type: 'tiered',
  },
  {
    id: 'heal_pool',
    name: 'Heal Pool',
    cost: 1,
    icon: '💖',
    desc: 'Grants continuous Regeneration to teammates near your island bed.',
    type: 'toggle',
  },
  {
    id: 'miner_fatigue_trap',
    name: 'Miner Fatigue Trap',
    cost: 1,
    icon: '⛏️',
    desc: 'Causes enemies attempting to mine your bed to dig 70% slower for 10s!',
    type: 'trap',
  },
  {
    id: 'counter_trap',
    name: 'Counter-Offensive Trap',
    cost: 1,
    icon: '⚡',
    desc: 'Grants Speed II and Jump Boost to teammates when an intruder approaches!',
    type: 'trap',
  },
  {
    id: 'dragon_buff',
    name: 'Dragon Buff',
    cost: 5,
    icon: '🐲',
    desc: 'Spawn an allied ender dragon during the Sudden Death phase.',
    type: 'toggle',
  },
];

export class UpgradesManager {
  static purchaseUpgrade(team, upgradeId, player) {
    const upgrade = TEAM_UPGRADES.find(u => u.id === upgradeId);
    if (!upgrade) return { success: false, reason: 'Upgrade not found' };

    let cost = 0;
    if (upgrade.type === 'tiered') {
      const currentLevel = team.upgrades.protectionLevel || 0;
      if (currentLevel >= upgrade.tiers.length) {
        return { success: false, reason: 'Max level reached!' };
      }
      cost = upgrade.tiers[currentLevel].cost;
    } else {
      cost = upgrade.cost;
    }

    if (player.resources.diamond < cost) {
      return { success: false, reason: 'Need more diamonds!' };
    }

    player.resources.diamond -= cost;

    // Apply upgrade to team
    if (upgradeId === 'sharpness') {
      team.upgrades.sharpness = true;
    } else if (upgradeId === 'protection') {
      team.upgrades.protectionLevel = (team.upgrades.protectionLevel || 0) + 1;
    } else if (upgradeId === 'heal_pool') {
      team.upgrades.healPool = true;
    } else if (upgradeId === 'miner_fatigue_trap') {
      team.upgrades.minerFatigueTrap = true;
    } else if (upgradeId === 'counter_trap') {
      team.upgrades.counterOffensiveTrap = true;
    } else if (upgradeId === 'dragon_buff') {
      team.upgrades.dragonBuff = true;
    }

    return { success: true, upgradeId, team };
  }
}
