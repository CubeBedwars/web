import { BLOCK_TYPES } from '../engine/VoxelWorld.js';

export const TEAMS = {
  RED: { id: 'red', name: 'Red', colorHex: '#ff3b30', colorNum: 0xff3b30, woolBlock: BLOCK_TYPES.WOOL_RED },
  BLUE: { id: 'blue', name: 'Blue', colorHex: '#007aff', colorNum: 0x007aff, woolBlock: BLOCK_TYPES.WOOL_BLUE },
  GREEN: { id: 'green', name: 'Green', colorHex: '#34c759', colorNum: 0x34c759, woolBlock: BLOCK_TYPES.WOOL_GREEN },
  YELLOW: { id: 'yellow', name: 'Yellow', colorHex: '#ffcc00', colorNum: 0xffcc00, woolBlock: BLOCK_TYPES.WOOL_YELLOW },
  AQUA: { id: 'aqua', name: 'Aqua', colorHex: '#5ac8fa', colorNum: 0x5ac8fa, woolBlock: BLOCK_TYPES.WOOL_AQUA },
  WHITE: { id: 'white', name: 'White', colorHex: '#f2f2f7', colorNum: 0xf2f2f7, woolBlock: BLOCK_TYPES.WOOL_WHITE },
  PINK: { id: 'pink', name: 'Pink', colorHex: '#ff2d55', colorNum: 0xff2d55, woolBlock: BLOCK_TYPES.WOOL_PINK },
  GRAY: { id: 'gray', name: 'Gray', colorHex: '#8e8e93', colorNum: 0x8e8e93, woolBlock: BLOCK_TYPES.WOOL_GRAY },
};

export class TeamManager {
  constructor() {
    this.teams = new Map(); // teamId -> TeamState
  }

  initTeams(activeTeamIds = ['red', 'blue', 'green', 'yellow']) {
    this.teams.clear();
    for (const id of activeTeamIds) {
      const def = Object.values(TEAMS).find(t => t.id === id);
      if (!def) continue;

      this.teams.set(id, {
        id,
        name: def.name,
        colorHex: def.colorHex,
        colorNum: def.colorNum,
        woolBlock: def.woolBlock,
        bedAlive: true,
        bedPos: null,
        spawnPos: null,
        players: [], // array of player entity references
        upgrades: {
          sharpness: false,
          protectionLevel: 0, // 0 to 4
          healPool: false,
          minerFatigueTrap: false,
          counterOffensiveTrap: false,
          hasteLevel: 0,
          dragonBuff: false,
        },
        forgeTier: 1, // 1 to 4
        diamonds: 0,
      });
    }
  }

  getTeam(id) {
    return this.teams.get(id) || null;
  }

  getAllTeams() {
    return Array.from(this.teams.values());
  }

  getActiveTeams() {
    return Array.from(this.teams.values()).filter(t => {
      // A team is active if its bed is alive OR it still has living players
      return t.bedAlive || t.players.some(p => p.isAlive);
    });
  }

  setBedPosition(teamId, x, y, z) {
    const t = this.getTeam(teamId);
    if (t) {
      t.bedPos = { x, y, z };
      t.bedAlive = true;
    }
  }

  setSpawnPosition(teamId, x, y, z) {
    const t = this.getTeam(teamId);
    if (t) {
      t.spawnPos = { x, y, z };
    }
  }

  destroyBed(teamId, breakerName = 'Someone') {
    const t = this.getTeam(teamId);
    if (t && t.bedAlive) {
      t.bedAlive = false;
      return {
        destroyed: true,
        team: t,
        breaker: breakerName,
      };
    }
    return { destroyed: false };
  }

  isTeamEliminated(teamId) {
    const t = this.getTeam(teamId);
    if (!t) return true;
    if (t.bedAlive) return false;
    return !t.players.some(p => p.isAlive);
  }
}
