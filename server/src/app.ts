import express from 'express';
import cors from 'cors';
import { config } from './config/index.js';
import apiRoutes from './routes/index.js';

export function createApp() {
  const app = express();

  app.use(
    cors({
      origin: config.clientUrl,
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
