# Synchronization Strategy

> **Status: Operation-Based Real-Time Collaboration Implemented (Day 5)**.  
> Day 5 implements operation-based message broadcasting between authenticated clients within isolated room boundaries. Advanced conflict resolution (CRDT / OT / LWW convergence) is intentionally scheduled for **Day 6**.

---

## 1. Day 5 Architecture: Operation-Based Real-Time Collaboration

Day 5 introduces the first multi-user synchronization layer using atomic operations (`CanvasOperation`).

```text
                               LOCAL CLIENT (Alice)
                       ┌──────────────────────────────────┐
                       │ User Interaction (Draw/Move/Del) │
                       └─────────────────┬────────────────┘
                                         ▼
                       ┌──────────────────────────────────┐
                       │     Create CanvasOperation       │
                       └─────────┬──────────────────────┬─┘
                                 │                      │
             Immediate Local Apply                      │ Transmit
                                 ▼                      ▼
  ┌─────────────────────────────────────────┐  ┌──────────────────────────────────┐
  │ dispatch({ type: 'APPLY_OPERATION',     │  │ CollaborationService             │
  │            source: 'local', op })       │  │ .sendCanvasOperation(op)         │
  └─────────────────────────────────────────┘  └────────────────┬─────────────────┘
                                                                │
                                                                ▼
                                                       WebSocket Client
                                                                │
                                                                ▼  (CANVAS_OPERATION)
                                                       WebSocket Server
                                                                │
                                                    1. Authenticate & Authorize
                                                    2. Validate Operation & Shape
                                                    3. Check Bounded Duplicates
                                                    4. Bind Server User Identity
                                                                │
                                    ┌───────────────────────────┴───────────────────────────┐
                                    ▼                                                       ▼
                      Sender ACK (Alice)                                    Room Broadcast (Bob)
             ┌──────────────────────────────────┐                  ┌──────────────────────────────────┐
             │ CANVAS_OPERATION_ACK             │                  │ CANVAS_OPERATION                 │
             │ { operationId }                  │                  │ { op, userId: 'alice' }          │
             └──────────────────────────────────┘                  └────────────────┬─────────────────┘
                                                                                    │
                                                                                    ▼
                                                                           REMOTE CLIENT (Bob)
                                                                   ┌──────────────────────────────────┐
                                                                   │ CollaborationService Listener    │
                                                                   │ - Duplicate Check & Filter       │
                                                                   └────────────────┬─────────────────┘
                                                                                    │
                                                                                    ▼
                                                                   ┌──────────────────────────────────┐
                                                                   │ dispatch({                       │
                                                                   │   type: 'APPLY_OPERATION',       │
                                                                   │   source: 'remote', op           │
                                                                   │ })                               │
                                                                   └────────────────┬─────────────────┘
                                                                                    │
                                                                                    ▼
                                                                   ┌──────────────────────────────────┐
                                                                   │ applyCanvasOperation(state, op)  │
                                                                   └────────────────┬─────────────────┘
                                                                                    │
                                                                                    ▼
                                                                   ┌──────────────────────────────────┐
                                                                   │ Canvas State Reducer & Render    │
                                                                   └──────────────────────────────────┘
```

---

## 2. Operation Lifecycle

### 2.1 The Atomic Unit: `CanvasOperation`
State modifications are modeled strictly as discrete atomic operations rather than full canvas snapshots:

```typescript
export interface BaseOperation {
  operationId: string;       // Unique UUID generated by client
  canvasId: string;          // Room ID / Canvas context
  type: CanvasOperationType; // 'CREATE_OBJECT' | 'UPDATE_OBJECT' | 'DELETE_OBJECT' | 'MOVE_OBJECT' | 'REORDER_OBJECT'
  objectId: string;          // Target entity identifier
  timestamp: number;         // Generation epoch (ms)
  clientId: string;          // Originating browser tab session ID
  sequenceNumber?: number;   // Optional sequence metadata
  userId?: string;           // Injected strictly by server from authenticated context
}
```

### 2.2 Local Operation Flow (0ms Latency)
1. Local user draws, transforms, moves, or deletes a shape.
2. An atomic `CanvasOperation` is synthesized with a unique `operationId`.
3. The operation is dispatched immediately to `canvasStateReducer` with `source: 'local'`, executing `applyCanvasOperation(state, op)` with zero perceived latency (60fps rendering).
4. `CollaborationService.sendCanvasOperation(op)` records the `operationId` in the local duplicate cache and transmits the operation over the WebSocket.

### 2.3 Remote Operation Flow
1. Incoming `CANVAS_OPERATION` arrives over WebSocket.
2. `CollaborationService` checks its bounded duplicate set. If `operationId` was already processed (or originated locally), it is discarded.
3. The verified operation is dispatched to `canvasStateReducer` with `source: 'remote'`.
4. `applyCanvasOperation(state, op)` updates state deterministically without invoking synthetic DOM or pointer events.
5. The canvas re-renders with the updated state.

### 2.4 Sender Exclusion & Acknowledgment
To prevent local operations from being applied twice (once on user interaction and once upon receiving the server's broadcast reflection), the server **excludes the originating socket** from the room broadcast:
- **Originating client**: Receives `CANVAS_OPERATION_ACK` containing `operationId`.
- **Other room members**: Receive `CANVAS_OPERATION` containing the verified operation and server-bound `userId`.

---

## 3. Strict Server Validation & Authorization

The server guards the real-time channel against malformed data, unauthorized access, and identity spoofing:
1. **Authenticated Context**: The sending socket must be authenticated via JWT during handshake.
2. **Room Boundary**: Sockets must be inside an active room (`NOT_IN_ROOM` error if not).
3. **Persistent Membership**: The server queries MongoDB `Room.findById(currentRoomId)` and confirms `userId` is an authorized member (`ROOM_ACCESS_DENIED` error if not).
4. **Operation Validation**: `validateCanvasOperation` validates envelope structure, timestamps, allowed types, and shape-specific payloads (`rectangle`, `ellipse`, `line`, `stroke`, `text`).
5. **No Identity Spoofing**: Any client-provided `userId` in the message payload is disregarded and overwritten with `context.userId`.

---

## 4. Duplicate Operation Protection

Network latency, retries, and broadcast reflection can lead to duplicate messages. Both client and server maintain bounded duplicate tracking:
- **Structure**: A `Set<string>` paired with a FIFO eviction queue capped at `MAX_PROCESSED_OPS = 1000`.
- **Eviction**: When the cache reaches 1,000 operation IDs, the oldest entry is evicted upon new additions.
- **Idempotency**: Any message bearing an `operationId` present in the cache is safely suppressed.

---

## 5. Disconnection & Failure Behavior (Approach A)

- **Local Functionality**: When disconnected or reconnecting, the local canvas engine remains fully functional for drawing and navigation.
- **Controlled Transmission**: If the client is disconnected or not in an active room, `sendCanvasOperation` returns `false` and does not transmit.
- **Transparency**: Connection status is continuously surfaced through the `ConnectionStatusBadge` (`Connecting...`, `Reconnecting...`, `Disconnected`).
- **Resumption**: When the connection is re-established and the room is rejoined (`ROOM_JOINED`), real-time operation transmission automatically resumes.

---

## 6. Critical Boundaries: What Day 5 Does NOT Include

> [!IMPORTANT]
> **Day 5 provides real-time operation broadcasting, NOT conflict resolution.**

Explicit limitations:
1. **No CRDT / OT**: If Alice moves Rectangle X to $(100, 100)$ at the exact same moment Bob moves Rectangle X to $(500, 500)$, both operations are broadcast. The order of arrival at each client dictates the final position without mathematical convergence guarantees or transform matrix reconciliation.
2. **No Persistent Operation Log**: Operations are broadcast ephemeral in-memory; operation logs are not yet committed to MongoDB.
3. **No Horizontal Scaling**: Room broadcasting is currently in-memory via `RoomManager` on a single Node instance. Horizontal scaling with Redis Pub/Sub is deferred.
4. **No True Offline Sync**: Edits made while disconnected are not queued for offline replay upon reconnect.

**Day 6 Scope**: The Day 6 milestone will build directly on top of this operation pipeline to implement state synchronization correctness, deterministic ordering, and conflict resolution.

