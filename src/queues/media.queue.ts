import { JobsOptions, Queue, QueueEvents } from 'bullmq';
import { env } from '../config/env';
import { createRedisConnection } from '../config/redis';
import { logger } from '../config/logger';

export interface MediaProcessingJob {
  processingId: string;
}

export const mediaQueue = new Queue<MediaProcessingJob>(env.QUEUE_NAME, {
  connection: createRedisConnection(),
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 5000,
    },
    removeOnComplete: { age: 86400, count: 1000 },
    removeOnFail: { age: 604800, count: 5000 },
  },
});

export const mediaQueueEvents = new QueueEvents(env.QUEUE_NAME, {
  connection: createRedisConnection(),
});

mediaQueueEvents.on('failed', ({ jobId, failedReason }) => {
  logger.error({ jobId, failedReason }, 'Media job failed');
});

mediaQueueEvents.on('completed', ({ jobId }) => {
  logger.info({ jobId }, 'Media job completed');
});

export async function enqueueMediaProcessing(
  data: MediaProcessingJob,
  options?: JobsOptions,
) {
  return mediaQueue.add('analyze-vehicle-image', data, {
    jobId: data.processingId,
    ...options,
  });
}
