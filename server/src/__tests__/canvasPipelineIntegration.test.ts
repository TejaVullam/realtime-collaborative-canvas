import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import http from 'http';
import mongoose from 'mongoose';
import { WebSocket } from 'ws';
import app from '../app.js';
import { User } from '../models/User.js';
import { Room } from '../models/Room.js';
import { connectDB, disconnectDB } from '../config/database.js';
import { AuthService } from '../services/auth.service.js';
import { RoomService } from '../services/room.service.js';
import { createWebSocketServer, type CollaborativeWebSocketServer } from '../websocket/server.js';
import { RoomManager } from '../websocket/roomManager.js';
import type { BaseWebSocketMessage, ConnectedPayload, RoomJoinedPayload } from '../websocket/types.js';
import type { CanvasObject, CanvasOperation, CanvasState, RectangleObject } from '../types/canvas.js';

const TEST_DB_URI = 'mongodb://localhost:27017/collaborative_canvas_test_pipeline';

// Minimal pure canvas state reducer mirroring client behavior for integration test
function applyOperationToState(state: CanvasState, operation: CanvasOperation): CanvasState {
  switch (operation.type) {
    case 'CREATE_OBJECT': {
      const obj = operation.payload.object;
      return {
        ...state,
        objects: { ...state.objects, [obj.id]: obj },
        objectOrder: [...state.objectOrder.filter((id) => id !== obj.id), obj.id],
        version: state.version + 1,
      };
    }
    case 'MOVE_OBJECT': {
      const current = state.objects[operation.objectId];
      if (!current) return state;
      return {
        ...state,
        objects: {
          ...state.objects,
          [operation.objectId]: {
            ...current,
            x: operation.payload.x,
            y: operation.payload.y,
          } as CanvasObject,
        },
        version: state.version + 1,
      };
    }
    case 'DELETE_OBJECT': {
      if (!state.objects[operation.objectId]) return state;
      const nextObjs = { ...state.objects };
      delete nextObjs[operation.objectId];
      return {
        ...state,
        objects: nextObjs,
        objectOrder: state.objectOrder.filter((id) => id !== operation.objectId),
        version: state.version + 1,
      };
    }
    default:
      return state;
  }
}

describe('Full Multi-User Pipeline Integration Suite (Client A ↔ Server ↔ Client B)', () => {
  let httpServer: http.Server;
  let wsServer: CollaborativeWebSocketServer;
  let port: number;
  let testRoomManager: RoomManager;

  let userA: { id: string; token: string; email: string };
  let userB: { id: string; token: string; email: string };
  let testRoom: { id: string; name: string };

  beforeAll(async () => {
    process.env.NODE_ENV = 'test';
    await connectDB(TEST_DB_URI);

    testRoomManager = new RoomManager();
    httpServer = http.createServer(app);
    wsServer = createWebSocketServer(httpServer, testRoomManager);

    await new Promise<void>((resolve) => {
      httpServer.listen(0, () => {
        const addr = httpServer.address();
        if (typeof addr === 'object' && addr !== null) {
          port = addr.port;
        }
        resolve();
      });
    });
  });

  afterAll(async () => {
    await wsServer.close();
    await new Promise<void>((resolve) => httpServer.close(() => resolve()));
    if (mongoose.connection.db) {
      await mongoose.connection.db.dropDatabase();
    }
    await disconnectDB();
  });

  beforeEach(async () => {
    await User.deleteMany({});
    await Room.deleteMany({});
    testRoomManager.clear();

    const resA = await AuthService.register({
      name: 'Alice Designer',
      email: 'alice@example.com',
      password: 'password123',
    });
    userA = { id: resA.user.id, token: resA.token, email: resA.user.email };

    const resB = await AuthService.register({
      name: 'Bob Collaborator',
      email: 'bob@example.com',
      password: 'password123',
    });
    userB = { id: resB.user.id, token: resB.token, email: resB.user.email };

    const room = await RoomService.createRoom('Design System Workshop', userA.id);
    await RoomService.joinRoom(room.id, userB.id);
    testRoom = { id: room.id, name: room.name };
  });

  function connect(token: string): Promise<{ ws: WebSocket }> {
    return new Promise((resolve, reject) => {
      const ws = new WebSocket(`ws://localhost:${port}/ws?token=${encodeURIComponent(token)}`);
      ws.on('message', (data) => {
        const msg = JSON.parse(data.toString()) as BaseWebSocketMessage<ConnectedPayload>;
        if (msg.type === 'CONNECTED') {
          resolve({ ws });
        }
      });
      ws.on('error', reject);
    });
  }

  function waitFor<T = unknown>(ws: WebSocket, type: string): Promise<BaseWebSocketMessage<T>> {
    return new Promise((resolve) => {
      const handler = (data: Buffer | string) => {
        const msg = JSON.parse(data.toString()) as BaseWebSocketMessage<T>;
        if (msg.type === type) {
          ws.removeListener('message', handler);
          resolve(msg);
        }
      };
      ws.on('message', handler);
    });
  }

  it('should synchronize complete lifecycle: CREATE → MOVE → DELETE between Client A and Client B', async () => {
    // 1. Connect both clients to WebSocket
    const clientA = await connect(userA.token);
    const clientB = await connect(userB.token);

    // 2. Both join room
    const aJoined = waitFor<RoomJoinedPayload>(clientA.ws, 'ROOM_JOINED');
    clientA.ws.send(JSON.stringify({ type: 'JOIN_ROOM', payload: { roomId: testRoom.id } }));
    await aJoined;

    const bJoined = waitFor<RoomJoinedPayload>(clientB.ws, 'ROOM_JOINED');
    clientB.ws.send(JSON.stringify({ type: 'JOIN_ROOM', payload: { roomId: testRoom.id } }));
    await bJoined;

    // 3. Initialize simulated client canvas states
    let stateA: CanvasState = {
      canvasId: testRoom.id,
      objects: {},
      objectOrder: [],
      version: 1,
      metadata: {
        name: 'Design System',
        backgroundColor: '#090d16',
        createdAt: Date.now(),
        updatedAt: Date.now(),
        ownerId: userA.id,
      },
    };

    let stateB: CanvasState = { ...stateA, objects: {}, objectOrder: [] };

    // --- STEP A: User A creates a Rectangle ---
    const rectObj: RectangleObject = {
      id: 'rect_pipeline_1',
      type: 'rectangle',
      x: 100,
      y: 150,
      width: 200,
      height: 120,
      fill: '#38bdf833',
      stroke: '#38bdf8',
      strokeWidth: 2,
      rotation: 0,
      scaleX: 1,
      scaleY: 1,
      opacity: 1,
      zIndex: 0,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      createdBy: userA.id,
    };

    const createOp: CanvasOperation = {
      operationId: 'op_pipeline_create',
      canvasId: testRoom.id,
      type: 'CREATE_OBJECT',
      objectId: rectObj.id,
      timestamp: Date.now(),
      clientId: 'client-alice',
      payload: { object: rectObj },
    };

    // Client A applies locally immediately
    stateA = applyOperationToState(stateA, createOp);
    expect(stateA.objects['rect_pipeline_1']).toBeDefined();

    // Client A transmits operation to server
    const bReceivedCreatePromise = waitFor<CanvasOperation>(clientB.ws, 'CANVAS_OPERATION');
    clientA.ws.send(JSON.stringify({ type: 'CANVAS_OPERATION', payload: createOp }));

    // Client B receives remote operation
    const remoteCreateMsg = await bReceivedCreatePromise;
    expect(remoteCreateMsg.payload.operationId).toBe('op_pipeline_create');
    expect(remoteCreateMsg.payload.userId).toBe(userA.id);

    // Client B applies remote operation to canvas state
    stateB = applyOperationToState(stateB, remoteCreateMsg.payload);
    expect(stateB.objects['rect_pipeline_1']).toBeDefined();
    expect(stateB.objects['rect_pipeline_1'].x).toBe(100);

    // --- STEP B: User B moves the Rectangle ---
    const moveOp: CanvasOperation = {
      operationId: 'op_pipeline_move',
      canvasId: testRoom.id,
      type: 'MOVE_OBJECT',
      objectId: rectObj.id,
      timestamp: Date.now(),
      clientId: 'client-bob',
      payload: { x: 300, y: 450 },
    };

    // Client B applies locally
    stateB = applyOperationToState(stateB, moveOp);
    expect(stateB.objects['rect_pipeline_1'].x).toBe(300);

    // Client B transmits move operation
    const aReceivedMovePromise = waitFor<CanvasOperation>(clientA.ws, 'CANVAS_OPERATION');
    clientB.ws.send(JSON.stringify({ type: 'CANVAS_OPERATION', payload: moveOp }));

    // Client A receives move
    const remoteMoveMsg = await aReceivedMovePromise;
    stateA = applyOperationToState(stateA, remoteMoveMsg.payload);
    expect(stateA.objects['rect_pipeline_1'].x).toBe(300);
    expect(stateA.objects['rect_pipeline_1'].y).toBe(450);

    // --- STEP C: User A deletes the Rectangle ---
    const deleteOp: CanvasOperation = {
      operationId: 'op_pipeline_delete',
      canvasId: testRoom.id,
      type: 'DELETE_OBJECT',
      objectId: rectObj.id,
      timestamp: Date.now(),
      clientId: 'client-alice',
      payload: { objectId: rectObj.id },
    };

    stateA = applyOperationToState(stateA, deleteOp);
    expect(stateA.objects['rect_pipeline_1']).toBeUndefined();

    const bReceivedDeletePromise = waitFor<CanvasOperation>(clientB.ws, 'CANVAS_OPERATION');
    clientA.ws.send(JSON.stringify({ type: 'CANVAS_OPERATION', payload: deleteOp }));

    const remoteDeleteMsg = await bReceivedDeletePromise;
    stateB = applyOperationToState(stateB, remoteDeleteMsg.payload);
    expect(stateB.objects['rect_pipeline_1']).toBeUndefined();

    // Final Assertion: Both client states remain perfectly synchronized!
    expect(stateA.objects).toEqual(stateB.objects);
    expect(stateA.objectOrder).toEqual(stateB.objectOrder);
    expect(stateA.version).toBe(stateB.version);

    clientA.ws.close();
    clientB.ws.close();
  });
});
