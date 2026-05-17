import fs from 'fs';
import path from 'path';
import multer from 'multer';
import crypto from 'crypto';
import { env } from '../config/env';
import { BadRequestError } from '../utils/errors';

const allowedMimeTypes = new Set(['image/jpeg', 'image/png', 'image/webp']);

fs.mkdirSync(env.UPLOAD_DIR, { recursive: true });

const storage = multer.diskStorage({
  destination: (_req, _file, callback) => {
    callback(null, env.UPLOAD_DIR);
  },
  filename: (req, file, callback) => {
    const processingId = crypto.randomUUID();
    const extension = path.extname(file.originalname).toLowerCase() || '.jpg';
    (req as RequestWithProcessingId).processingId = processingId;
    callback(null, `${processingId}${extension}`);
  },
});

export interface RequestWithProcessingId extends Express.Request {
  processingId?: string;
}

export const uploadImage = multer({
  storage,
  limits: {
    fileSize: env.MAX_UPLOAD_BYTES,
    files: 1,
  },
  fileFilter: (_req, file, callback) => {
    if (!allowedMimeTypes.has(file.mimetype)) {
      callback(new BadRequestError('Only JPEG, PNG, and WEBP images are supported.'));
      return;
    }
    callback(null, true);
  },
}).single('image');
