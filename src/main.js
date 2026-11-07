import { GameManager } from './game/GameManager.js';
import { PortalUI } from './ui/PortalUI.js';
import { BLOCK_TYPES } from './engine/VoxelWorld.js';

window.addEventListener('DOMContentLoaded', () => {
  const game = new GameManager();
  const portal = new PortalUI(game);
  game.portal = portal;

  // 1. Main Menu Play Actions
  document.getElementById('btn-play-solo')?.addEventListener('click', () => {
    game.startMatch('solo', true, 'solo');
  });

  document.getElementById('btn-play-rush')?.addEventListener('click', () => {
    game.mapPreset.generators.forEach(g => { g.interval /= 2; });
    game.startMatch('rush', true);
  });

  document.getElementById('btn-play-lucky')?.addEventListener('click', () => {
    // Generate extra lucky blocks on center island
    game.startMatch('lucky', true);
    for (let x = -4; x <= 4; x += 2) {
      for (let z = -4; z <= 4; z += 2) {
        if (Math.random() > 0.5) {
          game.world.setBlock(x, 21, z, BLOCK_TYPES.LUCKY_BLOCK);
        }
      }
    }
    game.world.rebuildMeshes();
  });

  // 2. Open Bedwars Studio (3D Map Editor)
  document.getElementById('btn-open-studio')?.addEventListener('click', () => {
    game.sound.init();
    game.sound.resume();
    game.studioEditor.open();
  });

  // 3. Studio Toolbar Controls
  document.querySelectorAll('.studio-block-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.studio-block-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      const bType = parseInt(btn.dataset.block);
      game.studioEditor.selectedBlock = bType;
      game.studioEditor.entityToPlace = null;
      game.studioEditor.brushMode = 'single';
    });
  });

  document.querySelectorAll('.studio-tool-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.studio-tool-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      const tool = btn.dataset.tool;
      if (tool === 'erase') {
        game.studioEditor.brushMode = 'erase';
        game.studioEditor.entityToPlace = null;
      } else if (tool === '3x3') {
        game.studioEditor.brushMode = '3x3';
        game.studioEditor.entityToPlace = null;
      } else if (tool === 'single') {
        game.studioEditor.brushMode = 'single';
        game.studioEditor.entityToPlace = null;
      }
    });
  });

  document.querySelectorAll('.studio-entity-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.studio-entity-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      game.studioEditor.entityToPlace = btn.dataset.entity;
    });
  });

  document.getElementById('btn-studio-export')?.addEventListener('click', () => {
    game.studioEditor.exportMapJSON();
  });

  document.getElementById('btn-studio-import')?.addEventListener('click', () => {
    document.getElementById('studio-file-input')?.click();
  });

  document.getElementById('studio-file-input')?.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (ev) => game.studioEditor.importMapJSON(ev.target.result);
      reader.readAsText(file);
    }
  });

  document.getElementById('btn-studio-test')?.addEventListener('click', () => {
    game.studioEditor.testPlay();
  });

  document.getElementById('btn-studio-exit')?.addEventListener('click', () => {
    game.studioEditor.close();
    document.getElementById('main-menu')?.classList.remove('hidden');
    document.getElementById('crosshair')?.classList.add('hidden');
  });

  // 4. Multiplayer Modal Actions
  const multiModal = document.getElementById('multiplayer-modal');
  const roomCodeDisplay = document.getElementById('display-room-code');

  document.getElementById('btn-open-multi')?.addEventListener('click', () => {
    multiModal.classList.remove('hidden');
  });

  document.getElementById('btn-close-multi')?.addEventListener('click', () => {
    multiModal.classList.add('hidden');
  });

  document.getElementById('btn-host-room')?.addEventListener('click', () => {
    roomCodeDisplay.innerText = 'GENERATING ROOM...';
    game.network.createRoom((code) => {
      roomCodeDisplay.innerText = `ROOM CODE: ${code}`;
      alert(`Room Created! Share code: ${code}`);
      multiModal.classList.add('hidden');
      game.startMatch('solo', false); // Start without bots, waiting for players
    }, (err) => {
      alert('Error creating WebRTC Peer: ' + err.message);
    });
  });

  document.getElementById('btn-join-room')?.addEventListener('click', () => {
    const code = document.getElementById('input-room-code')?.value.trim();
    if (!code) {
      alert('Please enter a valid room code!');
      return;
    }
    game.network.joinRoom(code, () => {
      alert(`Connected to Room ${code}!`);
      multiModal.classList.add('hidden');
      game.startMatch('solo', false);
    }, (err) => {
      alert('Failed to connect to room: ' + err.message);
    });
  });

  // 5. Game Over Rematch Actions
  document.getElementById('btn-gameover-rematch')?.addEventListener('click', () => {
    document.getElementById('gameover-overlay')?.classList.add('hidden');
    game.startMatch(game.matchFormat || 'solo', true, game.matchFormat || 'solo');
  });

  document.getElementById('btn-gameover-menu')?.addEventListener('click', () => {
    document.getElementById('gameover-overlay')?.classList.add('hidden');
    game.hud.hide();
    portal.update();
    document.getElementById('main-menu')?.classList.remove('hidden');
  });
});
