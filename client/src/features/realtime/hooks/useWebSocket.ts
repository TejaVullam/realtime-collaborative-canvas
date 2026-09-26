import { useEffect, useState, useCallback, useRef } from 'react';
import {
  WebSocketClient,
  defaultWebSocketClient,
} from '../services/websocketClient.js';
import type { ConnectionStatus, MessageHandler } from '../types/websocket.js';

export interface UseWebSocketOptions {
  roomId?: string;
  token?: string | null;
  client?: WebSocketClient;
  autoConnect?: boolean;
}

export function useWebSocket({
  roomId,
  token,
  client = defaultWebSocketClient,
  autoConnect = true,
}: UseWebSocketOptions) {
  const [status, setStatus] = useState<ConnectionStatus>(client.getStatus());
  const [error, setError] = useState<string | null>(client.getLastError());
  const clientRef = useRef(client);
  clientRef.current = client;

  // Listen to status changes
  useEffect(() => {
    const unsubscribe = client.onStatusChange((newStatus, newError) => {
      setStatus(newStatus);
      setError(newError ?? null);
    });

    return () => {
      unsubscribe();
    };
  }, [client]);

  // Connect on token presence
  useEffect(() => {
    if (autoConnect && token) {
      client.connect(token);
    }
  }, [autoConnect, token, client]);

  // Join room when connected and roomId is present
  useEffect(() => {
    if (status === 'connected' && roomId) {
      client.joinRoom(roomId);
    }

    return () => {
      if (roomId) {
        client.leaveRoom(roomId);
      }
    };
  }, [status, roomId, client]);

  const send = useCallback(
    <T = unknown>(type: string, payload: T, requestId?: string): boolean => {
      return clientRef.current.send(type, payload, requestId);
    },
    [],
  );

  const subscribe = useCallback(
    <T = unknown>(type: string, handler: MessageHandler<T>): (() => void) => {
      return clientRef.current.subscribe(type, handler);
    },
    [],
  );

  return {
    status,
    isConnected: status === 'connected',
    error,
    send,
    subscribe,
    client,
  };
}
