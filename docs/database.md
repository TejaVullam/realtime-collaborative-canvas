# Database Architecture & Conceptual Schema

> [!NOTE]
> Database integration has been initialized in **Day 3** using MongoDB and Mongoose. The `User` schema is currently active with unique indexes and password hash protection. The remaining models (`Room`, `Canvas`) are integrated for room boundaries, while temporal snapshots and operation log tables are planned for Day 8 persistence.

---

## 1. Overview

The persistent layer will store long-lived workspace entities: registered users, collaboration rooms, canvas documents, temporal state snapshots, and operation logs.

---

## 2. Conceptual Data Models

### A. User Entity (Active — Day 3)

- **Purpose**: Represents an authenticated workspace member or registered collaborator.
- **Key Fields**:
  - `_id` / `id`: Unique ObjectId.
  - `email`: User's primary email address (unique, indexed, trimmed, lowercase).
  - `name`: Display name (trimmed).
  - `passwordHash`: Bcrypt hash (work factor 10 salt rounds, `select: false`).
  - `createdAt`: ISO Date timestamp.
  - `updatedAt`: ISO Date timestamp.
- **Indexes**: `email: 1` (unique).
- **Relationships**: One user owns many rooms; is a member of many rooms.

### B. Room Entity (Active — Day 3)

- **Purpose**: Collaboration session container defining workspace boundaries and membership authorization.
- **Key Fields**:
  - `_id` / `id`: Unique ObjectId.
  - `name`: Human-readable room title.
  - `ownerId`: Foreign reference to `User._id` (indexed).
  - `canvasId`: Foreign reference to default associated `Canvas._id` (indexed).
  - `members`: Array of `{ userId: ObjectId (ref User), role: 'owner' | 'member', joinedAt: Date }`.
  - `createdAt`: ISO Date timestamp.
  - `updatedAt`: ISO Date timestamp.
- **Indexes**: `ownerId: 1`, `canvasId: 1`, `members.userId: 1`.
- **Relationships**: Belongs to an owner `User`; contains authorized member `Users`; references an associated `Canvas`.

### C. Canvas Entity (Active — Day 3 Foundation)

- **Purpose**: Document container representing an individual visual workspace linked to a Room.
- **Key Fields**:
  - `_id` / `id`: Unique ObjectId.
  - `roomId`: Foreign reference to `Room._id` (indexed).
  - `metadata`: `{ name: string, backgroundColor: string, ownerId: ObjectId, createdAt: number, updatedAt: number }`.
  - `createdAt`: ISO Date timestamp.
  - `updatedAt`: ISO Date timestamp.
- **Indexes**: `roomId: 1`.
- **Relationships**: Belongs to a single Room. Historical operation logs and snapshot persistence will be added in Day 8.

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
