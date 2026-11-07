import * as THREE from 'three';

export class GeneratorManager {
  constructor(scene, sound) {
    this.scene = scene;
    this.sound = sound;
    this.spawners = [];
    this.items = []; // Active floating drops

    // Shared geometries and materials for dropped items
    this.dropGeos = {
      iron: new THREE.BoxGeometry(0.3, 0.15, 0.5),
      gold: new THREE.BoxGeometry(0.3, 0.15, 0.5),
      diamond: new THREE.OctahedronGeometry(0.25),
      emerald: new THREE.OctahedronGeometry(0.25),
    };

    this.dropMats = {
      iron: new THREE.MeshStandardMaterial({ color: 0xd1d5db, roughness: 0.3, metalness: 0.8 }),
      gold: new THREE.MeshStandardMaterial({ color: 0xfacc15, roughness: 0.2, metalness: 0.9, emissive: 0x332200 }),
      diamond: new THREE.MeshStandardMaterial({ color: 0x22d3ee, roughness: 0.1, metalness: 0.5, emissive: 0x004455 }),
      emerald: new THREE.MeshStandardMaterial({ color: 0x10b981, roughness: 0.1, metalness: 0.5, emissive: 0x004422 }),
    };
  }

  loadSpawners(generatorConfigs) {
    this.clear();
    for (const cfg of generatorConfigs) {
      this.spawners.push({
        ...cfg,
        timer: Math.random() * cfg.interval, // stagger starts
      });
    }
  }

  spawnDrop(type, pos) {
    const geo = this.dropGeos[type] || this.dropGeos.iron;
    const mat = this.dropMats[type] || this.dropMats.iron;
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(
      pos.x + (Math.random() - 0.5) * 0.4,
      pos.y + 0.6,
      pos.z + (Math.random() - 0.5) * 0.4
    );
    this.scene.add(mesh);

    this.items.push({
      type,
      mesh,
      spawnY: mesh.position.y,
      age: 0,
    });
  }

  update(dt, players, teamManager) {
    // 1. Progress spawner timers
    for (const sp of this.spawners) {
      let interval = sp.interval;
      if (sp.type === 'forge' && sp.team && teamManager) {
        const tier = teamManager.teams[sp.team]?.upgrades?.forgeTier || 1;
        interval /= tier;
      }

      sp.timer += dt;
      if (sp.timer >= interval) {
        sp.timer = 0;
        if (sp.type === 'forge') {
          // Iron drops every cycle, Gold every 4th cycle
          this.spawnDrop('iron', sp.pos);
          if (Math.random() > 0.65) {
            this.spawnDrop('gold', sp.pos);
          }
        } else if (sp.type === 'diamond') {
          this.spawnDrop('diamond', sp.pos);
        } else if (sp.type === 'emerald') {
          this.spawnDrop('emerald', sp.pos);
        }
      }
    }

    // 2. Animate and check magnetic pickup for floating items
    for (let i = this.items.length - 1; i >= 0; i--) {
      const item = this.items[i];
      item.age += dt;

      // Spin & bob animation
      item.mesh.rotation.y += 3.0 * dt;
      item.mesh.position.y = item.spawnY + Math.sin(item.age * 4.0) * 0.15;

      // Check proximity to living players / bots
      let collected = false;
      for (const p of players) {
        if (p.isDead) continue;
        const dist = p.position.distanceTo(item.mesh.position);
        if (dist < 2.4) {
          // Magnetic pull towards player
          item.mesh.position.lerp(p.position, dt * 10);
          if (dist < 1.0) {
            // Collect into inventory
            p.addResource(item.type, 1);
            if (p.isLocalPlayer && this.sound) {
              this.sound.playItemPickup();
            }
            this.scene.remove(item.mesh);
            this.items.splice(i, 1);
            collected = true;
            break;
          }
        }
      }

      // Max item age = 120s
      if (!collected && item.age > 120) {
        this.scene.remove(item.mesh);
        this.items.splice(i, 1);
      }
    }
  }

  clear() {
    for (const item of this.items) {
      this.scene.remove(item.mesh);
    }
    this.items = [];
    this.spawners = [];
  }
}
