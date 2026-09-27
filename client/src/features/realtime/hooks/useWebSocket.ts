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

  // Effect A: Connection lifecycle (connect on token, disconnect on unmount or token removal)
  useEffect(() => {
    if (autoConnect && token) {
      client.connect(token);
    }

    return () => {
      // Component unmount or token removal: explicitly disconnect socket
      client.disconnect();
    };
  }, [autoConnect, token, client]);

  // Effect B: Room lifecycle (join room on mount/roomId change, leave room on roomId change or unmount)
  // Crucial: status is NOT a dependency here so network failures do NOT trigger room leave!
  useEffect(() => {
    if (!roomId) return;

    client.joinRoom(roomId);

    return () => {
      client.leaveRoom(roomId);
    };
  }, [roomId, client]);

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

  const joinRoom = useCallback(
    (targetRoomId: string) => {
      clientRef.current.joinRoom(targetRoomId);
    },
    [],
  );

  const leaveRoom = useCallback(
    (targetRoomId?: string) => {
      clientRef.current.leaveRoom(targetRoomId);
    },
    [],
  );

  return {
    status,
    isConnected: status === 'connected',
    error,
    send,
    subscribe,
    joinRoom,
    leaveRoom,
    client,
  };
}
