# 🛏️ Voxel BedWars Studio

A next-generation, high-performance 3D Voxel Bedwars game engine, tactical autonomous AI simulator, and in-game 3D map creation studio. Built with **Three.js**, **Vite**, **PeerJS**, and the **Web Audio API** with zero external runtime dependencies.

Designed for instant browser play, seamless export to **GitHub**, and static deployment to **Netlify** or **GitHub Pages**.

---

## 🚀 Key Highlights & Architecture

- **Custom-Engineered 3D Voxel Engine**:
  - Blazing fast instanced voxel meshing with neighbor face-culling.
  - Dedicated per-mesh buffer geometries ensuring zero geometry-disposal leaks or rendering freezes.
  - Procedural 16x16 pixel-art canvas textures (Wool in 8 team colors, Oak Wood, End Stone, Obsidian, Glass, Diamond/Emerald Blocks, Lucky Blocks, Beds, TNT).
  - Raycaster with 3D Digital Differential Analyzer (DDA) for precise block targeting and placement normals.
  - AABB physics engine supporting smooth wall-sliding, sprint-jumping, gravity, knockback impulses, and void boundary detection.

- **Autonomous Tactical AI Bots**:
  - Single-player mode features autonomous AI bots for opponent teams (Blue, Green, Yellow).
  - Behavior loops:
    1. **Harvest**: Gathers iron and gold from the team forge spawner.
    2. **Upgrade**: Visited the team shopkeeper to purchase wool blocks, swords, and armor.
    3. **Bridge**: Senses island chasms and constructs wool bridges forward across the void towards targets.
    4. **PvP Combat**: Engages in strafing, sprint-jumping, and sword knockback attacks against opponents.
    5. **Objective**: Infiltrates enemy islands to break defenses and destroy beds.

- **Complete Bedwars Economy & Objectives**:
  - **Forge & Island Spawners**: Floating spinning 3D voxel drops (Iron, Gold, Diamonds, Emeralds) with magnetic attraction.
  - **Item Shopkeeper NPC**: Weapons (Stone/Iron/Diamond Swords, Knockback Stick), Armor tiers (Chainmail, Iron, Diamond), Blocks (Wool, Wood, End Stone, Obsidian), Tools (Shears, Pickaxes), and Utilities (Golden Apples, Fireballs, TNT).
  - **Team Upgrades NPC**: Sharpened Swords, Reinforced Armor I-II, Molten Forge upgrades, Heal Pool, Alarm Traps, and Miner Fatigue Traps.
  - **Bed Lifecycle**: Destroying an enemy team's bed removes their ability to respawn.

- **Bedwars Studio (3D Map & Scenario Maker)**:
  - Free-flight creative mode camera (WASD + Space/Shift).
  - Brush options: 1x1 voxel, 3x3 plane, and Erase mode.
  - Entity placers: Team Spawns, Team Beds, Forge Spawners, Diamond Generators, Emerald Generators.
  - JSON Map Export & Import for community map sharing.
  - 1-Click "Test Play" to instantly battle test custom arenas.

- **Serverless WebRTC Multiplayer (P2P)**:
  - Host-authoritative multiplayer using PeerJS.
  - Zero dedicated backend servers or hosting costs required.
  - Shareable 4-letter room codes (`BW-XXXX`).

- **Web Audio API Procedural Sound Engine**:
  - 100% synthesized sound effects: Footsteps, block placing, block breaking, sword swing/hit, item pickup chime, shop purchase tune, and bed destruction thunder crash.

---

## 🛠️ Getting Started

### Prerequisites
- Node.js (v18+)
- npm

### Development
```bash
# Navigate to project directory
cd C:\Users\alekhyo\.gemini\antigravity\scratch\voxel-bedwars

# Run local development server
npm run dev
```

### Production Build
```bash
# Build production bundle in /dist
npm run build

# Preview production build locally
npm run preview
```

---

## 🌐 Netlify & GitHub Deployment

- **Base Path**: Configured with `base: './'` in `vite.config.js` to ensure all asset paths are relative and never 404 regardless of host subdirectories.
- **Netlify**: Pre-configured `netlify.toml` with `dist` publish directory and security headers.
- **GitHub Pages**: Output directory `dist/` can be directly pushed to `gh-pages` or served from any static web host.

---

## 🎮 Controls

| Action | Key / Input |
|---|---|
| **Move** | `W`, `A`, `S`, `D` |
| **Sprint** | `Shift` |
| **Jump** | `Space` |
| **Attack / Mine Block** | `Left Click` |
| **Place Block / Use Item** | `Right Click` |
| **Hotbar Selection** | `1` - `9` or Click |
| **Shopkeeper NPC** | `E` or Right-Click near NPC |
| **Team Upgrades** | `U` |
| **Look Around** | Mouse (Click canvas to lock pointer) |
