# Voxel Bedwars Dedicated Multiplayer & Uptime Server

Production-grade standalone Node.js WebSocket and HTTP service for Voxel Bedwars. Features:
- **HTTP `GET /ping` Healthcheck Endpoint**: Non-WebSocket JSON endpoint engineered for UptimeRobot 5-minute pings to maintain 24/7 continuous container uptime without idling or cold boots.
- **WebSocket Room Management**: Ephemeral alphanumeric room codes (`BW-XXXX`), host migration, and automatic room cleanup.
- **Low-Latency Game State Synchronization**: Real-time packet routing for `BLOCK_PLACE`, `BLOCK_BREAK`, `BED_DESTROY`, `PLAYER_TRANSFORM`, `PLAYER_DAMAGE`, `CHAT_MESSAGE`, and `MUTATION_SYNC`.
- **Dual-Layer Failover Support**: Works seamlessly with client-side WebRTC PeerJS fallback.

---

## 1. Free-Tier 24/7/31-Day Hosting Setup (No Credit Card)

> **Note on Render**: Render is strictly excluded from these recommendations because Render free tiers sleep after 15 minutes of inactivity and impose monthly credit card requirements or hard execution hour caps.

The following non-Render hosting options provide genuine continuous 24/7 operation on free tiers without requiring a credit card:

### Option A: Hugging Face Spaces (Docker) — Recommended
Hugging Face Spaces offers a completely free, 24/7 Docker container runtime with 2 vCPUs and 16 GB RAM with **no credit card required**:
1. Sign up for a free account at [huggingface.co](https://huggingface.co).
2. Click **New Space** (`https://huggingface.co/new-space`).
3. Set:
   - **Space name**: `voxel-bedwars-server`
   - **License**: MIT
   - **Space SDK**: **Docker** (Blank)
   - **Space hardware**: **CPU basic • 2 vCPU • 16 GB • Free**
   - **Visibility**: **Public** (Public Spaces do not sleep and run continuously 24/7).
4. Clone the repository or upload the files from the `server/` directory:
   - `Dockerfile`
   - `package.json`
   - `index.js`
5. Hugging Face Spaces automatically builds the Docker container and exposes port `7860` (or `8080`). Add `PORT=7860` under Settings > Variables and secrets if required.
6. Your live server URL will be: `https://<username>-voxel-bedwars-server.hf.space` with WebSocket endpoint `wss://<username>-voxel-bedwars-server.hf.space`.

---

### Option B: Koyeb (Eco Free Web Service)
Koyeb provides 1 free Eco service per organization with 512 MB RAM, global edge routing, and continuous operation without credit card entry:
1. Sign up at [koyeb.com](https://www.koyeb.com) using GitHub or Google.
2. Select **Create App** > **GitHub** (or **Deploy from Dockerfile**).
3. Select your repository and specify the subfolder `server`.
4. Koyeb automatically detects `Dockerfile` and builds the service.
5. In the Service settings:
   - Port: `8080` (HTTP and WebSocket protocol)
   - Instance: `Free Nano` (512MB RAM)
6. Deploy the service. Koyeb provisions a free SSL domain: `https://<app-name>.koyeb.app`.

---

### Option C: Glitch / Railway (Alternative)
- **Glitch**: Free Node container. Import from GitHub, run `npm start`. Works with UptimeRobot HTTP pings to prevent sleep.
- **Railway**: Free starter project with container deployment.

---

## 2. UptimeRobot 5-Minute Keepalive Monitoring Configuration

To guarantee 100% SLA and prevent cloud hypervisors from idling or putting containers into sleep mode, configure an external HTTP monitor:

1. Create a free account at [uptimerobot.com](https://uptimerobot.com).
2. Click **Add New Monitor**.
3. Configure the monitor fields:
   - **Monitor Type**: `HTTP(s)` (Do NOT use Port or Ping)
   - **Friendly Name**: `Voxel Bedwars Server Ping`
   - **URL (or IP)**: `https://<YOUR-SERVER-DOMAIN>/ping` (e.g. `https://my-bedwars-server.koyeb.app/ping`)
   - **Monitoring Interval**: `Every 5 minutes` (300 seconds)
   - **Monitor Timeout**: `30 seconds`
   - **HTTP Method**: `GET`
4. Click **Create Monitor**.

### Why `/ping` is an HTTP Endpoint:
External monitoring providers (UptimeRobot, BetterUptime, Cron-Job.org) perform standard HTTP GET requests. Because `/ping` returns lightweight JSON (`{ status: "ok", uptime, rooms, timestamp }`) in `< 5ms`, it avoids WebSocket protocol handshake overhead while continuously refreshing container activity counters.

---

## 3. API & Protocol Specification

### HTTP Endpoints
- `GET /ping`:
  ```json
  {
    "status": "ok",
    "uptime": 1420.35,
    "timestamp": 1731000000000,
    "rooms": 2
  }
  ```
- `GET /`:
  ```json
  {
    "name": "voxel-bedwars-server",
    "status": "online",
    "uptime": 1420.35,
    "timestamp": 1731000000000,
    "rooms": 2,
    "activeClients": 6
  }
  ```

### WebSocket Messages
All WebSocket communication uses JSON text frames:

#### Client → Server
- `ROOM_CREATE`: `{ "type": "ROOM_CREATE", "payload": { "format": "4v4", "map": "speedway" } }`
- `ROOM_JOIN`: `{ "type": "ROOM_JOIN", "payload": { "roomCode": "BW-1234", "playerName": "Steve" } }`
- `ROOM_LIST`: `{ "type": "ROOM_LIST" }`
- `BLOCK_PLACE`: `{ "type": "BLOCK_PLACE", "payload": { "x": 10, "y": 20, "z": 5, "blockType": 10 } }`
- `BLOCK_BREAK`: `{ "type": "BLOCK_BREAK", "payload": { "x": 10, "y": 20, "z": 5 } }`
- `BED_DESTROY`: `{ "type": "BED_DESTROY", "payload": { "team": "blue" } }`
- `PLAYER_TRANSFORM`: `{ "type": "PLAYER_TRANSFORM", "payload": { "x": 5.5, "y": 21.0, "z": -2.0, "yaw": 1.57, "pitch": 0.0 } }`
- `PLAYER_DAMAGE`: `{ "type": "PLAYER_DAMAGE", "payload": { "targetId": "c_123", "amount": 6.5 } }`
- `CHAT_MESSAGE`: `{ "type": "CHAT_MESSAGE", "payload": { "text": "GG!" } }`
- `PING`: `{ "type": "PING" }`

#### Server → Client
- `ROOM_CREATED`: `{ "type": "ROOM_CREATED", "payload": { "roomCode": "BW-1234", "hostId": "c_123" } }`
- `ROOM_JOINED`: `{ "type": "ROOM_JOINED", "payload": { "roomCode": "BW-1234", "clientId": "c_456", "snapshot": { ... } } }`
- `PEER_JOINED`: `{ "type": "PEER_JOINED", "payload": { "clientId": "c_456", "playerName": "Steve" } }`
- `PEER_LEFT`: `{ "type": "PEER_LEFT", "payload": { "clientId": "c_456" } }`
- `HOST_MIGRATED`: `{ "type": "HOST_MIGRATED", "payload": { "newHostId": "c_456" } }`
- `PONG`: `{ "type": "PONG", "timestamp": 1731000000000 }`
- `ERROR`: `{ "type": "ERROR", "payload": { "code": "ROOM_NOT_FOUND", "message": "..." } }`

---

## 4. Local Development

Run locally:
```bash
cd server
npm install
npm start
```

Or from project root:
```bash
npm run server
```

The server listens on `http://localhost:8080` (or `process.env.PORT`).
Test the ping endpoint:
```bash
curl http://localhost:8080/ping
```
