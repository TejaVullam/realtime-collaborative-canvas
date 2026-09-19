import type { Request } from 'express';

export interface SafeUser {
  id: string;
  name: string;
  email: string;
  createdAt: string | Date;
  updatedAt?: string | Date;
}

export interface AuthTokens {
  token: string;
}

export interface AuthResponse {
  user: SafeUser;
  token?: string;
  message?: string;
}

export interface RegisterDTO {
  name: string;
  email: string;
  password: string;
}

export interface LoginDTO {
  email: string;
  password: string;
}

export interface JWTPayload {
  userId: string;
  email: string;
}

export interface AuthenticatedRequest extends Request {
  user?: SafeUser;
}
