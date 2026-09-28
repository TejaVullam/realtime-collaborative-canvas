# WebSocket Protocol & Infrastructure Specification

> [!NOTE]
> **Status: Implemented (Day 6)**. This document specifies the real-time WebSocket communication layer, message envelopes, authentication, room lifecycle, reconnection semantics, error handling, collaborative canvas operation broadcasting, and synchronization protocol (`SYNC_REQUEST`, `SYNC_RESPONSE`, `SYNC_REQUIRED`) established on Days 4–6. Long-term snapshot and operation history persistence is planned for Day 8.

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

#### 7. `CANVAS_OPERATION` (Client → Server)
Emitted by clients to submit a local canvas mutation for server validation and room broadcast.
```json
{
  "type": "CANVAS_OPERATION",
  "requestId": "req_op_1",
  "payload": {
    "operationId": "op_create_1727400000",
    "canvasId": "6ab83470c22dd7c320651219",
    "type": "CREATE_OBJECT",
    "objectId": "rect_987",
    "timestamp": 1727400000123,
    "clientId": "client_tab_uuid",
    "payload": {
      "object": {
        "id": "rect_987",
        "type": "rectangle",
        "x": 100,
        "y": 150,
        "width": 200,
        "height": 100,
        "fill": "#38bdf822",
        "stroke": "#38bdf8",
        "strokeWidth": 2,
        "rotation": 0,
        "scaleX": 1,
        "scaleY": 1,
        "opacity": 1,
        "zIndex": 0,
        "createdAt": 1727400000123,
        "updatedAt": 1727400000123,
        "createdBy": "user_id"
      }
    }
  }
}
```

#### 8. `CANVAS_OPERATION` (Server → Remote Clients Broadcast)
Broadcast to all other connected room members (excluding the originating sender). Contains authoritative `serverSequence`, `serverTimestamp`, and server-bound `userId`.
```json
{
  "type": "CANVAS_OPERATION",
  "payload": {
    "operationId": "op_create_1727400000",
    "canvasId": "6ab83470c22dd7c320651219",
    "type": "CREATE_OBJECT",
    "objectId": "rect_987",
    "timestamp": 1727400000123,
    "clientId": "client_tab_uuid",
    "userId": "6ab8344cc22dd7c320651218",
    "serverSequence": 42,
    "serverTimestamp": 1727400000130,
    "payload": { ... }
  }
}
```

#### 9. `CANVAS_OPERATION_ACK` (Server → Sender Client)
Acknowledges to the originating sender that the operation was validated, recorded, assigned a canonical sequence number, and broadcast.
```json
{
  "type": "CANVAS_OPERATION_ACK",
  "requestId": "req_op_1",
  "payload": {
    "operationId": "op_create_1727400000",
    "serverSequence": 42,
    "serverTimestamp": 1727400000130
  }
}
```

#### 10. `SYNC_REQUEST` (Client → Server)
Emitted by clients upon reconnecting or detecting a sequence gap ($S > S_{last} + 1$) to request missing canonical operations.
```json
{
  "type": "SYNC_REQUEST",
  "requestId": "req_sync_1",
  "payload": {
    "canvasId": "6ab83470c22dd7c320651219",
    "sinceSequence": 41
  }
}
```

#### 11. `SYNC_RESPONSE` (Server → Client)
Returns all ordered canonical operations recorded in the server's history since `sinceSequence`.
```json
{
  "type": "SYNC_RESPONSE",
  "requestId": "req_sync_1",
  "payload": {
    "canvasId": "6ab83470c22dd7c320651219",
    "fromSequence": 42,
    "toSequence": 48,
    "operations": [
      {
        "operationId": "op_create_1727400000",
        "canvasId": "6ab83470c22dd7c320651219",
        "type": "CREATE_OBJECT",
        "objectId": "rect_987",
        "timestamp": 1727400000123,
        "clientId": "client_tab_uuid",
        "userId": "6ab8344cc22dd7c320651218",
        "serverSequence": 42,
        "serverTimestamp": 1727400000130,
        "payload": { ... }
      }
    ]
  }
}
```

#### 12. `SYNC_REQUIRED` (Server → Client)
Emitted when a client requests synchronization for a sequence that has already been purged from the server's in-memory bounded history ($>1,000$ operations ago), signaling that the client state has diverged.
```json
{
  "type": "SYNC_REQUIRED",
  "payload": {
    "canvasId": "6ab83470c22dd7c320651219",
    "serverSequence": 1500,
    "reason": "Requested sequence 41 is older than retained history window"
  }
}
```

#### 13. `CANVAS_OPERATION_ERROR` (Server → Sender Client)
Returned when an operation fails runtime envelope or payload validation, duplicate checks, or authorization.
```json
{
  "type": "CANVAS_OPERATION_ERROR",
  "requestId": "req_op_1",
  "payload": {
    "operationId": "op_create_1727400000",
    "code": "INVALID_OPERATION_PAYLOAD",
    "message": "Rectangle object must have non-negative width and height"
  }
}
```

#### 14. `ERROR` (Server → Client)
Structured error responses for general protocol or envelope violations.
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
| `NOT_IN_ROOM` | 400 | Attempted operation or `LEAVE_ROOM` when socket was not joined to any room |
| `INVALID_OPERATION` | 400 | Missing required operation fields (`operationId`, `objectId`, `clientId`, `timestamp`) |
| `INVALID_OPERATION_TYPE` | 400 | Operation `type` is not one of the allowed canvas operation types |
| `INVALID_OPERATION_PAYLOAD`| 400 | Operation payload fails shape-specific structural validation |
| `DUPLICATE_OPERATION` | 409 | Operation with the same `operationId` was already processed |
| `SERVER_ERROR` | 500 | Unhandled internal database or server error |

---

## 7. Heartbeat & Liveness

1. **Protocol Mechanism**: Server runs an interval check every 30 seconds (`HEARTBEAT_INTERVAL_MS = 30000`).
2. **Ping / Pong**: For every active client socket, the server emits a native WebSocket ping frame (`ws.ping()`) and clears `ctx.isAlive = false`.
3. **Keepalive**: When the client responds with a native pong frame, `ws.on('pong')` marks `ctx.isAlive = true`.
4. **Dead Connection Pruning**: If a client fails to respond before the next tick (`ctx.isAlive === false`), the server forcibly terminates the dead socket (`ws.terminate()`), cleans up references in `RoomManager`, and clears context maps.

---

## 8. Client Lifecycle & Reconnection Strategy (Hardened in Day 4.1)

The client-side architecture enforces a strict architectural separation between **Connection Lifecycle** and **Room Lifecycle**:

```text
                    CONNECTION LIFECYCLE                         ROOM LIFECYCLE
               ┌──────────────────────────────┐           ┌──────────────────────────────┐
               │  Mount / Token available     │           │  Active Room Context (roomId)│
               │             ↓                │           │             ↓                │
               │          CONNECT             │           │        JOIN_ROOM(id)         │
               │             ↓                │           │             ↓                │
               │          CONNECTED           │           │         ROOM_JOINED          │
               │             ↓                │           │             ↓                │
               │      Network Failure         │           │   (Room Identity Retained)   │
               │             ↓                │           │             ↓                │
               │        RECONNECTING          │           │     (No LEAVE_ROOM sent)     │
               │             ↓                │           │             ↓                │
               │          CONNECT             │           │             ↓                │
               │             ↓                │           │             ↓                │
               │          CONNECTED ──────────┼──────────►│    Automatic Room Rejoin     │
               │                              │           │    JOIN_ROOM(currentRoom)    │
               │                              │           │             ↓                │
               │                              │           │         ROOM_JOINED          │
               └──────────────────────────────┘           └──────────────────────────────┘

                          EXPLICIT DISCONNECT (Unmount / Logout / Leave Room)
                                                ↓
                                      client.disconnect()
                                                ↓
                                      Cancel Reconnect Timers
                                                ↓
                                      Close Physical Socket
                                                ↓
                                      Clean Socket Listeners
                                                ↓
                                      Clear Active Room State
```

### 8.1 Reconnection Algorithm
The `WebSocketClient` uses bounded exponential backoff with jitter:

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
  - Network drop: `connected` → `reconnecting` → retry timer → `connecting` → `connected`
  - Exhaustion: `reconnecting` → `error` ("Maximum reconnection attempts reached")

### 8.2 Room Identity Retention on Network Drop
When a physical socket drops unexpectedly:
1. `isExplicitDisconnect` is `false`.
2. Socket event listeners are detached to prevent memory leaks and zombie events.
3. `joinedRoomId` is reset to `null` because the server-side socket is gone.
4. **`currentRoomId` is retained**: The client preserves the active room identity.
5. The React `useWebSocket` hook decouples room membership from `status`. Transitioning from `connected` to `reconnecting` **does not** run room cleanup or call `leaveRoom()`.
6. Upon receiving the `CONNECTED` handshake on the re-established connection, the client checks if `currentRoomId` exists and re-issues `JOIN_ROOM` automatically.

### 8.3 Duplicate Join Protection
The client tracks both `currentRoomId` (the room the user intends to be in) and `joinedRoomId` (the room acknowledged by the server on the active socket). If `joinRoom(roomId)` is invoked while already in and acknowledged for that room, duplicate network messages are suppressed.

### 8.4 Room Switching
When a user switches rooms (`Room A → Room B`):
1. `leaveRoom('Room A')` is transmitted if the socket is open.
2. `joinedRoomId` is cleared.
3. `currentRoomId` is set to `'Room B'`.
4. `JOIN_ROOM('Room B')` is transmitted.
5. A socket is never simultaneously associated with two different rooms.

### 8.5 Explicit Disconnect (Unmount & Logout)
When the user navigates away from the canvas (e.g., returning to the Dashboard) or logs out:
1. `Canvas` unmounts, triggering `useWebSocket` effect cleanup which calls `client.disconnect()`.
2. `AuthContext.logout()` explicitly calls `defaultWebSocketClient.disconnect()`.
3. `isExplicitDisconnect` is set to `true` and `token` is set to `null`.
4. Any active or scheduled reconnect timer is immediately cleared.
5. Socket event listeners (`onopen`, `onmessage`, `onerror`, `onclose`) are set to `null` and the socket is closed with standard code 1000 ("Client closed connection").
6. `currentRoomId` and `joinedRoomId` are reset to `null`.
7. Zero reconnect attempts occur after explicit disconnect.

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
