# Testing Strategy

This document outlines the testing methodology, active quality checks, automated test suites, and planned tests for the Real-Time Collaborative Canvas.

---

## 1. Implemented Quality Checks & Automated Tests (Day 2)

As of Day 2, the following automated test suites and validation checks are operational:

### A. Unit Tests (Vitest)

A fast, lightweight unit test suite powered by Vitest executes via `npm test` in `client/`:

1. **Coordinate Conversion Tests (`coordinates.test.ts`)**:
   - Screen-to-world coordinate un-projection with scale and pan offsets.
   - World-to-screen projection.
   - Invariance of cursor world-space coordinate during mouse-wheel zooming.
   - Min/max zoom clamping ($0.1\times$ to $5.0\times$).
2. **Geometry Utilities Tests (`geometry.test.ts`)**:
   - Bounding box normalization for multi-directional drag gestures (top-left to bottom-right, bottom-right to top-left).
   - Euclidean distance calculations.
   - Point-to-line segment distance calculation.
   - Axis-aligned bounding box extraction for rectangles and ellipses.
   - 4-corner resize handle generation (`nw`, `ne`, `se`, `sw`).
3. **Hit-Testing Tests (`hitTesting.test.ts`)**:
   - Point-in-rectangle containment.
   - Point-in-ellipse quadratic evaluation.
   - Point-to-line proximity within stroke threshold.
   - Reverse z-order hit testing (verifies top-most object is selected first when elements overlap).
   - Resize handle hit detection.

**Test Results Summary**:
```text
✓ src/features/canvas/utils/__tests__/coordinates.test.ts (4 tests)
✓ src/features/canvas/utils/__tests__/geometry.test.ts (7 tests)
✓ src/features/canvas/utils/__tests__/hitTesting.test.ts (5 tests)

Test Files  3 passed (3)
Tests       16 passed (16)
```

### B. Static Analysis & Compilation
- **TypeScript Compilation (`tsc`)**: Strict type checking with `verbatimModuleSyntax` across client and server.
- **ESLint Validation**: Validates code quality and React hook rules with zero allowable errors.
- **Production Build (`vite build`)**: Generates optimized production bundles.

### C. Manual & Browser Verification (Browser Subagent)
- **Canvas Viewport & Scaling**: High-DPI backing store scaling verified on Retina resolution without pixelation.
- **Tool Selection**: Floating toolbar tool selection (`Select`, `Rectangle`, `Ellipse`, `Line`, `Pencil`, `Text`, `Pan`) verified.
- **Shape Drawing**: Verified interactive drag-drawing for rectangles, ellipses, and pencil strokes.
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
