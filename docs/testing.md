# Testing Strategy

This document outlines the testing methodology, active quality checks, automated test suites, and planned tests for the Real-Time Collaborative Canvas.

---

## 1. Implemented Quality Checks & Automated Tests (Day 4)

As of Day 4, the following automated test suites and validation checks are operational:

### A. Frontend Unit Tests (`client/`)

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
5. **WebSocket Client Service Tests (`websocketClient.test.ts` - New in Day 4)**:
   - Initial disconnected state verification.
   - Connection lifecycle transition to `connecting` and `connected` upon server `CONNECTED` handshake.
   - Clean disconnection on explicit `disconnect()`.
   - Event subscription and payload dispatching.
   - Message serialization with optional `requestId`.
   - `JOIN_ROOM` tracking and `ROOM_JOINED` state management.
   - `LEAVE_ROOM` un-subscription and room clearing.
   - Bounded exponential backoff reconnection with jitter on unexpected close.
   - Automatic room re-joining on reconnection.
   - Error state transition after maximum retry attempts.

**Frontend Test Results Summary**:
```text
✓ src/features/canvas/utils/__tests__/coordinates.test.ts (4 tests)
✓ src/features/canvas/state/__tests__/canvasState.test.ts (10 tests)
✓ src/features/canvas/utils/__tests__/hitTesting.test.ts (7 tests)
✓ src/features/canvas/utils/__tests__/geometry.test.ts (7 tests)
✓ src/features/realtime/__tests__/websocketClient.test.ts (9 tests)

Test Files  5 passed (5)
Tests       37 passed (37)
```

### B. Backend Integration, RoomManager & WebSocket Tests (`server/`)

A comprehensive backend test suite executing via `npm test` in `server/` against local MongoDB:

1. **RoomManager Unit Tests (`roomManager.test.ts` - New in Day 4)**:
   - In-memory socket room joining and membership tracking.
   - Deduplicated joins for sockets already present in the room.
   - Safe room switching (leaves old room, joins new room).
   - Empty room garbage collection: automatically deletes room Set when last socket leaves.
   - Multi-room socket isolation.
   - Targeted room broadcasts excluding sender.
   - Clean state reset on `clear()`.
2. **WebSocket Integration & Protocol Suite (`websocket.test.ts` - New in Day 4)**:
   - Handshake authentication with valid JWT (`CONNECTED` envelope verification).
   - Missing token rejection during upgrade (`HTTP 401 Unauthorized`).
   - Invalid token rejection during upgrade (`HTTP 401 Unauthorized`).
   - Authorized room join (`JOIN_ROOM` -> `ROOM_JOINED`).
   - Unauthorized room access denial for non-members (`ROOM_ACCESS_DENIED`).
   - Non-existent room handling (`ROOM_NOT_FOUND`).
   - Malformed room ID format handling (`INVALID_ROOM_ID`).
   - Authorized room leave (`LEAVE_ROOM` -> `ROOM_LEFT`).
   - Room leave when not joined (`NOT_IN_ROOM`).
   - Disconnection cleanup in RoomManager.
   - Application heartbeat (`PING` -> `PONG`).
   - Malformed JSON resilience (`INVALID_MESSAGE`).
   - Unknown message type resilience (`UNKNOWN_MESSAGE_TYPE`).
3. **Authentication Tests (`auth.test.ts`)**:
   - Valid user registration with safe user data and JWT token.
   - Password hashing verification (bcrypt hash in database, plaintext never persisted).
   - Validation failures (invalid email, short passwords).
   - Duplicate email conflict rejection (409 Conflict).
   - Successful credential login.
   - Login credential mismatch rejection (generic 401 Unauthorized, no email enumeration).
   - Authenticated `/api/auth/me` with Bearer token.
   - Unauthenticated and malformed token rejection.
   - Logout endpoint response.
4. **Room Management & Authorization Tests (`room.test.ts`)**:
   - Authenticated room creation and automatic default canvas generation.
   - Owner assigned as first room member.
   - Unauthenticated access rejection.
   - Room listing filtered strictly by user membership.
   - Room detail retrieval authorized for members.
   - Non-member access forbidden (403 Forbidden).
   - Joining rooms with idempotency (no duplicate memberships).
   - Non-owner member departure from rooms.
   - Owner leave prevention (preventing orphaned rooms).
5. **Security Suite (`security.test.ts`)**:
   - Guarantee that `passwordHash` is never present in any endpoint response.
   - Rejection of unauthenticated requests across all protected room endpoints.
   - Identity verification: client cannot spoof `userId` in request payloads.

**Backend Test Results Summary**:
```text
✓ src/__tests__/security.test.ts (3 tests)
✓ src/__tests__/auth.test.ts (12 tests)
✓ src/__tests__/room.test.ts (10 tests)
✓ src/__tests__/roomManager.test.ts (9 tests)
✓ src/__tests__/websocket.test.ts (13 tests)

Test Files  5 passed (5)
Tests       47 passed (47)
```

### C. Static Analysis & Compilation
- **TypeScript Compilation (`tsc`)**: Strict type checking with zero errors across client and server.
- **ESLint Validation**: Zero lint errors or warnings across entire codebase.
- **Production Build (`vite build`)**: Generates optimized production bundles in 1.1s.

### D. Manual & Browser Verification (Browser Subagent)
- **User Registration & Login**: Created user `alice.collab@example.com` and authenticated.
- **Room Creation**: Created room `Collaborative Studio Alpha` via Dashboard.
- **Room Entry & Connection**: Entered `/rooms/:roomId`, verified `ConnectionStatusBadge` rendered green dot with "Connected".
- **Canvas Interaction**: Selected rectangle tool, drew a rectangle on canvas, verified object count updated to `Objects: 1`.
- **Page Refresh Reconnection**: Reloaded canvas page, verified WebSocket reconnected automatically and re-established "Connected" status.
- **Clean Leave / Navigation**: Clicked "Dashboard", navigated back to `/dashboard`, verified clean socket teardown.
- **Object Selection & Manipulation**: Verified selection outline, resize handles, and position dragging.
- **Keyboard Shortcuts**: Verified tool hotkeys (`V`, `R`, `O`, `L`, `P`, `T`, `H`) and deletion (`Delete` / `Backspace`).
- **Console Logs**: Verified zero console errors or warnings.

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
