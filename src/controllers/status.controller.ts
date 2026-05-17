import { Request, Response } from 'express';
import { FailureModel } from '../models/failure.model';
import { ResultModel } from '../models/result.model';
import { UploadModel } from '../models/upload.model';
import { NotFoundError } from '../utils/errors';

export async function getStatus(req: Request, res: Response): Promise<void> {
  const upload = await UploadModel.findOne({ processingId: req.params.id }).lean();
  if (!upload) throw new NotFoundError('Processing ID not found');

  res.status(200).json({
    processingId: upload.processingId,
    status: upload.status,
    filename: upload.originalFilename,
    uploadTimestamp: upload.uploadTimestamp,
    startedAt: upload.startedAt,
    completedAt: upload.completedAt,
    failedAt: upload.failedAt,
    attempts: upload.attemptCount,
  });
}

export async function getResults(req: Request, res: Response): Promise<void> {
  const upload = await UploadModel.findOne({ processingId: req.params.id }).lean();
  if (!upload) throw new NotFoundError('Processing ID not found');

  const result = await ResultModel.findOne({ processingId: req.params.id }).lean();
  if (!result) {
    res.status(202).json({
      processingId: upload.processingId,
      status: upload.status,
      message: upload.status === 'failed' ? 'Processing failed. See /failures/:id.' : 'Result is not ready yet.',
    });
    return;
  }

  res.status(200).json(result);
}

export async function getFailures(req: Request, res: Response): Promise<void> {
  const upload = await UploadModel.findOne({ processingId: req.params.id }).lean();
  if (!upload) throw new NotFoundError('Processing ID not found');

  const failures = await FailureModel.find({ processingId: req.params.id })
    .sort({ failedAt: -1 })
    .select('-stack')
    .lean();

  res.status(200).json({
    processingId: upload.processingId,
    status: upload.status,
    failures,
  });
}
