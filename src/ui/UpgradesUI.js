import { UpgradesManager, TEAM_UPGRADES } from '../game/UpgradesManager.js';

export class UpgradesUI {
  constructor(game) {
    this.game = game;
    this.modal = document.getElementById('upgrades-modal');
    this.grid = document.getElementById('upgrades-grid');
    this.closeBtn = document.getElementById('btn-close-upgrades');
    this.userDia = document.getElementById('upgrades-user-dia');

    this.isOpen = false;
    this.initEvents();
  }

  initEvents() {
    this.closeBtn?.addEventListener('click', () => this.close());

    window.addEventListener('keydown', (e) => {
      if (e.code === 'KeyU' && document.activeElement.tagName !== 'INPUT') {
        if (!this.game.isMatchRunning) return;
        if (this.isOpen) this.close();
        else this.open();
      }

      if (e.code === 'Escape' && this.isOpen) {
        this.close();
      }
    });
  }

  open() {
    this.isOpen = true;
    this.modal.classList.remove('hidden');
    if (document.pointerLockElement) {
      document.exitPointerLock();
    }
    this.renderUpgrades();
  }

  close() {
    this.isOpen = false;
    this.modal.classList.add('hidden');
  }

  renderUpgrades() {
    this.grid.innerHTML = '';
    const team = this.game.teamManager.getTeam(this.game.localPlayer.teamId);
    if (!team) return;

    if (this.userDia) {
      this.userDia.innerText = this.game.localPlayer.resources.diamond || 0;
    }

    for (const upgrade of TEAM_UPGRADES) {
      const card = document.createElement('div');
      card.className = 'upgrade-card';

      let isOwned = false;
      let costText = `${upgrade.cost} Diamonds`;

      if (upgrade.id === 'sharpness') isOwned = team.upgrades.sharpness;
      else if (upgrade.id === 'heal_pool') isOwned = team.upgrades.healPool;
      else if (upgrade.id === 'miner_fatigue_trap') isOwned = team.upgrades.minerFatigueTrap;
      else if (upgrade.id === 'counter_trap') isOwned = team.upgrades.counterOffensiveTrap;
      else if (upgrade.id === 'dragon_buff') isOwned = team.upgrades.dragonBuff;
      else if (upgrade.id === 'protection') {
        const lvl = team.upgrades.protectionLevel || 0;
        if (lvl >= upgrade.tiers.length) {
          isOwned = true;
          costText = 'MAX LEVEL';
        } else {
          costText = `${upgrade.tiers[lvl].cost} Diamonds (Tier ${lvl + 1})`;
        }
      }

      if (isOwned && upgrade.type !== 'tiered') {
        card.classList.add('owned');
      }

      card.innerHTML = `
        <div class="shop-card-icon">${upgrade.icon}</div>
        <div class="shop-card-info">
          <h4>${upgrade.name}</h4>
          <p>${upgrade.desc}</p>
          <span class="shop-price">💎 ${costText}</span>
        </div>
      `;

      card.addEventListener('click', () => {
        const res = UpgradesManager.purchaseUpgrade(team, upgrade.id, this.game.localPlayer);
        if (res.success) {
          if (this.game.sound) this.game.sound.playResourcePickup('diamond');
          this.renderUpgrades();
          this.game.hud.update(this.game.localPlayer);
        } else {
          alert(res.reason);
        }
      });

      this.grid.appendChild(card);
    }
  }
}
