export type RoomRole = 'owner' | 'member';

export interface RoomMember {
  userId: string;
  name?: string;
  email?: string;
  role: RoomRole;
  joinedAt: Date | string;
}

export interface RoomResponse {
  id: string;
  name: string;
  ownerId: string;
  canvasId: string;
  members: RoomMember[];
  createdAt: Date | string;
  updatedAt: Date | string;
}

export interface CreateRoomDTO {
  name: string;
}
