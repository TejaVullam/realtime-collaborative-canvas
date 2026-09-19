import mongoose, { Schema, type Document, type Model } from 'mongoose';
import type { RoomResponse, RoomRole } from '../types/room.js';

export interface IRoomMember {
  userId: mongoose.Types.ObjectId;
  role: RoomRole;
  joinedAt: Date;
}

export interface IRoom extends Document {
  name: string;
  ownerId: mongoose.Types.ObjectId;
  canvasId: mongoose.Types.ObjectId;
  members: IRoomMember[];
  createdAt: Date;
  updatedAt: Date;
  toRoomResponse(): RoomResponse;
}

const roomMemberSchema = new Schema<IRoomMember>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    role: {
      type: String,
      enum: ['owner', 'member'],
      required: true,
      default: 'member',
    },
    joinedAt: {
      type: Date,
      default: Date.now,
    },
  },
  { _id: false },
);

const roomSchema = new Schema<IRoom>(
  {
    name: {
      type: String,
      required: [true, 'Room name is required'],
      trim: true,
      minlength: [1, 'Room name cannot be empty'],
      maxlength: [100, 'Room name cannot exceed 100 characters'],
    },
    ownerId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    canvasId: {
      type: Schema.Types.ObjectId,
      ref: 'Canvas',
      required: false,
      index: true,
    },
    members: {
      type: [roomMemberSchema],
      default: [],
    },
  },
  {
    timestamps: true,
    toJSON: {
      transform(_doc, ret: Record<string, unknown>) {
        if (ret._id) {
          ret.id = (ret._id as mongoose.Types.ObjectId).toString();
        }
        delete ret._id;
        delete ret.__v;
        return ret;
      },
    },
  },
);

// Indexes specified in Section 25
roomSchema.index({ 'members.userId': 1 });

roomSchema.methods.toRoomResponse = function (): RoomResponse {
  return {
    id: this._id.toString(),
    name: this.name,
    ownerId: this.ownerId.toString(),
    canvasId: this.canvasId ? this.canvasId.toString() : '',
    members: this.members.map((m: IRoomMember) => ({
      userId: m.userId.toString(),
      role: m.role,
      joinedAt: m.joinedAt,
    })),
    createdAt: this.createdAt,
    updatedAt: this.updatedAt,
  };
};

export const Room: Model<IRoom> =
  mongoose.models.Room || mongoose.model<IRoom>('Room', roomSchema);
