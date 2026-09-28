# Real-Time Collaborative Digital Canvas

> A real-time collaborative digital canvas designed for multi-user visual collaboration.

## Status

✅ Day 6 of 10 — Synchronization Correctness & Conflict Resolution

The project is currently under active development.

## Project Overview

A collaborative digital canvas workspace designed for real-time visual collaboration across distributed teams and creators.

## Roadmap & Status

| Day | Focus | Status |
|-----|-------|--------|
| Day 0 | Project initialization | ✅ |
| Day 1 | Architecture foundation | ✅ |
| Day 2 | Canvas engine | ✅ |
| Day 3 | Authentication & rooms | ✅ |
| Day 4 | WebSocket infrastructure | ✅ |
| Day 5 | Real-time collaboration | ✅ |
| Day 6 | Synchronization & conflict resolution | ✅ |
| Day 7 | Presence & collaboration UX | ⏳ |
| Day 8 | Persistence & history | ⏳ |
| Day 9 | Testing, polish & deployment | ⏳ |
| Day 10 | Final release | ⏳ |

## Features

### Implemented (Days 0–6)
- **Deterministic Synchronization & Ordering (Day 6)**: Server-authoritative monotonic sequence assignment (`serverSequence`) and global total ordering per canvas room, ensuring bit-for-bit identical canvas convergence across all connected peers.
- **Field-Level Last-Write-Wins (LWW) (Day 6)**: Conflict resolution allowing non-overlapping attribute patches (e.g. `fill` and `strokeWidth`) to merge cleanly, with timestamp- and sequence-based tie-breaking for concurrent mutations on the same field.
- **Deletion Dominance (Day 6)**: Strict deletion precedence where `DELETE_OBJECT` completely eliminates objects, neutralizing any concurrent or lagging mutations targeting that entity.
- **Client Out-of-Order Buffering & Catch-Up (Day 6)**: Client-side `CollaborationService` buffers out-of-sequence operations, triggers `SYNC_REQUEST` on sequence gaps, and automatically drains the buffer contiguously when missing sequences arrive.
- **Reconnection Sync Protocol (Day 6)**: Reconnecting clients issue `SYNC_REQUEST` with their `lastAppliedSequence` and catch up via `SYNC_RESPONSE` from the server's in-memory bounded history ($1,000$ operations per canvas).
- **Synchronization Health State Machine (Day 6)**: Real-time UI indicator tracking `synced`, `syncing`, and `diverged` status in `ConnectionStatusBadge`.
- **Real-Time Canvas Collaboration (Day 5)**: Multi-user operation synchronization where operations created by one client are sent over WebSocket, server-validated, and applied to other connected room members in real time.
- **Client CollaborationService (Day 5)**: Decoupled service abstraction managing operation dispatch, remote subscriptions, and bounded duplicate suppression.
- **Pure Operation Application Engine (`applyCanvasOperation`) (Day 5)**: Centralized state mutation path handling `CREATE_OBJECT`, `UPDATE_OBJECT`, `DELETE_OBJECT`, `MOVE_OBJECT`, and `REORDER_OBJECT` identically for both local interactions and remote broadcasts.
- **Strict Server Validation & Authorization (Day 5 / 5.1)**: Strict validation of operation envelopes and shape payloads (`rectangle`, `ellipse`, `line`, `stroke`, `text`), mutable field allowlist for updates, and persistent MongoDB room authorization.
- **Sender Exclusion & Server ACKs (Day 5)**: Server broadcasts remote operations only to other clients in the room and returns an explicit `CANVAS_OPERATION_ACK` containing canonical sequence metadata to the sender.
- **Bounded Duplicate Protection (Day 5)**: Bounded FIFO sets (1,000 operation capacity) on both client and server prevent duplicate application and protect against memory leaks.
- **Identity Spoofing Protection (Day 5)**: Server strictly binds `AuthenticatedSocketContext.userId` derived from the verified JWT, overriding any client-provided identity.
- **WebSocket Infrastructure (Day 4 / 4.1)**: High-performance WebSocket server powered by `ws` attached to Node HTTP server on `/ws`, with lifecycle hardening, reconnection backoff with jitter, room identity retention on network drop, and explicit disconnect semantics.
- **In-Memory Room Management (Day 4)**: Dedicated `RoomManager` handling active socket memberships with automatic empty room garbage collection.
- **User Authentication (Day 3)**: Secure registration and login with bcrypt password hashing (10 salt rounds), JWT Bearer token generation, and `/api/auth/me` profile verification.
- **Collaborative Room Management (Day 3)**: Mongoose `Room` and `Canvas` models supporting room creation, room listing by member, room joining via ID, and departure with owner orphan protection.
- **HTML5 Canvas Rendering Engine (Day 2 / 2.1)**: 2D procedural rendering pipeline with infinite dot grid background, Retina scaling, pointer capture, geometric hit testing, transform matrix rendering, and viewport zoom/pan.
- **Interactive Tool System**: Floating workspace toolbar providing `Select & Move (V)`, `Rectangle (R)`, `Ellipse (O)`, `Line (L)`, `Pencil (P)`, `Text (T)`, and `Pan Canvas (H)`.
- **Automated Test Suites**: 67 frontend unit & synchronization tests + 69 backend integration, RoomManager, synchronization & WebSocket tests (136 tests total, 100% passing across 15 test files).

### Planned
- Live cursor presence, user color avatars, and selection indicators (Day 7)
- Persistent snapshots and operation history log in MongoDB (Day 8)
- Canvas export to PNG, SVG, and JSON (Day 9)
- Production cloud deployment (Day 9)

## Planned Architecture

System architecture, rendering pipeline, and data flow are documented in detail in [docs/architecture.md](docs/architecture.md).

## Tech Stack

### Frontend
- React 19
- TypeScript 5.7
- Vite 6
- Tailwind CSS 4
- Vitest

### Backend
- Node.js
- TypeScript 5.7
- Express

### Planned Infrastructure
- WebSockets
- MongoDB
- Redis if required
- Cloud deployment

## Documentation

- [Architecture Overview](docs/architecture.md)
- [API Documentation](docs/api.md)
- [WebSocket Protocol](docs/websocket.md)
- [Synchronization Strategy](docs/synchronization.md)
- [Database Schema](docs/database.md)
- [Deployment Guide](docs/deployment.md)
- [Testing Strategy](docs/testing.md)
- [Architecture Decision Records](docs/decisions.md)

## Development

### Prerequisites
- Node.js (v18+ recommended)
- npm

### Frontend Setup
```bash
cd client
npm install
npm run dev

# Run unit tests
npm test

# Run linter
npm run lint
```

### Backend Setup
```bash
cd server
npm install
npm run dev

# Run unit and integration tests
npm test

# Run linter
npm run lint
```

#### Environment Variables (`server/.env`)
Create a `.env` file in `server/` (see `server/.env.example`):
```env
PORT=5000
NODE_ENV=development
MONGODB_URI=mongodb://localhost:27017/collaborative_canvas
JWT_SECRET=your_jwt_secret_key_minimum_32_characters
JWT_EXPIRES_IN=7d
CLIENT_URL=http://localhost:5173
```

The backend health check is accessible at `http://localhost:5000/api/health`.

## Project Status

Day 5 of 10 — Real-Time Canvas Collaboration Complete
