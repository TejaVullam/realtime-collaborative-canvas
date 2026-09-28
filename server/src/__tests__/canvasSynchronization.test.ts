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
  ConnectedPayload,
  RoomJoinedPayload,
  SyncResponsePayload,
  SyncRequiredPayload,
} from '../websocket/types.js';
import type {
  CanonicalCanvasOperation,
  RectangleObject,
} from '../types/canvas.js';

const TEST_DB_URI = 'mongodb://localhost:27017/collaborative_canvas_test_sync';

describe('Day 6 — Server-Authoritative Canvas Synchronization Suite', () => {
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

    const resA = await AuthService.register({
      name: 'User Sync A',
      email: 'synca@example.com',
      password: 'password123',
    });
    userA = { id: resA.user.id, token: resA.token, email: resA.user.email };

    const resB = await AuthService.register({
      name: 'User Sync B',
      email: 'syncb@example.com',
      password: 'password123',
    });
    userB = { id: resB.user.id, token: resB.token, email: resB.user.email };

    const resC = await AuthService.register({
      name: 'User Sync C',
      email: 'syncc@example.com',
      password: 'password123',
    });
    userC = { id: resC.user.id, token: resC.token, email: resC.user.email };

    const roomA = await RoomService.createRoom('Sync Room Alpha', userA.id);
    await RoomService.joinRoom(roomA.id, userB.id);
    await RoomService.joinRoom(roomA.id, userC.id);
    testRoomA = { id: roomA.id, name: roomA.name, canvasId: roomA.canvasId };

    const roomB = await RoomService.createRoom('Sync Room Beta', userC.id);
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
        ws.close();
        reject(new Error('Connection handshake timed out'));
      }, 4000);

      ws.on('message', (data: Buffer | string) => {
        try {
          const parsed = JSON.parse(data.toString()) as BaseWebSocketMessage<ConnectedPayload>;
          if (parsed.type === 'CONNECTED') {
            clearTimeout(timeout);
            resolve({ ws, connectedMsg: parsed });
          }
        } catch {
          // ignore non-JSON or other handshake frames
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
        ws.removeListener('message', listener);
        reject(new Error(`Timed out waiting for message of type: "${expectedType}"`));
      }, timeoutMs);

      const listener = (data: Buffer | string) => {
        try {
          const msg = JSON.parse(data.toString()) as BaseWebSocketMessage<T>;
          if (msg.type === expectedType) {
            clearTimeout(timer);
            ws.removeListener('message', listener);
            resolve(msg);
          }
        } catch {
          // ignore parse errors for other frames
        }
      };

      ws.on('message', listener);
    });
  }

  function joinRoom(ws: WebSocket, roomId: string): Promise<BaseWebSocketMessage<RoomJoinedPayload>> {
    const joinedPromise = waitForMessage<RoomJoinedPayload>(ws, 'ROOM_JOINED');
    ws.send(JSON.stringify({ type: 'JOIN_ROOM', payload: { roomId } }));
    return joinedPromise;
  }

  it('should assign monotonically increasing serverSequence and authoritative serverTimestamp per canvas', async () => {
    const clientA = await connectClient(userA.token);
    const clientB = await connectClient(userB.token);

    await joinRoom(clientA.ws, testRoomA.id);
    await joinRoom(clientB.ws, testRoomA.id);

    // Op 1
    const ack1Promise = waitForMessage<CanvasOperationAckPayload>(clientA.ws, 'CANVAS_OPERATION_ACK');
    const bOp1Promise = waitForMessage<CanonicalCanvasOperation>(clientB.ws, 'CANVAS_OPERATION');

    clientA.ws.send(
      JSON.stringify({
        type: 'CANVAS_OPERATION',
        payload: {
          operationId: 'op_seq_1',
          type: 'MOVE_OBJECT',
          objectId: 'rect-1',
          clientId: 'client-a',
          timestamp: 100,
          payload: { x: 50, y: 50 },
        },
      }),
    );

    const ack1 = await ack1Promise;
    expect(ack1.payload.serverSequence).toBe(1);
    expect(ack1.payload.serverTimestamp).toBeGreaterThan(0);
    expect(ack1.payload.status).toBe('accepted');

    const bOp1 = await bOp1Promise;
    expect(bOp1.payload.serverSequence).toBe(1);
    expect(bOp1.payload.canvasId).toBe(testRoomA.canvasId);

    // Op 2 from Client B
    const ack2Promise = waitForMessage<CanvasOperationAckPayload>(clientB.ws, 'CANVAS_OPERATION_ACK');
    const aOp2Promise = waitForMessage<CanonicalCanvasOperation>(clientA.ws, 'CANVAS_OPERATION');

    clientB.ws.send(
      JSON.stringify({
        type: 'CANVAS_OPERATION',
        payload: {
          operationId: 'op_seq_2',
          type: 'MOVE_OBJECT',
          objectId: 'rect-1',
          clientId: 'client-b',
          timestamp: 105,
          payload: { x: 75, y: 80 },
        },
      }),
    );

    const ack2 = await ack2Promise;
    expect(ack2.payload.serverSequence).toBe(2);
    expect(ack2.payload.serverTimestamp).toBeGreaterThanOrEqual(ack1.payload.serverTimestamp!);

    const aOp2 = await aOp2Promise;
    expect(aOp2.payload.serverSequence).toBe(2);

    clientA.ws.close();
    clientB.ws.close();
  });

  it('should maintain strict canvas sequence isolation across independent rooms', async () => {
    const clientA = await connectClient(userA.token);
    const clientC = await connectClient(userC.token);

    // Client A in Room A, Client C in Room B
    await joinRoom(clientA.ws, testRoomA.id);
    await joinRoom(clientC.ws, testRoomB.id);

    // Op in Room A -> Sequence 1 on Canvas A
    const ackAPromise = waitForMessage<CanvasOperationAckPayload>(clientA.ws, 'CANVAS_OPERATION_ACK');
    clientA.ws.send(
      JSON.stringify({
        type: 'CANVAS_OPERATION',
        payload: {
          operationId: 'op_room_a_1',
          type: 'MOVE_OBJECT',
          objectId: 'rect-a',
          clientId: 'client-a',
          timestamp: 100,
          payload: { x: 10, y: 10 },
        },
      }),
    );
    const ackA = await ackAPromise;
    expect(ackA.payload.serverSequence).toBe(1);
    expect(ackA.payload.canvasId).toBe(testRoomA.canvasId);

    // Op in Room B -> Sequence 1 on Canvas B (independent sequence!)
    const ackCPromise = waitForMessage<CanvasOperationAckPayload>(clientC.ws, 'CANVAS_OPERATION_ACK');
    clientC.ws.send(
      JSON.stringify({
        type: 'CANVAS_OPERATION',
        payload: {
          operationId: 'op_room_b_1',
          type: 'MOVE_OBJECT',
          objectId: 'rect-b',
          clientId: 'client-c',
          timestamp: 100,
          payload: { x: 20, y: 20 },
        },
      }),
    );
    const ackC = await ackCPromise;
    expect(ackC.payload.serverSequence).toBe(1);
    expect(ackC.payload.canvasId).toBe(testRoomB.canvasId);

    clientA.ws.close();
    clientC.ws.close();
  });

  it('should prevent spoofing of serverSequence and serverTimestamp by overriding client values', async () => {
    const clientA = await connectClient(userA.token);
    const clientB = await connectClient(userB.token);

    await joinRoom(clientA.ws, testRoomA.id);
    await joinRoom(clientB.ws, testRoomA.id);

    const bReceivePromise = waitForMessage<CanonicalCanvasOperation>(clientB.ws, 'CANVAS_OPERATION');

    // Malicious client attempts to forge sequence 9999 and timestamp 0
    clientA.ws.send(
      JSON.stringify({
        type: 'CANVAS_OPERATION',
        payload: {
          operationId: 'op_spoof_seq',
          type: 'MOVE_OBJECT',
          objectId: 'rect-1',
          clientId: 'client-a',
          timestamp: 50,
          serverSequence: 999999, // Forged!
          serverTimestamp: 0, // Forged!
          userId: 'spoofed-admin', // Forged!
          payload: { x: 100, y: 100 },
        },
      }),
    );

    const received = await bReceivePromise;
    // Server must have assigned sequence 1 and authoritative server timestamp
    expect(received.payload.serverSequence).toBe(1);
    expect(received.payload.serverSequence).not.toBe(999999);
    expect(received.payload.serverTimestamp).toBeGreaterThan(Date.now() - 10000);
    expect(received.payload.userId).toBe(userA.id);

    clientA.ws.close();
    clientB.ws.close();
  });

  it('should support reconnect catch-up via SYNC_REQUEST', async () => {
    const clientA = await connectClient(userA.token);
    const clientB = await connectClient(userB.token);

    await joinRoom(clientA.ws, testRoomA.id);
    await joinRoom(clientB.ws, testRoomA.id);

    // Client A sends 3 operations while Client B is connected
    for (let i = 1; i <= 3; i++) {
      const ackPromise = waitForMessage<CanvasOperationAckPayload>(clientA.ws, 'CANVAS_OPERATION_ACK');
      clientA.ws.send(
        JSON.stringify({
          type: 'CANVAS_OPERATION',
          payload: {
            operationId: `op_reconnect_test_${i}`,
            type: 'MOVE_OBJECT',
            objectId: 'rect-1',
            clientId: 'client-a',
            timestamp: Date.now(),
            payload: { x: i * 10, y: i * 20 },
          },
        }),
      );
      await ackPromise;
    }

    // Client B disconnects temporarily
    clientB.ws.close();

    // While Client B is disconnected, Client A sends 2 more operations (Sequences 4 and 5)
    for (let i = 4; i <= 5; i++) {
      const ackPromise = waitForMessage<CanvasOperationAckPayload>(clientA.ws, 'CANVAS_OPERATION_ACK');
      clientA.ws.send(
        JSON.stringify({
          type: 'CANVAS_OPERATION',
          payload: {
            operationId: `op_reconnect_test_${i}`,
            type: 'MOVE_OBJECT',
            objectId: 'rect-1',
            clientId: 'client-a',
            timestamp: Date.now(),
            payload: { x: i * 10, y: i * 20 },
          },
        }),
      );
      await ackPromise;
    }

    // Client B reconnects and rejoins the room
    const clientB2 = await connectClient(userB.token);
    const joinRes = await joinRoom(clientB2.ws, testRoomA.id);
    expect(joinRes.payload.canvasId).toBe(testRoomA.canvasId);

    // Client B requests sync since sequence 3 (its last applied sequence)
    const syncPromise = waitForMessage<SyncResponsePayload>(clientB2.ws, 'SYNC_RESPONSE');
    clientB2.ws.send(
      JSON.stringify({
        type: 'SYNC_REQUEST',
        payload: {
          canvasId: testRoomA.canvasId,
          sinceSequence: 3,
        },
      }),
    );

    const syncRes = await syncPromise;
    expect(syncRes.payload.canvasId).toBe(testRoomA.canvasId);
    expect(syncRes.payload.currentSequence).toBe(5);
    expect(syncRes.payload.operations.length).toBe(2);
    expect(syncRes.payload.operations[0].serverSequence).toBe(4);
    expect(syncRes.payload.operations[1].serverSequence).toBe(5);

    clientA.ws.close();
    clientB2.ws.close();
  });

  it('should return SYNC_REQUIRED when client requests sync from a sequence that was purged from bounded history', async () => {
    const clientA = await connectClient(userA.token);
    await joinRoom(clientA.ws, testRoomA.id);

    // Artificially populate bounded operation history and sequence
    for (let i = 1; i <= 10; i++) {
      testRoomManager.recordCanonicalOperation({
        operationId: `op_hist_${i}`,
        canvasId: testRoomA.canvasId,
        type: 'MOVE_OBJECT',
        objectId: 'rect-1',
        timestamp: Date.now(),
        clientId: 'client-a',
        serverSequence: 100 + i, // Log starts at sequence 101
        serverTimestamp: Date.now(),
        userId: userA.id,
        payload: { x: i, y: i },
      });
      testRoomManager.setSequence(testRoomA.canvasId, 100 + i);
    }

    // Client requests sync since sequence 10 (which has been purged, oldest in log is 101)
    const syncReqPromise = waitForMessage<SyncRequiredPayload>(clientA.ws, 'SYNC_REQUIRED');
    clientA.ws.send(
      JSON.stringify({
        type: 'SYNC_REQUEST',
        payload: {
          canvasId: testRoomA.canvasId,
          sinceSequence: 10,
        },
      }),
    );

    const syncReq = await syncReqPromise;
    expect(syncReq.payload.reason).toBe('HISTORY_PURGED');
    expect(syncReq.payload.currentSequence).toBe(110);

    clientA.ws.close();
  });

  it('should achieve eventual convergence for 3 concurrent clients submitting simultaneous operations', async () => {
    const clientA = await connectClient(userA.token);
    const clientB = await connectClient(userB.token);
    const clientC = await connectClient(userC.token);

    await joinRoom(clientA.ws, testRoomA.id);
    await joinRoom(clientB.ws, testRoomA.id);
    await joinRoom(clientC.ws, testRoomA.id);

    // Initial shape
    const rect: RectangleObject = {
      id: 'shared-rect',
      type: 'rectangle',
      x: 0,
      y: 0,
      width: 100,
      height: 100,
      fill: '#111',
      stroke: '#222',
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

    // Client A creates object
    const createAck = waitForMessage<CanvasOperationAckPayload>(clientA.ws, 'CANVAS_OPERATION_ACK');
    clientA.ws.send(
      JSON.stringify({
        type: 'CANVAS_OPERATION',
        payload: {
          operationId: 'op_create_shared',
          type: 'CREATE_OBJECT',
          objectId: rect.id,
          clientId: 'client-a',
          timestamp: Date.now(),
          payload: { object: rect },
        },
      }),
    );
    await createAck;

    // Collect all canonical operations received by Client C
    const clientCOperations: CanonicalCanvasOperation[] = [];
    clientC.ws.on('message', (data: Buffer | string) => {
      const msg = JSON.parse(data.toString());
      if (msg.type === 'CANVAS_OPERATION') {
        clientCOperations.push(msg.payload);
      }
    });

    // Clients A and B concurrently mutate the shared object
    const aAck = waitForMessage<CanvasOperationAckPayload>(clientA.ws, 'CANVAS_OPERATION_ACK');
    const bAck = waitForMessage<CanvasOperationAckPayload>(clientB.ws, 'CANVAS_OPERATION_ACK');

    clientA.ws.send(
      JSON.stringify({
        type: 'CANVAS_OPERATION',
        payload: {
          operationId: 'op_conc_a',
          type: 'MOVE_OBJECT',
          objectId: 'shared-rect',
          clientId: 'client-a',
          timestamp: Date.now(),
          payload: { x: 150, y: 150 },
        },
      }),
    );

    clientB.ws.send(
      JSON.stringify({
        type: 'CANVAS_OPERATION',
        payload: {
          operationId: 'op_conc_b',
          type: 'UPDATE_OBJECT',
          objectId: 'shared-rect',
          clientId: 'client-b',
          timestamp: Date.now(),
          payload: { patch: { fill: '#ec4899' } },
        },
      }),
    );

    const [resA, resB] = await Promise.all([aAck, bAck]);

    // Verify distinct monotonically increasing sequences
    expect(resA.payload.serverSequence).not.toBe(resB.payload.serverSequence);
    const sequences = [resA.payload.serverSequence!, resB.payload.serverSequence!].sort();
    expect(sequences[1]).toBe(sequences[0] + 1);

    // Wait small tick to ensure all broadcasts completed
    await new Promise((resolve) => setTimeout(resolve, 200));

    // Client C received both canonical operations with exact server sequences
    expect(clientCOperations.length).toBe(2);
    expect(clientCOperations.every((op) => op.serverSequence !== undefined)).toBe(true);

    clientA.ws.close();
    clientB.ws.close();
    clientC.ws.close();
  });
});
