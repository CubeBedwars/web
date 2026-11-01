import * as THREE from 'three';

export class ParticleSystem {
  constructor(scene) {
    this.scene = scene;
    this.particles = [];
    this.cubeGeo = new THREE.BoxGeometry(0.12, 0.12, 0.12);
  }

  // Spawn flying voxel crumbs when a block is broken
  spawnBlockDebris(position, color = 0xcccccc, count = 12) {
    const mat = new THREE.MeshBasicMaterial({ color });
    
    for (let i = 0; i < count; i++) {
      const mesh = new THREE.Mesh(this.cubeGeo, mat);
      mesh.position.copy(position).add(new THREE.Vector3(
        (Math.random() - 0.5) * 0.6,
        (Math.random() - 0.5) * 0.6,
        (Math.random() - 0.5) * 0.6
      ));

      const velocity = new THREE.Vector3(
        (Math.random() - 0.5) * 6,
        Math.random() * 4 + 2,
        (Math.random() - 0.5) * 6
      );

      this.scene.add(mesh);
      this.particles.push({
        mesh,
        velocity,
        life: 0.6 + Math.random() * 0.4,
        maxLife: 1.0,
        gravity: 18.0,
      });
    }
  }

  // Explosion sparks and fireball blast
  spawnExplosion(position, count = 28) {
    for (let i = 0; i < count; i++) {
      const isFire = Math.random() > 0.4;
      const color = isFire ? 0xff5500 : 0x444444;
      const mat = new THREE.MeshBasicMaterial({ color });
      const mesh = new THREE.Mesh(this.cubeGeo, mat);
      
      mesh.position.copy(position);
      const speed = Math.random() * 12 + 4;
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.random() * Math.PI;

      const velocity = new THREE.Vector3(
        Math.sin(phi) * Math.cos(theta) * speed,
        Math.cos(phi) * speed + 3,
        Math.sin(phi) * Math.sin(theta) * speed
      );

      this.scene.add(mesh);
      this.particles.push({
        mesh,
        velocity,
        life: 0.5 + Math.random() * 0.5,
        maxLife: 1.0,
        gravity: 10.0,
      });
    }
  }

  // Lucky block rainbow burst
  spawnRainbowBurst(position) {
    const rainbowColors = [0xff0000, 0xff7f00, 0xffff00, 0x00ff00, 0x0000ff, 0x8b00ff];
    for (let i = 0; i < 30; i++) {
      const color = rainbowColors[i % rainbowColors.length];
      const mat = new THREE.MeshBasicMaterial({ color });
      const mesh = new THREE.Mesh(this.cubeGeo, mat);
      mesh.position.copy(position);

      const velocity = new THREE.Vector3(
        (Math.random() - 0.5) * 8,
        Math.random() * 7 + 3,
        (Math.random() - 0.5) * 8
      );

      this.scene.add(mesh);
      this.particles.push({
        mesh,
        velocity,
        life: 0.8 + Math.random() * 0.5,
        maxLife: 1.3,
        gravity: 12.0,
      });
    }
  }

  update(delta) {
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.life -= delta;

      if (p.life <= 0) {
        this.scene.remove(p.mesh);
        p.mesh.material.dispose();
        this.particles.splice(i, 1);
        continue;
      }

      // Physics
      p.velocity.y -= p.gravity * delta;
      p.mesh.position.addScaledVector(p.velocity, delta);

      // Fade out & shrink
      const progress = p.life / p.maxLife;
      p.mesh.scale.setScalar(progress);
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
