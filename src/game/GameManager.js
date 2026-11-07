import * as THREE from 'three';
import { VoxelWorld, BLOCK_TYPES } from '../engine/VoxelWorld.js';
import { Physics } from '../engine/Physics.js';
import { SoundManager } from '../engine/SoundManager.js';
import { ParticleSystem } from '../engine/ParticleSystem.js';
import { TeamManager } from './TeamManager.js';
import { GeneratorManager } from './GeneratorManager.js';
import { LocalPlayer } from '../entities/LocalPlayer.js';
import { BotPlayer } from '../entities/BotPlayer.js';
import { MAP_PRESETS } from './MapPresets.js';
import { StudioEditor } from '../studio/StudioEditor.js';
import { HUD } from '../ui/HUD.js';
import { NetworkManager } from '../net/NetworkManager.js';

export class GameManager {
  constructor() {
    this.canvas = document.getElementById('game-canvas');
    this.isMatchRunning = false;
    this.matchTime = 0;
    this.mapPreset = MAP_PRESETS.speedway;

    // 1. Scene & Camera Setup
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x0f172a); // Deep cyber blue
    this.scene.fog = new THREE.FogExp2(0x0f172a, 0.012);

    this.camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 400);
    this.renderer = new THREE.WebGLRenderer({ canvas: this.canvas, antialias: true, powerPreference: 'high-performance' });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    // 2. Lighting Setup
    this.initLighting();

    // 3. Engine Subsystems
    this.world = new VoxelWorld(this.scene);
    this.physics = new Physics(this.world);
    this.sound = new SoundManager();
    this.particles = new ParticleSystem(this.scene);
    this.teamManager = new TeamManager();
    this.generatorManager = new GeneratorManager(this.scene, this.sound);
    this.network = new NetworkManager(this);
    this.studioEditor = new StudioEditor(this);

    // 4. Players
    this.players = [];
    this.localPlayer = new LocalPlayer('player_local', 'You', 'red', this.camera, this.canvas);
    this.players.push(this.localPlayer);

    // 5. HUD Setup
    this.hud = new HUD(this);

    // 6. Interaction Listeners
    this.initInteractions();

    // 7. Window Resize
    window.addEventListener('resize', () => {
      this.camera.aspect = window.innerWidth / window.innerHeight;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(window.innerWidth, window.innerHeight);
    });

    // 8. Clock & Render Loop
    this.clock = new THREE.Clock();
    this.animate = this.animate.bind(this);
    requestAnimationFrame(this.animate);
  }

  initLighting() {
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.65);
    this.scene.add(ambientLight);

    const dirLight = new THREE.DirectionalLight(0xfff7ed, 1.2);
    dirLight.position.set(40, 80, 50);
    dirLight.castShadow = true;
    dirLight.shadow.mapSize.width = 2048;
    dirLight.shadow.mapSize.height = 2048;
    dirLight.shadow.camera.near = 10;
    dirLight.shadow.camera.far = 250;
    dirLight.shadow.camera.left = -60;
    dirLight.shadow.camera.right = 60;
    dirLight.shadow.camera.top = 60;
    dirLight.shadow.camera.bottom = -60;
    this.scene.add(dirLight);

    // Subtle blue fill light from void beneath
    const hemiLight = new THREE.HemisphereLight(0x93c5fd, 0x0f172a, 0.4);
    this.scene.add(hemiLight);
  }

  initInteractions() {
    // Mouse Clicks
    this.canvas.addEventListener('mousedown', (e) => {
      if (document.pointerLockElement !== this.canvas) return;

      if (e.button === 0) {
        // Left click: Attack / Break block / Studio placement
        this.handleLeftClick();
      } else if (e.button === 2) {
        // Right click: Place block / Interact
        this.handleRightClick();
      }
    });

    // Keys
    window.addEventListener('keydown', (e) => {
      if (e.code === 'KeyE') {
        if (!this.hud.shopModal.classList.contains('hidden')) {
          this.hud.closeShop();
        } else if (!this.hud.upgradesModal.classList.contains('hidden')) {
          this.hud.upgradesModal.classList.add('hidden');
          this.canvas.requestPointerLock();
        } else {
          this.hud.openShop();
        }
      } else if (e.code === 'KeyU') {
        if (document.pointerLockElement) document.exitPointerLock();
        this.hud.upgradesModal.classList.remove('hidden');
      }
    });
  }

  handleLeftClick() {
    this.localPlayer.triggerSwing();
    if (this.sound) this.sound.playSwordSwing();

    // In Studio Mode
    if (this.studioEditor.isActive) {
      const ray = this.getAimRaycast();
      this.studioEditor.handlePlacement(ray);
      return;
    }

    // Check entity attack first (PVP)
    const aimRay = new THREE.Ray(this.camera.position, this.camera.getWorldDirection(new THREE.Vector3()));
    for (const bot of this.players) {
      if (bot === this.localPlayer || bot.isDead) continue;
      const dist = aimRay.distanceToPoint(bot.position);
      if (dist < 1.2 && this.localPlayer.position.distanceTo(bot.position) < 3.8) {
        // Attack bot!
        bot.takeDamage(this.localPlayer.weapon.damage || 4.0, this.localPlayer, this.physics);
        if (this.sound) this.sound.playHit();
        this.particles.spawnHitSparks(bot.position);
        return;
      }
    }

    // Raycast voxel block breaking
    const hit = this.getAimRaycast();
    if (hit.hit) {
      const { x, y, z } = hit.blockPos;
      const blockType = hit.type;

      // Bed destruction
      if (blockType === BLOCK_TYPES.BED_HEAD || blockType === BLOCK_TYPES.BED_FOOT) {
        this.destroyBedAt(x, y, z, this.localPlayer);
        return;
      }

      // Lucky Block breaking
      if (blockType === BLOCK_TYPES.LUCKY_BLOCK) {
        this.world.setBlock(x, y, z, BLOCK_TYPES.AIR);
        this.world.rebuildMeshes();
        this.particles.spawnBlockBreak({ x, y, z }, 0xf59e0b, 16);
        if (this.sound) this.sound.playExplosion();
        // Give random high-tier loot
        this.localPlayer.addResource('diamond', 2);
        this.localPlayer.addResource('emerald', 1);
        this.hud.showAnnouncement('LUCKY BLOCK OPENED!', '+2 Diamonds & +1 Emerald!');
        return;
      }

      // Regular block destruction
      this.world.setBlock(x, y, z, BLOCK_TYPES.AIR);
      this.world.rebuildMeshes();
      if (this.sound) this.sound.playBlockBreak();
      this.particles.spawnBlockBreak({ x, y, z }, 0x94a3b8, 10);
    }
  }

  handleRightClick() {
    if (this.studioEditor.isActive) {
      const ray = this.getAimRaycast();
      this.studioEditor.handlePlacement(ray);
      return;
    }

    // Check interaction with shopkeeper NPC
    for (const shop of this.mapPreset.shopkeepers) {
      const dist = this.localPlayer.position.distanceTo(new THREE.Vector3(shop.pos.x, shop.pos.y, shop.pos.z));
      if (dist < 4.0) {
        this.hud.openShop();
        return;
      }
    }

    // Place block from selected hotbar slot
    const item = this.localPlayer.getSelectedItem();
    if (item && item.type === 'block') {
      const hit = this.getAimRaycast();
      if (hit.hit) {
        const { x, y, z } = hit.placePos;
        // Don't place inside player bounding box
        const playerBox = new THREE.Box3(
          new THREE.Vector3(this.localPlayer.position.x - 0.3, this.localPlayer.position.y, this.localPlayer.position.z - 0.3),
          new THREE.Vector3(this.localPlayer.position.x + 0.3, this.localPlayer.position.y + 1.8, this.localPlayer.position.z + 0.3)
        );
        const blockBox = new THREE.Box3(new THREE.Vector3(x, y, z), new THREE.Vector3(x + 1, y + 1, z + 1));
        if (!playerBox.intersectsBox(blockBox)) {
          this.world.setBlock(x, y, z, item.blockType);
          this.world.rebuildMeshes();
          if (this.sound) this.sound.playBlockPlace();
          this.localPlayer.consumeSelectedItem();
          this.hud.updateHotbar(this.localPlayer);
        }
      }
    } else if (item && item.type === 'consumable' && item.id === 'gapple') {
      // Eat Golden Apple
      this.localPlayer.health = Math.min(this.localPlayer.maxHealth, this.localPlayer.health + 8);
      this.localPlayer.consumeSelectedItem();
      if (this.sound) this.sound.playItemPickup();
      this.hud.showAnnouncement('GOLDEN APPLE CONSUMED!', 'Regenerated +8 HP!');
    }
  }

  getAimRaycast() {
    const dir = new THREE.Vector3();
    this.camera.getWorldDirection(dir);
    return this.world.raycast(this.camera.position, dir, 5.5);
  }

  destroyBedAt(x, y, z, destroyer) {
    const data = this.world.getBlockData(x, y, z);
    const team = data?.team;
    if (team) {
      this.world.setBlock(x, y, z, BLOCK_TYPES.AIR);
      this.world.rebuildMeshes();
      this.teamManager.destroyBed(team);
      if (this.sound) this.sound.playBedDestroyed();
      this.particles.spawnBlockBreak({ x, y, z }, 0xef4444, 24);

      if (destroyer) destroyer.bedsBroken++;

      const isYou = team === this.localPlayer.team;
      const title = `${team.toUpperCase()} BED DESTROYED!`;
      const subtitle = isYou ? 'Your bed was destroyed! You will no longer respawn!' : `Destroyed by ${destroyer ? destroyer.name : 'an enemy'}!`;
      this.hud.showAnnouncement(title, subtitle);
    }
  }

  startMatch(mode = 'solo', withBots = true) {
    this.sound.init();
    this.sound.resume();

    this.isMatchRunning = true;
    this.matchTime = 0;

    // Reset World and build preset
    this.world.clear();
    this.mapPreset.generateGeometry(this.world);
    this.generatorManager.loadSpawners(this.mapPreset.generators);

    // Position Local Player at Red team spawn
    const redSpawn = this.mapPreset.spawns.red;
    this.localPlayer.respawn(redSpawn);
    this.teamManager.teams.red.players = [this.localPlayer];

    // Spawn AI Bots for opponent teams
    // Remove previous bots
    for (let i = this.players.length - 1; i >= 1; i--) {
      this.players[i].destroy();
      this.players.splice(i, 1);
    }

    if (withBots) {
      const opponentTeams = ['blue', 'green', 'yellow'];
      opponentTeams.forEach(team => {
        const bot = new BotPlayer(`bot_${team}`, `Bot ${team.toUpperCase()}`, team, this.scene);
        const spawn = this.mapPreset.spawns[team];
        bot.respawn(spawn);
        this.players.push(bot);
        this.teamManager.teams[team].players = [bot];
      });
    }

    // Show HUD, hide main menu
    document.getElementById('main-menu')?.classList.add('hidden');
    this.hud.show();
    this.canvas.requestPointerLock();
  }

  animate() {
    requestAnimationFrame(this.animate);
    const dt = Math.min(this.clock.getDelta(), 0.1);

    if (this.isMatchRunning || this.studioEditor.isActive) {
      this.matchTime += dt;

      // 1. Update World & Particles
      this.world.update();
      this.particles.update(dt);

      // 2. Update Local Player
      this.localPlayer.update(dt, this.physics);

      // Check void fall
      if (this.localPlayer.position.y < -12 && !this.localPlayer.isDead) {
        this.localPlayer.isFinalDead = !this.teamManager.hasBed(this.localPlayer.team);
        this.localPlayer.die();
        if (this.sound) this.sound.playHit();
      }

      // Respawn timer for local player
      if (this.localPlayer.isDead && !this.localPlayer.isFinalDead) {
        this.localPlayer.respawnTimer -= dt;
        if (this.localPlayer.respawnTimer <= 0) {
          const spawn = this.mapPreset.spawns[this.localPlayer.team];
          this.localPlayer.respawn(spawn);
        }
      }

      // 3. Update Bots
      for (let i = 1; i < this.players.length; i++) {
        const bot = this.players[i];
        bot.update(dt, this);

        // Bot void fall
        if (bot.position.y < -12 && !bot.isDead) {
          bot.isFinalDead = !this.teamManager.hasBed(bot.team);
          bot.die();
        }

        // Bot respawn timer
        if (bot.isDead && !bot.isFinalDead) {
          bot.respawnTimer -= dt;
          if (bot.respawnTimer <= 0) {
            const spawn = this.mapPreset.spawns[bot.team];
            bot.respawn(spawn);
          }
        }
      }

      // 4. Update Generators
      this.generatorManager.update(dt, this.players, this.teamManager);

      // 5. Update HUD
      this.hud.update(this.localPlayer, this.teamManager, this.matchTime);

      // 6. Check Win Condition
      if (this.isMatchRunning) {
        const aliveTeams = this.teamManager.getAliveTeams();
        if (aliveTeams.length === 1 && aliveTeams[0] === this.localPlayer.team) {
          this.isMatchRunning = false;
          this.hud.showGameOver(true);
        } else if (this.localPlayer.isFinalDead && this.localPlayer.isDead) {
          this.isMatchRunning = false;
          this.hud.showGameOver(false);
        }
      }
    }

    // Render Three.js Scene
    this.renderer.render(this.scene, this.camera);
  }
}
