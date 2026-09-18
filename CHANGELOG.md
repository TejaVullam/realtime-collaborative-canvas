# Changelog

All notable changes to this project will be documented in this file.

## Day 2 — Canvas Engine

- Implemented HTML5 Canvas rendering engine with procedural `renderCanvas` pipeline.
- Added High-DPI / Retina display support via `window.devicePixelRatio` and responsive container scaling via `ResizeObserver`.
- Added renderers for all domain object types (`RectangleObject`, `EllipseObject`, `LineObject`, `StrokeObject`, `TextObject`) supporting coordinate transforms, rotation, scaling, and opacity.
- Created interactive tool system with `Select & Move (V)`, `Rectangle (R)`, `Ellipse (O)`, `Line (L)`, `Pencil (P)`, `Text (T)`, and `Pan (H)` tools.
- Implemented real-time interactive creation previews for rectangles, ellipses, lines, and freehand pencil strokes.
- Implemented geometric hit-testing across all shape types with reverse z-order priority scanning.
- Implemented object selection with dashed bounding box visualization and 4 corner resize handles (`nw`, `ne`, `se`, `sw`).
- Implemented object movement, corner handle resizing, and keyboard deletion (`Delete` / `Backspace`).
- Implemented viewport pan navigation (`Space + drag` or Pan tool) and pointer-centered mouse wheel zooming ($0.1\times$ to $5.0\times$).
- Built floating glassmorphism `CanvasToolbar` with color swatches and stroke width selectors.
- Built bottom `CanvasStatusBar` showing zoom percentage, object count, active tool, and selection details.
- Added automated unit test suite using Vitest with 16 tests covering coordinate conversion, geometry normalization, and hit-testing.
- Updated documentation:
  - `architecture.md`: Documented canvas rendering pipeline, camera coordinate system, hit-testing, and Mermaid diagram.
  - `testing.md`: Documented automated Vitest suite and manual browser test results.
  - `decisions.md`: Added ADR-005 (HTML5 Canvas Rendering Engine).

## Day 1 — Architecture & Domain Foundation

- Established modular layered architecture in `server/` with dedicated `config/`, `controllers/`, and `routes/` modules.
- Refactored server entry point (`server/src/index.ts`) while maintaining backward-compatible `GET /api/health` behavior.
- Defined core canvas domain model (`client/src/types/canvas.ts` and `server/src/types/canvas.ts`) featuring `BaseCanvasObject`, discriminated union `CanvasObject`, `CanvasState` container, and `CanvasOperation` model.
- Expanded comprehensive architectural documentation in `docs/` (`architecture.md`, `api.md`, `websocket.md`, `synchronization.md`, `database.md`, `decisions.md`, `testing.md`, `deployment.md`).
- Recorded ADR-001 through ADR-004.
- Updated root `README.md` to reflect Day 1 milestone completion.

## Day 0 — Project Initialization

- Initialized repository structure with `client/`, `server/`, and `docs/`.
- Configured client with React 19, TypeScript 5.7, Vite 6, Tailwind CSS 4, ESLint 9, and Prettier.
- Created minimal Day 0 frontend placeholder.
- Configured server with Node.js, Express, TypeScript, ESLint 9, Prettier, and `server/.env.example`.
- Implemented `GET /api/health` endpoint.
- Added documentation skeleton in `docs/`.
- Added root `.gitignore`, `.editorconfig`, `LICENSE` (MIT), and `README.md`.
