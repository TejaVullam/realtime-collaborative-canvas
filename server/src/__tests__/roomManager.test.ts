import { describe, it, expect, beforeEach, vi } from 'vitest';
import { WebSocket } from 'ws';
import { RoomManager } from '../websocket/roomManager.js';

function createMockSocket(readyState: number = WebSocket.OPEN): WebSocket {
  return {
    readyState,
    send: vi.fn(),
  } as unknown as WebSocket;
}

describe('RoomManager Unit Tests', () => {
  let roomManager: RoomManager;

  beforeEach(() => {
    roomManager = new RoomManager();
  });

  it('should allow a socket to join a room and track membership', () => {
    const socket = createMockSocket();
    roomManager.joinRoom('room-1', socket);

    expect(roomManager.getRoomSize('room-1')).toBe(1);
    expect(roomManager.getSocketRoom(socket)).toBe('room-1');
    expect(roomManager.getActiveRoomsCount()).toBe(1);

    const members = roomManager.getRoomMembers('room-1');
    expect(members).toBeDefined();
    expect(members?.has(socket)).toBe(true);
  });

  it('should ignore duplicate join to the same room', () => {
    const socket = createMockSocket();
    roomManager.joinRoom('room-1', socket);
    roomManager.joinRoom('room-1', socket);

    expect(roomManager.getRoomSize('room-1')).toBe(1);
  });

  it('should remove a socket from prior room when joining a new room', () => {
    const socket = createMockSocket();
    roomManager.joinRoom('room-1', socket);
    expect(roomManager.getRoomSize('room-1')).toBe(1);

    // Switch to room-2
    roomManager.joinRoom('room-2', socket);

    expect(roomManager.getRoomSize('room-1')).toBe(0);
    expect(roomManager.getRoomSize('room-2')).toBe(1);
    expect(roomManager.getSocketRoom(socket)).toBe('room-2');
    expect(roomManager.getActiveRoomsCount()).toBe(1); // room-1 cleaned up
  });

  it('should remove socket and cleanup empty room on leaveRoom', () => {
    const socket1 = createMockSocket();
    const socket2 = createMockSocket();

    roomManager.joinRoom('room-1', socket1);
    roomManager.joinRoom('room-1', socket2);
    expect(roomManager.getRoomSize('room-1')).toBe(2);

    const left = roomManager.leaveRoom(socket1);
    expect(left).toBe('room-1');
    expect(roomManager.getRoomSize('room-1')).toBe(1);
    expect(roomManager.getSocketRoom(socket1)).toBeNull();

    // Leave second socket
    roomManager.leaveRoom(socket2);
    expect(roomManager.getRoomSize('room-1')).toBe(0);
    expect(roomManager.getActiveRoomsCount()).toBe(0); // auto-cleaned
  });

  it('should return null when leaving if socket is not in any room', () => {
    const socket = createMockSocket();
    const left = roomManager.leaveRoom(socket);
    expect(left).toBeNull();
  });

  it('should handle removeSocket identically to leaveRoom', () => {
    const socket = createMockSocket();
    roomManager.joinRoom('room-abc', socket);
    expect(roomManager.getRoomSize('room-abc')).toBe(1);

    const removed = roomManager.removeSocket(socket);
    expect(removed).toBe('room-abc');
    expect(roomManager.getRoomSize('room-abc')).toBe(0);
    expect(roomManager.getActiveRoomsCount()).toBe(0);
  });

  it('should isolate multiple rooms and maintain correct state on removal', () => {
    const socketA = createMockSocket();
    const socketB = createMockSocket();
    const socketC = createMockSocket();

    roomManager.joinRoom('room-1', socketA);
    roomManager.joinRoom('room-1', socketB);
    roomManager.joinRoom('room-2', socketC);

    expect(roomManager.getRoomSize('room-1')).toBe(2);
    expect(roomManager.getRoomSize('room-2')).toBe(1);
    expect(roomManager.getActiveRoomsCount()).toBe(2);

    // Remove socket A from room 1
    roomManager.removeSocket(socketA);

    expect(roomManager.getRoomSize('room-1')).toBe(1);
    expect(roomManager.getRoomMembers('room-1')?.has(socketB)).toBe(true);
    expect(roomManager.getRoomSize('room-2')).toBe(1);
    expect(roomManager.getRoomMembers('room-2')?.has(socketC)).toBe(true);
  });

  it('should broadcast messages to all open sockets in room, excluding specified sender', () => {
    const socket1 = createMockSocket(WebSocket.OPEN);
    const socket2 = createMockSocket(WebSocket.OPEN);
    const socket3 = createMockSocket(WebSocket.CLOSED); // Not open

    roomManager.joinRoom('room-broadcast', socket1);
    roomManager.joinRoom('room-broadcast', socket2);
    roomManager.joinRoom('room-broadcast', socket3);

    const message = { type: 'TEST_BROADCAST', payload: { data: 'hello' } };
    roomManager.broadcastToRoom('room-broadcast', message, socket1);

    // socket1 excluded
    expect(socket1.send).not.toHaveBeenCalled();
    // socket2 receives
    expect(socket2.send).toHaveBeenCalledWith(JSON.stringify(message));
    // socket3 is closed, should not be sent to
    expect(socket3.send).not.toHaveBeenCalled();
  });

  it('should reset all state on clear', () => {
    const socket1 = createMockSocket();
    const socket2 = createMockSocket();

    roomManager.joinRoom('room-1', socket1);
    roomManager.joinRoom('room-2', socket2);
    expect(roomManager.getActiveRoomsCount()).toBe(2);

    roomManager.clear();
    expect(roomManager.getActiveRoomsCount()).toBe(0);
    expect(roomManager.getSocketRoom(socket1)).toBeNull();
    expect(roomManager.getSocketRoom(socket2)).toBeNull();
  });
});
