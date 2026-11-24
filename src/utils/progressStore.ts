import type {
  GameId,
  Lesson,
  LessonRecord,
  LevelTier,
  MultiProfileStore,
  RankTitle,
  SavedWord,
  Track,
  UserProfileConfig,
  UserProgress,
} from '../types/curriculum';

export const STORAGE_KEY = 'banker_english_studio_v1';
export const MULTI_STORE_KEY = 'banker_english_studio_profiles_v1';
export const MASTERY_THRESHOLD = 75;

const RANK_LADDER: RankTitle[] = [
  'Analyst (B1)',
  'Senior Officer (B1+)',
  'Manager (B2)',
  'VP / Director (C1)',
];

export function createDefaultProfileConfig(
  overrides: Partial<UserProfileConfig> = {}
): UserProfileConfig {
  return {
    id: overrides.id ?? 'default-user',
    name: overrides.name ?? 'Banker Member',
    roleTitle: overrides.roleTitle ?? 'Chuyên viên Ngân hàng',
    avatarColor: overrides.avatarColor ?? 'bg-emerald-600',
    focusTracks: overrides.focusTracks ?? ['finance', 'credit', 'tech'],
    goal: overrides.goal ?? 'executive_meeting',
    dailyMinutesTarget: overrides.dailyMinutesTarget ?? 15,
    theme: overrides.theme ?? 'crisp-light',
    voicePreset: overrides.voicePreset ?? 'female-warm-us',
  };
}

export function createInitialProgress(
  profileOverrides: Partial<UserProfileConfig> = {},
  level: LevelTier = 'foundation',
  rank: RankTitle = 'Analyst (B1)'
): UserProgress {
  return {
    profile: createDefaultProfileConfig(profileOverrides),
    onboarded: false,
    selectedLevel: level,
    rank,
    streakDays: 0,
    lastActiveDate: null,
    completedLessons: {},
    weeklyTestScores: {},
    savedWords: [],
    customLessons: [],
    gameXp: 0,
    gameBest: {},
  };
}

function isValidProgressShape(data: unknown): data is Partial<UserProgress> & {
  onboarded: boolean;
  selectedLevel: LevelTier;
  rank: string;
  streakDays: number;
  completedLessons: Record<string, LessonRecord>;
  weeklyTestScores: Record<number, { score: number; passed: boolean; completedAt: string }>;
} {
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

function normalizeProgress(raw: Partial<UserProgress>): UserProgress {
  const base = createInitialProgress();
  return {
    ...base,
    ...raw,
    profile: {
      ...base.profile,
      ...(raw.profile ?? {}),
      focusTracks:
        Array.isArray(raw.profile?.focusTracks) && raw.profile!.focusTracks.length > 0
          ? raw.profile!.focusTracks
          : base.profile.focusTracks,
    },
    savedWords: Array.isArray(raw.savedWords) ? raw.savedWords : [],
    customLessons: Array.isArray(raw.customLessons) ? raw.customLessons : [],
    gameXp: typeof raw.gameXp === 'number' ? raw.gameXp : 0,
    gameBest: raw.gameBest && typeof raw.gameBest === 'object' ? raw.gameBest : {},
  };
}

export function loadProgress(): UserProgress {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return createInitialProgress();
    const parsed: unknown = JSON.parse(raw);
    if (!isValidProgressShape(parsed)) return createInitialProgress();
    return normalizeProgress(parsed as Partial<UserProgress>);
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

export function loadMultiProfileStore(): MultiProfileStore {
  try {
    const raw = localStorage.getItem(MULTI_STORE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<MultiProfileStore>;
      if (
        parsed &&
        typeof parsed.activeProfileId === 'string' &&
        parsed.profiles &&
        typeof parsed.profiles === 'object'
      ) {
        const normalizedProfiles: Record<string, UserProgress> = {};
        for (const [id, p] of Object.entries(parsed.profiles)) {
          if (isValidProgressShape(p)) {
            normalizedProfiles[id] = normalizeProgress({
              ...(p as Partial<UserProgress>),
              profile: {
                ...createDefaultProfileConfig({ id }),
                ...((p as Partial<UserProgress>).profile ?? {}),
                id,
              },
            });
          }
        }
        if (Object.keys(normalizedProfiles).length > 0) {
          const activeId = normalizedProfiles[parsed.activeProfileId]
            ? parsed.activeProfileId
            : Object.keys(normalizedProfiles)[0];
          return { activeProfileId: activeId, profiles: normalizedProfiles };
        }
      }
    }
  } catch {
    // Fallback to legacy migration or fresh store
  }

  const legacy = loadProgress();
  const id = legacy.profile.id || 'default-user';
  return {
    activeProfileId: id,
    profiles: { [id]: { ...legacy, profile: { ...legacy.profile, id } } },
  };
}

export function saveMultiProfileStore(store: MultiProfileStore): void {
  try {
    localStorage.setItem(MULTI_STORE_KEY, JSON.stringify(store));
  } catch {
    // Ignore storage quota errors silently
  }
}

export function createProfileInStore(
  store: MultiProfileStore,
  config: Omit<UserProfileConfig, 'id'>,
  level: LevelTier = 'foundation',
  rank: RankTitle = 'Analyst (B1)'
): MultiProfileStore {
  const id = `user-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
  const newProgress = createInitialProgress({ ...config, id }, level, rank);
  newProgress.onboarded = true;
  return {
    activeProfileId: id,
    profiles: {
      ...store.profiles,
      [id]: newProgress,
    },
  };
}

export function switchProfileInStore(
  store: MultiProfileStore,
  profileId: string
): MultiProfileStore {
  if (!store.profiles[profileId]) return store;
  return {
    ...store,
    activeProfileId: profileId,
  };
}

export function updateProfileInStore(
  store: MultiProfileStore,
  profileId: string,
  updates: Partial<UserProfileConfig>,
  level?: LevelTier
): MultiProfileStore {
  const target = store.profiles[profileId];
  if (!target) return store;
  return {
    ...store,
    profiles: {
      ...store.profiles,
      [profileId]: {
        ...target,
        selectedLevel: level ?? target.selectedLevel,
        profile: {
          ...target.profile,
          ...updates,
        },
      },
    },
  };
}

export function deleteProfileInStore(
  store: MultiProfileStore,
  profileId: string
): MultiProfileStore {
  const keys = Object.keys(store.profiles);
  if (keys.length <= 1 || !store.profiles[profileId]) return store;
  const nextProfiles = { ...store.profiles };
  delete nextProfiles[profileId];
  const nextActive =
    store.activeProfileId === profileId ? Object.keys(nextProfiles)[0] : store.activeProfileId;
  return {
    activeProfileId: nextActive,
    profiles: nextProfiles,
  };
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

export function isLessonMastered(record?: LessonRecord): boolean {
  if (!record) return false;
  return (
    record.shadowingBest >= MASTERY_THRESHOLD ||
    record.dictationBest >= MASTERY_THRESHOLD ||
    record.clozeCompleted
  );
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
  const passed = score >= MASTERY_THRESHOLD;
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
  const tracks: Track[] = ['finance', 'credit', 'tech', 'legal', 'travel', 'daily'];
  const result = {} as Record<Track, { completed: number; total: number; percent: number }>;

  for (const track of tracks) {
    const trackLessons = lessons.filter((l) => l.track === track);
    const total = trackLessons.length;
    const completed = trackLessons.filter((l) =>
      isLessonMastered(progress.completedLessons[l.id])
    ).length;
    result[track] = {
      completed,
      total,
      percent: total === 0 ? 0 : Math.round((completed / total) * 100),
    };
  }
  return result;
}

export function toggleSavedWord(
  progress: UserProgress,
  word: string,
  contextSentence: string,
  lessonId: string
): UserProgress {
  const cleanWord = word.replace(/^[^\w]+|[^\w]+$/g, '');
  if (!cleanWord) return progress;

  const current = progress.savedWords ?? [];
  const exists = current.some((w) => w.word.toLowerCase() === cleanWord.toLowerCase());
  const nextWords: SavedWord[] = exists
    ? current.filter((w) => w.word.toLowerCase() !== cleanWord.toLowerCase())
    : [
        {
          word: cleanWord,
          contextSentence,
          lessonId,
          addedAt: getTodayIso(),
        },
        ...current,
      ];

  return {
    ...progress,
    savedWords: nextWords,
  };
}

export function addCustomLesson(progress: UserProgress, lesson: Lesson): UserProgress {
  const current = progress.customLessons ?? [];
  return {
    ...progress,
    customLessons: [lesson, ...current],
  };
}

export function recordGameResult(
  progress: UserProgress,
  gameId: GameId,
  score: number,
  dateOverride?: string
): UserProgress {
  const today = dateOverride ?? getTodayIso();
  const safeScore = Math.max(0, Math.round(score));
  const best = progress.gameBest ?? {};
  return {
    ...progress,
    streakDays: computeNextStreak(progress.lastActiveDate, progress.streakDays, today),
    lastActiveDate: today,
    gameXp: (progress.gameXp ?? 0) + safeScore,
    gameBest: {
      ...best,
      [gameId]: Math.max(best[gameId] ?? 0, safeScore),
    },
  };
}

export function exportProgressJson(progress: UserProgress): string {
  return JSON.stringify(progress, null, 2);
}

export function importProgressJson(raw: string): UserProgress | null {
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!isValidProgressShape(parsed)) return null;
    return normalizeProgress(parsed as Partial<UserProgress>);
  } catch {
    return null;
  }
}
