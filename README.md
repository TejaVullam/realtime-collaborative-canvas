# Real-Time Collaborative Digital Canvas

> A real-time collaborative digital canvas designed for multi-user visual collaboration.

## Status

🚧 Day 0 — Project Initialization

The project is currently under active development.

## Project Overview

A collaborative digital canvas workspace designed for real-time visual collaboration across distributed teams and creators.

## Roadmap & Status

| Day | Focus | Status |
|-----|-------|--------|
| Day 0 | Project initialization | ✅ |
| Day 1 | Architecture foundation | ⏳ |
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

### Implemented (Day 0)
- Project baseline structure & configuration
- Client setup with React, TypeScript, Vite, Tailwind CSS
- Server setup with Express, TypeScript, and basic health check endpoint
- Development scripts, linting, and formatting tools
- Documentation skeleton

### Planned
- Collaborative drawing
- Shapes
- Text
- Real-time synchronization
- Multi-user presence
- Persistent canvas state
- Conflict resolution
- Version history
- Export

## Planned Architecture

> Architecture details and diagram will be documented in [docs/architecture.md](docs/architecture.md) once the core system architecture is finalized.

## Tech Stack

### Frontend
- React
- TypeScript
- Vite
- Tailwind CSS

### Backend
- Node.js
- TypeScript
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

Day 0 of 10
