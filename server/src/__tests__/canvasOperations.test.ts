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
import type {
  BaseWebSocketMessage,
  CanvasOperationAckPayload,
  CanvasOperationErrorPayload,
  ConnectedPayload,
  ErrorPayload,
  RoomJoinedPayload,
} from '../websocket/types.js';
import type { CanvasOperation, RectangleObject } from '../types/canvas.js';

const TEST_DB_URI = 'mongodb://localhost:27017/collaborative_canvas_test_operations';

describe('Real-Time Canvas Collaboration & Server Operation Pipeline Suite', () => {
  let httpServer: http.Server;
  let wsServer: CollaborativeWebSocketServer;
  let port: number;
  let testRoomManager: RoomManager;

  let userA: { id: string; token: string; email: string };
  let userB: { id: string; token: string; email: string };
  let userC: { id: string; token: string; email: string };
  let testRoomA: { id: string; name: string; canvasId: string };
  let testRoomB: { id: string; name: string; canvasId: string };

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

    // Register User A
    const resA = await AuthService.register({
      name: 'User A',
      email: 'usera@example.com',
      password: 'password123',
    });
    userA = { id: resA.user.id, token: resA.token, email: resA.user.email };

    // Register User B
    const resB = await AuthService.register({
      name: 'User B',
      email: 'userb@example.com',
      password: 'password123',
    });
    userB = { id: resB.user.id, token: resB.token, email: resB.user.email };

    // Register User C
    const resC = await AuthService.register({
      name: 'User C',
      email: 'userc@example.com',
      password: 'password123',
    });
    userC = { id: resC.user.id, token: resC.token, email: resC.user.email };

    // Create Room A owned by User A, with User B invited as member
    const roomA = await RoomService.createRoom('Workspace Alpha', userA.id);
    await RoomService.joinRoom(roomA.id, userB.id);
    testRoomA = { id: roomA.id, name: roomA.name, canvasId: roomA.canvasId };

    // Create Room B owned by User C
    const roomB = await RoomService.createRoom('Workspace Beta', userC.id);
    testRoomB = { id: roomB.id, name: roomB.name, canvasId: roomB.canvasId };
  });

  function connectClient(
    token?: string,
  ): Promise<{ ws: WebSocket; connectedMsg: BaseWebSocketMessage<ConnectedPayload> }> {
    return new Promise((resolve, reject) => {
      const url = token
        ? `ws://localhost:${port}/ws?token=${encodeURIComponent(token)}`
        : `ws://localhost:${port}/ws`;

      const ws = new WebSocket(url);

      const timeout = setTimeout(() => {
        ws.terminate();
        reject(new Error('Connection timeout'));
      }, 5000);

      ws.on('message', (data) => {
        const msg = JSON.parse(data.toString()) as BaseWebSocketMessage<ConnectedPayload>;
        if (msg.type === 'CONNECTED') {
          clearTimeout(timeout);
          resolve({ ws, connectedMsg: msg });
        }
      });

      ws.on('error', (err) => {
        clearTimeout(timeout);
        reject(err);
      });
    });
  }

  function waitForMessage<T = unknown>(
    ws: WebSocket,
    expectedType: string,
    timeoutMs = 4000,
  ): Promise<BaseWebSocketMessage<T>> {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        ws.removeListener('message', onMessage);
        reject(new Error(`Timeout waiting for message type "${expectedType}"`));
      }, timeoutMs);

      const onMessage = (data: Buffer | string) => {
        try {
          const msg = JSON.parse(data.toString()) as BaseWebSocketMessage<T>;
          if (msg.type === expectedType) {
            clearTimeout(timer);
            ws.removeListener('message', onMessage);
            resolve(msg);
          }
        } catch {
          // ignore unparseable messages while waiting
        }
      };

      ws.on('message', onMessage);
    });
  }

  async function joinRoom(ws: WebSocket, roomId: string): Promise<BaseWebSocketMessage<RoomJoinedPayload>> {
    const joinedPromise = waitForMessage<RoomJoinedPayload>(ws, 'ROOM_JOINED');
    ws.send(JSON.stringify({ type: 'JOIN_ROOM', payload: { roomId } }));
    return joinedPromise;
  }

  describe('Authorization & Room Boundary Enforcement', () => {
    it('should reject CANVAS_OPERATION with NOT_IN_ROOM if socket has not joined a room', async () => {
      const { ws } = await connectClient(userA.token);

      const errorPromise = waitForMessage<CanvasOperationErrorPayload>(ws, 'ERROR');
      ws.send(
        JSON.stringify({
          type: 'CANVAS_OPERATION',
          payload: {
            operationId: 'op_unjoined_1',
            type: 'DELETE_OBJECT',
            objectId: 'rect_1',
            clientId: 'client_1',
            timestamp: Date.now(),
            payload: { objectId: 'rect_1' },
          },
        }),
      );

      const response = await errorPromise;
      expect(response.type).toBe('ERROR');
      expect(response.payload.code).toBe('NOT_IN_ROOM');

      ws.close();
    });

    it('should reject CANVAS_OPERATION with ROOM_ACCESS_DENIED if user is not a room member', async () => {
      const { ws } = await connectClient(userC.token);

      // User C attempts to join Room A without being a member
      const errorPromise = waitForMessage<ErrorPayload>(ws, 'ERROR');
      ws.send(JSON.stringify({ type: 'JOIN_ROOM', payload: { roomId: testRoomA.id } }));

      const response = await errorPromise;
      expect(response.payload.code).toBe('ROOM_ACCESS_DENIED');

      ws.close();
    });
  });

  describe('Strict Operation Validation', () => {
    it('should reject an operation with missing operationId', async () => {
      const { ws } = await connectClient(userA.token);
      await joinRoom(ws, testRoomA.id);

      const errPromise = waitForMessage<CanvasOperationErrorPayload>(ws, 'CANVAS_OPERATION_ERROR');
      ws.send(
        JSON.stringify({
          type: 'CANVAS_OPERATION',
          payload: {
            // missing operationId
            type: 'MOVE_OBJECT',
            objectId: 'obj-1',
            clientId: 'client-1',
            timestamp: Date.now(),
            payload: { x: 10, y: 20 },
          },
        }),
      );

      const err = await errPromise;
      expect(err.type).toBe('CANVAS_OPERATION_ERROR');
      expect(err.payload.code).toBe('INVALID_OPERATION');

      ws.close();
    });

    it('should reject an operation with INVALID_OPERATION_TYPE', async () => {
      const { ws } = await connectClient(userA.token);
      await joinRoom(ws, testRoomA.id);

      const errPromise = waitForMessage<CanvasOperationErrorPayload>(ws, 'CANVAS_OPERATION_ERROR');
      ws.send(
        JSON.stringify({
          type: 'CANVAS_OPERATION',
          payload: {
            operationId: 'op_bad_type',
            type: 'HACK_CANVAS',
            objectId: 'obj-1',
            clientId: 'client-1',
            timestamp: Date.now(),
            payload: {},
          },
        }),
      );

      const err = await errPromise;
      expect(err.payload.code).toBe('INVALID_OPERATION_TYPE');
      expect(err.payload.operationId).toBe('op_bad_type');

      ws.close();
    });

    it('should reject CREATE_OBJECT with INVALID_OPERATION_PAYLOAD when object payload is malformed', async () => {
      const { ws } = await connectClient(userA.token);
      await joinRoom(ws, testRoomA.id);

      const errPromise = waitForMessage<CanvasOperationErrorPayload>(ws, 'CANVAS_OPERATION_ERROR');
      ws.send(
        JSON.stringify({
          type: 'CANVAS_OPERATION',
          payload: {
            operationId: 'op_bad_create',
            type: 'CREATE_OBJECT',
            objectId: 'rect-1',
            clientId: 'client-1',
            timestamp: Date.now(),
            payload: {
              object: {
                id: 'rect-1',
                type: 'rectangle',
                x: 50,
                // missing y, width, height
              },
            },
          },
        }),
      );

      const err = await errPromise;
      expect(err.payload.code).toBe('INVALID_OPERATION_PAYLOAD');
      expect(err.payload.operationId).toBe('op_bad_create');

      ws.close();
    });

    it('should reject CREATE_OBJECT with INVALID_OPERATION_PAYLOAD when base object attributes are invalid', async () => {
      const { ws } = await connectClient(userA.token);
      await joinRoom(ws, testRoomA.id);

      const errPromise = waitForMessage<CanvasOperationErrorPayload>(ws, 'CANVAS_OPERATION_ERROR');
      ws.send(
        JSON.stringify({
          type: 'CANVAS_OPERATION',
          payload: {
            operationId: 'op_bad_create_base',
            type: 'CREATE_OBJECT',
            objectId: 'rect-base-err',
            clientId: 'client-1',
            timestamp: Date.now(),
            payload: {
              object: {
                id: 'rect-base-err',
                type: 'rectangle',
                x: 10,
                y: 20,
                width: 100,
                height: 50,
                fill: '#fff',
                stroke: '#000',
                strokeWidth: 1,
                rotation: 0,
                scaleX: 1,
                scaleY: 1,
                opacity: 1.5, // Invalid: opacity must be <= 1
                zIndex: 0,
                createdAt: Date.now(),
                updatedAt: Date.now(),
              },
            },
          },
        }),
      );

      const err = await errPromise;
      expect(err.payload.code).toBe('INVALID_OPERATION_PAYLOAD');
      expect(err.payload.message).toContain('opacity');
      ws.close();
    });

    it('should reject UPDATE_OBJECT when attempting to modify immutable system fields', async () => {
      const { ws } = await connectClient(userA.token);
      await joinRoom(ws, testRoomA.id);

      const errPromise = waitForMessage<CanvasOperationErrorPayload>(ws, 'CANVAS_OPERATION_ERROR');
      ws.send(
        JSON.stringify({
          type: 'CANVAS_OPERATION',
          payload: {
            operationId: 'op_bad_update_system',
            type: 'UPDATE_OBJECT',
            objectId: 'rect-1',
            clientId: 'client-1',
            timestamp: Date.now(),
            payload: {
              patch: {
                id: 'new-stolen-id', // Prohibited immutable system field
                x: 100,
              },
            },
          },
        }),
      );

      const err = await errPromise;
      expect(err.payload.code).toBe('INVALID_OPERATION_PAYLOAD');
      expect(err.payload.message).toContain('immutable system field');
      ws.close();
    });

    it('should reject UPDATE_OBJECT when patch contains unknown properties', async () => {
      const { ws } = await connectClient(userA.token);
      await joinRoom(ws, testRoomA.id);

      const errPromise = waitForMessage<CanvasOperationErrorPayload>(ws, 'CANVAS_OPERATION_ERROR');
      ws.send(
        JSON.stringify({
          type: 'CANVAS_OPERATION',
          payload: {
            operationId: 'op_bad_update_unknown',
            type: 'UPDATE_OBJECT',
            objectId: 'rect-1',
            clientId: 'client-1',
            timestamp: Date.now(),
            payload: {
              patch: {
                unsupportedArbitraryProp: 'malicious',
              },
            },
          },
        }),
      );

      const err = await errPromise;
      expect(err.payload.code).toBe('INVALID_OPERATION_PAYLOAD');
      expect(err.payload.message).toContain('Unknown or disallowed patch property');
      ws.close();
    });

    it('should reject UPDATE_OBJECT when patch object is empty', async () => {
      const { ws } = await connectClient(userA.token);
      await joinRoom(ws, testRoomA.id);

      const errPromise = waitForMessage<CanvasOperationErrorPayload>(ws, 'CANVAS_OPERATION_ERROR');
      ws.send(
        JSON.stringify({
          type: 'CANVAS_OPERATION',
          payload: {
            operationId: 'op_empty_patch',
            type: 'UPDATE_OBJECT',
            objectId: 'rect-1',
            clientId: 'client-1',
            timestamp: Date.now(),
            payload: {
              patch: {},
            },
          },
        }),
      );

      const err = await errPromise;
      expect(err.payload.code).toBe('INVALID_OPERATION_PAYLOAD');
      ws.close();
    });

    it('should reject MOVE_OBJECT with INVALID_OPERATION_PAYLOAD when coordinates are not finite numbers', async () => {
      const { ws } = await connectClient(userA.token);
      await joinRoom(ws, testRoomA.id);

      const errPromise = waitForMessage<CanvasOperationErrorPayload>(ws, 'CANVAS_OPERATION_ERROR');
      ws.send(
        JSON.stringify({
          type: 'CANVAS_OPERATION',
          payload: {
            operationId: 'op_bad_move',
            type: 'MOVE_OBJECT',
            objectId: 'rect-1',
            clientId: 'client-1',
            timestamp: Date.now(),
            payload: { x: 'not-a-number', y: 100 },
          },
        }),
      );

      const err = await errPromise;
      expect(err.payload.code).toBe('INVALID_OPERATION_PAYLOAD');

      ws.close();
    });
  });

  describe('Broadcasting, Identity Binding & Sender Exclusion', () => {
    it('should broadcast CREATE_OBJECT to other room members, exclude sender, and send ACK to sender', async () => {
      const clientA = await connectClient(userA.token);
      const clientB = await connectClient(userB.token);

      await joinRoom(clientA.ws, testRoomA.id);
      await joinRoom(clientB.ws, testRoomA.id);

      const sampleRect: RectangleObject = {
        id: 'rect-collab-1',
        type: 'rectangle',
        x: 100,
        y: 120,
        width: 150,
        height: 80,
        fill: '#38bdf822',
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

      const operation: CanvasOperation = {
        operationId: 'op_create_101',
        canvasId: testRoomA.canvasId,
        type: 'CREATE_OBJECT',
        objectId: 'rect-collab-1',
        timestamp: Date.now(),
        clientId: 'client-a-uuid',
        payload: { object: sampleRect },
      };

      // Set up listeners:
      // Client A should receive CANVAS_OPERATION_ACK
      const ackPromise = waitForMessage<CanvasOperationAckPayload>(clientA.ws, 'CANVAS_OPERATION_ACK');

      // Client B should receive CANVAS_OPERATION
      const remoteOpPromise = waitForMessage<CanvasOperation>(clientB.ws, 'CANVAS_OPERATION');

      // Client A should NOT receive CANVAS_OPERATION (sender exclusion)
      let senderReceivedBroadcast = false;
      const onSenderMessage = (data: Buffer | string) => {
        const msg = JSON.parse(data.toString());
        if (msg.type === 'CANVAS_OPERATION') {
          senderReceivedBroadcast = true;
        }
      };
      clientA.ws.on('message', onSenderMessage);

      // Client A transmits operation
      clientA.ws.send(
        JSON.stringify({
          type: 'CANVAS_OPERATION',
          requestId: 'req_create_1',
          payload: operation,
        }),
      );

      // Awaits
      const ack = await ackPromise;
      expect(ack.type).toBe('CANVAS_OPERATION_ACK');
      expect(ack.requestId).toBe('req_create_1');
      expect(ack.payload.operationId).toBe('op_create_101');

      const broadcastMsg = await remoteOpPromise;
      expect(broadcastMsg.type).toBe('CANVAS_OPERATION');
      expect(broadcastMsg.payload.operationId).toBe('op_create_101');
      expect(broadcastMsg.payload.type).toBe('CREATE_OBJECT');
      expect(broadcastMsg.payload.objectId).toBe('rect-collab-1');
      // Server must bind authenticated userId
      expect(broadcastMsg.payload.userId).toBe(userA.id);
      expect(broadcastMsg.payload.canvasId).toBe(testRoomA.canvasId);

      // Confirm sender exclusion
      expect(senderReceivedBroadcast).toBe(false);

      clientA.ws.removeListener('message', onSenderMessage);
      clientA.ws.close();
      clientB.ws.close();
    });

    it('should prevent user identity spoofing by binding socket authenticated userId', async () => {
      const clientA = await connectClient(userA.token);
      const clientB = await connectClient(userB.token);

      await joinRoom(clientA.ws, testRoomA.id);
      await joinRoom(clientB.ws, testRoomA.id);

      const spoofAttemptOp = {
        operationId: 'op_spoof_1',
        canvasId: testRoomA.id,
        type: 'MOVE_OBJECT',
        objectId: 'rect-collab-1',
        timestamp: Date.now(),
        clientId: 'client-a-uuid',
        userId: 'malicious-forged-admin-id', // Attacker attempt
        payload: { x: 250, y: 300 },
      };

      const bOpPromise = waitForMessage<CanvasOperation>(clientB.ws, 'CANVAS_OPERATION');

      clientA.ws.send(
        JSON.stringify({
          type: 'CANVAS_OPERATION',
          payload: spoofAttemptOp,
        }),
      );

      const received = await bOpPromise;
      // Server MUST have overwritten userId with authenticated userA.id
      expect(received.payload.userId).toBe(userA.id);
      expect(received.payload.userId).not.toBe('malicious-forged-admin-id');

      clientA.ws.close();
      clientB.ws.close();
    });

    it('should NOT leak canvas operations to clients in other rooms', async () => {
      const clientA = await connectClient(userA.token);
      const clientC = await connectClient(userC.token);

      await joinRoom(clientA.ws, testRoomA.id);
      await joinRoom(clientC.ws, testRoomB.id); // Room B

      let roomCReceivedOp = false;
      const onClientCMessage = (data: Buffer | string) => {
        const msg = JSON.parse(data.toString());
        if (msg.type === 'CANVAS_OPERATION') {
          roomCReceivedOp = true;
        }
      };
      clientC.ws.on('message', onClientCMessage);

      // Client A sends operation in Room A
      const ackPromise = waitForMessage<CanvasOperationAckPayload>(clientA.ws, 'CANVAS_OPERATION_ACK');
      clientA.ws.send(
        JSON.stringify({
          type: 'CANVAS_OPERATION',
          payload: {
            operationId: 'op_room_isolated_1',
            type: 'DELETE_OBJECT',
            objectId: 'rect-1',
            clientId: 'client-a',
            timestamp: Date.now(),
            payload: { objectId: 'rect-1' },
          },
        }),
      );

      await ackPromise;
      // Wait small tick to ensure message propagation
      await new Promise((resolve) => setTimeout(resolve, 150));

      expect(roomCReceivedOp).toBe(false);

      clientC.ws.removeListener('message', onClientCMessage);
      clientA.ws.close();
      clientC.ws.close();
    });

    it('should reject duplicate operationIds with DUPLICATE_OPERATION', async () => {
      const clientA = await connectClient(userA.token);
      await joinRoom(clientA.ws, testRoomA.id);

      const op = {
        operationId: 'op_unique_duplicate_test',
        type: 'MOVE_OBJECT',
        objectId: 'rect-1',
        clientId: 'client-a',
        timestamp: Date.now(),
        payload: { x: 50, y: 75 },
      };

      // 1st transmission -> success ACK
      const ackPromise = waitForMessage<CanvasOperationAckPayload>(clientA.ws, 'CANVAS_OPERATION_ACK');
      clientA.ws.send(
        JSON.stringify({
          type: 'CANVAS_OPERATION',
          payload: op,
        }),
      );
      const ack = await ackPromise;
      expect(ack.payload.operationId).toBe('op_unique_duplicate_test');

      // 2nd transmission of identical operationId -> DUPLICATE_OPERATION error
      const dupPromise = waitForMessage<CanvasOperationErrorPayload>(clientA.ws, 'CANVAS_OPERATION_ERROR');
      clientA.ws.send(
        JSON.stringify({
          type: 'CANVAS_OPERATION',
          payload: op,
        }),
      );
      const dup = await dupPromise;
      expect(dup.payload.code).toBe('DUPLICATE_OPERATION');
      expect(dup.payload.operationId).toBe('op_unique_duplicate_test');

      clientA.ws.close();
    });

    it('should support bidirectional collaboration between User A and User B', async () => {
      const clientA = await connectClient(userA.token);
      const clientB = await connectClient(userB.token);

      await joinRoom(clientA.ws, testRoomA.id);
      await joinRoom(clientB.ws, testRoomA.id);

      // Phase 1: User A moves object -> User B receives
      const bReceiveMovePromise = waitForMessage<CanvasOperation>(clientB.ws, 'CANVAS_OPERATION');
      clientA.ws.send(
        JSON.stringify({
          type: 'CANVAS_OPERATION',
          payload: {
            operationId: 'op_bi_1',
            type: 'MOVE_OBJECT',
            objectId: 'obj-bi',
            clientId: 'client-a',
            timestamp: Date.now(),
            payload: { x: 120, y: 140 },
          },
        }),
      );
      const moveOp = await bReceiveMovePromise;
      expect(moveOp.payload.operationId).toBe('op_bi_1');
      expect(moveOp.payload.userId).toBe(userA.id);

      // Phase 2: User B updates object -> User A receives
      const aReceiveUpdatePromise = waitForMessage<CanvasOperation>(clientA.ws, 'CANVAS_OPERATION');
      clientB.ws.send(
        JSON.stringify({
          type: 'CANVAS_OPERATION',
          payload: {
            operationId: 'op_bi_2',
            type: 'UPDATE_OBJECT',
            objectId: 'obj-bi',
            clientId: 'client-b',
            timestamp: Date.now(),
            payload: { patch: { stroke: '#ef4444' } },
          },
        }),
      );
      const updateOp = await aReceiveUpdatePromise;
      expect(updateOp.payload.operationId).toBe('op_bi_2');
      expect(updateOp.payload.userId).toBe(userB.id);

      clientA.ws.close();
      clientB.ws.close();
    });
  });
});
