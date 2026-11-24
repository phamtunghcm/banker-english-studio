import { describe, it, expect } from 'vitest';
import { ALL_LESSONS, WEEKLY_TESTS, PLACEMENT_QUESTIONS } from '../index';

describe('curriculum data integrity', () => {
  it('contains 24 lessons across 4 weeks and 6 days per week with unique IDs', () => {
    expect(ALL_LESSONS).toHaveLength(24);
    const ids = new Set(ALL_LESSONS.map((l) => l.id));
    expect(ids.size).toBe(24);

    for (const week of [1, 2, 3, 4] as const) {
      const weekLessons = ALL_LESSONS.filter((l) => l.week === week);
      expect(weekLessons).toHaveLength(6);
    }
  });

  it('covers all three banking tracks: finance, credit, and tech', () => {
    const tracks = new Set(ALL_LESSONS.map((l) => l.track));
    expect(tracks).toEqual(new Set(['finance', 'credit', 'tech']));
  });

  it('ensures every sentence has non-empty en/vi/startTime and clozeWord appears in en', () => {
    for (const lesson of ALL_LESSONS) {
      expect(lesson.sentences.length).toBeGreaterThanOrEqual(4);
      for (const s of lesson.sentences) {
        expect(s.en.trim().length).toBeGreaterThan(0);
        expect(s.vi.trim().length).toBeGreaterThan(0);
        expect(s.startTime).toMatch(/^\d{2}:\d{2}$/);
        expect(s.en.toLowerCase()).toContain(s.clozeWord.toLowerCase());
      }
    }
  });

  it('has 4 weekly tests referencing valid listening lessons and valid placement questions', () => {
    expect(WEEKLY_TESTS).toHaveLength(4);
    const lessonIds = new Set(ALL_LESSONS.map((l) => l.id));
    for (const test of WEEKLY_TESTS) {
      expect(lessonIds.has(test.listeningLessonId)).toBe(true);
      expect(test.passingScore).toBe(75);
      expect(test.vocabQuestions.length).toBeGreaterThanOrEqual(3);
    }
    expect(PLACEMENT_QUESTIONS.length).toBeGreaterThanOrEqual(4);
  });
});
