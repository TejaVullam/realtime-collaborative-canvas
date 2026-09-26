# WebSocket Protocol & Infrastructure Specification

> [!NOTE]
> **Status: Implemented (Day 4)**. This document specifies the real-time WebSocket communication layer, message envelopes, authentication, room lifecycle, reconnection semantics, and error handling established on Day 4. Collaborative canvas operations (`CanvasOperation`) and CRDT/OT synchronization are planned for Days 5–6.

---

## 1. Architectural Overview

The WebSocket infrastructure provides a bidirectional, authenticated, low-latency transport layer connecting active browser clients to the backend server. It operates alongside the Express REST API on the same Node.js HTTP server instance (port 5000), handling requests directed to `/ws`.

```text
                             ┌──────────────┐
                             │  Web Client  │
                             └──────┬───────┘
                                    │
                               REST │ WebSocket
                               Auth │ Upgrade Handshake (/ws?token=...)
                                    ▼
                         ┌─────────────────────┐
                         │  Node HTTP Server   │
                         │     (Port 5000)     │
                         └──────┬───────┬──────┘
                                │       │
                    HTTP Routes │       │ /ws Upgrade
                                ▼       ▼
                         ┌─────────┐ ┌───────────────┐
                         │ Express │ │ WebSocket Svr │
                         │ REST API│ │  (`ws` lib)   │
                         └─────────┘ └───────┬───────┘
                                             │
                                     JWT Verification
                                             │
                                             ▼
                                     ┌───────────────┐
                                     │  RoomManager  │
                                     │  (In-Memory)  │
                                     └───────┬───────┘
                                             │
                              ┌──────────────┴──────────────┐
                              ▼                             ▼
                      ┌───────────────┐             ┌───────────────┐
                      │ Room Socket A │             │ Room Socket B │
                      └───────────────┘             └───────────────┘
```

---

## 2. Connection Lifecycle & Handshake

The complete connection lifecycle progresses through the following deterministic phases:

```text
 1. HTTP Upgrade Handshake (/ws?token=<jwt>)
            │
            ├─ Invalid / Expired Token / Missing ──► HTTP 401 Unauthorized (Connection Closed)
            │
            ▼
 2. Connection Established (`wss.on('connection')`)
            │
            ▼
 3. Server issues `CONNECTED` envelope { socketId, userId, user }
            │
            ▼
 4. Client sends `JOIN_ROOM` { roomId }
            │
            ├─ Room Not Found ───────────► `ERROR`: ROOM_NOT_FOUND
            ├─ Not a MongoDB Member ────► `ERROR`: ROOM_ACCESS_DENIED
            │
            ▼
 5. Server issues `ROOM_JOINED` { roomId, userId }
            │
            ▼
 6. Active Session (Heartbeat Ping/Pong every 30s)
            │
            ▼
 7. `LEAVE_ROOM` / Disconnect (Socket cleanup in RoomManager)
```

---

## 3. WebSocket Authentication & Security

### 3.1 Token Transmission
Browser `WebSocket` implementations do not permit sending custom HTTP headers (such as `Authorization: Bearer <token>`) during the initial upgrade handshake. Authentication tokens are therefore transmitted via the query parameter:
```text
ws://localhost:5000/ws?token=<jwt_token>
```
For non-browser clients (such as automated tests or microservices), the server also accepts:
- `Authorization: Bearer <token>`
- `Sec-WebSocket-Protocol: <token>`

### 3.2 Single Source of Truth for JWT Verification
Authentication over WebSocket reuses the exact same verification logic as the REST API (`AuthService.verifyToken()`):
1. The token is parsed and HMAC-SHA256 signature is verified against `config.jwtSecret`.
2. The user is looked up via `AuthService.getUserById(payload.userId)`.
3. If the token is missing, expired, altered, or references a deleted user, the upgrade request is rejected immediately with `HTTP 401 Unauthorized`.
4. **Security Discipline**: Authentication tokens and sensitive credentials are **never logged** at any point in the server lifecycle.

### 3.3 Socket Context
Each successfully authenticated connection is encapsulated into an in-memory context:

```typescript
export interface AuthenticatedSocketContext {
  socketId: string;
  userId: string;
  user: SafeUser;
  connectedAt: number;
  currentRoomId?: string;
  isAlive: boolean;
}
```

The user identity stored in the socket context is immutable and derived strictly from the verified JWT. Clients can never forge or claim another `userId`.

---

## 4. Room Membership Distinction

A critical architectural distinction is maintained between persistent database records and active socket connections:

| Aspect | MongoDB `Room` Model | WebSocket `RoomManager` |
|---|---|---|
| **Nature** | Persistent database document in MongoDB | Ephemeral, in-memory Map of active socket sets |
| **Lifecycle** | Created via REST `POST /api/rooms`, stored permanently | Created when first socket joins; deleted when last socket leaves |
| **Purpose** | Authoritative room ownership, membership list, canvasId | Real-time broadcast channel routing for active clients |
| **Join Requirement** | Requires invite or joining via REST `joinRoom()` | Requires authenticated socket **AND** existing MongoDB membership |
| **Leaving** | REST `leaveRoom()` removes user from persistent membership | Socket `LEAVE_ROOM` un-subscribes socket from real-time events |

---

## 5. Message Envelope & Typed Contracts

Every message exchanged across the WebSocket boundary follows a standard structured envelope:

```typescript
export interface BaseWebSocketMessage<T = unknown> {
  type: string;
  requestId?: string; // Optional request ID for correlation and debugging
  payload: T;
}
```

### 5.1 Infrastructure Message Contracts (Day 4)

#### 1. `CONNECTED` (Server → Client)
Dispatched immediately upon successful connection establishment.
```json
{
  "type": "CONNECTED",
  "payload": {
    "socketId": "7744b51e-ba14-4035-8b98-c3cefec99bf1",
    "userId": "6ab8344cc22dd7c320651218",
    "user": {
      "id": "6ab8344cc22dd7c320651218",
      "name": "Alice Collab",
      "email": "alice.collab@example.com"
    }
  }
}
```

#### 2. `JOIN_ROOM` (Client → Server)
Requests association with a collaborative room broadcast channel.
```json
{
  "type": "JOIN_ROOM",
  "requestId": "req_123",
  "payload": {
    "roomId": "6ab83470c22dd7c320651219"
  }
}
```

#### 3. `ROOM_JOINED` (Server → Client)
Confirms successful room subscription after database membership validation.
```json
{
  "type": "ROOM_JOINED",
  "requestId": "req_123",
  "payload": {
    "roomId": "6ab83470c22dd7c320651219",
    "userId": "6ab8344cc22dd7c320651218"
  }
}
```

#### 4. `LEAVE_ROOM` (Client → Server)
Requests disconnection from the room broadcast channel.
```json
{
  "type": "LEAVE_ROOM",
  "requestId": "req_124",
  "payload": {
    "roomId": "6ab83470c22dd7c320651219"
  }
}
```

#### 5. `ROOM_LEFT` (Server → Client)
Confirms un-subscription from room broadcast.
```json
{
  "type": "ROOM_LEFT",
  "requestId": "req_124",
  "payload": {
    "roomId": "6ab83470c22dd7c320651219"
  }
}
```

#### 6. `PING` / `PONG` (Application-level Heartbeat)
```json
// Client -> Server
{ "type": "PING", "requestId": "req_125", "payload": {} }

// Server -> Client
{ "type": "PONG", "requestId": "req_125", "payload": { "timestamp": 1727400000000 } }
```

#### 7. `ERROR` (Server → Client)
Structured error responses for protocol or validation violations.
```json
{
  "type": "ERROR",
  "requestId": "req_123",
  "payload": {
    "code": "ROOM_ACCESS_DENIED",
    "message": "You are not a member of this room"
  }
}
```

---

## 6. Error Codes

| Error Code | HTTP Equiv | Description |
|---|---|---|
| `UNAUTHENTICATED` | 401 | Connection or action attempted without a valid JWT |
| `INVALID_MESSAGE` | 400 | Malformed JSON, non-object envelope, or missing type property |
| `UNKNOWN_MESSAGE_TYPE`| 400 | Received a message `type` not recognized by the server |
| `INVALID_ROOM_ID` | 400 | `roomId` is missing or not a valid 24-character hex ObjectId |
| `ROOM_NOT_FOUND` | 404 | Specified `roomId` does not exist in MongoDB |
| `ROOM_ACCESS_DENIED` | 403 | User is not in the room's persistent `members` list |
| `NOT_IN_ROOM` | 400 | Attempted `LEAVE_ROOM` when socket was not joined to any room |
| `SERVER_ERROR` | 500 | Unhandled internal database or server error |

---

## 7. Heartbeat & Liveness

1. **Protocol Mechanism**: Server runs an interval check every 30 seconds (`HEARTBEAT_INTERVAL_MS = 30000`).
2. **Ping / Pong**: For every active client socket, the server emits a native WebSocket ping frame (`ws.ping()`) and clears `ctx.isAlive = false`.
3. **Keepalive**: When the client responds with a native pong frame, `ws.on('pong')` marks `ctx.isAlive = true`.
4. **Dead Connection Pruning**: If a client fails to respond before the next tick (`ctx.isAlive === false`), the server forcibly terminates the dead socket (`ws.terminate()`), cleans up references in `RoomManager`, and clears context maps.

---

## 8. Client Reconnection Strategy

The client-side `WebSocketClient` implements a controlled, bounded reconnection algorithm:

```typescript
delay = min(baseDelay * 2^attempts, maxDelay)
jitter = delay * 0.2 * rand(-1, 1)
finalDelay = max(baseDelay * 0.5, delay + jitter)
```

- **Base delay**: 1,000 ms
- **Max delay**: 16,000 ms
- **Max attempts**: 10 attempts
- **Jitter**: ±20% randomization to prevent thundering herd spikes
- **State Progression**:
  - Normal disconnect: `connected` → `disconnected`
  - Network drop: `connected` → `reconnecting` → retry timer → `connected`
  - Exhaustion: `reconnecting` → `error` ("Maximum reconnection attempts reached")
- **Room Auto-Rejoin**: Upon establishing a new connection after a drop, the client automatically re-transmits `JOIN_ROOM` for its previously active room.
- **Explicit Disconnect**: When the user navigates back to the Dashboard or logs out, `client.disconnect()` sets `isExplicitDisconnect = true`, cancelling any pending reconnection attempts immediately.

---

## 9. Message Size Protection

The WebSocket server enforces a strict payload limit of **64 KB** (`maxPayload: 64 * 1024`). Since Day 4 infrastructure control messages are under 1 KB, this protects the server from buffer overflow or denial-of-service attempts.

---

## 10. Future Collaboration Messages (Planned for Day 5)

The following message types are reserved for the collaborative canvas engine and will be introduced on Day 5:

| Message Type | Direction | Description |
|---|---|---|
| `CREATE_OBJECT` | Bi-directional | Announces structured canvas object creation (`CanvasObject`) |
| `UPDATE_OBJECT` | Bi-directional | Broadcasts object property updates |
| `DELETE_OBJECT` | Bi-directional | Broadcasts object deletion |
| `MOVE_OBJECT` | Bi-directional | Broadcasts position translation |
| `CURSOR_UPDATE` | Bi-directional | Ephemeral pointer coordinate stream |
| `SYNC_STATE` | Server → Client | Full canvas snapshot catch-up for newly joined clients |
