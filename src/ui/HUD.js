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
    this.damageFlashEl = document.getElementById('damage-flash');
    this.armorNameEl = document.getElementById('armor-name');
    this.hotbarEl = document.getElementById('hotbar');

    // Scoreboard Elements
    this.sbModeBadgeEl = document.getElementById('sb-mode-badge');
    this.sbTeamBedsEl = document.getElementById('sb-team-beds');
    this.statKillsEl = document.getElementById('stat-kills');
    this.statFinalEl = document.getElementById('stat-final-kills');
    this.statBedsEl = document.getElementById('stat-beds');
    this.statRatingEl = document.getElementById('stat-rating');
    this.statLevelEl = document.getElementById('stat-level');
    this.statTimerEl = document.getElementById('stat-timer');

    // Modals & Overlays
    this.shopModal = document.getElementById('shop-modal');
    this.upgradesModal = document.getElementById('upgrades-modal');
    this.respawnOverlay = document.getElementById('respawn-overlay');
    this.respawnTimerEl = document.getElementById('respawn-timer-val');
    this.gameoverOverlay = document.getElementById('gameover-overlay');
    this.goStatRatingEl = document.getElementById('go-stat-rating');
    this.goStatXpEl = document.getElementById('go-stat-xp');
    this.goStatFinalsEl = document.getElementById('go-stat-finals');
    this.goStatBedsEl = document.getElementById('go-stat-beds');

    this.announceBanner = document.getElementById('announcement-banner');
    this.announceTitle = document.getElementById('announce-title');
    this.announceSubtitle = document.getElementById('announce-subtitle');

    // Network Status Elements
    this.hudNetBadgeEl = document.getElementById('hud-net-badge');
    this.hudNetTextEl = document.getElementById('hud-net-text');
    this.multiActiveTransportEl = document.getElementById('multi-active-transport');
    this.lanStatusMsgEl = document.getElementById('lan-status-msg');
    this.lanGamesListEl = document.getElementById('lan-games-list');
    this.lanDiscoveryCountEl = document.getElementById('lan-discovery-count');
    this.btnToggleTouchEl = document.getElementById('btn-toggle-touch');

    if (this.btnToggleTouchEl) {
      this.btnToggleTouchEl.addEventListener('click', (e) => {
        e.stopPropagation();
        if (this.gm && this.gm.touchControls) {
          const active = this.gm.touchControls.toggle();
          this.btnToggleTouchEl.classList.toggle('active', active);
        }
      });
    }

    this.initHotbarSlots();
    this.initShop();
    this.initUpgrades();
    this.initNetworkUI();
  }

  show() {
    this.hudEl?.classList.remove('hidden');
    document.getElementById('crosshair')?.classList.remove('hidden');
    if (this.gm?.touchControls?.isEnabled) {
      this.gm.touchControls.container?.classList.remove('hidden');
    }
    if (this.btnToggleTouchEl && this.gm?.touchControls) {
      this.btnToggleTouchEl.classList.toggle('active', this.gm.touchControls.isEnabled);
    }
  }

  hide() {
    this.hudEl?.classList.add('hidden');
    document.getElementById('crosshair')?.classList.add('hidden');
    this.gm?.touchControls?.container?.classList.add('hidden');
  }

  triggerDamageFlash() {
    if (this.damageFlashEl) {
      this.damageFlashEl.classList.remove('flash-active');
      void this.damageFlashEl.offsetWidth; // trigger DOM reflow
      this.damageFlashEl.classList.add('flash-active');
      setTimeout(() => {
        this.damageFlashEl.classList.remove('flash-active');
      }, 350);
    }
    if (this.healthHeartsEl) {
      this.healthHeartsEl.classList.remove('damage-shake');
      void this.healthHeartsEl.offsetWidth;
      this.healthHeartsEl.classList.add('damage-shake');
      setTimeout(() => {
        this.healthHeartsEl.classList.remove('damage-shake');
      }, 350);
    }
  }

  initHotbarSlots() {
    if (!this.hotbarEl) return;
    this.hotbarEl.innerHTML = '';
    for (let i = 0; i < 9; i++) {
      const slot = document.createElement('div');
      slot.className = `slot ${i === 0 ? 'active' : ''}`;
      slot.dataset.index = i;
      slot.innerHTML = `<span class="slot-num">${i + 1}</span><div class="slot-content"></div>`;
      const selectSlot = () => {
        this.gm.localPlayer.selectedSlot = i;
        this.updateHotbar(this.gm.localPlayer);
      };
      slot.addEventListener('click', selectSlot);
      slot.addEventListener('pointerdown', selectSlot);
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

    // 2. Health Hearts (Authentic 10-heart display representing 20 HP)
    if (this.healthHeartsEl) {
      const fullHearts = Math.floor(localPlayer.health / 2);
      const halfHeart = localPlayer.health % 2 >= 1;
      let heartsHtml = '';
      for (let i = 0; i < 10; i++) {
        if (i < fullHearts) {
          heartsHtml += '<span class="heart full" title="Full Heart">❤️</span>';
        } else if (i === fullHearts && halfHeart) {
          heartsHtml += '<span class="heart half" title="Half Heart">💔</span>';
        } else {
          heartsHtml += '<span class="heart empty" title="Empty Heart">🖤</span>';
        }
      }
      this.healthHeartsEl.innerHTML = heartsHtml;
    }

    // 3. Armor label
    if (this.armorNameEl) {
      this.armorNameEl.innerText = (localPlayer.armor?.tier || 'None').toUpperCase();
    }

    // 4. Team Bed Status Tracker (Top Bar)
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

    // 5. Sidebar Scoreboard Team Bed Statuses
    if (this.sbTeamBedsEl && teamManager) {
      let sbBedsHtml = '';
      for (const [tName, tData] of Object.entries(teamManager.teams)) {
        const isLocal = tName === localPlayer.team;
        const isAlive = !teamManager.isTeamEliminated(tName);
        let statusIcon = '✓';
        let statusClass = 'sb-bed-alive';

        if (!tData.hasBed) {
          if (isAlive) {
            statusIcon = '✗';
            statusClass = 'sb-bed-dead';
          } else {
            statusIcon = '☠';
            statusClass = 'sb-bed-elim';
          }
        }

        const teamCap = tName.charAt(0).toUpperCase() + tName.slice(1);
        sbBedsHtml += `
          <div class="sb-bed-row ${isLocal ? 'sb-bed-you' : ''}">
            <div class="sb-bed-team">
              <span class="sb-team-dot dot-${tName}"></span>
              <span class="sb-team-name">${teamCap}</span>
              ${isLocal ? '<span class="sb-you-tag">YOU</span>' : ''}
            </div>
            <span class="sb-bed-status ${statusClass}">${statusIcon}</span>
          </div>
        `;
      }
      this.sbTeamBedsEl.innerHTML = sbBedsHtml;
    }

    // 6. Scoreboard Mode & Numerical Stats
    if (this.sbModeBadgeEl && this.gm.matchFormat) {
      this.sbModeBadgeEl.innerText = this.gm.matchFormat.toUpperCase();
    }

    if (this.statKillsEl) this.statKillsEl.innerText = localPlayer.kills;
    if (this.statFinalEl) this.statFinalEl.innerText = localPlayer.finalKills;
    if (this.statBedsEl) this.statBedsEl.innerText = localPlayer.bedsBroken;

    // Rating & Level in Scoreboard
    if (this.statRatingEl && this.gm.rankManager) {
      const rankProfile = this.gm.rankManager.getProfile();
      this.statRatingEl.innerText = `${rankProfile.rating} RR`;
    }
    if (this.statLevelEl && this.gm.levelManager) {
      this.statLevelEl.innerText = `Lv. ${this.gm.levelManager.level}`;
    }

    // Timer (MM:SS)
    if (this.statTimerEl) {
      const mins = Math.floor(matchTime / 60);
      const secs = Math.floor(matchTime % 60);
      this.statTimerEl.innerText = `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }

    // 7. Hotbar
    this.updateHotbar(localPlayer);

    // 8. Respawn overlay
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
        const displayName = item.name || item.id;
        contentEl.innerHTML = `<span class="slot-item-icon" title="${displayName}">${displayName}</span>${countBadge}`;
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

  showGameOver(isVictory, rankResult = null, levelResult = null) {
    if (document.pointerLockElement) document.exitPointerLock();
    if (!this.gameoverOverlay) return;

    this.gameoverOverlay.classList.remove('hidden');
    const titleEl = document.getElementById('gameover-title');
    if (titleEl) {
      titleEl.innerText = isVictory ? 'VICTORY!' : 'GAME OVER!';
      titleEl.className = isVictory ? 'title-victory' : 'title-defeat';
    }

    if (this.goStatRatingEl) {
      if (rankResult && rankResult.isRanked) {
        const sign = rankResult.deltaRating >= 0 ? '+' : '';
        this.goStatRatingEl.innerText = `${sign}${rankResult.deltaRating} RR (${rankResult.rating} RR [${rankResult.tier}])`;
        this.goStatRatingEl.className = rankResult.deltaRating >= 0 ? 'go-stat-val val-cyan' : 'go-stat-val val-red';
      } else {
        this.goStatRatingEl.innerText = 'Unranked (2-team only)';
        this.goStatRatingEl.className = 'go-stat-val';
      }
    }

    if (this.goStatXpEl && levelResult) {
      this.goStatXpEl.innerText = `+${levelResult.xpEarned} XP (Level ${levelResult.level})`;
      if (levelResult.leveledUp) {
        this.showAnnouncement('LEVEL UP!', `You reached Player Level ${levelResult.level}!`);
      }
    }

    if (this.goStatFinalsEl) {
      this.goStatFinalsEl.innerText = this.gm.localPlayer.finalKills;
    }
    if (this.goStatBedsEl) {
      this.goStatBedsEl.innerText = this.gm.localPlayer.bedsBroken;
    }

    if (isVictory && this.gm.sound) {
      this.gm.sound.playVictory();
    }
  }

  /**
   * Initializes network controls and direct LAN join listeners.
   */
  initNetworkUI() {
    const btnJoinLan = document.getElementById('btn-join-lan');
    const inputLanIp = document.getElementById('input-lan-ip');
    const inputLanPort = document.getElementById('input-lan-port');

    if (btnJoinLan) {
      btnJoinLan.addEventListener('click', async () => {
        const ip = inputLanIp ? inputLanIp.value.trim() : '127.0.0.1';
        const port = inputLanPort ? parseInt(inputLanPort.value, 10) : 8080;

        if (this.lanStatusMsgEl) {
          this.lanStatusMsgEl.style.display = 'block';
          this.lanStatusMsgEl.style.background = 'rgba(6, 182, 212, 0.15)';
          this.lanStatusMsgEl.style.color = '#22d3ee';
          this.lanStatusMsgEl.innerText = `Connecting to LAN host ws://${ip}:${port}...`;
        }

        try {
          await this.gm.network.joinDirectLan(ip, port, {
            playerName: this.gm.localPlayer?.name || 'LAN Player',
          });

          if (this.lanStatusMsgEl) {
            this.lanStatusMsgEl.style.background = 'rgba(34, 197, 94, 0.2)';
            this.lanStatusMsgEl.style.color = '#22c55e';
            this.lanStatusMsgEl.innerText = `Connected to LAN Host at ${ip}:${port}!`;
          }

          setTimeout(() => {
            document.getElementById('multiplayer-modal')?.classList.add('hidden');
            this.gm.startMatch('solo', false);
          }, 800);
        } catch (err) {
          if (this.lanStatusMsgEl) {
            this.lanStatusMsgEl.style.background = 'rgba(239, 68, 68, 0.2)';
            this.lanStatusMsgEl.style.color = '#ef4444';
            this.lanStatusMsgEl.innerText = `Connection failed: ${err.message}`;
          }
        }
      });
    }

    // Start listening for LAN broadcasts
    if (this.gm?.network?.lanDiscovery) {
      this.gm.network.lanDiscovery.startDiscovery((rooms) => {
        this.renderLanDiscoveredRooms(rooms);
      });
    }
  }

  /**
   * Updates network badge in HUD and modal.
   * @param {string} transportName
   * @param {string} [roomCode]
   */
  updateNetworkStatus(transportName, roomCode = null) {
    if (this.hudNetTextEl) {
      if (roomCode) {
        this.hudNetTextEl.innerText = `${transportName} [${roomCode}]`;
      } else {
        this.hudNetTextEl.innerText = transportName || 'Solo (Offline)';
      }
    }

    const dotEl = this.hudNetBadgeEl?.querySelector?.('.net-status-dot');

    if (this.hudNetBadgeEl) {
      if (transportName === 'WebSocket' || transportName === 'LAN Direct') {
        this.hudNetBadgeEl.style.background = 'rgba(34, 197, 94, 0.15)';
        this.hudNetBadgeEl.style.color = '#22c55e';
        this.hudNetBadgeEl.style.border = '1px solid rgba(34, 197, 94, 0.3)';
        if (dotEl) dotEl.style.background = '#22c55e';
      } else if (transportName.includes('WebRTC')) {
        this.hudNetBadgeEl.style.background = 'rgba(6, 182, 212, 0.2)';
        this.hudNetBadgeEl.style.color = '#22d3ee';
        this.hudNetBadgeEl.style.border = '1px solid rgba(6, 182, 212, 0.4)';
        if (dotEl) dotEl.style.background = '#22d3ee';
      } else {
        this.hudNetBadgeEl.style.background = 'rgba(148, 163, 184, 0.1)';
        this.hudNetBadgeEl.style.color = '#94a3b8';
        this.hudNetBadgeEl.style.border = 'none';
        if (dotEl) dotEl.style.background = '#94a3b8';
      }
    }

    if (this.multiActiveTransportEl) {
      this.multiActiveTransportEl.innerText = transportName;
    }
  }

  /**
   * Renders discovered LAN beacons in modal list.
   * @param {Array<Object>} rooms
   */
  renderLanDiscoveredRooms(rooms) {
    if (this.lanDiscoveryCountEl) {
      this.lanDiscoveryCountEl.innerText = `${rooms.length} found`;
    }

    if (!this.lanGamesListEl) return;

    if (!rooms || rooms.length === 0) {
      this.lanGamesListEl.innerHTML = '<div class="lan-empty-hint">Scanning local subnet beacon on port 8766...</div>';
      return;
    }

    this.lanGamesListEl.innerHTML = '';
    rooms.forEach((r) => {
      const row = document.createElement('div');
      row.style.display = 'flex';
      row.style.justifyContent = 'space-between';
      row.style.alignItems = 'center';
      row.style.padding = '4px 8px';
      row.style.background = 'rgba(255, 255, 255, 0.05)';
      row.style.borderRadius = '4px';

      row.innerHTML = `
        <div>
          <strong style="color:var(--accent-cyan);">${r.roomCode}</strong> — ${r.hostName}
          <span style="font-size:10px;color:var(--text-muted);margin-left:6px;">(${r.ip}:${r.port})</span>
        </div>
        <button class="btn-primary" style="padding:2px 8px;font-size:11px;">Join</button>
      `;

      row.querySelector('button')?.addEventListener('click', () => {
        const ipInput = document.getElementById('input-lan-ip');
        const portInput = document.getElementById('input-lan-port');
        if (ipInput) ipInput.value = r.ip || '127.0.0.1';
        if (portInput) portInput.value = r.port || 8080;
        document.getElementById('btn-join-lan')?.click();
      });

      this.lanGamesListEl.appendChild(row);
    });
  }

  /**
   * Displays in-game chat messages.
   */
  displayChatMessage(sender, text) {
    this.showAnnouncement(sender.toUpperCase(), text);
  }
}
