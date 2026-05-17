import { Schema, model, Types } from 'mongoose';

export interface FailureRecord {
  upload: Types.ObjectId;
  processingId: string;
  reason: string;
  stack?: string;
  attempt: number;
  failedAt: Date;
}

const failureSchema = new Schema<FailureRecord>(
  {
    upload: { type: Schema.Types.ObjectId, ref: 'Upload', required: true, index: true },
    processingId: { type: String, required: true, index: true },
    reason: { type: String, required: true },
    stack: String,
    attempt: { type: Number, required: true },
    failedAt: { type: Date, default: Date.now },
  },
  { timestamps: true },
);

export const FailureModel = model<FailureRecord>('Failure', failureSchema);
