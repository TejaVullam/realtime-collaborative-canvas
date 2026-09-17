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
