import { Worker } from 'bullmq';
import { env } from '../config/env';
import { connectDB, disconnectDB } from '../config/database';
import { createRedisConnection } from '../config/redis';
import { logger } from '../config/logger';
import { processMediaJob } from '../services/processing.service';
import { MediaProcessingJob } from '../queues/media.queue';

async function startWorker() {
  await connectDB();

  const worker = new Worker<MediaProcessingJob>(env.QUEUE_NAME, processMediaJob, {
    connection: createRedisConnection(),
    concurrency: env.WORKER_CONCURRENCY,
  });

  worker.on('ready', () => logger.info({ queue: env.QUEUE_NAME }, 'Media worker ready'));
  worker.on('completed', (job) => logger.info({ jobId: job.id }, 'Worker completed job'));
  worker.on('failed', (job, error) => logger.error({ jobId: job?.id, error }, 'Worker failed job'));
  worker.on('error', (error) => logger.error({ error }, 'Worker error'));

  const shutdown = async (signal: string) => {
    logger.info({ signal }, 'Shutting down worker');
    await worker.close();
    await disconnectDB();
    process.exit(0);
  };

  process.on('SIGTERM', () => void shutdown('SIGTERM'));
  process.on('SIGINT', () => void shutdown('SIGINT'));
}

startWorker().catch((error) => {
  logger.fatal({ error }, 'Worker failed to start');
  process.exit(1);
});
