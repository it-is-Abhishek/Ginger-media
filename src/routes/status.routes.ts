import { Router } from 'express';
import { getFailures, getResults, getStatus } from '../controllers/status.controller';
import { asyncHandler } from '../utils/asyncHandler';

export const statusRouter = Router();

/**
 * @openapi
 * /status/{id}:
 *   get:
 *     summary: Get processing status.
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Current status.
 */
statusRouter.get('/status/:id', asyncHandler(getStatus));

/**
 * @openapi
 * /results/{id}:
 *   get:
 *     summary: Get structured image analysis result.
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Analysis report.
 *       202:
 *         description: Result not ready.
 */
statusRouter.get('/results/:id', asyncHandler(getResults));

/**
 * @openapi
 * /failures/{id}:
 *   get:
 *     summary: Get processing failures for a processing ID.
 */
statusRouter.get('/failures/:id', asyncHandler(getFailures));
