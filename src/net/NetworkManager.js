import { Peer } from 'peerjs';

export class NetworkManager {
  constructor(game) {
    this.game = game;
    this.peer = null;
    this.connections = new Map(); // peerId -> DataConnection
    this.hostConnection = null;
    this.isHost = false;
    this.roomCode = null;
    this.connectedPeers = [];
  }

  // Generate friendly room code
  generateRoomCode() {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let code = 'BW-';
    for (let i = 0; i < 4; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
  }

  // Initialize as Host
  createRoom(onReady, onError) {
    this.roomCode = this.generateRoomCode();
    this.isHost = true;

    try {
      this.peer = new Peer(this.roomCode, {
        debug: 1,
        config: {
          iceServers: [
            { urls: 'stun:stun.l.google.com:19302' },
            { urls: 'stun:global.stun.twilio.com:3478' },
          ],
        },
      });

      this.peer.on('open', (id) => {
        this.roomCode = id;
        this.connectedPeers = [{ id, name: this.game.localPlayer.name, team: 'red', isHost: true }];
        if (onReady) onReady(this.roomCode);
      });

      this.peer.on('connection', (conn) => {
        this.setupConnection(conn);
      });

      this.peer.on('error', (err) => {
        console.error('PeerJS Host Error:', err);
        if (onError) onError(err);
      });
    } catch (e) {
      if (onError) onError(e);
    }
  }

  // Initialize as Client joining a host
  joinRoom(roomCode, onConnected, onError) {
    this.isHost = false;
    this.roomCode = roomCode.trim().toUpperCase();

    try {
      this.peer = new Peer({
        debug: 1,
        config: {
          iceServers: [
            { urls: 'stun:stun.l.google.com:19302' },
            { urls: 'stun:global.stun.twilio.com:3478' },
          ],
        },
      });

      this.peer.on('open', () => {
        const conn = this.peer.connect(this.roomCode, { reliable: true });
        this.hostConnection = conn;

        conn.on('open', () => {
          // Send handshake
          conn.send({
            type: 'HANDSHAKE',
            name: this.game.localPlayer.name,
          });
          if (onConnected) onConnected();
        });

        conn.on('data', (data) => {
          this.handlePacket(data, conn);
        });

        conn.on('close', () => {
          this.game.chat.addSystemMessage('⚠️ Disconnected from room host.');
        });
      });

      this.peer.on('error', (err) => {
        console.error('PeerJS Client Error:', err);
        if (onError) onError(err);
      });
    } catch (e) {
      if (onError) onError(e);
    }
  }

  setupConnection(conn) {
    this.connections.set(conn.peer, conn);

    conn.on('data', (data) => {
      this.handlePacket(data, conn);
    });

    conn.on('close', () => {
      this.connections.delete(conn.peer);
      this.connectedPeers = this.connectedPeers.filter(p => p.id !== conn.peer);
      this.game.onPeerLeave(conn.peer);
    });
  }

  // Broadcast packet to all connected peers
  broadcast(packet) {
    if (this.isHost) {
      for (const conn of this.connections.values()) {
        if (conn.open) conn.send(packet);
      }
    } else if (this.hostConnection && this.hostConnection.open) {
      this.hostConnection.send(packet);
    }
  }

  // Packet receiver
  handlePacket(data, conn) {
    if (!data || !data.type) return;

    switch (data.type) {
      case 'HANDSHAKE':
        if (this.isHost) {
          // Host registers new client
          const newPeer = { id: conn.peer, name: data.name, team: 'blue' };
          this.connectedPeers.push(newPeer);
          
          // Reply with current map state & connected peer list
          conn.send({
            type: 'INIT_STATE',
            mapData: this.game.world.serialize(),
            peers: this.connectedPeers,
          });

          // Notify everyone else
          this.broadcast({
            type: 'PEER_JOINED',
            peer: newPeer,
          });
          this.game.onPeerJoin(newPeer);
        }
        break;

      case 'INIT_STATE':
        this.game.world.deserialize(data.mapData);
        for (const p of data.peers) {
          if (p.id !== this.peer.id) {
            this.game.onPeerJoin(p);
          }
        }
        break;

      case 'PEER_JOINED':
        this.game.onPeerJoin(data.peer);
        break;

      case 'PLAYER_POS':
        this.game.onRemotePlayerMove(data.id, data.pos, data.yaw, data.isMoving);
        if (this.isHost) {
          // Relay to other peers
          for (const [id, c] of this.connections.entries()) {
            if (id !== conn.peer && c.open) c.send(data);
          }
        }
        break;

      case 'BLOCK_SET':
        this.game.world.setBlock(data.x, data.y, data.z, data.blockType);
        if (this.isHost) {
          this.broadcast(data);
        }
        break;

      case 'CHAT':
        this.game.chat.addPlayerMessage(data.sender, data.text, data.team);
        if (this.isHost) {
          this.broadcast(data);
        }
        break;

      case 'BED_DESTROY':
        this.game.handleBedDestroyed(data.teamId, data.breakerName);
        if (this.isHost) {
          this.broadcast(data);
        }
        break;
    }
  }

  sendPlayerPosition(pos, yaw, isMoving) {
    this.broadcast({
      type: 'PLAYER_POS',
      id: this.peer ? this.peer.id : 'local',
      pos: { x: pos.x, y: pos.y, z: pos.z },
      yaw,
      isMoving,
    });
  }

  sendBlockSet(x, y, z, blockType) {
    this.broadcast({
      type: 'BLOCK_SET',
      x, y, z,
      blockType,
    });
  }

  sendChatMessage(sender, text, team) {
    this.broadcast({
      type: 'CHAT',
      sender,
      text,
      team,
    });
  }
}
