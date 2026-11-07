# Test Infrastructure Specification: Voxel Bedwars

## 1. Overview & Test Architecture

Voxel Bedwars employs an opaque-box, multi-tiered End-to-End (E2E) testing infrastructure engineered to validate all 37 core features across client, server, engine, combat, progression, and network subsystems. The test suite operates completely headless in pure Node.js (v20+) without requiring a physical display, WebGL GPU, or browser window.

### Key Tenets:
- **Zero External Test Runner Dependencies**: Built with a lightweight, native ES-module BDD test framework (`tests/test-framework.js`) eliminating flaky external runner binaries.
- **Progressive Contract & Invariant Validation**: Mathematical formulas, state machine transitions, voxel data integrity, combat attribution rules, and packet structures are verified against authoritative project specifications (`ORIGINAL_REQUEST.md` and `PROJECT.md`).
- **High-Fidelity Headless Shims**: Canvas 2D procedural textures, Web Audio synthesis, DOM hierarchy, and browser storage are polyfilled via `tests/mocks/browser-shim.js`.
- **4-Tier Structured Test Hierarchy**: Progresses from granular feature invariants to adversarial boundary stress, pairwise cross-module combinations, and realistic full-match scenarios.

---

## 2. Directory Structure

```
tests/
├── e2e-runner.js              # Master test suite orchestrator and summary reporter
├── test-framework.js          # Standalone BDD test harness (describe, it, hooks, assertions, ANSI)
├── mocks/
│   └── browser-shim.js        # Headless polyfills (Canvas2D, DOM, WebAudio, LocalStorage)
├── helpers/
│   └── game-sim.js            # Authoritative formulas, DDA raycasting, physics, packets, mutations
├── tier1-features.test.js     # Tier 1: Feature coverage (Features 1-37, 5 tests each = 185 tests)
├── tier2-boundary.test.js     # Tier 2: Boundary & edge conditions (51 tests)
├── tier3-pairwise.test.js     # Tier 3: Pairwise cross-feature interactions (22 tests)
└── tier4-scenarios.test.js    # Tier 4: Realistic end-to-end match workflows (30 tests)
```

---

## 3. Testing Tiers & Methodology

| Tier | Focus | Scope | Test Count | Pass Rate |
|---|---|---|---|---|
| **Tier 1** | Feature Coverage | >= 5 tests per feature across all 37 features in PROJECT.md | 185 | 100% |
| **Tier 2** | Boundary & Corner Cases | Min/max bounds, void limits, negative values, timeouts, rapid input | 51 | 100% |
| **Tier 3** | Pairwise Combinations | Cross-feature matrix interactions (Mutations + Upgrades + Sync) | 22 | 100% |
| **Tier 4** | E2E Scenarios | 5 complete match workflows from lobby to victory | 30 | 100% |
| **TOTAL** | **Full E2E Suite** | **Comprehensive System Verification** | **288** | **100%** |

### Tier 1: Feature Coverage (185 tests)
- **Features 1–7 (Voxel Engine & Textures)**: Camera near-plane calibration, 16x16 ore textures, crack stages 0-9, hold-to-mine state transitions, material particle palettes, integer DDA raycasting, audio synthesis.
- **Features 8–14 (HUD, Ranking & Auth)**: Live scoreboard, heart containers, 9-slot hotbar, team upgrades integration (`sharpness`, `protection`, `healPool`, `alarmTrap`), combat attribution, 2-team Elo rating (bloxd.io formula), player leveling XP, OAuth providers.
- **Features 15–26 (Maps, Formats & Mutations)**: Speedway, Colosseum, Octagon maps; 2 to 8 team formats; projectile ballistics; 9 game mutators ("Supercharged", "Launch Rush", "Gun Game", "Lethal Strike", "Low Gravity", "Speed Demon", "Vampirism", "Sudden Death", "Lucky Chaos").
- **Features 27–31 (Networking & LAN)**: WebSocket dedicated server, HTTP `/ping` UptimeRobot endpoint, WebRTC PeerJS fallback, packet schema validation, desktop UDP LAN beacon & Direct IP join.
- **Features 32–37 (Packaging, Controls & Resilience)**: Netlify SPA configuration, Electron desktop packaging, Capacitor mobile configuration, responsive touch virtual joystick, opaque-box test runner standards, adversarial payload hardening.

### Tier 2: Boundary & Corner Cases (51 tests)
- Mining raycasting at exact 6.0 block reach vs 6.001 block miss.
- Health clamping at 0 HP (overkill 1000 damage) and max 20 HP (overheal).
- Void death boundary at Y <= -20.
- Combat attribution expiration at exactly 9,999ms (valid) vs 10,001ms (expired).
- Elo rating floor clamp at 0 and tier transitions (Bronze, Silver, Gold, Diamond, Master).
- Network packet size limits (64KB max) and malformed coordinate rejection (NaN/Infinity).
- LAN IPv4 and port bounds (Port 1 to 65535).
- Sudden Death timer trigger at exactly 600.0s.

### Tier 3: Pairwise Combinations (22 tests)
- Supercharged Mutation + Team Forge Upgrade + Shopkeeper Purchases.
- Gun Game Mutation + Team Sharpness Upgrade + Combat Attribution.
- Lethal Strike Mutation + Protection Upgrade + Armor Defense Calculation.
- Low Gravity Mutation + Base Launchpads + Mid-Air Bridging.
- Vampirism Mutation + Gun Game Multi-Kill Streaks.
- WebRTC Fallback + State Sync + Paired Bed Voxel Destruction.
- Ranked Match Rating + Level XP + Profile LocalStorage Persistence.
- Mining Hardness + Diamond Pickaxe + Obsidian Particle Burst.
- Desktop UDP LAN Broadcast + Direct IP Join + Map Format Handshake.
- AlarmTrap + HealPool Base Perimeter Defense.

### Tier 4: Realistic End-to-End Match Scenarios (30 tests)
1. **Scenario 1: 1v1 Colosseum Duel**: Match start, forge resource gathering, bridging across 30-block void, bed destruction (head + foot removal), combat engagement, final kill, and Elo rating MMR calculation.
2. **Scenario 2: 4v4 Speedway Match**: Satellite diamond control, forge tier 2 upgrade, iron armor/sword purchase, non-final death & 5s respawn cycle, shears wool defense breach, bed break, and team elimination.
3. **Scenario 3: 8-Team Octagon Match**: Center emerald spawner dominance, obsidian bed fortification, cascading multi-team eliminations, 600s Sudden Death bed destruction, outer island perimeter decay, and solo victory.
4. **Scenario 4: Supercharged & Gun Game Mutator Match**: Accelerated forge start, Tier 1 Slingshot projectile firing, Kill 1 auto-upgrade to Iron Crossbow, Kill 2 auto-upgrade to Fireball Launcher, explosive blast physics (destroying wool while obsidian resists), and Kill 3 Plasma Blaster cap.
5. **Scenario 5: Dual-Layer Network Match**: WebSocket room host, client join and initial snapshot sync, BLOCK_PLACE and PLAYER_TRANSFORM packet relay, server failure and automatic WebRTC P2P fallback, P2P bed destruction sync, and LAN Direct IP join/clean disconnect.

---

## 4. How to Execute Tests

### Master Test Runner (All Tiers 1–4):
```bash
npm test
# OR
node tests/e2e-runner.js
```

### Running Individual Test Suites:
```bash
# Tier 1 only (Feature Coverage)
node --input-type=module -e "import('./tests/test-framework.js').then(async ({ runAllSuites }) => { await import('./tests/tier1-features.test.js'); const res = await runAllSuites('Tier 1'); process.exit(res.success ? 0 : 1); })"

# Tier 2 only (Boundary Cases)
node --input-type=module -e "import('./tests/test-framework.js').then(async ({ runAllSuites }) => { await import('./tests/tier2-boundary.test.js'); const res = await runAllSuites('Tier 2'); process.exit(res.success ? 0 : 1); })"

# Tier 3 only (Pairwise Combinations)
node --input-type=module -e "import('./tests/test-framework.js').then(async ({ runAllSuites }) => { await import('./tests/tier3-pairwise.test.js'); const res = await runAllSuites('Tier 3'); process.exit(res.success ? 0 : 1); })"

# Tier 4 only (E2E Scenarios)
node --input-type=module -e "import('./tests/test-framework.js').then(async ({ runAllSuites }) => { await import('./tests/tier4-scenarios.test.js'); const res = await runAllSuites('Tier 4'); process.exit(res.success ? 0 : 1); })"
```

---

## 5. Test Framework API & Assertion Library

The framework (`tests/test-framework.js`) exports standard BDD primitives:
- `describe(name, fn)`: Defines suite groups with nested hierarchy.
- `it(name, fn)`: Registers individual test cases with performance duration tracking.
- `beforeEach(fn)` / `afterEach(fn)` / `beforeAll(fn)` / `afterAll(fn)`: Lifecycle hooks.

### Assertions:
- `assert(condition, message)`
- `assertEqual(actual, expected, message)`
- `assertNotEqual(actual, expected, message)`
- `assertTrue(val, message)` / `assertFalse(val, message)`
- `assertDeepEqual(actual, expected, message)`
- `assertApprox(actual, expected, tolerance, message)`
- `assertInRange(val, min, max, message)`
- `assertIncludes(haystack, needle, message)`
- `assertThrows(fn, expectedError, message)`
