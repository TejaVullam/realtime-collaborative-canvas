import { WebSocket } from 'ws';

export class RoomManager {
  private rooms: Map<string, Set<WebSocket>> = new Map();
  private socketToRoom: Map<WebSocket, string> = new Map();

  /**
   * Add a socket to a room. If the socket was in another room, leaves it first.
   */
  joinRoom(roomId: string, socket: WebSocket): void {
    const existingRoom = this.socketToRoom.get(socket);
    if (existingRoom) {
      if (existingRoom === roomId) {
        // Already in this room
        return;
      }
      this.leaveRoom(socket);
    }

    let roomSockets = this.rooms.get(roomId);
    if (!roomSockets) {
      roomSockets = new Set<WebSocket>();
      this.rooms.set(roomId, roomSockets);
    }

    roomSockets.add(socket);
    this.socketToRoom.set(socket, roomId);
  }

  /**
   * Remove a socket from its current room.
   * If the room becomes empty, the room entry is deleted.
   * Returns the roomId that was left, or null if socket was not in any room.
   */
  leaveRoom(socket: WebSocket): string | null {
    const roomId = this.socketToRoom.get(socket);
    if (!roomId) {
      return null;
    }

    const roomSockets = this.rooms.get(roomId);
    if (roomSockets) {
      roomSockets.delete(socket);
      if (roomSockets.size === 0) {
        this.rooms.delete(roomId);
      }
    }

    this.socketToRoom.delete(socket);
    return roomId;
  }

  /**
   * Remove a socket completely (e.g. on disconnect or error).
   * Same cleanup as leaveRoom.
   */
  removeSocket(socket: WebSocket): string | null {
    return this.leaveRoom(socket);
  }

  /**
   * Get the set of active sockets in a room.
   */
  getRoomMembers(roomId: string): Set<WebSocket> | undefined {
    return this.rooms.get(roomId);
  }

  /**
   * Get the number of active sockets in a room.
   */
  getRoomSize(roomId: string): number {
    return this.rooms.get(roomId)?.size ?? 0;
  }

  /**
   * Get the room a socket is currently in, or null.
   */
  getSocketRoom(socket: WebSocket): string | null {
    return this.socketToRoom.get(socket) ?? null;
  }

  /**
   * Get the total count of active rooms.
   */
  getActiveRoomsCount(): number {
    return this.rooms.size;
  }

  /**
   * Broadcast a payload to all open sockets in a room, optionally excluding sender.
   */
  broadcastToRoom(
    roomId: string,
    message: unknown,
    excludeSocket?: WebSocket,
  ): void {
    const roomSockets = this.rooms.get(roomId);
    if (!roomSockets || roomSockets.size === 0) {
      return;
    }

    const serialized =
      typeof message === 'string' ? message : JSON.stringify(message);

    for (const socket of roomSockets) {
      if (socket !== excludeSocket && socket.readyState === WebSocket.OPEN) {
        socket.send(serialized);
      }
    }
  }

  private processedOperationKeys: Set<string> = new Set();
  private processedOperationOrder: string[] = [];
  private static MAX_PROCESSED_OPS = 1000;

  private getOpKey(canvasIdOrOpId: string, operationId?: string): string {
    return operationId ? `${canvasIdOrOpId}:${operationId}` : canvasIdOrOpId;
  }

  /**
   * Check if an operation has already been processed by the room manager.
   * Scoped to (canvasId, operationId) to prevent cross-canvas collisions.
   */
  hasProcessedOperation(canvasIdOrOpId: string, operationId?: string): boolean {
    const key = this.getOpKey(canvasIdOrOpId, operationId);
    return this.processedOperationKeys.has(key);
  }

  /**
   * Record an operation key with bounded FIFO eviction to prevent memory leaks.
   */
  recordProcessedOperation(canvasIdOrOpId: string, operationId?: string): void {
    const key = this.getOpKey(canvasIdOrOpId, operationId);
    if (this.processedOperationKeys.has(key)) return;

    if (this.processedOperationOrder.length >= RoomManager.MAX_PROCESSED_OPS) {
      const oldest = this.processedOperationOrder.shift();
      if (oldest) {
        this.processedOperationKeys.delete(oldest);
      }
    }

    this.processedOperationKeys.add(key);
    this.processedOperationOrder.push(key);
  }

  /**
   * Clear all rooms, socket mappings, and processed operation cache (useful for testing or shutdown).
   */
  clear(): void {
    this.rooms.clear();
    this.socketToRoom.clear();
    this.processedOperationKeys.clear();
    this.processedOperationOrder = [];
  }
}

export const defaultRoomManager = new RoomManager();

