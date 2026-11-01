import * as THREE from 'three';
import { VoxelWorld, BLOCK_TYPES } from '../engine/VoxelWorld.js';
import { Physics } from '../engine/Physics.js';
import { VoxelRaycaster } from '../engine/Raycaster.js';
import { SoundManager } from '../engine/SoundManager.js';
import { ParticleSystem } from '../engine/ParticleSystem.js';
import { TeamManager } from './TeamManager.js';
import { GeneratorManager } from './GeneratorManager.js';
import { ProjectileManager } from '../entities/Projectile.js';
import { LocalPlayer } from '../entities/LocalPlayer.js';
import { BotPlayer } from '../entities/BotPlayer.js';
import { RemotePlayer } from '../entities/RemotePlayer.js';
import { VoxelPathfinder } from '../ai/VoxelPathfinder.js';
import { LuckyBlockHandler } from './LuckyBlock.js';
import { NetworkManager } from '../net/NetworkManager.js';
import { StudioEditor } from '../studio/StudioEditor.js';
import { HUD } from '../ui/HUD.js';
import { ShopUI } from '../ui/ShopUI.js';
import { UpgradesUI } from '../ui/UpgradesUI.js';
import { ChatUI } from '../ui/ChatUI.js';
import { MobileControls } from '../ui/MobileControls.js';
import { GAME_MODES } from './Modes.js';

export class GameManager {
  constructor() {
    this.canvas = document.getElementById('game-canvas');
    this.isMatchRunning = false;
    this.isMultiplayer = false;
    this.currentMode = 'solo';
    this.matchTime = 0;

    this.matchStats = {
      kills: 0,
      finalKills: 0,
      bedsBroken: 0,
    };

    // 1. Initialize Three.js Engine
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x0c1020);
    this.scene.fog = new THREE.FogExp2(0x0c1020, 0.015);

    this.camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 300);
    this.renderer = new THREE.WebGLRenderer({ canvas: this.canvas, antialias: true, powerPreference: 'high-performance' });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    // 2. Lighting & Dynamic Skybox
    this.initLighting();

    // 3. Subsystems
    this.world = new VoxelWorld(this.scene);
    this.physics = new Physics(this.world);
    this.raycaster = new VoxelRaycaster(this.scene, this.world);
    this.sound = new SoundManager();
    this.particles = new ParticleSystem(this.scene);
    this.pathfinder = new VoxelPathfinder(this.world);
    this.teamManager = new TeamManager();
    this.generatorManager = new GeneratorManager(this.scene, this.sound);
    this.projectileManager = new ProjectileManager(this.scene, this.world, this.physics, this.sound, this.particles);
    this.luckyBlockHandler = new LuckyBlockHandler(this);

    // 4. Entities
    this.players = [];
    this.localPlayer = new LocalPlayer('player_local', 'You', 'red', this.camera, this.canvas);
    this.players.push(this.localPlayer);

    // 5. Network Subsystem
    this.network = new NetworkManager(this);

    // 6. UI Controllers
    this.hud = new HUD(this);
    this.shopUI = new ShopUI(this);
    this.upgradesUI = new UpgradesUI(this);
    this.chat = new ChatUI(this);
    this.mobileControls = new MobileControls(this);
    this.studioEditor = new StudioEditor(this);

    // 7. Chaos & Void Timers
    this.chaosTimer = 0;
    this.voidRisingTimer = 0;
    this.currentVoidY = -15;

    // Bind event hooks
    this.initHooks();
    this.initWindowEvents();

    // Main Game Loop Clock
    this.clock = new THREE.Clock();
    this.animate = this.animate.bind(this);
    requestAnimationFrame(this.animate);
  }

  initLighting() {
    const ambient = new THREE.AmbientLight(0xdde8ff, 0.7);
    this.scene.add(ambient);

    this.sunLight = new THREE.DirectionalLight(0xfff8ee, 1.2);
    this.sunLight.position.set(40, 80, 50);
    this.sunLight.castShadow = true;
    this.sunLight.shadow.mapSize.width = 2048;
    this.sunLight.shadow.mapSize.height = 2048;
    this.sunLight.shadow.camera.near = 10;
    this.sunLight.shadow.camera.far = 180;
    const d = 50;
    this.sunLight.shadow.camera.left = -d;
    this.sunLight.shadow.camera.right = d;
    this.sunLight.shadow.camera.top = d;
    this.sunLight.shadow.camera.bottom = -d;
    this.scene.add(this.sunLight);

    // Floating Clouds
    this.initClouds();
  }

  initClouds() {
    this.cloudsGroup = new THREE.Group();
    const cloudMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.18 });
    for (let i = 0; i < 18; i++) {
      const w = 15 + Math.random() * 25;
      const l = 15 + Math.random() * 25;
      const cloud = new THREE.Mesh(new THREE.BoxGeometry(w, 2, l), cloudMat);
      cloud.position.set(
        (Math.random() - 0.5) * 220,
        -5 + Math.random() * 5,
        (Math.random() - 0.5) * 220
      );
      this.cloudsGroup.add(cloud);
    }
    this.scene.add(this.cloudsGroup);
  }

  initHooks() {
    // Local player void fall
    this.localPlayer.onVoidFall = () => {
      this.handlePlayerDeath(this.localPlayer, 'the Void');
    };

    // Local player damaged hook
    this.localPlayer.onDamaged = (amount, source) => {
      const flash = document.getElementById('damage-flash');
      if (flash) {
        flash.classList.add('active');
        setTimeout(() => flash.classList.remove('active'), 150);
      }
      if (this.sound) this.sound.playHitDing();
      this.hud.update(this.localPlayer);
    };

    // Local player slot change
    this.localPlayer.onSlotChange = () => {
      this.hud.update(this.localPlayer);
    };
  }

  initWindowEvents() {
    window.addEventListener('resize', () => {
      this.camera.aspect = window.innerWidth / window.innerHeight;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(window.innerWidth, window.innerHeight);
    });

    // Mouse Clicks for Attack & Place
    window.addEventListener('mousedown', (e) => {
      if (!this.isMatchRunning && !this.studioEditor.active) return;
      if (document.pointerLockElement !== this.canvas && !this.mobileControls.enabled) return;

      this.sound.init();
      this.sound.resume();

      if (this.studioEditor.active) {
        this.studioEditor.handleMouseClick(e.button === 2);
        return;
      }

      if (e.button === 0) {
        // Left Click: Attack or Start Break
        this.onPlayerAttack();
      } else if (e.button === 2) {
        // Right Click: Place block or Use item
        this.onPlayerPlace();
      }
    });

    // Prevent context menu
    window.addEventListener('contextmenu', (e) => e.preventDefault());
  }

  // --- ATTACK & BLOCK BREAKING ---
  onPlayerAttack() {
    this.localPlayer.triggerSwing();

    // 1. Check if swinging at an enemy entity within melee range (3.5 blocks)
    let hitEntity = null;
    let minD = 3.5;
    const eye = this.camera.position;
    const forward = new THREE.Vector3();
    this.camera.getWorldDirection(forward);

    for (const player of this.players) {
      if (player === this.localPlayer || !player.isAlive) continue;
      const toPlayer = new THREE.Vector3().subVectors(player.position, eye);
      const dist = toPlayer.length();
      if (dist < minD) {
        // Angle check
        const dot = forward.dot(toPlayer.clone().normalize());
        if (dot > 0.85) {
          hitEntity = player;
          minD = dist;
        }
      }
    }

    if (hitEntity) {
      const activeItem = this.localPlayer.getActiveItem();
      const baseDamage = activeItem && activeItem.itemType === 'weapon' ? activeItem.damage : 2;
      const team = this.teamManager.getTeam(this.localPlayer.teamId);
      const sharpDamage = team && team.upgrades.sharpness ? 1.5 : 0;
      const totalDamage = baseDamage + sharpDamage;

      hitEntity.takeDamage(totalDamage, this.localPlayer.name);
      const kb = activeItem && activeItem.knockback ? activeItem.knockback : 10.0;
      this.physics.applyKnockback(hitEntity, this.localPlayer.position, kb, 5.0);

      if (this.sound) {
        this.sound.playSwordSwing();
        this.sound.playHitDing();
      }

      // Life steal in Vampire mode
      if (this.modeConfig && this.modeConfig.lifeSteal) {
        this.localPlayer.health = Math.min(this.localPlayer.maxHealth, this.localPlayer.health + 2);
        this.localPlayer.addResource('iron', 2);
        this.hud.update(this.localPlayer);
      }
      return;
    }

    // 2. Otherwise, check block breaking
    const hit = this.raycaster.currentHit;
    if (hit && hit.hit) {
      const { x, y, z } = hit.blockPos;
      const blockType = hit.blockType;

      // Check if this block is an enemy bed
      const prop = BLOCK_PROPERTIES[blockType];
      if (prop && prop.isBed) {
        const bedData = this.world.getBlockData(x, y, z);
        const bedTeam = bedData ? bedData.team : null;
        if (bedTeam && bedTeam !== this.localPlayer.teamId) {
          this.breakBed(bedTeam, this.localPlayer.name);
          this.world.setBlock(x, y, z, BLOCK_TYPES.AIR);
          return;
        }
      }

      // Check lucky block
      if (blockType === BLOCK_TYPES.LUCKY_BLOCK) {
        this.world.setBlock(x, y, z, BLOCK_TYPES.AIR);
        this.particles.spawnBlockDebris(new THREE.Vector3(x + 0.5, y + 0.5, z + 0.5), 0xffaa00);
        this.luckyBlockHandler.trigger(this.localPlayer, new THREE.Vector3(x + 0.5, y + 0.5, z + 0.5));
        return;
      }

      // Regular block break
      const activeItem = this.localPlayer.getActiveItem();
      const toolType = activeItem ? activeItem.id : 'fist';
      const broken = this.raycaster.progressBreak(0.3, toolType);

      if (broken) {
        this.world.setBlock(x, y, z, BLOCK_TYPES.AIR);
        const color = prop ? prop.color : 0xcccccc;
        this.particles.spawnBlockDebris(new THREE.Vector3(x + 0.5, y + 0.5, z + 0.5), color);
        if (this.sound) this.sound.playBlockBreak();
        if (this.network && this.isMultiplayer) {
          this.network.sendBlockSet(x, y, z, BLOCK_TYPES.AIR);
        }
      } else {
        if (this.sound) this.sound.playSwordSwing();
      }
    } else {
      if (this.sound) this.sound.playSwordSwing();
    }
  }

  // --- PLACE BLOCK OR USE UTILITY ---
  onPlayerPlace() {
    const activeItem = this.localPlayer.getActiveItem();
    if (!activeItem) return;

    // 1. Consume Golden Apple
    if (activeItem.id === 'golden_apple') {
      this.localPlayer.health = Math.min(this.localPlayer.maxHealth, this.localPlayer.health + 8);
      this.localPlayer.inventory.removeItem(this.localPlayer.activeSlotIndex, 1);
      if (this.sound) this.sound.playResourcePickup('gold');
      this.hud.update(this.localPlayer);
      return;
    }

    // 2. Launch Fireball
    if (activeItem.id === 'fireball') {
      const eye = this.camera.position.clone();
      const dir = new THREE.Vector3();
      this.camera.getWorldDirection(dir);
      this.projectileManager.spawnFireball(this.localPlayer, eye.addScaledVector(dir, 0.8), dir);
      this.localPlayer.inventory.removeItem(this.localPlayer.activeSlotIndex, 1);
      this.hud.update(this.localPlayer);
      return;
    }

    // 3. Throw Ender Pearl
    if (activeItem.id === 'ender_pearl') {
      const eye = this.camera.position.clone();
      const dir = new THREE.Vector3();
      this.camera.getWorldDirection(dir);
      this.projectileManager.spawnPearl(this.localPlayer, eye.addScaledVector(dir, 0.8), dir);
      this.localPlayer.inventory.removeItem(this.localPlayer.activeSlotIndex, 1);
      this.hud.update(this.localPlayer);
      return;
    }

    // 4. Throw Bridge Egg
    if (activeItem.id === 'bridge_egg') {
      const eye = this.camera.position.clone();
      const dir = new THREE.Vector3();
      this.camera.getWorldDirection(dir);
      const teamDef = this.teamManager.getTeam(this.localPlayer.teamId);
      const woolType = teamDef ? teamDef.woolBlock : BLOCK_TYPES.WOOL_RED;
      this.projectileManager.spawnBridgeEgg(this.localPlayer, eye.addScaledVector(dir, 0.8), dir, woolType);
      this.localPlayer.inventory.removeItem(this.localPlayer.activeSlotIndex, 1);
      this.hud.update(this.localPlayer);
      return;
    }

    // 5. Place Voxel Block
    if (activeItem.itemType === 'block') {
      const hit = this.raycaster.currentHit;
      if (hit && hit.hit && hit.placePos) {
        const { x, y, z } = hit.placePos;

        // Ensure not placing inside player AABB
        const playerPos = this.localPlayer.position;
        const hw = this.localPlayer.boundingBox.halfWidth;
        const insideX = playerPos.x + hw > x && playerPos.x - hw < x + 1;
        const insideY = playerPos.y + 1.8 > y && playerPos.y < y + 1;
        const insideZ = playerPos.z + hw > z && playerPos.z - hw < z + 1;

        if (insideX && insideY && insideZ) return;

        // Place block!
        const blockType = activeItem.blockType || BLOCK_TYPES.WOOL_RED;
        this.world.setBlock(x, y, z, blockType);

        if (blockType === BLOCK_TYPES.TNT_BLOCK) {
          // Lit TNT entity
          this.world.setBlock(x, y, z, BLOCK_TYPES.AIR);
          this.projectileManager.spawnTNT({ x, y, z }, this.localPlayer);
        }

        if (this.sound) this.sound.playBlockPlace();
        this.localPlayer.triggerSwing();

        // Deduct inventory unless in infinite blocks mode
        if (!this.modeConfig || !this.modeConfig.infiniteBlocks) {
          this.localPlayer.inventory.removeItem(this.localPlayer.activeSlotIndex, 1);
        }

        this.hud.update(this.localPlayer);

        if (this.network && this.isMultiplayer) {
          this.network.sendBlockSet(x, y, z, blockType);
        }
      }
    }
  }

  // --- BED BREAKING & GAME EVENTS ---
  breakBed(teamId, breakerName) {
    const res = this.teamManager.destroyBed(teamId, breakerName);
    if (!res.destroyed) return;

    if (this.sound) this.sound.playBedDestroyed();
    const team = res.team;
    this.chat.addSystemMessage(`⚡ ${team.name.toUpperCase()} BED was destroyed by ${breakerName}!`);
    this.hud.showAnnouncement(`${team.name.toUpperCase()} BED DESTROYED!`, `Destroyed by ${breakerName}`);

    if (breakerName === this.localPlayer.name) {
      this.matchStats.bedsBroken++;
    }

    this.hud.update(this.localPlayer);
    this.checkVictoryCondition();
  }

  handlePlayerDeath(player, killerName = 'the Void') {
    player.die(killerName);

    const team = this.teamManager.getTeam(player.teamId);
    const isFinalKill = team && !team.bedAlive;

    if (isFinalKill) {
      this.chat.addSystemMessage(`☠️ ${player.name} was final-killed by ${killerName}!`);
      if (killerName === this.localPlayer.name) {
        this.matchStats.finalKills++;
      }
    } else {
      this.chat.addSystemMessage(`💀 ${player.name} died (${killerName}).`);
      if (killerName === this.localPlayer.name) {
        this.matchStats.kills++;
      }
    }

    if (player.isLocal) {
      if (isFinalKill) {
        // Game Over Defeat
        this.showGameOver(false, 'Your bed was destroyed and you were eliminated!');
      } else {
        // Show 3s respawn overlay
        this.showRespawnCountdown();
      }
    } else if (!isFinalKill) {
      // Bot respawn after 3s
      setTimeout(() => {
        if (team && team.spawnPos) {
          player.respawn(new THREE.Vector3(team.spawnPos.x, team.spawnPos.y, team.spawnPos.z));
        }
      }, 3000);
    }

    this.checkVictoryCondition();
  }

  showRespawnCountdown() {
    const overlay = document.getElementById('respawn-overlay');
    const timerVal = document.getElementById('respawn-timer-val');
    overlay.classList.remove('hidden');

    let count = 3;
    timerVal.innerText = count;

    const interval = setInterval(() => {
      count--;
      timerVal.innerText = count;
      if (count <= 0) {
        clearInterval(interval);
        overlay.classList.add('hidden');
        const team = this.teamManager.getTeam(this.localPlayer.teamId);
        if (team && team.spawnPos) {
          this.localPlayer.respawn(new THREE.Vector3(team.spawnPos.x, team.spawnPos.y, team.spawnPos.z));
          this.hud.update(this.localPlayer);
        }
      }
    }, 1000);
  }

  checkVictoryCondition() {
    const activeTeams = this.teamManager.getActiveTeams();
    if (activeTeams.length === 1) {
      const winner = activeTeams[0];
      const isPlayerVictory = winner.id === this.localPlayer.teamId;
      this.showGameOver(isPlayerVictory, `Team ${winner.name} is Victorious!`);
    }
  }

  showGameOver(isVictory, message) {
    this.isMatchRunning = false;
    const overlay = document.getElementById('gameover-overlay');
    const title = document.getElementById('gameover-title');
    const sub = document.getElementById('gameover-subtitle');

    title.className = isVictory ? 'title-victory' : 'title-defeat';
    title.innerText = isVictory ? 'VICTORY!' : 'GAME OVER';
    sub.innerText = message;

    document.getElementById('gov-kills').innerText = this.matchStats.kills;
    document.getElementById('gov-final-kills').innerText = this.matchStats.finalKills;
    document.getElementById('gov-beds').innerText = this.matchStats.bedsBroken;

    overlay.classList.remove('hidden');

    if (isVictory && this.sound) {
      this.sound.playVictory();
    }

    if (document.pointerLockElement) {
      document.exitPointerLock();
    }
  }

  // --- MATCH INITIALIZATION ---
  startMatch(modeId = 'solo', withBots = true) {
    this.currentMode = modeId;
    this.modeConfig = GAME_MODES[modeId] || GAME_MODES.solo;
    this.isMatchRunning = true;
    this.matchTime = 0;
    this.matchStats = { kills: 0, finalKills: 0, bedsBroken: 0 };
    this.currentVoidY = -15;

    // Hide Menus & Modals
    document.getElementById('main-menu').classList.add('hidden');
    document.getElementById('gameover-overlay').classList.add('hidden');
    document.getElementById('respawn-overlay').classList.add('hidden');
    document.getElementById('multiplayer-modal').classList.add('hidden');

    // Show HUD
    this.hud.show();

    // Reset World and build preset archipelago
    this.generatorManager.clear();
    this.projectileManager.clear();
    this.particles.clear();
    this.world.clear();

    // Setup Teams based on mode
    const activeTeams = this.modeConfig.activeTeams || ['red', 'blue', 'green', 'yellow'];
    this.teamManager.initTeams(activeTeams);

    // Build balanced Bedwars Archipelago
    this.buildDefaultArchipelago(activeTeams);

    // Setup Local Player
    const playerTeam = this.teamManager.getTeam('red');
    this.localPlayer.teamId = 'red';
    this.localPlayer.respawn(new THREE.Vector3(playerTeam.spawnPos.x, playerTeam.spawnPos.y, playerTeam.spawnPos.z));

    // Apply Mode Speed & Gravity
    if (this.modeConfig.gravityMultiplier) {
      this.physics.setGravityMultiplier(this.modeConfig.gravityMultiplier);
    } else {
      this.physics.setGravityMultiplier(1.0);
    }

    if (this.modeConfig.playerSpeedMultiplier) {
      this.localPlayer.sprintSpeed = 6.8 * this.modeConfig.playerSpeedMultiplier;
    }

    // Apply starting items
    if (this.modeConfig.startingItems) {
      for (const item of this.modeConfig.startingItems) {
        this.localPlayer.inventory.addItem(item);
      }
    }

    // Clear old bots
    for (let i = this.players.length - 1; i >= 1; i--) {
      this.players[i].dispose();
      this.players.splice(i, 1);
    }

    // Spawn AI bots for all other active teams
    if (withBots) {
      for (const teamId of activeTeams) {
        if (teamId === 'red') continue; // player team
        const botTeam = this.teamManager.getTeam(teamId);
        const bot = new BotPlayer(`bot_${teamId}`, `Bot ${botTeam.name}`, teamId, this);
        bot.respawn(new THREE.Vector3(botTeam.spawnPos.x, botTeam.spawnPos.y, botTeam.spawnPos.z));
        this.players.push(bot);
      }
    }

    this.hud.update(this.localPlayer, this.matchTime, this.currentMode);
    this.chat.addSystemMessage(`🚀 Match started in mode: ${this.modeConfig.name}! Protect your bed!`);
  }

  // --- PROCEDURAL BEDWARS MAP BUILDER ---
  buildDefaultArchipelago(teamIds) {
    const centerRadius = 38.0; // distance of team islands from center

    // 1. Center Emerald Island (X: 0, Z: 0, Y: 18)
    this.buildIsland(0, 18, 0, 7, BLOCK_TYPES.STONE, BLOCK_TYPES.GRASS);
    this.generatorManager.addEmeraldGenerator(0, 20, 0);

    // 2. Diamond Outpost Islands (4 diagonal outposts)
    const diaAngles = [Math.PI / 4, 3 * Math.PI / 4, 5 * Math.PI / 4, 7 * Math.PI / 4];
    for (const angle of diaAngles) {
      const dx = Math.round(Math.cos(angle) * 22);
      const dz = Math.round(Math.sin(angle) * 22);
      this.buildIsland(dx, 16, dz, 4, BLOCK_TYPES.STONE, BLOCK_TYPES.END_STONE);
      this.generatorManager.addDiamondGenerator(dx, 18, dz);
    }

    // 3. Team Islands in circular orbit
    const count = teamIds.length;
    for (let i = 0; i < count; i++) {
      const angle = (i / count) * Math.PI * 2;
      const tx = Math.round(Math.cos(angle) * centerRadius);
      const tz = Math.round(Math.sin(angle) * centerRadius);
      const ty = 14;

      const teamId = teamIds[i];
      const team = this.teamManager.getTeam(teamId);

      // Build team base island
      this.buildIsland(tx, ty, tz, 6, BLOCK_TYPES.STONE, team.woolBlock || BLOCK_TYPES.DIRT);

      // Bed position
      const bedX = tx + 3;
      const bedY = ty + 2;
      const bedZ = tz;
      this.world.setBlock(bedX, bedY, bedZ, BLOCK_TYPES.BED_HEAD, { team: teamId });
      this.world.setBlock(bedX + 1, bedY, bedZ, BLOCK_TYPES.BED_FOOT, { team: teamId });
      this.teamManager.setBedPosition(teamId, bedX, bedY, bedZ);

      // Spawn position
      const spawnX = tx - 2;
      const spawnY = ty + 2;
      const spawnZ = tz;
      this.teamManager.setSpawnPosition(teamId, spawnX, spawnY, spawnZ);

      // Team Forge generator
      this.generatorManager.addForgeGenerator(tx, ty + 2, tz + 3, teamId);
    }

    this.world.rebuildMeshes();
  }

  buildIsland(cx, cy, cz, radius, coreBlock, topBlock) {
    for (let x = -radius; x <= radius; x++) {
      for (let z = -radius; z <= radius; z++) {
        if (x * x + z * z <= radius * radius) {
          // Top layer
          this.world.setBlock(cx + x, cy + 1, cz + z, topBlock);
          // Core layers below
          const depth = Math.max(1, Math.round(radius - Math.hypot(x, z) * 0.7));
          for (let y = 0; y < depth; y++) {
            this.world.setBlock(cx + x, cy - y, cz + z, coreBlock);
          }
        }
      }
    }
  }

  // --- CHAOS EVENTS RUNNER ---
  triggerRandomChaosEvent() {
    const events = [
      {
        name: 'Flash Sale (Everything 75% Off!)',
        run: () => {
          this.chat.addSystemMessage('⚡ CHAOS: Flash Sale! Shop items cost 75% less for 25s!');
        },
      },
      {
        name: 'Trampoline World',
        run: () => {
          this.chat.addSystemMessage('⚡ CHAOS: Trampoline Pads spawned across all bridges!');
        },
      },
      {
        name: 'Meteor Shower',
        run: () => {
          this.chat.addSystemMessage('⚡ CHAOS: Meteor Shower incoming! Take cover!');
          for (let i = 0; i < 5; i++) {
            setTimeout(() => {
              const randP = this.players[Math.floor(Math.random() * this.players.length)];
              if (randP && randP.isAlive) {
                const target = randP.position.clone().add(new THREE.Vector3((Math.random() - 0.5) * 8, 0, (Math.random() - 0.5) * 8));
                this.physics.applyExplosion(target, 4.0, 15.0, this.players);
                if (this.sound) this.sound.playExplosion();
                this.particles.spawnExplosion(target, 30);
              }
            }, i * 1500);
          }
        },
      },
    ];

    const chosen = events[Math.floor(Math.random() * events.length)];
    chosen.run();
  }

  // --- MAIN ANIMATION & GAME LOOP ---
  animate() {
    requestAnimationFrame(this.animate);
    const delta = Math.min(this.clock.getDelta(), 0.1);

    // 1. Studio Editor Mode update
    if (this.studioEditor.active) {
      this.studioEditor.update(delta);
      this.raycaster.update(this.camera);
      this.world.update();
      this.renderer.render(this.scene, this.camera);
      return;
    }

    // 2. In-Match Update
    if (this.isMatchRunning) {
      this.matchTime += delta;

      // Update Local Player Physics & Camera
      this.physics.updateEntity(this.localPlayer, delta, this.localPlayer.input, this.localPlayer.yaw);
      this.localPlayer.update(delta);

      // Raycast targeted voxel
      this.raycaster.update(this.camera);

      // Update AI Bot Players & Remote Players
      for (let i = 1; i < this.players.length; i++) {
        this.players[i].update(delta);
      }

      // Update Projectiles & Explosions
      this.projectileManager.update(delta, this.players);

      // Update Item Generators & Magnetic Drops
      const genSpeed = this.modeConfig ? this.modeConfig.generatorSpeed : 1.0;
      this.generatorManager.update(delta, this.players, genSpeed);

      // Update Particles
      this.particles.update(delta);

      // Update Voxel Meshes if modified
      this.world.update();

      // Cloud animation
      if (this.cloudsGroup) {
        this.cloudsGroup.position.x += delta * 0.8;
        if (this.cloudsGroup.position.x > 100) this.cloudsGroup.position.x = -100;
      }

      // Void Rising Mode Logic
      if (this.modeConfig && this.modeConfig.voidRisingInterval > 0) {
        this.voidRisingTimer += delta;
        if (this.voidRisingTimer >= this.modeConfig.voidRisingInterval) {
          this.voidRisingTimer = 0;
          this.currentVoidY += 1.0;
          this.physics.setVoidLevel(this.currentVoidY);
          this.chat.addSystemMessage(`🌋 The Void has risen to Y = ${Math.floor(this.currentVoidY)}!`);
        }
      }

      // Chaos Events Mode Logic
      if (this.modeConfig && this.modeConfig.chaosEvents) {
        this.chaosTimer += delta;
        if (this.chaosTimer >= 45.0) {
          this.chaosTimer = 0;
          this.triggerRandomChaosEvent();
        }
      }

      // Send local player position over WebRTC multiplayer
      if (this.network && this.isMultiplayer) {
        const isMoving = this.localPlayer.input.forward || this.localPlayer.input.backward;
        this.network.sendPlayerPosition(this.localPlayer.position, this.localPlayer.yaw, isMoving);
      }

      // Periodic HUD update
      this.hud.update(this.localPlayer, this.matchTime, this.currentMode);
    }

    // 3. Render 3D Scene
    this.renderer.render(this.scene, this.camera);
  }

  // --- MULTIPLAYER PEER CALLBACKS ---
  onPeerJoin(peer) {
    this.chat.addSystemMessage(`👋 Player ${peer.name} connected via WebRTC!`);
    const remote = new RemotePlayer(peer.id, peer.name, peer.team || 'blue', this.scene);
    this.players.push(remote);
  }

  onPeerLeave(peerId) {
    const idx = this.players.findIndex(p => p.id === peerId);
    if (idx !== -1) {
      this.players[idx].dispose();
      this.players.splice(idx, 1);
    }
  }

  onRemotePlayerMove(id, pos, yaw, isMoving) {
    const player = this.players.find(p => p.id === id);
    if (player && !player.isLocal) {
      player.setNetworkState(new THREE.Vector3(pos.x, pos.y, pos.z), yaw, isMoving);
    }
  }

  openMainMenu() {
    this.isMatchRunning = false;
    this.hud.hide();
    document.getElementById('main-menu').classList.remove('hidden');
    if (document.pointerLockElement) {
      document.exitPointerLock();
    }
  }
}
