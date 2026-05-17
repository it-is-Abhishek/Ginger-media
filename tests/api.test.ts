import fs from 'fs';
import path from 'path';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import sharp from 'sharp';
import request from 'supertest';
import { createApp } from '../src/app';
import { UploadModel } from '../src/models/upload.model';

jest.mock('../src/queues/media.queue', () => ({
  enqueueMediaProcessing: jest.fn().mockResolvedValue({ id: 'job-id' }),
  mediaQueue: { close: jest.fn() },
  mediaQueueEvents: { close: jest.fn(), on: jest.fn() },
}));

describe('media API', () => {
  let mongo: MongoMemoryServer;
  const testImagePath = path.join(process.cwd(), 'uploads', 'test-vehicle.png');

  beforeAll(async () => {
    mongo = await MongoMemoryServer.create();
    await mongoose.connect(mongo.getUri());
    fs.mkdirSync(path.dirname(testImagePath), { recursive: true });
    await sharp({
      create: {
        width: 64,
        height: 64,
        channels: 3,
        background: { r: 220, g: 220, b: 220 },
      },
    })
      .png()
      .toFile(testImagePath);
  });

  afterAll(async () => {
    await mongoose.disconnect();
    await mongo.stop();
    if (fs.existsSync(testImagePath)) fs.unlinkSync(testImagePath);
  });

  afterEach(async () => {
    await UploadModel.deleteMany({});
    for (const filename of fs.readdirSync(path.join(process.cwd(), 'uploads'))) {
      if (filename !== '.gitkeep' && filename !== path.basename(testImagePath)) {
        fs.unlinkSync(path.join(process.cwd(), 'uploads', filename));
      }
    }
  });

  it('accepts an image upload, stores metadata, and returns pending status', async () => {
    const app = createApp();

    const response = await request(app).post('/upload').attach('image', testImagePath);

    expect(response.status).toBe(202);
    expect(response.body.processingId).toEqual(expect.any(String));
    expect(response.body.status).toBe('pending');

    const upload = await UploadModel.findOne({ processingId: response.body.processingId }).lean();
    expect(upload?.fileHash).toHaveLength(32);
    expect(upload?.status).toBe('pending');
  });

  it('returns status for a processing id', async () => {
    const upload = await UploadModel.create({
      processingId: 'status-id',
      originalFilename: 'vehicle.png',
      storedFilename: 'status-id.png',
      path: testImagePath,
      mimeType: 'image/png',
      sizeBytes: 100,
      fileHash: '0'.repeat(32),
      status: 'completed',
      uploadTimestamp: new Date(),
    });

    const response = await request(createApp()).get(`/status/${upload.processingId}`);

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      processingId: 'status-id',
      status: 'completed',
    });
  });

  it('rejects unsupported file types', async () => {
    const app = createApp();
    const response = await request(app).post('/upload').attach('image', Buffer.from('hello'), 'note.txt');

    expect(response.status).toBe(400);
    expect(response.body.error).toMatch(/Only JPEG, PNG, and WEBP/);
  });
});
