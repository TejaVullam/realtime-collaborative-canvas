import type { Room } from '../types/room.js';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

export class RoomApiError extends Error {
  statusCode: number;

  constructor(message: string, statusCode: number) {
    super(message);
    this.name = 'RoomApiError';
    this.statusCode = statusCode;
  }
}

async function handleResponse<T>(res: Response): Promise<T> {
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new RoomApiError(data.error || 'An unexpected error occurred', res.status);
  }
  return data as T;
}

export const roomApi = {
  async createRoom(name: string, token: string): Promise<Room> {
    const res = await fetch(`${API_BASE_URL}/rooms`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ name }),
    });
    return handleResponse<Room>(res);
  },

  async getRooms(token: string): Promise<Room[]> {
    const res = await fetch(`${API_BASE_URL}/rooms`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
    });
    const data = await handleResponse<{ rooms: Room[] }>(res);
    return data.rooms;
  },

  async getRoom(roomId: string, token: string): Promise<Room> {
    const res = await fetch(`${API_BASE_URL}/rooms/${roomId}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
    });
    return handleResponse<Room>(res);
  },

  async joinRoom(roomId: string, token: string): Promise<Room> {
    const res = await fetch(`${API_BASE_URL}/rooms/${roomId}/join`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
    });
    return handleResponse<Room>(res);
  },

  async leaveRoom(roomId: string, token: string): Promise<{ message: string }> {
    const res = await fetch(`${API_BASE_URL}/rooms/${roomId}/leave`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
    });
    return handleResponse<{ message: string }>(res);
  },
};
