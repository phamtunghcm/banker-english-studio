export type Track =
  | 'finance'
  | 'credit'
  | 'tech'
  | 'legal'
  | 'travel'
  | 'daily';

export type LevelTier = 'foundation' | 'professional' | 'executive';

export type LearningGoal =
  | 'executive_meeting'
  | 'credit_committee'
  | 'fintech_it'
  | 'travel_daily';

export type UiThemeId =
  | 'crisp-light'
  | 'warm-paper'
  | 'private-banking'
  | 'midnight'
  | 'mint-focus';

export interface UserProfileConfig {
  id: string;
  name: string;
  roleTitle: string;
  avatarColor: string;
  focusTracks: Track[];
  goal: LearningGoal;
  dailyMinutesTarget: 15 | 30 | 45;
  theme?: UiThemeId;
}

export type RankTitle =
  | 'Analyst (B1)'
  | 'Senior Officer (B1+)'
  | 'Manager (B2)'
  | 'VP / Director (C1)';

export type WordStatus = 'correct' | 'near' | 'missing';

export interface WordScoreResult {
  expected: string;
  spoken?: string;
  status: WordStatus;
  similarity: number;
}

export interface LessonSentence {
  id: string;
  startTime: string;
  en: string;
  vi: string;
  clozeWord: string;
  keywords: string[];
}

export interface Lesson {
  id: string;
  week: 1 | 2 | 3 | 4;
  day: number;
  track: Track;
  level: LevelTier;
  title: string;
  scenario: string;
  sentences: LessonSentence[];
  isCustom?: boolean;
}

export interface WeeklyTestQuestion {
  id: string;
  prompt: string;
  options: string[];
  answerIndex: number;
  track: Track;
}

export interface WeeklyTest {
  week: 1 | 2 | 3 | 4;
  title: string;
  passingScore: number;
  listeningLessonId: string;
  vocabQuestions: WeeklyTestQuestion[];
}

export interface LessonRecord {
  shadowingBest: number;
  dictationBest: number;
  clozeCompleted: boolean;
  completedAt: string;
}

export interface WeeklyTestRecord {
  score: number;
  passed: boolean;
  completedAt: string;
}

export interface SavedWord {
  word: string;
  contextSentence: string;
  lessonId: string;
  addedAt: string;
}

export interface UserProgress {
  profile: UserProfileConfig;
  onboarded: boolean;
  selectedLevel: LevelTier;
  rank: RankTitle;
  streakDays: number;
  lastActiveDate: string | null;
  completedLessons: Record<string, LessonRecord>;
  weeklyTestScores: Record<number, WeeklyTestRecord>;
  savedWords?: SavedWord[];
  customLessons?: Lesson[];
}

export interface MultiProfileStore {
  activeProfileId: string;
  profiles: Record<string, UserProgress>;
}
