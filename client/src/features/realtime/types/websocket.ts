export type { CanvasOperation } from '../../../types/canvas.js';

export type ConnectionStatus =
  | 'disconnected'
  | 'connecting'
  | 'connected'
  | 'reconnecting'
  | 'error';

export type ClientMessageType =
  | 'JOIN_ROOM'
  | 'LEAVE_ROOM'
  | 'PING'
  | 'CANVAS_OPERATION';

export type ServerMessageType =
  | 'CONNECTED'
  | 'ROOM_JOINED'
  | 'ROOM_LEFT'
  | 'PONG'
  | 'ERROR'
  | 'CANVAS_OPERATION'
  | 'CANVAS_OPERATION_ACK'
  | 'CANVAS_OPERATION_ERROR';

export type WebSocketErrorCode =
  | 'UNAUTHENTICATED'
  | 'INVALID_MESSAGE'
  | 'UNKNOWN_MESSAGE_TYPE'
  | 'INVALID_ROOM_ID'
  | 'ROOM_NOT_FOUND'
  | 'ROOM_ACCESS_DENIED'
  | 'NOT_IN_ROOM'
  | 'SERVER_ERROR'
  | 'INVALID_OPERATION'
  | 'INVALID_OPERATION_TYPE'
  | 'INVALID_OPERATION_PAYLOAD'
  | 'DUPLICATE_OPERATION';

export interface BaseWebSocketMessage<T = unknown> {
  type: string;
  requestId?: string;
  payload: T;
}

export interface JoinRoomPayload {
  roomId: string;
}

export interface LeaveRoomPayload {
  roomId: string;
}

export interface PingPayload {
  timestamp?: number;
}

export interface ConnectedPayload {
  socketId: string;
  userId: string;
  user: {
    id: string;
    name: string;
    email: string;
    createdAt?: string;
  };
}

export interface RoomJoinedPayload {
  roomId: string;
  userId: string;
}

export interface RoomLeftPayload {
  roomId: string;
}

export interface PongPayload {
  timestamp: number;
}

export interface ErrorPayload {
  code: WebSocketErrorCode;
  message: string;
}

export interface CanvasOperationAckPayload {
  operationId: string;
}

export interface CanvasOperationErrorPayload {
  operationId?: string;
  code: WebSocketErrorCode;
  message: string;
}

export type MessageHandler<T = unknown> = (
  payload: T,
  message: BaseWebSocketMessage<T>,
) => void;

export type StatusListener = (
  status: ConnectionStatus,
  error?: string | null,
) => void;

