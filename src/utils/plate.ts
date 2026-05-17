const INDIAN_PLATE_PATTERNS = [
  /^[A-Z]{2}[0-9]{1,2}[A-Z]{1,3}[0-9]{4}$/,
  /^[0-9]{2}BH[0-9]{4}[A-Z]{1,2}$/,
];

export function normalizePlateText(value: string): string {
  return value.toUpperCase().replace(/[^A-Z0-9]/g, '');
}

export function isValidIndianVehicleNumber(value: string): boolean {
  const normalized = normalizePlateText(value);
  return INDIAN_PLATE_PATTERNS.some((pattern) => pattern.test(normalized));
}

export function extractPlateCandidates(text: string): string[] {
  const normalized = text
    .toUpperCase()
    .replace(/[^A-Z0-9\s-]/g, ' ')
    .replace(/\s+/g, ' ');

  const rawCandidates = normalized.match(/[A-Z0-9][A-Z0-9\s-]{6,14}[A-Z0-9]/g) || [];
  const compactCandidates = rawCandidates.map(normalizePlateText).filter((value) => value.length >= 8 && value.length <= 11);
  const tokens = normalized.split(/[\s-]+/).filter(Boolean);

  for (let start = 0; start < tokens.length; start += 1) {
    let combined = '';
    for (let end = start; end < Math.min(tokens.length, start + 5); end += 1) {
      combined += tokens[end];
      if (combined.length >= 8 && combined.length <= 11) {
        compactCandidates.push(combined);
      }
    }
  }

  return Array.from(new Set(compactCandidates));
}
