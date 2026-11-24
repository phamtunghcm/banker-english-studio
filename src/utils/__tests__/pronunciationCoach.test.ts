import { describe, it, expect } from 'vitest';
import { analyzePronunciation, splitSyllableHint } from '../pronunciationCoach';

describe('pronunciationCoach', () => {
  it('splits multi-syllable banking words into readable syllable hints', () => {
    expect(splitSyllableHint('liquidity')).toContain('-');
    expect(splitSyllableHint('NIM')).toBe('N-I-M');
  });

  it('returns zero issues and Xuất sắc grade for 100% accurate reading', () => {
    const report = analyzePronunciation(
      'Our net interest margin expanded rapidly.',
      'Our net interest margin expanded rapidly'
    );
    expect(report.accuracy).toBe(100);
    expect(report.issues).toHaveLength(0);
    expect(report.grade).toBe('Xuất sắc');
  });

  it('identifies every mispronounced or skipped word with actionable Vietnamese coaching tips', () => {
    const report = analyzePronunciation(
      'Lower funding costs drove strong profitability.',
      'Lower funding cost drove strong'
    );
    expect(report.issues.length).toBe(2);

    const costsIssue = report.issues.find((i) => i.word.toLowerCase().startsWith('cost'));
    expect(costsIssue?.status).toBe('near');
    expect(costsIssue?.spoken).toBe('cost');
    expect(costsIssue?.tip).toMatch(/âm cuối|ending/i);

    const profIssue = report.issues.find((i) => i.word.toLowerCase().includes('profitability'));
    expect(profIssue?.status).toBe('missing');
    expect(profIssue?.tip.length).toBeGreaterThan(10);
  });
});
