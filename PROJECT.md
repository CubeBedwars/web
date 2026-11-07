# Project: Voxel Bedwars

## Architecture
Voxel Bedwars is a production-grade cross-platform 3D voxel game engineered with Three.js, Web Audio API, modular combat/mining physics, dual-layer networking, and cross-platform wrappers (Web/Netlify, Desktop/Electron, Mobile/Capacitor).

### Key Architectural Layers:
1. **Engine Layer** (`src/engine/`):
   - `VoxelWorld.js`: Voxel grid storage, meshing, greedy/face culling, DDA integer raycasting, block placement & breaking.
   - `TextureGenerator.js`: 16x16 pixel-art canvas procedural texture generator (team wools, ores, stone, wood, obsidian, lucky blocks, break crack stages 0-9).
   - `Physics.js`: AABB collision, gravity, ground detection, velocity integration, jump-pad impulses.
   - `SoundManager.js`: Web Audio API procedural sound synthesis (hits, breaks, placing, footsteps, chimes, explosions).
   - `ParticleManager.js`: Instanced particle emitters for block destruction, damage sparks, and lucky block bursts.
2. **Game & Combat Layer** (`src/game/`, `src/entities/`):
   - `GameManager.js`: Master game loop, input routing, hold-to-mine state machine, projectile handling, match lifecycle.
   - `TeamManager.js`: Dynamic team management (2 to 8 teams: Red, Blue, Green, Yellow, Aqua, White, Pink, Gray), beds, upgrades (`sharpness`, `protection`, `healPool`, `alarmTrap`).
   - `GeneratorManager.js`: Item drops (iron, gold, diamond, emerald) with level scaling and magnet pickup.
   - `ShopManager.js`: Interactive shopkeeper item catalog, costs, inventory purchasing, team upgrade GUI.
   - `MapPresets.js`: Multi-map definitions (`speedway` 4-team, `colosseum` 1v1 duel, `octagon` 8-team).
   - `MutationManager.js`: Pluggable game mutator system with lifecycle hooks.
   - `Player.js` & `LocalPlayer.js`: Player entity, first-person camera, arm/held-item rendering, combat attributes.
   - `BotPlayer.js`: Autonomous AI navigation, bridging, combat, and bed targeting.
   - `Projectile.js`: Physics-simulated thrown projectiles (fireballs, gun game ammo).
3. **UI, Ranking & Auth Layer** (`src/ui/`, `src/auth/`):
   - `HUD.js`: Sidebar scoreboard (bed statuses, kills, final kills, timer, rank rating, player level), health hearts, 9-slot hotbar, crosshair, shop modals.
   - `RankManager.js`: bloxd.io-inspired numerical rank rating (MMR) computed strictly from official 2-team matches (1v1, 2v2, 3v3, 4v4).
   - `LevelManager.js`: Progressive XP and level system calculated across all game modes.
   - `AuthManager.js`: OAuth authentication ("Login with GitHub" primary, "Login with Google" fallback, plus guest mode) with persistent profile storage.
4. **Networking Layer** (`src/net/`, `server/`):
   - `server/server.js`: Dedicated Node.js WebSocket service with room management, packet relay, and `/ping` endpoint for 5-minute UptimeRobot monitoring.
   - `NetworkManager.js`: Dual-layer adapter pattern (`WebSocketAdapter` primary with 3.5s timeout falling back to `WebRTCAdapter` PeerJS room codes).
   - `RemotePlayer.js`: 3D voxel player mesh with position/rotation interpolation.
   - `LANManager.js`: UDP broadcast/discovery on desktop and Direct IP:Port joining on desktop/mobile/web.
5. **Cross-Platform Layer** (`desktop/`, `mobile/`, `public/`):
   - `desktop/main.cjs` & `desktop/preload.cjs`: Electron desktop packaging with native windowing and UDP LAN discovery.
   - `capacitor.config.json`: Mobile packaging configuration.
   - `TouchControls.js`: Responsive on-screen virtual joystick, touch camera look drag zone, action buttons, and touchable hotbar.
   - `netlify.toml`: Production Netlify SPA deployment with routing and security headers.

---

## Code Layout
```
voxel-bedwars/
├── .agents/teamwork/             # Teamwork orchestrator and agent metadata
├── dist/                         # Compiled web production bundle
├── desktop/                      # Native desktop packaging
│   ├── main.cjs                  # Electron main entry with LAN UDP beacon
│   └── preload.cjs               # Electron preload script
├── server/                       # Dedicated WebSocket service
│   ├── package.json              # Server dependencies (ws, etc.)
│   ├── server.js                 # WebSocket server + GET /ping endpoint
│   └── Dockerfile                # Container deployment for Hugging Face Spaces / Glitch
├── src/                          # Client source code
│   ├── auth/                     # Authentication & player identity
│   │   └── AuthManager.js        # GitHub & Google OAuth + guest profile
│   ├── engine/                   # 3D Voxel engine
│   │   ├── Physics.js            # AABB collision & gravity
│   │   ├── ParticleManager.js    # Particle effects
│   │   ├── SoundManager.js       # Procedural audio effects
│   │   ├── TextureGenerator.js   # 16x16 pixel-art voxel textures
│   │   └── VoxelWorld.js         # Voxel data, DDA raycasting, meshing
│   ├── entities/                 # Game entities
│   │   ├── BotPlayer.js          # AI bots
│   │   ├── LocalPlayer.js        # First-person player & input
│   │   ├── Player.js             # Base player class & damage calculations
│   │   ├── Projectile.js         # Fireballs & projectile mechanics
│   │   └── RemotePlayer.js       # Networked player avatars
│   ├── game/                     # Core Bedwars logic
│   │   ├── GameManager.js        # Master game loop & state
│   │   ├── GeneratorManager.js   # Resource generators
│   │   ├── MapPresets.js         # Multi-map presets (Colosseum, Speedway, Octagon)
│   │   ├── MutationManager.js    # 9 Game mutation modifiers
│   │   ├── ShopManager.js        # Shopkeeper catalog & team upgrades
│   │   └── TeamManager.js        # Dynamic teams & bed statuses
│   ├── net/                      # Networking
│   │   ├── LANManager.js         # LAN discovery & direct IP join
│   │   ├── NetworkAdapter.js     # Unified packet adapter interface
│   │   ├── NetworkManager.js     # Dual-layer manager (WebSocket + WebRTC fallback)
│   │   ├── WebRTCAdapter.js      # Serverless PeerJS room code adapter
│   │   └── WebSocketAdapter.js   # Dedicated WebSocket client adapter
│   ├── stats/                    # Ranking & progression
│   │   ├── LevelManager.js       # XP and player levels
│   │   └── RankManager.js        # Numerical rank rating (2-team ranked)
│   ├── ui/                       # User interface
│   │   ├── HUD.js                # In-game HUD, scoreboard, hearts, hotbar
│   │   ├── PortalUI.js           # Frontpage portal, profiles, match launcher
│   │   └── TouchControls.js      # Mobile virtual joystick & buttons
│   ├── index.html                # Main web entry & portal markup
│   ├── main.js                   # Application bootstrap
│   └── style.css                 # Bedwars styling & HUD themes
├── tests/                        # Comprehensive test suite (Tiers 1-4)
├── capacitor.config.json         # Mobile packaging configuration
├── netlify.toml                  # Netlify deployment configuration
├── package.json                  # Root dependencies & build scripts
└── vite.config.js                # Vite build configuration
```

---

## Feature Inventory
Every single feature from the Survey phase is mapped to a designated Milestone:

| # | Feature | Description | Milestone | Source |
|---|---------|-------------|-----------|--------|
| 1 | Camera & Arm Rendering Bug Fix | Add `camera` to `scene`, fix camera near plane to 0.05 to eliminate mesh invisibilities and clipping | M1 | Survey R1 |
| 2 | Pixel-Art Ore Textures | Add 16x16 canvas generators for Iron Ore, Gold Ore, Diamond Ore, Emerald Ore | M1 | Survey R1 |
| 3 | Breaking Crack Stage Textures | Generate 10 progressive crack stage textures (0 to 9) for mining visual feedback | M1 | Survey R1 |
| 4 | Block Hardness & Hold-to-Mine Loop | True break time formula (`hardness * toolMultiplier`), mining progress state machine, crack overlay | M1 | Survey R1 |
| 5 | Material-Colored Particle Emitters | Block break particles match true block color palettes instead of hardcoded gray | M1 | Survey R1 |
| 6 | Integer DDA Raycasting & Placement | Precise block face normal targeting and multi-entity AABB collision checks | M1 | Survey R1 |
| 7 | Sound Effects & Pickup Audio Fix | Rhythmic mining hit audio, break sound, place sound, and fix `p.isLocal` pickup chime | M1 | Survey R1 |
| 8 | Bedwars Scoreboard & Stats | In-game scoreboard displaying bed status icons, kills, final kills, timer, rank, level | M2 | Survey R2 |
| 9 | Health Hearts & 9-Slot Hotbar | Minecraft-style hearts with damage animation, 9-slot hotbar with number keys and mouse wheel | M2 | Survey R2 |
| 10 | Team Upgrades Combat Integration | Connect `sharpness` (+damage), `protection` (-damage), `healPool` (regen), `alarmTrap` | M2 | Survey R2 |
| 11 | Combat Attribution & Bed Deduplication | 10-second combat tagger to credit void kills, paired bed voxel destruction logic | M2 | Survey R2 |
| 12 | bloxd.io-style Rank Rating System | Numerical rank rating updated exclusively on official 2-team matches (1v1, 2v2, 3v3, 4v4) | M2 | Survey R2 |
| 13 | Player Level & XP Progression | Progressive player level derived from match wins, kills, final kills, and beds broken | M2 | Survey R2 |
| 14 | Frontpage Portal & OAuth Management | Profile widget (rank number, level), match format selectors, "Login with GitHub" & "Login with Google" | M2 | Survey R2 |
| 15 | Multi-Map System | 4-team arena (`Speedway`), 1v1 duel map (`Colosseum`), 8-team solo/duo map (`Octagon`) | M3 | Survey R3 |
| 16 | Dynamic Teams & Match Formats | Dynamic 2–8 team support with wool colors; formats: Solos 1v1v1v1, Duos, Trios, 4v4, 1v1 Duels | M3 | Survey R3 |
| 17 | Projectile Entity Subsystem | Physics-simulated projectiles (`Projectile.js`) for fireballs and projectile weapons | M3 | Survey R3 |
| 18 | Supercharged Mutation | All team forges and resource generators start at level 2 from match start | M3 | Survey R3 |
| 19 | Launch Rush Mutation | Every team base island equipped with operational launchpads giving aerial impulses | M3 | Survey R3 |
| 20 | Gun Game Mutation | Projectile weapons spawned with players that upgrade to higher tiers on securing kills | M3 | Survey R3 |
| 21 | Lethal Strike Mutation | Increased combat damage scaling for fast, high-stakes combat | M3 | Survey R3 |
| 22 | Low Gravity Mutation | Moon-like reduced gravitational pull enabling floaty leaps and aerial bridging | M3 | Survey R3 |
| 23 | Speed Demon Mutation | Permanent player movement speed boost | M3 | Survey R3 |
| 24 | Vampirism Mutation | Health restoration on damaging or eliminating opponents | M3 | Survey R3 |
| 25 | Sudden Death Mutation | Accelerated match progression with timed bed breakdown and island decay | M3 | Survey R3 |
| 26 | Lucky Chaos Mutation | Lucky block spawns and unpredictable arena item events across islands | M3 | Survey R3 |
| 27 | Dedicated WebSocket Server Service | Node.js `ws` server in `server/` with room management and state packet relay | M4 | Survey R4 |
| 28 | 5-Minute `/ping` Endpoint & Free Hosting | Non-WebSocket HTTP `GET /ping` for UptimeRobot monitoring on 24/7/31-day free host (no CC) | M4 | Survey R4 |
| 29 | Dual-Layer Fallback Networking | Unified `NetworkAdapter` with primary WebSocket and automatic fallback to WebRTC PeerJS | M4 | Survey R4 |
| 30 | Network State Synchronization | Real-time broadcast and receipt of blocks, beds, player transforms, combat, and drops | M4 | Survey R4 |
| 31 | LAN Multiplayer (Broadcast & Direct Join) | Desktop UDP broadcast/discovery on port 8766, local server, and Direct IP:Port join modal | M4 | Survey R4 |
| 32 | Web Build & Netlify Deployment | Production bundle via `npm run build` with `netlify.toml` SPA redirects and CSP headers | M5 | Survey R5 |
| 33 | Desktop Packaging Configuration | Electron wrapper (`desktop/main.cjs`, `desktop/preload.cjs`) with native window management | M5 | Survey R5 |
| 34 | Mobile Packaging Configuration | Capacitor configuration (`capacitor.config.json`) for Android/iOS packaging | M5 | Survey R5 |
| 35 | Responsive Mobile Touch Controls | On-screen virtual joystick, camera look drag zone, floating action buttons, touch hotbar | M5 | Survey R5 |
| 36 | 100% E2E Test Suite Pass (Tiers 1-4) | Pass all opaque-box requirement tests published by E2E Testing Track (`TEST_READY.md`) | M6 | Survey Final |
| 37 | Tier 5 Adversarial Coverage Hardening | White-box stress testing, edge-case generation, and bug patching with Challenger loop | M6 | Survey Final |

---

## Milestones
| # | Name | Scope | Dependencies | Status |
|---|------|-------|-------------|--------|
| M1 | Voxel Engine, Textures & Mechanics | Features 1–7: Rendering bug fixes, 16x16 pixel-art ore & crack textures, hold-to-mine hardness loop, DDA raycasting, audio & particles | none | DONE |
| M2 | Bedwars UI, Ranking & Frontpage Portal | Features 8–14: In-game HUD/scoreboard, hearts, hotbar, upgrades integration, bloxd.io rank rating (2-team ranked), leveling, OAuth portal | M1 | DONE |
| M3 | Multi-Map System, Formats & Mutations | Features 15–26: 3 balanced maps (Colosseum, Speedway, Octagon), dynamic teams, projectile system, 9 game mutations | M1, M2 | IN_PROGRESS |
| M4 | Dual-Layer Networking & Dedicated Server | Features 27–31: Dedicated WebSocket server in `server/`, `/ping` monitoring, WebRTC fallback, full state sync, LAN discovery & direct join | M1, M2, M3 | PLANNED |
| M5 | Cross-Platform Packaging & Netlify | Features 32–35: Netlify SPA deploy, Electron desktop packaging, Capacitor mobile packaging, responsive touch controls | M1, M2, M4 | PLANNED |
| M6 | Final Verification & Adversarial Hardening | Features 36–37: Pass 100% of E2E test suite (Tiers 1-4) and Tier 5 adversarial coverage hardening | M1, M2, M3, M4, M5 | PLANNED |

---

## Interface Contracts

### 1. `VoxelWorld` ↔ `GameManager`
- `setBlock(x, y, z, blockType)`: Updates voxel state, rebuilds mesh instance chunk, triggers particle and sound feedback.
- `raycastDDA(origin, direction, maxDistance)`: Returns `{ hit: boolean, position: {x,y,z}, normal: {x,y,z}, blockType: number }`.
- `getBlock(x, y, z)`: Returns block type integer.
- `setBreakProgress(x, y, z, stage)`: Renders crack stage overlay (0–9) or removes overlay if `stage === -1`.

### 2. `Player` / `LocalPlayer` ↔ `TeamManager` & `ShopManager`
- `takeDamage(amount, attacker, physics)`: Evaluates `armor.reduction` AND `team.upgrades.protection`, applies knockback, tags `attacker` for 10s combat attribution, checks for death.
- `attack(target)`: Computes base weapon damage + `team.upgrades.sharpness`, triggers hit sound and particles.
- `applyUpgrade(upgradeKey)`: Sets upgrade on `team.upgrades`, recalculates player combat multipliers immediately.

### 3. `RankManager` & `LevelManager` ↔ `GameManager`
- `recordMatchOutcome({ isRankedMatch, format, outcome, kills, finalKills, bedsBroken })`:
  - If `isRankedMatch === true` (2-team formats: `1v1`, `2v2`, `3v3`, `4v4`): updates numerical rank rating (MMR) and returns `{ deltaRating, newRating }`.
  - Always awards XP to `LevelManager`, calculates level-ups, and persists to storage.
- `getRankProfile()`: Returns `{ rating, tierName, level, xp, nextLevelXp, wins, losses, kills, finalKills, bedsBroken }`.

### 4. `MutationManager` ↔ Game Lifecycle
- `registerMutation(name, definition)`: Adds a named mutation.
- `applyMutations(activeNames, matchContext)`:
  - `onMatchStart({ world, teams, players, generators, physics })`
  - `onTick(deltaTime, matchContext)`
  - `onDamage(damageEvent)`
  - `onKill(killEvent)`
  - `onBlockBreak(breakEvent)`

### 5. `NetworkAdapter` ↔ `GameManager`
- `sendPacket(type, payload)`: Transmits packet over active connection (`WebSocketAdapter` or `WebRTCAdapter`).
- `onPacket(type, callback)`: Registers handler for `PLAYER_TRANSFORM`, `BLOCK_PLACE`, `BLOCK_BREAK`, `BED_DESTROY`, `PLAYER_DAMAGE`, `CHAT_MESSAGE`.
- Packet Schema:
  ```json
  {
    "type": "BLOCK_PLACE" | "BLOCK_BREAK" | "BED_DESTROY" | "PLAYER_TRANSFORM" | "PLAYER_DAMAGE",
    "sender": "string (player_id)",
    "timestamp": 1234567890,
    "payload": {}
  }
  ```
