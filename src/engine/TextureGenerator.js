import * as THREE from 'three';

// 16x16 Procedural pixel-art texture generator for authentic voxel graphics
export class TextureGenerator {
  constructor() {
    this.cache = new Map();
  }

  createCanvas(drawFn) {
    const canvas = document.createElement('canvas');
    canvas.width = 16;
    canvas.height = 16;
    const ctx = canvas.getContext('2d');
    drawFn(ctx, canvas);
    const texture = new THREE.CanvasTexture(canvas);
    texture.magFilter = THREE.NearestFilter;
    texture.minFilter = THREE.NearestFilter;
    texture.generateMipmaps = false;
    return texture;
  }

  getTexture(blockType, face = 'all') {
    const key = `${blockType}_${face}`;
    if (this.cache.has(key)) return this.cache.get(key);

    let tex;
    switch (blockType) {
      case 'grass':
        if (face === 'top') tex = this.createGrassTop();
        else if (face === 'bottom') tex = this.createDirt();
        else tex = this.createGrassSide();
        break;
      case 'dirt':
        tex = this.createDirt();
        break;
      case 'stone':
        tex = this.createStone();
        break;
      case 'wood':
        tex = this.createWood();
        break;
      case 'end_stone':
        tex = this.createEndStone();
        break;
      case 'obsidian':
        tex = this.createObsidian();
        break;
      case 'glass':
        tex = this.createGlass();
        break;
      case 'diamond_block':
        tex = this.createGemBlock('#25d6ec', '#57f2ff', '#0b8296');
        break;
      case 'emerald_block':
        tex = this.createGemBlock('#10b981', '#34d399', '#065f46');
        break;
      case 'gold_block':
        tex = this.createGemBlock('#eab308', '#facc15', '#a16207');
        break;
      case 'iron_block':
        tex = this.createGemBlock('#d1d5db', '#f3f4f6', '#9ca3af');
        break;
      case 'lucky_block':
        tex = this.createLuckyBlock();
        break;
      case 'bed_head':
        tex = this.createBedHead(face);
        break;
      case 'bed_foot':
        tex = this.createBedFoot(face);
        break;
      case 'tnt':
        tex = this.createTNT(face);
        break;
      default:
        if (blockType.startsWith('wool_')) {
          const colorName = blockType.replace('wool_', '');
          tex = this.createWool(colorName);
        } else {
          tex = this.createStone();
        }
        break;
    }

    this.cache.set(key, tex);
    return tex;
  }

  createGrassTop() {
    return this.createCanvas((ctx) => {
      ctx.fillStyle = '#4ade80';
      ctx.fillRect(0, 0, 16, 16);
      const greens = ['#22c55e', '#16a34a', '#86efac', '#15803d'];
      for (let x = 0; x < 16; x++) {
        for (let y = 0; y < 16; y++) {
          if (Math.random() > 0.4) {
            ctx.fillStyle = greens[Math.floor(Math.random() * greens.length)];
            ctx.fillRect(x, y, 1, 1);
          }
        }
      }
    });
  }

  createGrassSide() {
    return this.createCanvas((ctx) => {
      // Dirt base
      ctx.fillStyle = '#78350f';
      ctx.fillRect(0, 0, 16, 16);
      for (let x = 0; x < 16; x++) {
        for (let y = 0; y < 16; y++) {
          if (Math.random() > 0.5) {
            ctx.fillStyle = Math.random() > 0.5 ? '#92400e' : '#5b21b6' === '' ? '#572209' : '#542308';
            ctx.fillRect(x, y, 1, 1);
          }
        }
      }
      // Grass top overhang
      ctx.fillStyle = '#22c55e';
      ctx.fillRect(0, 0, 16, 3);
      for (let x = 0; x < 16; x++) {
        const drop = Math.floor(Math.random() * 3);
        ctx.fillStyle = '#16a34a';
        ctx.fillRect(x, 2, 1, drop);
      }
    });
  }

  createDirt() {
    return this.createCanvas((ctx) => {
      ctx.fillStyle = '#78350f';
      ctx.fillRect(0, 0, 16, 16);
      const browns = ['#92400e', '#542308', '#6b2d0a', '#451a03'];
      for (let x = 0; x < 16; x++) {
        for (let y = 0; y < 16; y++) {
          if (Math.random() > 0.4) {
            ctx.fillStyle = browns[Math.floor(Math.random() * browns.length)];
            ctx.fillRect(x, y, 1, 1);
          }
        }
      }
    });
  }

  createStone() {
    return this.createCanvas((ctx) => {
      ctx.fillStyle = '#64748b';
      ctx.fillRect(0, 0, 16, 16);
      const grays = ['#475569', '#334155', '#94a3b8', '#1e293b'];
      for (let x = 0; x < 16; x++) {
        for (let y = 0; y < 16; y++) {
          if (Math.random() > 0.45) {
            ctx.fillStyle = grays[Math.floor(Math.random() * grays.length)];
            ctx.fillRect(x, y, 1, 1);
          }
        }
      }
    });
  }

  createWood() {
    return this.createCanvas((ctx) => {
      ctx.fillStyle = '#b45309';
      ctx.fillRect(0, 0, 16, 16);
      for (let y = 0; y < 16; y += 4) {
        ctx.fillStyle = '#78350f';
        ctx.fillRect(0, y, 16, 1);
      }
      for (let x = 0; x < 16; x++) {
        for (let y = 0; y < 16; y++) {
          if (Math.random() > 0.6) {
            ctx.fillStyle = Math.random() > 0.5 ? '#92400e' : '#d97706';
            ctx.fillRect(x, y, 1, 1);
          }
        }
      }
    });
  }

  createEndStone() {
    return this.createCanvas((ctx) => {
      ctx.fillStyle = '#fef08a';
      ctx.fillRect(0, 0, 16, 16);
      const shades = ['#fef9c3', '#fde047', '#eab308', '#ca8a04'];
      for (let x = 0; x < 16; x++) {
        for (let y = 0; y < 16; y++) {
          if (Math.random() > 0.5) {
            ctx.fillStyle = shades[Math.floor(Math.random() * shades.length)];
            ctx.fillRect(x, y, 1, 1);
          }
        }
      }
    });
  }

  createObsidian() {
    return this.createCanvas((ctx) => {
      ctx.fillStyle = '#1e1b4b';
      ctx.fillRect(0, 0, 16, 16);
      const purpleShades = ['#0f0e26', '#312e81', '#4338ca', '#18181b'];
      for (let x = 0; x < 16; x++) {
        for (let y = 0; y < 16; y++) {
          if (Math.random() > 0.4) {
            ctx.fillStyle = purpleShades[Math.floor(Math.random() * purpleShades.length)];
            ctx.fillRect(x, y, 1, 1);
          }
        }
      }
    });
  }

  createGlass() {
    return this.createCanvas((ctx) => {
      ctx.fillStyle = 'rgba(224, 242, 254, 0.2)';
      ctx.fillRect(0, 0, 16, 16);
      // Outer bevel border
      ctx.strokeStyle = '#bae6fd';
      ctx.lineWidth = 1;
      ctx.strokeRect(0.5, 0.5, 15, 15);
      // Glare highlight lines
      ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
      ctx.fillRect(2, 2, 2, 2);
      ctx.fillRect(4, 3, 1, 1);
      ctx.fillRect(3, 4, 1, 1);
    });
  }

  createWool(colorName) {
    const woolColors = {
      white: ['#f8fafc', '#e2e8f0', '#cbd5e1'],
      red: ['#ef4444', '#dc2626', '#b91c1c'],
      blue: ['#3b82f6', '#2563eb', '#1d4ed8'],
      green: ['#22c55e', '#16a34a', '#15803d'],
      yellow: ['#eab308', '#ca8a04', '#a16207'],
      aqua: ['#06b6d4', '#0891b2', '#0e7490'],
      pink: ['#ec4899', '#db2777', '#be185d'],
      gray: ['#64748b', '#475569', '#334155'],
    };
    const palette = woolColors[colorName] || woolColors.white;

    return this.createCanvas((ctx) => {
      ctx.fillStyle = palette[0];
      ctx.fillRect(0, 0, 16, 16);
      // Knitted wool pattern weave
      for (let x = 0; x < 16; x++) {
        for (let y = 0; y < 16; y++) {
          if ((x + y) % 2 === 0) {
            ctx.fillStyle = palette[1];
            ctx.fillRect(x, y, 1, 1);
          } else if (Math.random() > 0.7) {
            ctx.fillStyle = palette[2];
            ctx.fillRect(x, y, 1, 1);
          }
        }
      }
    });
  }

  createGemBlock(base, light, dark) {
    return this.createCanvas((ctx) => {
      ctx.fillStyle = base;
      ctx.fillRect(0, 0, 16, 16);
      // Crystal border
      ctx.fillStyle = light;
      ctx.fillRect(0, 0, 16, 2);
      ctx.fillRect(0, 0, 2, 16);
      ctx.fillStyle = dark;
      ctx.fillRect(0, 14, 16, 2);
      ctx.fillRect(14, 0, 2, 16);
      // Inner facet
      ctx.fillStyle = light;
      ctx.fillRect(4, 4, 8, 8);
      ctx.fillStyle = base;
      ctx.fillRect(5, 5, 6, 6);
    });
  }

  createLuckyBlock() {
    return this.createCanvas((ctx) => {
      ctx.fillStyle = '#f59e0b';
      ctx.fillRect(0, 0, 16, 16);
      ctx.fillStyle = '#d97706';
      ctx.strokeRect(0.5, 0.5, 15, 15);
      // Question mark '?' in center
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(6, 3, 4, 2);
      ctx.fillRect(9, 5, 2, 2);
      ctx.fillRect(7, 7, 2, 2);
      ctx.fillRect(7, 11, 2, 2);
    });
  }

  createBedHead(face) {
    return this.createCanvas((ctx) => {
      if (face === 'top') {
        // Red blanket + White Pillow
        ctx.fillStyle = '#ef4444';
        ctx.fillRect(0, 0, 16, 16);
        ctx.fillStyle = '#f8fafc';
        ctx.fillRect(2, 2, 12, 5);
      } else {
        ctx.fillStyle = '#ef4444';
        ctx.fillRect(0, 0, 16, 10);
        ctx.fillStyle = '#78350f'; // wood frame
        ctx.fillRect(0, 10, 16, 6);
      }
    });
  }

  createBedFoot(face) {
    return this.createCanvas((ctx) => {
      if (face === 'top') {
        // Pure red blanket
        ctx.fillStyle = '#ef4444';
        ctx.fillRect(0, 0, 16, 16);
      } else {
        ctx.fillStyle = '#ef4444';
        ctx.fillRect(0, 0, 16, 10);
        ctx.fillStyle = '#78350f'; // wood frame
        ctx.fillRect(0, 10, 16, 6);
      }
    });
  }

  createTNT(face) {
    return this.createCanvas((ctx) => {
      if (face === 'top' || face === 'bottom') {
        ctx.fillStyle = '#dc2626';
        ctx.fillRect(0, 0, 16, 16);
        ctx.fillStyle = '#78350f';
        ctx.fillRect(7, 7, 2, 2);
      } else {
        ctx.fillStyle = '#dc2626';
        ctx.fillRect(0, 0, 16, 16);
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 5, 16, 6);
        ctx.fillStyle = '#000000';
        ctx.font = 'bold 5px sans-serif';
        ctx.fillText('TNT', 2, 10);
      }
    });
  }
}
