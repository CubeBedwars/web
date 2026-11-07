/**
 * src/ui/TouchControls.js
 * Responsive On-Screen Mobile Touch Controls for Voxel Bedwars.
 * 
 * Features:
 * - Dynamic / fixed virtual joystick with analog deadzone and unit-circle clamping.
 * - Right-half screen touch zone translating drag deltas into camera yaw and pitch.
 * - Floating action buttons (Jump, Attack/Mine, Place/Use, Sneak, Shop, Pause).
 * - Direct-touch 9-slot hotbar selection.
 * - Automatic touch device detection + manual toggle button in HUD.
 */

/**
 * Checks whether the current runtime environment is a touch-capable device.
 * @returns {boolean}
 */
export function isTouchDevice() {
  if (typeof window === 'undefined') return false;
  return (
    'ontouchstart' in window ||
    (typeof navigator !== 'undefined' &&
      (navigator.maxTouchPoints > 0 || navigator.msMaxTouchPoints > 0))
  );
}

/**
 * Checks if a touch offset is within the analog deadzone.
 * @param {number} distance
 * @param {number} maxRadius
 * @param {number} deadzoneRatio
 * @returns {boolean}
 */
export function isDeadzone(distance, maxRadius = 50, deadzoneRatio = 0.1) {
  if (maxRadius <= 0) return true;
  return distance / maxRadius < deadzoneRatio;
}

/**
 * Translates touch offset (dx, dy) into a normalized, deadzone-filtered vector clamped to the unit circle.
 * @param {number} dx
 * @param {number} dy
 * @param {number} maxRadius
 * @param {number} deadzoneRatio
 * @returns {{ x: number, y: number, rawDistance: number, inDeadzone: boolean }}
 */
export function calculateJoystickVector(dx, dy, maxRadius = 50, deadzoneRatio = 0.1) {
  const distance = Math.hypot(dx, dy);
  if (isDeadzone(distance, maxRadius, deadzoneRatio)) {
    return { x: 0, y: 0, rawDistance: distance, inDeadzone: true };
  }

  // Normalized distance remapped from [deadzone, 1.0] to [0.0, 1.0]
  const effectiveMax = maxRadius * (1.0 - deadzoneRatio);
  const normalizedDist = Math.min(1.0, (distance - maxRadius * deadzoneRatio) / effectiveMax);
  const angle = Math.atan2(dy, dx);

  // Return x = cos(angle)*normalizedDist, y = -sin(angle)*normalizedDist (up is positive forward)
  return {
    x: Math.cos(angle) * normalizedDist,
    y: -Math.sin(angle) * normalizedDist,
    rawDistance: distance,
    inDeadzone: false,
  };
}

/**
 * Applies drag delta to camera rotation angles (yaw, pitch) with clamping.
 * @param {{ yaw: number, pitch: number }} player
 * @param {number} deltaX
 * @param {number} deltaY
 * @param {number} sensitivity
 */
export function applyLookDelta(player, deltaX, deltaY, sensitivity = 0.0035) {
  if (!player) return;
  player.yaw -= deltaX * sensitivity;
  player.pitch -= deltaY * sensitivity;
  const maxPitch = Math.PI / 2 - 0.01;
  const minPitch = -Math.PI / 2 + 0.01;
  player.pitch = Math.max(minPitch, Math.min(maxPitch, player.pitch));
}

export class TouchControls {
  /**
   * @param {import('../game/GameManager.js').GameManager} gameManager
   * @param {Object} [options]
   */
  constructor(gameManager, options = {}) {
    this.gm = gameManager;
    this.options = {
      maxRadius: 55,
      deadzone: 0.1,
      lookSensitivity: 0.0035,
      ...options,
    };

    // State
    this.isEnabled = false;
    this.isSneaking = false;
    this.moveVector = { x: 0, y: 0 };
    this.joystickTouchId = null;
    this.lookTouchId = null;
    this.joystickOrigin = { x: 0, y: 0 };
    this.lastLookPos = { x: 0, y: 0 };

    // DOM containers
    this.container = null;
    this.joystickZone = null;
    this.joystickBase = null;
    this.joystickThumb = null;
    this.lookZone = null;
    this.buttons = {};

    this.initDOM();
    this.initEvents();

    // Determine default activation
    const savedPref = typeof localStorage !== 'undefined' ? localStorage.getItem('vw_force_touch_controls') : null;
    if (savedPref !== null) {
      this.setEnabled(savedPref === 'true');
    } else {
      this.setEnabled(isTouchDevice());
    }
  }

  /**
   * Creates or locates the DOM overlay elements.
   */
  initDOM() {
    if (typeof document === 'undefined') return;

    let el = document.getElementById('touch-controls');
    if (!el) {
      el = document.createElement('div');
      el.id = 'touch-controls';
      el.className = 'touch-overlay hidden';
      if (document.body) {
        document.body.appendChild(el);
      }
    }
    this.container = el;

    const getOrMake = (id, tag = 'div', className = '', parent = el) => {
      let node = document.getElementById(id);
      if (!node) {
        node = document.createElement(tag);
        node.id = id;
        node.className = className;
        parent.appendChild(node);
      }
      return node;
    };

    this.joystickZone = getOrMake('touch-joystick-zone', 'div', 'touch-joystick-zone', el);
    this.joystickBase = getOrMake('touch-joystick-base', 'div', 'touch-joystick-base', this.joystickZone);
    this.joystickThumb = getOrMake('touch-joystick-thumb', 'div', 'touch-joystick-thumb', this.joystickBase);
    this.lookZone = getOrMake('touch-look-zone', 'div', 'touch-look-zone', el);

    const cluster = getOrMake('touch-action-cluster', 'div', 'touch-action-cluster', el);

    this.buttons = {
      jump: getOrMake('btn-touch-jump', 'button', 'touch-btn touch-btn-jump', cluster),
      attack: getOrMake('btn-touch-attack', 'button', 'touch-btn touch-btn-attack', cluster),
      place: getOrMake('btn-touch-place', 'button', 'touch-btn touch-btn-place', cluster),
      sneak: getOrMake('btn-touch-sneak', 'button', 'touch-btn touch-btn-sneak', cluster),
      shop: getOrMake('btn-touch-shop', 'button', 'touch-btn touch-btn-shop', cluster),
      pause: getOrMake('btn-touch-pause', 'button', 'touch-btn touch-btn-pause', cluster),
    };
  }

  /**
   * Binds pointer and touch listeners for joystick, look drag, and action buttons.
   */
  initEvents() {
    if (!this.container) return;

    // 1. Virtual Joystick Pointer Events
    if (this.joystickZone) {
      this.joystickZone.addEventListener('pointerdown', (e) => this.handleJoystickStart(e));
    }
    if (typeof window !== 'undefined' && typeof window.addEventListener === 'function') {
      window.addEventListener('pointermove', (e) => {
        if (this.joystickTouchId !== null && e.pointerId === this.joystickTouchId) {
          this.handleJoystickMove(e);
        }
        if (this.lookTouchId !== null && e.pointerId === this.lookTouchId) {
          this.handleLookMove(e);
        }
      });
      window.addEventListener('pointerup', (e) => {
        if (e.pointerId === this.joystickTouchId) this.handleJoystickEnd();
        if (e.pointerId === this.lookTouchId) this.handleLookEnd();
      });
      window.addEventListener('pointercancel', (e) => {
        if (e.pointerId === this.joystickTouchId) this.handleJoystickEnd();
        if (e.pointerId === this.lookTouchId) this.handleLookEnd();
      });
    }

    // 2. Camera Look Drag Zone
    if (this.lookZone) {
      this.lookZone.addEventListener('pointerdown', (e) => this.handleLookStart(e));
    }

    // 3. Floating Action Buttons
    this.initButtonEvents();
  }

  initButtonEvents() {
    const { jump, attack, place, sneak, shop, pause } = this.buttons;

    if (jump) {
      jump.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        this.onJumpPress();
      });
      jump.addEventListener('pointerup', (e) => {
        e.preventDefault();
        this.onJumpRelease();
      });
    }

    if (attack) {
      attack.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        this.onAttackPress();
      });
      attack.addEventListener('pointerup', (e) => {
        e.preventDefault();
        this.onAttackRelease();
      });
      attack.addEventListener('pointercancel', () => this.onAttackRelease());
    }

    if (place) {
      place.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        this.onPlacePress();
      });
    }

    if (sneak) {
      sneak.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        this.onSneakToggle();
      });
    }

    if (shop) {
      shop.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        this.onShopPress();
      });
    }

    if (pause) {
      pause.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        this.onPausePress();
      });
    }
  }

  // Joystick handlers
  handleJoystickStart(e) {
    if (this.joystickTouchId !== null) return;
    this.joystickTouchId = e.pointerId;

    const rect = this.joystickZone.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    this.joystickOrigin = { x, y };
    if (this.joystickBase) {
      this.joystickBase.style.left = `${x}px`;
      this.joystickBase.style.top = `${y}px`;
      this.joystickBase.classList.add('active');
    }
    if (this.joystickThumb) {
      this.joystickThumb.style.transform = `translate(0px, 0px)`;
    }
    this.moveVector = { x: 0, y: 0 };
    this.syncPlayerMovement();
  }

  handleJoystickMove(e) {
    if (this.joystickTouchId === null) return;
    const rect = this.joystickZone.getBoundingClientRect();
    const currentX = e.clientX - rect.left;
    const currentY = e.clientY - rect.top;

    const dx = currentX - this.joystickOrigin.x;
    const dy = currentY - this.joystickOrigin.y;

    const vec = calculateJoystickVector(dx, dy, this.options.maxRadius, this.options.deadzone);
    this.moveVector = { x: vec.x, y: vec.y };

    if (this.joystickThumb) {
      const dist = Math.min(this.options.maxRadius, Math.hypot(dx, dy));
      const angle = Math.atan2(dy, dx);
      const thumbX = Math.cos(angle) * dist;
      const thumbY = Math.sin(angle) * dist;
      this.joystickThumb.style.transform = `translate(${thumbX}px, ${thumbY}px)`;
    }

    this.syncPlayerMovement();
  }

  handleJoystickEnd() {
    this.joystickTouchId = null;
    this.moveVector = { x: 0, y: 0 };
    if (this.joystickBase) {
      this.joystickBase.classList.remove('active');
    }
    if (this.joystickThumb) {
      this.joystickThumb.style.transform = `translate(0px, 0px)`;
    }
    this.syncPlayerMovement();
  }

  syncPlayerMovement() {
    if (!this.gm || !this.gm.localPlayer) return;
    const p = this.gm.localPlayer;
    p.touchMoveVector = { ...this.moveVector };
  }

  // Look handlers
  handleLookStart(e) {
    if (this.lookTouchId !== null) return;
    this.lookTouchId = e.pointerId;
    this.lastLookPos = { x: e.clientX, y: e.clientY };
  }

  handleLookMove(e) {
    if (this.lookTouchId === null || !this.gm || !this.gm.localPlayer) return;
    const dx = e.clientX - this.lastLookPos.x;
    const dy = e.clientY - this.lastLookPos.y;
    this.lastLookPos = { x: e.clientX, y: e.clientY };

    applyLookDelta(this.gm.localPlayer, dx, dy, this.options.lookSensitivity);
  }

  handleLookEnd() {
    this.lookTouchId = null;
  }

  // Button actions
  onJumpPress() {
    if (!this.gm || !this.gm.localPlayer) return;
    const p = this.gm.localPlayer;
    p.touchJump = true;
    if (p.onGround) {
      p.velocity.y = 8.5;
      p.onGround = false;
    }
  }

  onJumpRelease() {
    if (!this.gm || !this.gm.localPlayer) return;
    this.gm.localPlayer.touchJump = false;
  }

  onAttackPress() {
    if (!this.gm) return;
    this.gm.isLeftMouseDown = true;
    this.gm.handleLeftClick();
  }

  onAttackRelease() {
    if (!this.gm) return;
    this.gm.isLeftMouseDown = false;
    this.gm.stopMining();
  }

  onPlacePress() {
    if (!this.gm) return;
    this.gm.handleRightClick();
  }

  onSneakToggle() {
    this.isSneaking = !this.isSneaking;
    if (this.buttons.sneak) {
      this.buttons.sneak.classList.toggle('active', this.isSneaking);
    }
    if (this.gm && this.gm.localPlayer) {
      this.gm.localPlayer.isSneaking = this.isSneaking;
    }
  }

  onShopPress() {
    if (!this.gm || !this.gm.hud) return;
    const hud = this.gm.hud;
    if (hud.shopModal && !hud.shopModal.classList.contains('hidden')) {
      hud.closeShop();
    } else {
      hud.openShop();
    }
  }

  onPausePress() {
    if (!this.gm || !this.gm.hud) return;
    const hud = this.gm.hud;
    if (hud.upgradesModal) {
      hud.upgradesModal.classList.toggle('hidden');
    }
  }

  selectHotbarSlot(index) {
    if (index < 0 || index > 8) return;
    if (this.gm && this.gm.localPlayer) {
      this.gm.localPlayer.selectedSlot = index;
      if (this.gm.hud) {
        this.gm.hud.updateHotbar(this.gm.localPlayer);
      }
    }
  }

  setEnabled(enable) {
    this.isEnabled = !!enable;
    if (this.container) {
      if (this.isEnabled) {
        this.container.classList.remove('hidden');
      } else {
        this.container.classList.add('hidden');
        this.handleJoystickEnd();
        this.handleLookEnd();
      }
    }
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem('vw_force_touch_controls', this.isEnabled ? 'true' : 'false');
    }
  }

  toggle() {
    this.setEnabled(!this.isEnabled);
    return this.isEnabled;
  }

  update(dt) {
    if (!this.isEnabled) return;
    // Continuous sync of touch vector & state to localPlayer
    this.syncPlayerMovement();
  }

  destroy() {
    if (this.container && this.container.parentElement) {
      this.container.parentElement.removeChild(this.container);
    }
    this.isEnabled = false;
  }
}
