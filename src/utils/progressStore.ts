import type {
  Lesson,
  LessonRecord,
  RankTitle,
  Track,
  UserProgress,
} from '../types/curriculum';

export const STORAGE_KEY = 'banker_english_studio_v1';

const RANK_LADDER: RankTitle[] = [
  'Analyst (B1)',
  'Senior Officer (B1+)',
  'Manager (B2)',
  'VP / Director (C1)',
];

export function createInitialProgress(): UserProgress {
  return {
    onboarded: false,
    selectedLevel: 'foundation',
    rank: 'Analyst (B1)',
    streakDays: 0,
    lastActiveDate: null,
    completedLessons: {},
    weeklyTestScores: {},
  };
}

function isValidProgressShape(data: unknown): data is UserProgress {
  if (!data || typeof data !== 'object') return false;
  const obj = data as Record<string, unknown>;
  return (
    typeof obj.onboarded === 'boolean' &&
    (obj.selectedLevel === 'foundation' ||
      obj.selectedLevel === 'professional' ||
      obj.selectedLevel === 'executive') &&
    typeof obj.rank === 'string' &&
    typeof obj.streakDays === 'number' &&
    typeof obj.completedLessons === 'object' &&
    obj.completedLessons !== null &&
    typeof obj.weeklyTestScores === 'object' &&
    obj.weeklyTestScores !== null
  );
}

export function loadProgress(): UserProgress {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return createInitialProgress();
    const parsed: unknown = JSON.parse(raw);
    if (!isValidProgressShape(parsed)) return createInitialProgress();
    return parsed;
  } catch {
    return createInitialProgress();
  }
}

export function saveProgress(progress: UserProgress): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(progress));
  } catch {
    // Ignore storage quota errors silently
  }
}

function getTodayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function computeNextStreak(lastActive: string | null, currentStreak: number, today: string): number {
  if (!lastActive) return 1;
  if (lastActive === today) return Math.max(1, currentStreak);

  const prevMs = Date.parse(`${lastActive}T00:00:00Z`);
  const todayMs = Date.parse(`${today}T00:00:00Z`);
  const diffDays = Math.round((todayMs - prevMs) / 86_400_000);

  return diffDays === 1 ? currentStreak + 1 : 1;
}

export function recordLessonResult(
  progress: UserProgress,
  lessonId: string,
  update: Partial<LessonRecord>,
  dateOverride?: string
): UserProgress {
  const today = dateOverride ?? getTodayIso();
  const prev = progress.completedLessons[lessonId];

  const mergedRecord: LessonRecord = {
    shadowingBest: Math.max(prev?.shadowingBest ?? 0, update.shadowingBest ?? 0),
    dictationBest: Math.max(prev?.dictationBest ?? 0, update.dictationBest ?? 0),
    clozeCompleted: Boolean(prev?.clozeCompleted || update.clozeCompleted),
    completedAt: today,
  };

  return {
    ...progress,
    streakDays: computeNextStreak(progress.lastActiveDate, progress.streakDays, today),
    lastActiveDate: today,
    completedLessons: {
      ...progress.completedLessons,
      [lessonId]: mergedRecord,
    },
  };
}

export function recordWeeklyTestResult(
  progress: UserProgress,
  week: 1 | 2 | 3 | 4,
  score: number,
  dateOverride?: string
): UserProgress {
  const today = dateOverride ?? getTodayIso();
  const passed = score >= 75;
  const prevScore = progress.weeklyTestScores[week]?.score ?? 0;
  const prevPassed = progress.weeklyTestScores[week]?.passed ?? false;

  const nextWeeklyScores = {
    ...progress.weeklyTestScores,
    [week]: {
      score: Math.max(prevScore, score),
      passed: prevPassed || passed,
      completedAt: today,
    },
  };

  const passedCount = Object.values(nextWeeklyScores).filter((w) => w.passed).length;
  const rankIndex = Math.min(passedCount, RANK_LADDER.length - 1);

  return {
    ...progress,
    rank: RANK_LADDER[rankIndex],
    weeklyTestScores: nextWeeklyScores,
  };
}

export function computeTrackStats(
  progress: UserProgress,
  lessons: Lesson[]
): Record<Track, { completed: number; total: number; percent: number }> {
  const tracks: Track[] = ['finance', 'credit', 'tech'];
  const result = {} as Record<Track, { completed: number; total: number; percent: number }>;

  for (const track of tracks) {
    const trackLessons = lessons.filter((l) => l.track === track);
    const total = trackLessons.length;
    const completed = trackLessons.filter((l) => Boolean(progress.completedLessons[l.id])).length;
    result[track] = {
      completed,
      total,
      percent: total === 0 ? 0 : Math.round((completed / total) * 100),
    };
  }
  return result;
}

export function exportProgressJson(progress: UserProgress): string {
  return JSON.stringify(progress, null, 2);
}

export function importProgressJson(raw: string): UserProgress | null {
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!isValidProgressShape(parsed)) return null;
    return parsed;
  } catch {
    return null;
  }
}
