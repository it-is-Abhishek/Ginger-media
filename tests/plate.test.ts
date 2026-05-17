import { extractPlateCandidates, isValidIndianVehicleNumber, normalizePlateText } from '../src/utils/plate';

describe('Indian vehicle plate utilities', () => {
  it('normalizes plate text', () => {
    expect(normalizePlateText('mh-12 ab 1234')).toBe('MH12AB1234');
  });

  it('validates common Indian registration formats', () => {
    expect(isValidIndianVehicleNumber('MH12AB1234')).toBe(true);
    expect(isValidIndianVehicleNumber('22BH1234AA')).toBe(true);
    expect(isValidIndianVehicleNumber('ABC123')).toBe(false);
  });

  it('extracts compact candidates from OCR-like text', () => {
    expect(extractPlateCandidates('plate: MH 12 AB 1234')).toContain('MH12AB1234');
  });
});
