import { ShopManager, SHOP_CATEGORIES } from '../game/ShopManager.js';

export class ShopUI {
  constructor(game) {
    this.game = game;
    this.modal = document.getElementById('shop-modal');
    this.grid = document.getElementById('shop-items-grid');
    this.closeBtn = document.getElementById('btn-close-shop');
    this.tabs = document.querySelectorAll('.shop-tab');

    this.userIron = document.getElementById('shop-user-iron');
    this.userGold = document.getElementById('shop-user-gold');
    this.userDia = document.getElementById('shop-user-dia');
    this.userEme = document.getElementById('shop-user-eme');

    this.activeCategory = 'blocks';
    this.isOpen = false;

    this.initEvents();
  }

  initEvents() {
    this.closeBtn?.addEventListener('click', () => this.close());

    this.tabs.forEach(tab => {
      tab.addEventListener('click', () => {
        this.tabs.forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        this.activeCategory = tab.dataset.tab;
        this.renderItems();
      });
    });

    window.addEventListener('keydown', (e) => {
      if ((e.code === 'KeyB' || e.code === 'KeyE') && document.activeElement.tagName !== 'INPUT') {
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
    this.updateUserCurrency();
    this.renderItems();
  }

  close() {
    this.isOpen = false;
    this.modal.classList.add('hidden');
  }

  updateUserCurrency() {
    const res = this.game.localPlayer.resources;
    if (this.userIron) this.userIron.innerText = res.iron || 0;
    if (this.userGold) this.userGold.innerText = res.gold || 0;
    if (this.userDia) this.userDia.innerText = res.diamond || 0;
    if (this.userEme) this.userEme.innerText = res.emerald || 0;
  }

  renderItems() {
    this.grid.innerHTML = '';
    const items = ShopManager.getItemsByCategory(this.activeCategory);

    for (const item of items) {
      const card = document.createElement('div');
      card.className = 'shop-card';

      // Adjust wool color for player's team
      const teamDef = this.game.teamManager.getTeam(this.game.localPlayer.teamId);
      let blockType = item.blockType;
      if (item.id === 'wool' && teamDef) {
        blockType = teamDef.woolBlock;
      }

      const curIcon = item.currency === 'iron' ? '⚪' : item.currency === 'gold' ? '🟡' : item.currency === 'diamond' ? '💎' : '🟢';

      card.innerHTML = `
        <div class="shop-card-top">
          <div class="shop-card-icon">${item.icon}</div>
          <div class="shop-card-info">
            <h4>${item.name}</h4>
            <p>${item.desc}</p>
          </div>
        </div>
        <div class="shop-card-bottom">
          <span class="shop-price">${curIcon} ${item.cost} ${item.currency.toUpperCase()}</span>
          <button class="btn btn-primary btn-sm">Buy</button>
        </div>
      `;

      card.addEventListener('click', () => {
        const itemToBuy = { ...item, blockType };
        const result = ShopManager.purchase(this.game.localPlayer, itemToBuy);
        if (result.success) {
          if (this.game.sound) this.game.sound.playResourcePickup('gold');
          this.updateUserCurrency();
          this.game.hud.update(this.game.localPlayer);
        } else {
          if (this.game.sound) this.game.sound.playFootstep();
          alert(result.reason);
        }
      });

      this.grid.appendChild(card);
    }
  }
}
