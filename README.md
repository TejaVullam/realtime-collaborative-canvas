# Real-Time Collaborative Digital Canvas

> A real-time collaborative digital canvas designed for multi-user visual collaboration.

## Status

🚧 Day 1 — Architecture & Domain Foundation

The project is currently under active development.

## Project Overview

A collaborative digital canvas workspace designed for real-time visual collaboration across distributed teams and creators.

## Roadmap & Status

| Day | Focus | Status |
|-----|-------|--------|
| Day 0 | Project initialization | ✅ |
| Day 1 | Architecture foundation | ✅ |
| Day 2 | Canvas engine | ⏳ |
| Day 3 | Authentication & rooms | ⏳ |
| Day 4 | WebSocket infrastructure | ⏳ |
| Day 5 | Real-time collaboration | ⏳ |
| Day 6 | Synchronization & conflict resolution | ⏳ |
| Day 7 | Presence & collaboration UX | ⏳ |
| Day 8 | Persistence & history | ⏳ |
| Day 9 | Testing, polish & deployment | ⏳ |
| Day 10 | Documentation & final release | ⏳ |

## Features

### Implemented (Day 0 & Day 1)
- Initial system architecture and modular directory layout
- Canvas domain model with discriminated union types for graphic entities
- Canvas operation mutation model (`CanvasOperation`) with idempotency and ordering support
- Decoupled `CanvasState` representation
- Comprehensive architecture and protocol documentation in `docs/`
- Express backend architecture with modular configuration, controllers, and routes
- Health check verification endpoint (`GET /api/health`)
- Vite + React + TypeScript + Tailwind CSS development setup with strict linting

### Planned
- Canvas rendering engine (HTML5 Canvas)
- Collaborative drawing tools (pencil, brush, shapes, text, selection)
- Real-time WebSocket synchronization
- Multi-user presence and live cursor tracking
- Room management and access control
- Persistent canvas snapshots and operation history
- Conflict resolution engine
- Canvas export (PNG, SVG, JSON)

## Planned Architecture

System architecture and data flow are documented in detail in [docs/architecture.md](docs/architecture.md).

## Tech Stack

### Frontend
- React 19
- TypeScript 5.7
- Vite 6
- Tailwind CSS 4

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
```

### Backend Setup
```bash
cd server
npm install
npm run dev
```

The backend health check will be accessible at `http://localhost:5000/api/health`.

## Project Status

Day 1 of 10
