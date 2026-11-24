import { describe, it, expect, beforeEach } from 'vitest';
import {
  STORAGE_KEY,
  createInitialProgress,
  loadProgress,
  saveProgress,
  recordLessonResult,
  recordWeeklyTestResult,
  computeTrackStats,
  exportProgressJson,
  importProgressJson,
} from '../progressStore';
import type { Lesson } from '../../types/curriculum';

const SAMPLE_LESSONS: Lesson[] = [
  {
    id: 'w1d1',
    week: 1,
    day: 1,
    track: 'finance',
    level: 'foundation',
    title: 'Net Interest Margin',
    scenario: 'Briefing',
    sentences: [],
  },
  {
    id: 'w1d2',
    week: 1,
    day: 2,
    track: 'credit',
    level: 'foundation',
    title: 'Collateral Assessment',
    scenario: 'Credit Committee',
    sentences: [],
  },
  {
    id: 'w1d3',
    week: 1,
    day: 3,
    track: 'tech',
    level: 'foundation',
    title: 'Open API Gateway',
    scenario: 'Tech Sync',
    sentences: [],
  },
];

describe('progressStore', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('returns initial state when localStorage is empty or corrupted JSON', () => {
    expect(loadProgress()).toEqual(createInitialProgress());
    localStorage.setItem(STORAGE_KEY, '{corrupted_json');
    expect(loadProgress()).toEqual(createInitialProgress());
  });

  it('records lesson scores, keeps best score, and increments streak once per day', () => {
    let state = createInitialProgress();
    state = recordLessonResult(state, 'w1d1', { shadowingBest: 82, dictationBest: 90, clozeCompleted: true }, '2026-11-24');
    expect(state.streakDays).toBe(1);
    expect(state.completedLessons['w1d1'].shadowingBest).toBe(82);

    // Same day lower score does not overwrite best or double-count streak
    state = recordLessonResult(state, 'w1d1', { shadowingBest: 60 }, '2026-11-24');
    expect(state.streakDays).toBe(1);
    expect(state.completedLessons['w1d1'].shadowingBest).toBe(82);

    // Next day increments streak
    state = recordLessonResult(state, 'w1d2', { shadowingBest: 88 }, '2026-11-25');
    expect(state.streakDays).toBe(2);
  });

  it('promotes rank only when weekly test score >= 75', () => {
    let state = createInitialProgress();
    expect(state.rank).toBe('Analyst (B1)');

    state = recordWeeklyTestResult(state, 1, 70);
    expect(state.weeklyTestScores[1].passed).toBe(false);
    expect(state.rank).toBe('Analyst (B1)');

    state = recordWeeklyTestResult(state, 1, 80);
    expect(state.weeklyTestScores[1].passed).toBe(true);
    expect(state.rank).toBe('Senior Officer (B1+)');

    state = recordWeeklyTestResult(state, 2, 85);
    expect(state.rank).toBe('Manager (B2)');

    state = recordWeeklyTestResult(state, 3, 90);
    expect(state.rank).toBe('VP / Director (C1)');
  });

  it('computes accurate track completion percentages only when threshold >= 75 or cloze completed', () => {
    let state = createInitialProgress();
    // Low score (40%) does NOT count as mastered
    state = recordLessonResult(state, 'w1d1', { shadowingBest: 40 }, '2026-11-24');
    expect(computeTrackStats(state, SAMPLE_LESSONS).finance.completed).toBe(0);

    // Passing score (80%) counts as mastered
    state = recordLessonResult(state, 'w1d1', { shadowingBest: 80 }, '2026-11-24');
    const stats = computeTrackStats(state, SAMPLE_LESSONS);
    expect(stats.finance).toEqual({ completed: 1, total: 1, percent: 100 });
    expect(stats.credit).toEqual({ completed: 0, total: 1, percent: 0 });
    expect(stats.tech).toEqual({ completed: 0, total: 1, percent: 0 });
  });

  it('exports and imports progress JSON safely, rejecting malformed payloads', () => {
    let state = createInitialProgress();
    state.onboarded = true;
    state.selectedLevel = 'professional';
    saveProgress(state);

    const exported = exportProgressJson(state);
    const imported = importProgressJson(exported);
    expect(imported?.selectedLevel).toBe('professional');
    expect(importProgressJson('{"bad": true}')).toBeNull();
    expect(importProgressJson('not json')).toBeNull();
  });
});
