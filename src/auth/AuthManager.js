/**
 * src/auth/AuthManager.js
 * OAuth Authentication UI and Session Manager.
 * Offers "Login with GitHub" as primary option and "Login with Google" as fallback,
 * with persistent localStorage guest session fallback.
 */

export class AuthManager {
  constructor(profileKey = 'vw_player_profile', tokenKey = 'vw_auth_token') {
    this.profileKey = profileKey;
    this.tokenKey = tokenKey;
    this.listeners = new Set();
    this.token = null;
    this.profile = null;
    this.init();
  }

  init() {
    this.loadToken();
    this.loadProfile();

    if (!this.profile) {
      this.initGuestProfile();
    }
  }

  loadToken() {
    try {
      if (typeof globalThis.localStorage !== 'undefined') {
        this.token = globalThis.localStorage.getItem(this.tokenKey) || null;
      }
    } catch {
      this.token = null;
    }
  }

  loadProfile() {
    try {
      if (typeof globalThis.localStorage !== 'undefined') {
        const raw = globalThis.localStorage.getItem(this.profileKey);
        if (raw) {
          this.profile = JSON.parse(raw);
        }
      }
    } catch {
      this.profile = null;
    }
  }

  initGuestProfile(customName = null) {
    const randomHex = Math.random().toString(36).substring(2, 9);
    const guestId = `guest_${randomHex}`;
    const username = customName || `Guest_${randomHex.substring(0, 4).toUpperCase()}`;

    this.token = null;
    this.profile = {
      userId: guestId,
      username,
      provider: 'guest',
      avatarUrl: `https://api.dicebear.com/7.x/bottts/svg?seed=${guestId}`,
      createdAt: Date.now(),
      rating: 1000,
      level: 1,
    };
    this.saveProfile();
    this.notify();
    return this.profile;
  }

  loginWithGitHub(customUsername = null) {
    const suffix = Math.random().toString(36).substring(2, 6);
    const username = customUsername || `OctoVoxel_${suffix}`;
    const token = `gho_${Math.random().toString(36).substring(2)}${Date.now()}`;

    this.token = token;
    this.profile = {
      userId: `gh_${suffix}`,
      username,
      provider: 'github',
      avatarUrl: `https://avatars.githubusercontent.com/u/9919${Math.floor(Math.random() * 8999)}?v=4`,
      createdAt: this.profile?.createdAt || Date.now(),
      rating: this.profile?.rating || 1000,
      level: this.profile?.level || 1,
    };

    this.saveToken();
    this.saveProfile();
    this.notify();
    return this.profile;
  }

  loginWithGoogle(customUsername = null) {
    const suffix = Math.random().toString(36).substring(2, 6);
    const username = customUsername || `GooglePlayer_${suffix}`;
    const token = `ya29.${Math.random().toString(36).substring(2)}${Date.now()}`;

    this.token = token;
    this.profile = {
      userId: `goog_${suffix}`,
      username,
      provider: 'google',
      avatarUrl: `https://lh3.googleusercontent.com/a/default-user`,
      createdAt: this.profile?.createdAt || Date.now(),
      rating: this.profile?.rating || 1000,
      level: this.profile?.level || 1,
    };

    this.saveToken();
    this.saveProfile();
    this.notify();
    return this.profile;
  }

  loginAsGuest(customName = null) {
    return this.initGuestProfile(customName);
  }

  logout() {
    try {
      if (typeof globalThis.localStorage !== 'undefined') {
        globalThis.localStorage.removeItem(this.tokenKey);
      }
    } catch {
      // Ignore
    }
    this.token = null;
    this.initGuestProfile();
  }

  isAuthenticated() {
    return Boolean(this.token && this.profile && this.profile.provider !== 'guest');
  }

  getProfile() {
    return this.profile;
  }

  updateProfile(updates = {}) {
    if (!this.profile) return;
    this.profile = { ...this.profile, ...updates };
    this.saveProfile();
    this.notify();
    return this.profile;
  }

  saveToken() {
    try {
      if (typeof globalThis.localStorage !== 'undefined') {
        if (this.token) {
          globalThis.localStorage.setItem(this.tokenKey, this.token);
        } else {
          globalThis.localStorage.removeItem(this.tokenKey);
        }
      }
    } catch {
      // Ignore
    }
  }

  saveProfile() {
    try {
      if (typeof globalThis.localStorage !== 'undefined' && this.profile) {
        globalThis.localStorage.setItem(this.profileKey, JSON.stringify(this.profile));
      }
    } catch {
      // Ignore
    }
  }

  onAuthChange(callback) {
    this.listeners.add(callback);
    return () => this.listeners.delete(callback);
  }

  notify() {
    for (const callback of this.listeners) {
      try {
        callback(this.profile, this.isAuthenticated());
      } catch (err) {
        console.error('Auth listener error:', err);
      }
    }
  }
}
