import { connectDB, disconnectDB } from '../src/config/database';
import { FailureModel } from '../src/models/failure.model';
import { ResultModel } from '../src/models/result.model';
import { UploadModel } from '../src/models/upload.model';
import { logger } from '../src/config/logger';

async function seed() {
  await connectDB();
  await Promise.all([UploadModel.deleteMany({}), ResultModel.deleteMany({}), FailureModel.deleteMany({})]);
  logger.info('Database cleared. Upload a real image through POST /upload to create processing data.');
  await disconnectDB();
}

seed().catch(async (error) => {
  logger.error({ error }, 'Seed failed');
  await disconnectDB();
  process.exit(1);
});