import type { LearningGoal, Lesson, LevelTier, Track, UserProgress } from '../types/curriculum';

const GOAL_TRACKS: Record<LearningGoal, Track[]> = {
  executive_meeting: ['finance'],
  credit_committee: ['credit', 'legal'],
  fintech_it: ['tech'],
  travel_daily: ['travel', 'daily'],
};

export const GOAL_LABELS_VI: Record<LearningGoal, string> = {
  executive_meeting: 'Họp & Thuyết trình',
  credit_committee: 'Thẩm định Tín dụng',
  fintech_it: 'Dự án Fintech / IT',
  travel_daily: 'Công tác & Đời sống',
};

export function getGoalTracks(goal: LearningGoal): Track[] {
  return GOAL_TRACKS[goal];
}

export function getLessonsPerDay(minutes: 15 | 30 | 45): number {
  if (minutes >= 45) return 3;
  if (minutes >= 30) return 2;
  return 1;
}

function scoreLesson(lesson: Lesson, focus: Track[], goal: LearningGoal, level: LevelTier): number {
  let score = 0;
  if (focus.includes(lesson.track)) score += 3;
  if (GOAL_TRACKS[goal].includes(lesson.track)) score += 2;
  if (goal === 'executive_meeting' && lesson.level === 'executive') score += 2;
  if (lesson.level === level) score += 1;
  return score;
}

/**
 * Orders all lessons for this learner: chosen fields & goal first,
 * then level match, then the original curriculum order (week/day) to stay predictable.
 */
export function buildPersonalRoadmap(progress: UserProgress, lessons: Lesson[]): Lesson[] {
  const { focusTracks, goal } = progress.profile;
  return lessons
    .map((lesson, originalIdx) => ({
      lesson,
      originalIdx,
      score: scoreLesson(lesson, focusTracks, goal, progress.selectedLevel),
    }))
    .sort((a, b) => b.score - a.score || a.originalIdx - b.originalIdx)
    .map((x) => x.lesson);
}
