/**
 * tests/e2e-runner.js
 * Master E2E Test Suite Runner for Voxel Bedwars.
 * Executes all 4 testing tiers:
 *   - Tier 1: Feature Coverage (Features 1 to 37, >= 5 tests per feature)
 *   - Tier 2: Boundary & Corner Cases (Min/max limits, timeouts, rate limits)
 *   - Tier 3: Cross-Feature Combinations (Pairwise matrix interactions)
 *   - Tier 4: Realistic End-to-End Match Scenarios (5 full match workflows)
 *
 * Aggregates results, outputs high-visibility ANSI colored summaries,
 * and exits with code 0 on 100% pass.
 */

import { performance } from 'perf_hooks';
import { COLORS, registry, runSuite } from './test-framework.js';
import './mocks/browser-shim.js';

const SUITES = [
  { name: 'Tier 1: Feature Coverage', path: './tier1-features.test.js' },
  { name: 'Tier 2: Boundary & Corner Cases', path: './tier2-boundary.test.js' },
  { name: 'Tier 3: Pairwise Combinations', path: './tier3-pairwise.test.js' },
  { name: 'Tier 4: Realistic E2E Scenarios', path: './tier4-scenarios.test.js' },
];

async function main() {
  const globalStart = performance.now();

  console.log(`\n${COLORS.bold}${COLORS.cyan}╔══════════════════════════════════════════════════════════════════════╗${COLORS.reset}`);
  console.log(`${COLORS.bold}${COLORS.cyan}║                   VOXEL BEDWARS - E2E TEST RUNNER                    ║${COLORS.reset}`);
  console.log(`${COLORS.bold}${COLORS.cyan}║       Full 4-Tier Verification Suite (Node.js Headless Engine)       ║${COLORS.reset}`);
  console.log(`${COLORS.bold}${COLORS.cyan}╚══════════════════════════════════════════════════════════════════════╝${COLORS.reset}\n`);

  const tierResults = [];
  let grandTotal = 0;
  let grandPassed = 0;
  let grandFailed = 0;
  const allErrors = [];

  for (const suiteConfig of SUITES) {
    registry.clear();
    await import(`${suiteConfig.path}?t=${Date.now()}`);

    console.log(`\n${COLORS.bold}${COLORS.yellow}======================================================================${COLORS.reset}`);
    console.log(`${COLORS.bold}${COLORS.white}  RUNNING: ${suiteConfig.name}${COLORS.reset}`);
    console.log(`${COLORS.bold}${COLORS.yellow}======================================================================${COLORS.reset}\n`);

    const suiteStart = performance.now();
    const stats = { total: 0, passed: 0, failed: 0, errors: [] };

    for (const suite of registry.suites) {
      await runSuite(suite, '  ', stats);
    }

    const duration = ((performance.now() - suiteStart) / 1000).toFixed(2);
    tierResults.push({
      name: suiteConfig.name,
      total: stats.total,
      passed: stats.passed,
      failed: stats.failed,
      duration,
    });

    grandTotal += stats.total;
    grandPassed += stats.passed;
    grandFailed += stats.failed;
    if (stats.errors.length > 0) {
      allErrors.push(...stats.errors);
    }
  }

  const grandDuration = ((performance.now() - globalStart) / 1000).toFixed(2);

  // Grand Summary Table
  console.log(`\n${COLORS.bold}${COLORS.cyan}╔══════════════════════════════════════════════════════════════════════╗${COLORS.reset}`);
  console.log(`${COLORS.bold}${COLORS.cyan}║                      GRAND TEST SUITE SUMMARY                        ║${COLORS.reset}`);
  console.log(`${COLORS.bold}${COLORS.cyan}╠══════════════════════════════════════════════════════════════════════╣${COLORS.reset}`);
  console.log(`${COLORS.bold}║  Tier Name                            Tests   Passed   Failed  Time  ║${COLORS.reset}`);
  console.log(`${COLORS.bold}${COLORS.cyan}╠══════════════════════════════════════════════════════════════════════╣${COLORS.reset}`);

  for (const r of tierResults) {
    const namePadded = r.name.padEnd(34, ' ');
    const totalPadded = String(r.total).padStart(5, ' ');
    const passedPadded = `${COLORS.green}${String(r.passed).padStart(6, ' ')}${COLORS.reset}`;
    const failedPadded = r.failed > 0
      ? `${COLORS.red}${String(r.failed).padStart(6, ' ')}${COLORS.reset}`
      : `${COLORS.green}${String(0).padStart(6, ' ')}${COLORS.reset}`;
    const timePadded = `${r.duration}s`.padStart(6, ' ');

    console.log(`║  ${namePadded} ${totalPadded}   ${passedPadded}   ${failedPadded}  ${timePadded} ║`);
  }

  console.log(`${COLORS.bold}${COLORS.cyan}╠══════════════════════════════════════════════════════════════════════╣${COLORS.reset}`);
  const totalSummary = `TOTAL: ${grandTotal} tests`.padEnd(34, ' ');
  const totalPassedStr = `${COLORS.bold}${COLORS.green}${String(grandPassed).padStart(6, ' ')}${COLORS.reset}`;
  const totalFailedStr = grandFailed > 0
    ? `${COLORS.bold}${COLORS.red}${String(grandFailed).padStart(6, ' ')}${COLORS.reset}`
    : `${COLORS.bold}${COLORS.green}${String(0).padStart(6, ' ')}${COLORS.reset}`;
  const grandTimeStr = `${grandDuration}s`.padStart(6, ' ');

  console.log(`║  ${COLORS.bold}${totalSummary} ${String(grandTotal).padStart(5, ' ')}   ${totalPassedStr}   ${totalFailedStr}  ${grandTimeStr}${COLORS.reset} ║`);
  console.log(`${COLORS.bold}${COLORS.cyan}╚══════════════════════════════════════════════════════════════════════╝${COLORS.reset}\n`);

  if (grandFailed > 0) {
    console.log(`${COLORS.bold}${COLORS.red}FAILURES OVERVIEW (${grandFailed} test(s) failed):${COLORS.reset}`);
    allErrors.forEach(({ suite, test, error }, idx) => {
      console.log(`\n  ${COLORS.red}[${idx + 1}] ${suite} -> ${test}${COLORS.reset}`);
      console.log(`      ${error.message}`);
      if (error.stack) {
        const stackSnippet = error.stack.split('\n').slice(1, 3).join('\n');
        console.log(`      ${COLORS.dim}${stackSnippet}${COLORS.reset}`);
      }
    });
    console.log('');
    process.exit(1);
  } else {
    console.log(`${COLORS.bold}${COLORS.bgGreen}${COLORS.white}  ALL 4 TIERS PASSED - 100% TEST INTEGRITY VERIFIED (0 FAILURES)  ${COLORS.reset}\n`);
    process.exit(0);
  }
}

main().catch((err) => {
  console.error(`${COLORS.bold}${COLORS.red}FATAL ERROR IN TEST RUNNER:${COLORS.reset}`, err);
  process.exit(1);
});
