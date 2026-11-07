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
      case 'iron_ore':
        tex = this.createIronOre();
        break;
      case 'gold_ore':
        tex = this.createGoldOre();
        break;
      case 'diamond_ore':
        tex = this.createDiamondOre();
        break;
      case 'emerald_ore':
        tex = this.createEmeraldOre();
        break;
      default:
        if (blockType.startsWith('crack_')) {
          const stage = parseInt(blockType.replace('crack_', ''), 10) || 0;
          tex = this.createCrackStage(stage);
        } else if (blockType.startsWith('wool_')) {
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

  getCrackTexture(stage) {
    const clamped = Math.max(0, Math.min(9, Math.floor(stage)));
    return this.getTexture(`crack_${clamped}`);
  }

  drawStoneBase(ctx) {
    ctx.fillStyle = '#64748b';
    ctx.fillRect(0, 0, 16, 16);
    const grays = ['#475569', '#334155', '#94a3b8', '#1e293b'];
    // Deterministic pseudo-random stone noise for consistent ore backgrounds
    for (let x = 0; x < 16; x++) {
      for (let y = 0; y < 16; y++) {
        const hash = Math.sin(x * 12.9898 + y * 78.233) * 43758.5453;
        const rand = hash - Math.floor(hash);
        if (rand > 0.45) {
          ctx.fillStyle = grays[Math.floor(rand * grays.length)];
          ctx.fillRect(x, y, 1, 1);
        }
      }
    }
  }

  createIronOre() {
    return this.createCanvas((ctx) => {
      this.drawStoneBase(ctx);
      // Metallic peach & silver iron flecks in authentic clusters
      const clusters = [
        // Cluster 1 (top-left)
        { x: 3, y: 2, pixels: [[0, 1, '#d4a373'], [1, 1, '#f4ebe2'], [1, 2, '#d4a373'], [2, 2, '#a3704c'], [0, 2, '#b08968']] },
        // Cluster 2 (top-right)
        { x: 10, y: 3, pixels: [[0, 0, '#f4ebe2'], [1, 0, '#d4a373'], [1, 1, '#e5e5e5'], [2, 1, '#a3704c'], [0, 1, '#c0c0c0']] },
        // Cluster 3 (center-mid)
        { x: 6, y: 8, pixels: [[0, 0, '#d4a373'], [1, 0, '#f4ebe2'], [2, 0, '#d4a373'], [1, 1, '#a3704c'], [2, 1, '#b08968'], [0, 1, '#e5e5e5']] },
        // Cluster 4 (bottom-right)
        { x: 11, y: 11, pixels: [[0, 0, '#f4ebe2'], [1, 0, '#d4a373'], [0, 1, '#a3704c'], [1, 1, '#c0c0c0'], [2, 1, '#d4a373']] },
        // Cluster 5 (bottom-left)
        { x: 2, y: 11, pixels: [[1, 0, '#f4ebe2'], [0, 1, '#d4a373'], [1, 1, '#a3704c']] }
      ];

      for (const cl of clusters) {
        for (const [dx, dy, color] of cl.pixels) {
          ctx.fillStyle = color;
          ctx.fillRect(cl.x + dx, cl.y + dy, 1, 1);
        }
      }
    });
  }

  createGoldOre() {
    return this.createCanvas((ctx) => {
      this.drawStoneBase(ctx);
      // Rich golden yellow flecks with dark borders and glowing highlights
      const clusters = [
        { x: 4, y: 3, pixels: [[0, 0, '#fef08a'], [1, 0, '#facc15'], [0, 1, '#eab308'], [1, 1, '#ca8a04'], [2, 1, '#a16207']] },
        { x: 10, y: 4, pixels: [[1, 0, '#fef08a'], [0, 1, '#facc15'], [1, 1, '#eab308'], [2, 1, '#ca8a04'], [1, 2, '#a16207']] },
        { x: 6, y: 9, pixels: [[1, 0, '#fef08a'], [0, 1, '#fde047'], [1, 1, '#facc15'], [2, 1, '#ca8a04'], [0, 2, '#eab308']] },
        { x: 11, y: 11, pixels: [[0, 0, '#fef08a'], [1, 0, '#facc15'], [0, 1, '#ca8a04'], [1, 1, '#a16207']] },
        { x: 2, y: 10, pixels: [[0, 0, '#facc15'], [1, 0, '#fef08a'], [0, 1, '#a16207']] }
      ];

      for (const cl of clusters) {
        for (const [dx, dy, color] of cl.pixels) {
          ctx.fillStyle = color;
          ctx.fillRect(cl.x + dx, cl.y + dy, 1, 1);
        }
      }
    });
  }

  createDiamondOre() {
    return this.createCanvas((ctx) => {
      this.drawStoneBase(ctx);
      // Vibrant cyan & aqua gemstone flecks with crystalline specular highlights
      const clusters = [
        { x: 3, y: 3, pixels: [[1, 0, '#ecfeff'], [0, 1, '#67e8f9'], [1, 1, '#22d3ee'], [2, 1, '#0891b2'], [1, 2, '#06b6d4'], [0, 2, '#0e7490']] },
        { x: 10, y: 3, pixels: [[0, 0, '#ecfeff'], [1, 0, '#67e8f9'], [0, 1, '#22d3ee'], [1, 1, '#0891b2'], [2, 1, '#0e7490']] },
        { x: 6, y: 8, pixels: [[1, 0, '#ecfeff'], [2, 0, '#67e8f9'], [0, 1, '#22d3ee'], [1, 1, '#06b6d4'], [2, 1, '#0891b2'], [1, 2, '#0e7490']] },
        { x: 11, y: 11, pixels: [[1, 0, '#ecfeff'], [0, 1, '#67e8f9'], [1, 1, '#22d3ee'], [2, 1, '#0891b2'], [1, 2, '#0e7490']] },
        { x: 2, y: 12, pixels: [[0, 0, '#67e8f9'], [1, 0, '#ecfeff'], [0, 1, '#0891b2'], [1, 1, '#0e7490']] }
      ];

      for (const cl of clusters) {
        for (const [dx, dy, color] of cl.pixels) {
          ctx.fillStyle = color;
          ctx.fillRect(cl.x + dx, cl.y + dy, 1, 1);
        }
      }
    });
  }

  createEmeraldOre() {
    return this.createCanvas((ctx) => {
      this.drawStoneBase(ctx);
      // Bright emerald green gemstone flecks with crystalline shine
      const clusters = [
        { x: 4, y: 3, pixels: [[1, 0, '#ecfdf5'], [0, 1, '#6ee7b7'], [1, 1, '#34d399'], [2, 1, '#10b981'], [1, 2, '#059669'], [0, 2, '#047857']] },
        { x: 11, y: 4, pixels: [[0, 0, '#ecfdf5'], [1, 0, '#6ee7b7'], [0, 1, '#34d399'], [1, 1, '#10b981'], [1, 2, '#047857']] },
        { x: 6, y: 9, pixels: [[1, 0, '#ecfdf5'], [0, 1, '#6ee7b7'], [1, 1, '#34d399'], [2, 1, '#059669'], [1, 2, '#047857'], [2, 2, '#064e3b']] },
        { x: 11, y: 12, pixels: [[0, 0, '#ecfdf5'], [1, 0, '#34d399'], [0, 1, '#10b981'], [1, 1, '#047857']] },
        { x: 2, y: 10, pixels: [[1, 0, '#ecfdf5'], [0, 1, '#6ee7b7'], [1, 1, '#10b981'], [0, 2, '#047857']] }
      ];

      for (const cl of clusters) {
        for (const [dx, dy, color] of cl.pixels) {
          ctx.fillStyle = color;
          ctx.fillRect(cl.x + dx, cl.y + dy, 1, 1);
        }
      }
    });
  }

  createCrackStage(stage) {
    // 10 progressive crack stages (0 to 9) matching authentic Minecraft break progression
    // Cracks are black with subtle white/gray translucent edge highlights on transparent background
    const CRACK_DELTA = [
      // Stage 0: tiny center start
      [[7, 7], [8, 7], [7, 8], [8, 8]],
      // Stage 1: branching outward slightly
      [[6, 7], [9, 8], [7, 6], [8, 9]],
      // Stage 2: forming center fissure
      [[5, 6], [6, 6], [9, 9], [10, 9], [8, 5]],
      // Stage 3: branches reaching toward corners
      [[4, 5], [5, 5], [10, 10], [11, 10], [9, 5], [6, 9]],
      // Stage 4: diagonal fissure growth
      [[3, 4], [4, 4], [11, 11], [12, 11], [10, 4], [11, 3], [5, 10], [5, 11]],
      // Stage 5: connecting lateral fractures
      [[2, 3], [3, 3], [12, 12], [13, 12], [12, 3], [13, 2], [4, 12], [3, 13], [8, 6], [9, 7]],
      // Stage 6: widespread web
      [[1, 3], [2, 2], [13, 13], [14, 12], [12, 1], [13, 1], [2, 14], [3, 14], [6, 8], [9, 10], [10, 6], [5, 9]],
      // Stage 7: deep structural breaks
      [[0, 2], [1, 1], [14, 14], [15, 13], [13, 0], [14, 0], [1, 15], [2, 15], [7, 4], [8, 11], [11, 7], [4, 8]],
      // Stage 8: heavy shattering across 65% of block
      [[5, 2], [6, 2], [10, 13], [11, 13], [2, 7], [2, 8], [13, 7], [13, 8], [4, 10], [11, 8], [7, 12], [8, 3], [1, 9], [14, 6]],
      // Stage 9: terminal shattering across 80%+ of block
      [[4, 1], [5, 1], [10, 14], [11, 14], [1, 7], [1, 8], [14, 7], [14, 8], [3, 9], [12, 6], [6, 13], [9, 2], [6, 4], [9, 11], [0, 8], [15, 7], [8, 0], [7, 15]]
    ];

    return this.createCanvas((ctx) => {
      // Clear transparent
      ctx.clearRect(0, 0, 16, 16);

      const clampedStage = Math.max(0, Math.min(9, stage));

      // Collect all pixels up to current stage
      const crackPixels = new Set();
      for (let s = 0; s <= clampedStage; s++) {
        for (const [x, y] of CRACK_DELTA[s]) {
          crackPixels.add(`${x},${y}`);
        }
      }

      // Draw faint highlight borders around cracks for 3D depth
      ctx.fillStyle = 'rgba(255, 255, 255, 0.35)';
      for (const key of crackPixels) {
        const [x, y] = key.split(',').map(Number);
        // Highlight bottom-right neighbors if they are not crack pixels
        if (x + 1 < 16 && !crackPixels.has(`${x + 1},${y}`)) {
          ctx.fillRect(x + 1, y, 1, 1);
        }
        if (y + 1 < 16 && !crackPixels.has(`${x},${y + 1}`)) {
          ctx.fillRect(x, y + 1, 1, 1);
        }
      }

      // Draw dark fracture core
      ctx.fillStyle = 'rgba(15, 23, 42, 0.95)'; // Deep charcoal-black
      for (const key of crackPixels) {
        const [x, y] = key.split(',').map(Number);
        ctx.fillRect(x, y, 1, 1);
      }
    });
  }
}

