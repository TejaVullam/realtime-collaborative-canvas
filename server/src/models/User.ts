import mongoose, { Schema, type Document, type Model } from 'mongoose';
import type { SafeUser } from '../types/auth.js';

export interface IUser extends Document {
  name: string;
  email: string;
  passwordHash: string;
  createdAt: Date;
  updatedAt: Date;
  toSafeUser(): SafeUser;
}

const userSchema = new Schema<IUser>(
  {
    name: {
      type: String,
      required: [true, 'Name is required'],
      trim: true,
      minlength: [1, 'Name cannot be empty'],
      maxlength: [100, 'Name cannot exceed 100 characters'],
    },
    email: {
      type: String,
      required: [true, 'Email is required'],
      unique: true,
      lowercase: true,
      trim: true,
      match: [/^[^\s@]+@[^\s@]+\.[^\s@]+$/, 'Invalid email address format'],
    },
    passwordHash: {
      type: String,
      required: [true, 'Password hash is required'],
      select: false,
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
        delete ret.passwordHash;
        return ret;
      },
    },
  },
);

userSchema.methods.toSafeUser = function (): SafeUser {
  return {
    id: this._id.toString(),
    name: this.name,
    email: this.email,
    createdAt: this.createdAt,
    updatedAt: this.updatedAt,
  };
};

export const User: Model<IUser> =
  mongoose.models.User || mongoose.model<IUser>('User', userSchema);
