import type { Response } from 'express';
import { RoomError, RoomService } from '../services/room.service.js';
import type { AuthenticatedRequest } from '../types/auth.js';

export class RoomController {
  static async create(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ error: 'Authentication required' });
        return;
      }

      const { name } = req.body;
      const room = await RoomService.createRoom(name, req.user.id);
      res.status(201).json(room);
    } catch (error) {
      if (error instanceof RoomError) {
        res.status(error.statusCode).json({ error: error.message });
        return;
      }
      res.status(500).json({ error: 'Internal server error creating room' });
    }
  }

  static async list(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ error: 'Authentication required' });
        return;
      }

      const rooms = await RoomService.getUserRooms(req.user.id);
      res.status(200).json({ rooms });
    } catch (error) {
      if (error instanceof RoomError) {
        res.status(error.statusCode).json({ error: error.message });
        return;
      }
      res.status(500).json({ error: 'Internal server error listing rooms' });
    }
  }

  static async getById(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ error: 'Authentication required' });
        return;
      }

      const roomId = Array.isArray(req.params.roomId)
        ? req.params.roomId[0]
        : req.params.roomId;
      const room = await RoomService.getRoomById(roomId, req.user.id);
      res.status(200).json(room);
    } catch (error) {
      if (error instanceof RoomError) {
        res.status(error.statusCode).json({ error: error.message });
        return;
      }
      res.status(500).json({ error: 'Internal server error retrieving room' });
    }
  }

  static async join(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ error: 'Authentication required' });
        return;
      }

      const roomId = Array.isArray(req.params.roomId)
        ? req.params.roomId[0]
        : req.params.roomId;
      const room = await RoomService.joinRoom(roomId, req.user.id);
      res.status(200).json(room);
    } catch (error) {
      if (error instanceof RoomError) {
        res.status(error.statusCode).json({ error: error.message });
        return;
      }
      res.status(500).json({ error: 'Internal server error joining room' });
    }
  }

  static async leave(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ error: 'Authentication required' });
        return;
      }

      const roomId = Array.isArray(req.params.roomId)
        ? req.params.roomId[0]
        : req.params.roomId;
      const result = await RoomService.leaveRoom(roomId, req.user.id);
      res.status(200).json(result);
    } catch (error) {
      if (error instanceof RoomError) {
        res.status(error.statusCode).json({ error: error.message });
        return;
      }
      res.status(500).json({ error: 'Internal server error leaving room' });
    }
  }
}
