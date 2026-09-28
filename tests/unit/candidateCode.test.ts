import { describe, expect, it } from 'vitest';
import { CANDIDATE_CODE_PATTERN, generateCandidateCode, normalizeCandidateCode } from '../../shared/candidateCode';

describe('generateCandidateCode', () => {
  it('produces IDs matching the EXM-YYYY-XXXXX format', () => {
    const code = generateCandidateCode(2026, new Uint32Array([0, 1, 2, 3, 4]));
    expect(code).toBe('EXM-2026-ABCDE');
    expect(CANDIDATE_CODE_PATTERN.test(code)).toBe(true);
  });

  it('never uses easily confused characters', () => {
    const values = new Uint32Array(Array.from({ length: 5 }, (_, i) => i * 7919));
    for (let seed = 0; seed < 200; seed++) {
      const code = generateCandidateCode(2026, values.map((v) => v + seed));
      expect(code.slice(9)).not.toMatch(/[01ILO]/);
    }
  });
});

describe('normalizeCandidateCode', () => {
  it('accepts lower case, spaces and missing dashes', () => {
    expect(normalizeCandidateCode(' exm 2026 a7k92 ')).toBe('EXM-2026-A7K92');
    expect(normalizeCandidateCode('EXM2026A7K92')).toBe('EXM-2026-A7K92');
  });

  it('leaves invalid input recognisably invalid', () => {
    expect(CANDIDATE_CODE_PATTERN.test(normalizeCandidateCode('hello'))).toBe(false);
  });
});
