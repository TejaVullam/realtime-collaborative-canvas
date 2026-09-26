import type { IncomingMessage } from 'http';
import { AuthService } from '../services/auth.service.js';
import type { SafeUser } from '../types/auth.js';

export class WebSocketAuthError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'WebSocketAuthError';
  }
}

/**
 * Extracts and verifies JWT from incoming HTTP upgrade request.
 * Supports token via:
 * 1. Query parameter: /ws?token=<token>
 * 2. Header: Authorization: Bearer <token>
 * 3. Header: Sec-WebSocket-Protocol: <token>
 */
export async function authenticateSocket(
  req: IncomingMessage,
): Promise<SafeUser> {
  let token: string | null = null;

  // 1. Check query parameter
  if (req.url) {
    try {
      const parsedUrl = new URL(req.url, 'http://localhost');
      token = parsedUrl.searchParams.get('token');
    } catch {
      // Ignore parse failure; fallback to headers
    }
  }

  // 2. Check Authorization header
  if (!token && req.headers.authorization) {
    const parts = req.headers.authorization.split(' ');
    if (parts.length === 2 && parts[0] === 'Bearer') {
      token = parts[1];
    }
  }

  // 3. Check Sec-WebSocket-Protocol header
  if (!token && req.headers['sec-websocket-protocol']) {
    const protocols = req.headers['sec-websocket-protocol']
      .split(',')
      .map((p) => p.trim());
    // Often passed as ['bearer', '<token>'] or just ['<token>']
    if (protocols.length >= 2 && protocols[0].toLowerCase() === 'bearer') {
      token = protocols[1];
    } else if (protocols.length === 1 && protocols[0].length > 20) {
      token = protocols[0];
    }
  }

  if (!token) {
    throw new WebSocketAuthError('Authentication required. Missing token.');
  }

  try {
    const payload = AuthService.verifyToken(token);
    const user = await AuthService.getUserById(payload.userId);

    if (!user) {
      throw new WebSocketAuthError('Authenticated user no longer exists.');
    }

    return user;
  } catch (error) {
    if (error instanceof WebSocketAuthError) {
      throw error;
    }
    const message =
      error instanceof Error ? error.message : 'Invalid authentication token';
    throw new WebSocketAuthError(message);
  }
}
