import * as THREE from 'three';
import { BLOCK_TYPES } from '../engine/VoxelWorld.js';

export class VoxelPathfinder {
  constructor(world) {
    this.world = world;
  }

  // 3D Voxel A* Pathfinding
  findPath(startPos, targetPos, maxIterations = 350) {
    const start = {
      x: Math.floor(startPos.x),
      y: Math.floor(startPos.y),
      z: Math.floor(startPos.z),
    };

    const target = {
      x: Math.floor(targetPos.x),
      y: Math.floor(targetPos.y),
      z: Math.floor(targetPos.z),
    };

    const openList = [];
    const closedSet = new Set();
    const cameFrom = new Map();

    const gScore = new Map();
    const fScore = new Map();

    const startKey = `${start.x},${start.y},${start.z}`;
    gScore.set(startKey, 0);
    fScore.set(startKey, this.heuristic(start, target));

    openList.push({ ...start, f: fScore.get(startKey) });

    let iterations = 0;
    let closestNode = start;
    let closestDist = this.heuristic(start, target);

    while (openList.length > 0 && iterations < maxIterations) {
      iterations++;

      // Find node with lowest fScore
      openList.sort((a, b) => a.f - b.f);
      const current = openList.shift();
      const currentKey = `${current.x},${current.y},${current.z}`;

      const dist = this.heuristic(current, target);
      if (dist < closestDist) {
        closestDist = dist;
        closestNode = current;
      }

      // Check if reached destination
      if (dist <= 1.5) {
        return this.reconstructPath(cameFrom, current);
      }

      closedSet.add(currentKey);

      // Explore neighbors
      const neighbors = this.getValidNeighbors(current);
      for (const neighbor of neighbors) {
        const neighborKey = `${neighbor.x},${neighbor.y},${neighbor.z}`;
        if (closedSet.has(neighborKey)) continue;

        const tentativeG = gScore.get(currentKey) + neighbor.cost;

        if (!gScore.has(neighborKey) || tentativeG < gScore.get(neighborKey)) {
          cameFrom.set(neighborKey, current);
          gScore.set(neighborKey, tentativeG);
          const f = tentativeG + this.heuristic(neighbor, target);
          fScore.set(neighborKey, f);

          if (!openList.some(n => n.x === neighbor.x && n.y === neighbor.y && n.z === neighbor.z)) {
            openList.push({ ...neighbor, f });
          }
        }
      }
    }

    // Return partial path to closest reached node
    return this.reconstructPath(cameFrom, closestNode);
  }

  getValidNeighbors(node) {
    const neighbors = [];
    // 4 horizontal cardinal directions
    const dirs = [
      { x: 1, z: 0 },
      { x: -1, z: 0 },
      { x: 0, z: 1 },
      { x: 0, z: -1 },
    ];

    for (const d of dirs) {
      const nx = node.x + d.x;
      const nz = node.z + d.z;

      // 1. Same level walk
      if (this.isWalkable(nx, node.y, nz)) {
        neighbors.push({ x: nx, y: node.y, z: nz, cost: 1.0, requiresBridge: false });
      }
      // 2. Jump up 1 block
      else if (this.isWalkable(nx, node.y + 1, nz) && !this.world.isSolid(node.x, node.y + 2, node.z)) {
        neighbors.push({ x: nx, y: node.y + 1, z: nz, cost: 1.4, requiresBridge: false });
      }
      // 3. Step down 1-2 blocks
      else if (this.isWalkable(nx, node.y - 1, nz)) {
        neighbors.push({ x: nx, y: node.y - 1, z: nz, cost: 1.2, requiresBridge: false });
      }
      // 4. Void gap bridge placement candidate
      else if (!this.world.isSolid(nx, node.y - 1, nz) && !this.world.isSolid(nx, node.y, nz) && !this.world.isSolid(nx, node.y + 1, nz)) {
        neighbors.push({ x: nx, y: node.y, z: nz, cost: 2.2, requiresBridge: true });
      }
    }

    return neighbors;
  }

  isWalkable(x, y, z) {
    // Solid ground underneath (y - 1) and two air blocks for player body (y, y + 1)
    return (
      this.world.isSolid(x, y - 1, z) &&
      !this.world.isSolid(x, y, z) &&
      !this.world.isSolid(x, y + 1, z)
    );
  }

  heuristic(a, b) {
    return Math.abs(a.x - b.x) + Math.abs(a.y - b.y) + Math.abs(a.z - b.z);
  }

  reconstructPath(cameFrom, current) {
    const path = [current];
    let currKey = `${current.x},${current.y},${current.z}`;

    while (cameFrom.has(currKey)) {
      current = cameFrom.get(currKey);
      currKey = `${current.x},${current.y},${current.z}`;
      path.unshift(current);
    }

    return path.map(p => new THREE.Vector3(p.x + 0.5, p.y, p.z + 0.5));
  }
}
