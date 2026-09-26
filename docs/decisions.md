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
  8. **Connection Lifecycle**:
     - Handshake (`/ws?token=...`) -> `CONNECTED` -> `JOIN_ROOM` -> `ROOM_JOINED` -> `LEAVE_ROOM` -> Disconnect.
  9. **Reconnection Strategy**:
     - Bounded exponential backoff with jitter: base delay 1,000 ms, maximum delay 16,000 ms, 10 maximum attempts.
     - Automatic room rejoin: upon successful reconnection, the client automatically re-issues `JOIN_ROOM` for its previous room.
     - Explicit disconnect: navigating to Dashboard or logging out cancels reconnect timers and tears down connections cleanly.
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
