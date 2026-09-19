import mongoose from 'mongoose';
import { Room } from '../models/Room.js';
import { Canvas } from '../models/Canvas.js';
import type { RoomResponse } from '../types/room.js';

export class RoomError extends Error {
  statusCode: number;

  constructor(message: string, statusCode = 400) {
    super(message);
    this.name = 'RoomError';
    this.statusCode = statusCode;
  }
}

export class RoomService {
  static async createRoom(name: string, userId: string): Promise<RoomResponse> {
    if (!name || name.trim().length === 0) {
      throw new RoomError('Room name is required', 400);
    }

    if (!mongoose.Types.ObjectId.isValid(userId)) {
      throw new RoomError('Invalid user ID', 400);
    }

    const userObjectId = new mongoose.Types.ObjectId(userId);

    // Create room with owner as initial member
    const room = new Room({
      name: name.trim(),
      ownerId: userObjectId,
      members: [
        {
          userId: userObjectId,
          role: 'owner',
          joinedAt: new Date(),
        },
      ],
    });

    // Create associated canvas
    const canvas = new Canvas({
      roomId: room._id,
      metadata: {
        name: name.trim(),
        ownerId: userObjectId,
        backgroundColor: '#0b0f19',
        createdAt: Date.now(),
        updatedAt: Date.now(),
      },
    });

    await canvas.save();

    // Attach canvasId to room and save
    room.canvasId = canvas._id as mongoose.Types.ObjectId;
    await room.save();

    return room.toRoomResponse();
  }

  static async getUserRooms(userId: string): Promise<RoomResponse[]> {
    if (!mongoose.Types.ObjectId.isValid(userId)) {
      throw new RoomError('Invalid user ID', 400);
    }

    const userObjectId = new mongoose.Types.ObjectId(userId);
    const rooms = await Room.find({ 'members.userId': userObjectId }).sort({
      updatedAt: -1,
    });

    return rooms.map((r) => r.toRoomResponse());
  }

  static async getRoomById(roomId: string, userId: string): Promise<RoomResponse> {
    if (!mongoose.Types.ObjectId.isValid(roomId)) {
      throw new RoomError('Invalid room ID format', 400);
    }

    const room = await Room.findById(roomId);
    if (!room) {
      throw new RoomError('Room not found', 404);
    }

    const isMember = room.members.some(
      (m) => m.userId.toString() === userId,
    );

    if (!isMember) {
      throw new RoomError('You do not have access to this room', 403);
    }

    return room.toRoomResponse();
  }

  static async joinRoom(roomId: string, userId: string): Promise<RoomResponse> {
    if (!mongoose.Types.ObjectId.isValid(roomId)) {
      throw new RoomError('Invalid room ID format', 400);
    }

    const room = await Room.findById(roomId);
    if (!room) {
      throw new RoomError('Room not found', 404);
    }

    const isMember = room.members.some(
      (m) => m.userId.toString() === userId,
    );

    if (!isMember) {
      const userObjectId = new mongoose.Types.ObjectId(userId);
      room.members.push({
        userId: userObjectId,
        role: 'member',
        joinedAt: new Date(),
      });
      await room.save();
    }

    return room.toRoomResponse();
  }

  static async leaveRoom(roomId: string, userId: string): Promise<{ message: string }> {
    if (!mongoose.Types.ObjectId.isValid(roomId)) {
      throw new RoomError('Invalid room ID format', 400);
    }

    const room = await Room.findById(roomId);
    if (!room) {
      throw new RoomError('Room not found', 404);
    }

    if (room.ownerId.toString() === userId) {
      throw new RoomError(
        'Room owners cannot leave their own room. Deletion or ownership transfer is required.',
        400,
      );
    }

    const memberIndex = room.members.findIndex(
      (m) => m.userId.toString() === userId,
    );

    if (memberIndex === -1) {
      throw new RoomError('You are not a member of this room', 400);
    }

    room.members.splice(memberIndex, 1);
    await room.save();

    return { message: 'Successfully left the room' };
  }
}
