import type {
  BaseWebSocketMessage,
  ConnectionStatus,
  MessageHandler,
  StatusListener,
} from '../types/websocket.js';

export interface WebSocketClientOptions {
  wsUrl?: string;
  baseDelayMs?: number;
  maxDelayMs?: number;
  maxReconnectAttempts?: number;
}

export class WebSocketClient {
  private socket: WebSocket | null = null;
  private status: ConnectionStatus = 'disconnected';
  private lastError: string | null = null;
  private currentRoomId: string | null = null;
  private token: string | null = null;
  private wsUrl: string;

  private isExplicitDisconnect = false;
  private reconnectAttempts = 0;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;

  private readonly baseDelay: number;
  private readonly maxDelay: number;
  private readonly maxReconnectAttempts: number;

  private subscribers: Map<string, Set<MessageHandler<unknown>>> = new Map();
  private statusListeners: Set<StatusListener> = new Set();

  constructor(options: WebSocketClientOptions = {}) {
    this.baseDelay = options.baseDelayMs ?? 1000;
    this.maxDelay = options.maxDelayMs ?? 16000;
    this.maxReconnectAttempts = options.maxReconnectAttempts ?? 10;

    if (options.wsUrl) {
      this.wsUrl = options.wsUrl;
    } else {
      // Default to backend port 5000 in dev or current origin in production
      if (typeof window !== 'undefined') {
        const isSecure = window.location.protocol === 'https:';
        const host =
          window.location.hostname === 'localhost' ||
          window.location.hostname === '127.0.0.1'
            ? `${window.location.hostname}:5000`
            : window.location.host;
        this.wsUrl = `${isSecure ? 'wss:' : 'ws:'}//${host}/ws`;
      } else {
        this.wsUrl = 'ws://localhost:5000/ws';
      }
    }
  }

  getStatus(): ConnectionStatus {
    return this.status;
  }

  getLastError(): string | null {
    return this.lastError;
  }

  getCurrentRoom(): string | null {
    return this.currentRoomId;
  }

  private setStatus(newStatus: ConnectionStatus, error: string | null = null) {
    this.status = newStatus;
    if (error !== undefined) {
      this.lastError = error;
    }
    for (const listener of this.statusListeners) {
      try {
        listener(newStatus, this.lastError);
      } catch (err) {
        console.error('Error in status listener:', err);
      }
    }
  }

  connect(token: string, wsUrl?: string): void {
    if (wsUrl) {
      this.wsUrl = wsUrl;
    }
    this.token = token;
    this.isExplicitDisconnect = false;

    // Clear any pending reconnect timers
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }

    // If socket is already open or connecting with same token, keep it
    if (
      this.socket &&
      (this.socket.readyState === WebSocket.OPEN ||
        this.socket.readyState === WebSocket.CONNECTING)
    ) {
      return;
    }

    if (this.status !== 'reconnecting') {
      this.setStatus('connecting', null);
    }

    try {
      const fullUrl = `${this.wsUrl}?token=${encodeURIComponent(token)}`;
      const ws = new WebSocket(fullUrl);
      this.socket = ws;

      ws.onopen = () => {
        // Transport connected, awaiting server CONNECTED handshake
      };

      ws.onmessage = (event: MessageEvent) => {
        try {
          const raw =
            typeof event.data === 'string'
              ? event.data
              : event.data.toString();
          const message = JSON.parse(raw) as BaseWebSocketMessage;

          this.handleIncomingMessage(message);
        } catch {
          console.warn('[WS Client] Failed to parse message:', event.data);
        }
      };

      ws.onerror = () => {
        this.lastError = 'WebSocket connection error';
      };

      ws.onclose = () => {
        this.socket = null;
        if (this.isExplicitDisconnect) {
          this.setStatus('disconnected', null);
        } else {
          this.scheduleReconnect();
        }
      };
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Failed to create WebSocket';
      this.setStatus('error', message);
      this.scheduleReconnect();
    }
  }

  private handleIncomingMessage(message: BaseWebSocketMessage): void {
    // Protocol-level lifecycle management
    if (message.type === 'CONNECTED') {
      this.reconnectAttempts = 0;
      this.setStatus('connected', null);

      // If we were previously in a room, automatically re-join upon reconnection
      if (this.currentRoomId) {
        this.send('JOIN_ROOM', { roomId: this.currentRoomId });
      }
    } else if (message.type === 'ROOM_JOINED') {
      const payload = message.payload as { roomId?: string };
      if (payload && payload.roomId) {
        this.currentRoomId = payload.roomId;
      }
    } else if (message.type === 'ROOM_LEFT') {
      this.currentRoomId = null;
    } else if (message.type === 'ERROR') {
      const payload = message.payload as { message?: string };
      this.lastError = payload?.message || 'WebSocket server error';
    }

    // Dispatch to subscribers
    const handlers = this.subscribers.get(message.type);
    if (handlers) {
      for (const handler of handlers) {
        try {
          handler(message.payload, message);
        } catch (err) {
          console.error(
            `Error in subscriber for message type "${message.type}":`,
            err,
          );
        }
      }
    }
  }

  private scheduleReconnect(): void {
    if (this.isExplicitDisconnect || !this.token) {
      this.setStatus('disconnected', null);
      return;
    }

    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      this.setStatus(
        'error',
        'Maximum reconnection attempts reached. Please refresh.',
      );
      return;
    }

    this.setStatus('reconnecting', this.lastError);

    // Exponential backoff with bounded jitter
    const delay = Math.min(
      this.baseDelay * Math.pow(2, this.reconnectAttempts),
      this.maxDelay,
    );
    const jitter = delay * 0.2 * (Math.random() * 2 - 1);
    const minDelay = Math.floor(this.baseDelay * 0.5);
    const finalDelay = Math.max(minDelay, Math.floor(delay + jitter));

    this.reconnectAttempts++;

    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      if (!this.isExplicitDisconnect && this.token) {
        this.connect(this.token, this.wsUrl);
      }
    }, finalDelay);
  }

  disconnect(): void {
    this.isExplicitDisconnect = true;
    this.token = null;
    this.currentRoomId = null;

    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }

    if (this.socket) {
      const ws = this.socket;
      this.socket = null;
      if (
        ws.readyState === WebSocket.OPEN ||
        ws.readyState === WebSocket.CONNECTING
      ) {
        ws.close(1000, 'Client closed connection');
      }
    }

    this.setStatus('disconnected', null);
  }

  send<T = unknown>(type: string, payload: T, requestId?: string): boolean {
    if (!this.socket || this.socket.readyState !== WebSocket.OPEN) {
      return false;
    }

    const message: BaseWebSocketMessage<T> = {
      type,
      payload,
    };
    if (requestId) {
      message.requestId = requestId;
    }

    this.socket.send(JSON.stringify(message));
    return true;
  }

  joinRoom(roomId: string): void {
    this.currentRoomId = roomId;
    if (this.socket && this.socket.readyState === WebSocket.OPEN) {
      this.send('JOIN_ROOM', { roomId });
    }
  }

  leaveRoom(roomId?: string): void {
    const targetRoom = roomId || this.currentRoomId;
    if (targetRoom && this.socket && this.socket.readyState === WebSocket.OPEN) {
      this.send('LEAVE_ROOM', { roomId: targetRoom });
    }
    this.currentRoomId = null;
  }

  subscribe<T = unknown>(
    type: string,
    handler: MessageHandler<T>,
  ): () => void {
    let set = this.subscribers.get(type);
    if (!set) {
      set = new Set();
      this.subscribers.set(type, set);
    }
    set.add(handler as MessageHandler<unknown>);

    return () => {
      this.unsubscribe(type, handler);
    };
  }

  unsubscribe<T = unknown>(type: string, handler: MessageHandler<T>): void {
    const set = this.subscribers.get(type);
    if (set) {
      set.delete(handler as MessageHandler<unknown>);
      if (set.size === 0) {
        this.subscribers.delete(type);
      }
    }
  }

  onStatusChange(listener: StatusListener): () => void {
    this.statusListeners.add(listener);
    // Emit current state immediately
    listener(this.status, this.lastError);

    return () => {
      this.statusListeners.delete(listener);
    };
  }
}

export const defaultWebSocketClient = new WebSocketClient();
