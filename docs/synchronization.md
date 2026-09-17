# Synchronization Strategy

> [!NOTE]
> State synchronization is **under architectural evaluation** as of Day 1. No synchronization engine (OT, CRDT, or custom broker) has been implemented yet.

---

## 1. Problem Statement

In a multi-user collaborative canvas, multiple distributed clients modify shared graphical entities simultaneously over asynchronous, variable-latency network connections. Without a robust synchronization strategy, clients face:
- Conflicting simultaneous modifications to identical objects (e.g., Alice changes fill color to red while Bob changes it to blue).
- Race conditions during element reordering or concurrent object deletions.
- Visual state divergence where different users perceive differing canvas states.

---

## 2. Requirements

1. **Low Latency (<50ms local feel)**: Local interactions must render optimistically with zero perceptible user interface lag.
2. **Consistency & Deterministic Convergence**: All clients participating in a room must ultimately converge on identical canvas state.
3. **Duplicate Operation Handling**: Retried network requests must not duplicate objects or double-apply transformations (idempotency).
4. **Resilient Reconnection**: Reconnecting clients must cleanly reconcile local uncommitted edits with remote changes that occurred during disconnects.
5. **Conflict Handling**: Concurrent attribute edits on the same object must resolve deterministically (e.g., Last-Write-Wins based on logical clocks or attribute-level merging).

---

## 3. Candidate Approaches

### A. Server-Authoritative State with Optimistic Local Updates
- **Mechanism**: The backend server maintains the single source of truth. The client renders changes optimistically, dispatches operations to the server, and reconciles upon receiving the server's ordered sequence.
- **Pros**: Simple conceptual model, lightweight payload sizes, straightforward access control.
- **Cons**: Requires continuous round-trip validation; network partitions can trigger noticeable rollbacks.

### B. Operational Transformation (OT)
- **Mechanism**: Operations sent between clients are transformed against concurrently executed operations using transformation functions.
- **Pros**: Mature in text editing paradigms (e.g., Google Docs).
- **Cons**: Substantial mathematical complexity; high implementation burden for multi-property graphical canvas operations (geometry, z-indices, grouping).

### C. Conflict-Free Replicated Data Types (CRDT)
- **Mechanism**: Canvas objects are modeled as replicated data structures (e.g., LWW-Element-Set or Map CRDT) where operations commute mathematically, guaranteeing eventual consistency without a central coordinator.
- **Pros**: Peer-to-peer friendly, robust offline capabilities, deterministic mathematical convergence.
- **Cons**: Higher memory overhead (tombstones, metadata per attribute), larger state transfer footprints.

### D. Hybrid Approach (Object-Level LWW + Server Sequencing)
- **Mechanism**: Server acts as a sequencer assigning Lamport timestamps / sequence numbers. Within individual canvas objects, mutations apply Last-Write-Wins (LWW) at the property level.
- **Pros**: Highly efficient for discrete canvas entities, avoids heavy CRDT metadata overhead while preserving deterministic convergence.

---

## 4. Architectural Decision

- **Status**: **Not finalized on Day 1**.
- Selecting an implementation prematurely before testing canvas rendering performance (Day 2) and WebSocket networking (Days 4–5) risks locking into unnecessary complexity.
- The `CanvasOperation` domain model defined in Day 1 is intentionally decoupled to support any of the candidate models.

---

## 5. Next Investigation

During Days 4–6, we will benchmark:
1. Operation serialization overhead.
2. Conflict frequencies in typical multi-user drawing scenarios.
3. Complexity vs. performance trade-offs between Hybrid Server-Sequenced LWW and Map-based CRDTs.
