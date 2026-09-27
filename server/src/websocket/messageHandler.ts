import { WebSocket } from 'ws';
import mongoose from 'mongoose';
import { Room } from '../models/Room.js';
import type { CanvasOperation } from '../types/canvas.js';
import { validateCanvasOperation } from './operationValidator.js';
import type { RoomManager } from './roomManager.js';
import type {
  AuthenticatedSocketContext,
  BaseWebSocketMessage,
  WebSocketErrorCode,
} from './types.js';

export function sendJson(socket: WebSocket, message: BaseWebSocketMessage): void {
  if (socket.readyState === WebSocket.OPEN) {
    socket.send(JSON.stringify(message));
  }
}

export function sendError(
  socket: WebSocket,
  code: WebSocketErrorCode,
  message: string,
  requestId?: string,
): void {
  sendJson(socket, {
    type: 'ERROR',
    requestId,
    payload: {
      code,
      message,
    },
  });
}

export function sendCanvasOperationError(
  socket: WebSocket,
  code: WebSocketErrorCode,
  message: string,
  operationId?: string,
  requestId?: string,
): void {
  sendJson(socket, {
    type: 'CANVAS_OPERATION_ERROR',
    requestId,
    payload: {
      operationId,
      code,
      message,
    },
  });
}

/**
 * Handles incoming raw data from an authenticated WebSocket.
 */
export async function handleSocketMessage(
  socket: WebSocket,
  rawData: unknown,
  context: AuthenticatedSocketContext,
  roomManager: RoomManager,
): Promise<void> {
  // 1. Parse raw message
  let parsed: unknown;
  try {
    const text =
      typeof rawData === 'string'
        ? rawData
        : rawData instanceof Buffer
          ? rawData.toString('utf-8')
          : String(rawData);

    if (!text || text.trim().length === 0) {
      sendError(socket, 'INVALID_MESSAGE', 'Empty message received');
      return;
    }

    parsed = JSON.parse(text);
  } catch {
    sendError(socket, 'INVALID_MESSAGE', 'Malformed JSON payload');
    return;
  }

  // 2. Validate envelope structure
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    sendError(
      socket,
      'INVALID_MESSAGE',
      'Message must be a non-null JSON object',
    );
    return;
  }

  const messageObj = parsed as Record<string, unknown>;
  const requestId =
    typeof messageObj.requestId === 'string' ? messageObj.requestId : undefined;

  if (typeof messageObj.type !== 'string' || messageObj.type.trim() === '') {
    sendError(
      socket,
      'INVALID_MESSAGE',
      'Message must include a valid string "type"',
      requestId,
    );
    return;
  }

  const messageType = messageObj.type.trim();
  const payload = messageObj.payload;

  // 3. Dispatch based on message type
  switch (messageType) {
    case 'PING': {
      sendJson(socket, {
        type: 'PONG',
        requestId,
        payload: {
          timestamp: Date.now(),
        },
      });
      break;
    }

    case 'JOIN_ROOM': {
      if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
        sendError(
          socket,
          'INVALID_MESSAGE',
          'JOIN_ROOM requires an object payload with roomId',
          requestId,
        );
        return;
      }

      const joinPayload = payload as Record<string, unknown>;
      const roomId = joinPayload.roomId;

      if (typeof roomId !== 'string' || roomId.trim() === '') {
        sendError(
          socket,
          'INVALID_ROOM_ID',
          'roomId is required and must be a string',
          requestId,
        );
        return;
      }

      const cleanRoomId = roomId.trim();

      if (!mongoose.Types.ObjectId.isValid(cleanRoomId)) {
        sendError(
          socket,
          'INVALID_ROOM_ID',
          'Invalid room ID format',
          requestId,
        );
        return;
      }

      try {
        const room = await Room.findById(cleanRoomId);
        if (!room) {
          sendError(socket, 'ROOM_NOT_FOUND', 'Room not found', requestId);
          return;
        }

        const isMember = room.members.some(
          (m) => m.userId.toString() === context.userId,
        );

        if (!isMember) {
          sendError(
            socket,
            'ROOM_ACCESS_DENIED',
            'You are not a member of this room',
            requestId,
          );
          return;
        }

        // Room membership verified: join in-memory room
        roomManager.joinRoom(cleanRoomId, socket);
        context.currentRoomId = cleanRoomId;

        console.log(
          `[WS] Socket ${context.socketId} (user: ${context.userId}) joined room ${cleanRoomId}`,
        );

        sendJson(socket, {
          type: 'ROOM_JOINED',
          requestId,
          payload: {
            roomId: cleanRoomId,
            userId: context.userId,
          },
        });
      } catch (err) {
        const message =
          err instanceof Error ? err.message : 'Failed to join room';
        sendError(socket, 'SERVER_ERROR', message, requestId);
      }
      break;
    }

    case 'LEAVE_ROOM': {
      const currentRoomId = context.currentRoomId;
      if (!currentRoomId) {
        sendError(
          socket,
          'NOT_IN_ROOM',
          'Socket is not currently in any room',
          requestId,
        );
        return;
      }

      // If a specific roomId was requested, verify it matches
      if (
        payload &&
        typeof payload === 'object' &&
        'roomId' in payload &&
        typeof (payload as Record<string, unknown>).roomId === 'string'
      ) {
        const reqRoomId = (payload as Record<string, unknown>).roomId as string;
        if (reqRoomId !== currentRoomId) {
          sendError(
            socket,
            'NOT_IN_ROOM',
            'Socket is not in the specified room',
            requestId,
          );
          return;
        }
      }

      const leftRoomId = roomManager.leaveRoom(socket);
      context.currentRoomId = undefined;

      console.log(
        `[WS] Socket ${context.socketId} left room ${leftRoomId || currentRoomId}`,
      );

      sendJson(socket, {
        type: 'ROOM_LEFT',
        requestId,
        payload: {
          roomId: leftRoomId || currentRoomId,
        },
      });
      break;
    }

    case 'CANVAS_OPERATION': {
      const currentRoomId = context.currentRoomId;
      if (!currentRoomId) {
        sendError(
          socket,
          'NOT_IN_ROOM',
          'Socket must be inside an active room to submit canvas operations',
          requestId,
        );
        return;
      }

      // Verify persistent room authorization in MongoDB
      try {
        const room = await Room.findById(currentRoomId);
        if (!room) {
          sendError(socket, 'ROOM_NOT_FOUND', 'Room not found', requestId);
          return;
        }

        const isMember = room.members.some(
          (m) => m.userId.toString() === context.userId,
        );

        if (!isMember) {
          sendError(
            socket,
            'ROOM_ACCESS_DENIED',
            'You are not an authorized member of this room',
            requestId,
          );
          return;
        }
      } catch (err) {
        const message =
          err instanceof Error ? err.message : 'Failed to verify room authorization';
        sendError(socket, 'SERVER_ERROR', message, requestId);
        return;
      }

      // Validate operation structure and payload
      const validation = validateCanvasOperation(payload);
      if (!validation.isValid) {
        sendCanvasOperationError(
          socket,
          validation.code,
          validation.message,
          validation.operationId,
          requestId,
        );
        return;
      }

      const operation = validation.operation;

      // Duplicate operation detection
      if (roomManager.hasProcessedOperation(operation.operationId)) {
        sendCanvasOperationError(
          socket,
          'DUPLICATE_OPERATION',
          `Operation "${operation.operationId}" was already processed`,
          operation.operationId,
          requestId,
        );
        return;
      }

      // Record operation to prevent duplicate processing
      roomManager.recordProcessedOperation(operation.operationId);

      // Bind server-authenticated user identity & room context (never trust client-supplied userId/roomId)
      const broadcastOperation: CanvasOperation = {
        ...operation,
        canvasId: currentRoomId,
        userId: context.userId,
      };

      // Broadcast to other room members (sender excluded to avoid duplicate local application)
      roomManager.broadcastToRoom(
        currentRoomId,
        {
          type: 'CANVAS_OPERATION',
          payload: broadcastOperation,
        },
        socket,
      );

      // Return explicit ACK to the originating sender
      sendJson(socket, {
        type: 'CANVAS_OPERATION_ACK',
        requestId,
        payload: {
          operationId: operation.operationId,
        },
      });
      break;
    }

    default: {
      sendError(
        socket,
        'UNKNOWN_MESSAGE_TYPE',
        `Unknown message type: "${messageType}"`,
        requestId,
      );
      break;
    }
  }
}
