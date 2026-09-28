import { describe, it, expect, beforeEach } from 'vitest';
import { CollaborationService } from '../services/collaborationService.js';
import { WebSocketClient } from '../services/websocketClient.js';
import type { CanvasOperation } from '../../../types/canvas.js';
import type { BaseWebSocketMessage } from '../types/websocket.js';

class MockWebSocketClient extends WebSocketClient {
  public mockStatus: 'disconnected' | 'connecting' | 'connected' | 'reconnecting' | 'error' = 'connected';
  public mockCurrentRoom: string | null = 'room-1';
  public sentMessages: Array<{ type: string; payload: unknown; requestId?: string }> = [];
  public listeners: Record<string, Set<(payload: unknown, msg: BaseWebSocketMessage) => void>> = {};

  getStatus(): 'disconnected' | 'connecting' | 'connected' | 'reconnecting' | 'error' {
    return this.mockStatus;
  }

  getCurrentRoom(): string | null {
    return this.mockCurrentRoom;
  }

  send<T = unknown>(type: string, payload: T, requestId?: string): boolean {
    if (this.mockStatus !== 'connected') return false;
    this.sentMessages.push({ type, payload, requestId });
    return true;
  }

  subscribe<T = unknown>(
    type: string,
    handler: (payload: T, message: BaseWebSocketMessage<T>) => void,
  ): () => void {
    if (!this.listeners[type]) {
      this.listeners[type] = new Set();
    }
    const fn = handler as (payload: unknown, message: BaseWebSocketMessage) => void;
    this.listeners[type].add(fn);

    return () => {
      this.listeners[type]?.delete(fn);
    };
  }

  simulateIncomingMessage<T = unknown>(type: string, payload: T, requestId?: string) {
    const handlers = this.listeners[type];
    if (handlers) {
      for (const h of handlers) {
        h(payload, { type, payload, requestId });
      }
    }
  }
}

describe('CollaborationService Unit Suite', () => {
  let mockWs: MockWebSocketClient;
  let service: CollaborationService;

  beforeEach(() => {
    mockWs = new MockWebSocketClient();
    service = new CollaborationService(mockWs);
  });

  it('should successfully send a CanvasOperation when connected and in a room', () => {
    const op: CanvasOperation = {
      operationId: 'op-1',
      canvasId: 'room-1',
      type: 'MOVE_OBJECT',
      objectId: 'obj-1',
      timestamp: Date.now(),
      clientId: 'client-1',
      payload: { x: 100, y: 200 },
    };

    const sent = service.sendCanvasOperation(op, 'req-1');
    expect(sent).toBe(true);
    expect(mockWs.sentMessages.length).toBe(1);
    expect(mockWs.sentMessages[0].type).toBe('CANVAS_OPERATION');
    expect(mockWs.sentMessages[0].payload).toEqual(op);
    expect(mockWs.sentMessages[0].requestId).toBe('req-1');

    // Should also record the op in duplicate tracker
    expect(service.hasProcessed('op-1')).toBe(true);
  });

  it('should reject sending when client is disconnected or not in a room (Section 19 Approach A)', () => {
    mockWs.mockStatus = 'disconnected';

    const op: CanvasOperation = {
      operationId: 'op-2',
      canvasId: 'room-1',
      type: 'DELETE_OBJECT',
      objectId: 'obj-1',
      timestamp: Date.now(),
      clientId: 'client-1',
      payload: { objectId: 'obj-1' },
    };

    const sent = service.sendCanvasOperation(op);
    expect(sent).toBe(false);
    expect(mockWs.sentMessages.length).toBe(0);

    // Also when in connected status but no currentRoom
    mockWs.mockStatus = 'connected';
    mockWs.mockCurrentRoom = null;
    const sentNoRoom = service.sendCanvasOperation(op);
    expect(sentNoRoom).toBe(false);
  });

  it('should deliver incoming remote operations to subscribers and suppress duplicates', () => {
    const receivedOps: CanvasOperation[] = [];
    const unsubscribe = service.subscribeToCanvasOperations((op) => {
      receivedOps.push(op);
    });

    const remoteOp: CanvasOperation = {
      operationId: 'op-remote-1',
      canvasId: 'room-1',
      type: 'MOVE_OBJECT',
      objectId: 'obj-remote',
      timestamp: Date.now(),
      clientId: 'client-b',
      payload: { x: 50, y: 60 },
    };

    // 1st delivery
    mockWs.simulateIncomingMessage('CANVAS_OPERATION', remoteOp);
    expect(receivedOps.length).toBe(1);
    expect(receivedOps[0].operationId).toBe('op-remote-1');

    // 2nd delivery of same operationId (duplicate protection)
    mockWs.simulateIncomingMessage('CANVAS_OPERATION', remoteOp);
    expect(receivedOps.length).toBe(1); // Not called again!

    unsubscribe();
    // After unsubscribe, should not receive further calls
    mockWs.simulateIncomingMessage('CANVAS_OPERATION', {
      ...remoteOp,
      operationId: 'op-remote-2',
    });
    expect(receivedOps.length).toBe(1);
  });

  it('should ignore remote broadcast of an operation that was previously generated and sent locally', () => {
    const localOp: CanvasOperation = {
      operationId: 'op-local-99',
      canvasId: 'room-1',
      type: 'MOVE_OBJECT',
      objectId: 'obj-local',
      timestamp: Date.now(),
      clientId: 'client-a',
      payload: { x: 10, y: 20 },
    };

    // Local sends it
    service.sendCanvasOperation(localOp);
    expect(service.hasProcessed('op-local-99')).toBe(true);

    const receivedOps: CanvasOperation[] = [];
    service.subscribeToCanvasOperations((op) => receivedOps.push(op));

    // Server echoes broadcast back (or network re-transmit)
    mockWs.simulateIncomingMessage('CANVAS_OPERATION', localOp);
    expect(receivedOps.length).toBe(0); // Suppressed by duplicate protection
  });

  it('should notify ACK and ERROR subscribers', () => {
    const acks: string[] = [];
    const errors: Array<{ operationId?: string; code: string }> = [];

    service.subscribeToOperationAck((ack) => acks.push(ack.operationId));
    service.subscribeToOperationError((err) =>
      errors.push({ operationId: err.operationId, code: err.code }),
    );

    mockWs.simulateIncomingMessage('CANVAS_OPERATION_ACK', { operationId: 'op-ack-1' });
    expect(acks).toEqual(['op-ack-1']);

    mockWs.simulateIncomingMessage('CANVAS_OPERATION_ERROR', {
      operationId: 'op-err-1',
      code: 'INVALID_OPERATION',
      message: 'Bad operation',
    });
    expect(errors).toEqual([{ operationId: 'op-err-1', code: 'INVALID_OPERATION' }]);
  });

  it('should bound processed operations to prevent memory leaks', () => {
    // Insert 1050 operations to trigger FIFO eviction
    for (let i = 0; i < 1050; i++) {
      service.markProcessed(`op-bulk-${i}`);
    }

    // Maximum capacity is 1000
    expect(service.getProcessedCount()).toBe(1000);
    // Oldest items (0-49) must have been evicted
    expect(service.hasProcessed('op-bulk-0')).toBe(false);
    expect(service.hasProcessed('op-bulk-49')).toBe(false);
    // Recent items must still be present
    expect(service.hasProcessed('op-bulk-1049')).toBe(true);
  });

  describe('Day 6 — Sequence Ordering, Out-of-Order Buffering & Reconnect Catch-Up', () => {
    it('should process operations in contiguous sequence order and advance lastAppliedSequence', () => {
      const receivedOps: CanvasOperation[] = [];
      service.subscribeToCanvasOperations((op) => receivedOps.push(op));

      const op1: CanvasOperation = {
        operationId: 'op-seq-1',
        canvasId: 'room-1',
        type: 'MOVE_OBJECT',
        objectId: 'obj-1',
        timestamp: 1000,
        clientId: 'client-b',
        serverSequence: 1,
        serverTimestamp: 10000,
        userId: 'user-b',
        payload: { x: 10, y: 20 },
      };

      const op2: CanvasOperation = {
        operationId: 'op-seq-2',
        canvasId: 'room-1',
        type: 'MOVE_OBJECT',
        objectId: 'obj-1',
        timestamp: 1010,
        clientId: 'client-b',
        serverSequence: 2,
        serverTimestamp: 10010,
        userId: 'user-b',
        payload: { x: 30, y: 40 },
      };

      mockWs.simulateIncomingMessage('CANVAS_OPERATION', op1);
      expect(receivedOps.length).toBe(1);
      expect(service.getLastAppliedSequence()).toBe(1);

      mockWs.simulateIncomingMessage('CANVAS_OPERATION', op2);
      expect(receivedOps.length).toBe(2);
      expect(service.getLastAppliedSequence()).toBe(2);
    });

    it('should ignore duplicate operations or operations with serverSequence <= lastAppliedSequence', () => {
      service.setLastAppliedSequence(5);

      const receivedOps: CanvasOperation[] = [];
      service.subscribeToCanvasOperations((op) => receivedOps.push(op));

      const staleOp: CanvasOperation = {
        operationId: 'op-stale',
        canvasId: 'room-1',
        type: 'MOVE_OBJECT',
        objectId: 'obj-1',
        timestamp: 900,
        clientId: 'client-b',
        serverSequence: 4, // Stale! Current is 5
        serverTimestamp: 9000,
        userId: 'user-b',
        payload: { x: 5, y: 5 },
      };

      mockWs.simulateIncomingMessage('CANVAS_OPERATION', staleOp);
      expect(receivedOps.length).toBe(0);
      expect(service.getLastAppliedSequence()).toBe(5);
    });

    it('should buffer out-of-order operations, request sync for gap, and drain buffer when missing sequence arrives', () => {
      const receivedOps: CanvasOperation[] = [];
      const statusHistory: string[] = [];
      service.onSyncStatusChange((st) => statusHistory.push(st));

      service.subscribeToCanvasOperations((op) => receivedOps.push(op));

      // Sequence 1 arrives
      const op1: CanvasOperation = {
        operationId: 'op-gap-1',
        canvasId: 'room-1',
        type: 'MOVE_OBJECT',
        objectId: 'obj-1',
        timestamp: 1000,
        clientId: 'client-b',
        serverSequence: 1,
        serverTimestamp: 10000,
        userId: 'user-b',
        payload: { x: 10, y: 10 },
      };
      mockWs.simulateIncomingMessage('CANVAS_OPERATION', op1);
      expect(service.getLastAppliedSequence()).toBe(1);
      expect(receivedOps.length).toBe(1);

      // Sequence 3 arrives prematurely (Sequence 2 was delayed by network jitter!)
      const op3: CanvasOperation = {
        operationId: 'op-gap-3',
        canvasId: 'room-1',
        type: 'MOVE_OBJECT',
        objectId: 'obj-1',
        timestamp: 1020,
        clientId: 'client-b',
        serverSequence: 3,
        serverTimestamp: 10020,
        userId: 'user-b',
        payload: { x: 30, y: 30 },
      };
      mockWs.simulateIncomingMessage('CANVAS_OPERATION', op3);

      // op3 must be buffered, not yet applied to state
      expect(receivedOps.length).toBe(1);
      expect(service.getBufferedCount()).toBe(1);
      expect(service.getSyncStatus()).toBe('syncing');

      // CollaborationService should have automatically sent a SYNC_REQUEST for the missing sequence
      const syncRequests = mockWs.sentMessages.filter((m) => m.type === 'SYNC_REQUEST');
      expect(syncRequests.length).toBe(1);
      expect(syncRequests[0].payload).toEqual({
        canvasId: 'room-1',
        sinceSequence: 1,
      });

      // Now sequence 2 arrives
      const op2: CanvasOperation = {
        operationId: 'op-gap-2',
        canvasId: 'room-1',
        type: 'MOVE_OBJECT',
        objectId: 'obj-1',
        timestamp: 1010,
        clientId: 'client-b',
        serverSequence: 2,
        serverTimestamp: 10010,
        userId: 'user-b',
        payload: { x: 20, y: 20 },
      };
      mockWs.simulateIncomingMessage('CANVAS_OPERATION', op2);

      // Both op2 and buffered op3 must now be delivered in exact sequence order!
      expect(receivedOps.length).toBe(3);
      expect(receivedOps[1].operationId).toBe('op-gap-2');
      expect(receivedOps[2].operationId).toBe('op-gap-3');
      expect(service.getLastAppliedSequence()).toBe(3);
      expect(service.getBufferedCount()).toBe(0);
      expect(service.getSyncStatus()).toBe('synced');
    });

    it('should catch up on missed operations via SYNC_RESPONSE on reconnect', () => {
      service.setLastAppliedSequence(10);

      const receivedOps: CanvasOperation[] = [];
      service.subscribeToCanvasOperations((op) => receivedOps.push(op));

      // Client reconnects and server answers with missing operations 11 and 12
      const missedOp11 = {
        operationId: 'op-missed-11',
        canvasId: 'room-1',
        type: 'MOVE_OBJECT',
        objectId: 'obj-1',
        timestamp: 1100,
        clientId: 'client-c',
        serverSequence: 11,
        serverTimestamp: 11000,
        userId: 'user-c',
        payload: { x: 110, y: 110 },
      };

      const missedOp12 = {
        operationId: 'op-missed-12',
        canvasId: 'room-1',
        type: 'UPDATE_OBJECT',
        objectId: 'obj-1',
        timestamp: 1200,
        clientId: 'client-c',
        serverSequence: 12,
        serverTimestamp: 12000,
        userId: 'user-c',
        payload: { patch: { fill: '#00ff00' } },
      };

      mockWs.simulateIncomingMessage('SYNC_RESPONSE', {
        canvasId: 'room-1',
        operations: [missedOp12, missedOp11], // delivered out of order by transport
        currentSequence: 12,
        upToDate: false,
      });

      // CollaborationService sorts ascending and applies in order
      expect(receivedOps.length).toBe(2);
      expect(receivedOps[0].operationId).toBe('op-missed-11');
      expect(receivedOps[1].operationId).toBe('op-missed-12');
      expect(service.getLastAppliedSequence()).toBe(12);
      expect(service.getSyncStatus()).toBe('synced');
    });

    it('should transition sync status to diverged upon SYNC_REQUIRED (e.g. history purged)', () => {
      service.subscribeToCanvasOperations(() => {});

      mockWs.simulateIncomingMessage('SYNC_REQUIRED', {
        canvasId: 'room-1',
        reason: 'HISTORY_PURGED',
        currentSequence: 2000,
      });

      expect(service.getSyncStatus()).toBe('diverged');
    });
  });
});

