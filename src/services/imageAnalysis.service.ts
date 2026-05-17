import sharp from 'sharp';
import { recognize } from 'tesseract.js';
import { UploadModel, UploadDocument } from '../models/upload.model';
import { ProcessingResultRecord } from '../models/result.model';
import { extractPlateCandidates, isValidIndianVehicleNumber } from '../utils/plate';
import { hammingDistance } from '../utils/hash';
import { logger } from '../config/logger';

const ANALYZER_VERSION = '1.0.0';

interface GrayImage {
  data: Buffer;
  width: number;
  height: number;
}

function confidenceFromRange(value: number, low: number, high: number): number {
  if (value <= low) return 0.95;
  if (value >= high) return 0.95;
  const midpoint = (low + high) / 2;
  return Math.max(0.45, Math.min(0.9, Math.abs(value - midpoint) / (high - low) + 0.45));
}

async function loadGrayImage(filePath: string, width = 512): Promise<GrayImage> {
  const { data, info } = await sharp(filePath)
    .resize({ width, withoutEnlargement: true })
    .grayscale()
    .raw()
    .toBuffer({ resolveWithObject: true });

  return { data, width: info.width, height: info.height };
}

function averageIntensity(gray: GrayImage): number {
  let sum = 0;
  for (const pixel of gray.data) {
    sum += pixel;
  }
  return sum / gray.data.length;
}

function variance(values: number[]): number {
  if (values.length === 0) return 0;
  const mean = values.reduce((sum, value) => sum + value, 0) / values.length;
  return values.reduce((sum, value) => sum + (value - mean) ** 2, 0) / values.length;
}

function varianceOfLaplacian(gray: GrayImage): number {
  const values: number[] = [];
  const { data, width, height } = gray;

  for (let y = 1; y < height - 1; y += 1) {
    for (let x = 1; x < width - 1; x += 1) {
      const index = y * width + x;
      const laplacian =
        -4 * data[index] +
        data[index - 1] +
        data[index + 1] +
        data[index - width] +
        data[index + width];
      values.push(laplacian);
    }
  }

  return variance(values);
}

async function averageHash(filePath: string): Promise<string> {
  const { data } = await sharp(filePath).resize(8, 8, { fit: 'fill' }).grayscale().raw().toBuffer({ resolveWithObject: true });
  const avg = averageIntensity({ data, width: 8, height: 8 });
  let bits = '';

  for (const pixel of data) {
    bits += pixel >= avg ? '1' : '0';
  }

  let hex = '';
  for (let i = 0; i < bits.length; i += 4) {
    hex += Number.parseInt(bits.slice(i, i + 4), 2).toString(16);
  }
  return hex;
}

function borderContrastScore(gray: GrayImage): number {
  const borderPixels: number[] = [];
  const centerPixels: number[] = [];
  const border = Math.max(4, Math.floor(Math.min(gray.width, gray.height) * 0.04));

  for (let y = 0; y < gray.height; y += 1) {
    for (let x = 0; x < gray.width; x += 1) {
      const pixel = gray.data[y * gray.width + x];
      if (x < border || y < border || x >= gray.width - border || y >= gray.height - border) {
        borderPixels.push(pixel);
      } else if (
        x > gray.width * 0.25 &&
        x < gray.width * 0.75 &&
        y > gray.height * 0.25 &&
        y < gray.height * 0.75
      ) {
        centerPixels.push(pixel);
      }
    }
  }

  const borderAvg = borderPixels.reduce((sum, value) => sum + value, 0) / borderPixels.length;
  const centerAvg = centerPixels.reduce((sum, value) => sum + value, 0) / centerPixels.length;
  return Math.abs(borderAvg - centerAvg);
}

function localNoiseInconsistency(gray: GrayImage): number {
  const blockSize = Math.max(16, Math.floor(Math.min(gray.width, gray.height) / 8));
  const blockVariances: number[] = [];

  for (let y = 0; y < gray.height; y += blockSize) {
    for (let x = 0; x < gray.width; x += blockSize) {
      const pixels: number[] = [];
      for (let yy = y; yy < Math.min(y + blockSize, gray.height); yy += 1) {
        for (let xx = x; xx < Math.min(x + blockSize, gray.width); xx += 1) {
          pixels.push(gray.data[yy * gray.width + xx]);
        }
      }
      blockVariances.push(variance(pixels));
    }
  }

  const min = Math.min(...blockVariances);
  const max = Math.max(...blockVariances);
  return max / Math.max(min, 1);
}

async function runOcr(filePath: string): Promise<{ text: string; candidates: string[]; validPlate?: string; notes: string[] }> {
  try {
    const result = await recognize(filePath, 'eng');
    const text = result.data.text || '';
    const candidates = extractPlateCandidates(text);
    const validPlate = candidates.find(isValidIndianVehicleNumber);
    return { text, candidates, validPlate, notes: [] };
  } catch (error) {
    logger.warn({ error }, 'OCR failed; continuing analysis without plate text');
    return { text: '', candidates: [], notes: ['OCR failed or Tesseract could not read the image.'] };
  }
}

async function detectDuplicate(upload: UploadDocument, perceptualHash: string) {
  const exactDuplicate = await UploadModel.findOne({
    _id: { $ne: upload._id },
    fileHash: upload.fileHash,
  }).lean();

  const candidates = await UploadModel.find({
    _id: { $ne: upload._id },
    perceptualHash: { $exists: true },
  })
    .select('processingId perceptualHash')
    .lean();

  let perceptualDuplicate: { processingId: string; distance: number } | undefined;
  for (const candidate of candidates) {
    if (!candidate.perceptualHash) continue;
    const distance = hammingDistance(perceptualHash, candidate.perceptualHash);
    if (distance <= 8 && (!perceptualDuplicate || distance < perceptualDuplicate.distance)) {
      perceptualDuplicate = { processingId: candidate.processingId, distance };
    }
  }

  return { exactDuplicate, perceptualDuplicate };
}

export async function analyzeVehicleImage(upload: UploadDocument): Promise<Omit<ProcessingResultRecord, 'upload'>> {
  const started = Date.now();
  const metadata = await sharp(upload.path).metadata();
  const gray = await loadGrayImage(upload.path);
  const blurVariance = varianceOfLaplacian(gray);
  const avgBrightness = averageIntensity(gray);
  const perceptualHash = await averageHash(upload.path);
  const duplicate = await detectDuplicate(upload, perceptualHash);
  const ocr = await runOcr(upload.path);
  const borderContrast = borderContrastScore(gray);
  const noiseRatio = localNoiseInconsistency(gray);
  const aspectRatio = metadata.width && metadata.height ? metadata.width / metadata.height : 0;
  const lowResolution = (metadata.width || 0) < 800 || (metadata.height || 0) < 600;

  const blurPassed = blurVariance >= 90;
  const brightnessPassed = avgBrightness >= 60 && avgBrightness <= 210;
  const duplicatePassed = !duplicate.exactDuplicate && !duplicate.perceptualDuplicate;
  const plateValid = Boolean(ocr.validPlate);
  const screenshotSuspicious = lowResolution || borderContrast > 55 || aspectRatio > 2.2 || aspectRatio < 0.45 || !metadata.exif;
  const tamperingSuspicious = noiseRatio > 8 || blurVariance > 2500 || !metadata.exif;

  const flags = [
    !blurPassed ? 'blurry_image' : undefined,
    !brightnessPassed ? 'poor_lighting' : undefined,
    !duplicatePassed ? 'possible_duplicate' : undefined,
    !plateValid ? 'plate_not_validated' : undefined,
    screenshotSuspicious ? 'possible_screenshot_or_photo_of_photo' : undefined,
    tamperingSuspicious ? 'possible_tampering_or_editing' : undefined,
  ].filter((flag): flag is string => Boolean(flag));

  const qualityScore =
    Number(blurPassed) * 0.35 +
    Number(brightnessPassed) * 0.25 +
    Number(!lowResolution) * 0.2 +
    Number(plateValid) * 0.2;

  const fraudRiskScore = Math.min(
    1,
    Number(!duplicatePassed) * 0.35 +
      Number(screenshotSuspicious) * 0.25 +
      Number(tamperingSuspicious) * 0.25 +
      Number(!plateValid) * 0.15,
  );

  await UploadModel.updateOne({ _id: upload._id }, { $set: { perceptualHash } });

  return {
    processingId: upload.processingId,
    imageMetadata: {
      width: metadata.width,
      height: metadata.height,
      format: metadata.format,
      hasExif: Boolean(metadata.exif),
      density: metadata.density,
      sizeBytes: upload.sizeBytes,
    },
    checks: {
      blur: {
        value: Number(blurVariance.toFixed(2)),
        passed: blurPassed,
        confidence: confidenceFromRange(blurVariance, 70, 120),
        notes: [`Variance of Laplacian threshold: >= 90.`],
      },
      brightness: {
        value: Number(avgBrightness.toFixed(2)),
        passed: brightnessPassed,
        confidence: 0.9,
        notes: ['Average grayscale intensity should be between 60 and 210.'],
      },
      duplicate: {
        value: !duplicatePassed,
        passed: duplicatePassed,
        confidence: duplicate.exactDuplicate ? 1 : duplicate.perceptualDuplicate ? 0.78 : 0.7,
        exactDuplicateOf: duplicate.exactDuplicate?.processingId,
        perceptualDuplicateOf: duplicate.perceptualDuplicate?.processingId,
        perceptualDistance: duplicate.perceptualDuplicate?.distance,
        notes: ['Exact MD5 match plus average-hash perceptual comparison.'],
      },
      ocr: {
        value: ocr.validPlate,
        passed: plateValid,
        confidence: plateValid ? 0.82 : 0.45,
        extractedText: ocr.text.trim(),
        candidates: ocr.candidates,
        validPlate: ocr.validPlate,
        notes: ocr.notes,
      },
      indianPlateValidation: {
        value: ocr.validPlate,
        passed: plateValid,
        confidence: plateValid ? 0.95 : 0.55,
        notes: ['Validated against common Indian vehicle number formats including BH series.'],
      },
      screenshotHeuristic: {
        value: Number(borderContrast.toFixed(2)),
        passed: !screenshotSuspicious,
        confidence: 0.62,
        notes: [
          `Resolution ${metadata.width || 0}x${metadata.height || 0}.`,
          `Border contrast score ${borderContrast.toFixed(2)}.`,
          metadata.exif ? 'EXIF metadata present.' : 'EXIF metadata missing.',
        ],
      },
      tamperingSuspicion: {
        value: Number(noiseRatio.toFixed(2)),
        passed: !tamperingSuspicious,
        confidence: 0.58,
        notes: [
          `Local noise inconsistency ratio ${noiseRatio.toFixed(2)}.`,
          `Sharpness proxy ${blurVariance.toFixed(2)}.`,
          metadata.exif ? 'EXIF metadata present.' : 'EXIF metadata missing.',
        ],
      },
    },
    summary: {
      qualityScore: Number(Math.max(0, Math.min(1, qualityScore)).toFixed(2)),
      fraudRiskScore: Number(fraudRiskScore.toFixed(2)),
      flags,
    },
    analyzerVersion: ANALYZER_VERSION,
    processedAt: new Date(),
    durationMs: Date.now() - started,
  };
}
