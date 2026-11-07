/**
 * src/stats/LevelManager.js
 * Progressive Player Level & XP Progression System.
 * Computes progressive player level derived from match wins, kills, final kills, and beds broken.
 * XP is awarded across ALL matches (both ranked and unranked).
 */

export class LevelManager {
  constructor(storageKey = 'vw_level_profile') {
    this.storageKey = storageKey;
    this.totalXP = 0;
    this.level = 1;
    this.totalMatches = 0;
    this.wins = 0;
    this.losses = 0;
    this.totalKills = 0;
    this.totalFinalKills = 0;
    this.totalBedsBroken = 0;
    this.load();
  }

  static calculateLevelFromXP(totalXP) {
    const xp = Math.max(0, totalXP || 0);
    const level = Math.max(1, Math.floor(Math.sqrt(xp / 100)) + 1);
    const currentLevelBaseXP = Math.pow(level - 1, 2) * 100;
    const nextLevelXP = Math.pow(level, 2) * 100;
    const progressXP = xp - currentLevelBaseXP;
    const neededXP = nextLevelXP - currentLevelBaseXP;

    return {
      level,
      totalXP: xp,
      currentLevelBaseXP,
      progressXP,
      neededXP,
      nextLevelXP,
      progressPercentage: neededXP > 0 ? Math.min(100, Math.floor((progressXP / neededXP) * 100)) : 100,
    };
  }

  static calculateMatchXP(outcome, kills = 0, finalKills = 0, bedsBroken = 0) {
    const baseXP = outcome === 'win' ? 100 : 30;
    return baseXP + (kills * 15) + (finalKills * 35) + (bedsBroken * 50);
  }

  recordMatch({ outcome, kills = 0, finalKills = 0, bedsBroken = 0 }) {
    const xpEarned = LevelManager.calculateMatchXP(outcome, kills, finalKills, bedsBroken);
    const prevXP = this.totalXP;
    const prevLevel = this.level;

    this.totalXP += xpEarned;
    this.totalMatches++;
    if (outcome === 'win') this.wins++;
    else if (outcome === 'loss') this.losses++;

    this.totalKills += kills;
    this.totalFinalKills += finalKills;
    this.totalBedsBroken += bedsBroken;

    const levelInfo = LevelManager.calculateLevelFromXP(this.totalXP);
    this.level = levelInfo.level;
    const leveledUp = this.level > prevLevel;

    this.save();

    return {
      xpEarned,
      prevXP,
      prevLevel,
      newLevel: this.level,
      leveledUp,
      ...levelInfo,
    };
  }

  getProgress() {
    return LevelManager.calculateLevelFromXP(this.totalXP);
  }

  getProfile() {
    const progress = this.getProgress();
    return {
      ...progress,
      totalMatches: this.totalMatches,
      wins: this.wins,
      losses: this.losses,
      kills: this.totalKills,
      finalKills: this.totalFinalKills,
      bedsBroken: this.totalBedsBroken,
    };
  }

  save() {
    try {
      if (typeof globalThis.localStorage !== 'undefined') {
        const payload = {
          totalXP: this.totalXP,
          level: this.level,
          totalMatches: this.totalMatches,
          wins: this.wins,
          losses: this.losses,
          totalKills: this.totalKills,
          totalFinalKills: this.totalFinalKills,
          totalBedsBroken: this.totalBedsBroken,
        };
        globalThis.localStorage.setItem(this.storageKey, JSON.stringify(payload));
      }
    } catch {
      // Storage unavailable
    }
  }

  load() {
    try {
      if (typeof globalThis.localStorage !== 'undefined') {
        const raw = globalThis.localStorage.getItem(this.storageKey);
        if (raw) {
          const data = JSON.parse(raw);
          if (typeof data.totalXP === 'number') this.totalXP = data.totalXP;
          if (typeof data.totalMatches === 'number') this.totalMatches = data.totalMatches;
          if (typeof data.wins === 'number') this.wins = data.wins;
          if (typeof data.losses === 'number') this.losses = data.losses;
          if (typeof data.totalKills === 'number') this.totalKills = data.totalKills;
          if (typeof data.totalFinalKills === 'number') this.totalFinalKills = data.totalFinalKills;
          if (typeof data.totalBedsBroken === 'number') this.totalBedsBroken = data.totalBedsBroken;

          const info = LevelManager.calculateLevelFromXP(this.totalXP);
          this.level = info.level;
        }
      }
    } catch {
      // Fallback
    }
  }

  reset() {
    this.totalXP = 0;
    this.level = 1;
    this.totalMatches = 0;
    this.wins = 0;
    this.losses = 0;
    this.totalKills = 0;
    this.totalFinalKills = 0;
    this.totalBedsBroken = 0;
    this.save();
  }
}
