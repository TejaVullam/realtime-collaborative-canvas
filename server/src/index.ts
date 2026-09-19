import app from './app.js';
import { config } from './config/index.js';
import { connectDB, disconnectDB } from './config/database.js';

async function startServer() {
  try {
    await connectDB();
    console.log(`Connected to MongoDB at ${config.mongoUri}`);

    const server = app.listen(config.port, () => {
      console.log(`Server is running on port ${config.port} [${config.nodeEnv}]`);
    });

    const handleShutdown = async (signal: string) => {
      console.log(`Received ${signal}. Shutting down gracefully...`);
      server.close(async () => {
        await disconnectDB();
        console.log('MongoDB connection closed. Server terminated.');
        process.exit(0);
      });
    };

    process.on('SIGINT', () => handleShutdown('SIGINT'));
    process.on('SIGTERM', () => handleShutdown('SIGTERM'));
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

// Only start when run directly
if (process.env.NODE_ENV !== 'test') {
  startServer();
}

export default app;
