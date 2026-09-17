# WebSocket Protocol Specification

> [!WARNING]
> WebSocket functionality is **NOT implemented as of Day 1**. This document outlines the planned protocol architecture and message envelope for future implementation (Days 4–5).

---

## 1. Purpose

The WebSocket transport will provide a bidirectional, low-latency communication channel between active canvas clients and the collaboration server. It is responsible for:
- Streaming real-time canvas state mutations (`CanvasOperation`).
- Broadcasting ephemeral collaborator presence (live mouse cursors, selection highlights).
- Managing room memberships and user connection lifecycles.

---

## 2. Connection Lifecycle

1. **Connection Handshake**: Client initiates standard WebSocket connection to `/ws/collaborate`.
2. **Authentication / Token Exchange**: Client passes connection token or credentials upon connection.
3. **Room Join (`JOIN_ROOM`)**: Client transmits room identifier to subscribe to the room broadcast channel.
4. **Initial Catch-up (`SYNC_STATE`)**: Server responds with the latest canvas state snapshot and missing operation backlog.
5. **Collaborative Session**: Active bidirectional exchange of operations, heartbeats (`PING`/`PONG`), and presence telemetry.
6. **Room Leave / Disconnect (`LEAVE_ROOM` / `CLOSE`)**: Graceful teardown or timeout triggering presence departure notices.

---

## 3. Room Concept

- Every collaborative session is scoped to a specific `roomId`.
- The server isolates broadcast channels per room, preventing operations from leaking between unrelated canvases.
- Multiple browser tabs or users viewing the same `roomId` form a collaborative cluster.

---

## 4. Message Envelope Structure

All messages exchanged over the WebSocket channel will conform to a standard envelope:

```typescript
interface WebSocketMessage<T = unknown> {
  type: string;
  roomId: string;
  clientId: string;
  timestamp: number;
  payload: T;
}
```

---

## 5. Planned Message Types

| Message Type | Direction | Purpose | Payload Example |
|---|---|---|---|
| `JOIN_ROOM` | Client → Server | Requests subscription to a room channel | `{ "roomId": "room_123", "user": { "id": "u1", "name": "Alice" } }` |
| `LEAVE_ROOM` | Client → Server | Gracefully un-subscribes from room | `{ "roomId": "room_123" }` |
| `SYNC_STATE` | Server → Client | Sends baseline state snapshot to client | `{ "canvas": CanvasState, "serverVersion": 14 }` |
| `CREATE_OBJECT` | Bi-directional | Announces new canvas object creation | `{ "operation": CreateObjectOperation }` |
| `UPDATE_OBJECT` | Bi-directional | Transmits property mutation patch | `{ "operation": UpdateObjectOperation }` |
| `DELETE_OBJECT` | Bi-directional | Broadcasts object removal | `{ "operation": DeleteObjectOperation }` |
| `CURSOR_UPDATE`| Bi-directional | Ephemeral pointer coordinate stream | `{ "x": 450, "y": 230, "color": "#3b82f6" }` |
| `ERROR` | Server → Client | Communicates protocol or validation faults | `{ "code": "INVALID_OP", "message": "..." }` |

---

## 6. Error Handling & Reconnection Considerations

- **Idempotency**: Every operation includes a unique `operationId`. The server drops duplicate operations received due to network retries.
- **Heartbeat & Liveness**: Client and server ping/pong every 30 seconds. Connections missing consecutive heartbeats are terminated.
- **Reconnection with Backoff**: Clients will implement exponential backoff with jitter upon unexpected connection termination.
- **Resynchronization Catch-Up**: Upon reconnecting, the client supplies its last processed `version` / sequence number, allowing the server to replay only missed operations rather than sending an entire state dump.
