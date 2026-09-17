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
