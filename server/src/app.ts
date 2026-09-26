import express from 'express';
import cors from 'cors';
import { config } from './config/index.js';
import apiRoutes from './routes/index.js';

export function createApp() {
  const app = express();

  const allowedOrigins = [
    config.clientUrl,
    'http://localhost:3000',
    'http://localhost:5173',
  ];

  app.use(
    cors({
      origin: (origin, callback) => {
        if (!origin || allowedOrigins.includes(origin)) {
          callback(null, true);
        } else {
          callback(new Error('Not allowed by CORS'));
        }
      },
      credentials: true,
    }),
  );
  app.use(express.json());

  // API routes root
  app.use('/api', apiRoutes);

  return app;
}

export const app = createApp();
export default app;
