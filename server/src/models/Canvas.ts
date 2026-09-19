import mongoose, { Schema, type Document, type Model } from 'mongoose';

export interface ICanvas extends Document {
  roomId: mongoose.Types.ObjectId;
  metadata: {
    name: string;
    backgroundColor?: string;
    ownerId: mongoose.Types.ObjectId;
    createdAt: number;
    updatedAt: number;
  };
  createdAt: Date;
  updatedAt: Date;
}

const canvasSchema = new Schema<ICanvas>(
  {
    roomId: {
      type: Schema.Types.ObjectId,
      ref: 'Room',
      required: true,
      index: true,
    },
    metadata: {
      name: {
        type: String,
        required: true,
        default: 'Untitled Canvas',
      },
      backgroundColor: {
        type: String,
        default: '#0b0f19',
      },
      ownerId: {
        type: Schema.Types.ObjectId,
        ref: 'User',
        required: true,
      },
      createdAt: {
        type: Number,
        default: () => Date.now(),
      },
      updatedAt: {
        type: Number,
        default: () => Date.now(),
      },
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

export const Canvas: Model<ICanvas> =
  mongoose.models.Canvas || mongoose.model<ICanvas>('Canvas', canvasSchema);
