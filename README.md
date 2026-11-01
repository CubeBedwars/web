# 🛏️ Bedwars Studio (3D Voxel Edition)

> Next-Generation Browser & Multi-Platform Voxel Bedwars Game and Map Creation Suite with Autonomous Tactical AI, Serverless WebRTC Multiplayer, and 14+ Game Modes.

---

## 🌟 Key Features

### 1. 🤖 Single-Player with Autonomous Tactical AI
- Full tactical AI bots that harvest team forge resources, visit the shopkeeper, buy equipment/blocks, bridge across sky voids, defend their bed, and engage in knockback PvP.
- Bots actively communicate in chat, alert teammates, and strategize.

### 2. 🌐 Serverless WebRTC Multiplayer (100% Netlify Compatible)
- Zero backend server costs: uses WebRTC Peer-to-Peer data channels with room codes.
- 1-Click invite links: Share `https://your-site.netlify.app/#room=BW-XXXX` with friends to join instantly.
- Authoritative host state synchronization for players, voxel block placing/breaking, beds, and projectiles.

### 3. 🛠️ Bedwars Studio (3D Voxel Map & Mode Editor)
- In-game fly-cam 3D editor with voxel brush tools (place, erase, box fill, brush sizes 1x1, 3x3, 5x5).
- Place interactive entity markers: Team Spawns, Team Beds, Forge Generators, Diamond Generators, Emerald Generators, and Shop NPCs.
- 1-Click "Test Play Map" button to test custom creations against AI bots.
- Export and import custom map files as standard `.json`.

### 4. 🎮 14+ High-Energy Game Modes
- **Classic Solo & Doubles**: 8 teams with team forges, diamond outposts, and emerald center.
- **4v4v4v4 Team Bedwars**: Larger islands with Team Upgrades tree (Sharpened Swords, Protection I-IV, Heal Pools, Miner Fatigue Traps).
- **⚡ Rush Bedwars**: 2x movement speed, instant bridging, 3x forge spawner speed.
- **🍀 Lucky Block Bedwars**: Breakable rainbow Lucky Blocks yielding overpowered weapons, bridge eggs, TNT surprises, or sudden meteor strikes.
- **🌋 Void Rising (Floor is Lava)**: The void layer rises by 1 block every 20 seconds, forcing vertical sky skyscraper battles.
- **🌙 Lunar Low-Gravity**: 0.35x floaty gravity with double-jump thrusters and aerial mid-air snipes.
- **🎲 Chaos Events**: Announcer triggers global events every 45s (Flash Sale, Meteor Shower, Trampoline World, Speed Frenzy).
- **🪝 Acrobat Grappling**: Start with a reusable Grappling Hook to swing underneath sky islands.
- **🧱 Mega-Bridge Infinite**: Unlimited blocks with instant bridging for colossal sky highways.
- **🎯 One-Shot Glass Cannon**: 1 HP stakes; every hit is lethal.
- **🧛 Vampire Bloodlust**: Damage dealt heals health and siphons enemy forge resources.
- **💥 Demolition Artillery**: Voxel rocket launchers and heavy artillery.

### 5. 📱 Multi-Platform: Web, Desktop & Mobile
- **Web**: Instant static deployment to Netlify or GitHub Pages.
- **Desktop**: Standalone native desktop app with Electron wrapper (`desktop/`).
- **Mobile**: Touch controls with virtual analog joystick and action buttons, ready for Android / iOS packaging via Capacitor (`capacitor.config.json`).

---

## 🚀 Quick Start & Local Development

```bash
# 1. Install dependencies
npm install

# 2. Run local development server
npm run dev
# Open http://localhost:3000 in your browser

# 3. Build production bundle (for Netlify)
npm run build
```

---

## 🌐 Deploy to Netlify (Export from GitHub)

1. Push this directory to your GitHub account:
   ```bash
   git add .
   git commit -m "feat: Initial Bedwars Studio multiplatform release"
   git remote add origin https://github.com/YOUR_USERNAME/bedwars-studio.git
   git branch -M main
   git push -u origin main
   ```
2. In your [Netlify Dashboard](https://app.netlify.com/):
   - Click **"Add new site"** -> **"Import an existing project"** -> Select your **GitHub repository**.
   - Netlify will automatically detect the settings from `netlify.toml`:
     - **Build command**: `npm run build`
     - **Publish directory**: `dist`
3. Click **"Deploy site"**! Your Bedwars Studio will be live globally on a free SSL URL.

---

## 💻 Running Desktop & Mobile Editions

### Desktop Game (Electron)
```bash
# Install electron locally if not present
npm install -D electron

# Launch desktop app
npm run desktop:start
```

### Mobile Game (Android / iOS via Capacitor)
```bash
# Build the web bundle
npm run build

# Add native platforms
npx cap add android
npx cap add ios

# Open in Android Studio / Xcode
npm run mobile:android
npm run mobile:ios
```

---

## 🎮 Controls

| Action | Keyboard / Mouse | Mobile Touch |
|---|---|---|
| **Move** | `WASD` | Virtual Analog Joystick |
| **Sprint** | `Shift` (or double tap W) | Push Joystick outward |
| **Jump** | `Space` | `⏫` Touch Button |
| **Attack / Break Block** | `Left Click` | `⚔️ Attack` Button |
| **Place Block / Use Item** | `Right Click` | `🧱 Place` Button |
| **Item Shop** | `B` or `E` | `🛒 Shop` Button |
| **Team Upgrades** | `U` | In-game Shopkeeper |
| **In-Game Chat** | `T` or `Enter` | `💬 Chat` Button |
| **Hotbar Select** | `1` - `9` or `Mouse Wheel` | Tap Hotbar Slot |
| **Studio Fly Controls** | `Space` (Up), `Shift` (Down), `F` (Fly Speed) | Joystick & Touch Drag |

---

## 📁 Repository Structure

```
bedwars-studio/
├── netlify.toml               # Netlify production build & redirect config
├── capacitor.config.json      # Mobile Android/iOS packaging config
├── package.json               # NPM scripts and dependencies
├── vite.config.js             # High-speed Vite bundler configuration
├── desktop/
│   └── electron-main.cjs      # Native Desktop window process
├── public/
│   ├── favicon.svg            # Custom voxel bed icon
│   └── maps/                  # Pre-packaged map JSONs
└── src/
    ├── main.js                # App entrypoint and menu controller
    ├── style.css              # Cyber-Voxel styling, glassmorphism HUD & touch UI
    ├── engine/
    │   ├── VoxelWorld.js      # Chunk manager, instanced meshing, raycaster
    │   ├── Physics.js         # AABB voxel collisions, jump, knockback, explosions
    │   ├── Raycaster.js       # Voxel selection, break progress & tool speed
    │   ├── SoundManager.js    # Procedural Web Audio API sound synthesizer
    │   └── ParticleSystem.js  # Block debris, sparks, explosions, rainbow bursts
    ├── game/
    │   ├── GameManager.js     # Master match orchestrator & archipelago builder
    │   ├── TeamManager.js     # Team state, bed lifecycle, upgrades
    │   ├── GeneratorManager.js# Team Forge, Diamond and Emerald spawners
    │   ├── ShopManager.js     # Shop catalog, economy, item purchasing
    │   ├── UpgradesManager.js # Team upgrade tree (Sharpness, Protection, Traps)
    │   ├── LuckyBlock.js      # Chaotic lucky block drop matrix & surprises
    │   └── Modes.js           # 14 Game Mode rule sets
    ├── entities/
    │   ├── Player.js          # Base Player & Inventory management
    │   ├── LocalPlayer.js     # First-person camera, pointer lock, hand animations
    │   ├── RemotePlayer.js    # 3D voxel avatar with nametag & network interpolation
    │   ├── BotPlayer.js       # AI-controlled 3D player
    │   └── Projectile.js      # Fireballs, TNT, Ender Pearls, Bridge Eggs
    ├── ai/
    │   ├── VoxelPathfinder.js # 3D A* pathfinding on voxel grid
    │   └── BotBrain.js        # Tactical AI behavior tree (resource, bridge, pvp)
    ├── net/
    │   └── NetworkManager.js  # Serverless WebRTC P2P mesh with room codes
    ├── studio/
    │   └── StudioEditor.js    # In-game 3D voxel editor, entity markers, JSON IO
    └── ui/
        ├── HUD.js             # Live hearts, armor, hotbar, team bed tracker
        ├── ShopUI.js          # Interactive item shopkeeper modal
        ├── UpgradesUI.js      # Interactive team upgrades modal
        ├── ChatUI.js          # Real-time chat system with team and system channels
        └── MobileControls.js  # Virtual joystick & on-screen touch controls
```

---

## 📜 License
MIT License. Free to use, modify, and deploy!
