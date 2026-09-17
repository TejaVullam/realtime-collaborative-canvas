# Testing Strategy

This document outlines the testing methodology, active quality checks, and planned test suites for the Real-Time Collaborative Canvas.

---

## 1. Implemented Quality Checks (Day 1)

As of Day 1, the following automated static and compilation checks are operational:
- **TypeScript Compilation (`tsc`)**: Strict type-checking in both `client/` and `server/` with zero allowable `any` bypasses.
- **Static Code Analysis (`eslint`)**: Enforces code style, unused variable detection, and React hook invariants across both packages.
- **Production Bundle Validation (`vite build`, `tsc -p tsconfig.json`)**: Verifies that client and server compile into valid, warning-free distribution artifacts.
- **Service Liveness Check**: Automated verification of `GET /api/health` returning HTTP 200 `{"status": "ok"}`.

---

## 2. Planned Test Suites (Architectural Design)

> [!NOTE]
> The test suites listed below represent planned test coverage to be introduced across Days 2–9 alongside feature implementations. None of these automated test suites are implemented yet.

### A. Unit Tests (Planned)
- **Geometry & Math Utilities**: Test bounding-box intersections, point-in-polygon checks, stroke smoothing, and canvas coordinate transformations.
- **State Reducers / Operation Handlers**: Pure unit tests verifying that applying a `CREATE_OBJECT`, `UPDATE_OBJECT`, or `DELETE_OBJECT` produces deterministic `CanvasState` transitions.
- **Validation**: Schema tests ensuring invalid object shapes (e.g., negative dimensions or malformed colors) are rejected.

### B. Integration Tests (Planned)
- **REST API Routes**: Test Express routes using Supertest for request parameter parsing, error status codes, and JSON response compliance.
- **Persistence Layer**: Test MongoDB snapshot serialization and retrieval against a memory-backed database.

### C. WebSocket & Room Tests (Planned)
- **Room Lifecycle**: Verify that multiple virtual clients can connect, join specific rooms, receive correct broadcasts, and cleanly disconnect.
- **Message Framing**: Test serialization/deserialization of `WebSocketMessage` payloads.

### D. Concurrent Editing & Conflict Tests (Planned)
- **Simultaneous Attribute Edits**: Simulate two simulated clients dispatching conflicting operations on the same object to ensure deterministic convergence.
- **Reordering Races**: Test z-index resolution when two clients reorder layers simultaneously.

### E. End-to-End (E2E) Collaboration Tests (Planned)
- Playwright multi-browser automation launching two concurrent browser windows, simulating user strokes in Client A, and verifying visual canvas reproduction in Client B within 100ms.

### F. Performance & Load Tests (Planned)
- **Object Scale Benchmark**: Measure canvas render frame rates with 1,000, 5,000, and 10,000 active objects.
- **Throughput Test**: Stress-test backend WebSocket message dissemination under high concurrent cursor/operation broadcast rates.
