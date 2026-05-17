import { Job } from 'bullmq';
import { FailureModel } from '../models/failure.model';
import { ResultModel } from '../models/result.model';
import { UploadModel } from '../models/upload.model';
import { MediaProcessingJob } from '../queues/media.queue';
import { analyzeVehicleImage } from './imageAnalysis.service';
import { NotFoundError } from '../utils/errors';
import { logger } from '../config/logger';

export async function processMediaJob(job: Job<MediaProcessingJob>): Promise<void> {
  const { processingId } = job.data;
  const upload = await UploadModel.findOneAndUpdate(
    { processingId },
    {
      $set: { status: 'processing', startedAt: new Date() },
      $inc: { attemptCount: 1 },
    },
    { new: true },
  );

  if (!upload) {
    throw new NotFoundError(`Upload ${processingId} not found`);
  }

  try {
    const result = await analyzeVehicleImage(upload);
    await ResultModel.findOneAndUpdate(
      { processingId },
      {
        $set: {
          upload: upload._id,
          ...result,
        },
      },
      { upsert: true, new: true, setDefaultsOnInsert: true },
    );

    await UploadModel.updateOne(
      { processingId },
      { $set: { status: 'completed', completedAt: new Date() }, $unset: { failedAt: '' } },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown processing error';
    await FailureModel.create({
      upload: upload._id,
      processingId,
      reason: message,
      stack: error instanceof Error ? error.stack : undefined,
      attempt: job.attemptsMade + 1,
      failedAt: new Date(),
    });

    const shouldMarkFailed = job.attemptsMade + 1 >= (job.opts.attempts || 1);
    if (shouldMarkFailed) {
      await UploadModel.updateOne(
        { processingId },
        { $set: { status: 'failed', failedAt: new Date() } },
      );
    }

    logger.error({ error, processingId, attempt: job.attemptsMade + 1 }, 'Media processing attempt failed');
    throw error;
  }
}
