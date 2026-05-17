import path from 'path';
import { Request, Response } from 'express';
import { UploadModel } from '../models/upload.model';
import { enqueueMediaProcessing } from '../queues/media.queue';
import { md5File } from '../utils/hash';
import { BadRequestError } from '../utils/errors';
import { RequestWithProcessingId } from '../middlewares/upload.middleware';

export async function uploadImageController(req: Request, res: Response): Promise<void> {
  const file = req.file;
  const processingId = (req as RequestWithProcessingId).processingId;

  if (!file || !processingId) {
    throw new BadRequestError('Image file is required in multipart field "image".');
  }

  const fileHash = await md5File(file.path);
  const upload = await UploadModel.create({
    processingId,
    originalFilename: file.originalname,
    storedFilename: path.basename(file.path),
    path: file.path,
    mimeType: file.mimetype,
    sizeBytes: file.size,
    fileHash,
    status: 'pending',
    uploadTimestamp: new Date(),
  });

  await enqueueMediaProcessing({ processingId: upload.processingId });

  res.status(202).json({
    processingId: upload.processingId,
    status: upload.status,
  });
}
