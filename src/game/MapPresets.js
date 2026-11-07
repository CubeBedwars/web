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
  }
};
