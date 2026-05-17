import crypto from 'crypto';
import fs from 'fs';

export function md5Buffer(buffer: Buffer): string {
  return crypto.createHash('md5').update(buffer).digest('hex');
}

export function md5File(filePath: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const hash = crypto.createHash('md5');
    const stream = fs.createReadStream(filePath);
    stream.on('data', (chunk) => hash.update(chunk));
    stream.on('error', reject);
    stream.on('end', () => resolve(hash.digest('hex')));
  });
}

export function hammingDistance(left: string, right: string): number {
  if (left.length !== right.length) {
    return Number.POSITIVE_INFINITY;
  }

  let distance = 0;
  for (let i = 0; i < left.length; i += 1) {
    const xor = Number.parseInt(left[i], 16) ^ Number.parseInt(right[i], 16);
    distance += xor.toString(2).replace(/0/g, '').length;
  }
  return distance;
}
