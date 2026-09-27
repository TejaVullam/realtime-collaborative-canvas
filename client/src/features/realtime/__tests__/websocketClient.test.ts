import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { WebSocketClient } from '../services/websocketClient.js';
import type { BaseWebSocketMessage } from '../types/websocket.js';

class MockWebSocket {
  static CONNECTING = 0;
  static OPEN = 1;
  static CLOSING = 2;
  static CLOSED = 3;

  static instances: MockWebSocket[] = [];
  url: string;
  readyState: number = 0; // CONNECTING = 0, OPEN = 1, CLOSING = 2, CLOSED = 3
  onopen: (() => void) | null = null;
  onclose: (() => void) | null = null;
  onerror: (() => void) | null = null;
  onmessage: ((event: { data: string }) => void) | null = null;
  sentMessages: string[] = [];

  constructor(url: string) {
    this.url = url;
    MockWebSocket.instances.push(this);
    // Simulate auto-connecting to open state on next tick
    setTimeout(() => {
      this.readyState = MockWebSocket.OPEN;
      if (this.onopen) this.onopen();
    }, 10);
  }

  send(data: string) {
    this.sentMessages.push(data);
  }

  close() {
    this.readyState = MockWebSocket.CLOSED;
    if (this.onclose) this.onclose();
  }

  // Test helper to simulate server sending a message to client
  simulateServerMessage(msg: BaseWebSocketMessage) {
    if (this.onmessage) {
      this.onmessage({ data: JSON.stringify(msg) });
    }
  }

  // Test helper to simulate server unexpected disconnection
  simulateServerClose() {
    this.readyState = MockWebSocket.CLOSED;
    if (this.onclose) {
      this.onclose();
    }
  }
}

describe('WebSocketClient Service & Lifecycle Hardening Suite', () => {
  let client: WebSocketClient;
  const originalWebSocket = globalThis.WebSocket;

  beforeEach(() => {
    vi.useFakeTimers();
    MockWebSocket.instances = [];
    // @ts-expect-error Mocking global WebSocket
    globalThis.WebSocket = MockWebSocket;

    client = new WebSocketClient({
      wsUrl: 'ws://localhost:5000/ws',
      baseDelayMs: 100,
      maxDelayMs: 1000,
      maxReconnectAttempts: 5,
    });
  });

  afterEach(() => {
    client.disconnect();
    globalThis.WebSocket = originalWebSocket;
    vi.useRealTimers();
  });

  it('A. Normal connection: transitions from connecting to connected upon server handshake', () => {
    expect(client.getStatus()).toBe('disconnected');

    client.connect('valid-jwt-token');
    expect(client.getStatus()).toBe('connecting');

    // Trigger mock open
    vi.advanceTimersByTime(20);
    const mockSocket = MockWebSocket.instances[0];
    expect(mockSocket).toBeDefined();

    // Server sends CONNECTED envelope
    mockSocket.simulateServerMessage({
      type: 'CONNECTED',
      payload: {
        socketId: 's1',
        userId: 'u1',
        user: { id: 'u1', name: 'Alice', email: 'alice@example.com' },
      },
    });

    expect(client.getStatus()).toBe('connected');
    expect(client.getLastError()).toBeNull();
  });

  it('B. Room join: successfully joins room when connected', () => {
    client.connect('token-123');
    vi.advanceTimersByTime(20);
    const mockSocket = MockWebSocket.instances[0];

    client.joinRoom('room-alpha');
    expect(client.getCurrentRoom()).toBe('room-alpha');

    const lastMsg = JSON.parse(
      mockSocket.sentMessages[mockSocket.sentMessages.length - 1],
    );
    expect(lastMsg.type).toBe('JOIN_ROOM');
    expect(lastMsg.payload.roomId).toBe('room-alpha');

    mockSocket.simulateServerMessage({
      type: 'ROOM_JOINED',
      payload: { roomId: 'room-alpha', userId: 'u1' },
    });
    expect(client.getCurrentRoom()).toBe('room-alpha');
  });

  it('C. Network failure: retains currentRoomId during reconnect attempts', () => {
    client.connect('token-123');
    vi.advanceTimersByTime(20);
    const firstSocket = MockWebSocket.instances[0];

    firstSocket.simulateServerMessage({
      type: 'CONNECTED',
      payload: { socketId: 's1', userId: 'u1', user: { id: 'u1', name: 'Alice', email: 'alice@example.com' } },
    });
    client.joinRoom('room-alpha');
    firstSocket.simulateServerMessage({
      type: 'ROOM_JOINED',
      payload: { roomId: 'room-alpha', userId: 'u1' },
    });
    expect(client.getCurrentRoom()).toBe('room-alpha');

    // Simulate unexpected network failure
    firstSocket.simulateServerClose();

    // Verification: status is reconnecting, BUT room identity is preserved!
    expect(client.getStatus()).toBe('reconnecting');
    expect(client.getCurrentRoom()).toBe('room-alpha');
  });

  it('D. Automatic rejoin: sends JOIN_ROOM exactly once after successful reconnect', () => {
    client.connect('token-123');
    vi.advanceTimersByTime(20);
    const firstSocket = MockWebSocket.instances[0];

    firstSocket.simulateServerMessage({
      type: 'CONNECTED',
      payload: { socketId: 's1', userId: 'u1', user: { id: 'u1', name: 'Alice', email: 'alice@example.com' } },
    });
    client.joinRoom('room-reconnect-auto');
    firstSocket.simulateServerMessage({
      type: 'ROOM_JOINED',
      payload: { roomId: 'room-reconnect-auto', userId: 'u1' },
    });

    // Network drops
    firstSocket.simulateServerClose();
    expect(client.getStatus()).toBe('reconnecting');
    expect(client.getCurrentRoom()).toBe('room-reconnect-auto');

    // Advance timers for backoff delay (base delay 100ms + jitter)
    vi.advanceTimersByTime(300);

    // Second socket connects
    expect(MockWebSocket.instances.length).toBe(2);
    const secondSocket = MockWebSocket.instances[1];

    vi.advanceTimersByTime(20);
    secondSocket.simulateServerMessage({
      type: 'CONNECTED',
      payload: { socketId: 's2', userId: 'u1', user: { id: 'u1', name: 'Alice', email: 'alice@example.com' } },
    });

    expect(client.getStatus()).toBe('connected');

    // Verify JOIN_ROOM was sent automatically exactly once on the new socket
    const joinRoomMessages = secondSocket.sentMessages.filter((m) => {
      const p = JSON.parse(m);
      return p.type === 'JOIN_ROOM' && p.payload.roomId === 'room-reconnect-auto';
    });
    expect(joinRoomMessages.length).toBe(1);

    // Server sends ROOM_JOINED
    secondSocket.simulateServerMessage({
      type: 'ROOM_JOINED',
      payload: { roomId: 'room-reconnect-auto', userId: 'u1' },
    });
    expect(client.getCurrentRoom()).toBe('room-reconnect-auto');
  });

  it('E. Explicit disconnect: clears timer, prevents reconnect, closes socket and resets state', () => {
    client.connect('token-123');
    vi.advanceTimersByTime(20);
    const mockSocket = MockWebSocket.instances[0];

    client.joinRoom('room-to-leave');
    mockSocket.simulateServerMessage({
      type: 'CONNECTED',
      payload: { socketId: 's1', userId: 'u1', user: { id: 'u1', name: 'Alice', email: 'alice@example.com' } },
    });

    client.disconnect();

    expect(client.getStatus()).toBe('disconnected');
    expect(client.getCurrentRoom()).toBeNull();
    expect(mockSocket.readyState).toBe(MockWebSocket.CLOSED);

    // Ensure advancing time does not trigger any reconnection attempt
    vi.advanceTimersByTime(5000);
    expect(MockWebSocket.instances.length).toBe(1);
    expect(client.getStatus()).toBe('disconnected');
  });

  it('F & G. Unmount and Logout cleanup: disconnect() stops active reconnect timers immediately', () => {
    client.connect('token-123');
    vi.advanceTimersByTime(20);
    const mockSocket = MockWebSocket.instances[0];

    // Trigger unexpected network failure to schedule reconnect timer
    mockSocket.simulateServerClose();
    expect(client.getStatus()).toBe('reconnecting');

    // Simulate component unmount or user logout while reconnecting
    client.disconnect();
    expect(client.getStatus()).toBe('disconnected');

    // Advance time beyond all backoff delays; verify no new connection is created
    vi.advanceTimersByTime(10000);
    expect(MockWebSocket.instances.length).toBe(1);
    expect(client.getStatus()).toBe('disconnected');
  });

  it('H. Room switching: leaves old room before joining new room and avoids stale room state', () => {
    client.connect('token-123');
    vi.advanceTimersByTime(20);
    const mockSocket = MockWebSocket.instances[0];

    mockSocket.simulateServerMessage({
      type: 'CONNECTED',
      payload: { socketId: 's1', userId: 'u1', user: { id: 'u1', name: 'Alice', email: 'alice@example.com' } },
    });

    // Join Room A
    client.joinRoom('room-A');
    mockSocket.simulateServerMessage({
      type: 'ROOM_JOINED',
      payload: { roomId: 'room-A', userId: 'u1' },
    });
    expect(client.getCurrentRoom()).toBe('room-A');

    // Switch to Room B
    client.joinRoom('room-B');
    expect(client.getCurrentRoom()).toBe('room-B');

    // Should have sent LEAVE_ROOM for room-A, then JOIN_ROOM for room-B
    const parsedSent = mockSocket.sentMessages.map((m) => JSON.parse(m));
    const leaveA = parsedSent.find(
      (m) => m.type === 'LEAVE_ROOM' && m.payload.roomId === 'room-A',
    );
    const joinB = parsedSent.find(
      (m) => m.type === 'JOIN_ROOM' && m.payload.roomId === 'room-B',
    );

    expect(leaveA).toBeDefined();
    expect(joinB).toBeDefined();
  });

  it('I. Duplicate join prevention: does not re-send JOIN_ROOM if already joined in same connection', () => {
    client.connect('token-123');
    vi.advanceTimersByTime(20);
    const mockSocket = MockWebSocket.instances[0];

    mockSocket.simulateServerMessage({
      type: 'CONNECTED',
      payload: { socketId: 's1', userId: 'u1', user: { id: 'u1', name: 'Alice', email: 'alice@example.com' } },
    });

    // First join
    client.joinRoom('room-idempotent');
    mockSocket.simulateServerMessage({
      type: 'ROOM_JOINED',
      payload: { roomId: 'room-idempotent', userId: 'u1' },
    });

    const initialSentCount = mockSocket.sentMessages.length;

    // Repeated join calls for the exact same room
    client.joinRoom('room-idempotent');
    client.joinRoom('room-idempotent');

    expect(mockSocket.sentMessages.length).toBe(initialSentCount);
  });

  it('J. Reconnect exhaustion: stops reconnecting and transitions to error after max attempts', () => {
    client.connect('token-123');
    vi.advanceTimersByTime(20);

    // Trigger unexpected close continuously without server responding
    for (let i = 0; i < 6; i++) {
      const s = MockWebSocket.instances[MockWebSocket.instances.length - 1];
      if (s) {
        s.simulateServerClose();
      }
      vi.advanceTimersByTime(2000);
    }

    expect(client.getStatus()).toBe('error');
    expect(client.getLastError()).toContain('Maximum reconnection attempts');

    // Ensure no additional timers are scheduled
    const totalInstances = MockWebSocket.instances.length;
    vi.advanceTimersByTime(10000);
    expect(MockWebSocket.instances.length).toBe(totalInstances);
  });

  it('should clean up listeners on old socket when new socket is created', () => {
    client.connect('token-123');
    vi.advanceTimersByTime(20);
    const firstSocket = MockWebSocket.instances[0];

    // Simulate unexpected drop
    firstSocket.simulateServerClose();
    vi.advanceTimersByTime(300);

    // First socket listeners should be cleared
    expect(firstSocket.onmessage).toBeNull();
    expect(firstSocket.onclose).toBeNull();
    expect(firstSocket.onerror).toBeNull();
  });

  it('should notify subscribers when message of subscribed type is received', () => {
    client.connect('token-123');
    vi.advanceTimersByTime(20);
    const mockSocket = MockWebSocket.instances[0];

    const messageHandler = vi.fn();
    const unsubscribe = client.subscribe('CUSTOM_EVENT', messageHandler);

    mockSocket.simulateServerMessage({
      type: 'CUSTOM_EVENT',
      payload: { count: 42 },
    });

    expect(messageHandler).toHaveBeenCalledWith(
      { count: 42 },
      expect.objectContaining({ type: 'CUSTOM_EVENT' }),
    );

    // Unsubscribe and verify no further invocations
    unsubscribe();
    mockSocket.simulateServerMessage({
      type: 'CUSTOM_EVENT',
      payload: { count: 43 },
    });
    expect(messageHandler).toHaveBeenCalledTimes(1);
  });

  it('should send messages serialized with optional requestId', () => {
    client.connect('token-123');
    vi.advanceTimersByTime(20);
    const mockSocket = MockWebSocket.instances[0];

    const sent = client.send('PING', { test: true }, 'req-1');
    expect(sent).toBe(true);
    expect(mockSocket.sentMessages.length).toBe(1);

    const parsed = JSON.parse(mockSocket.sentMessages[0]);
    expect(parsed.type).toBe('PING');
    expect(parsed.requestId).toBe('req-1');
    expect(parsed.payload).toEqual({ test: true });
  });

  it('should send LEAVE_ROOM and clear current room on ROOM_LEFT', () => {
    client.connect('token-123');
    vi.advanceTimersByTime(20);
    const mockSocket = MockWebSocket.instances[0];

    client.joinRoom('room-alpha');
    client.leaveRoom();

    const lastMsg = JSON.parse(
      mockSocket.sentMessages[mockSocket.sentMessages.length - 1],
    );
    expect(lastMsg.type).toBe('LEAVE_ROOM');

    mockSocket.simulateServerMessage({
      type: 'ROOM_LEFT',
      payload: { roomId: 'room-alpha' },
    });
    expect(client.getCurrentRoom()).toBeNull();
  });
});
