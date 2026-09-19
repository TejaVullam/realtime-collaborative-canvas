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

---

## Planned Endpoints (Architectural Proposals — Not Yet Implemented)

> [!NOTE]
> The endpoints listed below represent architectural boundaries designed for subsequent implementation phases. None of these endpoints are active on Day 1.

### 2. Create Collaboration Room

- **Endpoint**: `/api/rooms`
- **Method**: `POST`
- **Purpose**: Creates a new collaboration room and initializes an associated default canvas document.
- **Request Body**:
  ```json
  {
    "name": "Sprint Retrospective Canvas"
  }
  ```
- **Response**: `201 Created`
  ```json
  {
    "roomId": "room_uuid_12345",
    "canvasId": "canvas_uuid_67890",
    "createdAt": 1773715200000
  }
  ```

### 3. Get Room Details

- **Endpoint**: `/api/rooms/:roomId`
- **Method**: `GET`
- **Purpose**: Fetches metadata for an existing room, including authorized participants and linked canvas identifiers.
- **Response**: `200 OK`

### 4. Fetch Canvas Document

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
