import * as THREE from 'three';

export class ParticleSystem {
  constructor(scene) {
    this.scene = scene;
    this.particles = [];
    this.boxGeo = new THREE.BoxGeometry(0.12, 0.12, 0.12);
  }

  spawnBlockBreak(pos, colorHex = 0xffffff, count = 12) {
    const mat = new THREE.MeshBasicMaterial({ color: colorHex });
    for (let i = 0; i < count; i++) {
      const mesh = new THREE.Mesh(this.boxGeo, mat);
      mesh.position.set(
        pos.x + 0.5 + (Math.random() - 0.5) * 0.8,
        pos.y + 0.5 + (Math.random() - 0.5) * 0.8,
        pos.z + 0.5 + (Math.random() - 0.5) * 0.8
      );

      const vel = new THREE.Vector3(
        (Math.random() - 0.5) * 6,
        Math.random() * 4 + 2,
        (Math.random() - 0.5) * 6
      );

      this.scene.add(mesh);
      this.particles.push({
        mesh,
        vel,
        life: 0.6,
        maxLife: 0.6
      });
    }
  }

  spawnHitSparks(pos, count = 8) {
    const mat = new THREE.MeshBasicMaterial({ color: 0xff3333 });
    for (let i = 0; i < count; i++) {
      const mesh = new THREE.Mesh(this.boxGeo, mat);
      mesh.position.copy(pos);
      const vel = new THREE.Vector3(
        (Math.random() - 0.5) * 5,
        Math.random() * 4,
        (Math.random() - 0.5) * 5
      );
      this.scene.add(mesh);
      this.particles.push({
        mesh,
        vel,
        life: 0.35,
        maxLife: 0.35
      });
    }
  }

  update(dt) {
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.life -= dt;
      if (p.life <= 0) {
        this.scene.remove(p.mesh);
        p.mesh.material.dispose();
        this.particles.splice(i, 1);
        continue;
      }

      p.vel.y -= 15 * dt; // gravity
      p.mesh.position.addScaledVector(p.vel, dt);
      const scale = p.life / p.maxLife;
      p.mesh.scale.set(scale, scale, scale);
    }
  }

  clear() {
    for (const p of this.particles) {
      this.scene.remove(p.mesh);
      p.mesh.material.dispose();
    }
    this.particles = [];
  }
}
