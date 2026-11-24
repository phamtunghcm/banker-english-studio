import { useEffect, useState } from 'react';
import { ALL_LESSONS, CORE_LESSONS, ELECTIVE_LESSONS, WEEKLY_TESTS } from './data';
import type {
  Lesson,
  LevelTier,
  MultiProfileStore,
  RankTitle,
  UserProfileConfig,
  UserProgress,
} from './types/curriculum';
import {
  addCustomLesson,
  createProfileInStore,
  deleteProfileInStore,
  exportProgressJson,
  importProgressJson,
  loadMultiProfileStore,
  recordGameResult,
  recordLessonResult,
  recordWeeklyTestResult,
  saveMultiProfileStore,
  switchProfileInStore,
  toggleSavedWord,
  updateProfileInStore,
} from './utils/progressStore';
import { setDefaultVoicePreset } from './utils/speechEngine';
import { buildPersonalRoadmap } from './utils/roadmap';
import { OnboardingModal } from './components/OnboardingModal';
import { DashboardView } from './components/DashboardView';
import { LessonPlayer } from './components/LessonPlayer';
import { WeeklyTestView } from './components/WeeklyTestView';
import { CustomLessonModal } from './components/CustomLessonModal';
import { ProfileManagerModal } from './components/ProfileManagerModal';
import { GameArenaView } from './components/GameArenaView';

export function App() {
  const [store, setStore] = useState<MultiProfileStore>(() => loadMultiProfileStore());
  const [activeLesson, setActiveLesson] = useState<Lesson | null>(null);
  const [activeTestWeek, setActiveTestWeek] = useState<1 | 2 | 3 | 4 | null>(null);
  const [showGameArena, setShowGameArena] = useState(false);
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

  useEffect(() => {
    setDefaultVoicePreset(progress.profile.voicePreset);
  }, [progress.profile.voicePreset]);

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

  const handleOnboardingComplete = ({
    level,
    rank,
    profileUpdates,
  }: {
    level: LevelTier;
    rank: RankTitle;
    profileUpdates: Partial<UserProfileConfig>;
  }) => {
    updateActiveProgress((prev) => ({
      ...prev,
      onboarded: true,
      selectedLevel: level,
      rank,
      profile: {
        ...prev.profile,
        ...profileUpdates,
      },
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
  const personalizedLessons = buildPersonalRoadmap(progress, ALL_LESSONS);

  return (
    <main
      data-ui-theme={activeTheme}
      className="theme-surface min-h-screen bg-slate-50 px-4 py-6 text-slate-900 transition-colors sm:px-6 lg:px-8"
    >
      {showOnboarding ? (
        <OnboardingModal
          initialProfile={progress.profile}
          initialLevel={progress.selectedLevel}
          onComplete={handleOnboardingComplete}
        />
      ) : activeLesson ? (
        <LessonPlayer
          lesson={activeLesson}
          savedWords={(progress.savedWords ?? []).map((w) => w.word)}
          voicePreset={progress.profile.voicePreset}
          onChangeVoice={(voicePreset) =>
            setStore((prev) =>
              updateProfileInStore(prev, prev.activeProfileId, { voicePreset })
            )
          }
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
      ) : showGameArena ? (
        <GameArenaView
          lessons={personalizedLessons.slice(0, 12)}
          gameXp={progress.gameXp ?? 0}
          gameBest={progress.gameBest ?? {}}
          voicePreset={progress.profile.voicePreset}
          onFinishGame={(gameId, score) =>
            updateActiveProgress((prev) => recordGameResult(prev, gameId, score))
          }
          onBack={() => setShowGameArena(false)}
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
          onOpenGameArena={() => setShowGameArena(true)}
          onOpenCustomModal={() => setShowCustomModal(true)}
          onOpenProfileModal={() => setShowProfileModal(true)}
          onChangeTheme={(theme) =>
            setStore((prev) =>
              updateProfileInStore(prev, prev.activeProfileId, { theme })
            )
          }
          onChangeVoice={(voicePreset) =>
            setStore((prev) =>
              updateProfileInStore(prev, prev.activeProfileId, { voicePreset })
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
            setShowGameArena(false);
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
