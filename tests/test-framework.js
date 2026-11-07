/**
 * tests/test-framework.js
 * Standalone, zero-dependency BDD test framework for Voxel Bedwars E2E testing.
 * Provides describe/it blocks, lifecycle hooks, comprehensive assertions,
 * and high-visibility ANSI colored reporting.
 */

// ANSI Color constants
export const COLORS = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  magenta: '\x1b[35m',
  white: '\x1b[37m',
  bgRed: '\x1b[41m',
  bgGreen: '\x1b[42m',
};

class AssertionError extends Error {
  constructor(message, actual, expected) {
    super(message);
    this.name = 'AssertionError';
    this.actual = actual;
    this.expected = expected;
  }
}

// Deep equality helper
function isDeepEqual(a, b) {
  if (Object.is(a, b)) return true;
  if (typeof a !== 'object' || a === null || typeof b !== 'object' || b === null) return false;
  if (Array.isArray(a) !== Array.isArray(b)) return false;

  const keysA = Object.keys(a);
  const keysB = Object.keys(b);
  if (keysA.length !== keysB.length) return false;

  for (const key of keysA) {
    if (!Object.prototype.hasOwnProperty.call(b, key)) return false;
    if (!isDeepEqual(a[key], b[key])) return false;
  }
  return true;
}

// Assertions
export function assert(condition, message = 'Assertion failed') {
  if (!condition) {
    throw new AssertionError(message, condition, true);
  }
}

export function assertEqual(actual, expected, message) {
  if (actual !== expected) {
    const msg = message || `Expected ${JSON.stringify(expected)} but got ${JSON.stringify(actual)}`;
    throw new AssertionError(msg, actual, expected);
  }
}

export function assertNotEqual(actual, expected, message) {
  if (actual === expected) {
    const msg = message || `Expected value NOT to equal ${JSON.stringify(expected)}`;
    throw new AssertionError(msg, actual, expected);
  }
}

export function assertTrue(val, message = 'Expected true') {
  assertEqual(val, true, message);
}

export function assertFalse(val, message = 'Expected false') {
  assertEqual(val, false, message);
}

export function assertDeepEqual(actual, expected, message) {
  if (!isDeepEqual(actual, expected)) {
    const msg = message || `Expected deep equality:\nExpected: ${JSON.stringify(expected, null, 2)}\nActual:   ${JSON.stringify(actual, null, 2)}`;
    throw new AssertionError(msg, actual, expected);
  }
}

export function assertApprox(actual, expected, tolerance = 0.001, message) {
  const diff = Math.abs(actual - expected);
  if (diff > tolerance) {
    const msg = message || `Expected ${actual} to approximate ${expected} within ±${tolerance} (diff: ${diff})`;
    throw new AssertionError(msg, actual, expected);
  }
}

export function assertInRange(val, min, max, message) {
  if (val < min || val > max) {
    const msg = message || `Expected ${val} to be in range [${min}, ${max}]`;
    throw new AssertionError(msg, val, { min, max });
  }
}

export function assertIncludes(haystack, needle, message) {
  let found = false;
  if (typeof haystack === 'string') {
    found = haystack.includes(needle);
  } else if (Array.isArray(haystack)) {
    found = haystack.includes(needle);
  } else if (haystack instanceof Set || haystack instanceof Map) {
    found = haystack.has(needle);
  } else if (typeof haystack === 'object' && haystack !== null) {
    found = Object.prototype.hasOwnProperty.call(haystack, needle);
  }
  if (!found) {
    const msg = message || `Expected ${JSON.stringify(haystack)} to include ${JSON.stringify(needle)}`;
    throw new AssertionError(msg, haystack, needle);
  }
}

export function assertThrows(fn, expectedError, message) {
  let threw = false;
  let caught = null;
  try {
    fn();
  } catch (err) {
    threw = true;
    caught = err;
  }
  if (!threw) {
    throw new AssertionError(message || 'Expected function to throw, but it did not', null, expectedError);
  }
  if (expectedError) {
    if (typeof expectedError === 'string') {
      assert(caught.message && caught.message.includes(expectedError), `Expected error message to include "${expectedError}", got "${caught.message}"`);
    } else if (expectedError instanceof RegExp) {
      assert(expectedError.test(caught.message), `Expected error message to match ${expectedError}, got "${caught.message}"`);
    } else if (typeof expectedError === 'function') {
      assert(caught instanceof expectedError, `Expected error of type ${expectedError.name}, got ${caught.constructor?.name}`);
    }
  }
}

// Test Runner State
class TestRegistry {
  constructor() {
    this.suites = [];
    this.currentSuite = null;
  }

  describe(name, fn) {
    const suite = {
      name,
      tests: [],
      beforeEach: [],
      afterEach: [],
      beforeAll: [],
      afterAll: [],
      parent: this.currentSuite,
    };
    if (this.currentSuite) {
      this.currentSuite.tests.push(suite);
    } else {
      this.suites.push(suite);
    }

    const prevSuite = this.currentSuite;
    this.currentSuite = suite;
    fn();
    this.currentSuite = prevSuite;
  }

  it(name, fn) {
    if (!this.currentSuite) {
      throw new Error(`Test "${name}" must be defined inside a describe block`);
    }
    this.currentSuite.tests.push({
      name,
      fn,
      suite: this.currentSuite,
    });
  }

  beforeEach(fn) {
    if (this.currentSuite) this.currentSuite.beforeEach.push(fn);
  }

  afterEach(fn) {
    if (this.currentSuite) this.currentSuite.afterEach.push(fn);
  }

  beforeAll(fn) {
    if (this.currentSuite) this.currentSuite.beforeAll.push(fn);
  }

  afterAll(fn) {
    if (this.currentSuite) this.currentSuite.afterAll.push(fn);
  }

  clear() {
    this.suites = [];
    this.currentSuite = null;
  }
}

export const registry = new TestRegistry();
export const describe = registry.describe.bind(registry);
export const it = registry.it.bind(registry);
export const beforeEach = registry.beforeEach.bind(registry);
export const afterEach = registry.afterEach.bind(registry);
export const beforeAll = registry.beforeAll.bind(registry);
export const afterAll = registry.afterAll.bind(registry);

export async function runSuite(suite, indent = '  ', stats = { total: 0, passed: 0, failed: 0, errors: [] }) {
  console.log(`${indent}${COLORS.bold}${COLORS.cyan}► ${suite.name}${COLORS.reset}`);

  for (const hook of suite.beforeAll) {
    await hook();
  }

  for (const item of suite.tests) {
    if (item.fn) {
      // It's a test case
      stats.total++;
      const startTime = performance.now();

      // Collect beforeEach from parent chain down to suite
      const beforeHooks = [];
      let s = suite;
      while (s) {
        beforeHooks.unshift(...s.beforeEach);
        s = s.parent;
      }
      for (const bh of beforeHooks) await bh();

      try {
        await item.fn();
        const duration = (performance.now() - startTime).toFixed(1);
        stats.passed++;
        console.log(`${indent}  ${COLORS.green}✔${COLORS.reset} ${item.name} ${COLORS.dim}(${duration}ms)${COLORS.reset}`);
      } catch (err) {
        stats.failed++;
        const duration = (performance.now() - startTime).toFixed(1);
        console.log(`${indent}  ${COLORS.red}✘ ${item.name}${COLORS.reset} ${COLORS.dim}(${duration}ms)${COLORS.reset}`);
        stats.errors.push({
          suite: suite.name,
          test: item.name,
          error: err,
        });
      }

      // Collect afterEach from suite up to root
      const afterHooks = [];
      s = suite;
      while (s) {
        afterHooks.push(...s.afterEach);
        s = s.parent;
      }
      for (const ah of afterHooks) await ah();

    } else if (item.tests) {
      // It's a sub-suite
      await runSuite(item, indent + '  ', stats);
    }
  }

  for (const hook of suite.afterAll) {
    await hook();
  }

  return stats;
}

export async function runAllSuites(title = 'Test Suite') {
  const globalStart = performance.now();
  console.log(`\n${COLORS.bold}${COLORS.yellow}======================================================================${COLORS.reset}`);
  console.log(`${COLORS.bold}${COLORS.white}  RUNNING: ${title}${COLORS.reset}`);
  console.log(`${COLORS.bold}${COLORS.yellow}======================================================================${COLORS.reset}\n`);

  const stats = { total: 0, passed: 0, failed: 0, errors: [] };

  for (const suite of registry.suites) {
    await runSuite(suite, '  ', stats);
  }

  const totalTime = ((performance.now() - globalStart) / 1000).toFixed(2);

  console.log(`\n${COLORS.bold}${COLORS.yellow}----------------------------------------------------------------------${COLORS.reset}`);
  console.log(`${COLORS.bold}SUMMARY for ${title}:${COLORS.reset}`);
  console.log(`  Total Tests:  ${COLORS.bold}${stats.total}${COLORS.reset}`);
  console.log(`  Passed:       ${COLORS.green}${COLORS.bold}${stats.passed}${COLORS.reset}`);
  if (stats.failed > 0) {
    console.log(`  Failed:       ${COLORS.red}${COLORS.bold}${stats.failed}${COLORS.reset}`);
  } else {
    console.log(`  Failed:       ${COLORS.green}0${COLORS.reset}`);
  }
  console.log(`  Duration:     ${totalTime}s`);
  console.log(`${COLORS.bold}${COLORS.yellow}----------------------------------------------------------------------${COLORS.reset}\n`);

  if (stats.failed > 0) {
    console.log(`${COLORS.bold}${COLORS.red}FAILURES REPORT:${COLORS.reset}`);
    stats.errors.forEach(({ suite, test, error }, idx) => {
      console.log(`\n${COLORS.bold}${COLORS.red}[${idx + 1}] ${suite} -> ${test}${COLORS.reset}`);
      console.log(`    ${error.message}`);
      if (error.stack) {
        const stackLines = error.stack.split('\n').slice(1, 4).join('\n');
        console.log(`${COLORS.dim}${stackLines}${COLORS.reset}`);
      }
    });
    console.log('');
  }

  return {
    success: stats.failed === 0,
    stats,
  };
}
