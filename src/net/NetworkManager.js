import Peer from 'peerjs';

export class NetworkManager {
  constructor(gameManager) {
    this.gm = gameManager;
    this.peer = null;
    this.connections = [];
    this.isHost = false;
    this.roomCode = null;
  }

  createRoom(onSuccess, onError) {
    const code = 'BW-' + Math.floor(1000 + Math.random() * 9000);
    this.isHost = true;
    this.roomCode = code;

    try {
      this.peer = new Peer(code);
      this.peer.on('open', (id) => {
        if (onSuccess) onSuccess(id);
      });

      this.peer.on('connection', (conn) => {
        this.setupConnection(conn);
      });

      this.peer.on('error', (err) => {
        if (onError) onError(err);
      });
    } catch (e) {
      if (onError) onError(e);
    }
  }

  joinRoom(roomCode, onSuccess, onError) {
    this.isHost = false;
    this.roomCode = roomCode;

    try {
      this.peer = new Peer();
      this.peer.on('open', () => {
        const conn = this.peer.connect(roomCode);
        this.setupConnection(conn);
        conn.on('open', () => {
          if (onSuccess) onSuccess();
        });
      });

      this.peer.on('error', (err) => {
        if (onError) onError(err);
      });
    } catch (e) {
      if (onError) onError(e);
    }
  }

  setupConnection(conn) {
    this.connections.push(conn);

    conn.on('data', (data) => {
      this.handlePacket(data, conn);
    });

    conn.on('close', () => {
      this.connections = this.connections.filter(c => c !== conn);
    });
  }

  broadcast(packet) {
    for (const conn of this.connections) {
      if (conn.open) {
        conn.send(packet);
      }
    }
  }

  handlePacket(packet, sender) {
    switch (packet.type) {
      case 'BLOCK_PLACE':
        this.gm.world.setBlock(packet.x, packet.y, packet.z, packet.blockType);
        this.gm.world.rebuildMeshes();
        if (this.isHost) this.broadcast(packet);
        break;

      case 'BLOCK_BREAK':
        this.gm.world.setBlock(packet.x, packet.y, packet.z, 0);
        this.gm.world.rebuildMeshes();
        if (this.isHost) this.broadcast(packet);
        break;

      case 'BED_DESTROY':
        this.gm.teamManager.destroyBed(packet.team);
        if (this.gm.sound) this.gm.sound.playBedDestroyed();
        this.gm.hud.showAnnouncement(`${packet.team.toUpperCase()} BED DESTROYED!`, 'Destroyed by a Player!');
        if (this.isHost) this.broadcast(packet);
        break;
    }
  }
}
