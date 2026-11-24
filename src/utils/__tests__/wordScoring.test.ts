import { describe, it, expect } from 'vitest';
import {
  normalizeWords,
  scoreWordAlignment,
  scoreDictation,
  checkClozeAnswer,
} from '../wordScoring';

describe('wordScoring', () => {
  it('normalizes punctuation, percentage signs, and banking acronyms cleanly', () => {
    const tokens = normalizeWords('NIM rose 2.5%, while eKYC reduced NPLs.');
    expect(tokens).toEqual(['nim', 'rose', '2.5', 'while', 'ekyc', 'reduced', 'npls']);
  });

  it('returns 100% accuracy and all correct when spoken matches expected', () => {
    const result = scoreWordAlignment(
      'Our core banking system processes real-time settlements.',
      'our core banking system processes real time settlements'
    );
    expect(result.accuracy).toBe(100);
    expect(result.words.every((w) => w.status === 'correct')).toBe(true);
  });

  it('handles empty spoken transcript gracefully with 0% and all missing (no NaN)', () => {
    const result = scoreWordAlignment('Capital adequacy ratio remains strong.', '');
    expect(result.accuracy).toBe(0);
    expect(Number.isNaN(result.accuracy)).toBe(false);
    expect(result.words).toHaveLength(5);
    expect(result.words.every((w) => w.status === 'missing')).toBe(true);
  });

  it('marks minor pronunciation/spelling deviations as near', () => {
    const result = scoreWordAlignment(
      'We verify collateral coverage carefully.',
      'we verify colateral coverage carefully'
    );
    const collateralWord = result.words.find((w) => w.expected.toLowerCase().includes('collateral'));
    expect(collateralWord?.status).toBe('near');
    expect(result.accuracy).toBeGreaterThanOrEqual(80);
  });

  it('resynchronizes alignment when a word is skipped mid-sentence', () => {
    const result = scoreWordAlignment(
      'The credit committee approved the syndicated loan today.',
      'the credit approved the syndicated loan today'
    );
    const statuses = result.words.map((w) => w.status);
    expect(statuses).toEqual([
      'correct',
      'correct',
      'missing',
      'correct',
      'correct',
      'correct',
      'correct',
      'correct',
    ]);
  });

  it('scores dictation and checks cloze answers case-insensitively with trim', () => {
    const dict = scoreDictation('Liquidity risk is monitored daily.', 'Liquidity risk monitored daily');
    expect(dict.words.map((w) => w.status)).toEqual([
      'correct',
      'correct',
      'missing',
      'correct',
      'correct',
    ]);
    expect(checkClozeAnswer('collateral', '  Collateral. ')).toBe(true);
    expect(checkClozeAnswer('liquidity', 'solvency')).toBe(false);
  });
});
