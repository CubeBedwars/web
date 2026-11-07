/**
 * tests/mocks/browser-shim.js
 * Headless browser environment polyfills for Node.js E2E test runner.
 * Enables client code (Three.js canvas textures, DOM HUD, AudioContext, LocalStorage)
 * to run in headless Node without browser or GPU.
 */

class MockCanvasContext2D {
  constructor(canvas) {
    this.canvas = canvas;
    this.fillStyle = '#000000';
    this.strokeStyle = '#000000';
    this.lineWidth = 1;
    this.font = '10px sans-serif';
    this._pixelData = new Uint8ClampedArray(canvas.width * canvas.height * 4);
  }

  fillRect(x, y, w, h) {
    // Fill in mock buffer
  }

  strokeRect(x, y, w, h) {
    // Stroke mock buffer
  }

  clearRect(x, y, w, h) {
    // Clear in mock buffer
  }

  beginPath() {}
  closePath() {}
  moveTo(x, y) {}
  lineTo(x, y) {}
  arc(x, y, radius, startAngle, endAngle) {}
  arcTo(x1, y1, x2, y2, radius) {}
  bezierCurveTo(cp1x, cp1y, cp2x, cp2y, x, y) {}
  quadraticCurveTo(cpx, cpy, x, y) {}
  fill() {}
  stroke() {}
  clip() {}
  save() {}
  restore() {}
  scale(x, y) {}
  rotate(angle) {}
  translate(x, y) {}
  transform(a, b, c, d, e, f) {}
  setTransform(a, b, c, d, e, f) {}
  resetTransform() {}
  drawImage(image, sx, sy, sWidth, sHeight, dx, dy, dWidth, dHeight) {}
  fillText(text, x, y) {}
  strokeText(text, x, y) {}
  measureText(text) {
    return { width: (text || '').length * 6, actualBoundingBoxAscent: 8, actualBoundingBoxDescent: 2 };
  }
  createLinearGradient(x0, y0, x1, y1) {
    return { addColorStop() {} };
  }
  createRadialGradient(x0, y0, r0, x1, y1, r1) {
    return { addColorStop() {} };
  }
  createPattern(image, repetition) {
    return {};
  }

  getImageData(sx, sy, sw, sh) {
    return {
      data: new Uint8ClampedArray(sw * sh * 4),
      width: sw,
      height: sh,
    };
  }

  putImageData(imageData, dx, dy) {}
}

class MockElement {
  constructor(tagName = 'div') {
    this.tagName = tagName.toUpperCase();
    this.className = '';
    this.innerHTML = '';
    this.style = {};
    this.dataset = {};
    this.children = [];
    this.parentElement = null;
    this.listeners = new Map();
    this.width = 300;
    this.height = 150;

    const self = this;
    this.classList = {
      _classes: new Set(),
      add(cls) {
        self.classList._classes.add(cls);
        self.className = Array.from(self.classList._classes).join(' ');
      },
      remove(cls) {
        self.classList._classes.delete(cls);
        self.className = Array.from(self.classList._classes).join(' ');
      },
      contains(cls) {
        return self.classList._classes.has(cls);
      },
      toggle(cls) {
        if (self.classList._classes.has(cls)) {
          self.classList.remove(cls);
          return false;
        } else {
          self.classList.add(cls);
          return true;
        }
      }
    };
  }

  getContext(type) {
    if (this.tagName === 'CANVAS') {
      if (!this._ctx) {
        this._ctx = new MockCanvasContext2D(this);
      }
      return this._ctx;
    }
    return null;
  }

  appendChild(child) {
    this.children.push(child);
    child.parentElement = this;
    return child;
  }

  removeChild(child) {
    const idx = this.children.indexOf(child);
    if (idx !== -1) {
      this.children.splice(idx, 1);
      child.parentElement = null;
    }
    return child;
  }

  addEventListener(event, handler) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, []);
    }
    this.listeners.get(event).push(handler);
  }

  removeEventListener(event, handler) {
    if (this.listeners.has(event)) {
      const list = this.listeners.get(event);
      const idx = list.indexOf(handler);
      if (idx !== -1) list.splice(idx, 1);
    }
  }

  dispatchEvent(event) {
    const list = this.listeners.get(event.type) || [];
    for (const h of list) {
      h(event);
    }
    return true;
  }

  click() {
    this.dispatchEvent({ type: 'click', target: this });
  }

  querySelector(selector) {
    return this.children[0] || null;
  }

  querySelectorAll(selector) {
    return [...this.children];
  }
}

class MockLocalStorage {
  constructor() {
    this.store = new Map();
  }
  getItem(key) {
    return this.store.has(key) ? this.store.get(key) : null;
  }
  setItem(key, value) {
    this.store.set(key, String(value));
  }
  removeItem(key) {
    this.store.delete(key);
  }
  clear() {
    this.store.clear();
  }
}

class MockAudioContext {
  constructor() {
    this.currentTime = 0;
    this.state = 'running';
    this.destination = {};
  }
  createGain() {
    return {
      gain: {
        value: 1,
        setValueAtTime() {},
        linearRampToValueAtTime() {},
        exponentialRampToValueAtTime() {},
      },
      connect() {},
    };
  }
  createOscillator() {
    return {
      type: 'sine',
      frequency: {
        setValueAtTime() {},
        linearRampToValueAtTime() {},
        exponentialRampToValueAtTime() {},
      },
      connect() {},
      start() {},
      stop() {},
    };
  }
  createBuffer() {
    return { getChannelData: () => new Float32Array(1024) };
  }
  createBufferSource() {
    return {
      buffer: null,
      connect() {},
      start() {},
      stop() {},
    };
  }
  resume() {
    return Promise.resolve();
  }
}

export function setupBrowserShim() {
  if (typeof globalThis.window === 'undefined') {
    globalThis.window = globalThis;
  }

  globalThis.window.innerWidth = 1920;
  globalThis.window.innerHeight = 1080;
  globalThis.window.devicePixelRatio = 1;

  if (typeof globalThis.document === 'undefined') {
    const elementsById = new Map();

    globalThis.document = {
      createElement(tag) {
        return new MockElement(tag);
      },
      getElementById(id) {
        if (!elementsById.has(id)) {
          const el = new MockElement('div');
          el.id = id;
          elementsById.set(id, el);
        }
        return elementsById.get(id);
      },
      querySelector(sel) {
        return new MockElement('div');
      },
      querySelectorAll(sel) {
        return [];
      },
      addEventListener() {},
      removeEventListener() {},
      body: new MockElement('body'),
    };
  }

  if (typeof globalThis.localStorage === 'undefined') {
    globalThis.localStorage = new MockLocalStorage();
  }

  if (typeof globalThis.AudioContext === 'undefined') {
    globalThis.AudioContext = MockAudioContext;
  }

  if (typeof globalThis.requestAnimationFrame === 'undefined') {
    globalThis.requestAnimationFrame = (cb) => setTimeout(() => cb(Date.now()), 16);
    globalThis.cancelAnimationFrame = (id) => clearTimeout(id);
  }

  if (typeof globalThis.HTMLCanvasElement === 'undefined') {
    globalThis.HTMLCanvasElement = MockElement;
  }
}

// Auto-run shim on import
setupBrowserShim();
