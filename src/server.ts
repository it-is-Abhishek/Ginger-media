import http from 'http';
import { createApp } from './app';
import { env } from './config/env';
import { connectDB, disconnectDB } from './config/database';
import { logger } from './config/logger';
import { mediaQueue, mediaQueueEvents } from './queues/media.queue';

async function startServer() {
  await connectDB();

  const app = createApp();
  const server = http.createServer(app);

  server.listen(env.PORT, () => {
    logger.info({ port: env.PORT }, 'API server listening');
  });

  const shutdown = async (signal: string) => {
    logger.info({ signal }, 'Shutting down API server');
    server.close(async () => {
      await mediaQueue.close();
      await mediaQueueEvents.close();
      await disconnectDB();
      process.exit(0);
    });
  };

  process.on('SIGTERM', () => void shutdown('SIGTERM'));
  process.on('SIGINT', () => void shutdown('SIGINT'));
}

startServer().catch((error) => {
  logger.fatal({ error }, 'API server failed to start');
  process.exit(1);
});
