import type { Server as HttpServer, IncomingMessage } from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import { authenticateSocket } from './auth.js';
import { RoomManager, defaultRoomManager } from './roomManager.js';
import { handleSocketConnection } from './connectionHandler.js';
import type { AuthenticatedSocketContext } from './types.js';
import type { SafeUser } from '../types/auth.js';

export interface CollaborativeWebSocketServer {
  wss: WebSocketServer;
  roomManager: RoomManager;
  socketContexts: Map<WebSocket, AuthenticatedSocketContext>;
  close: () => Promise<void>;
}

export function createWebSocketServer(
  httpServer: HttpServer,
  roomManager: RoomManager = defaultRoomManager,
): CollaborativeWebSocketServer {
  const socketContexts = new Map<WebSocket, AuthenticatedSocketContext>();

  // Initialize WebSocketServer with noServer: true so we handle upgrade manually
  const wss = new WebSocketServer({
    noServer: true,
    maxPayload: 64 * 1024, // 64 KB payload protection limit
  });

  // Attach HTTP upgrade handler
  httpServer.on('upgrade', async (req, socket, head) => {
    let pathname = '';
    try {
      const url = new URL(req.url || '', 'http://localhost');
      pathname = url.pathname;
    } catch {
      socket.write('HTTP/1.1 400 Bad Request\r\nConnection: close\r\n\r\n');
      socket.destroy();
      return;
    }

    if (pathname !== '/ws') {
      // Not our endpoint; do not handle
      return;
    }

    try {
      const user = await authenticateSocket(req);
      wss.handleUpgrade(req, socket, head, (ws) => {
        wss.emit('connection', ws, req, user);
      });
    } catch {
      socket.write('HTTP/1.1 401 Unauthorized\r\nConnection: close\r\n\r\n');
      socket.destroy();
    }
  });

  // Handle successful authenticated connection
  wss.on('connection', (ws: WebSocket, _req: IncomingMessage, user: SafeUser) => {
    handleSocketConnection(ws, user, roomManager, socketContexts);
  });

  // Heartbeat mechanism (30-second interval)
  const HEARTBEAT_INTERVAL_MS = 30000;
  const heartbeatInterval = setInterval(() => {
    for (const [ws, ctx] of socketContexts.entries()) {
      if (!ctx.isAlive) {
        console.log(`[WS] Terminating unresponsive socket ${ctx.socketId}`);
        roomManager.removeSocket(ws);
        socketContexts.delete(ws);
        ws.terminate();
        continue;
      }
      ctx.isAlive = false;
      ws.ping();
    }
  }, HEARTBEAT_INTERVAL_MS);

  // Unref interval so it does not block process exit during tests
  if (heartbeatInterval.unref) {
    heartbeatInterval.unref();
  }

  const close = async (): Promise<void> => {
    clearInterval(heartbeatInterval);

    for (const [ws] of socketContexts) {
      if (
        ws.readyState === WebSocket.OPEN ||
        ws.readyState === WebSocket.CONNECTING
      ) {
        ws.close(1001, 'Server shutting down');
      }
    }

    roomManager.clear();
    socketContexts.clear();

    await new Promise<void>((resolve, reject) => {
      wss.close((err) => {
        if (err) reject(err);
        else resolve();
      });
    });
  };

  console.log('[WS] WebSocket server initialized on endpoint /ws');

  return {
    wss,
    roomManager,
    socketContexts,
    close,
  };
}
