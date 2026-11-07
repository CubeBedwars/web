import * as THREE from 'three';
import { VoxelWorld, BLOCK_TYPES, BLOCK_PROPS } from '../engine/VoxelWorld.js';
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
import { RankManager } from '../stats/RankManager.js';
import { LevelManager } from '../stats/LevelManager.js';
import { AuthManager } from '../auth/AuthManager.js';
import { Projectile } from '../entities/Projectile.js';
import { MutationManager } from './MutationManager.js';
import { TouchControls } from '../ui/TouchControls.js';

export class GameManager {
  constructor() {
    this.canvas = document.getElementById('game-canvas');
    this.isMatchRunning = false;
    this.matchTime = 0;
    this.matchFormat = 'solo';
    this.healPoolTimer = 0;
    this.mapPreset = MAP_PRESETS.speedway;

    // Stats & Auth Managers
    this.rankManager = new RankManager();
    this.levelManager = new LevelManager();
    this.authManager = new AuthManager();

    // 1. Scene & Camera Setup
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x0f172a); // Deep cyber blue
    this.scene.fog = new THREE.FogExp2(0x0f172a, 0.012);

    this.camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.05, 400);
    this.scene.add(this.camera); // Add camera to scene graph so armGroup / weapons render

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
    this.teamManager.gameManager = this;
    this.generatorManager = new GeneratorManager(this.scene, this.sound);
    this.network = new NetworkManager(this);
    this.studioEditor = new StudioEditor(this);
    this.mutationManager = new MutationManager();
    this.projectiles = [];

    // 3b. Mining & Selection Visuals
    const crackGeo = new THREE.BoxGeometry(1.004, 1.004, 1.004);
    this.crackMaterial = new THREE.MeshBasicMaterial({
      transparent: true,
      opacity: 0.9,
      depthWrite: false,
      polygonOffset: true,
      polygonOffsetFactor: -1,
      polygonOffsetUnits: -1,
    });
    this.crackMesh = new THREE.Mesh(crackGeo, this.crackMaterial);
    this.crackMesh.visible = false;
    this.scene.add(this.crackMesh);

    const selectGeo = new THREE.EdgesGeometry(new THREE.BoxGeometry(1.002, 1.002, 1.002));
    const selectMat = new THREE.LineBasicMaterial({
      color: 0x000000,
      transparent: true,
      opacity: 0.5,
      linewidth: 2,
    });
    this.selectionMesh = new THREE.LineSegments(selectGeo, selectMat);
    this.selectionMesh.visible = false;
    this.scene.add(this.selectionMesh);

    // 3c. Hold-to-mine state tracking
    this.isLeftMouseDown = false;
    this.isMining = false;
    this.miningTarget = null;
    this.miningElapsed = 0;
    this.miningDuration = 1.0;
    this.miningHitTimer = 0;

    // 4. Players
    this.players = [];
    this.localPlayer = new LocalPlayer('player_local', 'You', 'red', this.camera, this.canvas);
    this.localPlayer.teamManager = this.teamManager;
    this.localPlayer.onDamageTaken = () => {
      this.hud?.triggerDamageFlash?.();
    };
    this.players.push(this.localPlayer);

    // 5. HUD Setup
    this.hud = new HUD(this);
    this.touchControls = new TouchControls(this);

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
        this.isLeftMouseDown = true;
        this.handleLeftClick();
      } else if (e.button === 2) {
        this.handleRightClick();
      }
    });

    window.addEventListener('mouseup', (e) => {
      if (e.button === 0) {
        this.isLeftMouseDown = false;
        this.stopMining();
      }
    });

    document.addEventListener('pointerlockchange', () => {
      if (document.pointerLockElement !== this.canvas) {
        this.isLeftMouseDown = false;
        this.stopMining();
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
        // Attack bot with team sharpness upgrade bonus!
        let attackDamage = this.localPlayer.getAttackDamage
          ? this.localPlayer.getAttackDamage(this.teamManager)
          : (this.localPlayer.weapon.damage || 4.0);
        if (this.mutationManager) {
          attackDamage = this.mutationManager.onDamage(this.localPlayer, bot, attackDamage, this);
        }
        bot.takeDamage(attackDamage, this.localPlayer, this.physics, this.teamManager);
        if (this.sound) this.sound.playHit();
        this.particles.spawnHitSparks(bot.position);
        if (this.network && this.network.activeTransport !== 'none') {
          this.network.broadcastPlayerDamage(bot.id, attackDamage);
        }
        this.stopMining();
        return;
      }
    }

    // Raycast voxel block to initiate hold-to-mine
    const hit = this.getAimRaycast();
    if (hit.hit && hit.type !== BLOCK_TYPES.AIR) {
      this.startMining(hit);
    } else {
      this.stopMining();
    }
  }

  computeBreakDuration(blockType, player) {
    const prop = BLOCK_PROPS[blockType];
    if (!prop) return 1.0;
    const hardness = prop.hardness !== undefined ? prop.hardness : 1.0;
    if (hardness >= 99999) return Infinity; // Bedrock is indestructible

    const activeTool = this.getActiveTool(player, blockType);

    // Standard Bedwars / Minecraft break duration: duration (ms) = hardness * toolMultiplier * 1000
    let toolMultiplier = 1.0;

    // Wool blocks:
    if (blockType >= BLOCK_TYPES.WOOL_WHITE && blockType <= BLOCK_TYPES.WOOL_GRAY) {
      // With shears: ~0.15s; with bare hand: ~0.75s
      toolMultiplier = (activeTool === 'shears') ? (0.15 / hardness) : (0.75 / hardness);
    }
    // Oak Wood:
    else if (blockType === BLOCK_TYPES.WOOD) {
      // With axe: ~0.75s; with bare hand: ~3.0s
      if (activeTool.includes('axe') && !activeTool.includes('pickaxe')) {
        toolMultiplier = 0.75 / hardness;
      } else {
        toolMultiplier = 3.0 / hardness;
      }
    }
    // Stone:
    else if (blockType === BLOCK_TYPES.STONE) {
      if (activeTool === 'diamond_pickaxe') toolMultiplier = 0.35 / hardness;
      else if (activeTool.includes('pickaxe')) toolMultiplier = 0.6 / hardness;
      else toolMultiplier = 7.5 / hardness; // Hand
    }
    // End Stone:
    else if (blockType === BLOCK_TYPES.END_STONE) {
      if (activeTool === 'diamond_pickaxe') toolMultiplier = 0.6 / hardness;
      else if (activeTool.includes('pickaxe')) toolMultiplier = 1.0 / hardness;
      else toolMultiplier = 15.0 / hardness; // Hand
    }
    // Ores (Iron Ore, Gold Ore, Diamond Ore, Emerald Ore):
    else if (blockType === BLOCK_TYPES.IRON_ORE || blockType === BLOCK_TYPES.GOLD_ORE ||
             blockType === BLOCK_TYPES.DIAMOND_ORE || blockType === BLOCK_TYPES.EMERALD_ORE) {
      if (activeTool === 'diamond_pickaxe') toolMultiplier = 0.5 / hardness;
      else if (activeTool.includes('pickaxe')) toolMultiplier = 0.8 / hardness;
      else toolMultiplier = 15.0 / hardness; // Hand
    }
    // Obsidian:
    else if (blockType === BLOCK_TYPES.OBSIDIAN) {
      if (activeTool === 'diamond_pickaxe') {
        toolMultiplier = 4.0 / hardness; // 4 seconds with diamond pickaxe
      } else {
        toolMultiplier = 250.0 / hardness; // 250 seconds (unbreakable with bare hands/wrong tool)
      }
    }
    // Gem Blocks (Diamond Block, Emerald Block, Iron Block, Gold Block):
    else if (blockType === BLOCK_TYPES.DIAMOND_BLOCK || blockType === BLOCK_TYPES.EMERALD_BLOCK ||
             blockType === BLOCK_TYPES.IRON_BLOCK || blockType === BLOCK_TYPES.GOLD_BLOCK) {
      if (activeTool === 'diamond_pickaxe') toolMultiplier = 0.5 / hardness;
      else if (activeTool.includes('pickaxe')) toolMultiplier = 1.0 / hardness;
      else toolMultiplier = 15.0 / hardness;
    }
    // Bed Head / Foot:
    else if (blockType === BLOCK_TYPES.BED_HEAD || blockType === BLOCK_TYPES.BED_FOOT) {
      if (activeTool === 'shears' || activeTool.includes('axe')) {
        toolMultiplier = 0.3 / hardness; // 0.3s
      } else {
        toolMultiplier = 1.25 / hardness; // 1.5s
      }
    }
    // Lucky Block:
    else if (blockType === BLOCK_TYPES.LUCKY_BLOCK) {
      if (activeTool.includes('pickaxe')) toolMultiplier = 0.25 / hardness;
      else toolMultiplier = 0.6 / hardness;
    }
    // Glass:
    else if (blockType === BLOCK_TYPES.GLASS) {
      toolMultiplier = 0.4 / hardness;
    }
    // Dirt / Grass:
    else if (blockType === BLOCK_TYPES.DIRT || blockType === BLOCK_TYPES.GRASS) {
      if (activeTool.includes('shovel')) toolMultiplier = 0.2 / hardness;
      else toolMultiplier = 0.6 / hardness;
    }
    else {
      toolMultiplier = 1.0;
    }

    return hardness * toolMultiplier; // duration in seconds
  }

  getActiveTool(player, blockType) {
    if (!player) return 'fist';
    const selected = typeof player.getSelectedItem === 'function'
      ? player.getSelectedItem()
      : (player.hotbar ? player.hotbar[player.selectedSlot || 0] : null);
    if (selected) {
      if (selected.id === 'shears' || selected.id?.includes('pickaxe') || selected.id?.includes('axe') || selected.id?.includes('shovel')) {
        return selected.id;
      }
    }
    if (player.tool && player.tool.id && player.tool.id !== 'fist') {
      return player.tool.id;
    }
    if (player.hotbar) {
      for (const item of player.hotbar) {
        if (!item) continue;
        if ((blockType >= BLOCK_TYPES.WOOL_WHITE && blockType <= BLOCK_TYPES.WOOL_GRAY) && item.id === 'shears') {
          return 'shears';
        }
        if (blockType === BLOCK_TYPES.OBSIDIAN && item.id === 'diamond_pickaxe') {
          return 'diamond_pickaxe';
        }
      }
    }
    return 'fist';
  }

  startMining(hit) {
    const { x, y, z } = hit.blockPos;
    const blockType = hit.type;

    if (blockType === BLOCK_TYPES.BEDROCK) {
      if (this.sound) this.sound.playBlockHit();
      return;
    }

    this.isMining = true;
    this.miningTarget = { ...hit };
    this.miningElapsed = 0;
    this.miningHitTimer = 0;
    this.miningDuration = this.computeBreakDuration(blockType, this.localPlayer);

    this.localPlayer.isMining = true;
    this.localPlayer.triggerSwing();
    if (this.sound) this.sound.playBlockHit();

    this.crackMesh.position.set(x + 0.5, y + 0.5, z + 0.5);
    const crackTex = this.world.texGen.getCrackTexture(0);
    this.crackMaterial.map = crackTex;
    this.crackMaterial.needsUpdate = true;
    this.crackMesh.visible = true;
  }

  stopMining() {
    this.isMining = false;
    this.miningTarget = null;
    this.miningElapsed = 0;
    this.localPlayer.isMining = false;
    if (this.crackMesh) this.crackMesh.visible = false;
  }

  updateMining(dt) {
    // 1. Block selection outline targeting
    const hit = this.getAimRaycast();
    if (hit.hit && hit.type !== BLOCK_TYPES.AIR && !this.localPlayer.isDead) {
      this.selectionMesh.position.set(hit.blockPos.x + 0.5, hit.blockPos.y + 0.5, hit.blockPos.z + 0.5);
      this.selectionMesh.visible = true;
    } else {
      this.selectionMesh.visible = false;
    }

    if (this.localPlayer.isDead) {
      if (this.isMining) this.stopMining();
      return;
    }

    // 2. Mining progression check
    if (!this.isLeftMouseDown) {
      if (this.isMining) this.stopMining();
      return;
    }

    if (!this.isMining) {
      if (hit.hit && hit.type !== BLOCK_TYPES.AIR && !this.studioEditor.isActive) {
        this.startMining(hit);
      }
      return;
    }

    // If already mining, check if target changed or crosshair swept off block
    if (!hit.hit || hit.blockPos.x !== this.miningTarget.blockPos.x ||
        hit.blockPos.y !== this.miningTarget.blockPos.y ||
        hit.blockPos.z !== this.miningTarget.blockPos.z) {
      if (hit.hit && hit.type !== BLOCK_TYPES.AIR && !this.studioEditor.isActive) {
        this.startMining(hit);
      } else {
        this.stopMining();
      }
      return;
    }

    // Reach distance check (up to 5.5 blocks)
    const playerPos = this.localPlayer.position;
    const blockCenter = new THREE.Vector3(
      this.miningTarget.blockPos.x + 0.5,
      this.miningTarget.blockPos.y + 0.5,
      this.miningTarget.blockPos.z + 0.5
    );
    if (playerPos.distanceTo(blockCenter) > 6.0) {
      this.stopMining();
      return;
    }

    // Advance elapsed time
    this.miningElapsed += dt;
    this.miningHitTimer += dt;

    // Rhythmic hit sounds and arm swing during mining progression
    if (this.miningHitTimer >= 0.2) {
      this.miningHitTimer -= 0.2;
      if (this.sound) this.sound.playBlockHit();
      this.localPlayer.triggerSwing();
    }

    // Update crack texture stage (0 to 9)
    const ratio = Math.min(0.999, this.miningElapsed / Math.max(0.01, this.miningDuration));
    const stage = Math.floor(ratio * 10);
    const crackTex = this.world.texGen.getCrackTexture(stage);
    if (this.crackMaterial.map !== crackTex) {
      this.crackMaterial.map = crackTex;
      this.crackMaterial.needsUpdate = true;
    }
    this.crackMesh.position.copy(blockCenter);
    this.crackMesh.visible = true;

    // Check breaking completion
    if (this.miningElapsed >= this.miningDuration) {
      this.finishMining();
    }
  }

  finishMining() {
    if (!this.miningTarget) return;
    const { x, y, z } = this.miningTarget.blockPos;
    const blockType = this.miningTarget.type;

    this.stopMining();

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
      if (this.mutationManager) {
        this.mutationManager.onBlockBreak(this.localPlayer, x, y, z, blockType, this);
      } else {
        // Fallback default loot
        this.localPlayer.addResource('diamond', 2);
        this.localPlayer.addResource('emerald', 1);
        this.hud.showAnnouncement('LUCKY BLOCK OPENED!', '+2 Diamonds & +1 Emerald!');
      }
      return;
    }

    // Regular block destruction
    this.world.setBlock(x, y, z, BLOCK_TYPES.AIR);
    this.world.rebuildMeshes();
    if (this.sound) this.sound.playBlockBreak();
    if (this.network && this.network.activeTransport !== 'none') {
      this.network.broadcastBlockBreak(x, y, z);
    }

    // Material-colored particle burst derived from destroyed block type
    const prop = BLOCK_PROPS[blockType];
    const particleColors = prop?.particleColors || 0x64748b;
    this.particles.spawnBlockBreak({ x, y, z }, particleColors, 14);
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

    const item = typeof this.localPlayer.getSelectedItem === 'function'
      ? this.localPlayer.getSelectedItem()
      : (this.localPlayer.hotbar ? this.localPlayer.hotbar[this.localPlayer.selectedSlot || 0] : null);

    // Projectile Launching (Fireballs from shop or Gun Game projectile weapons)
    if (item && (item.type === 'projectile' || item.isGun)) {
      this.fireProjectile(this.localPlayer, item);
      if (item.type === 'projectile') {
        this.localPlayer.consumeSelectedItem();
        this.hud.updateHotbar(this.localPlayer);
      }
      return;
    }

    // Place block from selected hotbar slot
    if (item && item.type === 'block') {
      const hit = this.getAimRaycast();
      if (hit.hit) {
        const { x, y, z } = hit.placePos;
        // Verify placement does NOT intersect ANY player or bot AABB
        const blockBox = new THREE.Box3(new THREE.Vector3(x, y, z), new THREE.Vector3(x + 1, y + 1, z + 1));
        let collidesWithEntity = false;

        for (const p of this.players) {
          if (p.isDead) continue;
          const halfW = (p.width || 0.6) / 2;
          const height = p.height || 1.8;
          const entityBox = new THREE.Box3(
            new THREE.Vector3(p.position.x - halfW, p.position.y, p.position.z - halfW),
            new THREE.Vector3(p.position.x + halfW, p.position.y + height, p.position.z + halfW)
          );
          if (entityBox.intersectsBox(blockBox)) {
            collidesWithEntity = true;
            break;
          }
        }

        if (!collidesWithEntity) {
          this.world.setBlock(x, y, z, item.blockType);
          this.world.rebuildMeshes();
          if (this.sound) this.sound.playBlockPlace();
          this.localPlayer.consumeSelectedItem();
          this.hud.updateHotbar(this.localPlayer);
          if (this.network && this.network.activeTransport !== 'none') {
            this.network.broadcastBlockPlace(x, y, z, item.blockType);
          }
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

  fireProjectile(shooter, item) {
    const origin = new THREE.Vector3().copy(this.camera.position);
    const dir = new THREE.Vector3();
    this.camera.getWorldDirection(dir);
    origin.addScaledVector(dir, 0.6); // slight forward offset

    const speed = item.speed || (item.id === 'fireball' ? 24 : 20);
    const velocity = dir.clone().multiplyScalar(speed);
    const damage = item.damage || (item.id === 'fireball' ? 12 : 8);
    const projType = item.gunType || item.id || 'fireball';
    const explosive = item.explosive !== undefined ? item.explosive : (item.id === 'fireball');
    const grav = this.mutationManager ? this.mutationManager.getGravity() : -12.0;

    const proj = new Projectile({
      scene: this.scene,
      position: origin,
      velocity,
      gravity: grav,
      damage,
      explosive,
      explosionRadius: item.id === 'fireball' ? 3.0 : 2.5,
      owner: shooter,
      type: projType,
      mutationManager: this.mutationManager,
      gameManager: this,
    });

    this.projectiles.push(proj);
    if (this.sound) this.sound.playSwordSwing?.();
    shooter.triggerSwing();
  }

  getAimRaycast() {
    const dir = new THREE.Vector3();
    this.camera.getWorldDirection(dir);
    return this.world.raycast(this.camera.position, dir, 5.5);
  }

  destroyBedAt(x, y, z, destroyer) {
    const data = this.world.getBlockData(x, y, z);
    const team = data?.team;
    if (!team) return;

    // Deduplication check: if bed was already destroyed for this team, just clear voxel
    if (!this.teamManager.hasBed(team)) {
      this.world.setBlock(x, y, z, BLOCK_TYPES.AIR);
      this.world.rebuildMeshes();
      return;
    }

    // A Bed is a 2-voxel structure (head and foot). Destroy both voxels!
    const offsets = [
      { dx: 1, dz: 0 },
      { dx: -1, dz: 0 },
      { dx: 0, dz: 1 },
      { dx: 0, dz: -1 },
    ];
    for (const off of offsets) {
      const nx = x + off.dx;
      const nz = z + off.dz;
      const nbType = this.world.getBlock(nx, y, nz);
      if (nbType === BLOCK_TYPES.BED_HEAD || nbType === BLOCK_TYPES.BED_FOOT) {
        const nbData = this.world.getBlockData(nx, y, nz);
        if (!nbData || nbData.team === team) {
          this.world.setBlock(nx, y, nz, BLOCK_TYPES.AIR);
        }
      }
    }

    this.world.setBlock(x, y, z, BLOCK_TYPES.AIR);
    this.world.rebuildMeshes();
    this.teamManager.destroyBed(team);
    if (this.sound) this.sound.playBedDestroyed();
    this.particles.spawnBlockBreak({ x, y, z }, 0xef4444, 24);
    if (this.network && this.network.activeTransport !== 'none') {
      this.network.broadcastBedDestroy(team);
    }

    if (destroyer) destroyer.bedsBroken++;

    const isYou = team === this.localPlayer.team;
    const title = `${team.toUpperCase()} BED DESTROYED!`;
    const subtitle = isYou ? 'Your bed was destroyed! You will no longer respawn!' : `Destroyed by ${destroyer ? destroyer.name : 'an enemy'}!`;
    this.hud.showAnnouncement(title, subtitle);
  }

  startMatch(mode = 'solo', withBots = true, format = null, mapName = null, activeMutators = []) {
    this.sound.init();
    this.sound.resume();

    this.isMatchRunning = true;
    this.matchTime = 0;
    this.matchFormat = format || mode || 'solo';
    this.healPoolTimer = 0;

    // 1. Resolve map preset
    if (mapName && MAP_PRESETS[mapName]) {
      this.mapPreset = MAP_PRESETS[mapName];
    } else if (this.matchFormat === '1v1' || this.matchFormat === 'duel_1v1' || mode === '1v1') {
      this.mapPreset = MAP_PRESETS.colosseum;
    } else if (this.matchFormat === 'solo_8' || this.matchFormat === 'duos_8' || this.matchFormat === 'octagon' || mode === 'octagon') {
      this.mapPreset = MAP_PRESETS.octagon;
    } else {
      this.mapPreset = MAP_PRESETS.speedway;
    }

    // 2. Initialize teams dynamically from map preset
    this.teamManager.initTeams(this.mapPreset.teams);
    this.teamManager.gameManager = this;

    // 3. Clear active projectiles
    if (this.projectiles && this.projectiles.length > 0) {
      for (const p of this.projectiles) p.destroy();
      this.projectiles = [];
    }

    // 4. Setup Mutators
    if (activeMutators && activeMutators.length > 0) {
      this.mutationManager.activeMutations.clear();
      for (const m of activeMutators) this.mutationManager.enable(m);
    } else if (mode === 'rush') {
      this.mutationManager.enable('Supercharged');
      this.mutationManager.enable('Speed Demon');
    } else if (mode === 'lucky') {
      this.mutationManager.enable('Lucky Chaos');
    }

    // Reset local player stats for new match
    this.localPlayer.kills = 0;
    this.localPlayer.finalKills = 0;
    this.localPlayer.bedsBroken = 0;
    this.localPlayer.team = 'red';
    this.localPlayer.teamWoolType = this.localPlayer.resolveTeamWool('red');
    this.localPlayer.teamManager = this.teamManager;

    // Reset World and build preset
    this.world.clear();
    this.mapPreset.generateGeometry(this.world);
    this.generatorManager.loadSpawners(this.mapPreset.generators);

    // Position Local Player at Red team spawn
    const redSpawn = this.mapPreset.spawns.red || { x: 0, y: 22, z: 0 };
    this.localPlayer.respawn(redSpawn);
    if (this.teamManager.teams.red) {
      this.teamManager.teams.red.players = [this.localPlayer];
    }

    // Spawn AI Bots for opponent teams
    // Remove previous bots
    for (let i = this.players.length - 1; i >= 1; i--) {
      this.players[i].destroy();
      this.players.splice(i, 1);
    }

    if (withBots) {
      const opponentTeams = this.mapPreset.teams.filter(t => t !== this.localPlayer.team);
      opponentTeams.forEach(team => {
        const bot = new BotPlayer(`bot_${team}`, `Bot ${team.toUpperCase()}`, team, this.scene);
        bot.teamManager = this.teamManager;
        const spawn = this.mapPreset.spawns[team] || { x: 0, y: 22, z: 0 };
        bot.respawn(spawn);
        this.players.push(bot);
        if (this.teamManager.teams[team]) {
          this.teamManager.teams[team].players = [bot];
        }
      });
    }

    // 5. Notify MutationManager
    this.mutationManager.onMatchStart(this);

    // Show HUD, hide main menu
    document.getElementById('main-menu')?.classList.add('hidden');
    this.hud.show();
    if (!this.touchControls?.isEnabled && this.canvas?.requestPointerLock) {
      this.canvas.requestPointerLock();
    }
  }

  handleMatchEnd(isVictory) {
    if (!this.isMatchRunning) return;
    this.isMatchRunning = false;
    const outcome = isVictory ? 'win' : 'loss';
    const kills = this.localPlayer.kills;
    const finalKills = this.localPlayer.finalKills;
    const bedsBroken = this.localPlayer.bedsBroken;

    const rankResult = this.rankManager.recordMatch({
      format: this.matchFormat,
      outcome,
      kills,
      finalKills,
      bedsBroken,
    });

    const levelResult = this.levelManager.recordMatch({
      outcome,
      kills,
      finalKills,
      bedsBroken,
    });

    this.authManager.updateProfile({
      rating: this.rankManager.rating,
      level: this.levelManager.level,
    });

    this.hud.showGameOver(isVictory, rankResult, levelResult);
  }

  animate() {
    requestAnimationFrame(this.animate);
    const dt = Math.min(this.clock.getDelta(), 0.1);

    if (this.isMatchRunning || this.studioEditor.isActive) {
      this.matchTime += dt;

      // 0. Update Mobile Touch Controls
      if (this.touchControls) {
        this.touchControls.update(dt);
      }

      // 1. Update World & Particles
      this.world.update();
      this.particles.update(dt);

      // 2. Update Local Player
      this.localPlayer.update(dt, this.physics);

      // 2b. Update Mining & Target Feedback
      this.updateMining(dt);

      // 2c. Periodic network transform broadcast (20 Hz)
      this.netSyncTimer = (this.netSyncTimer || 0) + dt;
      if (this.netSyncTimer >= 0.05) {
        this.netSyncTimer = 0;
        if (this.network && this.network.activeTransport !== 'none' && this.localPlayer) {
          const p = this.localPlayer.position;
          this.network.broadcastPlayerTransform(p.x, p.y, p.z, this.localPlayer.yaw || 0, this.localPlayer.pitch || 0);
        }
      }

      // Check void fall (with 10s combat attribution)
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

      // 3. Update Bots & Remote Players
      for (let i = 1; i < this.players.length; i++) {
        const bot = this.players[i];
        if (!bot.isRemotePlayer) {
          bot.update(dt, this);
        }

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

      // 3b. Team healPool upgrade: regenerates HP for players on base
      this.healPoolTimer += dt;
      if (this.healPoolTimer >= 1.0) {
        this.healPoolTimer -= 1.0;
        for (const [tName, tData] of Object.entries(this.teamManager.teams)) {
          if (tData.upgrades?.healPool) {
            const spawn = this.mapPreset.spawns[tName];
            if (spawn) {
              for (const p of this.players) {
                if (p.team === tName && !p.isDead && p.health < p.maxHealth) {
                  const dist = Math.hypot(p.position.x - spawn.x, p.position.z - spawn.z);
                  if (dist < 16) {
                    p.health = Math.min(p.maxHealth, p.health + 1);
                  }
                }
              }
            }
          }
        }
      }

      // 3c. Team alarmTrap upgrade: alert when enemy enters base perimeter
      for (const [tName, tData] of Object.entries(this.teamManager.teams)) {
        if (tData.upgrades?.alarmTrap) {
          const spawn = this.mapPreset.spawns[tName];
          if (spawn) {
            for (const p of this.players) {
              if (p.team !== tName && !p.isDead) {
                const dist = Math.hypot(p.position.x - spawn.x, p.position.z - spawn.z);
                if (dist < 14) {
                  tData.upgrades.alarmTrap = false;
                  if (this.sound) this.sound.playExplosion();
                  this.hud.showAnnouncement('🚨 INTRUDER ALERT!', `Enemy entered ${tName.toUpperCase()} base island!`);
                  break;
                }
              }
            }
          }
        }
      }

      // 4. Update Generators
      this.generatorManager.update(dt, this.players, this.teamManager);

      // 4b. Update Projectiles
      if (this.projectiles && this.projectiles.length > 0) {
        for (let i = this.projectiles.length - 1; i >= 0; i--) {
          const p = this.projectiles[i];
          p.update(dt, this.world, this.players, this.physics, this.sound, this.particles, this.teamManager, this.mutationManager, this);
          if (p.isDead) {
            p.destroy();
            this.projectiles.splice(i, 1);
          }
        }
      }

      // 4c. Update Match Mutation Modifiers
      if (this.mutationManager) {
        this.mutationManager.onTick(dt, this);
      }

      // 5. Update HUD
      this.hud.update(this.localPlayer, this.teamManager, this.matchTime);

      // 6. Check Win Condition
      if (this.isMatchRunning) {
        const aliveTeams = this.teamManager.getAliveTeams();
        if (aliveTeams.length === 1 && aliveTeams[0] === this.localPlayer.team) {
          this.handleMatchEnd(true);
        } else if (this.localPlayer.isFinalDead && this.localPlayer.isDead) {
          this.handleMatchEnd(false);
        }
      }
    }

    // Render Three.js Scene
    this.renderer.render(this.scene, this.camera);
  }
}
