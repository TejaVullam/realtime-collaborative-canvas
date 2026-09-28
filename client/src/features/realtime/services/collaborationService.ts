import type {
  CanvasOperation,
  CanonicalCanvasOperation,
} from '../../../types/canvas.js';
import type {
  CanvasOperationAckPayload,
  CanvasOperationErrorPayload,
  SyncRequestPayload,
  SyncResponsePayload,
  SyncRequiredPayload,
  SyncStatus,
} from '../types/websocket.js';
import {
  WebSocketClient,
  defaultWebSocketClient,
} from './websocketClient.js';

export class CollaborationService {
  private wsClient: WebSocketClient;
  private processedOperationKeys: Set<string> = new Set();
  private processedOrder: string[] = [];
  private static MAX_PROCESSED_OPS = 1000;

  // Authoritative server sequence tracking per canvas
  private lastAppliedSequence: number = 0;
  private sequenceBuffer: Map<number, CanonicalCanvasOperation> = new Map();

  // Synchronization status
  private syncStatus: SyncStatus = 'synced';
  private syncStatusListeners: Set<(status: SyncStatus) => void> = new Set();

  constructor(wsClient: WebSocketClient = defaultWebSocketClient) {
    this.wsClient = wsClient;
  }

  private getOpKey(canvasIdOrOpId: string, operationId?: string): string {
    return operationId ? `${canvasIdOrOpId}:${operationId}` : canvasIdOrOpId;
  }

  /**
   * Check if an operation has already been processed locally or remotely.
   */
  hasProcessed(canvasIdOrOpId: string, operationId?: string): boolean {
    if (operationId) {
      return this.processedOperationKeys.has(`${canvasIdOrOpId}:${operationId}`);
    }
    if (this.processedOperationKeys.has(canvasIdOrOpId)) {
      return true;
    }
    for (const key of this.processedOperationKeys) {
      if (key.endsWith(`:${canvasIdOrOpId}`)) {
        return true;
      }
    }
    return false;
  }

  /**
   * Record an operation as processed with bounded FIFO eviction to prevent memory leaks.
   */
  markProcessed(canvasIdOrOpId: string, operationId?: string): void {
    const key = this.getOpKey(canvasIdOrOpId, operationId);
    if (this.processedOperationKeys.has(key)) return;

    if (this.processedOrder.length >= CollaborationService.MAX_PROCESSED_OPS) {
      const oldest = this.processedOrder.shift();
      if (oldest) {
        this.processedOperationKeys.delete(oldest);
      }
    }

    this.processedOperationKeys.add(key);
    this.processedOrder.push(key);
  }

  /**
   * Get the current highest contiguous serverSequence applied to the local canvas.
   */
  getLastAppliedSequence(): number {
    return this.lastAppliedSequence;
  }

  /**
   * Set the last applied sequence directly (e.g. on snapshot load or test initialization).
   */
  setLastAppliedSequence(sequence: number): void {
    this.lastAppliedSequence = sequence;
  }

  /**
   * Get the current synchronization state.
   */
  getSyncStatus(): SyncStatus {
    return this.syncStatus;
  }

  private setSyncStatus(status: SyncStatus): void {
    if (this.syncStatus === status) return;
    this.syncStatus = status;
    for (const listener of this.syncStatusListeners) {
      try {
        listener(status);
      } catch (err) {
        console.error('Error in sync status listener:', err);
      }
    }
  }

  /**
   * Subscribe to changes in synchronization status (synced, syncing, diverged).
   */
  onSyncStatusChange(listener: (status: SyncStatus) => void): () => void {
    this.syncStatusListeners.add(listener);
    listener(this.syncStatus);
    return () => {
      this.syncStatusListeners.delete(listener);
    };
  }

  /**
   * Transmits a local canvas operation over the active WebSocket room.
   * Returns true if successfully queued to the socket; false if disconnected or not in a room.
   */
  sendCanvasOperation(operation: CanvasOperation, requestId?: string): boolean {
    if (this.wsClient.getStatus() !== 'connected' || !this.wsClient.getCurrentRoom()) {
      return false;
    }

    // Mark locally created operation as processed so any broadcast echo is safely ignored
    this.markProcessed(operation.canvasId, operation.operationId);

    return this.wsClient.send('CANVAS_OPERATION', operation, requestId);
  }

  /**
   * Sends a SYNC_REQUEST to catch up on missed canonical operations since a given sequence.
   */
  requestSync(canvasId: string, sinceSequence?: number): boolean {
    if (this.wsClient.getStatus() !== 'connected' || !this.wsClient.getCurrentRoom()) {
      return false;
    }

    this.setSyncStatus('syncing');
    const payload: SyncRequestPayload = {
      canvasId,
      sinceSequence: sinceSequence ?? this.lastAppliedSequence,
    };

    return this.wsClient.send('SYNC_REQUEST', payload);
  }

  /**
   * Subscribes to incoming remote canvas operations from the WebSocket server.
   * Enforces server sequence ordering, out-of-order buffering, and deduplication.
   */
  subscribeToCanvasOperations(
    handler: (operation: CanonicalCanvasOperation) => void,
  ): () => void {
    const unsubOp = this.wsClient.subscribe<CanonicalCanvasOperation>(
      'CANVAS_OPERATION',
      (payload) => {
        if (!payload || typeof payload !== 'object') return;
        const op = payload as CanonicalCanvasOperation;
        if (!op.operationId || !op.type) return;

        // Duplicate protection: suppress previously processed operations
        if (this.hasProcessed(op.canvasId, op.operationId)) {
          return;
        }

        // If untracked sequence (fallback/legacy), apply directly
        if (op.serverSequence === undefined) {
          this.markProcessed(op.canvasId, op.operationId);
          handler(op);
          return;
        }

        // Check if operation is older than or equal to current sequence (duplicate or superseded)
        if (op.serverSequence <= this.lastAppliedSequence) {
          return;
        }

        // Case 1: In-order arrival (expected next sequence)
        if (op.serverSequence === this.lastAppliedSequence + 1) {
          this.markProcessed(op.canvasId, op.operationId);
          this.lastAppliedSequence = op.serverSequence;
          handler(op);

          // Drain any buffered operations that were waiting for this sequence
          this.drainSequenceBuffer(handler);
          return;
        }

        // Case 2: Out-of-order arrival (sequence gap detected: op.serverSequence > lastAppliedSequence + 1)
        this.sequenceBuffer.set(op.serverSequence, op);
        this.setSyncStatus('syncing');

        // Request catch-up synchronization for the missing gap
        this.requestSync(op.canvasId, this.lastAppliedSequence);
      },
    );

    // Subscribe to SYNC_RESPONSE for reconnect or gap catch-up
    const unsubSync = this.wsClient.subscribe<SyncResponsePayload>(
      'SYNC_RESPONSE',
      (payload) => {
        if (!payload || !Array.isArray(payload.operations)) return;

        // Sort canonical operations in ascending sequence order
        const sortedOps = [...payload.operations].sort(
          (a, b) => (a.serverSequence ?? 0) - (b.serverSequence ?? 0),
        );

        for (const op of sortedOps) {
          if (op.serverSequence !== undefined && op.serverSequence > this.lastAppliedSequence) {
            if (!this.hasProcessed(op.canvasId, op.operationId)) {
              this.markProcessed(op.canvasId, op.operationId);
              handler(op);
            }
            this.lastAppliedSequence = op.serverSequence;
          }
        }

        // Drain any pending buffered operations that now connect
        this.drainSequenceBuffer(handler);

        this.setSyncStatus('synced');
      },
    );

    // Subscribe to SYNC_REQUIRED (e.g. history was purged on server)
    const unsubSyncReq = this.wsClient.subscribe<SyncRequiredPayload>(
      'SYNC_REQUIRED',
      (payload) => {
        if (!payload) return;
        this.setSyncStatus('diverged');
      },
    );

    return () => {
      unsubOp();
      unsubSync();
      unsubSyncReq();
    };
  }

  /**
   * Sequentially drains contiguous buffered operations from sequenceBuffer.
   */
  private drainSequenceBuffer(
    handler: (operation: CanonicalCanvasOperation) => void,
  ): void {
    while (this.sequenceBuffer.has(this.lastAppliedSequence + 1)) {
      const nextSeq = this.lastAppliedSequence + 1;
      const nextOp = this.sequenceBuffer.get(nextSeq)!;
      this.sequenceBuffer.delete(nextSeq);

      if (!this.hasProcessed(nextOp.canvasId, nextOp.operationId)) {
        this.markProcessed(nextOp.canvasId, nextOp.operationId);
        handler(nextOp);
      }
      this.lastAppliedSequence = nextSeq;
    }

    if (this.sequenceBuffer.size === 0 && this.syncStatus === 'syncing') {
      this.setSyncStatus('synced');
    }
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
          // If server sequence acknowledged, update local lastAppliedSequence if higher
          if (payload.serverSequence && payload.serverSequence > this.lastAppliedSequence) {
            this.lastAppliedSequence = Math.max(
              this.lastAppliedSequence,
              payload.serverSequence,
            );
          }
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
   * Clears the duplicate tracker history, sequence buffer, and resets sequence counter.
   */
  clearProcessedOperations(): void {
    this.processedOperationKeys.clear();
    this.processedOrder = [];
    this.sequenceBuffer.clear();
    this.lastAppliedSequence = 0;
    this.setSyncStatus('synced');
  }

  /**
   * Returns current count of tracked operation keys.
   */
  getProcessedCount(): number {
    return this.processedOperationKeys.size;
  }

  /**
   * Returns current count of buffered out-of-order operations.
   */
  getBufferedCount(): number {
    return this.sequenceBuffer.size;
  }
}

export const defaultCollaborationService = new CollaborationService();

