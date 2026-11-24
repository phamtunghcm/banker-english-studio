import { useEffect, useState } from 'react';
import { ALL_LESSONS, WEEKLY_TESTS } from './data';
import type { Lesson, LevelTier, RankTitle, UserProgress } from './types/curriculum';
import {
  exportProgressJson,
  importProgressJson,
  loadProgress,
  recordLessonResult,
  recordWeeklyTestResult,
  saveProgress,
} from './utils/progressStore';
import { OnboardingModal } from './components/OnboardingModal';
import { DashboardView } from './components/DashboardView';
import { LessonPlayer } from './components/LessonPlayer';
import { WeeklyTestView } from './components/WeeklyTestView';

export function App() {
  const [progress, setProgress] = useState<UserProgress>(() => loadProgress());
  const [activeLesson, setActiveLesson] = useState<Lesson | null>(null);
  const [activeTestWeek, setActiveTestWeek] = useState<1 | 2 | 3 | 4 | null>(null);
  const [forceOnboarding, setForceOnboarding] = useState(false);

  useEffect(() => {
    saveProgress(progress);
  }, [progress]);

  const handleOnboardingComplete = (level: LevelTier, rank: RankTitle) => {
    setProgress((prev) => ({
      ...prev,
      onboarded: true,
      selectedLevel: level,
      rank,
    }));
    setForceOnboarding(false);
  };

  const handleExportJson = () => {
    const content = exportProgressJson(progress);
    const blob = new Blob([content], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `banker-english-progress-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImportJson = (raw: string) => {
    const parsed = importProgressJson(raw);
    if (parsed) setProgress(parsed);
  };

  const showOnboarding = !progress.onboarded || forceOnboarding;
  const activeWeeklyTest = activeTestWeek
    ? WEEKLY_TESTS.find((t) => t.week === activeTestWeek) ?? null
    : null;
  const listeningLessonForTest = activeWeeklyTest
    ? ALL_LESSONS.find((l) => l.id === activeWeeklyTest.listeningLessonId) ?? ALL_LESSONS[0]
    : null;

  return (
    <main className="min-h-screen bg-slate-950 px-4 py-6 text-slate-100 sm:px-6 lg:px-8">
      {showOnboarding ? (
        <OnboardingModal onComplete={handleOnboardingComplete} />
      ) : activeLesson ? (
        <LessonPlayer
          lesson={activeLesson}
          onComplete={(res) => {
            setProgress((prev) =>
              recordLessonResult(prev, activeLesson.id, {
                shadowingBest: res.shadowingScore,
                dictationBest: res.dictationScore,
                clozeCompleted: res.clozeDone,
              })
            );
          }}
          onBack={() => setActiveLesson(null)}
        />
      ) : activeWeeklyTest && listeningLessonForTest ? (
        <WeeklyTestView
          test={activeWeeklyTest}
          listeningLesson={listeningLessonForTest}
          onFinish={(score) => {
            setProgress((prev) => recordWeeklyTestResult(prev, activeWeeklyTest.week, score));
          }}
          onBack={() => setActiveTestWeek(null)}
        />
      ) : (
        <DashboardView
          progress={progress}
          lessons={ALL_LESSONS}
          onSelectLesson={(lesson) => setActiveLesson(lesson)}
          onStartWeeklyTest={(week) => setActiveTestWeek(week)}
          onExportJson={handleExportJson}
          onImportJson={handleImportJson}
          onReopenOnboarding={() => setForceOnboarding(true)}
        />
      )}
    </main>
  );
}
