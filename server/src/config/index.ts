import dotenv from 'dotenv';

dotenv.config();

export interface ServerConfig {
  port: number;
  nodeEnv: string;
  mongoUri: string;
  jwtSecret: string;
  jwtExpiresIn: string;
  clientUrl: string;
}

export const config: ServerConfig = {
  port: process.env.PORT ? parseInt(process.env.PORT, 10) : 5000,
  nodeEnv: process.env.NODE_ENV || 'development',
  mongoUri: process.env.MONGODB_URI || 'mongodb://localhost:27017/collaborative_canvas',
  jwtSecret: process.env.JWT_SECRET || 'dev_secret_key_at_least_32_characters_long_for_jwt',
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '7d',
  clientUrl: process.env.CLIENT_URL || 'http://localhost:5173',
};
