# Real-Time Collaborative Digital Canvas

> A real-time collaborative digital canvas designed for multi-user visual collaboration.

## Status

🚧 Day 2 — Canvas Engine

The project is currently under active development.

## Project Overview

A collaborative digital canvas workspace designed for real-time visual collaboration across distributed teams and creators.

## Roadmap & Status

| Day | Focus | Status |
|-----|-------|--------|
| Day 0 | Project initialization | ✅ |
| Day 1 | Architecture foundation | ✅ |
| Day 2 | Canvas engine | ✅ |
| Day 3 | Authentication & rooms | ⏳ |
| Day 4 | WebSocket infrastructure | ⏳ |
| Day 5 | Real-time collaboration | ⏳ |
| Day 6 | Synchronization & conflict resolution | ⏳ |
| Day 7 | Presence & collaboration UX | ⏳ |
| Day 8 | Persistence & history | ⏳ |
| Day 9 | Testing, polish & deployment | ⏳ |
| Day 10 | Documentation & final release | ⏳ |

## Features

### Implemented (Days 0–2)
- **HTML5 Canvas Rendering Engine**: High-performance 2D procedural rendering pipeline with infinite dot grid background.
- **Structured Object Rendering**: Native vector rendering for rectangles, ellipses, lines, freehand strokes, and text with transformation matrix support (`x`, `y`, `rotation`, `scaleX`, `scaleY`, `opacity`).
- **Interactive Tool System**: Floating workspace toolbar providing `Select & Move (V)`, `Rectangle (R)`, `Ellipse (O)`, `Line (L)`, `Pencil (P)`, `Text (T)`, and `Pan Canvas (H)`.
- **Shape Creation with Live Preview**: Interactive drag-creation with normalized bounding boxes and real-time visual feedback.
- **Object Selection & Manipulation**: Bounding box selection, corner resize handles (`nw`, `ne`, `se`, `sw`), responsive drag movement, and keyboard deletion (`Delete` / `Backspace`).
- **Viewport Navigation**: Pointer-centered mouse wheel zooming ($0.1\times$ to $5.0\times$) and pan navigation (`Space + drag` or Pan tool).
- **High-DPI / Retina Display Support**: Dynamic backing store resolution scaling via `window.devicePixelRatio`.
- **Local Canvas State Management**: Deterministic state transitions powered by `useReducer`.
- **Automated Unit Testing Suite**: Vitest suite with 16 passing unit tests covering geometry, coordinate conversion, and hit-testing.
- **System Architecture & Documentation**: Modular backend service, domain models, and comprehensive architecture records in `docs/`.

### Planned
- User authentication and session management (Day 3)
- Multi-user collaborative rooms and canvas scoping (Day 3)
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
```

The backend health check is accessible at `http://localhost:5000/api/health`.

## Project Status

Day 2 of 10
