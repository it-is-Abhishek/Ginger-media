import { Router } from 'express';
import { uploadImageController } from '../controllers/upload.controller';
import { uploadImage } from '../middlewares/upload.middleware';
import { asyncHandler } from '../utils/asyncHandler';

export const uploadRouter = Router();

/**
 * @openapi
 * /upload:
 *   post:
 *     summary: Upload a vehicle image for asynchronous processing.
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               image:
 *                 type: string
 *                 format: binary
 *     responses:
 *       202:
 *         description: Upload accepted and queued.
 */
uploadRouter.post('/upload', uploadImage, asyncHandler(uploadImageController));
