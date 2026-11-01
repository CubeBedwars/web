export class ChatUI {
  constructor(game) {
    this.game = game;
    this.messages = [];
    this.isOpen = false;

    this.container = document.createElement('div');
    this.container.id = 'chat-container';
    this.container.className = 'chat-ui';
    this.container.innerHTML = `
      <div id="chat-messages" class="chat-messages-box"></div>
      <div id="chat-input-bar" class="chat-input-row hidden">
        <span class="chat-channel-badge">[ALL]</span>
        <input type="text" id="chat-input-field" placeholder="Press Enter to send (or /t for team chat)..." maxlength="120">
      </div>
    `;

    document.getElementById('app').appendChild(this.container);

    this.msgBox = document.getElementById('chat-messages');
    this.inputRow = document.getElementById('chat-input-bar');
    this.inputField = document.getElementById('chat-input-field');

    this.initEvents();
  }

  initEvents() {
    window.addEventListener('keydown', (e) => {
      // Press T or Enter to open chat
      if ((e.code === 'KeyT' || e.code === 'Enter') && !this.isOpen) {
        if (!this.game.isMatchRunning) return;
        e.preventDefault();
        this.openChat();
        return;
      }

      if (e.code === 'Escape' && this.isOpen) {
        this.closeChat();
        return;
      }

      if (e.code === 'Enter' && this.isOpen) {
        this.sendMessage();
        this.closeChat();
      }
    });
  }

  openChat() {
    this.isOpen = true;
    this.inputRow.classList.remove('hidden');
    this.inputField.focus();
    if (document.pointerLockElement) {
      document.exitPointerLock();
    }
  }

  closeChat() {
    this.isOpen = false;
    this.inputRow.classList.add('hidden');
    this.inputField.value = '';
    this.inputField.blur();
  }

  sendMessage() {
    const text = this.inputField.value.trim();
    if (!text) return;

    const sender = this.game.localPlayer.name;
    const team = this.game.localPlayer.teamId;

    this.addPlayerMessage(sender, text, team);

    // If in multiplayer, broadcast over WebRTC
    if (this.game.network && this.game.isMultiplayer) {
      this.game.network.sendChatMessage(sender, text, team);
    }
  }

  addPlayerMessage(sender, text, teamId = 'red') {
    const row = document.createElement('div');
    row.className = 'chat-msg';

    const teamDef = this.game.teamManager.getTeam(teamId);
    const color = teamDef ? teamDef.colorHex : '#00f0ff';

    row.innerHTML = `<span class="chat-team-prefix" style="color: ${color}">[${teamId.toUpperCase()}] ${sender}:</span> <span class="chat-text">${this.escapeHTML(text)}</span>`;
    this.msgBox.appendChild(row);
    this.msgBox.scrollTop = this.msgBox.scrollHeight;

    if (this.game.sound) this.game.sound.playChatPop();
  }

  addSystemMessage(text) {
    const row = document.createElement('div');
    row.className = 'chat-msg chat-system';
    row.innerHTML = `<span class="chat-sys-icon">📢</span> <span class="chat-sys-text">${this.escapeHTML(text)}</span>`;
    this.msgBox.appendChild(row);
    this.msgBox.scrollTop = this.msgBox.scrollHeight;
  }

  escapeHTML(str) {
    return str.replace(/[&<>'"]/g, 
      tag => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[tag] || tag)
    );
  }
}
