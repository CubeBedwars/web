/**
 * tests/stress_m5_touch_challenger.js
 * Empirical Adversarial Challenger Stress Harness for Milestone 5 Touch Controls.
 * 
 * Conducts extensive mathematical stress, boundary fuzzing, multi-touch race condition
 * simulation, and physical player integration tests on src/ui/TouchControls.js.
 */

import fs from 'fs';
import path from 'path';
import * as THREE from 'three';
import './mocks/browser-shim.js';

if (globalThis.HTMLCanvasElement && globalThis.HTMLCanvasElement.prototype) {
  globalThis.HTMLCanvasElement.prototype.getBoundingClientRect = function() {
    return { left: 0, top: 0, right: 300, bottom: 300, width: 300, height: 300 };
  };
}

import {
  TouchControls,
  isTouchDevice,
  isDeadzone,
  calculateJoystickVector,
  applyLookDelta,
} from '../src/ui/TouchControls.js';

import { LocalPlayer } from '../src/entities/LocalPlayer.js';
import { Physics } from '../src/engine/Physics.js';
import { VoxelWorld } from '../src/engine/VoxelWorld.js';

let passed = 0;
let failed = 0;
const errors = [];

function assert(condition, desc) {
  if (!condition) {
    throw new Error(`Assertion failed: ${desc}`);
  }
}

function assertApprox(actual, expected, tol = 1e-5, desc = '') {
  const diff = Math.abs(actual - expected);
  if (diff > tol) {
    throw new Error(`Expected ${actual} ≈ ${expected} within ±${tol} (diff: ${diff}). ${desc}`);
  }
}

async function runTest(name, fn) {
  try {
    await fn();
    passed++;
    console.log(`  [PASS] ${name}`);
  } catch (err) {
    failed++;
    errors.push({ name, err });
    console.error(`  [FAIL] ${name}: ${err.message}`);
  }
}

console.log(`\n======================================================================`);
console.log(`  CHALLENGER STRESS HARNESS: TouchControls Empirical Verification`);
console.log(`======================================================================\n`);

// ============================================================================
// 1. JOYSTICK VECTOR MATH & EXTREME BOUNDARY INPUTS
// ============================================================================
console.log(`  ► Group 1: Joystick Vector Math & Extreme Boundary Inputs`);

await runTest('1.1: Micro-displacement (0, 0) outputs exact zero vector inside deadzone', () => {
  const res = calculateJoystickVector(0, 0, 50, 0.1);
  assert(res.x === 0 && res.y === 0, 'Must be 0, 0');
  assert(res.inDeadzone === true, 'Must flag inDeadzone');
  assert(res.rawDistance === 0, 'rawDistance is 0');
});

await runTest('1.2: Fuzz 5,000 sub-deadzone micro-displacements across radii 20..200', () => {
  for (let i = 0; i < 5000; i++) {
    const maxR = 20 + Math.random() * 180;
    const deadzoneRatio = 0.05 + Math.random() * 0.2; // 5% to 25%
    const deadzoneDist = maxR * deadzoneRatio;

    // Pick distance strictly inside deadzone [0, deadzoneDist - 1e-5]
    const dist = Math.random() * (deadzoneDist - 1e-4);
    const theta = Math.random() * 2 * Math.PI;
    const dx = Math.cos(theta) * dist;
    const dy = Math.sin(theta) * dist;

    const res = calculateJoystickVector(dx, dy, maxR, deadzoneRatio);
    assert(res.x === 0 && res.y === 0, `Micro-displacement (${dx}, ${dy}) must be {0, 0}`);
    assert(res.inDeadzone === true, `Must be inDeadzone`);
  }
});

await runTest('1.3: Boundary precision at deadzone boundary threshold', () => {
  const maxR = 50;
  const deadzoneRatio = 0.1;
  const threshold = maxR * deadzoneRatio; // 5.0

  // Just below threshold
  const sub = calculateJoystickVector(threshold - 1e-7, 0, maxR, deadzoneRatio);
  assert(sub.x === 0 && sub.y === 0, 'Just below threshold must be zero');
  assert(sub.inDeadzone === true, 'Just below must be inDeadzone');

  // Just above threshold
  const supra = calculateJoystickVector(threshold + 1e-5, 0, maxR, deadzoneRatio);
  assert(supra.inDeadzone === false, 'Just above threshold must exit deadzone');
  assert(supra.x > 0, 'Just above threshold x must be positive');
  assert(supra.x < 0.001, 'Just above threshold x must be small and smooth');
});

await runTest('1.4: Extreme out-of-bounds drags strictly clamped to unit circle (magnitude <= 1.0)', () => {
  const extremeDistances = [100, 500, 1000, 10000, 500000, 1e7];
  for (const d of extremeDistances) {
    for (let angleDeg = 0; angleDeg < 360; angleDeg += 15) {
      const rad = (angleDeg * Math.PI) / 180;
      const dx = Math.cos(rad) * d;
      const dy = Math.sin(rad) * d;

      const res = calculateJoystickVector(dx, dy, 55, 0.1);
      const mag = Math.hypot(res.x, res.y);
      assert(mag <= 1.00000001, `Magnitude ${mag} exceeded 1.0 at distance ${d}, angle ${angleDeg}°`);
      assertApprox(mag, 1.0, 1e-5, `Extreme drag at dist ${d} must clamp to 1.0`);
    }
  }
});

await runTest('1.5: Fuzz 5,000 random angles to verify 360-degree angle conservation', () => {
  for (let i = 0; i < 5000; i++) {
    const angle = (Math.random() * 2 - 1) * Math.PI; // [-PI, PI]
    const dist = 10 + Math.random() * 300; // Above deadzone
    const dx = Math.cos(angle) * dist;
    const dy = Math.sin(angle) * dist;

    const res = calculateJoystickVector(dx, dy, 50, 0.1);
    // Since TouchControls inverts y for forward: res.y = -sin(angle)*dist
    const resAngle = Math.atan2(-res.y, res.x);
    assertApprox(resAngle, angle, 1e-5, `Angle must be preserved exactly for ${angle}`);
  }
});

await runTest('1.6: Directional Cardinal & Diagonal Sign Checks', () => {
  // Pure Forward (dy < 0): vec.y should be +1
  const fwd = calculateJoystickVector(0, -60, 50, 0.1);
  assertApprox(fwd.x, 0.0);
  assertApprox(fwd.y, 1.0);

  // Pure Backward (dy > 0): vec.y should be -1
  const bwd = calculateJoystickVector(0, 60, 50, 0.1);
  assertApprox(bwd.x, 0.0);
  assertApprox(bwd.y, -1.0);

  // Pure Right (dx > 0): vec.x should be +1
  const rgt = calculateJoystickVector(60, 0, 50, 0.1);
  assertApprox(rgt.x, 1.0);
  assertApprox(rgt.y, 0.0);

  // Pure Left (dx < 0): vec.x should be -1
  const lft = calculateJoystickVector(-60, 0, 50, 0.1);
  assertApprox(lft.x, -1.0);
  assertApprox(lft.y, 0.0);

  // Forward-Right diagonal: x > 0, y > 0
  const diagFR = calculateJoystickVector(60, -60, 50, 0.1);
  assert(diagFR.x > 0 && diagFR.y > 0, 'FR must have x>0, y>0');
  assertApprox(Math.hypot(diagFR.x, diagFR.y), 1.0);

  // Backward-Left diagonal: x < 0, y < 0
  const diagBL = calculateJoystickVector(-60, 60, 50, 0.1);
  assert(diagBL.x < 0 && diagBL.y < 0, 'BL must have x<0, y<0');
  assertApprox(Math.hypot(diagBL.x, diagBL.y), 1.0);
});

await runTest('1.7: Monotonic magnitude scaling between deadzone and maxRadius', () => {
  const maxR = 60;
  const deadzone = 0.1;
  const deadDist = maxR * deadzone; // 6
  let lastMag = -1;

  for (let dist = deadDist + 0.1; dist < maxR; dist += 0.5) {
    const res = calculateJoystickVector(dist, 0, maxR, deadzone);
    const mag = Math.hypot(res.x, res.y);
    assert(mag > lastMag, `Magnitude must monotonically increase (got ${mag} <= ${lastMag} at dist ${dist})`);
    assert(mag >= 0.0 && mag <= 1.0, `Magnitude must be in [0, 1]`);
    lastMag = mag;
  }

  // Exactly at maxRadius
  const atMax = calculateJoystickVector(maxR, 0, maxR, deadzone);
  const maxMag = Math.hypot(atMax.x, atMax.y);
  assertApprox(maxMag, 1.0, 1e-5, 'At maxRadius, magnitude must reach 1.0');
});

// ============================================================================
// 2. CAMERA LOOK DRAG & ZENITH/NADIR CLAMPING
// ============================================================================
console.log(`\n  ► Group 2: Camera Look Drag & Zenith/Nadir Clamping`);

await runTest('2.1: Yaw and Pitch translation sensitivity precision', () => {
  const player = { yaw: 0, pitch: 0 };
  const sens = 0.0035;

  // Drag right 100px: yaw should decrease by 100 * 0.0035 = 0.35
  applyLookDelta(player, 100, 0, sens);
  assertApprox(player.yaw, -0.35, 1e-5);
  assertApprox(player.pitch, 0, 1e-5);

  // Drag down 50px: pitch should decrease by 50 * 0.0035 = 0.175
  applyLookDelta(player, 0, 50, sens);
  assertApprox(player.yaw, -0.35, 1e-5);
  assertApprox(player.pitch, -0.175, 1e-5);
});

await runTest('2.2: Extreme look drag pitch clamping prevents camera flipping upside-down', () => {
  const player = { yaw: 0, pitch: 0 };
  const maxPitch = Math.PI / 2 - 0.01;
  const minPitch = -Math.PI / 2 + 0.01;

  // Massive downward drag (10,000,000px)
  applyLookDelta(player, 0, 10000000, 0.0035);
  assertApprox(player.pitch, minPitch, 1e-5, 'Pitch must clamp at nadir');
  assert(player.pitch >= minPitch && player.pitch <= maxPitch, 'Must stay within bounds');

  // Massive upward drag (-20,000,000px)
  applyLookDelta(player, 0, -20000000, 0.0035);
  assertApprox(player.pitch, maxPitch, 1e-5, 'Pitch must clamp at zenith');
  assert(player.pitch >= minPitch && player.pitch <= maxPitch, 'Must stay within bounds');
});

await runTest('2.3: 10,000 random look drag iterations preserve strict pitch bounds', () => {
  const player = { yaw: Math.PI, pitch: 0 };
  const maxPitch = Math.PI / 2 - 0.01;
  const minPitch = -Math.PI / 2 + 0.01;

  for (let i = 0; i < 10000; i++) {
    const dx = (Math.random() - 0.5) * 2000;
    const dy = (Math.random() - 0.5) * 2000;
    applyLookDelta(player, dx, dy, 0.0035);
    assert(player.pitch >= minPitch - 1e-9 && player.pitch <= maxPitch + 1e-9,
      `Pitch ${player.pitch} violated bounds [${minPitch}, ${maxPitch}] at iteration ${i}`);
  }
});

await runTest('2.4: applyLookDelta safely handles null or undefined player without throwing', () => {
  applyLookDelta(null, 100, 100);
  applyLookDelta(undefined, 100, 100);
  assert(true, 'Must not throw');
});

// ============================================================================
// 3. ACTION BUTTONS & PHYSICAL PLAYER INTEGRATION
// ============================================================================
console.log(`\n  ► Group 3: Action Buttons & Physical Player Integration`);

globalThis.window.addEventListener = globalThis.window.addEventListener || (() => {});
globalThis.window.removeEventListener = globalThis.window.removeEventListener || (() => {});

const mockScene = new THREE.Scene();
const mockWorld = new VoxelWorld(mockScene);
const mockPhysics = new Physics(mockWorld);
const mockCamera = new THREE.PerspectiveCamera(75, 1, 0.05, 1000);
const mockCanvas = {
  addEventListener: () => {},
  removeEventListener: () => {},
  getBoundingClientRect: () => ({ left: 0, top: 0, width: 800, height: 600 }),
  requestPointerLock: () => {},
};

const localPlayer = new LocalPlayer('player_test', 'ChallengerBot', 'Red', mockCamera, mockCanvas);

const mockGM = {
  localPlayer: localPlayer,
  world: mockWorld,
  physics: mockPhysics,
  hud: {
    shopModal: { classList: { contains: (c) => c === 'hidden', add: () => {}, remove: () => {} } },
    upgradesModal: { classList: { contains: (c) => c === 'hidden', toggle: () => {} } },
    openShopCalled: false,
    closeShopCalled: false,
    hotbarUpdateCount: 0,
    openShop() { this.openShopCalled = true; },
    closeShop() { this.closeShopCalled = true; },
    updateHotbar() { this.hotbarUpdateCount++; },
  },
  isLeftMouseDown: false,
  handleLeftClickCount: 0,
  handleRightClickCount: 0,
  stopMiningCount: 0,
  handleLeftClick() { this.handleLeftClickCount++; },
  handleRightClick() { this.handleRightClickCount++; },
  stopMining() { this.stopMiningCount++; },
};

const tc = new TouchControls(mockGM, { maxRadius: 50, deadzone: 0.1 });

await runTest('3.1: Jump button sets touchJump and applies 8.5 impulse on ground', () => {
  localPlayer.onGround = true;
  localPlayer.velocity.y = 0;
  tc.onJumpPress();
  assert(localPlayer.velocity.y === 8.5, `Jump velocity must be 8.5, got ${localPlayer.velocity.y}`);
  assert(localPlayer.onGround === false, `onGround must be false after jump`);
  assert(localPlayer.touchJump === true, `touchJump flag must be set`);

  tc.onJumpRelease();
  assert(localPlayer.touchJump === false, `touchJump must clear on release`);
});

await runTest('3.2: Attack button maintains continuous left mouse button state during hold and clears on release', () => {
  mockGM.isLeftMouseDown = false;
  mockGM.handleLeftClickCount = 0;
  mockGM.stopMiningCount = 0;

  // Press
  tc.onAttackPress();
  assert(mockGM.isLeftMouseDown === true, 'isLeftMouseDown must be true');
  assert(mockGM.handleLeftClickCount === 1, 'handleLeftClick must be called once');

  // Simulate multiple ticks of holding
  for (let tick = 0; tick < 20; tick++) {
    tc.update(0.016);
    assert(mockGM.isLeftMouseDown === true, `isLeftMouseDown must remain true during hold tick ${tick}`);
  }

  // Release
  tc.onAttackRelease();
  assert(mockGM.isLeftMouseDown === false, 'isLeftMouseDown must be false after release');
  assert(mockGM.stopMiningCount === 1, 'stopMining must be called on release');
});

await runTest('3.3: Place button triggers handleRightClick for placing / shop / interaction', () => {
  mockGM.handleRightClickCount = 0;
  tc.onPlacePress();
  assert(mockGM.handleRightClickCount === 1, 'handleRightClick must be called on place press');
});

await runTest('3.4: Sneak button toggles sneak state and modifies LocalPlayer speed strictly by 55%', () => {
  // Reset sneak
  tc.isSneaking = false;
  localPlayer.isSneaking = false;
  localPlayer.onGround = true;
  localPlayer.speedMultiplier = 1.0;

  // Toggle sneak ON
  tc.onSneakToggle();
  assert(tc.isSneaking === true, 'TouchControls.isSneaking must be true');
  assert(localPlayer.isSneaking === true, 'LocalPlayer.isSneaking must be true');

  // Verify player velocity under sneak
  localPlayer.touchMoveVector = { x: 0, y: 1.0 };
  localPlayer.yaw = 0;
  localPlayer.update(0.016, mockPhysics);

  const actualSneakSpeed = Math.hypot(localPlayer.velocity.x, localPlayer.velocity.z);

  // Toggle sneak OFF
  tc.onSneakToggle();
  assert(tc.isSneaking === false, 'TouchControls.isSneaking must be false');
  assert(localPlayer.isSneaking === false, 'LocalPlayer.isSneaking must be false');

  localPlayer.update(0.016, mockPhysics);
  const normalSpeed = Math.hypot(localPlayer.velocity.x, localPlayer.velocity.z);

  // Verify that sneak speed is strictly 55% of normal speed
  const sneakRatio = actualSneakSpeed / normalSpeed;
  assertApprox(sneakRatio, 0.55, 1e-4, `Sneak speed ratio must be strictly 0.55 (got ${sneakRatio})`);
  assertApprox(actualSneakSpeed, 4.8 * 0.55 * 0.92, 1e-3, `Sneak speed must match 4.8 * 0.55 * 0.92`);
});

// ============================================================================
// 4. TOUCH HOTBAR DIRECT SLOT SELECTION
// ============================================================================
console.log(`\n  ► Group 4: Touch Hotbar Direct Slot Selection`);

await runTest('4.1: Direct slot tap selection for all 9 hotbar slots (0 to 8)', () => {
  for (let slot = 0; slot < 9; slot++) {
    const prevUpdates = mockGM.hud.hotbarUpdateCount;
    tc.selectHotbarSlot(slot);
    assert(localPlayer.selectedSlot === slot, `selectedSlot must be ${slot}, got ${localPlayer.selectedSlot}`);
    assert(mockGM.hud.hotbarUpdateCount === prevUpdates + 1, 'HUD updateHotbar must be called');
  }
});

await runTest('4.2: Boundary rejection for invalid slots (< 0 or > 8)', () => {
  tc.selectHotbarSlot(3);
  assert(localPlayer.selectedSlot === 3);

  // Negative slots
  tc.selectHotbarSlot(-1);
  assert(localPlayer.selectedSlot === 3, 'Negative slot must be ignored');
  tc.selectHotbarSlot(-99);
  assert(localPlayer.selectedSlot === 3, 'Extreme negative slot must be ignored');

  // Slots >= 9
  tc.selectHotbarSlot(9);
  assert(localPlayer.selectedSlot === 3, 'Slot 9 must be ignored');
  tc.selectHotbarSlot(100);
  assert(localPlayer.selectedSlot === 3, 'Slot 100 must be ignored');
});

// ============================================================================
// 5. MULTI-TOUCH CONCURRENCY & POINTER ID ISOLATION
// ============================================================================
console.log(`\n  ► Group 5: Multi-Touch Concurrency & Pointer ID Isolation`);

await runTest('5.1: Independent concurrent pointers for joystick and look drag', () => {
  // Start joystick with pointerId 101
  tc.handleJoystickStart({ pointerId: 101, clientX: 100, clientY: 200 });
  assert(tc.joystickTouchId === 101, 'Joystick touchId should be 101');

  // Start look drag with pointerId 202
  tc.handleLookStart({ pointerId: 202, clientX: 600, clientY: 300 });
  assert(tc.lookTouchId === 202, 'Look touchId should be 202');

  // Move joystick with pointerId 101
  tc.handleJoystickMove({ pointerId: 101, clientX: 100, clientY: 150 });
  assert(tc.moveVector.y > 0.5, 'Joystick must respond to pointer 101');

  // Move look with pointerId 202
  const prevYaw = localPlayer.yaw;
  tc.handleLookMove({ pointerId: 202, clientX: 650, clientY: 300 });
  assert(localPlayer.yaw !== prevYaw, 'Look must respond to pointer 202');

  // Release look pointer 202: joystick 101 must remain intact!
  tc.handleLookEnd();
  assert(tc.lookTouchId === null, 'Look touchId cleared');
  assert(tc.joystickTouchId === 101, 'Joystick touchId 101 MUST remain active');
  assert(tc.moveVector.y > 0.5, 'Joystick move vector must remain active');

  // Release joystick pointer 101
  tc.handleJoystickEnd();
  assert(tc.joystickTouchId === null, 'Joystick touchId cleared');
  assert(tc.moveVector.x === 0 && tc.moveVector.y === 0, 'Move vector reset to 0');
});

await runTest('5.2: Ignore unrelated pointer IDs on move', () => {
  tc.handleJoystickStart({ pointerId: 50, clientX: 50, clientY: 50 });
  const vecBefore = { ...tc.moveVector };

  // Pointer 999 moves
  tc.handleJoystickMove({ pointerId: 999, clientX: 999, clientY: 999 });
  assert(tc.joystickTouchId === 50, 'touchId remains 50');

  tc.handleJoystickEnd();
});

await runTest('5.3: Lifecycle enable/disable, toggle, and destroy', () => {
  tc.setEnabled(false);
  assert(tc.isEnabled === false, 'Must be disabled');
  assert(tc.container.classList.contains('hidden'), 'Container must have hidden class');

  tc.setEnabled(true);
  assert(tc.isEnabled === true, 'Must be enabled');
  assert(!tc.container.classList.contains('hidden'), 'Container must not have hidden class');

  const toggled = tc.toggle();
  assert(toggled === false, 'Toggled to false');
  assert(tc.isEnabled === false, 'State matches toggle');

  tc.toggle(); // restore true
  assert(tc.isEnabled === true, 'Restored to true');
});

// ============================================================================
// 6. ADVERSARIAL FUZZING & INTENSIVE STRESS INVARIANTS
// ============================================================================
console.log(`\n  ► Group 6: Adversarial Fuzzing & Intensive Stress Invariants`);

await runTest('6.1: Defensive handling of extreme/invalid parameters in calculateJoystickVector', () => {
  // maxRadius <= 0 returns deadzone
  const zeroR = calculateJoystickVector(10, 10, 0, 0.1);
  assert(zeroR.inDeadzone === true && zeroR.x === 0 && zeroR.y === 0, 'Zero maxRadius must default to deadzone');

  const negR = calculateJoystickVector(10, 10, -50, 0.1);
  assert(negR.inDeadzone === true && negR.x === 0 && negR.y === 0, 'Negative maxRadius must default to deadzone');

  // Negative zero
  const negZero = calculateJoystickVector(-0, -0, 50, 0.1);
  assert(negZero.inDeadzone === true && negZero.x === 0 && negZero.y === 0, 'Negative zero handled');
});

await runTest('6.2: High-frequency attack press/release stress (1,000 cycles)', () => {
  mockGM.isLeftMouseDown = false;
  mockGM.handleLeftClickCount = 0;
  mockGM.stopMiningCount = 0;

  for (let cycle = 0; cycle < 1000; cycle++) {
    tc.onAttackPress();
    assert(mockGM.isLeftMouseDown === true, `isLeftMouseDown must be true on press cycle ${cycle}`);
    tc.onAttackRelease();
    assert(mockGM.isLeftMouseDown === false, `isLeftMouseDown must be false on release cycle ${cycle}`);
  }
  assert(mockGM.handleLeftClickCount === 1000, 'All 1000 presses registered');
  assert(mockGM.stopMiningCount === 1000, 'All 1000 releases registered');
});

await runTest('6.3: High-frequency rapid joystick touch cycles (1,000 cycles)', () => {
  for (let cycle = 0; cycle < 1000; cycle++) {
    const pId = 1000 + cycle;
    tc.handleJoystickStart({ pointerId: pId, clientX: 100, clientY: 100 });
    tc.handleJoystickMove({ pointerId: pId, clientX: 130, clientY: 70 });
    tc.handleJoystickEnd();
  }
  assert(tc.joystickTouchId === null, 'Joystick touchId must be null after cycles');
  assert(tc.moveVector.x === 0 && tc.moveVector.y === 0, 'Move vector must be reset to zero');
});

await runTest('6.4: Full 360-degree walking simulation in LocalPlayer', () => {
  localPlayer.onGround = true;
  localPlayer.isDead = false;
  localPlayer.keys = { forward: false, backward: false, left: false, right: false, jump: false, sprint: false };

  for (let deg = 0; deg < 360; deg += 5) {
    const rad = (deg * Math.PI) / 180;
    // Set joystick vector in this direction
    const jx = Math.cos(rad);
    const jy = Math.sin(rad);

    localPlayer.touchMoveVector = { x: jx, y: jy };
    localPlayer.position.set(0, 10, 0);
    localPlayer.velocity.set(0, 0, 0);
    localPlayer.yaw = 0; // facing -Z

    localPlayer.update(0.016, mockPhysics);

    assert(Number.isFinite(localPlayer.position.x), `Position X must be finite at ${deg}°`);
    assert(Number.isFinite(localPlayer.position.y), `Position Y must be finite at ${deg}°`);
    assert(Number.isFinite(localPlayer.position.z), `Position Z must be finite at ${deg}°`);
    assert(Number.isFinite(localPlayer.velocity.x), `Velocity X must be finite at ${deg}°`);
    assert(Number.isFinite(localPlayer.velocity.z), `Velocity Z must be finite at ${deg}°`);
  }
});

await runTest('6.5: Simultaneous concurrent multi-action execution', () => {
  // Activate Jump, Attack, Place, Sneak simultaneously
  localPlayer.onGround = true;
  tc.onJumpPress();
  tc.onAttackPress();
  tc.onPlacePress();
  tc.onSneakToggle();

  assert(localPlayer.touchJump === true, 'Jump active');
  assert(mockGM.isLeftMouseDown === true, 'Attack active');
  assert(mockGM.handleRightClickCount >= 1, 'Place executed');
  assert(tc.isSneaking === true, 'Sneak active');

  // Clear all
  tc.onJumpRelease();
  tc.onAttackRelease();
  tc.onSneakToggle();

  assert(localPlayer.touchJump === false, 'Jump cleared');
  assert(mockGM.isLeftMouseDown === false, 'Attack cleared');
  assert(tc.isSneaking === false, 'Sneak cleared');
});

// ============================================================================
// GRAND REPORT
// ============================================================================
console.log(`\n======================================================================`);
console.log(`  CHALLENGER STRESS HARNESS SUMMARY`);
console.log(`======================================================================`);
console.log(`  Total Invariants Tested: ${passed + failed}`);
console.log(`  Passed:                  ${passed}`);
console.log(`  Failed:                  ${failed}`);
console.log(`======================================================================\n`);

if (failed > 0) {
  console.error(`FAILED TESTS:`);
  errors.forEach(({ name, err }) => {
    console.error(`  - ${name}: ${err.message}`);
  });
  process.exit(1);
} else {
  console.log(`ALL ${passed} CHALLENGER EMPIRICAL STRESS TESTS PASSED!\n`);
  process.exit(0);
}
