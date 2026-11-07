/**
 * src/stats/RankManager.js
 * bloxd.io-inspired numerical rank rating (MMR) system.
 * CRITICAL REQUIREMENT: Rank rating updates are applied EXCLUSIVELY to official 2-team matches
 * ('1v1', '2v2', '3v3', '4v4'). Multi-team formats (e.g. 4-team or 8-team solo) must NOT modify the rank rating.
 */

export const RANKED_FORMATS = new Set(['1v1', '2v2', '3v3', '4v4']);

export const RANK_TIERS = [
  { name: 'Bronze', minRating: 0, maxRating: 999, color: '#cd7f32', badge: '🥉' },
  { name: 'Silver', minRating: 1000, maxRating: 1499, color: '#94a3b8', badge: '🥈' },
  { name: 'Gold', minRating: 1500, maxRating: 1999, color: '#f59e0b', badge: '🥇' },
  { name: 'Diamond', minRating: 2000, maxRating: 2499, color: '#06b6d4', badge: '💎' },
  { name: 'Master', minRating: 2500, maxRating: Infinity, color: '#ec4899', badge: '👑' },
];

export class RankManager {
  constructor(storageKey = 'vw_rank_profile') {
    this.storageKey = storageKey;
    this.rating = 1000;
    this.peakRating = 1000;
    this.rankedMatches = 0;
    this.rankedWins = 0;
    this.rankedLosses = 0;
    this.rankedKills = 0;
    this.rankedFinalKills = 0;
    this.rankedBedsBroken = 0;
    this.load();
  }

  static isRankedFormat(format) {
    if (!format) return false;
    const clean = format.toLowerCase().trim();
    return RANKED_FORMATS.has(clean);
  }

  static getRankTier(rating) {
    const r = Math.max(0, rating);
    if (r < 1000) return 'Bronze';
    if (r < 1500) return 'Silver';
    if (r < 2000) return 'Gold';
    if (r < 2500) return 'Diamond';
    return 'Master';
  }

  static calculateDelta(format, outcome, kills = 0, finalKills = 0, bedsBroken = 0) {
    if (!RankManager.isRankedFormat(format)) {
      return { isRanked: false, deltaRating: 0 };
    }

    let delta = 0;
    if (outcome === 'win') {
      delta = 25 + (kills * 2) + (finalKills * 5) + (bedsBroken * 10);
    } else if (outcome === 'loss') {
      delta = -20 + (kills * 1) + (finalKills * 2);
    } else {
      // Draw / tie
      delta = 5 + (kills * 1);
    }

    return { isRanked: true, deltaRating: delta };
  }

  recordMatch({ format, outcome, kills = 0, finalKills = 0, bedsBroken = 0 }) {
    const deltaInfo = RankManager.calculateDelta(format, outcome, kills, finalKills, bedsBroken);

    if (!deltaInfo.isRanked) {
      return {
        isRanked: false,
        deltaRating: 0,
        rating: this.rating,
        tier: this.getTier(),
      };
    }

    const prevRating = this.rating;
    this.rating = Math.max(0, this.rating + deltaInfo.deltaRating);
    this.peakRating = Math.max(this.peakRating, this.rating);

    this.rankedMatches++;
    if (outcome === 'win') this.rankedWins++;
    else if (outcome === 'loss') this.rankedLosses++;

    this.rankedKills += kills;
    this.rankedFinalKills += finalKills;
    this.rankedBedsBroken += bedsBroken;

    this.save();

    return {
      isRanked: true,
      deltaRating: deltaInfo.deltaRating,
      prevRating,
      rating: this.rating,
      tier: this.getTier(),
    };
  }

  getTier() {
    return RankManager.getRankTier(this.rating);
  }

  getTierInfo() {
    const tierName = this.getTier();
    return RANK_TIERS.find(t => t.name === tierName) || RANK_TIERS[0];
  }

  getProfile() {
    return {
      rating: this.rating,
      peakRating: this.peakRating,
      tier: this.getTier(),
      rankedMatches: this.rankedMatches,
      rankedWins: this.rankedWins,
      rankedLosses: this.rankedLosses,
      winRate: this.rankedMatches > 0 ? (this.rankedWins / this.rankedMatches) : 0,
      kills: this.rankedKills,
      finalKills: this.rankedFinalKills,
      bedsBroken: this.rankedBedsBroken,
    };
  }

  save() {
    try {
      if (typeof globalThis.localStorage !== 'undefined') {
        const payload = {
          rating: this.rating,
          peakRating: this.peakRating,
          rankedMatches: this.rankedMatches,
          rankedWins: this.rankedWins,
          rankedLosses: this.rankedLosses,
          rankedKills: this.rankedKills,
          rankedFinalKills: this.rankedFinalKills,
          rankedBedsBroken: this.rankedBedsBroken,
        };
        globalThis.localStorage.setItem(this.storageKey, JSON.stringify(payload));
      }
    } catch {
      // Storage unavailable or disabled
    }
  }

  load() {
    try {
      if (typeof globalThis.localStorage !== 'undefined') {
        const raw = globalThis.localStorage.getItem(this.storageKey);
        if (raw) {
          const data = JSON.parse(raw);
          if (typeof data.rating === 'number') this.rating = data.rating;
          if (typeof data.peakRating === 'number') this.peakRating = data.peakRating;
          if (typeof data.rankedMatches === 'number') this.rankedMatches = data.rankedMatches;
          if (typeof data.rankedWins === 'number') this.rankedWins = data.rankedWins;
          if (typeof data.rankedLosses === 'number') this.rankedLosses = data.rankedLosses;
          if (typeof data.rankedKills === 'number') this.rankedKills = data.rankedKills;
          if (typeof data.rankedFinalKills === 'number') this.rankedFinalKills = data.rankedFinalKills;
          if (typeof data.rankedBedsBroken === 'number') this.rankedBedsBroken = data.rankedBedsBroken;
        }
      }
    } catch {
      // Ignore parse errors, fallback to defaults
    }
  }

  reset() {
    this.rating = 1000;
    this.peakRating = 1000;
    this.rankedMatches = 0;
    this.rankedWins = 0;
    this.rankedLosses = 0;
    this.rankedKills = 0;
    this.rankedFinalKills = 0;
    this.rankedBedsBroken = 0;
    this.save();
  }
}
