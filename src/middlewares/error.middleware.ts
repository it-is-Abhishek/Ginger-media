import { ErrorRequestHandler } from 'express';
import multer from 'multer';
import { logger } from '../config/logger';
import { AppError } from '../utils/errors';

export const errorMiddleware: ErrorRequestHandler = (error, _req, res, _next) => {
  if (error instanceof multer.MulterError) {
    const message = error.code === 'LIMIT_FILE_SIZE' ? 'Uploaded file exceeds size limit.' : error.message;
    res.status(400).json({ error: message });
    return;
  }

  if (error instanceof AppError) {
    res.status(error.statusCode).json({ error: error.message });
    return;
  }

  logger.error({ error }, 'Unhandled request error');
  res.status(500).json({ error: 'Internal server error' });
};
