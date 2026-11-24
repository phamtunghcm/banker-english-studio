import { useEffect, useState } from 'react';
import { ALL_LESSONS, CORE_LESSONS, ELECTIVE_LESSONS, WEEKLY_TESTS } from './data';
import type {
  Lesson,
  LevelTier,
  MultiProfileStore,
  RankTitle,
  UserProgress,
} from './types/curriculum';
import {
  addCustomLesson,
  createProfileInStore,
  deleteProfileInStore,
  exportProgressJson,
  importProgressJson,
  loadMultiProfileStore,
  recordLessonResult,
  recordWeeklyTestResult,
  saveMultiProfileStore,
  switchProfileInStore,
  toggleSavedWord,
  updateProfileInStore,
} from './utils/progressStore';
import { OnboardingModal } from './components/OnboardingModal';
import { DashboardView } from './components/DashboardView';
import { LessonPlayer } from './components/LessonPlayer';
import { WeeklyTestView } from './components/WeeklyTestView';
import { CustomLessonModal } from './components/CustomLessonModal';
import { ProfileManagerModal } from './components/ProfileManagerModal';

export function App() {
  const [store, setStore] = useState<MultiProfileStore>(() => loadMultiProfileStore());
  const [activeLesson, setActiveLesson] = useState<Lesson | null>(null);
  const [activeTestWeek, setActiveTestWeek] = useState<1 | 2 | 3 | 4 | null>(null);
  const [forceOnboarding, setForceOnboarding] = useState(false);
  const [showCustomModal, setShowCustomModal] = useState(false);
  const [showProfileModal, setShowProfileModal] = useState(false);

  const progress = store.profiles[store.activeProfileId];
  const activeTheme = progress.profile.theme ?? 'crisp-light';

  useEffect(() => {
    saveMultiProfileStore(store);
  }, [store]);

  useEffect(() => {
    document.documentElement.setAttribute('data-ui-theme', activeTheme);
  }, [activeTheme]);

  const updateActiveProgress = (updater: (prev: UserProgress) => UserProgress) => {
    setStore((prevStore) => {
      const current = prevStore.profiles[prevStore.activeProfileId];
      if (!current) return prevStore;
      return {
        ...prevStore,
        profiles: {
          ...prevStore.profiles,
          [prevStore.activeProfileId]: updater(current),
        },
      };
    });
  };

  const handleOnboardingComplete = (level: LevelTier, rank: RankTitle) => {
    updateActiveProgress((prev) => ({
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
    a.download = `banker-english-${progress.profile.id}-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImportJson = (raw: string) => {
    const parsed = importProgressJson(raw);
    if (parsed) {
      updateActiveProgress(() => ({
        ...parsed,
        profile: {
          ...parsed.profile,
          id: store.activeProfileId,
        },
      }));
    }
  };

  const showOnboarding = !progress.onboarded || forceOnboarding;
  const activeWeeklyTest = activeTestWeek
    ? WEEKLY_TESTS.find((t) => t.week === activeTestWeek) ?? null
    : null;
  const listeningLessonForTest = activeWeeklyTest
    ? ALL_LESSONS.find((l) => l.id === activeWeeklyTest.listeningLessonId) ?? ALL_LESSONS[0]
    : null;

  return (
    <main
      data-ui-theme={activeTheme}
      className="theme-surface min-h-screen bg-slate-50 px-4 py-6 text-slate-900 transition-colors sm:px-6 lg:px-8"
    >
      {showOnboarding ? (
        <OnboardingModal onComplete={handleOnboardingComplete} />
      ) : activeLesson ? (
        <LessonPlayer
          lesson={activeLesson}
          savedWords={(progress.savedWords ?? []).map((w) => w.word)}
          onToggleSaveWord={(word, ctx) =>
            updateActiveProgress((prev) => toggleSavedWord(prev, word, ctx, activeLesson.id))
          }
          onComplete={(res) => {
            updateActiveProgress((prev) =>
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
            updateActiveProgress((prev) =>
              recordWeeklyTestResult(prev, activeWeeklyTest.week, score)
            );
          }}
          onBack={() => setActiveTestWeek(null)}
        />
      ) : (
        <DashboardView
          progress={progress}
          lessons={CORE_LESSONS}
          electiveLessons={ELECTIVE_LESSONS}
          onSelectLesson={(lesson) => setActiveLesson(lesson)}
          onStartWeeklyTest={(week) => setActiveTestWeek(week)}
          onOpenCustomModal={() => setShowCustomModal(true)}
          onOpenProfileModal={() => setShowProfileModal(true)}
          onChangeTheme={(theme) =>
            setStore((prev) =>
              updateProfileInStore(prev, prev.activeProfileId, { theme })
            )
          }
          onRemoveSavedWord={(word) =>
            updateActiveProgress((prev) => toggleSavedWord(prev, word, '', ''))
          }
          onExportJson={handleExportJson}
          onImportJson={handleImportJson}
          onReopenOnboarding={() => setForceOnboarding(true)}
        />
      )}

      {showCustomModal && (
        <CustomLessonModal
          onClose={() => setShowCustomModal(false)}
          onCreate={(lesson) => {
            updateActiveProgress((prev) => addCustomLesson(prev, lesson));
            setShowCustomModal(false);
            setActiveLesson(lesson);
          }}
        />
      )}

      {showProfileModal && (
        <ProfileManagerModal
          store={store}
          onClose={() => setShowProfileModal(false)}
          onSwitchProfile={(id) => {
            setActiveLesson(null);
            setActiveTestWeek(null);
            setStore((prev) => switchProfileInStore(prev, id));
          }}
          onCreateProfile={(config, level) => {
            const rankMap: Record<LevelTier, RankTitle> = {
              foundation: 'Analyst (B1)',
              professional: 'Senior Officer (B1+)',
              executive: 'Manager (B2)',
            };
            setStore((prev) => createProfileInStore(prev, config, level, rankMap[level]));
          }}
          onUpdateActiveProfile={(updates, level) => {
            setStore((prev) =>
              updateProfileInStore(prev, prev.activeProfileId, updates, level)
            );
          }}
          onDeleteProfile={(id) => {
            setStore((prev) => deleteProfileInStore(prev, id));
          }}
        />
      )}
    </main>
  );
}
