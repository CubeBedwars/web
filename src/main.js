import { GameManager } from './game/GameManager.js';

window.addEventListener('DOMContentLoaded', () => {
  const game = new GameManager();

  let selectedMode = 'solo';

  // 1. Mode Selector Pills
  const modePills = document.querySelectorAll('.mode-pill');
  modePills.forEach(pill => {
    pill.addEventListener('click', () => {
      modePills.forEach(p => p.classList.remove('active'));
      pill.classList.add('active');
      selectedMode = pill.dataset.mode;
    });
  });

  // 2. Play Solo vs AI
  document.getElementById('btn-play-ai')?.addEventListener('click', () => {
    game.sound.init();
    game.sound.resume();
    game.isMultiplayer = false;
    game.startMatch(selectedMode, true);
  });

  // 3. Launch Bedwars Studio (3D Map Editor)
  document.getElementById('btn-open-studio')?.addEventListener('click', () => {
    game.sound.init();
    game.sound.resume();
    game.studioEditor.open();
  });

  // 4. Multiplayer Modal & Actions
  const multiModal = document.getElementById('multiplayer-modal');
  const hostView = document.getElementById('lobby-host-view');
  const joinView = document.getElementById('lobby-join-view');
  const roomCodeDisplay = document.getElementById('display-room-code');
  const peerCountEl = document.getElementById('peer-count');
  const peersListEl = document.getElementById('peers-list');

  // Host Room Button
  document.getElementById('btn-host-multi')?.addEventListener('click', () => {
    game.sound.init();
    game.sound.resume();
    multiModal.classList.remove('hidden');
    hostView.classList.remove('hidden');
    joinView.classList.add('hidden');
    roomCodeDisplay.innerText = 'CREATING...';

    game.network.createRoom((roomCode) => {
      roomCodeDisplay.innerText = roomCode;
      updatePeerList();
    }, (err) => {
      alert('Failed to initialize WebRTC Peer: ' + err.message);
    });
  });

  // Join Room Button
  document.getElementById('btn-join-multi')?.addEventListener('click', () => {
    game.sound.init();
    game.sound.resume();
    multiModal.classList.remove('hidden');
    hostView.classList.add('hidden');
    joinView.classList.remove('hidden');
  });

  // Connect Button in Join View
  document.getElementById('btn-connect-room')?.addEventListener('click', () => {
    const inputCode = document.getElementById('input-join-code').value.trim();
    const statusMsg = document.getElementById('join-status-msg');

    if (!inputCode) {
      statusMsg.innerText = 'Please enter a valid room code!';
      statusMsg.style.color = '#ff3366';
      return;
    }

    statusMsg.innerText = 'Connecting via WebRTC...';
    statusMsg.style.color = '#00f0ff';

    game.network.joinRoom(inputCode, () => {
      statusMsg.innerText = 'Connected! Entering match...';
      statusMsg.style.color = '#00f59b';
      game.isMultiplayer = true;
      setTimeout(() => {
        multiModal.classList.add('hidden');
        game.startMatch('solo', false); // client joins host without local bots
      }, 1000);
    }, (err) => {
      statusMsg.innerText = 'Connection error: ' + err.message;
      statusMsg.style.color = '#ff3366';
    });
  });

  // Copy Room Code & Link
  document.getElementById('btn-copy-code')?.addEventListener('click', () => {
    const code = roomCodeDisplay.innerText;
    navigator.clipboard.writeText(code);
    alert(`Room Code copied: ${code}`);
  });

  document.getElementById('btn-copy-link')?.addEventListener('click', () => {
    const code = roomCodeDisplay.innerText;
    const link = `${window.location.origin}${window.location.pathname}#room=${code}`;
    navigator.clipboard.writeText(link);
    alert(`Invite link copied to clipboard!\n${link}`);
  });

  // Start Multiplayer Match Button (Host only)
  document.getElementById('btn-start-multi-match')?.addEventListener('click', () => {
    game.isMultiplayer = true;
    multiModal.classList.add('hidden');
    game.startMatch(selectedMode, false);
  });

  // Close Lobby Modal
  document.getElementById('btn-close-lobby')?.addEventListener('click', () => {
    multiModal.classList.add('hidden');
  });

  // Rematch and Main Menu from Game Over
  document.getElementById('btn-gov-rematch')?.addEventListener('click', () => {
    game.startMatch(selectedMode, !game.isMultiplayer);
  });

  document.getElementById('btn-gov-menu')?.addEventListener('click', () => {
    game.openMainMenu();
  });

  function updatePeerList() {
    if (!peersListEl) return;
    peersListEl.innerHTML = '';
    const peers = game.network.connectedPeers;
    peerCountEl.innerText = peers.length;

    for (const p of peers) {
      const row = document.createElement('div');
      row.className = 'peer-row';
      row.innerHTML = `
        <span><b>${p.name}</b> ${p.isHost ? '(Host)' : ''}</span>
        <span class="badge" style="color: #00f0ff">Connected</span>
      `;
      peersListEl.appendChild(row);
    }
  }

  // Auto-connect if URL contains hash e.g. #room=BW-XXXX
  if (window.location.hash.includes('room=')) {
    const match = window.location.hash.match(/room=([A-Za-z0-9-]+)/);
    if (match && match[1]) {
      const roomCode = match[1];
      document.getElementById('input-join-code').value = roomCode;
      document.getElementById('btn-join-multi')?.click();
      document.getElementById('btn-connect-room')?.click();
    }
  }
});
