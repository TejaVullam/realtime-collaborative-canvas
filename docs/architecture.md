# Architecture

This document details the system architecture for the Real-Time Collaborative Canvas, outlining both the current foundational state and the planned target architecture.

## Overview

The Real-Time Collaborative Canvas is designed as a decoupled, multi-user visual workspace enabling simultaneous manipulation of graphic entities with low latency, robust state synchronization, and reliable persistence.

## Current Implementation (Day 4)

As of Day 4, the system establishes:
- **WebSocket Infrastructure**: Low-latency, bidirectional WebSocket server built with `ws` mounting directly on the shared Node.js HTTP server at `/ws`.
- **Authenticated Sockets**: Handshake JWT authentication verifying credentials with `AuthService.verifyToken()` and binding immutable user identities into `AuthenticatedSocketContext`.
- **In-Memory Room Management**: Dedicated `RoomManager` tracking active socket sets per room, cleanly separated from persistent MongoDB `Room` membership records, with automatic cleanup of empty rooms.
- **Real-Time Canvas Collaboration (Day 5)**: Multi-user operation synchronization pipeline:
  $$\text{Canvas UI} \rightarrow \text{Local Canvas Interaction} \rightarrow \text{CanvasOperation} \rightarrow \text{CollaborationService} \rightarrow \text{WebSocketClient} \rightarrow \text{WebSocketServer} \rightarrow \text{RoomManager} \rightarrow \text{Remote Clients} \rightarrow \text{applyCanvasOperation} \rightarrow \text{Canvas State Reducer} \rightarrow \text{Canvas Render}$$
- **Server Operation Validation & Authorization (Day 5)**: Strict runtime validation of operation envelopes and shape-specific payloads, persistent MongoDB room membership checks, sender exclusion, and client ACKs.
- **Client Duplicate Protection (Day 5)**: Bounded FIFO sets (1,000 operation capacity) suppressing duplicate network messages and local broadcast reflections.
- **Server Room Authorization (Day 4)**: Strict server-side verification ensuring clients can only join WebSocket rooms if they are registered members of the room in MongoDB.
- **Client Real-Time Connectivity (Day 4 / 4.1)**: Client-side `WebSocketClient` service featuring bounded exponential backoff reconnection with jitter (1s to 16s), automatic room rejoining upon reconnect, and clean explicit disconnect semantics.
- **Connection Status UI (Day 4)**: `ConnectionStatusBadge` displaying real-time connection state (`Connected`, `Connecting...`, `Reconnecting...`, `Error`, `Disconnected`) in the room canvas header.
- **Heartbeat & Liveness (Day 4)**: 30-second ping/pong connection health monitor and dead socket pruning.
- **User Authentication (Day 3)**: Secure user registration, credential verification, bcrypt password hashing, and JWT token issuance.
- **Room Management (Day 3)**: MongoDB `Room` and `Canvas` models with relational integrity (`User -> Room -> Canvas`).
- **Canvas Interaction Engine (Day 2 / 2.1)**: High-performance HTML5 2D canvas pipeline with pointer capture, geometric hit testing, transform matrix rendering, and viewport zoom/pan.

> [!IMPORTANT]
> Day 5 establishes **operation-based real-time canvas collaboration**. Advanced conflict resolution (CRDT / OT), live presence cursors, and persistent operation logging are **FUTURE — DAYS 6–7**.

## Target Architecture

```text
                         ┌──────────────┐
                         │     User     │
                         └──────┬───────┘
                                │
                         Authentication
                                │
                 ┌──────────────┴──────────────┐
                 │                             │
                 ▼                             ▼
            REST API                     WebSocket
                 │                             │
                 ▼                             ▼
             Room API                    Socket Auth
                 │                             │
                 │                       RoomManager
                 │                             │
                 └──────────────┬──────────────┘
                                ▼
                              Room
                                │
                                ▼
                              Canvas
                                │
                                ▼
                       LOCAL CANVAS STATE


        DAY 5 — REAL-TIME COLLABORATION PIPELINE (Active)
        ──────────────────────────────────────────────────
        Canvas Action ──► CanvasOperation ──► CollaborationService ──► WebSocket ──► Server Validation ──► Room Broadcast ──► Remote Canvas Reducer


        FUTURE — DAY 6
        ─────────────────
        Concurrent Operations ──► Conflict Resolution / OT / CRDT
```

```mermaid
flowchart TD
  subgraph Client ["Client (Browser SPA)"]
    UI["UI Layer (Toolbar & Status)"]
    Interaction["Canvas Interaction Layer"]
    Renderer["HTML5 Canvas Render Engine"]
    State["Local Canvas State Store (canvasStateReducer)"]
    App["Application Orchestrator"]
    CollabService["CollaborationService (Active - Day 5)"]
    WSClient["WebSocket Client (Active - Day 4/4.1)"]
    RESTClient["REST API Client (Active - Day 3)"]
    Badge["ConnectionStatusBadge (Active - Day 4)"]
    
    UI --> Interaction
    Interaction -->|Immediate Local Apply| State
    Interaction -->|Create CanvasOperation| CollabService
    CollabService -->|sendCanvasOperation| WSClient
    WSClient -->|Incoming CANVAS_OPERATION| CollabService
    CollabService -->|applyCanvasOperation| State
    State --> Renderer
    Renderer --> HTMLCanvas["<canvas> Viewport"]
    App --> RESTClient
    WSClient --> Badge
  end

  subgraph Gateway ["Shared Node HTTP Server (Port 5000)"]
    RESTClient -->|"HTTP / REST"| RESTAPI["Express REST API"]
    WSClient -->|"WS Handshake /ws?token=..."| WSGateway["WebSocket Server (ws)"]
  end

  subgraph Server ["Backend Services"]
    RESTAPI --> AuthRoutes["Auth Controller"]
    RESTAPI --> RoomRoutes["Room Controller"]
    
    WSGateway --> WSAuth["Socket Authenticator (JWT)"]
    WSAuth --> RoomManager["RoomManager (In-Memory Sockets)"]
    
    WSGateway -->|"Active - Day 5"| CanvasOpHandler["CanvasOperation Validation & Broadcast"]
    CanvasOpHandler --> RoomManager
    WSGateway -.->|"Future - Day 6"| SyncEngine["Sync & Conflict Engine"]
    WSGateway -.->|"Future - Day 7"| PresenceService["Live Cursors & Presence"]
  end

  subgraph Persistence ["Persistent Storage"]
    AuthRoutes --> MongoDB[("MongoDB: Users, Rooms, Canvases")]
    RoomRoutes --> MongoDB
    RoomManager -.->|"Validate Membership"| MongoDB
    CanvasOpHandler -.->|"Verify Room Membership"| MongoDB
  end
```
```

## Canvas Engine Architecture (Day 2)

### 1. Data Flow Pipeline

```text
Pointer Input (Mouse / Stylus)
      ↓
Interaction Layer (useCanvasInteraction)
      ↓
World Coordinates (screenToWorld)
      ↓
Local State Mutation (canvasStateReducer)
      ↓
Render Pipeline (renderCanvas)
      ↓
HTML5 2D Canvas Context (<canvas>)
```

### 2. Coordinate System

The engine strictly distinguishes **Screen Coordinates** from **World Coordinates**:

- **Screen Coordinates** ($s_x, s_y$): Physical CSS pixels relative to the top-left of the `<canvas>` viewport DOM element.
- **World Coordinates** ($w_x, w_y$): Infinite Cartesian space where objects are positioned and dimensioned.
- **Transformation Formula**:
  $$s_x = w_x \cdot \text{zoom} + \text{viewport.x}$$
  $$s_y = w_y \cdot \text{zoom} + \text{viewport.y}$$
- **Inverse Transformation (Un-projection)**:
  $$w_x = \frac{s_x - \text{viewport.x}}{\text{zoom}}$$
  $$w_y = \frac{s_y - \text{viewport.y}}{\text{zoom}}$$

### 3. Viewport & Camera Model

The `CanvasViewport` maintains:
- `x`, `y`: Pan offset translation in screen pixels.
- `zoom`: Scale multiplier (clamped between $0.1$ and $5.0$).
- **Zoom Invariance**: When zooming with the mouse wheel, the point under the cursor in world coordinates remains invariant, providing intuitive CAD/Figma-style navigation.

### 4. Rendering Pipeline

Rendering is decoupled from React component lifecycles to enable fluid, responsive performance:
1. **Device Pixel Ratio Scaling**: Canvas backing store is scaled by `window.devicePixelRatio`, preventing blurriness on Retina screens while CSS width/height remains responsive.
2. **Transform Reset**: Context matrix is cleared before each render frame.
3. **Infinite Dot Grid**: Screen-space dot pattern generated dynamically based on modulo arithmetic of viewport pan and zoom.
4. **World Transformation Matrix**: `ctx.translate(viewport.x, viewport.y)` and `ctx.scale(viewport.zoom, viewport.zoom)`.
5. **Layer Ordering**: Objects iterated strictly according to `canvasState.objectOrder` to preserve deterministic z-layering.
6. **Selection Overlay**: Active selection bounding box and 4 corner resize handles rendered in a top pass.
7. **Preview Layer**: In-flight creation previews (e.g. while dragging to draw shapes or freehand lines) rendered before commit.

### 5. Hit-Testing & Selection

Hit testing determines object intersection in world coordinates:
- **Rectangles**: Rotation-aware geometric hit testing using inverse rotation transforms into local coordinate space.
- **Ellipses**: Normalized quadratic distance check ($(\Delta x / r_x)^2 + (\Delta y / r_y)^2 \le 1$).
- **Lines & Strokes**: Minimum Euclidean distance to line segments with configurable stroke tolerance.
- **Reverse Z-Order Scanning**: Hit tests scan `objectOrder` in reverse order so the visually top-most object is selected first.

## Frontend Architecture

The client application is organized for modularity, testability, and clear separation of concerns:

- `src/components/`: Reusable, generic UI primitives.
- `src/pages/`: Top-level page containers and router views.
- `src/features/canvas/`:
  - `components/`: Master `Canvas.tsx`, `CanvasToolbar.tsx`, `CanvasStatusBar.tsx`.
  - `hooks/`: `useCanvasInteraction.ts`.
  - `rendering/`: `renderCanvas.ts`, `renderObject.ts`, `renderSelection.ts`.
  - `state/`: `canvasState.ts` reducer.
  - `types/`: `interaction.ts`.
  - `utils/`: `coordinates.ts`, `geometry.ts`, `hitTesting.ts`.
- `src/types/`: Domain models (`CanvasObject`, `CanvasOperation`, `CanvasState`), shape definitions, and API contracts.
- `src/utils/`: General utility helpers.

## Backend Architecture

The backend follows an idiomatic layered Express architecture:

- `src/config/`: Environment variable validation and runtime configuration loading.
- `src/controllers/`: HTTP request validation, input parsing, and response formatting.
- `src/routes/`: Route declarations and path routing.
- `src/services/`: Core business logic, room coordination, and state reconciliation (planned).
- `src/middleware/`: Authentication, rate limiting, and request logging middlewares (planned).
- `src/models/`: Data persistence schemas and queries (planned).
- `src/types/`: Shared domain models and TypeScript interfaces.
- `src/utils/`: Server utilities, error handlers, and logger abstractions.

## Domain Model

Canvas content is modeled as discrete structured objects rather than a raster bitmap.
- **Base Properties**: Every object contains an immutable `id`, discriminator `type`, geometric transforms (`x`, `y`, `rotation`, `scaleX`, `scaleY`), rendering attributes (`opacity`, `zIndex`), and audit metadata (`createdAt`, `updatedAt`, `createdBy`).
- **Discriminated Union**: Concrete types (`rectangle`, `ellipse`, `line`, `stroke`, `text`) define strict shape-specific attributes.
- **Canvas State**: `CanvasState` holds an object map (`Record<string, CanvasObject>`) for $O(1)$ mutation access, an `objectOrder` array for deterministic layering, and monotonic `version` tracking.
- **Operation Model**: Mutations are encapsulated as discrete `CanvasOperation` records (`CREATE_OBJECT`, `UPDATE_OBJECT`, `DELETE_OBJECT`, `MOVE_OBJECT`, `REORDER_OBJECT`).

## Communication

### REST API
- **Current**: Health check (`GET /api/health`).
- **Planned (Day 3)**: Room creation, canvas metadata retrieval, snapshot persistence.

### WebSocket (Planned - Day 4)
- Full-duplex transport for low-latency operational sync, presence awareness (cursors, active selections), and room event broadcasting.

## Persistence (Planned - Day 8)

Canvas state will be persisted using a snapshot-and-log strategy:
- Periodic or on-demand serialized snapshots of `CanvasState`.
- Incremental operation logs for temporal replay and version history.

## Synchronization (Planned - Day 6)

Concurrent modifications across clients will be reconciled via a dedicated synchronization engine. The evaluation between server-authoritative reconciliation, Operational Transformation (OT), and Conflict-free Replicated Data Types (CRDT) is underway.

## Scalability Considerations

- **Stateless API tier**: REST endpoints operate statelessly, allowing horizontal scaling behind standard load balancers.
- **Room affinity**: Real-time WebSocket connections will utilize sticky sessions or a Redis-backed pub/sub transport when scaling across multiple server processes.
- **Client performance**: Canvas objects will be indexed spatially to allow viewport culling and minimize redraw overhead.
