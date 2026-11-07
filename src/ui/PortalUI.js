/**
 * src/ui/PortalUI.js
 * Frontpage Portal & Profile Management UI.
 * Connects AuthManager, RankManager, LevelManager, and match format selection.
 */

export class PortalUI {
  constructor(gameManager) {
    this.gm = gameManager;
    this.auth = gameManager.authManager;
    this.rank = gameManager.rankManager;
    this.level = gameManager.levelManager;

    this.initDOM();
    this.initListeners();
    this.update();
  }

  initDOM() {
    // Profile elements
    this.avatarEl = document.getElementById('portal-avatar');
    this.usernameEl = document.getElementById('portal-username');
    this.providerBadgeEl = document.getElementById('portal-provider-badge');
    this.levelBadgeEl = document.getElementById('portal-level-badge');
    this.ratingValEl = document.getElementById('portal-rating-val');
    this.tierBadgeEl = document.getElementById('portal-tier-badge');
    this.xpBarFillEl = document.getElementById('portal-xp-bar-fill');
    this.xpLabelEl = document.getElementById('portal-xp-label');
    this.statWinsEl = document.getElementById('portal-stat-wins');
    this.statKillsEl = document.getElementById('portal-stat-kills');
    this.statBedsEl = document.getElementById('portal-stat-beds');

    // Auth buttons
    this.btnGithub = document.getElementById('btn-auth-github');
    this.btnGoogle = document.getElementById('btn-auth-google');
    this.btnLogout = document.getElementById('btn-auth-logout');
    this.authActionsEl = document.getElementById('portal-auth-actions');
    this.authLoggedEl = document.getElementById('portal-auth-logged');
  }

  initListeners() {
    // Auth provider sign-ins
    this.btnGithub?.addEventListener('click', () => {
      const profile = this.auth.loginWithGitHub();
      this.update();
      alert(`Signed in as ${profile.username} via GitHub OAuth!`);
    });

    this.btnGoogle?.addEventListener('click', () => {
      const profile = this.auth.loginWithGoogle();
      this.update();
      alert(`Signed in as ${profile.username} via Google OAuth!`);
    });

    this.btnLogout?.addEventListener('click', () => {
      this.auth.logout();
      this.update();
      alert('Signed out successfully. Switched to Guest mode.');
    });

    // Listen to background auth changes
    this.auth.onAuthChange(() => {
      this.update();
    });

    // Match format selectors
    document.getElementById('btn-format-1v1')?.addEventListener('click', () => {
      this.gm.startMatch('1v1', true, '1v1');
    });

    document.getElementById('btn-format-duos')?.addEventListener('click', () => {
      this.gm.startMatch('duos', true, '2v2');
    });

    document.getElementById('btn-format-trios')?.addEventListener('click', () => {
      this.gm.startMatch('trios', true, '3v3');
    });

    document.getElementById('btn-format-4v4')?.addEventListener('click', () => {
      this.gm.startMatch('4v4', true, '4v4');
    });

    document.getElementById('btn-format-solos')?.addEventListener('click', () => {
      this.gm.startMatch('solo', true, 'solo');
    });
  }

  update() {
    const profile = this.auth.getProfile();
    const rankProfile = this.rank.getProfile();
    const levelProgress = this.level.getProgress();
    const isAuthed = this.auth.isAuthenticated();

    if (this.usernameEl && profile) {
      this.usernameEl.innerText = profile.username;
    }

    if (this.avatarEl && profile) {
      this.avatarEl.src = profile.avatarUrl;
    }

    if (this.providerBadgeEl && profile) {
      const provider = profile.provider.toUpperCase();
      this.providerBadgeEl.innerText = provider;
      this.providerBadgeEl.className = `provider-badge provider-${profile.provider}`;
    }

    if (this.levelBadgeEl) {
      this.levelBadgeEl.innerText = `Lv. ${levelProgress.level}`;
    }

    if (this.ratingValEl) {
      this.ratingValEl.innerText = `${rankProfile.rating} RR`;
    }

    if (this.tierBadgeEl) {
      const tier = this.rank.getTierInfo();
      this.tierBadgeEl.innerText = `${tier.badge} ${tier.name}`;
      this.tierBadgeEl.style.color = tier.color;
    }

    if (this.xpBarFillEl) {
      this.xpBarFillEl.style.width = `${levelProgress.progressPercentage}%`;
    }

    if (this.xpLabelEl) {
      this.xpLabelEl.innerText = `${levelProgress.progressXP} / ${levelProgress.neededXP} XP`;
    }

    if (this.statWinsEl) {
      this.statWinsEl.innerText = rankProfile.rankedWins + this.level.wins;
    }

    if (this.statKillsEl) {
      this.statKillsEl.innerText = rankProfile.kills + this.level.totalKills;
    }

    if (this.statBedsEl) {
      this.statBedsEl.innerText = rankProfile.bedsBroken + this.level.totalBedsBroken;
    }

    // Toggle OAuth login buttons vs Logged-in state
    if (this.authActionsEl && this.authLoggedEl) {
      if (isAuthed) {
        this.authActionsEl.classList.add('hidden');
        this.authLoggedEl.classList.remove('hidden');
      } else {
        this.authActionsEl.classList.remove('hidden');
        this.authLoggedEl.classList.add('hidden');
      }
    }
  }
}
