# Real-Time Collaborative Digital Canvas

> A real-time collaborative digital canvas designed for multi-user visual collaboration.

## Status

✅ Day 3 — Authentication & Collaborative Rooms

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
| Day 4 | WebSocket infrastructure | ⏳ |
| Day 5 | Real-time collaboration | ⏳ |
| Day 6 | Synchronization & conflict resolution | ⏳ |
| Day 7 | Presence & collaboration UX | ⏳ |
| Day 8 | Persistence & history | ⏳ |
| Day 9 | Testing, polish & deployment | ⏳ |
| Day 10 | Documentation & final release | ⏳ |

## Features

### Implemented (Days 0–3)
- **User Authentication**: Secure registration and login with bcrypt password hashing (10 salt rounds), JWT Bearer token generation, and `/api/auth/me` profile verification.
- **Collaborative Room Management**: Mongoose `Room` and `Canvas` models supporting room creation, room listing by member, room joining via ID, and departure with owner orphan protection.
- **Client Workspace Dashboard**: Modern dark-mode UI with `LoginForm`, `RegisterForm`, and `Dashboard` allowing users to create rooms, join via ID, and launch into canvas workspaces.
- **Canvas Inside Room Context**: Canvas loads with room context (room name, room ID, back-to-dashboard navigation).
- **Canvas Interaction Hardening (Day 2.1)**:
  - Pointer capture (`setPointerCapture`) and safe release on `pointerup` and `pointercancel`.
  - Comprehensive interaction ref cleanup preventing stuck drawing or panning states.
  - Rotation-aware geometric hit testing for rotated rectangles.
  - Robust 4-corner resizing enforcing minimum dimensions (10px) with stable reverse dragging.
  - Pure state reducer unit tests covering `ADD_OBJECT`, `UPDATE_OBJECT`, `MOVE_OBJECT`, `DELETE_OBJECT`, and `SET_STATE`.
  - Defensive rendering guards preventing crashes on malformed shapes.
  - Keyboard shortcut isolation preventing tool changes during text input.
- **HTML5 Canvas Rendering Engine**: 2D procedural rendering pipeline with infinite dot grid background and Retina scaling.
- **Structured Object Rendering**: Native vector rendering for rectangles, ellipses, lines, freehand strokes, and text.
- **Interactive Tool System**: Floating workspace toolbar providing `Select & Move (V)`, `Rectangle (R)`, `Ellipse (O)`, `Line (L)`, `Pencil (P)`, `Text (T)`, and `Pan Canvas (H)`.
- **Viewport Navigation**: Pointer-centered mouse wheel zooming ($0.1\times$ to $5.0\times$) and infinite panning.
- **Automated Test Suites**: 28 frontend unit tests + 25 backend integration & security tests (53 tests total, all passing).

### Planned
- Real-time WebSocket bidirectional communication (Day 4)
- Live cursor presence and collaborative awareness (Day 5 & 7)
- Multi-client operational state synchronization and conflict resolution (Day 5 & 6)
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

Day 3 of 10 — Authentication & Collaborative Rooms Complete
