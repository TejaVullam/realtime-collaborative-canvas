import type { Request, Response } from 'express';
import { AuthError, AuthService } from '../services/auth.service.js';
import type { AuthenticatedRequest } from '../types/auth.js';

export class AuthController {
  static async register(req: Request, res: Response): Promise<void> {
    try {
      const { name, email, password } = req.body;
      const result = await AuthService.register({ name, email, password });
      res.status(201).json(result);
    } catch (error) {
      if (error instanceof AuthError) {
        res.status(error.statusCode).json({ error: error.message });
        return;
      }
      res.status(500).json({ error: 'Internal server error during registration' });
    }
  }

  static async login(req: Request, res: Response): Promise<void> {
    try {
      const { email, password } = req.body;
      const result = await AuthService.login({ email, password });
      res.status(200).json(result);
    } catch (error) {
      if (error instanceof AuthError) {
        res.status(error.statusCode).json({ error: error.message });
        return;
      }
      res.status(500).json({ error: 'Internal server error during login' });
    }
  }

  static async me(req: AuthenticatedRequest, res: Response): Promise<void> {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthenticated' });
      return;
    }
    res.status(200).json({ user: req.user });
  }

  static async logout(_req: Request, res: Response): Promise<void> {
    res.status(200).json({ message: 'Logged out successfully' });
  }
}
