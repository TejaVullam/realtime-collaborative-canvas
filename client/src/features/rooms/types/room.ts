export type RoomRole = 'owner' | 'member';

export interface RoomMember {
  userId: string;
  role: RoomRole;
  joinedAt: string;
}

export interface Room {
  id: string;
  name: string;
  ownerId: string;
  canvasId: string;
  members: RoomMember[];
  createdAt: string;
  updatedAt: string;
}

export interface CreateRoomPayload {
  name: string;
}
