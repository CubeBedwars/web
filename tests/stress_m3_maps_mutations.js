/**
 * tests/stress_m3_maps_mutations.js
 * Empirical Adversarial Stress Test Suite for Milestone 3 (M3):
 * Multi-Map System (Colosseum, Speedway, Octagon), Dynamic Teams & Formats,
 * Projectile Entity Subsystem & All 9 Match Mutation Modifiers.
 */

import * as THREE from 'three';
import './mocks/browser-shim.js';
import { BLOCK_TYPES, BLOCK_PROPS, VoxelWorld } from '../src/engine/VoxelWorld.js';
import { MAP_PRESETS } from '../src/game/MapPresets.js';
import { TeamManager, TEAM_PALETTE } from '../src/game/TeamManager.js';
import { Player } from '../src/entities/Player.js';
import { Projectile } from '../src/entities/Projectile.js';
import { MutationManager, GUN_GAME_TIERS, MUTATION_DEFINITIONS } from '../src/game/MutationManager.js';
import { Physics } from '../src/engine/Physics.js';
import { GameManager } from '../src/game/GameManager.js';
import { BotBrain } from '../src/ai/BotBrain.js';

console.log('\n======================================================================');
console.log('   EMPIRICAL ADVERSARIAL STRESS SUITE: M3 MAPS, PROJECTILES & MUTATORS   ');
console.log('======================================================================\n');

let totalAssertions = 0;
let passedAssertions = 0;
let failedAssertions = 0;

function assert(condition, message) {
  totalAssertions++;
  if (condition) {
    passedAssertions++;
    console.log(`  ✓ PASS: ${message}`);
  } else {
    failedAssertions++;
    console.error(`  ✗ FAIL: ${message}`);
    process.exitCode = 1;
  }
}

// ============================================================================
// SUITE 1: MULTI-MAP SYSTEM INTEGRITY (Speedway, Colosseum, Octagon)
// ============================================================================
console.log('--- SUITE 1: Multi-Map System Integrity & Geometry Stress ---');

// 1.1 Speedway (4 Teams)
{
  const speedway = MAP_PRESETS.speedway;
  assert(speedway.teams.length === 4, '1.1a: Speedway map defines exactly 4 teams');
  assert(speedway.teams.includes('red') && speedway.teams.includes('blue') && speedway.teams.includes('green') && speedway.teams.includes('yellow'), '1.1b: Speedway contains red, blue, green, yellow');

  for (const t of speedway.teams) {
    assert(!!speedway.spawns[t], `1.1c: Speedway spawn exists for team ${t}`);
    assert(!!speedway.beds[t], `1.1d: Speedway bed exists for team ${t}`);
    const bed = speedway.beds[t];
    const dist = Math.hypot(bed.head.x - bed.foot.x, bed.head.z - bed.foot.z);
    assert(Math.abs(dist - 1.0) < 1e-4, `1.1e: Bed head and foot for ${t} are adjacent voxels (distance = 1)`);
  }

  const forgeCount = speedway.generators.filter(g => g.type === 'forge').length;
  const diamondCount = speedway.generators.filter(g => g.type === 'diamond').length;
  const emeraldCount = speedway.generators.filter(g => g.type === 'emerald').length;
  assert(forgeCount === 4, `1.1f: Speedway has 4 team forges (got ${forgeCount})`);
  assert(diamondCount === 4, `1.1g: Speedway has 4 satellite diamond generators (got ${diamondCount})`);
  assert(emeraldCount === 2, `1.1h: Speedway has 2 center emerald generators (got ${emeraldCount})`);
}

// 1.2 Colosseum (1v1 Duel Map)
{
  const colosseum = MAP_PRESETS.colosseum;
  assert(colosseum.teams.length === 2, '1.2a: Colosseum duel map defines exactly 2 teams');
  assert(colosseum.teams.includes('red') && colosseum.teams.includes('blue'), '1.2b: Colosseum contains red and blue teams');
  assert(colosseum.spawns.red.x === -15 && colosseum.spawns.blue.x === 15, '1.2c: Colosseum spawns are symmetrical across X-axis (-15 and +15)');
  assert(colosseum.beds.red && colosseum.beds.blue, '1.2d: Colosseum has dedicated beds for both duel teams');

  const redBed = colosseum.beds.red;
  const blueBed = colosseum.beds.blue;
  assert(Math.hypot(redBed.head.x - redBed.foot.x, redBed.head.z - redBed.foot.z) === 1, '1.2e: Red duel bed head and foot are adjacent voxels');
  assert(Math.hypot(blueBed.head.x - blueBed.foot.x, blueBed.head.z - blueBed.foot.z) === 1, '1.2f: Blue duel bed head and foot are adjacent voxels');

  // Verify Geometry generation
  const scene = new THREE.Scene();
  const world = new VoxelWorld(scene);
  world.rebuildMeshes = () => {};
  colosseum.generateGeometry(world);

  assert(world.getBlock(colosseum.beds.red.head.x, colosseum.beds.red.head.y, colosseum.beds.red.head.z) === BLOCK_TYPES.BED_HEAD, '1.2g: Red bed head voxel populated in world');
  assert(world.getBlock(colosseum.beds.blue.head.x, colosseum.beds.blue.head.y, colosseum.beds.blue.head.z) === BLOCK_TYPES.BED_HEAD, '1.2h: Blue bed head voxel populated in world');
  assert(world.getBlock(0, 20, 4) === BLOCK_TYPES.EMERALD_BLOCK, '1.2i: Contested center emerald pillar populated in Colosseum');
}

// 1.3 Octagon (8-Team Solo/Duo Layout)
{
  const octagon = MAP_PRESETS.octagon;
  assert(octagon.teams.length === 8, '1.3a: Octagon map defines exactly 8 teams');
  const expectedTeams = ['red', 'blue', 'green', 'yellow', 'aqua', 'white', 'pink', 'gray'];
  for (const t of expectedTeams) {
    assert(octagon.teams.includes(t), `1.3b: Octagon includes team ${t}`);
    assert(!!octagon.spawns[t], `1.3c: Octagon spawn exists for team ${t}`);
    assert(!!octagon.beds[t], `1.3d: Octagon bed exists for team ${t}`);
  }

  const forgeCount = octagon.generators.filter(g => g.type === 'forge').length;
  assert(forgeCount === 8, `1.3e: Octagon has 8 team forges (got ${forgeCount})`);

  // Verify Geometry generation
  const scene = new THREE.Scene();
  const world = new VoxelWorld(scene);
  world.rebuildMeshes = () => {};
  octagon.generateGeometry(world);

  for (const t of expectedTeams) {
    const bed = octagon.beds[t];
    assert(world.getBlock(bed.head.x, bed.head.y, bed.head.z) === BLOCK_TYPES.BED_HEAD, `1.3f: Bed head for ${t} placed in Octagon world`);
    const underHead = world.getBlock(bed.head.x, bed.head.y - 1, bed.head.z);
    const underFoot = world.getBlock(bed.foot.x, bed.foot.y - 1, bed.foot.z);
    assert(underHead !== BLOCK_TYPES.AIR && underHead !== undefined, `1.3g: Team ${t} has solid block under bed head in Octagon (block ${underHead})`);
    assert(underFoot !== BLOCK_TYPES.AIR && underFoot !== undefined, `1.3h: Team ${t} has solid block under bed foot in Octagon (block ${underFoot})`);
  }
}

// ============================================================================
// SUITE 2: DYNAMIC TEAMS & WOOL PALETTES
// ============================================================================
console.log('\n--- SUITE 2: Dynamic Teams & Wool Palettes ---');

{
  const allTeams = ['red', 'blue', 'green', 'yellow', 'aqua', 'white', 'pink', 'gray'];
  const expectedWools = [
    BLOCK_TYPES.WOOL_RED,
    BLOCK_TYPES.WOOL_BLUE,
    BLOCK_TYPES.WOOL_GREEN,
    BLOCK_TYPES.WOOL_YELLOW,
    BLOCK_TYPES.WOOL_AQUA,
    BLOCK_TYPES.WOOL_WHITE,
    BLOCK_TYPES.WOOL_PINK,
    BLOCK_TYPES.WOOL_GRAY,
  ];

  for (let i = 0; i < allTeams.length; i++) {
    const t = allTeams[i];
    const p = new Player(`p_${t}`, `${t}_Player`, t);
    assert(p.teamWoolType === expectedWools[i], `2.1: Player on team ${t} resolves wool type ${expectedWools[i]}`);
    assert(TEAM_PALETTE[t]?.hex !== undefined, `2.2: TEAM_PALETTE defines color hex for team ${t}`);
  }

  // Dynamic 2-team initialization
  const tm2 = new TeamManager(['red', 'blue']);
  assert(Object.keys(tm2.teams).length === 2, '2.3a: TeamManager dynamically initializes exactly 2 teams');
  assert(tm2.teams.green === undefined, '2.3b: Inactive teams are omitted from 2-team match');
  assert(tm2.getAliveTeams().length === 2, '2.3c: Exactly 2 teams alive at match start');

  // Dynamic 8-team initialization
  const tm8 = new TeamManager(allTeams);
  assert(Object.keys(tm8.teams).length === 8, '2.4a: TeamManager dynamically initializes exactly 8 teams');
  assert(tm8.getAliveTeams().length === 8, '2.4b: Exactly 8 teams alive at start of 8-team match');

  // Cascade elimination check
  for (const t of ['white', 'pink', 'gray', 'aqua']) {
    tm8.destroyBed(t);
    const mockP = new Player(`p_${t}`, t, t);
    mockP.isDead = true;
    mockP.isFinalDead = true;
    tm8.teams[t].players = [mockP];
    assert(tm8.isTeamEliminated(t), `2.5: Team ${t} eliminated when bed destroyed and player dead`);
  }
  assert(tm8.getAliveTeams().length === 4, '2.6: Remaining alive teams in 8-team match is 4');

  // Empty team elimination check (unoccupied team eliminated when bed destroyed)
  const tmEmpty = new TeamManager(['red', 'blue']);
  tmEmpty.destroyBed('blue');
  assert(tmEmpty.isTeamEliminated('blue') === true, '2.7: Unoccupied team with broken bed is considered eliminated');
}

// ============================================================================
// SUITE 3: PROJECTILE ENTITY SUBSYSTEM & EXPLOSIVE PHYSICS
// ============================================================================
console.log('\n--- SUITE 3: Projectile Entity Subsystem & Explosive Physics ---');

{
  const scene = new THREE.Scene();
  const world = new VoxelWorld(scene);
  world.rebuildMeshes = () => {};
  const physics = new Physics(world);

  // 3.1: Ballistic trajectory integration
  const shooter = new Player('shooter', 'Shooter', 'red');
  const proj = new Projectile({
    scene,
    position: new THREE.Vector3(0, 20, 0),
    velocity: new THREE.Vector3(20, 10, 0),
    gravity: -10,
    damage: 10,
    owner: shooter,
  });

  proj.update(0.5, world);
  assert(Math.abs(proj.position.x - 10) < 1e-4, '3.1a: Projectile position X integrates velocity * dt (20 * 0.5 = 10)');
  assert(Math.abs(proj.velocity.y - 5) < 1e-4, '3.1b: Projectile velocity Y integrates gravity * dt (10 + -10 * 0.5 = 5)');

  proj.update(0.5, world); // apex reached at t=1.0s
  assert(Math.abs(proj.velocity.y - 0) < 1e-4, '3.1c: Projectile reaches apex at vy = 0');

  // 3.2: Direct block collision
  world.setBlock(25, 20, 0, BLOCK_TYPES.STONE);
  const projBlock = new Projectile({
    scene,
    position: new THREE.Vector3(24.5, 20.2, 0.2),
    velocity: new THREE.Vector3(10, 0, 0),
    gravity: 0,
    damage: 8,
    explosive: false,
    owner: shooter,
  });

  const hit = projBlock.update(0.1, world);
  assert(hit !== null, '3.2a: Projectile detects collision with stone voxel');
  assert(hit.type === 'hit_block', '3.2b: Hit event type is hit_block');
  assert(projBlock.isDead === true, '3.2c: Projectile marked dead upon impact');

  // 3.3: Explosive Fireball: Weak blocks destroyed, Obsidian resists
  world.setBlock(30, 20, 0, BLOCK_TYPES.WOOL_RED);
  world.setBlock(30, 21, 0, BLOCK_TYPES.WOOD);
  world.setBlock(30, 20, 1, BLOCK_TYPES.OBSIDIAN);
  world.setBlock(30, 20, -1, BLOCK_TYPES.BEDROCK);

  const victimNear = new Player('vic_near', 'Victim_Near', 'blue');
  victimNear.position.set(31, 20, 0);

  const fireball = new Projectile({
    scene,
    position: new THREE.Vector3(30, 20, 0),
    velocity: new THREE.Vector3(0, 0, 0),
    damage: 12,
    explosive: true,
    explosionRadius: 2.5,
    owner: shooter,
    type: 'fireball',
  });

  fireball.triggerExplosion(new THREE.Vector3(30, 20, 0), world, [victimNear], physics);

  assert(world.getBlock(30, 20, 0) === BLOCK_TYPES.AIR, '3.3a: Wool block destroyed by explosion');
  assert(world.getBlock(30, 21, 0) === BLOCK_TYPES.AIR, '3.3b: Wood block destroyed by explosion');
  assert(world.getBlock(30, 20, 1) === BLOCK_TYPES.OBSIDIAN, '3.3c: Obsidian block resists explosion intact');
  assert(world.getBlock(30, 20, -1) === BLOCK_TYPES.BEDROCK, '3.3d: Bedrock block resists explosion intact');
  assert(victimNear.health < 20, '3.3e: Nearby player took radial explosive damage');
  assert(victimNear.velocity.lengthSq() > 0, '3.3f: Nearby player received physical explosive knockback');

  // 3.4: Max lifetime expiration
  const projExp = new Projectile({
    scene,
    position: new THREE.Vector3(0, 50, 0),
    velocity: new THREE.Vector3(0, 0, 0),
    maxLifetime: 1.0,
  });
  projExp.update(1.2, world);
  assert(projExp.isDead === true, '3.4: Projectile expires cleanly after exceeding maxLifetime');

  // 3.5: Projectile direct damage triggers onDamage in MutationManager (Lethal Strike & Vampirism)
  {
    const mutManager = new MutationManager();
    mutManager.enable('Lethal Strike');
    mutManager.enable('Vampirism');

    const projShooter = new Player('proj_shooter', 'Shooter', 'red');
    projShooter.health = 10;
    const projVictim = new Player('proj_victim', 'Victim', 'blue');
    projVictim.health = 20;

    let onDamageCalled = false;
    const origOnDamage = mutManager.onDamage.bind(mutManager);
    mutManager.onDamage = (att, vic, dmg, gm) => {
      onDamageCalled = true;
      return origOnDamage(att, vic, dmg, gm);
    };

    const directProj = new Projectile({
      scene,
      position: new THREE.Vector3(10, 20.8, 10),
      velocity: new THREE.Vector3(0, 0, 0),
      damage: 5.0,
      explosive: false,
      owner: projShooter,
      mutationManager: mutManager,
    });
    projVictim.position.set(10, 20, 10);

    const hitDirect = directProj.update(0.1, world, [projVictim]);
    assert(onDamageCalled === true, '3.5a: Projectile direct damage triggers onDamage in MutationManager');
    assert(projVictim.health <= 10.0, '3.5b: Lethal Strike mutator doubled projectile damage (20 - 5*2 = 10)');
    assert(projShooter.health > 10.0, '3.5c: Vampirism mutator healed projectile shooter upon hit');
  }

  // 3.6: Projectile AoE explosion triggers onDamage in MutationManager
  {
    const mutManager = new MutationManager();
    mutManager.enable('Lethal Strike');

    const aoeShooter = new Player('aoe_shooter', 'AoEShooter', 'red');
    const aoeVictim = new Player('aoe_victim', 'AoEVictim', 'blue');
    aoeVictim.health = 20;
    aoeVictim.position.set(50, 20, 50);

    let aoeDamageCalled = false;
    mutManager.onDamage = (att, vic, dmg, gm) => {
      aoeDamageCalled = true;
      return dmg * 2.0;
    };

    const aoeProj = new Projectile({
      scene,
      position: new THREE.Vector3(50, 20, 50),
      velocity: new THREE.Vector3(0, 0, 0),
      damage: 6.0,
      explosive: true,
      explosionRadius: 3.0,
      owner: aoeShooter,
      mutationManager: mutManager,
    });

    aoeProj.triggerExplosion(new THREE.Vector3(50, 20, 50), world, [aoeVictim], physics, null, null, null, mutManager);
    assert(aoeDamageCalled === true, '3.6: Projectile AoE explosion triggers onDamage in MutationManager');
  }

  // 3.7: Bot damage triggers onDamage in MutationManager
  {
    const mutManager = new MutationManager();
    mutManager.enable('Lethal Strike');
    mutManager.enable('Vampirism');

    const botPlayer = new Player('bot_att', 'BotAttacker', 'red');
    botPlayer.health = 12;
    botPlayer.weapon = { id: 'iron_sword', damage: 6.0 };
    const botVictim = new Player('bot_vic', 'BotVictim', 'blue');
    botVictim.health = 20;
    botVictim.position.set(0, 20, 1);

    const brain = new BotBrain(botPlayer);
    let botOnDamageCalled = false;
    const origOnDamage = mutManager.onDamage.bind(mutManager);
    mutManager.onDamage = (att, vic, dmg, gm) => {
      botOnDamageCalled = true;
      return origOnDamage(att, vic, dmg, gm);
    };

    const mockGm = {
      mutationManager: mutManager,
      physics: { applyKnockback: () => {} },
      teamManager: null,
      sound: null,
      particles: null,
    };

    // Position bot close to victim and trigger attack
    botPlayer.position.set(0, 20, 0);
    brain.attackCooldown = 0;
    brain.handleCombat(botVictim, mockGm, 0.1);

    assert(botOnDamageCalled === true, '3.7a: Bot attack triggers onDamage in MutationManager');
    assert(botVictim.health <= 8.0, '3.7b: Lethal Strike doubled bot attack damage (20 - 6*2 = 8)');
    assert(botPlayer.health > 12.0, '3.7c: Vampirism healed bot upon landing attack');
  }

  // 3.8: Player.prototype.takeDamage routes through mutationManager.onDamage when provided
  {
    const mutManager = new MutationManager();
    mutManager.enable('Lethal Strike');
    const att = new Player('p_att', 'Attacker', 'red');
    const vic = new Player('p_vic', 'Victim', 'blue');
    vic.health = 20;

    let directRouted = false;
    mutManager.onDamage = (a, v, dmg) => {
      directRouted = true;
      return dmg * 2.0;
    };

    vic.takeDamage(4.0, att, null, null, mutManager);
    assert(directRouted === true, '3.8a: Player.prototype.takeDamage routes onDamage when mutationManager passed');
    assert(vic.health === 12.0, '3.8b: Victim took doubled damage (20 - 4*2 = 12)');
  }
}

// ============================================================================
// SUITE 4: ALL 9 MATCH MUTATION MODIFIERS
// ============================================================================
console.log('\n--- SUITE 4: All 9 Match Mutation Modifiers ---');

// 4.1 Supercharged
{
  const mut = new MutationManager();
  assert(mut.getInitialGeneratorTier() === 1, '4.1a: Default forge tier is 1');
  mut.enable('Supercharged');
  assert(mut.getInitialGeneratorTier() === 2, '4.1b: Supercharged sets initial generator tier to 2');
}

// 4.2 Launch Rush
{
  const mut = new MutationManager();
  assert(!mut.hasBaseLaunchpads(), '4.2a: Base launchpads disabled by default');
  mut.enable('Launch Rush');
  assert(mut.hasBaseLaunchpads(), '4.2b: Launch Rush enables base launchpads');
}

// 4.3 Gun Game
{
  const mut = new MutationManager();
  mut.enable('Gun Game');
  assert(GUN_GAME_TIERS.length === 4, '4.3a: Gun Game defines 4 progression weapon tiers');
  assert(GUN_GAME_TIERS[0].name === 'Wooden Slingshot', '4.3b: Tier 1 is Wooden Slingshot');
  assert(GUN_GAME_TIERS[3].name === 'Plasma Blaster', '4.3c: Tier 4 is Plasma Blaster');

  const p = new Player('gg_player', 'GG_Player', 'red');
  mut.equipGunGameWeapon(p, 1);
  assert(p.weapon.name === 'Wooden Slingshot', '4.3d: Initial weapon equipped as Wooden Slingshot');
  assert(p.weapon.damage === 3.5, '4.3e: Tier 1 weapon damage is 3.5');

  // Kill 1 -> upgrade to Tier 2
  mut.onKill(p, new Player('vic', 'Vic', 'blue'), {});
  assert(p.weapon.name === 'Iron Crossbow', '4.3f: Kill 1 auto-upgrades weapon to Iron Crossbow');

  // Kill 2 -> upgrade to Tier 3
  mut.onKill(p, new Player('vic', 'Vic', 'blue'), {});
  assert(p.weapon.name === 'Fireball Launcher', '4.3g: Kill 2 auto-upgrades weapon to Fireball Launcher');

  // Kill 3 -> upgrade to Tier 4
  mut.onKill(p, new Player('vic', 'Vic', 'blue'), {});
  assert(p.weapon.name === 'Plasma Blaster', '4.3h: Kill 3 auto-upgrades weapon to Plasma Blaster');

  // Kill 4 -> capped at Tier 4
  mut.onKill(p, new Player('vic', 'Vic', 'blue'), {});
  assert(p.weapon.name === 'Plasma Blaster', '4.3i: Kill 4 caps cleanly at Plasma Blaster');
}

// 4.4 Lethal Strike
{
  const mut = new MutationManager();
  assert(mut.getDamageMultiplier() === 1.0, '4.4a: Default damage multiplier is 1.0x');
  mut.enable('Lethal Strike');
  assert(mut.getDamageMultiplier() === 2.0, '4.4b: Lethal Strike provides 2.0x damage scaling');

  const attacker = new Player('lethal_att', 'Attacker', 'red');
  const victim = new Player('lethal_vic', 'Victim', 'blue');
  const scaledDamage = mut.onDamage(attacker, victim, 6.0, {});
  assert(scaledDamage === 12.0, '4.4c: Base 6.0 damage scales to 12.0 under Lethal Strike');
}

// 4.5 Low Gravity
{
  const mut = new MutationManager();
  assert(mut.getGravity() === -24.0, '4.5a: Default physics gravity is -24.0 m/s^2');
  mut.enable('Low Gravity');
  assert(mut.getGravity() === -8.0, '4.5b: Low Gravity reduces gravitational pull to -8.0 m/s^2');
}

// 4.6 Speed Demon
{
  const mut = new MutationManager();
  assert(mut.getSpeedMultiplier() === 1.0, '4.6a: Default speed multiplier is 1.0x');
  mut.enable('Speed Demon');
  assert(mut.getSpeedMultiplier() === 1.5, '4.6b: Speed Demon provides 1.5x speed boost');
}

// 4.7 Vampirism
{
  const mut = new MutationManager();
  mut.enable('Vampirism');
  const attacker = new Player('vamp_att', 'Vampire', 'red');
  attacker.health = 14.0;
  const victim = new Player('vamp_vic', 'Victim', 'blue');

  // Deal 8 damage -> heals 2 HP (25%)
  mut.onDamage(attacker, victim, 8.0, {});
  assert(attacker.health === 16.0, '4.7a: Attacker recovers 25% of damage dealt (health 14 -> 16)');

  // Secure a kill -> heals +5 HP
  mut.onKill(attacker, victim, {});
  assert(attacker.health === 20.0, '4.7b: Kill restores +5 HP (clamped to maxHealth 20)');

  // Min heal boundary check
  const tinyHeal = mut.applyVampirismDamage(1.0);
  assert(tinyHeal >= 0.5, '4.7c: Minimum vampiric heal is at least 0.5 HP');
}

// 4.8 Sudden Death
{
  const mut = new MutationManager();
  mut.enable('Sudden Death');
  assert(!mut.isSuddenDeathTriggered(599, 600), '4.8a: Sudden Death inactive before 600s threshold');
  assert(mut.isSuddenDeathTriggered(600, 600), '4.8b: Sudden Death activates at 600s threshold');
  assert(mut.isSuddenDeathTriggered(750, 600), '4.8c: Sudden Death remains active past threshold');
}

// 4.9 Lucky Chaos
{
  const mut = new MutationManager();
  mut.enable('Lucky Chaos');
  assert(mut.has('Lucky Chaos'), '4.9a: Lucky Chaos enabled in mutation manager');

  const player = new Player('lucky_p', 'LuckyPlayer', 'red');
  player.resources.diamond = 0;
  player.resources.emerald = 0;

  // Simulate lucky block break
  const mockGm = {
    hud: { showAnnouncement: () => {} },
    sound: { playExplosion: () => {} },
  };

  mut.onBlockBreak(player, 0, 20, 0, BLOCK_TYPES.LUCKY_BLOCK, mockGm);
  const totalLoot = player.resources.diamond + player.resources.emerald + player.hotbar.filter(s => s !== null).length;
  assert(totalLoot > 1, '4.9b: Breaking lucky block awards randomized loot/items');
}

// 4.10 Combined Mutators Stress (All 9 active simultaneously)
{
  const mut = new MutationManager();
  const allMutatorNames = Object.keys(MUTATION_DEFINITIONS);
  for (const name of allMutatorNames) {
    mut.enable(name);
  }

  assert(mut.getActiveMutations().length === 9, '4.10a: All 9 mutators can be enabled simultaneously');
  assert(mut.getInitialGeneratorTier() === 2, '4.10b: Supercharged active in combined mode');
  assert(mut.hasBaseLaunchpads() === true, '4.10c: Launch Rush active in combined mode');
  assert(mut.getGravity() === -8.0, '4.10d: Low Gravity active in combined mode');
  assert(mut.getSpeedMultiplier() === 1.5, '4.10e: Speed Demon active in combined mode');
  assert(mut.getDamageMultiplier() === 2.0, '4.10f: Lethal Strike active in combined mode');
}

// ============================================================================
// SUITE 5: GAMEMANAGER RUNTIME ROBUSTNESS & RIGHT-CLICK REFERENCE SAFETY
// ============================================================================
console.log('\n--- SUITE 5: GameManager Runtime Robustness & Right-Click Reference Safety ---');

{
  const gm = Object.create(GameManager.prototype);
  gm.studioEditor = { isActive: false };
  gm.mapPreset = { shopkeepers: [] };
  let firedProj = null;
  gm.fireProjectile = (shooter, item) => { firedProj = item; };
  gm.hud = { updateHotbar: () => {}, openShop: () => {}, showAnnouncement: () => {} };
  gm.sound = { playItemPickup: () => {}, playBlockPlace: () => {} };

  // 5.1: getSelectedItem function returning projectile item
  gm.localPlayer = {
    getSelectedItem: () => ({ type: 'projectile', id: 'fireball', damage: 12 }),
    consumeSelectedItem: () => {},
  };
  let err = null;
  try {
    gm.handleRightClick();
  } catch (e) {
    err = e;
  }
  assert(err === null, '5.1a: GameManager.handleRightClick does not throw ReferenceError when firing projectile');
  assert(firedProj !== null && firedProj.id === 'fireball', '5.1b: Projectile successfully launched via handleRightClick');

  // 5.2: hotbar array with block item
  firedProj = null;
  gm.world = { setBlock: () => {}, rebuildMeshes: () => {} };
  gm.players = [];
  gm.getAimRaycast = () => ({ hit: true, placePos: { x: 10, y: 20, z: 10 } });
  let consumedBlock = false;
  gm.localPlayer = {
    hotbar: [{ type: 'block', blockType: BLOCK_TYPES.WOOL_RED, count: 1 }],
    selectedSlot: 0,
    consumeSelectedItem: () => { consumedBlock = true; },
  };
  err = null;
  try {
    gm.handleRightClick();
  } catch (e) {
    err = e;
  }
  assert(err === null, '5.2a: GameManager.handleRightClick does not throw ReferenceError when placing block');
  assert(consumedBlock === true, '5.2b: Block placement consumed selected item');

  // 5.3: Consumable Golden Apple
  gm.localPlayer = {
    getSelectedItem: () => ({ type: 'consumable', id: 'gapple' }),
    consumeSelectedItem: () => {},
    health: 10,
    maxHealth: 20,
  };
  err = null;
  try {
    gm.handleRightClick();
  } catch (e) {
    err = e;
  }
  assert(err === null, '5.3a: GameManager.handleRightClick does not throw ReferenceError when eating golden apple');
  assert(gm.localPlayer.health === 18, '5.3b: Golden apple restored +8 HP');

  // 5.4: Empty hotbar / null item
  gm.localPlayer = {
    hotbar: [null, null],
    selectedSlot: 0,
  };
  err = null;
  try {
    gm.handleRightClick();
  } catch (e) {
    err = e;
  }
  assert(err === null, '5.4: GameManager.handleRightClick safely handles null/empty hotbar slot without ReferenceError');
}

// ============================================================================
// FINAL STRESS TEST SUMMARY
// ============================================================================
console.log('\n======================================================================');
console.log('                 M3 STRESS TEST HARNESS SUMMARY                       ');
console.log('======================================================================');
console.log(`  Total Assertions Checked : ${totalAssertions}`);
console.log(`  Passed Assertions        : ${passedAssertions}`);
console.log(`  Failed Assertions        : ${failedAssertions}`);
console.log('======================================================================\n');

if (failedAssertions > 0) {
  console.error(`❌ M3 STRESS TEST FAILED with ${failedAssertions} assertion error(s).\n`);
  process.exit(1);
} else {
  console.log(`✅ ALL ${passedAssertions} M3 ADVERSARIAL STRESS ASSERTIONS PASSED WITH 100% SUCCESS!\n`);
  process.exit(0);
}
