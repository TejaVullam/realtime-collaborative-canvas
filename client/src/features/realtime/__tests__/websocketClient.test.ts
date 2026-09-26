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
    this.readyState = 3; // CLOSED
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
    this.readyState = 3;
    if (this.onclose) {
      this.onclose();
    }
  }
}

describe('WebSocketClient Service Suite', () => {
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

  it('should initialize with disconnected status and no active room', () => {
    expect(client.getStatus()).toBe('disconnected');
    expect(client.getCurrentRoom()).toBeNull();
    expect(client.getLastError()).toBeNull();
  });

  it('should transition to connecting when connect is called and connected upon server handshake', async () => {
    client.connect('valid-jwt-token');
    expect(client.getStatus()).toBe('connecting');

    // Fast-forward to trigger mock open
    vi.advanceTimersByTime(20);
    const mockSocket = MockWebSocket.instances[0];
    expect(mockSocket).toBeDefined();

    // Server sends CONNECTED envelope
    mockSocket.simulateServerMessage({
      type: 'CONNECTED',
      payload: { socketId: 's1', userId: 'u1', user: { id: 'u1', name: 'Alice', email: 'alice@example.com' } },
    });

    expect(client.getStatus()).toBe('connected');
    expect(client.getLastError()).toBeNull();
  });

  it('should transition to disconnected when explicitly calling disconnect', () => {
    client.connect('token-123');
    vi.advanceTimersByTime(20);

    const mockSocket = MockWebSocket.instances[0];
    mockSocket.simulateServerMessage({
      type: 'CONNECTED',
      payload: { socketId: 's1', userId: 'u1', user: { id: 'u1', name: 'Alice', email: 'alice@example.com' } },
    });
    expect(client.getStatus()).toBe('connected');

    client.disconnect();
    expect(client.getStatus()).toBe('disconnected');
    expect(mockSocket.readyState).toBe(3); // CLOSED
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

  it('should send JOIN_ROOM and update current room on ROOM_JOINED', () => {
    client.connect('token-123');
    vi.advanceTimersByTime(20);
    const mockSocket = MockWebSocket.instances[0];

    client.joinRoom('room-alpha');
    expect(client.getCurrentRoom()).toBe('room-alpha');

    const lastMsg = JSON.parse(mockSocket.sentMessages[mockSocket.sentMessages.length - 1]);
    expect(lastMsg.type).toBe('JOIN_ROOM');
    expect(lastMsg.payload.roomId).toBe('room-alpha');

    mockSocket.simulateServerMessage({
      type: 'ROOM_JOINED',
      payload: { roomId: 'room-alpha', userId: 'u1' },
    });
    expect(client.getCurrentRoom()).toBe('room-alpha');
  });

  it('should send LEAVE_ROOM and clear current room on ROOM_LEFT', () => {
    client.connect('token-123');
    vi.advanceTimersByTime(20);
    const mockSocket = MockWebSocket.instances[0];

    client.joinRoom('room-alpha');
    client.leaveRoom();

    const lastMsg = JSON.parse(mockSocket.sentMessages[mockSocket.sentMessages.length - 1]);
    expect(lastMsg.type).toBe('LEAVE_ROOM');

    mockSocket.simulateServerMessage({
      type: 'ROOM_LEFT',
      payload: { roomId: 'room-alpha' },
    });
    expect(client.getCurrentRoom()).toBeNull();
  });

  it('should trigger reconnection with backoff on unexpected socket close and rejoin active room', () => {
    client.connect('token-123');
    vi.advanceTimersByTime(20);
    const firstSocket = MockWebSocket.instances[0];

    // Establish connection and join room
    firstSocket.simulateServerMessage({
      type: 'CONNECTED',
      payload: { socketId: 's1', userId: 'u1', user: { id: 'u1', name: 'Alice', email: 'alice@example.com' } },
    });
    client.joinRoom('room-reconnect-test');

    // Simulate unexpected server crash/disconnect
    firstSocket.simulateServerClose();

    expect(client.getStatus()).toBe('reconnecting');

    // Advance timers for backoff delay (base delay 100ms + jitter)
    vi.advanceTimersByTime(300);

    // Second socket instance created
    expect(MockWebSocket.instances.length).toBe(2);
    const secondSocket = MockWebSocket.instances[1];

    vi.advanceTimersByTime(20);
    // Server acknowledges new connection
    secondSocket.simulateServerMessage({
      type: 'CONNECTED',
      payload: { socketId: 's2', userId: 'u1', user: { id: 'u1', name: 'Alice', email: 'alice@example.com' } },
    });

    expect(client.getStatus()).toBe('connected');

    // Automatically re-joined prior room!
    const reconnectedJoin = secondSocket.sentMessages.find((m) => {
      const p = JSON.parse(m);
      return p.type === 'JOIN_ROOM' && p.payload.roomId === 'room-reconnect-test';
    });
    expect(reconnectedJoin).toBeDefined();
  });

  it('should stop reconnecting and transition to error after maxReconnectAttempts', () => {
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
  });
});
