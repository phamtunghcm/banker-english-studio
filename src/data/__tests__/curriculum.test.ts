import { describe, it, expect } from 'vitest';
import {
  ALL_LESSONS,
  CORE_LESSONS,
  ELECTIVE_LESSONS,
  EXAM_LESSONS,
  WEEKLY_TESTS,
  PLACEMENT_QUESTIONS,
} from '../index';

describe('curriculum data integrity', () => {
  it('contains 24 core roadmap lessons, 8 elective lessons, and 6 exam lessons with unique IDs', () => {
    expect(CORE_LESSONS).toHaveLength(24);
    expect(ELECTIVE_LESSONS).toHaveLength(8);
    expect(EXAM_LESSONS).toHaveLength(6);
    expect(ALL_LESSONS).toHaveLength(38);

    const ids = new Set(ALL_LESSONS.map((l) => l.id));
    expect(ids.size).toBe(38);

    for (const week of [1, 2, 3, 4] as const) {
      const weekLessons = CORE_LESSONS.filter((l) => l.week === week);
      expect(weekLessons).toHaveLength(6);
    }
  });

  it('covers all 9 tracks: finance, credit, tech, legal, travel, daily, ielts, toefl, and toeic', () => {
    const tracks = new Set(ALL_LESSONS.map((l) => l.track));
    expect(tracks).toEqual(
      new Set(['finance', 'credit', 'tech', 'legal', 'travel', 'daily', 'ielts', 'toefl', 'toeic'])
    );
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
