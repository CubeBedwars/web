export class MobileControls {
  constructor(game) {
    this.game = game;
    this.enabled = false;

    this.joystickData = { active: false, startX: 0, startY: 0, curX: 0, curY: 0 };
    this.touchLookData = { active: false, touchId: null, lastX: 0, lastY: 0 };

    this.initDOM();
    this.detectMobile();
  }

  detectMobile() {
    const isTouch = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
    if (isTouch) {
      this.enable();
    }
  }

  enable() {
    this.enabled = true;
    this.container.classList.remove('hidden');
  }

  initDOM() {
    this.container = document.createElement('div');
    this.container.id = 'mobile-controls';
    this.container.className = 'mobile-controls-layer hidden';
    this.container.innerHTML = `
      <!-- Virtual Joystick Zone -->
      <div id="joystick-zone" class="joystick-zone">
        <div id="joystick-base" class="joystick-base">
          <div id="joystick-thumb" class="joystick-thumb"></div>
        </div>
      </div>

      <!-- Action Touch Buttons -->
      <div class="mobile-actions">
        <button id="btn-touch-jump" class="touch-btn btn-jump">⏫</button>
        <div class="action-row">
          <button id="btn-touch-place" class="touch-btn btn-place">🧱 Place</button>
          <button id="btn-touch-attack" class="touch-btn btn-attack">⚔️ Attack</button>
        </div>
        <div class="action-row-sub">
          <button id="btn-touch-shop" class="touch-btn-sm">🛒 Shop</button>
          <button id="btn-touch-chat" class="touch-btn-sm">💬 Chat</button>
        </div>
      </div>
    `;

    document.getElementById('app').appendChild(this.container);

    this.joystickZone = document.getElementById('joystick-zone');
    this.joystickBase = document.getElementById('joystick-base');
    this.joystickThumb = document.getElementById('joystick-thumb');

    this.bindEvents();
  }

  bindEvents() {
    // 1. Virtual Joystick Touch Events
    this.joystickZone.addEventListener('touchstart', (e) => {
      const touch = e.changedTouches[0];
      this.joystickData.active = true;
      this.joystickData.touchId = touch.identifier;
      this.joystickData.startX = touch.clientX;
      this.joystickData.startY = touch.clientY;
      this.joystickThumb.style.transform = `translate(0px, 0px)`;
    }, { passive: false });

    this.joystickZone.addEventListener('touchmove', (e) => {
      if (!this.joystickData.active) return;
      for (let i = 0; i < e.changedTouches.length; i++) {
        const touch = e.changedTouches[i];
        if (touch.identifier === this.joystickData.touchId) {
          const dx = touch.clientX - this.joystickData.startX;
          const dy = touch.clientY - this.joystickData.startY;
          const maxDist = 45;
          const dist = Math.min(Math.hypot(dx, dy), maxDist);
          const angle = Math.atan2(dy, dx);

          const thumbX = Math.cos(angle) * dist;
          const thumbY = Math.sin(angle) * dist;

          this.joystickThumb.style.transform = `translate(${thumbX}px, ${thumbY}px)`;

          // Map to localPlayer input
          const player = this.game.localPlayer;
          if (player) {
            player.input.forward = dy < -15;
            player.input.backward = dy > 15;
            player.input.left = dx < -15;
            player.input.right = dx > 15;
            player.isSprinting = dist > 35;
          }
          break;
        }
      }
    }, { passive: false });

    const endJoystick = () => {
      this.joystickData.active = false;
      this.joystickThumb.style.transform = `translate(0px, 0px)`;
      const player = this.game.localPlayer;
      if (player) {
        player.input.forward = false;
        player.input.backward = false;
        player.input.left = false;
        player.input.right = false;
        player.isSprinting = false;
      }
    };

    this.joystickZone.addEventListener('touchend', endJoystick);
    this.joystickZone.addEventListener('touchcancel', endJoystick);

    // 2. Action Buttons
    const jumpBtn = document.getElementById('btn-touch-jump');
    jumpBtn.addEventListener('touchstart', () => {
      if (this.game.localPlayer) this.game.localPlayer.input.jump = true;
    });
    jumpBtn.addEventListener('touchend', () => {
      if (this.game.localPlayer) this.game.localPlayer.input.jump = false;
    });

    document.getElementById('btn-touch-attack').addEventListener('click', () => {
      this.game.onPlayerAttack();
    });

    document.getElementById('btn-touch-place').addEventListener('click', () => {
      this.game.onPlayerPlace();
    });

    document.getElementById('btn-touch-shop').addEventListener('click', () => {
      this.game.shopUI.open();
    });

    document.getElementById('btn-touch-chat').addEventListener('click', () => {
      this.game.chat.openChat();
    });

    // 3. Right-Half Screen Drag for Camera Look
    window.addEventListener('touchstart', (e) => {
      for (let i = 0; i < e.changedTouches.length; i++) {
        const touch = e.changedTouches[i];
        if (touch.clientX > window.innerWidth / 2 && !this.touchLookData.active) {
          this.touchLookData.active = true;
          this.touchLookData.touchId = touch.identifier;
          this.touchLookData.lastX = touch.clientX;
          this.touchLookData.lastY = touch.clientY;
          break;
        }
      }
    });

    window.addEventListener('touchmove', (e) => {
      if (!this.touchLookData.active) return;
      for (let i = 0; i < e.changedTouches.length; i++) {
        const touch = e.changedTouches[i];
        if (touch.identifier === this.touchLookData.touchId) {
          const dx = touch.clientX - this.touchLookData.lastX;
          const dy = touch.clientY - this.touchLookData.lastY;

          this.touchLookData.lastX = touch.clientX;
          this.touchLookData.lastY = touch.clientY;

          if (this.game.localPlayer) {
            this.game.localPlayer.yaw -= dx * 0.005;
            this.game.localPlayer.pitch -= dy * 0.005;
            const maxP = Math.PI / 2 - 0.05;
            this.game.localPlayer.pitch = Math.max(-maxP, Math.min(maxP, this.game.localPlayer.pitch));
          }
          break;
        }
      }
    });

    const endLook = (e) => {
      for (let i = 0; i < e.changedTouches.length; i++) {
        if (e.changedTouches[i].identifier === this.touchLookData.touchId) {
          this.touchLookData.active = false;
          break;
        }
      }
    };

    window.addEventListener('touchend', endLook);
    window.addEventListener('touchcancel', endLook);
  }
}
