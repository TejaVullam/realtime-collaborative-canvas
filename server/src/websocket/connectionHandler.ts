import crypto from 'crypto';
import { WebSocket } from 'ws';
import type { SafeUser } from '../types/auth.js';
import type { RoomManager } from './roomManager.js';
import { handleSocketMessage, sendJson } from './messageHandler.js';
import type { AuthenticatedSocketContext } from './types.js';

export function handleSocketConnection(
  socket: WebSocket,
  user: SafeUser,
  roomManager: RoomManager,
  socketContexts: Map<WebSocket, AuthenticatedSocketContext>,
): AuthenticatedSocketContext {
  const socketId = crypto.randomUUID();
  const context: AuthenticatedSocketContext = {
    socketId,
    userId: user.id,
    user,
    connectedAt: Date.now(),
    isAlive: true,
  };

  socketContexts.set(socket, context);

  console.log(
    `[WS] Socket ${socketId} connected and authenticated (user: ${user.id})`,
  );

  // Send CONNECTED handshake message
  sendJson(socket, {
    type: 'CONNECTED',
    payload: {
      socketId,
      userId: user.id,
      user,
    },
  });

  // Native heartbeat pong response
  socket.on('pong', () => {
    context.isAlive = true;
  });

  // Message handler
  socket.on('message', async (data) => {
    try {
      await handleSocketMessage(socket, data, context, roomManager);
    } catch (err) {
      console.error(`[WS] Unhandled message error on socket ${socketId}:`, err);
    }
  });

  // Disconnection handler
  const handleDisconnect = () => {
    const wasInRoom = context.currentRoomId;
    roomManager.removeSocket(socket);
    socketContexts.delete(socket);

    console.log(
      `[WS] Socket ${socketId} disconnected (user: ${user.id}${wasInRoom ? `, left room: ${wasInRoom}` : ''})`,
    );
  };

  socket.on('close', handleDisconnect);
  socket.on('error', (err) => {
    console.error(`[WS] Socket error on ${socketId}:`, err.message);
    handleDisconnect();
  });

  return context;
}
