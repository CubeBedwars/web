import { SHOP_ITEMS, TEAM_UPGRADES } from '../game/ShopManager.js';

export class HUD {
  constructor(gameManager) {
    this.gm = gameManager;

    // DOM Elements
    this.hudEl = document.getElementById('hud');
    this.bedTrackerEl = document.getElementById('hud-team-tracker');
    this.resIronEl = document.getElementById('res-iron-val');
    this.resGoldEl = document.getElementById('res-gold-val');
    this.resDiaEl = document.getElementById('res-dia-val');
    this.resEmeEl = document.getElementById('res-eme-val');
    this.healthHeartsEl = document.getElementById('health-hearts');
    this.armorNameEl = document.getElementById('armor-name');
    this.hotbarEl = document.getElementById('hotbar');

    // Stats
    this.statKillsEl = document.getElementById('stat-kills');
    this.statFinalEl = document.getElementById('stat-final-kills');
    this.statBedsEl = document.getElementById('stat-beds');
    this.statTimerEl = document.getElementById('stat-timer');

    // Modals
    this.shopModal = document.getElementById('shop-modal');
    this.upgradesModal = document.getElementById('upgrades-modal');
    this.respawnOverlay = document.getElementById('respawn-overlay');
    this.respawnTimerEl = document.getElementById('respawn-timer-val');
    this.gameoverOverlay = document.getElementById('gameover-overlay');
    this.announceBanner = document.getElementById('announcement-banner');
    this.announceTitle = document.getElementById('announce-title');
    this.announceSubtitle = document.getElementById('announce-subtitle');

    this.initHotbarSlots();
    this.initShop();
    this.initUpgrades();
  }

  show() {
    this.hudEl?.classList.remove('hidden');
    document.getElementById('crosshair')?.classList.remove('hidden');
  }

  hide() {
    this.hudEl?.classList.add('hidden');
    document.getElementById('crosshair')?.classList.add('hidden');
  }

  initHotbarSlots() {
    if (!this.hotbarEl) return;
    this.hotbarEl.innerHTML = '';
    for (let i = 0; i < 9; i++) {
      const slot = document.createElement('div');
      slot.className = `slot ${i === 0 ? 'active' : ''}`;
      slot.dataset.index = i;
      slot.innerHTML = `<span class="slot-num">${i + 1}</span><div class="slot-content"></div>`;
      slot.addEventListener('click', () => {
        this.gm.localPlayer.selectedSlot = i;
        this.updateHotbar(this.gm.localPlayer);
      });
      this.hotbarEl.appendChild(slot);
    }
  }

  update(localPlayer, teamManager, matchTime) {
    if (!localPlayer) return;

    // 1. Resources
    if (this.resIronEl) this.resIronEl.innerText = localPlayer.resources.iron;
    if (this.resGoldEl) this.resGoldEl.innerText = localPlayer.resources.gold;
    if (this.resDiaEl) this.resDiaEl.innerText = localPlayer.resources.diamond;
    if (this.resEmeEl) this.resEmeEl.innerText = localPlayer.resources.emerald;

    // 2. Health Hearts
    if (this.healthHeartsEl) {
      const fullHearts = Math.floor(localPlayer.health / 2);
      const halfHeart = localPlayer.health % 2 >= 1;
      let heartsHtml = '';
      for (let i = 0; i < 10; i++) {
        if (i < fullHearts) {
          heartsHtml += '<span class="heart full">❤️</span>';
        } else if (i === fullHearts && halfHeart) {
          heartsHtml += '<span class="heart half">💔</span>';
        } else {
          heartsHtml += '<span class="heart empty">🖤</span>';
        }
      }
      this.healthHeartsEl.innerHTML = heartsHtml;
    }

    // 3. Armor label
    if (this.armorNameEl) {
      this.armorNameEl.innerText = (localPlayer.armor?.tier || 'None').toUpperCase();
    }

    // 4. Team Bed Status Tracker
    if (this.bedTrackerEl && teamManager) {
      let trackerHtml = '';
      for (const [tName, tData] of Object.entries(teamManager.teams)) {
        const isLocal = tName === localPlayer.team;
        const statusIcon = tData.hasBed ? '✓' : '✗';
        const statusClass = tData.hasBed ? 'bed-alive' : 'bed-dead';
        trackerHtml += `
          <div class="team-badge badge-${tName} ${isLocal ? 'badge-you' : ''}">
            <span class="team-label">${tName.charAt(0).toUpperCase()}:</span>
            <span class="bed-status ${statusClass}">${statusIcon}</span>
            ${isLocal ? '<span class="you-indicator">YOU</span>' : ''}
          </div>
        `;
      }
      this.bedTrackerEl.innerHTML = trackerHtml;
    }

    // 5. Scoreboard Stats
    if (this.statKillsEl) this.statKillsEl.innerText = localPlayer.kills;
    if (this.statFinalEl) this.statFinalEl.innerText = localPlayer.finalKills;
    if (this.statBedsEl) this.statBedsEl.innerText = localPlayer.bedsBroken;

    // Timer (MM:SS)
    if (this.statTimerEl) {
      const mins = Math.floor(matchTime / 60);
      const secs = Math.floor(matchTime % 60);
      this.statTimerEl.innerText = `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }

    // 6. Hotbar
    this.updateHotbar(localPlayer);

    // 7. Respawn overlay
    if (localPlayer.isDead && !localPlayer.isFinalDead) {
      this.respawnOverlay?.classList.remove('hidden');
      if (this.respawnTimerEl) {
        this.respawnTimerEl.innerText = Math.ceil(localPlayer.respawnTimer);
      }
    } else {
      this.respawnOverlay?.classList.add('hidden');
    }
  }

  updateHotbar(player) {
    if (!this.hotbarEl) return;
    const slots = this.hotbarEl.children;
    for (let i = 0; i < 9; i++) {
      const slotEl = slots[i];
      if (!slotEl) continue;

      if (i === player.selectedSlot) {
        slotEl.classList.add('active');
      } else {
        slotEl.classList.remove('active');
      }

      const item = player.hotbar[i];
      const contentEl = slotEl.querySelector('.slot-content');
      if (item && contentEl) {
        const countBadge = item.count > 1 ? `<span class="slot-count">${item.count}</span>` : '';
        contentEl.innerHTML = `<span class="slot-item-icon">${item.name || item.id}</span>${countBadge}`;
      } else if (contentEl) {
        contentEl.innerHTML = '';
      }
    }
  }

  showAnnouncement(title, subtitle) {
    if (!this.announceBanner) return;
    this.announceTitle.innerText = title;
    this.announceSubtitle.innerText = subtitle;
    this.announceBanner.classList.remove('hidden');
    setTimeout(() => {
      this.announceBanner.classList.add('hidden');
    }, 4000);
  }

  initShop() {
    const listEl = document.getElementById('shop-items-grid');
    if (!listEl) return;
    listEl.innerHTML = '';

    SHOP_ITEMS.forEach(item => {
      const card = document.createElement('div');
      card.className = `shop-item-card cost-${item.costType}`;
      card.innerHTML = `
        <div class="item-icon">${item.icon}</div>
        <div class="item-info">
          <div class="item-name">${item.name}</div>
          <div class="item-desc">${item.desc}</div>
        </div>
        <button class="btn-buy" data-id="${item.id}">
          ${item.cost} ${item.costType.toUpperCase()}
        </button>
      `;

      card.querySelector('.btn-buy').addEventListener('click', (e) => {
        e.stopPropagation();
        this.buyItem(item);
      });

      listEl.appendChild(card);
    });

    document.getElementById('btn-close-shop')?.addEventListener('click', () => {
      this.closeShop();
    });
  }

  buyItem(item) {
    const player = this.gm.localPlayer;
    if (player.spendResource(item.costType, item.cost)) {
      item.action(player);
      if (this.gm.sound) this.gm.sound.playShopBuy();
      this.update(player, this.gm.teamManager, this.gm.matchTime);
    } else {
      alert(`Not enough ${item.costType.toUpperCase()}!`);
    }
  }

  openShop() {
    if (document.pointerLockElement) document.exitPointerLock();
    this.shopModal?.classList.remove('hidden');
  }

  closeShop() {
    this.shopModal?.classList.add('hidden');
    this.gm.canvas.requestPointerLock();
  }

  initUpgrades() {
    const gridEl = document.getElementById('upgrades-grid');
    if (!gridEl) return;
    gridEl.innerHTML = '';

    TEAM_UPGRADES.forEach(upg => {
      const card = document.createElement('div');
      card.className = 'upgrade-card';
      card.innerHTML = `
        <div class="upg-icon">${upg.icon}</div>
        <div class="upg-title">${upg.name}</div>
        <div class="upg-desc">${upg.desc}</div>
        <button class="btn-buy-upgrade" data-id="${upg.id}">
          💎 ${upg.cost} DIAMONDS
        </button>
      `;

      card.querySelector('.btn-buy-upgrade').addEventListener('click', (e) => {
        e.stopPropagation();
        const player = this.gm.localPlayer;
        if (player.spendResource('diamond', upg.cost)) {
          const team = this.gm.teamManager.teams[player.team];
          upg.apply(team);
          if (this.gm.sound) this.gm.sound.playShopBuy();
          alert(`Upgraded: ${upg.name}!`);
        } else {
          alert('Not enough Diamonds!');
        }
      });

      gridEl.appendChild(card);
    });

    document.getElementById('btn-close-upgrades')?.addEventListener('click', () => {
      this.upgradesModal?.classList.add('hidden');
      this.gm.canvas.requestPointerLock();
    });
  }

  showGameOver(isVictory) {
    if (document.pointerLockElement) document.exitPointerLock();
    if (!this.gameoverOverlay) return;

    this.gameoverOverlay.classList.remove('hidden');
    const titleEl = document.getElementById('gameover-title');
    if (titleEl) {
      titleEl.innerText = isVictory ? 'VICTORY!' : 'GAME OVER!';
      titleEl.className = isVictory ? 'title-victory' : 'title-defeat';
    }

    if (isVictory && this.gm.sound) {
      this.gm.sound.playVictory();
    }
  }
}
