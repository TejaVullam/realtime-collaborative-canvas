import type { SafeUser } from '../types/auth.js';

export type ClientMessageType =
  | 'JOIN_ROOM'
  | 'LEAVE_ROOM'
  | 'PING';

export type ServerMessageType =
  | 'CONNECTED'
  | 'ROOM_JOINED'
  | 'ROOM_LEFT'
  | 'PONG'
  | 'ERROR';

export type WebSocketErrorCode =
  | 'UNAUTHENTICATED'
  | 'INVALID_MESSAGE'
  | 'UNKNOWN_MESSAGE_TYPE'
  | 'INVALID_ROOM_ID'
  | 'ROOM_NOT_FOUND'
  | 'ROOM_ACCESS_DENIED'
  | 'NOT_IN_ROOM'
  | 'SERVER_ERROR';

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
  user: SafeUser;
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

export interface AuthenticatedSocketContext {
  socketId: string;
  userId: string;
  user: SafeUser;
  connectedAt: number;
  currentRoomId?: string;
  isAlive: boolean;
}
