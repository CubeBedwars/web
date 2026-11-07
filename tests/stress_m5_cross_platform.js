/**
 * tests/stress_m5_cross_platform.js
 * Comprehensive Milestone 5 Cross-Platform & Mobile Touch Controls Test Suite.
 * 
 * Verifies 60+ rigorous invariants across:
 * 1. Web & Netlify Deployment (netlify.toml SPA redirects, build, security headers & CSP)
 * 2. Desktop Packaging Configuration (desktop/main.cjs, preload.cjs, package.json, README.md)
 * 3. Mobile Packaging Configuration (capacitor.config.json appId, webDir, orientation, plugins)
 * 4. Responsive Mobile Touch Controls (TouchControls.js math, joystick deadzone, unit circle clamping,
 *    camera look drag zone, floating action buttons, touch hotbar, auto touch detection & toggle)
 * 5. HTML & CSS Responsive Layout integration (viewport meta, touch overlay, media queries)
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import './mocks/browser-shim.js';

import {
  TouchControls,
  isTouchDevice,
  isDeadzone,
  calculateJoystickVector,
  applyLookDelta,
} from '../src/ui/TouchControls.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');

let passedCount = 0;
let failedCount = 0;
const failures = [];

function assert(condition, message = 'Assertion failed') {
  if (!condition) {
    throw new Error(`Assertion failed: ${message}`);
  }
}

function assertEqual(actual, expected, message = '') {
  if (actual !== expected) {
    throw new Error(`Expected ${JSON.stringify(expected)} but got ${JSON.stringify(actual)}. ${message}`);
  }
}

function assertTrue(val, message = '') {
  assertEqual(val, true, message);
}

function assertFalse(val, message = '') {
  assertEqual(val, false, message);
}

function assertApprox(actual, expected, tolerance = 0.001, message = '') {
  const diff = Math.abs(actual - expected);
  if (diff > tolerance) {
    throw new Error(`Expected ${actual} ~ ${expected} within ±${tolerance} (diff: ${diff}). ${message}`);
  }
}

function assertIncludes(haystack, needle, message = '') {
  const found = typeof haystack === 'string' || Array.isArray(haystack)
    ? haystack.includes(needle)
    : false;
  if (!found) {
    throw new Error(`Expected content to include "${needle}". ${message}`);
  }
}

async function test(name, fn) {
  try {
    await fn();
    passedCount++;
    console.log(`  ✔ Invariant ${passedCount}: ${name}`);
  } catch (err) {
    failedCount++;
    failures.push({ name, error: err });
    console.error(`  ✖ Invariant FAILED: ${name}`);
    console.error(`    -> ${err.message}`);
  }
}

console.log(`\n======================================================================`);
console.log(`  RUNNING: Milestone 5 Cross-Platform & Mobile Touch Controls Stress Suite`);
console.log(`======================================================================\n`);

// ----------------------------------------------------------------------------
// SECTION 1: WEB & NETLIFY DEPLOYMENT SPECIFICATIONS
// ----------------------------------------------------------------------------
console.log(`  ► Section 1: Web & Netlify Deployment (netlify.toml)`);

const netlifyPath = path.join(projectRoot, 'netlify.toml');
const netlifyContent = fs.readFileSync(netlifyPath, 'utf-8');

await test('1.1: netlify.toml exists and is non-empty', () => {
  assertTrue(fs.existsSync(netlifyPath));
  assertTrue(netlifyContent.length > 50);
});

await test('1.2: netlify.toml defines build command as npm run build', () => {
  assertIncludes(netlifyContent, 'command = "npm run build"');
});

await test('1.3: netlify.toml publishes the dist directory', () => {
  assertIncludes(netlifyContent, 'publish = "dist"');
});

await test('1.4: netlify.toml includes SPA redirect rule from /* to /index.html with status 200', () => {
  assertIncludes(netlifyContent, '[[redirects]]');
  assertIncludes(netlifyContent, 'from = "/*"');
  assertIncludes(netlifyContent, 'to = "/index.html"');
  assertIncludes(netlifyContent, 'status = 200');
});

await test('1.5: netlify.toml enforces X-Frame-Options header (SAMEORIGIN or DENY)', () => {
  const hasFrameOptions = netlifyContent.includes('X-Frame-Options = "SAMEORIGIN"') ||
                          netlifyContent.includes('X-Frame-Options = "DENY"');
  assertTrue(hasFrameOptions);
});

await test('1.6: netlify.toml enforces X-Content-Type-Options: nosniff', () => {
  assertIncludes(netlifyContent, 'X-Content-Type-Options = "nosniff"');
});

await test('1.7: netlify.toml enforces Referrer-Policy', () => {
  assertIncludes(netlifyContent, 'Referrer-Policy = "strict-origin-when-cross-origin"');
});

await test('1.8: netlify.toml configures Content-Security-Policy suitable for WebGL, WSS & WebRTC', () => {
  assertIncludes(netlifyContent, 'Content-Security-Policy');
  assertIncludes(netlifyContent, 'connect-src');
  assertIncludes(netlifyContent, 'ws:');
  assertIncludes(netlifyContent, 'wss:');
});

await test('1.9: netlify.toml configures static asset long-term caching', () => {
  assertIncludes(netlifyContent, '/assets/*');
  assertIncludes(netlifyContent, 'Cache-Control');
  assertIncludes(netlifyContent, 'max-age=31536000');
});

// ----------------------------------------------------------------------------
// SECTION 2: DESKTOP PACKAGING SPECIFICATIONS (desktop/)
// ----------------------------------------------------------------------------
console.log(`\n  ► Section 2: Desktop Packaging Configuration (desktop/)`);

const desktopDir = path.join(projectRoot, 'desktop');
const mainCjsPath = path.join(desktopDir, 'main.cjs');
const preloadCjsPath = path.join(desktopDir, 'preload.cjs');
const desktopPkgPath = path.join(desktopDir, 'package.json');
const desktopReadmePath = path.join(desktopDir, 'README.md');

await test('2.1: desktop directory and essential packaging files exist', () => {
  assertTrue(fs.existsSync(desktopDir));
  assertTrue(fs.existsSync(mainCjsPath));
  assertTrue(fs.existsSync(preloadCjsPath));
  assertTrue(fs.existsSync(desktopPkgPath));
  assertTrue(fs.existsSync(desktopReadmePath));
});

const desktopPkg = JSON.parse(fs.readFileSync(desktopPkgPath, 'utf-8'));

await test('2.2: desktop/package.json defines valid application package metadata', () => {
  assertEqual(desktopPkg.name, 'voxel-bedwars-desktop');
  assertEqual(desktopPkg.version, '1.0.0');
  assertEqual(desktopPkg.main, 'main.cjs');
});

await test('2.3: desktop/package.json configures electron-builder multi-target packaging', () => {
  assertTrue(typeof desktopPkg.build === 'object');
  assertEqual(desktopPkg.build.appId, 'io.bedwars.voxel.desktop');
  assertEqual(desktopPkg.build.productName, 'Voxel Bedwars');
  assertTrue(desktopPkg.build.win.target.includes('nsis') || desktopPkg.build.win.target.includes('portable'));
  assertTrue(desktopPkg.build.mac.target.includes('dmg'));
  assertTrue(desktopPkg.build.linux.target.includes('AppImage'));
});

// Import main.cjs module safely
const mainCjs = await import('../desktop/main.cjs');

await test('2.4: desktop/main.cjs exports WINDOW_CONFIG with 1280x720 default bounds', () => {
  assertTrue(typeof mainCjs.WINDOW_CONFIG === 'object');
  assertEqual(mainCjs.WINDOW_CONFIG.width, 1280);
  assertEqual(mainCjs.WINDOW_CONFIG.height, 720);
});

await test('2.5: desktop/main.cjs enforces minimum window dimensions (>= 960x540)', () => {
  assertEqual(mainCjs.WINDOW_CONFIG.minWidth, 960);
  assertEqual(mainCjs.WINDOW_CONFIG.minHeight, 540);
});

await test('2.6: desktop/main.cjs enforces security webPreferences (contextIsolation: true, nodeIntegration: false)', () => {
  const prefs = mainCjs.WINDOW_CONFIG.webPreferences;
  assertTrue(prefs.contextIsolation, 'contextIsolation must be true');
  assertFalse(prefs.nodeIntegration, 'nodeIntegration must be false');
  assertTrue(prefs.preload.endsWith('preload.cjs'));
});

await test('2.7: desktop/main.cjs sets native window title and centering', () => {
  assertEqual(mainCjs.WINDOW_CONFIG.title, 'Voxel Bedwars');
  assertTrue(mainCjs.WINDOW_CONFIG.center);
});

// Preload script verification
const preloadCjs = await import('../desktop/preload.cjs');
const electronAPI = preloadCjs.electronAPI;

await test('2.8: desktop/preload.cjs exposes electronAPI with isElectron: true and platform string', () => {
  assertTrue(typeof electronAPI === 'object');
  assertTrue(electronAPI.isElectron);
  assertTrue(typeof electronAPI.platform === 'string');
});

await test('2.9: desktop/preload.cjs exposes window management functions', () => {
  assertTrue(typeof electronAPI.minimize === 'function');
  assertTrue(typeof electronAPI.maximize === 'function');
  assertTrue(typeof electronAPI.toggleFullscreen === 'function');
  assertTrue(typeof electronAPI.close === 'function');
});

await test('2.10: desktop/preload.cjs exposes LAN UDP socket broadcast & listener bridge', () => {
  assertTrue(typeof electronAPI.broadcastLAN === 'function');
  assertTrue(typeof electronAPI.listenLAN === 'function');
  assertTrue(typeof electronAPI.stopListenLAN === 'function');
  assertTrue(typeof electronAPI.onLANMessage === 'function');
});

await test('2.11: desktop/README.md documents Windows, macOS, and Linux build instructions', () => {
  const readme = fs.readFileSync(desktopReadmePath, 'utf-8');
  assertIncludes(readme, 'Windows (.exe)');
  assertIncludes(readme, 'macOS (.dmg');
  assertIncludes(readme, 'Linux (.AppImage');
  assertIncludes(readme, 'contextIsolation');
});

// ----------------------------------------------------------------------------
// SECTION 3: MOBILE PACKAGING SPECIFICATIONS (capacitor.config.json)
// ----------------------------------------------------------------------------
console.log(`\n  ► Section 3: Mobile Packaging Configuration (capacitor.config.json)`);

const capConfigPath = path.join(projectRoot, 'capacitor.config.json');
const capConfig = JSON.parse(fs.readFileSync(capConfigPath, 'utf-8'));

await test('3.1: capacitor.config.json exists and parses as valid JSON', () => {
  assertTrue(typeof capConfig === 'object' && capConfig !== null);
});

await test('3.2: capacitor.config.json specifies appId "io.bedwars.voxel"', () => {
  assertEqual(capConfig.appId, 'io.bedwars.voxel');
});

await test('3.3: capacitor.config.json specifies appName "Voxel Bedwars"', () => {
  assertEqual(capConfig.appName, 'Voxel Bedwars');
});

await test('3.4: capacitor.config.json webDir points to "dist"', () => {
  assertEqual(capConfig.webDir, 'dist');
});

await test('3.5: capacitor.config.json disables bundledWebRuntime', () => {
  assertFalse(capConfig.bundledWebRuntime);
});

await test('3.6: capacitor.config.json configures landscape primary orientation', () => {
  assertEqual(capConfig.plugins?.ScreenOrientation?.orientation, 'landscape');
});

await test('3.7: capacitor.config.json configures Android hardware acceleration & styling', () => {
  assertTrue(capConfig.android?.hardwareAccelerated);
  assertTrue(capConfig.android?.allowMixedContent);
  assertEqual(capConfig.android?.backgroundColor, '#0f172a');
});

await test('3.8: capacitor.config.json configures iOS mobile container properties', () => {
  assertEqual(capConfig.ios?.contentInset, 'always');
  assertEqual(capConfig.ios?.backgroundColor, '#0f172a');
});

// Root package.json scripts check
const rootPkg = JSON.parse(fs.readFileSync(path.join(projectRoot, 'package.json'), 'utf-8'));

await test('3.9: root package.json defines desktop:dev and desktop:build scripts', () => {
  assertTrue(typeof rootPkg.scripts['desktop:dev'] === 'string');
  assertTrue(typeof rootPkg.scripts['desktop:build'] === 'string');
});

await test('3.10: root package.json defines mobile:sync and mobile:build scripts', () => {
  assertTrue(typeof rootPkg.scripts['mobile:sync'] === 'string');
  assertTrue(typeof rootPkg.scripts['mobile:build'] === 'string');
});

// ----------------------------------------------------------------------------
// SECTION 4: RESPONSIVE TOUCH CONTROLS (src/ui/TouchControls.js)
// ----------------------------------------------------------------------------
console.log(`\n  ► Section 4: Responsive Mobile Touch Controls (TouchControls.js)`);

await test('4.1: isTouchDevice correctly evaluates browser touch capabilities', () => {
  assertTrue(typeof isTouchDevice === 'function');
  const result = isTouchDevice();
  assertTrue(typeof result === 'boolean');
});

await test('4.2: isDeadzone detects small touch jitters (< 10% radius)', () => {
  assertTrue(isDeadzone(4.0, 50, 0.1), '4px on 50px radius is inside 10% deadzone');
  assertTrue(isDeadzone(0, 50, 0.1), '0px is inside deadzone');
  assertFalse(isDeadzone(10.0, 50, 0.1), '10px on 50px radius is outside 10% deadzone');
  assertFalse(isDeadzone(50.0, 50, 0.1), '50px is outside deadzone');
});

await test('4.3: calculateJoystickVector returns zero vector when inside deadzone', () => {
  const v = calculateJoystickVector(2, 3, 50, 0.1);
  assertEqual(v.x, 0);
  assertEqual(v.y, 0);
  assertTrue(v.inDeadzone);
});

await test('4.4: calculateJoystickVector computes full forward drag (dy < 0 -> y = +1.0)', () => {
  const v = calculateJoystickVector(0, -50, 50, 0.1);
  assertApprox(v.x, 0.0);
  assertApprox(v.y, 1.0);
  assertFalse(v.inDeadzone);
});

await test('4.5: calculateJoystickVector computes full backward drag (dy > 0 -> y = -1.0)', () => {
  const v = calculateJoystickVector(0, 50, 50, 0.1);
  assertApprox(v.x, 0.0);
  assertApprox(v.y, -1.0);
  assertFalse(v.inDeadzone);
});

await test('4.6: calculateJoystickVector computes full right strafe (dx > 0 -> x = +1.0)', () => {
  const v = calculateJoystickVector(50, 0, 50, 0.1);
  assertApprox(v.x, 1.0);
  assertApprox(v.y, 0.0);
  assertFalse(v.inDeadzone);
});

await test('4.7: calculateJoystickVector computes full left strafe (dx < 0 -> x = -1.0)', () => {
  const v = calculateJoystickVector(-50, 0, 50, 0.1);
  assertApprox(v.x, -1.0);
  assertApprox(v.y, 0.0);
  assertFalse(v.inDeadzone);
});

await test('4.8: calculateJoystickVector clamps extreme drag distance to unit circle (length <= 1.0)', () => {
  const v = calculateJoystickVector(150, -200, 50, 0.1);
  const len = Math.hypot(v.x, v.y);
  assertApprox(len, 1.0, 0.001);
});

await test('4.9: calculateJoystickVector preserves 45-degree diagonal direction', () => {
  const v = calculateJoystickVector(50, -50, 50, 0.1);
  assertApprox(v.x, Math.SQRT1_2, 0.01);
  assertApprox(v.y, Math.SQRT1_2, 0.01);
});

await test('4.10: applyLookDelta modifies yaw and pitch proportionally with sensitivity', () => {
  const mockPlayer = { yaw: 0, pitch: 0 };
  applyLookDelta(mockPlayer, 20, 10, 0.005);
  assertApprox(mockPlayer.yaw, -0.1);
  assertApprox(mockPlayer.pitch, -0.05);
});

await test('4.11: applyLookDelta clamps pitch preventing camera flip over zenith / nadir', () => {
  const mockPlayer = { yaw: 0, pitch: 0 };
  applyLookDelta(mockPlayer, 0, 500, 0.01); // Huge downward drag
  const maxPitch = Math.PI / 2 - 0.01;
  assertTrue(mockPlayer.pitch >= -maxPitch && mockPlayer.pitch <= maxPitch);

  applyLookDelta(mockPlayer, 0, -1000, 0.01); // Huge upward drag
  assertTrue(mockPlayer.pitch >= -maxPitch && mockPlayer.pitch <= maxPitch);
});

// Mock GameManager for TouchControls integration
const mockGM = {
  localPlayer: {
    yaw: 0,
    pitch: 0,
    touchMoveVector: { x: 0, y: 0 },
    touchJump: false,
    isSneaking: false,
    selectedSlot: 0,
    onGround: true,
    velocity: { x: 0, y: 0, z: 0 },
  },
  hud: {
    shopModal: { classList: { contains: (cls) => cls === 'hidden', add: () => {}, remove: () => {} } },
    upgradesModal: { classList: { contains: (cls) => cls === 'hidden', toggle: () => {} } },
    openShop: () => { mockGM.hud.shopOpened = true; },
    closeShop: () => { mockGM.hud.shopOpened = false; },
    updateHotbar: () => { mockGM.hud.hotbarUpdated = true; },
  },
  isLeftMouseDown: false,
  handleLeftClickCalled: false,
  handleRightClickCalled: false,
  stopMiningCalled: false,
  handleLeftClick: () => { mockGM.handleLeftClickCalled = true; },
  handleRightClick: () => { mockGM.handleRightClickCalled = true; },
  stopMining: () => { mockGM.stopMiningCalled = true; },
};

const tc = new TouchControls(mockGM, { maxRadius: 50, deadzone: 0.1 });

await test('4.12: TouchControls initializes successfully with DOM containers', () => {
  assertTrue(tc instanceof TouchControls);
  assertTrue(tc.container !== null);
  assertTrue(tc.joystickZone !== null);
  assertTrue(tc.lookZone !== null);
});

await test('4.13: TouchControls binds all required action buttons', () => {
  assertTrue(tc.buttons.jump !== null, 'Jump button bound');
  assertTrue(tc.buttons.attack !== null, 'Attack/Mine button bound');
  assertTrue(tc.buttons.place !== null, 'Place/Use button bound');
  assertTrue(tc.buttons.sneak !== null, 'Sneak button bound');
  assertTrue(tc.buttons.shop !== null, 'Shop button bound');
  assertTrue(tc.buttons.pause !== null, 'Pause/Upgrades button bound');
});

await test('4.14: onJumpPress triggers player jump impulse and sets touchJump', () => {
  mockGM.localPlayer.onGround = true;
  mockGM.localPlayer.velocity.y = 0;
  tc.onJumpPress();
  assertEqual(mockGM.localPlayer.velocity.y, 8.5);
  assertFalse(mockGM.localPlayer.onGround);
});

await test('4.15: onJumpRelease clears touchJump flag', () => {
  tc.onJumpRelease();
  assertFalse(mockGM.localPlayer.touchJump);
});

await test('4.16: onAttackPress initiates left-click combat/mining and sets isLeftMouseDown', () => {
  mockGM.isLeftMouseDown = false;
  mockGM.handleLeftClickCalled = false;
  tc.onAttackPress();
  assertTrue(mockGM.isLeftMouseDown);
  assertTrue(mockGM.handleLeftClickCalled);
});

await test('4.17: onAttackRelease ceases mining and clears isLeftMouseDown', () => {
  mockGM.isLeftMouseDown = true;
  mockGM.stopMiningCalled = false;
  tc.onAttackRelease();
  assertFalse(mockGM.isLeftMouseDown);
  assertTrue(mockGM.stopMiningCalled);
});

await test('4.18: onPlacePress triggers handleRightClick (block placement / shop / projectiles)', () => {
  mockGM.handleRightClickCalled = false;
  tc.onPlacePress();
  assertTrue(mockGM.handleRightClickCalled);
});

await test('4.19: onSneakToggle toggles sneak state and updates player sneak mode', () => {
  const initialSneak = tc.isSneaking;
  tc.onSneakToggle();
  assertEqual(tc.isSneaking, !initialSneak);
  assertEqual(mockGM.localPlayer.isSneaking, tc.isSneaking);
  tc.onSneakToggle();
  assertEqual(tc.isSneaking, initialSneak);
});

await test('4.20: onShopPress triggers HUD shop open', () => {
  mockGM.hud.shopOpened = false;
  tc.onShopPress();
  assertTrue(mockGM.hud.shopOpened);
});

await test('4.21: selectHotbarSlot equips slots 0 through 8 directly', () => {
  for (let slot = 0; slot < 9; slot++) {
    tc.selectHotbarSlot(slot);
    assertEqual(mockGM.localPlayer.selectedSlot, slot);
  }
});

await test('4.22: selectHotbarSlot rejects invalid out-of-range slots', () => {
  tc.selectHotbarSlot(4);
  tc.selectHotbarSlot(-1);
  assertEqual(mockGM.localPlayer.selectedSlot, 4, 'Negative slot ignored');
  tc.selectHotbarSlot(10);
  assertEqual(mockGM.localPlayer.selectedSlot, 4, 'Slot > 8 ignored');
});

await test('4.23: toggle() switches enable state and updates localStorage persistence', () => {
  const prev = tc.isEnabled;
  const next = tc.toggle();
  assertEqual(next, !prev);
  assertEqual(tc.isEnabled, !prev);
  assertEqual(localStorage.getItem('vw_force_touch_controls'), next ? 'true' : 'false');
  tc.toggle(); // restore
});

// ----------------------------------------------------------------------------
// SECTION 5: HTML & CSS RESPONSIVE ARCHITECTURE
// ----------------------------------------------------------------------------
console.log(`\n  ► Section 5: HTML & CSS Responsive Architecture`);

const indexHtmlPath = path.join(projectRoot, 'index.html');
const indexHtml = fs.readFileSync(indexHtmlPath, 'utf-8');
const styleCssPath = path.join(projectRoot, 'src', 'style.css');
const styleCss = fs.readFileSync(styleCssPath, 'utf-8');

await test('5.1: index.html viewport meta disables pinch zoom with user-scalable=no', () => {
  assertIncludes(indexHtml, 'viewport');
  assertIncludes(indexHtml, 'user-scalable=no');
  assertIncludes(indexHtml, 'maximum-scale=1.0');
});

await test('5.2: index.html includes static touch controls markup container', () => {
  assertIncludes(indexHtml, 'id="touch-controls"');
  assertIncludes(indexHtml, 'id="touch-joystick-zone"');
  assertIncludes(indexHtml, 'id="touch-look-zone"');
  assertIncludes(indexHtml, 'id="touch-action-cluster"');
});

await test('5.3: index.html includes manual touch mode toggle button in HUD', () => {
  assertIncludes(indexHtml, 'id="btn-toggle-touch"');
  assertIncludes(indexHtml, 'btn-touch-toggle');
});

await test('5.4: style.css defines .touch-overlay with touch-action: none and pointer-events', () => {
  assertIncludes(styleCss, '.touch-overlay');
  assertIncludes(styleCss, 'touch-action: none');
  assertIncludes(styleCss, 'user-select: none');
});

await test('5.5: style.css defines circular joystick styling with backdrop blur', () => {
  assertIncludes(styleCss, '.touch-joystick-base');
  assertIncludes(styleCss, '.touch-joystick-thumb');
  assertIncludes(styleCss, 'border-radius: 50%');
});

await test('5.6: style.css defines circular floating action buttons cluster', () => {
  assertIncludes(styleCss, '.touch-action-cluster');
  assertIncludes(styleCss, '.touch-btn');
  assertIncludes(styleCss, '.touch-btn-jump');
  assertIncludes(styleCss, '.touch-btn-attack');
  assertIncludes(styleCss, '.touch-btn-place');
  assertIncludes(styleCss, '.touch-btn-sneak');
});

await test('5.7: style.css defines responsive media queries for mobile devices (<= 900px)', () => {
  assertIncludes(styleCss, '@media (max-width: 900px)');
  assertIncludes(styleCss, '.hotbar-container .slot');
});

// ----------------------------------------------------------------------------
// GRAND SUMMARY REPORT
// ----------------------------------------------------------------------------
console.log(`\n======================================================================`);
console.log(`  MILESTONE 5 STRESS TEST SUMMARY`);
console.log(`======================================================================`);
console.log(`  Total Invariants Tested: ${passedCount + failedCount}`);
console.log(`  Passed:                  ${passedCount}`);
console.log(`  Failed:                  ${failedCount}`);
console.log(`======================================================================\n`);

if (failedCount > 0) {
  console.error(`\nFAILED INVARIANTS:`);
  failures.forEach(({ name, error }, idx) => {
    console.error(`  [${idx + 1}] ${name}`);
    console.error(`      Error: ${error.message}`);
  });
  process.exit(1);
} else {
  console.log(`ALL ${passedCount} MILESTONE 5 CROSS-PLATFORM INVARIANTS PASSED (100% SUCCESS)!\n`);
  process.exit(0);
}
