# Testing Strategy

This document outlines the testing methodology, active quality checks, automated test suites, and planned tests for the Real-Time Collaborative Canvas.

---

## 1. Implemented Quality Checks & Automated Tests (Day 5)

As of Day 5, the following automated test suites and validation checks are operational:

### A. Frontend Unit & Real-Time Collaboration Tests (`client/`)

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
5. **Canvas Operation Reducer Tests (`canvasOperations.test.ts` - New in Day 5)**:
   - `applyCanvasOperation`: `CREATE_OBJECT` creation for rectangle, ellipse, line, stroke, and text objects.
   - `applyCanvasOperation`: `UPDATE_OBJECT` and `MOVE_OBJECT` attribute merging and coordinate translation.
   - Safe missing-object handling: unknown `objectId` mutations return state safely without crashing.
   - `applyCanvasOperation`: `DELETE_OBJECT` object removal and index cleanup.
   - `applyCanvasOperation`: `REORDER_OBJECT` safe array splice reordering.
   - `canvasStateReducer`: handles `APPLY_OPERATION` identically for `source: 'local'` and `source: 'remote'`.
6. **CollaborationService Unit Tests (`collaborationService.test.ts` - New in Day 5)**:
   - Operation dispatch over WebSocket when connected and joined to room.
   - Controlled transmission rejection when disconnected or roomless (Section 19 Approach A).
   - Duplicate operation suppression: discards previously processed incoming remote operations.
   - Echo suppression: discards incoming remote broadcasts of locally generated operations.
   - Event subscription to `CANVAS_OPERATION_ACK` and `CANVAS_OPERATION_ERROR`.
   - Bounded cache protection: FIFO eviction at 1,000 operations preventing memory leaks.
7. **WebSocket Client Service Tests (`websocketClient.test.ts` - Hardened in Day 4.1)**:
   - Initial disconnected state verification.
   - Connection lifecycle transition to `connecting` and `connected` upon server `CONNECTED` handshake.
   - Room join and acknowledgement tracking.
   - Retention of `currentRoomId` across unexpected network drops during reconnecting state.
   - Automatic room re-joining sending `JOIN_ROOM` exactly once upon successful reconnect.
   - Explicit `disconnect()` clearing timers, preventing reconnection, closing socket, and resetting state.
   - Unmount and logout cleanup: `disconnect()` cancelling active reconnect timers immediately.
   - Room switching: sending `LEAVE_ROOM` for old room before `JOIN_ROOM` for new room, preventing stale state.
   - Duplicate join prevention: suppressing redundant `JOIN_ROOM` messages if already acknowledged.
   - Reconnect exhaustion: transitioning to `error` and cleaning all timers after maximum attempts.
   - Stale socket cleanup: detaching listeners from old sockets to prevent memory leaks and duplicate handlers.

**Frontend Test Results Summary**:
```text
✓ src/features/canvas/utils/__tests__/coordinates.test.ts (4 tests)
✓ src/features/canvas/state/__tests__/canvasState.test.ts (10 tests)
✓ src/features/canvas/state/__tests__/canvasOperations.test.ts (8 tests)
✓ src/features/realtime/__tests__/collaborationService.test.ts (6 tests)
✓ src/features/canvas/utils/__tests__/geometry.test.ts (7 tests)
✓ src/features/canvas/utils/__tests__/hitTesting.test.ts (7 tests)
✓ src/features/realtime/__tests__/websocketClient.test.ts (13 tests)

Test Files  7 passed (7)
Tests       55 passed (55)
```

### B. Backend Integration, RoomManager & Real-Time Operation Tests (`server/`)

A comprehensive backend test suite executing via `npm test` in `server/` against local MongoDB:

1. **Canvas Operations Suite (`canvasOperations.test.ts` - New in Day 5)**:
   - Sockets outside rooms rejected with `NOT_IN_ROOM`.
   - Sockets attempting unauthorized room operations rejected with `ROOM_ACCESS_DENIED`.
   - Envelope validation: missing `operationId`, `objectId`, `clientId`, or invalid timestamps rejected.
   - Type validation: unlisted operation types rejected with `INVALID_OPERATION_TYPE`.
   - Payload validation: malformed object definitions or non-numeric move coordinates rejected with `INVALID_OPERATION_PAYLOAD`.
   - Room broadcasting: `CREATE_OBJECT` delivered to other room members, sender excluded, sender receives `CANVAS_OPERATION_ACK`.
   - Identity binding: client-supplied forged `userId` stripped and overridden with authenticated socket user ID.
   - Room isolation: operations never leak to sockets in different rooms.
   - Duplicate protection: repeated `operationId` rejected with `DUPLICATE_OPERATION`.
   - Bidirectional collaboration: full multi-user interaction verified between User A and User B.
2. **Full Pipeline Integration Suite (`canvasPipelineIntegration.test.ts` - New in Day 5)**:
   - Complete end-to-end multi-client lifecycle:
     Client A `CREATE_OBJECT` → WebSocket Server → RoomManager → Client B Canvas State →
     Client B `MOVE_OBJECT` → WebSocket Server → RoomManager → Client A Canvas State →
     Client A `DELETE_OBJECT` → WebSocket Server → RoomManager → Client B Canvas State.
   - Both client states converge identically.
3. **RoomManager Unit Tests (`roomManager.test.ts`)**:
   - In-memory socket room joining and membership tracking.
   - Deduplicated joins for sockets already present in the room.
   - Safe room switching (leaves old room, joins new room).
   - Empty room garbage collection: automatically deletes room Set when last socket leaves.
   - Multi-room socket isolation.
   - Targeted room broadcasts excluding sender.
   - Bounded duplicate operation ID tracking.
   - Clean state reset on `clear()`.
4. **WebSocket Integration & Protocol Suite (`websocket.test.ts`)**:
   - Handshake authentication with valid JWT (`CONNECTED` envelope verification).
   - Missing token rejection during upgrade (`HTTP 401 Unauthorized`).
   - Invalid token rejection during upgrade (`HTTP 401 Unauthorized`).
   - Authorized room join (`JOIN_ROOM` -> `ROOM_JOINED`).
   - Unauthorized room access denial for non-members (`ROOM_ACCESS_DENIED`).
   - Non-existent room handling (`ROOM_NOT_FOUND`).
   - Malformed room ID format handling (`INVALID_ROOM_ID`).
   - Authorized room leave (`LEAVE_ROOM` -> `ROOM_LEFT`).
   - Room leave when not joined (`NOT_IN_ROOM`).
   - Automatic socket cleanup on disconnect.
   - PING / PONG heartbeat protocol.
   - Malformed JSON resilience.
   - Unknown message type handling.
5. **Authentication API & Security Suite (`auth.test.ts`)**:
   - Registration validation (email uniqueness, password strength).
   - Password hashing and verification.
   - JWT generation and profile retrieval (`/api/auth/me`).
6. **Room Management API Suite (`room.test.ts`)**:
   - Room creation, listing, and membership validation.

**Backend Test Results Summary**:
```text
✓ src/__tests__/auth.test.ts (12 tests)
✓ src/__tests__/room.test.ts (10 tests)
✓ src/__tests__/websocket.test.ts (13 tests)
✓ src/__tests__/canvasOperations.test.ts (11 tests)
✓ src/__tests__/canvasPipelineIntegration.test.ts (1 test)
✓ src/websocket/__tests__/roomManager.test.ts (8 tests)
✓ src/config/__tests__/database.test.ts (4 tests)

Test Files  7 passed (7)
Tests       59 passed (59)
### C. Static Analysis & Compilation
- **TypeScript Compilation (`tsc`)**: Strict type checking with zero errors across client and server.
- **ESLint Validation**: Zero lint errors or warnings across entire codebase.
- **Production Build (`vite build`)**: Generates optimized production bundles in 1.8s.

### D. Manual & Browser Verification (Browser Subagent)
- **User Registration & Login**: Registered and authenticated new user `aliceday5@example.com` on `http://localhost:3000`.
- **Room Creation**: Created room `Day 5 Collab Room` (ID: `b37493`) from Dashboard.
- **Room Entry & Connection**: Entered room workspace, verified `ConnectionStatusBadge` rendered green "Connected" badge.
- **Canvas Interaction**: Selected Rectangle tool, drew rectangle $(200, 200) \rightarrow (400, 350)$, verified status bar updated to `Objects: 1`.
- **Multi-Shape Support**: Selected Ellipse tool, drew ellipse $(500, 200) \rightarrow (650, 350)$, verified status bar updated to `Objects: 2`.
- **Clean Leave / Navigation**: Clicked "Dashboard" button, returned cleanly to dashboard without socket leakage or console errors.

---

## 2. Planned Test Suites (Architectural Design)

> [!NOTE]
> The test suites listed below represent planned test coverage to be introduced across Days 3–9 alongside feature implementations. None of these automated test suites are implemented yet.

### A. State Reducer & Operation Unit Tests (Planned - Day 3/5)
- Pure unit tests verifying that applying a `CREATE_OBJECT`, `UPDATE_OBJECT`, `DELETE_OBJECT`, or `MOVE_OBJECT` produces deterministic `CanvasState` transitions.

### B. REST API Route Integration Tests (Planned - Day 3)
- Test Express routes using Supertest for request parameter parsing, room creation, error status codes, and JSON compliance.

### C. WebSocket & Room Synchronization Tests (Planned - Day 4/5)
- Room lifecycle, client join/leave broadcasts, and message framing tests.

### D. Concurrent Editing & Conflict Tests (Planned - Day 6)
- Simultaneous client operations on shared objects verifying deterministic state convergence.

### E. End-to-End (E2E) Collaboration Tests (Planned - Day 9)
- Playwright multi-browser automation launching two concurrent browser windows, simulating user strokes in Client A, and verifying visual canvas reproduction in Client B within 100ms.
