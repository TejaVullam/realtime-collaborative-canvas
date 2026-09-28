# Testing Strategy

This document outlines the testing methodology, active quality checks, automated test suites, and manual verification procedures for the Real-Time Collaborative Canvas.

---

## 1. Implemented Quality Checks & Automated Tests (Day 6)

As of Day 6, the following automated test suites and validation checks are operational:

### A. Frontend Unit & Synchronization Tests (`client/`)

A fast unit test suite powered by Vitest executes via `npm test` in `client/`:

1. **Coordinate Conversion Tests (`coordinates.test.ts`)**:
   - Screen-to-world coordinate un-projection with scale and pan offsets.
   - World-to-screen projection.
   - Invariance of cursor world-space coordinate during mouse-wheel zooming.
   - Min/max zoom clamping ($0.1\times$ to $5.0\times$).
2. **Geometry Utilities Tests (`geometry.test.ts`)**:
   - Bounding box normalization for multi-directional drag gestures.
   - Euclidean distance calculations and point-to-segment projection.
   - Axis-aligned bounding box extraction for all primitives.
   - 4-corner resize handle generation (`nw`, `ne`, `se`, `sw`).
3. **Hit-Testing & Transformed Geometry Tests (`hitTesting.test.ts`)**:
   - Point-in-rectangle containment.
   - Rotation-aware hit testing for rectangles transformed by arbitrary rotation angles.
   - Point-in-ellipse quadratic evaluation.
   - Point-to-line proximity within stroke threshold.
   - Reverse z-order scanning ensuring top-most element selection.
   - Resize handle hit detection.
   - Defensive guards for malformed/null objects.
4. **Canvas State Reducer Tests (`canvasState.test.ts`)**:
   - Initial state creation with clean defaults.
   - `ADD_OBJECT`: object map insertion, deterministic order, version increment, `updatedAt` update.
   - Deduplicated re-addition of modified object.
   - `UPDATE_OBJECT`: patch merging, object and canvas `updatedAt` updates, graceful missing-object handling.
   - `MOVE_OBJECT`: coordinate translation, timestamp updates, missing-object safety.
   - `DELETE_OBJECT`: removal from object map and ordering array.
   - `SET_STATE`: full state snapshot replacement.
5. **Canvas Operation Reducer & Conflict Resolution Tests (`canvasOperations.test.ts` - Extended in Day 6)**:
   - `applyCanvasOperation`: `CREATE_OBJECT` creation for rectangle, ellipse, line, stroke, and text objects.
   - `applyCanvasOperation`: `UPDATE_OBJECT` and `MOVE_OBJECT` attribute merging and coordinate translation.
   - Safe missing-object handling: unknown `objectId` mutations return state safely without crashing.
   - `applyCanvasOperation`: `DELETE_OBJECT` object removal and index cleanup.
   - `applyCanvasOperation`: `REORDER_OBJECT` safe array splice reordering.
   - `canvasStateReducer`: handles `APPLY_OPERATION` identically for `source: 'local'` and `source: 'remote'`.
   - **Day 6 Conflict Resolution Suite**:
     - *Field-level Last-Write-Wins (LWW)*: Independent fields merge cleanly when modified concurrently (e.g. `fill` and `strokeWidth`).
     - *Attribute Collision Resolution*: Conflicting mutations on the same attribute resolve deterministically to the higher `serverTimestamp` / `serverSequence`.
     - *Deletion Dominance*: Deleting an object completely nullifies concurrent or subsequent `UPDATE_OBJECT` / `MOVE_OBJECT` operations targeting that entity.
     - *Idempotency*: Applying the identical canonical operation multiple times yields bit-for-bit identical state.
     - *Multi-Client Convergence*: 3 independent simulated clients receiving canonical operations in sequence order converge to identical object states and z-indexes.
6. **CollaborationService Unit & Sync Protocol Tests (`collaborationService.test.ts` - Extended in Day 6)**:
   - Operation dispatch over WebSocket when connected and joined to room.
   - Controlled transmission rejection when disconnected or roomless.
   - Duplicate operation suppression: discards previously processed incoming remote operations.
   - Echo suppression: discards incoming remote broadcasts of locally generated operations.
   - Event subscription to `CANVAS_OPERATION_ACK` and `CANVAS_OPERATION_ERROR`.
   - Bounded cache protection: FIFO eviction at 1,000 operations preventing memory leaks.
   - **Day 6 Synchronization Suite**:
     - *Sequence-Ordered Processing*: Enforces in-order execution and advances `lastAppliedSequence`.
     - *Duplicate / Outdated Suppression*: Discards operations where `serverSequence <= lastAppliedSequence`.
     - *Out-of-Order Buffering & Gap Sync*: Buffers out-of-order sequence arrivals, sets `syncStatus = 'syncing'`, transmits `SYNC_REQUEST`, and automatically drains the buffer when missing sequence numbers arrive.
     - *Reconnect Catch-Up*: Replays missing canonical operations via `SYNC_RESPONSE` on reconnect.
     - *State Divergence Notification*: Transitions `syncStatus` to `diverged` upon receiving `SYNC_REQUIRED`.
7. **WebSocket Client Service Tests (`websocketClient.test.ts`)**:
   - Handshake lifecycle, automatic room rejoining upon reconnect, exponential backoff with jitter, clean explicit disconnection.

**Frontend Test Results Summary**:
```text
✓ src/features/canvas/utils/__tests__/coordinates.test.ts (4 tests)
✓ src/features/canvas/state/__tests__/canvasState.test.ts (10 tests)
✓ src/features/canvas/state/__tests__/canvasOperations.test.ts (15 tests)
✓ src/features/canvas/utils/__tests__/geometry.test.ts (7 tests)
✓ src/features/canvas/utils/__tests__/hitTesting.test.ts (7 tests)
✓ src/features/realtime/__tests__/collaborationService.test.ts (11 tests)
✓ src/features/realtime/__tests__/websocketClient.test.ts (13 tests)

Test Files  7 passed (7)
Tests       67 passed (67)
```

### B. Backend Integration, RoomManager & Synchronization Tests (`server/`)

A comprehensive backend test suite executing via `npm test` in `server/` against local MongoDB:

1. **Canvas Synchronization Suite (`canvasSynchronization.test.ts` - New in Day 6)**:
   - Strictly monotonic integer `serverSequence` ($1, 2, 3...$) and authoritative `serverTimestamp` assignment by `RoomManager`.
   - Originating sender receives sequence and timestamp metadata in `CANVAS_OPERATION_ACK`.
   - Reconnecting or gapped clients request catch-up via `SYNC_REQUEST` and receive ordered canonical history via `SYNC_RESPONSE`.
   - Clients handle out-of-order broadcast packets by buffering, requesting missing sequences, and draining in order.
   - If a client's sequence gap exceeds retained history, the server issues `SYNC_REQUIRED`.
   - Concurrent operations from multiple clients in the same room are assigned deterministic total ordering and converge identically.
2. **Canvas Operations Suite (`canvasOperations.test.ts` - Hardened in Day 5.1)**:
   - Sockets outside rooms rejected with `NOT_IN_ROOM`.
   - Sockets attempting unauthorized room operations rejected with `ROOM_ACCESS_DENIED`.
   - Envelope validation: missing `operationId`, `objectId`, `clientId`, or invalid timestamps rejected.
   - Strict `CREATE_OBJECT` validation: base attributes (`x`, `y`, `opacity`, `rotation`) and shape-specific payloads (`rectangle`, `ellipse`, `line`, `stroke`, `text`).
   - Strict `UPDATE_OBJECT` validation: allowlisted patch fields, non-empty patch requirement, type checks, forbidden system fields (`id`, `type`, `createdAt`, `updatedAt`, `createdBy`).
   - Room broadcasting: `CREATE_OBJECT` delivered to other room members, sender excluded, sender receives `CANVAS_OPERATION_ACK`.
   - Identity binding: client-supplied forged `userId` stripped and overridden with authenticated socket user ID.
   - Room isolation: operations never leak to sockets in different rooms.
   - Duplicate protection: repeated `operationId` rejected with `DUPLICATE_OPERATION`.
   - Bidirectional collaboration: full multi-user interaction verified between User A and User B.
3. **Full Pipeline Integration Suite (`canvasPipelineIntegration.test.ts`)**:
   - Complete end-to-end multi-client lifecycle: Client A create → Client B move → Client A delete, verifying convergence across both client stores.
4. **RoomManager Unit Tests (`roomManager.test.ts` - Extended in Day 6)**:
   - In-memory socket room joining and membership tracking.
   - Monotonic sequence generation per canvas.
   - Bounded in-memory history log (1,000 operations per canvas).
   - Empty room garbage collection.
   - Sender-excluded targeted broadcasts.
5. **WebSocket Integration & Protocol Suite (`websocket.test.ts`)**:
   - Handshake authentication with valid JWT (`CONNECTED` envelope verification).
   - Room join/leave authorization.
   - PING / PONG heartbeat protocol.
6. **Authentication API & Security Suite (`auth.test.ts`)**:
   - Registration validation, password hashing, JWT generation, `/api/auth/me`.
7. **Room Management API Suite (`room.test.ts`)**:
   - Room creation, listing, membership validation.
8. **Database Configuration Suite (`database.test.ts`)**:
   - MongoDB connection health and graceful shutdown.

**Backend Test Results Summary**:
```text
✓ src/__tests__/auth.test.ts (12 tests)
✓ src/__tests__/room.test.ts (10 tests)
✓ src/__tests__/websocket.test.ts (13 tests)
✓ src/__tests__/canvasOperations.test.ts (15 tests)
✓ src/__tests__/canvasPipelineIntegration.test.ts (1 test)
✓ src/__tests__/canvasSynchronization.test.ts (6 tests)
✓ src/websocket/__tests__/roomManager.test.ts (8 tests)
✓ src/config/__tests__/database.test.ts (4 tests)

Test Files  8 passed (8)
Tests       69 passed (69)
```

**Grand Total Automated Tests**: **15 test files, 136 tests passing (100% pass rate)**.

### C. Static Analysis & Compilation
- **TypeScript Compilation (`tsc`)**: Strict type checking with zero errors across client and server (`client/` and `server/`).
- **ESLint Validation**: Zero lint errors or warnings across the entire repository.
- **Production Build (`vite build`)**: Generates optimized production bundles in $<1$s.

### D. Manual Two-Browser Verification Procedure
To verify multi-user real-time collaboration under realistic conditions:

1. **Setup**:
   - Start backend: `npm run dev` in `server/` (runs on `http://localhost:5000`).
   - Start frontend: `npm run dev` in `client/` (runs on `http://localhost:3000` or `5173`).
2. **Browser A (User 1 - Alice)**:
   - Open standard browser window.
   - Register user `alice@example.com` / `Password123!`.
   - Create room `Collab Room Day 6`.
   - Enter canvas workspace. Note green "Connected" badge.
3. **Browser B (User 2 - Bob)**:
   - Open incognito browser window (separate session / cookie storage).
   - Register user `bob@example.com` / `Password123!`.
   - Join room `Collab Room Day 6` using Room ID copied from Alice's URL or dashboard.
   - Enter canvas workspace. Note green "Connected" badge.
4. **Simultaneous Creation & Move**:
   - Alice creates a blue rectangle at $(100, 100)$.
   - Bob observes rectangle appear instantly on his canvas without page reload.
   - Bob selects and drags the rectangle to $(300, 200)$.
   - Alice observes the shape glide smoothly to the new position.
5. **Concurrent Edit (Conflict Resolution)**:
   - Alice changes the fill color to red.
   - Concurrently, Bob changes the stroke width to 8px.
   - Both edits merge: both Alice and Bob see a red rectangle with an 8px border (Field-Level LWW).
6. **Transient Disconnection & Catch-Up**:
   - In Browser B, simulate network drop (open DevTools Network tab -> Offline).
   - In Browser A, Alice adds an ellipse and a text object.
   - In Browser B, restore network (DevTools Network tab -> Online).
   - Bob's client automatically re-authenticates, rejoins the room, issues `SYNC_REQUEST`, receives `SYNC_RESPONSE`, and renders both missed shapes seamlessly.
7. **Room Isolation**:
   - Open Browser C with User Charlie in a different room (`Other Room`).
   - Charlie draws a shape. Verify neither Alice nor Bob in `Collab Room Day 6` receives the shape.

---

## 2. Planned Test Suites (Architectural Roadmap)

- **Day 7**: Live presence testing (cursor position broadcasts, selection bounding boxes, user color badges).
- **Day 8**: Temporal snapshots and durable operation history persistence in MongoDB.
- **Day 9**: Playwright multi-browser end-to-end automated collaboration tests.
