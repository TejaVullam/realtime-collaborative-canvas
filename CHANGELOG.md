# Changelog

All notable changes to this project will be documented in this file.

## Day 1 — Architecture & Domain Foundation

- Established modular layered architecture in `server/` with dedicated `config/`, `controllers/`, and `routes/` modules.
- Refactored server entry point (`server/src/index.ts`) while maintaining backward-compatible `GET /api/health` behavior.
- Defined core canvas domain model (`client/src/types/canvas.ts` and `server/src/types/canvas.ts`) featuring:
  - `BaseCanvasObject` common properties (coordinates, transforms, layering, audit data).
  - Discriminated union types for concrete canvas objects (`RectangleObject`, `EllipseObject`, `LineObject`, `StrokeObject`, `TextObject`).
  - Container model for `CanvasState` (hash map index, ordering array, monotonic versioning).
  - Atomic operation model (`CanvasOperation`) supporting `CREATE_OBJECT`, `UPDATE_OBJECT`, `DELETE_OBJECT`, `MOVE_OBJECT`, and `REORDER_OBJECT` with unique IDs, client attributions, and timestamps.
- Expanded comprehensive architectural documentation in `docs/`:
  - `architecture.md`: Target vs current implementation, Mermaid architecture diagram, subsystem breakdowns.
  - `api.md`: Active `/api/health` specification and planned REST endpoints.
  - `websocket.md`: WebSocket protocol specification, connection lifecycle, and message envelope.
  - `synchronization.md`: Multi-client concurrency requirements, candidate approaches (Server-Authoritative, OT, CRDT, Hybrid), and evaluation status.
  - `database.md`: Conceptual data models (User, Room, Canvas, Snapshot, Operation) and relationships.
  - `decisions.md`: Recorded ADR-001 through ADR-004.
  - `testing.md`: Active static checks and planned unit, integration, and E2E test suites.
  - `deployment.md`: Planned cloud deployment topology (Vercel, Cloud Node.js API, MongoDB Atlas).
- Updated root `README.md` to reflect Day 1 milestone completion.

## Day 0 — Project Initialization

- Initialized repository structure with `client/`, `server/`, and `docs/`.
- Configured client with React 19, TypeScript 5.7, Vite 6, Tailwind CSS 4, ESLint 9, and Prettier.
- Created minimal Day 0 frontend placeholder.
- Configured server with Node.js, Express, TypeScript, ESLint 9, Prettier, and `server/.env.example`.
- Implemented `GET /api/health` endpoint.
- Added documentation skeleton in `docs/` (`architecture.md`, `api.md`, `websocket.md`, `synchronization.md`, `database.md`, `deployment.md`, `testing.md`, `decisions.md`).
- Added root `.gitignore`, `.editorconfig`, `LICENSE` (MIT), and `README.md`.
