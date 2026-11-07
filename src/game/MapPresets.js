import { BLOCK_TYPES } from '../engine/VoxelWorld.js';

export const MAP_PRESETS = {
  speedway: {
    name: 'Speedway (4 Teams)',
    description: 'Classic 4-island competitive Bedwars layout with center emerald arena and 4 diamond satellites.',
    teams: ['red', 'blue', 'green', 'yellow'],
    spawns: {
      red: { x: -30, y: 22, z: 0 },
      blue: { x: 30, y: 22, z: 0 },
      green: { x: 0, y: 22, z: -30 },
      yellow: { x: 0, y: 22, z: 30 },
    },
    beds: {
      red: { head: { x: -35, y: 21, z: 0 }, foot: { x: -34, y: 21, z: 0 } },
      blue: { head: { x: 35, y: 21, z: 0 }, foot: { x: 34, y: 21, z: 0 } },
      green: { head: { x: 0, y: 21, z: -35 }, foot: { x: 0, y: 21, z: -34 } },
      yellow: { head: { x: 0, y: 21, z: 35 }, foot: { x: 0, y: 21, z: 34 } },
    },
    generators: [
      // Team forges
      { type: 'forge', team: 'red', pos: { x: -27, y: 21, z: 0 }, interval: 2.5 },
      { type: 'forge', team: 'blue', pos: { x: 27, y: 21, z: 0 }, interval: 2.5 },
      { type: 'forge', team: 'green', pos: { x: 0, y: 21, z: -27 }, interval: 2.5 },
      { type: 'forge', team: 'yellow', pos: { x: 0, y: 21, z: 27 }, interval: 2.5 },
      // Diamond generators
      { type: 'diamond', pos: { x: -18, y: 21, z: -18 }, interval: 15 },
      { type: 'diamond', pos: { x: 18, y: 21, z: -18 }, interval: 15 },
      { type: 'diamond', pos: { x: -18, y: 21, z: 18 }, interval: 15 },
      { type: 'diamond', pos: { x: 18, y: 21, z: 18 }, interval: 15 },
      // Emerald generators
      { type: 'emerald', pos: { x: -2, y: 21, z: 0 }, interval: 30 },
      { type: 'emerald', pos: { x: 2, y: 21, z: 0 }, interval: 30 },
    ],
    shopkeepers: [
      { team: 'red', pos: { x: -30, y: 21, z: 4 }, name: 'Red Shopkeeper' },
      { team: 'blue', pos: { x: 30, y: 21, z: 4 }, name: 'Blue Shopkeeper' },
      { team: 'green', pos: { x: 4, y: 21, z: -30 }, name: 'Green Shopkeeper' },
      { team: 'yellow', pos: { x: 4, y: 21, z: 30 }, name: 'Yellow Shopkeeper' },
    ],
    generateGeometry(world) {
      // Build 4 Team Islands
      const teamColors = {
        red: BLOCK_TYPES.WOOL_RED,
        blue: BLOCK_TYPES.WOOL_BLUE,
        green: BLOCK_TYPES.WOOL_GREEN,
        yellow: BLOCK_TYPES.WOOL_YELLOW,
      };

      const teamCenters = [
        { team: 'red', x: -30, y: 20, z: 0 },
        { team: 'blue', x: 30, y: 20, z: 0 },
        { team: 'green', x: 0, y: 20, z: -30 },
        { team: 'yellow', x: 0, y: 20, z: 30 },
      ];

      teamCenters.forEach(({ team, x: cx, y: cy, z: cz }) => {
        // Island base: 9x9 disc
        const radius = 6;
        for (let dx = -radius; dx <= radius; dx++) {
          for (let dz = -radius; dz <= radius; dz++) {
            const dist = Math.sqrt(dx * dx + dz * dz);
            if (dist <= radius) {
              const x = cx + dx;
              const z = cz + dz;
              // Surface Grass
              world.setBlock(x, cy, z, BLOCK_TYPES.GRASS);
              // Dirt layer
              world.setBlock(x, cy - 1, z, BLOCK_TYPES.DIRT);
              world.setBlock(x, cy - 2, z, BLOCK_TYPES.DIRT);
              // Stone cone base
              if (dist <= radius - 2) world.setBlock(x, cy - 3, z, BLOCK_TYPES.STONE);
              if (dist <= radius - 4) world.setBlock(x, cy - 4, z, BLOCK_TYPES.STONE);
            }
          }
        }

        // Team wool ring around forge
        for (let a = -2; a <= 2; a++) {
          world.setBlock(cx + a, cy, cz + 2, teamColors[team]);
          world.setBlock(cx + a, cy, cz - 2, teamColors[team]);
        }
      });

      // Build 4 Diamond Satellite Islands (5x5 discs)
      const diamondCenters = [
        { x: -18, y: 20, z: -18 },
        { x: 18, y: 20, z: -18 },
        { x: -18, y: 20, z: 18 },
        { x: 18, y: 20, z: 18 },
      ];

      diamondCenters.forEach(({ x: cx, y: cy, z: cz }) => {
        const radius = 3;
        for (let dx = -radius; dx <= radius; dx++) {
          for (let dz = -radius; dz <= radius; dz++) {
            if (Math.sqrt(dx * dx + dz * dz) <= radius) {
              world.setBlock(cx + dx, cy, cz + dz, BLOCK_TYPES.END_STONE);
              world.setBlock(cx + dx, cy - 1, cz + dz, BLOCK_TYPES.END_STONE);
            }
          }
        }
        // Diamond spawner pillar
        world.setBlock(cx, cy + 1, cz, BLOCK_TYPES.DIAMOND_BLOCK);
      });

      // Build Center Emerald Island (12x12 disc)
      const midRadius = 7;
      for (let dx = -midRadius; dx <= midRadius; dx++) {
        for (let dz = -midRadius; dz <= midRadius; dz++) {
          const dist = Math.sqrt(dx * dx + dz * dz);
          if (dist <= midRadius) {
            world.setBlock(dx, 20, dz, BLOCK_TYPES.STONE);
            world.setBlock(dx, 19, dz, BLOCK_TYPES.STONE);
            if (dist <= midRadius - 2) world.setBlock(dx, 18, dz, BLOCK_TYPES.STONE);
            if (dist <= midRadius - 4) world.setBlock(dx, 17, dz, BLOCK_TYPES.BEDROCK);
          }
        }
      }
      // Emerald spawner pillars
      world.setBlock(-2, 21, 0, BLOCK_TYPES.EMERALD_BLOCK);
      world.setBlock(2, 21, 0, BLOCK_TYPES.EMERALD_BLOCK);

      // Place beds for each team
      for (const [team, bed] of Object.entries(this.beds)) {
        world.setBlock(bed.head.x, bed.head.y, bed.head.z, BLOCK_TYPES.BED_HEAD, { team, part: 'head' });
        world.setBlock(bed.foot.x, bed.foot.y, bed.foot.z, BLOCK_TYPES.BED_FOOT, { team, part: 'foot' });
      }

      // Rebuild meshes once
      world.rebuildMeshes();
    }
  },

  colosseum: {
    name: 'Colosseum (1v1)',
    description: 'Fast-paced 1v1 duel arena featuring 2 symmetrical islands facing each other across a contested void bridge.',
    teams: ['red', 'blue'],
    spawns: {
      red: { x: -15, y: 20, z: 0 },
      blue: { x: 15, y: 20, z: 0 },
    },
    beds: {
      red: { head: { x: -18, y: 20, z: 0 }, foot: { x: -17, y: 20, z: 0 } },
      blue: { head: { x: 18, y: 20, z: 0 }, foot: { x: 17, y: 20, z: 0 } },
    },
    generators: [
      { type: 'forge', team: 'red', pos: { x: -13, y: 20, z: 0 }, interval: 2.0 },
      { type: 'forge', team: 'blue', pos: { x: 13, y: 20, z: 0 }, interval: 2.0 },
      { type: 'diamond', pos: { x: 0, y: 20, z: -4 }, interval: 15 },
      { type: 'emerald', pos: { x: 0, y: 20, z: 4 }, interval: 25 },
    ],
    shopkeepers: [
      { team: 'red', pos: { x: -15, y: 20, z: 3 }, name: 'Red Shopkeeper' },
      { team: 'blue', pos: { x: 15, y: 20, z: 3 }, name: 'Blue Shopkeeper' },
    ],
    generateGeometry(world) {
      const teamColors = {
        red: BLOCK_TYPES.WOOL_RED,
        blue: BLOCK_TYPES.WOOL_BLUE,
      };

      // 1. Build Red Island (x: -15, y: 19, z: 0) and Blue Island (x: 15, y: 19, z: 0)
      const bases = [
        { team: 'red', cx: -15, cy: 19, cz: 0 },
        { team: 'blue', cx: 15, cy: 19, cz: 0 },
      ];

      bases.forEach(({ team, cx, cy, cz }) => {
        const radius = 5;
        for (let dx = -radius; dx <= radius; dx++) {
          for (let dz = -radius; dz <= radius; dz++) {
            const dist = Math.hypot(dx, dz);
            if (dist <= radius) {
              const x = cx + dx;
              const z = cz + dz;
              world.setBlock(x, cy, z, BLOCK_TYPES.GRASS);
              world.setBlock(x, cy - 1, z, BLOCK_TYPES.DIRT);
              world.setBlock(x, cy - 2, z, BLOCK_TYPES.DIRT);
              if (dist <= radius - 2) world.setBlock(x, cy - 3, z, BLOCK_TYPES.STONE);
              if (dist <= radius - 3) world.setBlock(x, cy - 4, z, BLOCK_TYPES.BEDROCK);
            }
          }
        }
        // Team colored wool highlight around base
        for (let a = -1; a <= 1; a++) {
          world.setBlock(cx + a, cy, cz + 2, teamColors[team]);
          world.setBlock(cx + a, cy, cz - 2, teamColors[team]);
        }
      });

      // 2. Build Center Contested Island (x: 0, y: 19, z: 0)
      const centerRadius = 4;
      for (let dx = -centerRadius; dx <= centerRadius; dx++) {
        for (let dz = -centerRadius; dz <= centerRadius; dz++) {
          const dist = Math.hypot(dx, dz);
          if (dist <= centerRadius) {
            world.setBlock(dx, 19, dz, BLOCK_TYPES.END_STONE);
            world.setBlock(dx, 18, dz, BLOCK_TYPES.STONE);
            if (dist <= centerRadius - 2) world.setBlock(dx, 17, dz, BLOCK_TYPES.BEDROCK);
          }
        }
      }

      // Center Spawner Pillars
      world.setBlock(0, 20, -4, BLOCK_TYPES.DIAMOND_BLOCK);
      world.setBlock(0, 20, 4, BLOCK_TYPES.EMERALD_BLOCK);

      // Place beds
      for (const [team, bed] of Object.entries(this.beds)) {
        world.setBlock(bed.head.x, bed.head.y, bed.head.z, BLOCK_TYPES.BED_HEAD, { team, part: 'head' });
        world.setBlock(bed.foot.x, bed.foot.y, bed.foot.z, BLOCK_TYPES.BED_FOOT, { team, part: 'foot' });
      }

      world.rebuildMeshes();
    }
  },

  octagon: {
    name: 'Octagon (8 Teams)',
    description: 'Massive 8-team circular battle arena for Solos and Duos, with radial team bases, outer diamond satellites, and center Emerald Citadel.',
    teams: ['red', 'blue', 'green', 'yellow', 'aqua', 'white', 'pink', 'gray'],
    spawns: {
      red: { x: 50, y: 22, z: 0 },
      blue: { x: 35, y: 22, z: 35 },
      green: { x: 0, y: 22, z: 50 },
      yellow: { x: -35, y: 22, z: 35 },
      aqua: { x: -50, y: 22, z: 0 },
      white: { x: -35, y: 22, z: -35 },
      pink: { x: 0, y: 22, z: -50 },
      gray: { x: 35, y: 22, z: -35 },
    },
    beds: {
      red: { head: { x: 55, y: 21, z: 0 }, foot: { x: 54, y: 21, z: 0 } },
      blue: { head: { x: 39, y: 21, z: 39 }, foot: { x: 38, y: 21, z: 39 } },
      green: { head: { x: 0, y: 21, z: 55 }, foot: { x: 0, y: 21, z: 54 } },
      yellow: { head: { x: -39, y: 21, z: 39 }, foot: { x: -38, y: 21, z: 39 } },
      aqua: { head: { x: -55, y: 21, z: 0 }, foot: { x: -54, y: 21, z: 0 } },
      white: { head: { x: -39, y: 21, z: -39 }, foot: { x: -38, y: 21, z: -39 } },
      pink: { head: { x: 0, y: 21, z: -55 }, foot: { x: 0, y: 21, z: -54 } },
      gray: { head: { x: 39, y: 21, z: -39 }, foot: { x: 38, y: 21, z: -39 } },
    },
    generators: [
      // 8 Team Forges
      { type: 'forge', team: 'red', pos: { x: 46, y: 21, z: 0 }, interval: 2.5 },
      { type: 'forge', team: 'blue', pos: { x: 32, y: 21, z: 32 }, interval: 2.5 },
      { type: 'forge', team: 'green', pos: { x: 0, y: 21, z: 46 }, interval: 2.5 },
      { type: 'forge', team: 'yellow', pos: { x: -32, y: 21, z: 32 }, interval: 2.5 },
      { type: 'forge', team: 'aqua', pos: { x: -46, y: 21, z: 0 }, interval: 2.5 },
      { type: 'forge', team: 'white', pos: { x: -32, y: 21, z: -32 }, interval: 2.5 },
      { type: 'forge', team: 'pink', pos: { x: 0, y: 21, z: -46 }, interval: 2.5 },
      { type: 'forge', team: 'gray', pos: { x: 32, y: 21, z: -32 }, interval: 2.5 },
      // 4 Outer Diamond Satellites at radius 28
      { type: 'diamond', pos: { x: 20, y: 21, z: 20 }, interval: 15 },
      { type: 'diamond', pos: { x: -20, y: 21, z: 20 }, interval: 15 },
      { type: 'diamond', pos: { x: -20, y: 21, z: -20 }, interval: 15 },
      { type: 'diamond', pos: { x: 20, y: 21, z: -20 }, interval: 15 },
      // 2 Center Emerald Generators in Emerald Citadel
      { type: 'emerald', pos: { x: -3, y: 21, z: 0 }, interval: 25 },
      { type: 'emerald', pos: { x: 3, y: 21, z: 0 }, interval: 25 },
    ],
    shopkeepers: [
      { team: 'red', pos: { x: 50, y: 21, z: 3 }, name: 'Red Shopkeeper' },
      { team: 'blue', pos: { x: 35, y: 21, z: 38 }, name: 'Blue Shopkeeper' },
      { team: 'green', pos: { x: 3, y: 21, z: 50 }, name: 'Green Shopkeeper' },
      { team: 'yellow', pos: { x: -35, y: 21, z: 38 }, name: 'Yellow Shopkeeper' },
      { team: 'aqua', pos: { x: -50, y: 21, z: 3 }, name: 'Aqua Shopkeeper' },
      { team: 'white', pos: { x: -35, y: 21, z: -32 }, name: 'White Shopkeeper' },
      { team: 'pink', pos: { x: 3, y: 21, z: -50 }, name: 'Pink Shopkeeper' },
      { team: 'gray', pos: { x: 35, y: 21, z: -32 }, name: 'Gray Shopkeeper' },
    ],
    generateGeometry(world) {
      const teamWools = {
        red: BLOCK_TYPES.WOOL_RED,
        blue: BLOCK_TYPES.WOOL_BLUE,
        green: BLOCK_TYPES.WOOL_GREEN,
        yellow: BLOCK_TYPES.WOOL_YELLOW,
        aqua: BLOCK_TYPES.WOOL_AQUA,
        white: BLOCK_TYPES.WOOL_WHITE,
        pink: BLOCK_TYPES.WOOL_PINK,
        gray: BLOCK_TYPES.WOOL_GRAY,
      };

      // 1. Build 8 Radial Team Islands
      const teamBases = [
        { team: 'red', cx: 50, cz: 0 },
        { team: 'blue', cx: 35, cz: 35 },
        { team: 'green', cx: 0, cz: 50 },
        { team: 'yellow', cx: -35, cz: 35 },
        { team: 'aqua', cx: -50, cz: 0 },
        { team: 'white', cx: -35, cz: -35 },
        { team: 'pink', cx: 0, cz: -50 },
        { team: 'gray', cx: 35, cz: -35 },
      ];

      const cy = 20;
      teamBases.forEach(({ team, cx, cz }) => {
        const isDiagonal = (cx !== 0 && cz !== 0);
        const radius = isDiagonal ? 6 : 5.5;
        for (let dx = -radius; dx <= radius; dx++) {
          for (let dz = -radius; dz <= radius; dz++) {
            const dist = Math.hypot(dx, dz);
            if (dist <= radius) {
              const x = cx + dx;
              const z = cz + dz;
              world.setBlock(x, cy, z, BLOCK_TYPES.GRASS);
              world.setBlock(x, cy - 1, z, BLOCK_TYPES.DIRT);
              world.setBlock(x, cy - 2, z, BLOCK_TYPES.DIRT);
              if (dist <= radius - 2) world.setBlock(x, cy - 3, z, BLOCK_TYPES.STONE);
              if (dist <= radius - 3) world.setBlock(x, cy - 4, z, BLOCK_TYPES.BEDROCK);
            }
          }
        }

        // Team wool ring around forge
        for (let a = -1; a <= 1; a++) {
          world.setBlock(cx + a, cy, cz + 2, teamWools[team]);
          world.setBlock(cx + a, cy, cz - 2, teamWools[team]);
        }
      });

      // 2. Build 4 Outer Diamond Satellites (radius 28)
      const diamondSatellites = [
        { cx: 20, cz: 20 },
        { cx: -20, cz: 20 },
        { cx: -20, cz: -20 },
        { cx: 20, cz: -20 },
      ];

      diamondSatellites.forEach(({ cx, cz }) => {
        const radius = 3;
        for (let dx = -radius; dx <= radius; dx++) {
          for (let dz = -radius; dz <= radius; dz++) {
            if (Math.hypot(dx, dz) <= radius) {
              world.setBlock(cx + dx, cy, cz + dz, BLOCK_TYPES.END_STONE);
              world.setBlock(cx + dx, cy - 1, cz + dz, BLOCK_TYPES.END_STONE);
            }
          }
        }
        world.setBlock(cx, cy + 1, cz, BLOCK_TYPES.DIAMOND_BLOCK);
      });

      // 3. Build Center Emerald Citadel (radius 8 disc)
      const midRadius = 8;
      for (let dx = -midRadius; dx <= midRadius; dx++) {
        for (let dz = -midRadius; dz <= midRadius; dz++) {
          const dist = Math.hypot(dx, dz);
          if (dist <= midRadius) {
            world.setBlock(dx, cy, dz, BLOCK_TYPES.STONE);
            world.setBlock(dx, cy - 1, dz, BLOCK_TYPES.STONE);
            if (dist <= midRadius - 2) world.setBlock(dx, cy - 2, dz, BLOCK_TYPES.STONE);
            if (dist <= midRadius - 4) world.setBlock(dx, cy - 3, dz, BLOCK_TYPES.BEDROCK);
          }
        }
      }

      // Emerald Spawners in Citadel
      world.setBlock(-3, cy + 1, 0, BLOCK_TYPES.EMERALD_BLOCK);
      world.setBlock(3, cy + 1, 0, BLOCK_TYPES.EMERALD_BLOCK);

      // Place beds for all 8 teams (ensuring solid foundation underneath)
      for (const [team, bed] of Object.entries(this.beds)) {
        for (const part of [bed.head, bed.foot]) {
          const under = world.getBlock(part.x, cy, part.z);
          if (under === BLOCK_TYPES.AIR || under === undefined) {
            world.setBlock(part.x, cy, part.z, BLOCK_TYPES.GRASS);
            world.setBlock(part.x, cy - 1, part.z, BLOCK_TYPES.DIRT);
            world.setBlock(part.x, cy - 2, part.z, BLOCK_TYPES.DIRT);
          }
        }
        world.setBlock(bed.head.x, bed.head.y, bed.head.z, BLOCK_TYPES.BED_HEAD, { team, part: 'head' });
        world.setBlock(bed.foot.x, bed.foot.y, bed.foot.z, BLOCK_TYPES.BED_FOOT, { team, part: 'foot' });
      }

      world.rebuildMeshes();
    }
  }
};
