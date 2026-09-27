import type { CanvasOperation } from '../../../types/canvas.js';
import type {
  CanvasOperationAckPayload,
  CanvasOperationErrorPayload,
} from '../types/websocket.js';
import {
  WebSocketClient,
  defaultWebSocketClient,
} from './websocketClient.js';

export class CollaborationService {
  private wsClient: WebSocketClient;
  private processedOperationIds: Set<string> = new Set();
  private processedOrder: string[] = [];
  private static MAX_PROCESSED_OPS = 1000;

  constructor(wsClient: WebSocketClient = defaultWebSocketClient) {
    this.wsClient = wsClient;
  }

  /**
   * Check if an operation has already been processed locally or remotely.
   */
  hasProcessed(operationId: string): boolean {
    return this.processedOperationIds.has(operationId);
  }

  /**
   * Record an operation as processed with bounded FIFO eviction to prevent memory leaks.
   */
  markProcessed(operationId: string): void {
    if (this.processedOperationIds.has(operationId)) return;

    if (this.processedOrder.length >= CollaborationService.MAX_PROCESSED_OPS) {
      const oldest = this.processedOrder.shift();
      if (oldest) {
        this.processedOperationIds.delete(oldest);
      }
    }

    this.processedOperationIds.add(operationId);
    this.processedOrder.push(operationId);
  }

  /**
   * Transmits a local canvas operation over the active WebSocket room.
   * Returns true if successfully queued to the socket; false if disconnected or not in a room.
   */
  sendCanvasOperation(operation: CanvasOperation, requestId?: string): boolean {
    // Section 19 Approach A: Do not attempt to send if disconnected or not in a room
    if (this.wsClient.getStatus() !== 'connected' || !this.wsClient.getCurrentRoom()) {
      return false;
    }

    // Mark locally created operation as processed so any broadcast echo is safely ignored
    this.markProcessed(operation.operationId);

    return this.wsClient.send('CANVAS_OPERATION', operation, requestId);
  }

  /**
   * Subscribes to incoming remote canvas operations from the WebSocket server.
   * Applies client-side duplicate protection to guarantee idempotent state application.
   */
  subscribeToCanvasOperations(
    handler: (operation: CanvasOperation) => void,
  ): () => void {
    return this.wsClient.subscribe<CanvasOperation>(
      'CANVAS_OPERATION',
      (payload) => {
        if (!payload || typeof payload !== 'object') return;
        const op = payload as CanvasOperation;
        if (!op.operationId || !op.type) return;

        // Duplicate protection: suppress previously processed operations
        if (this.hasProcessed(op.operationId)) {
          return;
        }

        this.markProcessed(op.operationId);
        handler(op);
      },
    );
  }

  /**
   * Subscribes to server ACKs for submitted operations.
   */
  subscribeToOperationAck(
    handler: (payload: CanvasOperationAckPayload) => void,
  ): () => void {
    return this.wsClient.subscribe<CanvasOperationAckPayload>(
      'CANVAS_OPERATION_ACK',
      (payload) => {
        if (payload && payload.operationId) {
          handler(payload);
        }
      },
    );
  }

  /**
   * Subscribes to server validation or authorization errors for operations.
   */
  subscribeToOperationError(
    handler: (payload: CanvasOperationErrorPayload) => void,
  ): () => void {
    return this.wsClient.subscribe<CanvasOperationErrorPayload>(
      'CANVAS_OPERATION_ERROR',
      (payload) => {
        if (payload) {
          handler(payload);
        }
      },
    );
  }

  /**
   * Clears the duplicate tracker history (useful when leaving rooms or in test suites).
   */
  clearProcessedOperations(): void {
    this.processedOperationIds.clear();
    this.processedOrder = [];
  }

  /**
   * Returns current count of tracked operation IDs.
   */
  getProcessedCount(): number {
    return this.processedOperationIds.size;
  }
}

export const defaultCollaborationService = new CollaborationService();
