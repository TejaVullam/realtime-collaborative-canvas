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
import type { BaseWebSocketMessage, ConnectedPayload } from '../websocket/types.js';

const TEST_DB_URI = 'mongodb://localhost:27017/collaborative_canvas_test_websocket';

describe('WebSocket Server Integration & Protocol Suite', () => {
  let httpServer: http.Server;
  let wsServer: CollaborativeWebSocketServer;
  let port: number;
  let testRoomManager: RoomManager;

  let userA: { id: string; token: string; email: string };
  let userB: { id: string; token: string; email: string };
  let testRoomA: { id: string; name: string };

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

    // Create a room owned by User A
    const room = await RoomService.createRoom('Workspace Alpha', userA.id);
    testRoomA = { id: room.id, name: room.name };
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
        const msg = JSON.parse(
          data.toString(),
        ) as BaseWebSocketMessage<ConnectedPayload>;
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

  function waitForMessage(
    ws: WebSocket,
    expectedType?: string,
  ): Promise<BaseWebSocketMessage<Record<string, unknown>>> {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error(`Timeout waiting for message${expectedType ? ` of type ${expectedType}` : ''}`));
      }, 5000);

      const onMessage = (data: Buffer | string) => {
        try {
          const msg = JSON.parse(data.toString()) as BaseWebSocketMessage<Record<string, unknown>>;
          if (!expectedType || msg.type === expectedType) {
            ws.off('message', onMessage);
            clearTimeout(timeout);
            resolve(msg);
          }
        } catch {
          // ignore parsing error if waiting for other messages
        }
      };

      ws.on('message', onMessage);
    });
  }

  describe('Connection & Authentication', () => {
    it('should successfully connect and authenticate with a valid JWT', async () => {
      const { ws, connectedMsg } = await connectClient(userA.token);
      expect(connectedMsg.type).toBe('CONNECTED');
      expect(connectedMsg.payload.userId).toBe(userA.id);
      expect(connectedMsg.payload.socketId).toBeDefined();
      expect(connectedMsg.payload.user.email).toBe(userA.email);
      ws.close();
    });

    it('should reject connection when token is missing', async () => {
      await expect(connectClient()).rejects.toThrow();
    });

    it('should reject connection when token is invalid', async () => {
      await expect(connectClient('invalid.jwt.token')).rejects.toThrow();
    });
  });

  describe('Room Lifecycle & Authorization', () => {
    it('should allow room member to join room and receive ROOM_JOINED', async () => {
      const { ws } = await connectClient(userA.token);

      const reqPromise = waitForMessage(ws, 'ROOM_JOINED');
      ws.send(
        JSON.stringify({
          type: 'JOIN_ROOM',
          requestId: 'req_join_1',
          payload: { roomId: testRoomA.id },
        }),
      );

      const response = await reqPromise;
      expect(response.type).toBe('ROOM_JOINED');
      expect(response.requestId).toBe('req_join_1');
      expect(response.payload.roomId).toBe(testRoomA.id);
      expect(response.payload.userId).toBe(userA.id);

      expect(testRoomManager.getRoomSize(testRoomA.id)).toBe(1);
      ws.close();
    });

    it('should deny room join if user is not a member of the room', async () => {
      const { ws } = await connectClient(userB.token);

      const errorPromise = waitForMessage(ws, 'ERROR');
      ws.send(
        JSON.stringify({
          type: 'JOIN_ROOM',
          requestId: 'req_unauth_join',
          payload: { roomId: testRoomA.id },
        }),
      );

      const response = await errorPromise;
      expect(response.type).toBe('ERROR');
      expect(response.requestId).toBe('req_unauth_join');
      expect(response.payload.code).toBe('ROOM_ACCESS_DENIED');
      expect(testRoomManager.getRoomSize(testRoomA.id)).toBe(0);

      ws.close();
    });

    it('should return ROOM_NOT_FOUND when joining a non-existent room', async () => {
      const { ws } = await connectClient(userA.token);
      const fakeRoomId = new mongoose.Types.ObjectId().toString();

      const errorPromise = waitForMessage(ws, 'ERROR');
      ws.send(
        JSON.stringify({
          type: 'JOIN_ROOM',
          payload: { roomId: fakeRoomId },
        }),
      );

      const response = await errorPromise;
      expect(response.type).toBe('ERROR');
      expect(response.payload.code).toBe('ROOM_NOT_FOUND');

      ws.close();
    });

    it('should return INVALID_ROOM_ID for malformed room IDs', async () => {
      const { ws } = await connectClient(userA.token);

      const errorPromise = waitForMessage(ws, 'ERROR');
      ws.send(
        JSON.stringify({
          type: 'JOIN_ROOM',
          payload: { roomId: 'not-a-valid-id' },
        }),
      );

      const response = await errorPromise;
      expect(response.type).toBe('ERROR');
      expect(response.payload.code).toBe('INVALID_ROOM_ID');

      ws.close();
    });

    it('should allow user to leave room and receive ROOM_LEFT', async () => {
      const { ws } = await connectClient(userA.token);

      // Join first
      const joinPromise = waitForMessage(ws, 'ROOM_JOINED');
      ws.send(
        JSON.stringify({
          type: 'JOIN_ROOM',
          payload: { roomId: testRoomA.id },
        }),
      );
      await joinPromise;
      expect(testRoomManager.getRoomSize(testRoomA.id)).toBe(1);

      // Leave
      const leavePromise = waitForMessage(ws, 'ROOM_LEFT');
      ws.send(
        JSON.stringify({
          type: 'LEAVE_ROOM',
          requestId: 'req_leave_1',
          payload: { roomId: testRoomA.id },
        }),
      );

      const leaveResp = await leavePromise;
      expect(leaveResp.type).toBe('ROOM_LEFT');
      expect(leaveResp.requestId).toBe('req_leave_1');
      expect(leaveResp.payload.roomId).toBe(testRoomA.id);
      expect(testRoomManager.getRoomSize(testRoomA.id)).toBe(0);

      ws.close();
    });

    it('should return NOT_IN_ROOM when leaving without having joined', async () => {
      const { ws } = await connectClient(userA.token);

      const errorPromise = waitForMessage(ws, 'ERROR');
      ws.send(
        JSON.stringify({
          type: 'LEAVE_ROOM',
          payload: { roomId: testRoomA.id },
        }),
      );

      const response = await errorPromise;
      expect(response.type).toBe('ERROR');
      expect(response.payload.code).toBe('NOT_IN_ROOM');

      ws.close();
    });

    it('should automatically remove socket from RoomManager upon socket disconnection', async () => {
      const { ws } = await connectClient(userA.token);

      const joinPromise = waitForMessage(ws, 'ROOM_JOINED');
      ws.send(
        JSON.stringify({
          type: 'JOIN_ROOM',
          payload: { roomId: testRoomA.id },
        }),
      );
      await joinPromise;
      expect(testRoomManager.getRoomSize(testRoomA.id)).toBe(1);

      // Disconnect socket
      ws.close();

      // Wait a short tick for close event handler to fire
      await new Promise((resolve) => setTimeout(resolve, 100));
      expect(testRoomManager.getRoomSize(testRoomA.id)).toBe(0);
    });
  });

  describe('Message Validation & Protocols', () => {
    it('should respond to PING with PONG', async () => {
      const { ws } = await connectClient(userA.token);

      const pongPromise = waitForMessage(ws, 'PONG');
      ws.send(
        JSON.stringify({
          type: 'PING',
          requestId: 'req_ping_99',
        }),
      );

      const response = await pongPromise;
      expect(response.type).toBe('PONG');
      expect(response.requestId).toBe('req_ping_99');
      expect(response.payload.timestamp).toBeDefined();

      ws.close();
    });

    it('should safely handle malformed JSON messages without crashing', async () => {
      const { ws } = await connectClient(userA.token);

      const errorPromise = waitForMessage(ws, 'ERROR');
      ws.send('this is not json');

      const response = await errorPromise;
      expect(response.type).toBe('ERROR');
      expect(response.payload.code).toBe('INVALID_MESSAGE');

      ws.close();
    });

    it('should safely handle unknown message types', async () => {
      const { ws } = await connectClient(userA.token);

      const errorPromise = waitForMessage(ws, 'ERROR');
      ws.send(
        JSON.stringify({
          type: 'NON_EXISTENT_TYPE',
          payload: {},
        }),
      );

      const response = await errorPromise;
      expect(response.type).toBe('ERROR');
      expect(response.payload.code).toBe('UNKNOWN_MESSAGE_TYPE');

      ws.close();
    });
  });
});
