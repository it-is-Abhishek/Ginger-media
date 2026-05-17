import { Request, Response } from 'express';
import { mongoose } from '../config/database';
import { createRedisConnection } from '../config/redis';

export async function healthController(_req: Request, res: Response): Promise<void> {
  const redis = createRedisConnection();
  let redisStatus = 'disconnected';

  try {
    await redis.ping();
    redisStatus = 'connected';
  } catch {
    redisStatus = 'disconnected';
  } finally {
    redis.disconnect();
  }

  const databaseStatus = mongoose.connection.readyState === 1 ? 'connected' : 'disconnected';

  res.status(databaseStatus === 'connected' && redisStatus === 'connected' ? 200 : 503).json({
    status: databaseStatus === 'connected' && redisStatus === 'connected' ? 'ok' : 'degraded',
    database: databaseStatus,
    redis: redisStatus,
    uptimeSeconds: Math.round(process.uptime()),
  });
}
