export class TeamManager {
  constructor() {
    this.teams = {
      red: { name: 'Red', hex: 0xef4444, hasBed: true, players: [], upgrades: this.createDefaultUpgrades() },
      blue: { name: 'Blue', hex: 0x3b82f6, hasBed: true, players: [], upgrades: this.createDefaultUpgrades() },
      green: { name: 'Green', hex: 0x22c55e, hasBed: true, players: [], upgrades: this.createDefaultUpgrades() },
      yellow: { name: 'Yellow', hex: 0xeab308, hasBed: true, players: [], upgrades: this.createDefaultUpgrades() },
    };
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
    return !team.hasBed && team.players.every(p => p.isDead || p.isFinalDead);
  }

  getAliveTeams() {
    return Object.keys(this.teams).filter(t => !this.isTeamEliminated(t));
  }
}
