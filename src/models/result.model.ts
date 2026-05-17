import { Schema, model, Types } from 'mongoose';

export interface CheckScore {
  value?: number | string | boolean;
  passed: boolean;
  confidence: number;
  notes?: string[];
}

export interface DuplicateCheck extends CheckScore {
  exactDuplicateOf?: string;
  perceptualDuplicateOf?: string;
  perceptualDistance?: number;
}

export interface OcrCheck extends CheckScore {
  extractedText: string;
  candidates: string[];
  validPlate?: string;
}

export interface ProcessingResultRecord {
  upload: Types.ObjectId;
  processingId: string;
  imageMetadata: {
    width?: number;
    height?: number;
    format?: string;
    hasExif: boolean;
    density?: number;
    sizeBytes: number;
  };
  checks: {
    blur: CheckScore;
    brightness: CheckScore;
    duplicate: DuplicateCheck;
    ocr: OcrCheck;
    indianPlateValidation: CheckScore;
    screenshotHeuristic: CheckScore;
    tamperingSuspicion: CheckScore;
  };
  summary: {
    qualityScore: number;
    fraudRiskScore: number;
    flags: string[];
  };
  analyzerVersion: string;
  processedAt: Date;
  durationMs: number;
}

const checkScoreSchema = new Schema<CheckScore>(
  {
    value: Schema.Types.Mixed,
    passed: { type: Boolean, required: true },
    confidence: { type: Number, required: true, min: 0, max: 1 },
    notes: [String],
  },
  { _id: false },
);

const resultSchema = new Schema<ProcessingResultRecord>(
  {
    upload: { type: Schema.Types.ObjectId, ref: 'Upload', required: true, index: true },
    processingId: { type: String, required: true, unique: true, index: true },
    imageMetadata: {
      width: Number,
      height: Number,
      format: String,
      hasExif: { type: Boolean, required: true },
      density: Number,
      sizeBytes: { type: Number, required: true },
    },
    checks: {
      blur: checkScoreSchema,
      brightness: checkScoreSchema,
      duplicate: {
        ...checkScoreSchema.obj,
        exactDuplicateOf: String,
        perceptualDuplicateOf: String,
        perceptualDistance: Number,
      },
      ocr: {
        ...checkScoreSchema.obj,
        extractedText: { type: String, required: true },
        candidates: [String],
        validPlate: String,
      },
      indianPlateValidation: checkScoreSchema,
      screenshotHeuristic: checkScoreSchema,
      tamperingSuspicion: checkScoreSchema,
    },
    summary: {
      qualityScore: { type: Number, required: true, min: 0, max: 1 },
      fraudRiskScore: { type: Number, required: true, min: 0, max: 1 },
      flags: [String],
    },
    analyzerVersion: { type: String, required: true },
    processedAt: { type: Date, default: Date.now },
    durationMs: { type: Number, required: true },
  },
  { timestamps: true },
);

export const ResultModel = model<ProcessingResultRecord>('ProcessingResult', resultSchema);
