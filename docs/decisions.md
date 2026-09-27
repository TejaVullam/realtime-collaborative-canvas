# Architecture Decision Records (ADR)

This document records the architectural and design decisions made throughout the project lifecycle.

---

## ADR-001: Day 0 Baseline Tooling and Stack Selection

- **Status**: Accepted (Day 0)
- **Context**: Need a fast, clean, and type-safe foundation for a multi-user collaborative canvas.
- **Decision**:
  - Frontend: React with TypeScript, Vite as build tool, Tailwind CSS for styling.
  - Backend: Node.js with TypeScript and Express.
  - Development tools: `tsx` for backend runtime, ESLint and Prettier for code formatting.
- **Consequences**: Provides minimal footprint on Day 0 without committing prematurely to state-sync or database abstractions.

---

## ADR-002: Structured Canvas Objects as Primary Source of Truth

- **Status**: Accepted (Day 1)
- **Context**: Canvas drawings and graphic entities can either be maintained as raw pixel buffers (raster/bitmap) or as discrete structured vector data structures.
- **Decision**:
  - Canvas content will be represented strictly as structured data objects (`CanvasObject` with discriminated union types for rectangle, ellipse, line, stroke, text) rather than a bitmap image.
- **Consequences**:
  - Enables individual object selection, moving, resizing, and property styling at any point in time.
  - Drastically reduces bandwidth requirements: sending mathematical parameters (`x`, `y`, `width`, `height`, `fill`) is orders of magnitude smaller than transmitting frame screenshots.
  - Essential prerequisite for conflict resolution and granular multi-user collaboration.

---

## ADR-003: Operation-Based State Mutation Model

- **Status**: Accepted (Day 1)
- **Context**: Real-time collaborative applications require distributing changes across distributed nodes while supporting undo/redo, temporal replay, and network retransmissions.
- **Decision**:
  - State modifications are modeled as discrete, atomic operations (`CanvasOperation`: `CREATE_OBJECT`, `UPDATE_OBJECT`, `DELETE_OBJECT`, `MOVE_OBJECT`, `REORDER_OBJECT`).
  - Each operation carries an `operationId` (for idempotency and deduplication), `clientId` (for attribution), and `timestamp` / sequence tracking.
- **Consequences**:
  - Avoids sending entire canvas state snapshots on every micro-edit (such as dragging an object or drawing a line).
  - Provides a natural audit log that can be persisted incrementally and replayed for history or conflict resolution.

---

## ADR-004: Synchronization Strategy Kept Under Evaluation

- **Status**: Accepted (Day 1)
- **Context**: Multi-user collaboration requires reconciling concurrent edits. Common strategies include Server-Authoritative State, Operational Transformation (OT), and Conflict-Free Replicated Data Types (CRDT).
- **Decision**:
  - The final choice of synchronization algorithm is deferred until network infrastructure (Day 4) and performance profiling are conducted.
  - The `CanvasOperation` and `CanvasState` domain contracts are intentionally engineered to accommodate any of the candidate synchronization mechanisms without breaking the domain interface.
- **Consequences**:
  - Prevents premature commitment to complex CRDT or OT libraries before basic local rendering and WebSocket telemetry are proven.
  - Keeps Day 1 codebase lean, maintainable, and free of unnecessary third-party synchronization dependencies.

---

## ADR-005: HTML5 Canvas Rendering Engine

- **Status**: Accepted (Day 2)
- **Context**: The project requires high-performance rendering of potentially thousands of structured canvas objects, smooth high-frequency freehand strokes, real-time panning/zooming, and minimal DOM overhead.
- **Decision**:
  - Use a single HTML5 `<canvas>` element driven by a procedural 2D context rendering pipeline (`renderCanvas`), while maintaining the underlying visual state as structured TypeScript data objects.
  - Reject DOM-based rendering (thousands of `<div>` or `<svg>` elements in React virtual DOM) to avoid reconciliation bottlenecks during continuous pointer gestures.
- **Consequences**:
  - **Benefits**:
    - High-performance, constant-frame-rate rendering even with dense scenes.
    - Native support for smooth freehand paths and complex shape clipping.
    - Decoupled state: React only re-renders lightweight toolbar and status UI; canvas redraws are optimized.
    - Seamless support for high-DPI (Retina) displays via backing store scaling.
  - **Trade-offs**:
    - Requires manual implementation of geometric hit-testing for selection.
    - Requires custom rendering of selection bounding boxes and resize handles.
    - Accessibility considerations require dedicated UI overlays.

---

## ADR-006: Authentication and Collaborative Room Management

- **Status**: Accepted (Day 3)
- **Context**: Real-time collaborative spaces require authenticated user identities, secure credential protection, and collaborative room boundaries (`User -> Room -> Canvas`) prior to introducing WebSocket infrastructure in Day 4.
- **Decision**:
  1. **Authentication Mechanism**: JWT (JSON Web Token) signed with HMAC-SHA256 via `jsonwebtoken`, passed via HTTP `Authorization: Bearer <token>` headers.
  2. **Why Selected**:
     - Eliminates CORS/SameSite cookie cross-origin restrictions between decoupled frontend (port 5173) and backend (port 5000) during development and preview deployments.
     - Fully compatible with future Day 4 WebSockets, allowing tokens to be validated during the initial HTTP upgrade handshake (`ws://...?token=...`).
  3. **Password Security**: Passwords hashed with `bcryptjs` (work factor 10 salt rounds). Plaintext passwords are never stored; `passwordHash` has `select: false` on Mongoose schema and is explicitly stripped from JSON responses.
  4. **Room & Canvas Relationship**:
     - `Room` entity maintains `ownerId`, `canvasId`, and an array of `members: [{ userId, role, joinedAt }]`.
     - `Canvas` entity maintains `roomId` and canvas `metadata`.
     - When a room is created, its default canvas document is automatically initialized.
  5. **Authorization Boundaries**:
     - Strict server-side verification: all protected room endpoints (`GET /api/rooms`, `POST /api/rooms`, `GET /api/rooms/:roomId`, `POST /api/rooms/:roomId/join`, `POST /api/rooms/:roomId/leave`) enforce authenticated membership.
     - User identity is always resolved from the verified JWT payload (`req.user.id`), ignoring any client-supplied `userId`.
     - Room owners are restricted from leaving their own rooms to prevent orphaning until room deletion or ownership transfer is built.
- **Consequences**:
  - **Benefits**:
    - Clean architectural separation: Routes -> Controllers -> Services -> Mongoose Models.
    - Safe error messages: login errors return generic responses to prevent user enumeration attacks.
    - Future-proof WebSocket token integration.
  - **Known Limitations**:
    - No refresh token rotation or blacklisting yet; tokens expire in 7 days.
    - Complex role-based access control (RBAC) and ownership transfer deferred to future days.
    - Real-time synchronization is intentionally not implemented on Day 3.

---

## ADR-007: WebSocket Infrastructure Architecture

- **Status**: Accepted (Day 4)
- **Context**: Enabling real-time collaboration requires establishing a persistent, bidirectional communication channel between clients and the server before introducing canvas operation synchronization in Day 5. Key architectural needs include authenticated socket lifecycles, room boundary isolation, structured message typing, reconnection resiliency, and connection health management.
- **Decision**:
  1. **WebSocket Technology**: Selected `ws` for the Node.js backend and the native browser `WebSocket` API for the frontend.
  2. **Why Selected**:
     - Minimalist, high-performance, and RFC-6455 compliant without the abstraction bloat or proprietary framing of Socket.io.
     - Demonstrates foundational mastery of raw WebSocket connection upgrades, heartbeats, and room multiplexing.
     - Native browser `WebSocket` eliminates third-party client bundles entirely.
  3. **HTTP + WebSocket Integration**:
     - Shared HTTP Server: The WebSocket server mounts directly onto the existing Node HTTP server instance (`port 5000`) and intercepts upgrade requests specifically directed to `/ws`.
     - Non-colliding REST API routes (`/api/...`) continue functioning independently on the same server port and process.
  4. **Authentication Strategy**:
     - Handshake verification: The client passes its JWT via query parameter (`/ws?token=<jwt>`) or HTTP headers.
     - Reuses `AuthService.verifyToken()` and `AuthService.getUserById()` as the single source of truth for token authenticity.
     - Unauthenticated requests are rejected during the HTTP upgrade phase with `HTTP 401 Unauthorized` before establishing a WebSocket frame.
     - Credentials and tokens are never logged.
  5. **Socket Context**:
     - Context record stores `socketId` (UUID), `userId` (MongoDB ObjectId), `user` profile, `connectedAt`, `currentRoomId`, and heartbeat state `isAlive`.
     - Identity is strictly derived from the verified token, preventing client spoofing.
  6. **Room Manager Design**:
     - `RoomManager` maintains in-memory maps (`rooms: Map<roomId, Set<WebSocket>>` and `socketToRoom: Map<WebSocket, string>`).
     - Distinct from persistent database state: MongoDB `Room` governs authoritative permissions, while `RoomManager` routes real-time broadcasts.
     - Automatic garbage collection: when the last client leaves a room, the room Set is purged from memory.
  7. **Message Envelope**:
     - Standard envelope `{ type: string, requestId?: string, payload: T }` across all exchanges.
     - Request correlation enabled by reflecting `requestId` in responses.
     - Strict runtime validation of envelope structure, JSON format, and payload types.
  8. **Connection Lifecycle vs. Room Lifecycle (Day 4.1 Hardening)**:
     - Strict separation between transport connection lifecycle (mount, token, transport drop, reconnect backoff) and room membership lifecycle (`currentRoomId`, `joinRoom`, `leaveRoom`).
     - A temporary network interruption (`connected` → `reconnecting`) preserves `currentRoomId`. The React `useWebSocket` hook decouples room membership from `status`, ensuring that `leaveRoom()` is not invoked during transient outages.
     - Upon transport reconnection (`CONNECTED`), the client automatically re-issues `JOIN_ROOM(currentRoomId)` exactly once.
     - Duplicate join protection: client tracks `joinedRoomId` and suppresses redundant `JOIN_ROOM` messages if already acknowledged.
     - Room switching cleanly emits `LEAVE_ROOM` for the previous room before joining the new room.
  9. **Reconnection Strategy & Explicit Disconnect (Day 4.1 Hardening)**:
     - Bounded exponential backoff with jitter: base delay 1,000 ms, maximum delay 16,000 ms, 10 maximum attempts.
     - Explicit disconnect: navigating away from Canvas (unmount) or user logout invokes `client.disconnect()`, which sets `isExplicitDisconnect = true`, clears all reconnect timers, purges socket event listeners, closes the physical socket (code 1000), and clears active room state.
     - Prevents zombie sockets, duplicate listeners, and uncoordinated reconnection attempts.
  10. **Heartbeat Strategy**:
      - 30-second interval running native `ws.ping()` / `ws.on('pong')` frames.
      - Connections failing to respond across consecutive intervals are terminated via `ws.terminate()` to prevent socket leaks.
  11. **Error Handling**:
      - Structured `ERROR` envelopes with standardized error codes (`UNAUTHENTICATED`, `INVALID_MESSAGE`, `UNKNOWN_MESSAGE_TYPE`, `INVALID_ROOM_ID`, `ROOM_NOT_FOUND`, `ROOM_ACCESS_DENIED`, `NOT_IN_ROOM`, `SERVER_ERROR`).
      - Malformed messages never crash the server process.
  12. **Security Discipline**:
      - Strict membership validation: clients can only join a WebSocket room if their `userId` exists in the MongoDB `Room.members` array.
      - Message size cap: enforced 64 KB limit protects against denial-of-service attempts.
  13. **Day 5 Compatibility**:
      - Infrastructure messages (`JOIN_ROOM`, `LEAVE_ROOM`, `PING`, `CONNECTED`, etc.) are cleanly isolated from future canvas mutation operations (`CREATE_OBJECT`, `UPDATE_OBJECT`, `DELETE_OBJECT`, `SYNC_STATE`).
- **Consequences**:
  - **Benefits**:
    - Rock-solid, typed, and resilient communication foundation.
    - Zero external broker dependencies for Day 4.
    - Full test coverage across connection, authorization, rooms, and reconnection.
  - **Known Limitations**:
    - Single-instance Node process memory store: horizontally scaling across multiple backend instances will require a pub/sub layer (e.g., Redis Pub/Sub), deferred to later stages.
    - Ephemeral room state is lost on server restart (persistent canvas and room data remain safe in MongoDB).
    - Canvas operation broadcasting is intentionally deferred to Day 5.

---

## ADR-008: Operation-Based Real-Time Canvas Collaboration

- **Status**: Accepted (Day 5)
- **Context**:
  With connection lifecycle and room infrastructure established in Days 4 and 4.1, Day 5 introduces the first real multi-user canvas synchronization layer. Multiple authenticated users inside the same room must see each other's creations, modifications, moves, and deletions in real time. We need to decide whether to transmit full canvas state snapshots or atomic operations, how to separate canvas UI from networking, how to ensure immediate responsiveness, and how to avoid broadcast reflection and duplicate application.
- **Decision**:
  1. **Operation-Based Synchronization over Snapshots**:
     - Synchronize atomic `CanvasOperation` records (`CREATE_OBJECT`, `UPDATE_OBJECT`, `DELETE_OBJECT`, `MOVE_OBJECT`, `REORDER_OBJECT`) rather than full canvas state snapshots.
     - Sending a single operation ($<500\text{ bytes}$) is dramatically more bandwidth-efficient than transmitting hundreds of kilobytes of entire canvas JSON on every pointer interaction or mouse drag.
  2. **Clean Architectural Layering**:
     - Maintain strict separation of concerns:
       $$\text{Canvas UI} \rightarrow \text{Interaction Hook} \rightarrow \text{CanvasOperation} \rightarrow \text{CollaborationService} \rightarrow \text{WebSocketClient} \rightarrow \text{Server Validation} \rightarrow \text{RoomManager Broadcast} \rightarrow \text{Remote Client} \rightarrow \text{applyCanvasOperation} \rightarrow \text{Canvas State Reducer} \rightarrow \text{Canvas Render}$$
     - Canvas rendering and interaction hooks do not know WebSocket details or low-level sockets.
     - WebSocket client does not manipulate React state directly.
  3. **Local-First Immediate Application with Dedicated Operation Flow**:
     - Local actions dispatch an `APPLY_OPERATION` action with `source: 'local'` to the canvas reducer immediately (0ms user interface latency, 60fps responsiveness).
     - Local actions transmit the operation via `CollaborationService.sendCanvasOperation(operation)`.
  4. **Sender Exclusion with Server Acknowledgment (ACK)**:
     - Originating clients apply operations locally and receive a `CANVAS_OPERATION_ACK` containing `operationId`.
     - Other connected clients in the room receive the `CANVAS_OPERATION` broadcast.
     - This cleanly prevents the originating client from receiving an echo of its own action and applying the mutation twice.
  5. **Server-Side Security & Authentication Binding**:
     - The server never trusts client-supplied `userId` or `roomId`.
     - `userId` is strictly bound from `AuthenticatedSocketContext.userId` derived from the verified JWT.
     - `roomId` is taken from `AuthenticatedSocketContext.currentRoomId` and verified against MongoDB `Room.members` persistent membership.
  6. **Strict Server Runtime Validation**:
     - Implemented `validateCanvasOperation` to inspect envelopes, required identifiers, timestamps, and shape-specific payloads (`rectangle`, `ellipse`, `line`, `stroke`, `text`).
     - Malformed or invalid operations are rejected with `CANVAS_OPERATION_ERROR` and never broadcast to room members.
  7. **Bounded Duplicate Protection**:
     - Both server (`RoomManager`) and client (`CollaborationService`) maintain bounded FIFO sets (up to 1,000 operation IDs) to identify and ignore duplicates.
     - Memory cannot leak indefinitely because entries beyond 1,000 are evicted in FIFO order.
  8. **Disconnection Failure Behavior (Approach A)**:
     - When disconnected, local canvas interactions remain fully functional.
     - Remote operation transmission is temporarily disabled (`sendCanvasOperation` returns `false`), and connection state is surfaced clearly via `ConnectionStatusBadge`.
     - We explicitly avoid pretending operations are synchronized when disconnected; full offline reconciliation is deferred.
- **Consequences**:
  - **Benefits**:
    - Real-time multi-user synchronization working reliably between multiple browsers.
    - Zero perceptible lag for local drawing.
    - Robust server authorization and room isolation preventing cross-room data leaks.
    - Clean foundation for Day 6 synchronization conflict resolution.
  - **Explicit Limitations (To Be Addressed in Day 6+)**:
    - **No CRDT / OT yet**: Concurrent conflicting edits (e.g. Alice and Bob dragging the same object simultaneously) are not resolved through operational transformation or CRDTs.
    - **No Persistent Operation History Log**: Operations are broadcast ephemeral in-memory; operation logs are not yet written to MongoDB.
    - **No Horizontal Scaling**: Room broadcasting is bounded to the single Node.js process memory.

