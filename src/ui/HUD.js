import { BLOCK_PROPERTIES } from '../engine/VoxelWorld.js';

export class HUD {
  constructor(game) {
    this.game = game;

    // DOM Elements
    this.hudRoot = document.getElementById('hud');
    this.teamTracker = document.getElementById('hud-team-tracker');
    this.healthHearts = document.getElementById('health-hearts');
    this.armorName = document.getElementById('armor-name');
    
    this.ironVal = document.getElementById('res-iron-val');
    this.goldVal = document.getElementById('res-gold-val');
    this.diaVal = document.getElementById('res-dia-val');
    this.emeVal = document.getElementById('res-eme-val');

    this.statKills = document.getElementById('stat-kills');
    this.statFinalKills = document.getElementById('stat-final-kills');
    this.statBeds = document.getElementById('stat-beds');
    this.statTimer = document.getElementById('stat-timer');
    this.modeBadge = document.getElementById('sb-mode-badge');
    this.netStatus = document.getElementById('sb-net-status');

    this.announcement = document.getElementById('announcement-banner');
    this.announceTitle = document.getElementById('announce-title');
    this.announceSubtitle = document.getElementById('announce-subtitle');

    this.hotbarSlots = document.querySelectorAll('#hotbar .slot');

    this.announceTimeout = null;
    this.initHearts();
  }

  initHearts() {
    this.healthHearts.innerHTML = '';
    for (let i = 0; i < 10; i++) {
      const heart = document.createElement('span');
      heart.className = 'heart-icon';
      heart.innerText = '❤️';
      this.healthHearts.appendChild(heart);
    }
  }

  show() {
    this.hudRoot.classList.remove('hidden');
    document.getElementById('crosshair').classList.remove('hidden');
  }

  hide() {
    this.hudRoot.classList.add('hidden');
    document.getElementById('crosshair').classList.add('hidden');
  }

  update(player, matchTime = 0, currentMode = 'SOLO') {
    if (!player) return;

    // 1. Update Hearts (2 HP per full heart)
    const hearts = this.healthHearts.children;
    const health = Math.max(0, player.health);
    for (let i = 0; i < 10; i++) {
      const heartHP = (i + 1) * 2;
      if (health >= heartHP) {
        hearts[i].innerText = '❤️';
        hearts[i].classList.remove('lost');
      } else if (health >= heartHP - 1) {
        hearts[i].innerText = '💔';
        hearts[i].classList.remove('lost');
      } else {
        hearts[i].innerText = '🖤';
        hearts[i].classList.add('lost');
      }
    }

    // 2. Update Armor
    this.armorName.innerText = player.armorTier.toUpperCase();

    // 3. Update Resources
    this.ironVal.innerText = player.resources.iron || 0;
    this.goldVal.innerText = player.resources.gold || 0;
    this.diaVal.innerText = player.resources.diamond || 0;
    this.emeVal.innerText = player.resources.emerald || 0;

    // 4. Update Scoreboard
    this.statKills.innerText = this.game.matchStats.kills;
    this.statFinalKills.innerText = this.game.matchStats.finalKills;
    this.statBeds.innerText = this.game.matchStats.bedsBroken;
    this.modeBadge.innerText = currentMode.toUpperCase();

    const mins = Math.floor(matchTime / 60).toString().padStart(2, '0');
    const secs = Math.floor(matchTime % 60).toString().padStart(2, '0');
    this.statTimer.innerText = `${mins}:${secs}`;

    // 5. Update Hotbar Slots
    this.hotbarSlots.forEach((slotEl, idx) => {
      const item = player.inventory.getSlot(idx);
      const contentEl = slotEl.querySelector('.slot-content');
      contentEl.innerHTML = '';

      if (idx === player.activeSlotIndex) {
        slotEl.classList.add('active');
      } else {
        slotEl.classList.remove('active');
      }

      if (item) {
        const iconSpan = document.createElement('span');
        iconSpan.innerText = item.icon || '📦';
        contentEl.appendChild(iconSpan);

        if (item.count > 1) {
          const countSpan = document.createElement('span');
          countSpan.className = 'slot-count';
          countSpan.innerText = item.count;
          contentEl.appendChild(countSpan);
        }
      }
    });

    // 6. Update Team Tracker
    this.updateTeamTracker();
  }

  updateTeamTracker() {
    const teams = this.game.teamManager.getAllTeams();
    this.teamTracker.innerHTML = '';

    for (const team of teams) {
      const pill = document.createElement('div');
      pill.className = `team-pill ${team.bedAlive ? 'alive' : 'dead'}`;
      pill.innerHTML = `
        <span class="team-dot" style="background-color: ${team.colorHex}"></span>
        <span>${team.name.charAt(0)}:</span>
        <span class="team-status">${team.bedAlive ? '✓' : '✗'}</span>
      `;
      this.teamTracker.appendChild(pill);
    }
  }

  showAnnouncement(title, subtitle, duration = 3000) {
    if (this.announceTimeout) clearTimeout(this.announceTimeout);

    this.announceTitle.innerText = title;
    this.announceSubtitle.innerText = subtitle;
    this.announcement.classList.remove('hidden');

    this.announceTimeout = setTimeout(() => {
      this.announcement.classList.add('hidden');
    }, duration);
  }
}
