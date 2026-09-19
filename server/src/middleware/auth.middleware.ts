import type { Response, NextFunction } from 'express';
import { AuthService } from '../services/auth.service.js';
import type { AuthenticatedRequest } from '../types/auth.js';

export async function authenticate(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
): Promise<void> {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({
      error: 'Authentication required. Missing or malformed authorization header.',
    });
    return;
  }

  const token = authHeader.split(' ')[1];

  try {
    const payload = AuthService.verifyToken(token);
    const user = await AuthService.getUserById(payload.userId);

    if (!user) {
      res.status(401).json({
        error: 'Authenticated user no longer exists.',
      });
      return;
    }

    req.user = user;
    next();
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Invalid authentication token';
    res.status(401).json({ error: message });
  }
}
