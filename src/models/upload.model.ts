import { Schema, model, HydratedDocument } from 'mongoose';

export type ProcessingStatus = 'pending' | 'processing' | 'completed' | 'failed';

export interface UploadRecord {
  processingId: string;
  originalFilename: string;
  storedFilename: string;
  path: string;
  mimeType: string;
  sizeBytes: number;
  fileHash: string;
  perceptualHash?: string;
  status: ProcessingStatus;
  uploadTimestamp: Date;
  startedAt?: Date;
  completedAt?: Date;
  failedAt?: Date;
  attemptCount: number;
}

export type UploadDocument = HydratedDocument<UploadRecord>;

const uploadSchema = new Schema<UploadRecord>(
  {
    processingId: { type: String, required: true, unique: true, index: true },
    originalFilename: { type: String, required: true },
    storedFilename: { type: String, required: true },
    path: { type: String, required: true },
    mimeType: { type: String, required: true },
    sizeBytes: { type: Number, required: true },
    fileHash: { type: String, required: true, index: true },
    perceptualHash: { type: String, index: true },
    status: {
      type: String,
      enum: ['pending', 'processing', 'completed', 'failed'],
      default: 'pending',
      index: true,
    },
    uploadTimestamp: { type: Date, default: Date.now },
    startedAt: Date,
    completedAt: Date,
    failedAt: Date,
    attemptCount: { type: Number, default: 0 },
  },
  { timestamps: true },
);

export const UploadModel = model<UploadRecord>('Upload', uploadSchema);
