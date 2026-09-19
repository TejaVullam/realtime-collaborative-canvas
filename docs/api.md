# API Documentation

This document specifies the HTTP REST API boundaries for the Real-Time Collaborative Canvas.

---

## Implemented Endpoints

### 1. System Health Check

- **Endpoint**: `/api/health`
- **Method**: `GET`
- **Purpose**: Verifies that the backend HTTP service is alive, responsive, and ready to accept traffic.
- **Headers**: None required
- **Response**: `200 OK`
  ```json
  {
    "status": "ok"
  }
  ```

### 2. User Registration

- **Endpoint**: `/api/auth/register`
- **Method**: `POST`
- **Purpose**: Registers a new user account with secure password hashing (bcrypt, 10 salt rounds) and returns safe user data and a JWT token.
- **Request Body**:
  ```json
  {
    "name": "Teja Vullam",
    "email": "teja@example.com",
    "password": "secure-password"
  }
  ```
- **Response**: `201 Created`
  ```json
  {
    "user": {
      "id": "65f0a1b2c3d4e5f678901234",
      "name": "Teja Vullam",
      "email": "teja@example.com",
      "createdAt": "2026-09-19T18:00:00.000Z"
    },
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
  }
  ```
- **Errors**: `400 Bad Request` (validation failure), `409 Conflict` (email already registered).

### 3. User Login

- **Endpoint**: `/api/auth/login`
- **Method**: `POST`
- **Purpose**: Authenticates credentials and returns safe user data and a JWT session token.
- **Request Body**:
  ```json
  {
    "email": "teja@example.com",
    "password": "secure-password"
  }
  ```
- **Response**: `200 OK`
  ```json
  {
    "user": {
      "id": "65f0a1b2c3d4e5f678901234",
      "name": "Teja Vullam",
      "email": "teja@example.com",
      "createdAt": "2026-09-19T18:00:00.000Z"
    },
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
  }
  ```
- **Errors**: `401 Unauthorized` (safe generic "Invalid email or password" error).

### 4. Current Authenticated User

- **Endpoint**: `/api/auth/me`
- **Method**: `GET`
- **Purpose**: Retrieves the currently authenticated user based on the provided JWT Bearer token.
- **Headers**:
  ```http
  Authorization: Bearer <token>
  ```
- **Response**: `200 OK`
  ```json
  {
    "user": {
      "id": "65f0a1b2c3d4e5f678901234",
      "name": "Teja Vullam",
      "email": "teja@example.com",
      "createdAt": "2026-09-19T18:00:00.000Z"
    }
  }
  ```
- **Errors**: `401 Unauthorized` (missing, expired, or invalid token).

### 5. User Logout

- **Endpoint**: `/api/auth/logout`
- **Method**: `POST`
- **Purpose**: Signals user logout and prompts client-side token invalidation.
- **Response**: `200 OK`
  ```json
  {
    "message": "Logged out successfully"
  }
  ```

### 6. Create Collaboration Room

- **Endpoint**: `/api/rooms`
- **Method**: `POST`
- **Purpose**: Creates a new collaboration room, initializes an associated default canvas document, and assigns the authenticated user as owner and first member.
- **Headers**:
  ```http
  Authorization: Bearer <token>
  ```
- **Request Body**:
  ```json
  {
    "name": "Design Sprint Workspace"
  }
  ```
- **Response**: `201 Created`
  ```json
  {
    "id": "65f0a1b2c3d4e5f678901234",
    "name": "Design Sprint Workspace",
    "ownerId": "65f0a1b2c3d4e5f678900001",
    "canvasId": "65f0a1b2c3d4e5f678909999",
    "members": [
      {
        "userId": "65f0a1b2c3d4e5f678900001",
        "role": "owner",
        "joinedAt": "2026-09-19T18:00:00.000Z"
      }
    ],
    "createdAt": "2026-09-19T18:00:00.000Z",
    "updatedAt": "2026-09-19T18:00:00.000Z"
  }
  ```

### 7. List User's Rooms

- **Endpoint**: `/api/rooms`
- **Method**: `GET`
- **Purpose**: Lists all collaboration rooms where the authenticated user is a registered member.
- **Headers**:
  ```http
  Authorization: Bearer <token>
  ```
- **Response**: `200 OK`
  ```json
  {
    "rooms": [
      {
        "id": "65f0a1b2c3d4e5f678901234",
        "name": "Design Sprint Workspace",
        "ownerId": "65f0a1b2c3d4e5f678900001",
        "canvasId": "65f0a1b2c3d4e5f678909999",
        "members": [ ... ],
        "createdAt": "2026-09-19T18:00:00.000Z",
        "updatedAt": "2026-09-19T18:00:00.000Z"
      }
    ]
  }
  ```

### 8. Get Room Details

- **Endpoint**: `/api/rooms/:roomId`
- **Method**: `GET`
- **Purpose**: Retrieves room metadata and canvas relationship for members of the room. Non-members receive `403 Forbidden`.
- **Headers**:
  ```http
  Authorization: Bearer <token>
  ```
- **Response**: `200 OK`
  ```json
  {
    "id": "65f0a1b2c3d4e5f678901234",
    "name": "Design Sprint Workspace",
    "ownerId": "65f0a1b2c3d4e5f678900001",
    "canvasId": "65f0a1b2c3d4e5f678909999",
    "members": [ ... ],
    "createdAt": "2026-09-19T18:00:00.000Z",
    "updatedAt": "2026-09-19T18:00:00.000Z"
  }
  ```

### 9. Join Collaboration Room

- **Endpoint**: `/api/rooms/:roomId/join`
- **Method**: `POST`
- **Purpose**: Adds the authenticated user to the room's members list. Duplicate joins are idempotent and prevented.
- **Headers**:
  ```http
  Authorization: Bearer <token>
  ```
- **Response**: `200 OK`

### 10. Leave Collaboration Room

- **Endpoint**: `/api/rooms/:roomId/leave`
- **Method**: `POST`
- **Purpose**: Removes the authenticated user from the room membership. Room owners are restricted from leaving to prevent room orphaning.
- **Headers**:
  ```http
  Authorization: Bearer <token>
  ```
- **Response**: `200 OK`
  ```json
  {
    "message": "Successfully left the room"
  }
  ```

---

## Planned Endpoints (Architectural Proposals — Deferred to Future Days)

> [!NOTE]
> The endpoints listed below represent architectural boundaries designed for subsequent implementation phases (e.g. Day 8 full canvas snapshot persistence).

### 11. Fetch Persisted Canvas Snapshot (Day 8)

- **Endpoint**: `/api/canvases/:canvasId`
- **Method**: `GET`
- **Purpose**: Retrieves the current persisted snapshot and version of a canvas document for initial client state hydration.
- **Response**: `200 OK`
  ```json
  {
    "canvasId": "canvas_uuid_67890",
    "version": 42,
    "objects": {},
    "objectOrder": [],
    "metadata": {
      "name": "Sprint Retrospective Canvas",
      "createdAt": 1773715200000,
      "updatedAt": 1773715200000,
      "ownerId": "user_123"
    }
  }
  ```

### 5. Update Canvas Metadata

- **Endpoint**: `/api/canvases/:canvasId`
- **Method**: `PATCH`
- **Purpose**: Updates top-level canvas metadata (e.g., name, background color, viewport boundaries).
- **Response**: `200 OK`
