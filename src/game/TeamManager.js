import { BLOCK_TYPES } from '../engine/VoxelWorld.js';

export const TEAM_PALETTE = {
  red: { name: 'Red', hex: 0xef4444, woolType: BLOCK_TYPES.WOOL_RED },
  blue: { name: 'Blue', hex: 0x3b82f6, woolType: BLOCK_TYPES.WOOL_BLUE },
  green: { name: 'Green', hex: 0x22c55e, woolType: BLOCK_TYPES.WOOL_GREEN },
  yellow: { name: 'Yellow', hex: 0xeab308, woolType: BLOCK_TYPES.WOOL_YELLOW },
  aqua: { name: 'Aqua', hex: 0x06b6d4, woolType: BLOCK_TYPES.WOOL_AQUA },
  white: { name: 'White', hex: 0xf8fafc, woolType: BLOCK_TYPES.WOOL_WHITE },
  pink: { name: 'Pink', hex: 0xec4899, woolType: BLOCK_TYPES.WOOL_PINK },
  gray: { name: 'Gray', hex: 0x6b7280, woolType: BLOCK_TYPES.WOOL_GRAY },
};

export class TeamManager {
  constructor(activeTeams = ['red', 'blue', 'green', 'yellow']) {
    this.teams = {};
    this.initTeams(activeTeams);
  }

  initTeams(teamsList = ['red', 'blue', 'green', 'yellow']) {
    this.teams = {};
    for (const teamKey of teamsList) {
      const info = TEAM_PALETTE[teamKey] || { name: teamKey.toUpperCase(), hex: 0xffffff, woolType: BLOCK_TYPES.WOOL_WHITE };
      this.teams[teamKey] = {
        name: info.name,
        hex: info.hex,
        woolType: info.woolType,
        hasBed: true,
        players: [],
        upgrades: this.createDefaultUpgrades(),
      };
    }
  }

  createDefaultUpgrades() {
    return {
      sharpness: 0,
      protection: 0,
      haste: 0,
      forgeTier: 1,
      healPool: false,
      alarmTrap: false,
      minerFatigueTrap: false,
    };
  }

  destroyBed(teamName) {
    if (this.teams[teamName]) {
      this.teams[teamName].hasBed = false;
      return true;
    }
    return false;
  }

  hasBed(teamName) {
    return this.teams[teamName] ? this.teams[teamName].hasBed : false;
  }

  isTeamEliminated(teamName) {
    const team = this.teams[teamName];
    if (!team) return true;
    if (!team.hasBed) {
      if (team.players.length === 0) return true;
      return team.players.every(p => p.isDead || p.isFinalDead);
    }
    return false;
  }

  getAliveTeams() {
    return Object.keys(this.teams).filter(t => !this.isTeamEliminated(t));
  }

  getTeam(teamName) {
    return this.teams[teamName] || null;
  }

  registerPlayer(player) {
    if (this.teams[player.team]) {
      if (!this.teams[player.team].players.includes(player)) {
        this.teams[player.team].players.push(player);
      }
    }
  }
}
