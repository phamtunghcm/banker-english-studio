import { describe, it, expect } from 'vitest';
import { buildPersonalRoadmap, getLessonsPerDay } from '../roadmap';
import { createInitialProgress, recordLessonResult } from '../progressStore';
import { ALL_LESSONS } from '../../data';

describe('personal roadmap', () => {
  it('puts lessons from chosen focus tracks and goal first', () => {
    const progress = createInitialProgress({
      focusTracks: ['legal'],
      goal: 'credit_committee',
    });
    const roadmap = buildPersonalRoadmap(progress, ALL_LESSONS);
    expect(roadmap).toHaveLength(ALL_LESSONS.length);
    // First lessons must be legal (focus + goal) before unrelated tracks
    expect(roadmap[0].track).toBe('legal');
    expect(roadmap[1].track).toBe('legal');
    const firstTravelIdx = roadmap.findIndex((l) => l.track === 'travel');
    const lastLegalIdx = roadmap.map((l) => l.track).lastIndexOf('legal');
    expect(lastLegalIdx).toBeLessThan(firstTravelIdx);
  });

  it('prioritizes travel/daily lessons for travel_daily goal', () => {
    const progress = createInitialProgress({
      focusTracks: ['travel', 'daily'],
      goal: 'travel_daily',
    });
    const top4 = buildPersonalRoadmap(progress, ALL_LESSONS).slice(0, 4);
    expect(top4.every((l) => l.track === 'travel' || l.track === 'daily')).toBe(true);
  });

  it('keeps mastered lessons in roadmap but their order is stable', () => {
    let progress = createInitialProgress({ focusTracks: ['tech'], goal: 'fintech_it' });
    const first = buildPersonalRoadmap(progress, ALL_LESSONS)[0];
    progress = recordLessonResult(progress, first.id, { shadowingBest: 90 }, '2026-11-24');
    const again = buildPersonalRoadmap(progress, ALL_LESSONS);
    expect(again[0].id).toBe(first.id);
  });

  it('maps daily minutes to lessons per day', () => {
    expect(getLessonsPerDay(15)).toBe(1);
    expect(getLessonsPerDay(30)).toBe(2);
    expect(getLessonsPerDay(45)).toBe(3);
  });
});
