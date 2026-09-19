# Database Architecture & Conceptual Schema

> [!NOTE]
> Database integration has been initialized in **Day 3** using MongoDB and Mongoose. The `User` schema is currently active with unique indexes and password hash protection. The remaining models (`Room`, `Canvas`) are integrated for room boundaries, while temporal snapshots and operation log tables are planned for Day 8 persistence.

---

## 1. Overview

The persistent layer will store long-lived workspace entities: registered users, collaboration rooms, canvas documents, temporal state snapshots, and operation logs.

---

## 2. Conceptual Data Models

### A. User Entity

- **Purpose**: Represents an authenticated workspace member or registered collaborator.
- **Key Fields**:
  - `id`: Unique identifier (string / ObjectId).
  - `email`: User's primary email address (unique, indexed).
  - `name`: Display name.
  - `avatarUrl`: Optional profile image URL.
  - `createdAt`: Timestamp.
  - `updatedAt`: Timestamp.
- **Relationships**: One user can own multiple rooms and canvases; can be invited to multiple rooms.

### B. Room Entity

- **Purpose**: A collaboration session container that groups participants, permissions, and active canvases.
- **Key Fields**:
  - `id`: Unique room identifier (e.g., UUID or nanoid).
  - `name`: Human-readable room title.
  - `ownerId`: Foreign reference to `User.id`.
  - `activeCanvasId`: Foreign reference to the current default `Canvas.id`.
  - `isPublic`: Boolean flag governing open room access.
  - `createdAt`: Timestamp.
  - `updatedAt`: Timestamp.
- **Relationships**: References one owner; contains many authorized participants; references one or more canvases.

### C. Canvas Entity

- **Purpose**: Core document metadata representing an individual visual workspace.
- **Key Fields**:
  - `id`: Unique canvas identifier.
  - `roomId`: Foreign reference to `Room.id`.
  - `name`: Canvas title.
  - `version`: Monotonically increasing version integer.
  - `backgroundColor`: Default hex string (e.g., `#0f172a`).
  - `createdAt`: Timestamp.
  - `updatedAt`: Timestamp.
- **Relationships**: Belongs to a single Room; has many historical `Operation` records and periodic `Snapshot` documents.

### D. Snapshot Entity

- **Purpose**: Periodic point-in-time full state captures of a canvas for fast initial loading without replaying thousands of operations.
- **Key Fields**:
  - `id`: Unique snapshot identifier.
  - `canvasId`: Foreign reference to `Canvas.id` (indexed).
  - `version`: Version number corresponding to this snapshot state.
  - `objects`: Full serialized JSON representation of `Record<string, CanvasObject>`.
  - `objectOrder`: Array of object IDs representing z-ordering.
  - `createdAt`: Timestamp of snapshot capture.
- **Relationships**: Belongs to a Canvas; serves as baseline for incremental operations.

### E. Operation Entity (Append-Only Log)

- **Purpose**: Immutable audit log of individual canvas changes for history replay, undo/redo synchronization, and conflict reconciliation.
- **Key Fields**:
  - `id`: Unique operation identifier (`operationId`).
  - `canvasId`: Foreign reference to `Canvas.id` (indexed).
  - `clientId`: Client identifier that submitted the change.
  - `type`: Operation discriminator (`CREATE_OBJECT`, `UPDATE_OBJECT`, etc.).
  - `objectId`: Targeted canvas object identifier.
  - `payload`: Serialized operation delta.
  - `sequenceNumber`: Monotonic sequence number within the canvas.
  - `createdAt`: Wall-clock timestamp.
- **Relationships**: Belongs to a Canvas; ordered by `sequenceNumber`.
