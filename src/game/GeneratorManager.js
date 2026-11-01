import * as THREE from 'three';

export class GeneratorManager {
  constructor(scene, soundManager) {
    this.scene = scene;
    this.sound = soundManager;
    this.generators = []; // { type: 'forge'|'diamond'|'emerald', pos, teamId, timer, interval, tier, crystalMesh }
    this.floatingItems = []; // { mesh, type, count, pos, velocity, lifetime }

    // Geometries & materials
    this.octaGeo = new THREE.OctahedronGeometry(0.5);
    this.diaMat = new THREE.MeshBasicMaterial({ color: 0x00f0ff, wireframe: true });
    this.emeMat = new THREE.MeshBasicMaterial({ color: 0x00f59b, wireframe: true });

    // Item token geometries (small colored cubes)
    this.itemGeo = new THREE.BoxGeometry(0.2, 0.2, 0.2);
    this.mats = {
      iron: new THREE.MeshLambertMaterial({ color: 0xdddddd }),
      gold: new THREE.MeshLambertMaterial({ color: 0xffd700 }),
      diamond: new THREE.MeshLambertMaterial({ color: 0x00f0ff }),
      emerald: new THREE.MeshLambertMaterial({ color: 0x00f59b }),
    };

    this.group = new THREE.Group();
    this.scene.add(this.group);
  }

  addForgeGenerator(x, y, z, teamId) {
    this.generators.push({
      type: 'forge',
      teamId,
      pos: new THREE.Vector3(x + 0.5, y + 0.2, z + 0.5),
      ironTimer: 0,
      goldTimer: 0,
      ironInterval: 1.4,
      goldInterval: 6.0,
      tier: 1,
      crystalMesh: null,
    });
  }

  addDiamondGenerator(x, y, z) {
    const mesh = new THREE.Mesh(this.octaGeo, this.diaMat);
    mesh.position.set(x + 0.5, y + 2.0, z + 0.5);
    this.group.add(mesh);

    this.generators.push({
      type: 'diamond',
      pos: new THREE.Vector3(x + 0.5, y + 0.5, z + 0.5),
      timer: 0,
      interval: 25.0,
      tier: 1,
      crystalMesh: mesh,
    });
  }

  addEmeraldGenerator(x, y, z) {
    const mesh = new THREE.Mesh(this.octaGeo, this.emeMat);
    mesh.position.set(x + 0.5, y + 2.5, z + 0.5);
    this.group.add(mesh);

    this.generators.push({
      type: 'emerald',
      pos: new THREE.Vector3(x + 0.5, y + 0.5, z + 0.5),
      timer: 0,
      interval: 45.0,
      tier: 1,
      crystalMesh: mesh,
    });
  }

  spawnItem(type, pos) {
    // Limit items per cluster to prevent lag
    const nearbyCount = this.floatingItems.filter(
      item => item.type === type && item.mesh.position.distanceTo(pos) < 1.5
    ).length;
    if (nearbyCount >= 48) return; // stack cap

    const mat = this.mats[type] || this.mats.iron;
    const mesh = new THREE.Mesh(this.itemGeo, mat);
    mesh.position.copy(pos).add(new THREE.Vector3(
      (Math.random() - 0.5) * 0.4,
      0.2,
      (Math.random() - 0.5) * 0.4
    ));

    this.group.add(mesh);
    this.floatingItems.push({
      mesh,
      type,
      count: 1,
      velocity: new THREE.Vector3((Math.random() - 0.5) * 0.8, 1.8, (Math.random() - 0.5) * 0.8),
      lifetime: 90.0,
    });
  }

  update(delta, players = [], speedMultiplier = 1.0) {
    const now = performance.now() * 0.002;

    // 1. Update Generators & Spawning
    for (const gen of this.generators) {
      if (gen.crystalMesh) {
        gen.crystalMesh.rotation.y += delta * 1.5;
        gen.crystalMesh.position.y = gen.pos.y + 1.8 + Math.sin(now) * 0.25;
      }

      if (gen.type === 'forge') {
        const ironRate = gen.ironInterval / speedMultiplier;
        const goldRate = gen.goldInterval / speedMultiplier;

        gen.ironTimer += delta;
        if (gen.ironTimer >= ironRate) {
          gen.ironTimer = 0;
          this.spawnItem('iron', gen.pos);
        }

        gen.goldTimer += delta;
        if (gen.goldTimer >= goldRate) {
          gen.goldTimer = 0;
          this.spawnItem('gold', gen.pos);
        }
      } else if (gen.type === 'diamond') {
        const rate = (gen.interval / speedMultiplier) * (gen.tier === 2 ? 0.75 : gen.tier === 3 ? 0.5 : 1.0);
        gen.timer += delta;
        if (gen.timer >= rate) {
          gen.timer = 0;
          this.spawnItem('diamond', gen.pos);
        }
      } else if (gen.type === 'emerald') {
        const rate = (gen.interval / speedMultiplier) * (gen.tier === 2 ? 0.75 : gen.tier === 3 ? 0.5 : 1.0);
        gen.timer += delta;
        if (gen.timer >= rate) {
          gen.timer = 0;
          this.spawnItem('emerald', gen.pos);
        }
      }
    }

    // 2. Update Floating Items (Physics, Bobbing, Magnetic Pickup)
    for (let i = this.floatingItems.length - 1; i >= 0; i--) {
      const item = this.floatingItems[i];
      item.lifetime -= delta;

      if (item.lifetime <= 0) {
        this.group.remove(item.mesh);
        this.floatingItems.splice(i, 1);
        continue;
      }

      // Physics
      if (item.velocity.y > 0) {
        item.velocity.y -= 9.8 * delta;
        item.mesh.position.addScaledVector(item.velocity, delta);
      }

      item.mesh.rotation.y += delta * 2.5;

      // Magnetic Pickup by nearby players
      for (const player of players) {
        if (!player.isAlive) continue;
        const dist = item.mesh.position.distanceTo(player.position);

        // Magnetic attraction if within 2.5 blocks
        if (dist < 2.5 && dist >= 0.8) {
          const pullDir = new THREE.Vector3().subVectors(player.position, item.mesh.position).normalize();
          item.mesh.position.addScaledVector(pullDir, delta * 6.0);
        }

        // Collected!
        if (dist < 0.8) {
          player.addResource(item.type, item.count);
          if (player.isLocal && this.sound) {
            this.sound.playResourcePickup(item.type);
          }
          this.group.remove(item.mesh);
          this.floatingItems.splice(i, 1);
          break;
        }
      }
    }
  }

  clear() {
    for (const item of this.floatingItems) {
      this.group.remove(item.mesh);
    }
    this.floatingItems = [];

    for (const gen of this.generators) {
      if (gen.crystalMesh) {
        this.group.remove(gen.crystalMesh);
      }
    }
    this.generators = [];
  }
}
