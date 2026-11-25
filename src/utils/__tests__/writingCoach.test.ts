import { describe, it, expect } from 'vitest';
import { evaluateWritingResponse, formatExamBand } from '../writingCoach';

describe('writingCoach', () => {
  it('formats IELTS, TOEFL 2026 (1.0-6.0 + 120), and TOEIC band scores accurately', () => {
    expect(formatExamBand('ielts', 80)).toMatch(/^IELTS Band \d\.\d$/);
    expect(formatExamBand('toefl', 80)).toMatch(/^TOEFL \d\.\d\/6\.0 \(~\d+\/120\)$/);
    expect(formatExamBand('toeic', 80)).toMatch(/^TOEIC ~\d+\/990$/);
  });

  it('gives low score to empty or ultra-short submissions', () => {
    const res = evaluateWritingResponse('Hello world', 'ielts', 120);
    expect(res.wordCount).toBe(2);
    expect(res.scorePercent).toBeLessThanOrEqual(15);
    expect(res.improvements.length).toBeGreaterThan(0);
  });

  it('rewards structured responses with connectors and academic vocabulary', () => {
    const essay =
      'Artificial intelligence improves banking efficiency and productivity significantly. Primarily, automation reduces routine errors in credit assessment and document verification. For instance, analysts can evaluate corporate risk much faster using digital governance tools. However, institutions must mitigate compliance risks through transparent accountability and staff retraining. Therefore, balanced regulation ensures sustainable long-term innovation for all stakeholders.';
    const res = evaluateWritingResponse(essay, 'ielts', 50, ['automation', 'compliance', 'governance']);
    expect(res.wordCount).toBeGreaterThanOrEqual(50);
    expect(res.connectorsFound.length).toBeGreaterThanOrEqual(3);
    expect(res.academicVocabFound.length).toBeGreaterThanOrEqual(4);
    expect(res.scorePercent).toBeGreaterThanOrEqual(80);
  });
});
