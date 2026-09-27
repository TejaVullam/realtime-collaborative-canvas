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
});
