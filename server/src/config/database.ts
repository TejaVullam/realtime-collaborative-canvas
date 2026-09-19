import mongoose from 'mongoose';
import { config } from './index.js';

export async function connectDB(uri?: string): Promise<typeof mongoose> {
  const connectionUri = uri || config.mongoUri;
  try {
    const conn = await mongoose.connect(connectionUri);
    return conn;
  } catch (error) {
    console.error('Failed to connect to MongoDB:', error);
    throw error;
  }
}

export async function disconnectDB(): Promise<void> {
  try {
    await mongoose.disconnect();
  } catch (error) {
    console.error('Failed to disconnect from MongoDB:', error);
    throw error;
  }
}
