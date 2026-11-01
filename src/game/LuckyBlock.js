import { BLOCK_TYPES } from '../engine/VoxelWorld.js';

export class LuckyBlockHandler {
  constructor(gameManager) {
    this.game = gameManager;
  }

  // Triggered when a player breaks a Lucky Block
  trigger(player, blockPos) {
    const outcomes = [
      { name: 'Diamond Arsenal', weight: 15, run: () => this.rewardGear(player) },
      { name: 'Golden Apple Rain', weight: 20, run: () => this.rewardApples(player, blockPos) },
      { name: 'TNT Surprise!', weight: 15, run: () => this.spawnLitTNT(blockPos) },
      { name: 'Instant Bridge Egg', weight: 20, run: () => this.rewardBridgeEgg(player) },
      { name: 'Hyper Speed Surge', weight: 15, run: () => this.boostSpeed(player) },
      { name: 'Knockback Stick', weight: 10, run: () => this.rewardKBStick(player) },
      { name: 'Ender Pearl', weight: 12, run: () => this.rewardPearl(player) },
      { name: 'Diamond Block Jackpot', weight: 8, run: () => this.rewardDiamonds(player) },
      { name: 'Trampoline Pad', weight: 15, run: () => this.spawnTrampoline(blockPos) },
      { name: 'Meteor Blast!', weight: 10, run: () => this.spawnMeteor(blockPos) },
    ];

    const totalWeight = outcomes.reduce((acc, o) => acc + o.weight, 0);
    let rand = Math.random() * totalWeight;
    let chosen = outcomes[0];

    for (const o of outcomes) {
      if (rand < o.weight) {
        chosen = o;
        break;
      }
      rand -= o.weight;
    }

    // Announce and execute
    if (this.game.sound) {
      this.game.sound.playLuckyJingle();
    }
    this.game.particleSystem.spawnRainbowBurst(blockPos);
    this.game.chat.addSystemMessage(`🍀 [Lucky Block] ${player.name} got: ${chosen.name}!`);

    chosen.run();
  }

  rewardGear(player) {
    player.inventory.addItem({
      id: 'diamond_sword',
      name: 'Lucky Diamond Sword',
      icon: '💠',
      itemType: 'weapon',
      damage: 8,
    });
  }

  rewardApples(player, pos) {
    player.addResource('gold', 6);
    player.inventory.addItem({
      id: 'golden_apple',
      name: 'Golden Apple',
      count: 2,
      icon: '🍏',
      itemType: 'consumable',
    });
  }

  spawnLitTNT(pos) {
    setTimeout(() => {
      this.game.physics.applyExplosion(pos, 4.0, 16.0, this.game.players);
      if (this.game.sound) this.game.sound.playExplosion();
      this.game.particleSystem.spawnExplosion(pos, 35);
    }, 1500);
  }

  rewardBridgeEgg(player) {
    player.inventory.addItem({
      id: 'bridge_egg',
      name: 'Bridge Egg',
      icon: '🥚',
      itemType: 'projectile',
      projectileType: 'bridge_egg',
    });
  }

  boostSpeed(player) {
    player.sprintSpeed = 12.0;
    setTimeout(() => {
      player.sprintSpeed = 7.5;
    }, 12000);
  }

  rewardKBStick(player) {
    player.inventory.addItem({
      id: 'kb_stick',
      name: 'Super Knockback Stick',
      icon: '🥢',
      itemType: 'weapon',
      knockback: 22.0,
      damage: 1,
    });
  }

  rewardPearl(player) {
    player.inventory.addItem({
      id: 'ender_pearl',
      name: 'Ender Pearl',
      icon: '🔮',
      itemType: 'projectile',
      projectileType: 'pearl',
    });
  }

  rewardDiamonds(player) {
    player.addResource('diamond', 5);
  }

  spawnTrampoline(pos) {
    this.game.world.setBlock(pos.x, pos.y, pos.z, BLOCK_TYPES.TRAMPOLINE);
  }

  spawnMeteor(pos) {
    setTimeout(() => {
      this.game.physics.applyExplosion(pos, 5.0, 20.0, this.game.players);
      if (this.game.sound) this.game.sound.playExplosion();
      this.game.particleSystem.spawnExplosion(pos, 45);
    }, 1000);
  }
}
