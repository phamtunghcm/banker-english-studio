import { useState, type ChangeEvent } from 'react';
import {
  Award,
  Bookmark,
  BookOpen,
  CheckCircle2,
  Coffee,
  Copy,
  Cpu,
  Download,
  FilePlus2,
  FileSpreadsheet,
  Flame,
  Landmark,
  Link2,
  Palette,
  Plane,
  RotateCcw,
  Scale,
  Send,
  Settings2,
  ShieldCheck,
  Sparkles,
  Trash2,
  Trophy,
  Upload,
  UserCog,
  Volume2,
  X,
} from 'lucide-react';
import type { LearningGoal, Lesson, Track, UiThemeId, UserProgress } from '../types/curriculum';
import { computeTrackStats, isLessonMastered } from '../utils/progressStore';
import { CURATED_FEMALE_VOICES, speakSentence } from '../utils/speechEngine';
import { buildPersonalRoadmap, getLessonsPerDay } from '../utils/roadmap';
import { xpToLevel } from '../utils/games';
import { UI_THEMES } from '../data/themes';
import {
  buildHrCsvContent,
  GOOGLE_APPS_SCRIPT_TEMPLATE,
  isValidAppsScriptUrl,
  loadHrWebhookUrl,
  saveHrWebhookUrl,
  syncProgressToHrSheet,
} from '../utils/hrSync';

interface DashboardViewProps {
  progress: UserProgress;
  lessons: Lesson[];
  electiveLessons: Lesson[];
  onSelectLesson: (lesson: Lesson) => void;
  onStartWeeklyTest: (week: 1 | 2 | 3 | 4) => void;
  onOpenCustomModal: () => void;
  onOpenProfileModal: () => void;
  onChangeTheme: (theme: UiThemeId) => void;
  onChangeVoice: (voiceId: string) => void;
  onRemoveSavedWord: (word: string) => void;
  onExportJson: () => void;
  onImportJson: (raw: string) => void;
  onReopenOnboarding: () => void;
}

type DashboardTab = 'today' | 'topics' | 'progress';

const GOAL_LABELS: Record<LearningGoal, string> = {
  executive_meeting: 'Họp & Thuyết trình',
  credit_committee: 'Thẩm định Tín dụng',
  fintech_it: 'Dự án Fintech / IT',
  travel_daily: 'Công tác & Đời sống',
};

const TRACK_META: Record<
  Track,
  { label: string; shortLabel: string; color: string; icon: typeof Landmark }
> = {
  finance: { label: 'Tài chính', shortLabel: 'Tài chính', color: 'bg-emerald-600', icon: Landmark },
  credit: { label: 'Tín dụng', shortLabel: 'Tín dụng', color: 'bg-amber-500', icon: ShieldCheck },
  tech: { label: 'CNTT & Fintech', shortLabel: 'CNTT', color: 'bg-sky-600', icon: Cpu },
  legal: { label: 'Pháp chế', shortLabel: 'Pháp chế', color: 'bg-violet-600', icon: Scale },
  travel: { label: 'Du lịch', shortLabel: 'Du lịch', color: 'bg-cyan-600', icon: Plane },
  daily: { label: 'Đời sống', shortLabel: 'Đời sống', color: 'bg-rose-600', icon: Coffee },
};

export function DashboardView({
  progress,
  lessons,
  electiveLessons,
  onSelectLesson,
  onStartWeeklyTest,
  onOpenCustomModal,
  onOpenProfileModal,
  onChangeTheme,
  onChangeVoice,
  onRemoveSavedWord,
  onExportJson,
  onImportJson,
  onReopenOnboarding,
}: DashboardViewProps) {
  const [activeTab, setActiveTab] = useState<DashboardTab>('today');
  const [topicFilter, setTopicFilter] = useState<'all' | Track>('all');
  const [selectedWeek, setSelectedWeek] = useState<1 | 2 | 3 | 4>(1);
  const [showSettings, setShowSettings] = useState(false);
  const [importStatus, setImportStatus] = useState<string | null>(null);
  const [hrWebhookUrl, setHrWebhookUrl] = useState<string>(() => loadHrWebhookUrl());
  const [hrSyncStatus, setHrSyncStatus] = useState<string | null>(null);
  const [isSyncingHr, setIsSyncingHr] = useState(false);

  const allPool = [...lessons, ...electiveLessons];
  const personalRoadmap = buildPersonalRoadmap(progress, allPool);
  const dailyTargetCount = getLessonsPerDay(progress.profile.dailyMinutesTarget);
  const nextLessons = personalRoadmap.filter(
    (l) => !isLessonMastered(progress.completedLessons[l.id])
  );
  const heroLesson = nextLessons[0] ?? personalRoadmap[0];
  const upNextLessons = nextLessons.slice(1, 4);

  const trackStats = computeTrackStats(progress, allPool);
  const completedCount = lessons.filter((l) =>
    isLessonMastered(progress.completedLessons[l.id])
  ).length;
  const monthlyPercent =
    lessons.length === 0 ? 0 : Math.round((completedCount / lessons.length) * 100);
  const gameLevel = xpToLevel(progress.gameXp ?? 0);
  const activeVoice = progress.profile.voicePreset ?? CURATED_FEMALE_VOICES[0].id;
  const savedWords = progress.savedWords ?? [];
  const customLessons = progress.customLessons ?? [];

  const handleFileImport = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        onImportJson(reader.result);
        setImportStatus('Đã khôi phục tiến độ từ file JSON.');
      }
    };
    reader.readAsText(file);
  };

  const handleExportCsv = () => {
    const csv = buildHrCsvContent(progress, lessons.length);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `bao-cao-tieng-anh-${progress.profile.id}-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleSyncHr = async () => {
    saveHrWebhookUrl(hrWebhookUrl);
    setIsSyncingHr(true);
    setHrSyncStatus(null);
    const res = await syncProgressToHrSheet(hrWebhookUrl, progress, lessons.length);
    setHrSyncStatus(res.message);
    setIsSyncingHr(false);
  };

  const handleCopyShareLink = async () => {
    if (!isValidAppsScriptUrl(hrWebhookUrl)) {
      setHrSyncStatus('Hãy dán đúng link Google Apps Script (/exec) trước khi tạo link chia sẻ.');
      return;
    }
    saveHrWebhookUrl(hrWebhookUrl);
    const base = `${window.location.origin}${window.location.pathname}`;
    const shareUrl = `${base}?hr_webhook=${encodeURIComponent(hrWebhookUrl.trim())}`;
    try {
      await navigator.clipboard.writeText(shareUrl);
      setHrSyncStatus('Đã sao chép link nội bộ gắn sẵn Google Sheet HR — gửi link này cho nhân sự dùng ngay!');
    } catch {
      setHrSyncStatus(`Link chia sẻ: ${shareUrl}`);
    }
  };

  const handleCopyScript = async () => {
    try {
      await navigator.clipboard.writeText(GOOGLE_APPS_SCRIPT_TEMPLATE);
      setHrSyncStatus('Đã sao chép mã Google Apps Script! Dán vào Extensions → Apps Script trong Google Sheet rồi Deploy Web App.');
    } catch {
      setHrSyncStatus('Không thể copy tự động — bạn có thể lấy mã trong file docs/google-apps-script-hr-sync.gs.');
    }
  };

  const filteredTopics = allPool.filter(
    (l) => topicFilter === 'all' || l.track === topicFilter
  );

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      {/* Minimal Focused Top Bar */}
      <header className="flex items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
        <button
          type="button"
          onClick={onOpenProfileModal}
          className="flex min-w-0 items-center gap-3 text-left"
        >
          <span
            className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-sm font-extrabold text-white ${progress.profile.avatarColor}`}
          >
            {progress.profile.name.slice(0, 1).toUpperCase()}
          </span>
          <div className="min-w-0">
            <p className="truncate text-sm font-extrabold text-slate-900">
              {progress.profile.name}
            </p>
            <p className="truncate text-xs font-semibold text-slate-600">
              {progress.rank} • 🔥 {progress.streakDays} ngày • Lv.{gameLevel.level}
            </p>
          </div>
        </button>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onReopenOnboarding}
            className="hidden rounded-xl border border-emerald-300 bg-emerald-50 px-3 py-1.5 text-xs font-bold text-emerald-800 hover:bg-emerald-100 sm:inline-flex sm:items-center sm:gap-1.5"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            Lộ trình & Test
          </button>
          <button
            type="button"
            onClick={() => setShowSettings((v) => !v)}
            className={`inline-flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-bold transition ${
              showSettings
                ? 'border-emerald-600 bg-emerald-600 text-white'
                : 'border-slate-300 bg-white text-slate-800 hover:bg-slate-100'
            }`}
          >
            {showSettings ? <X className="h-3.5 w-3.5" /> : <Settings2 className="h-3.5 w-3.5" />}
            Tùy chỉnh
          </button>
        </div>
      </header>

      {/* Collapsible Settings Drawer (Theme + 5 Voices + Profile + Backup) */}
      {showSettings && (
        <div className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-md">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-extrabold text-slate-900">
              Cài đặt Giọng đọc, Giao diện & Tài khoản
            </h2>
            <button
              type="button"
              onClick={() => setShowSettings(false)}
              className="text-xs font-bold text-slate-500 hover:text-slate-900"
            >
              Thu gọn
            </button>
          </div>

          {/* 5 Female Voices */}
          <div className="space-y-1.5">
            <label className="flex items-center gap-1.5 text-xs font-bold text-slate-700">
              <Volume2 className="h-3.5 w-3.5 text-emerald-600" />
              Giọng nữ Neural truyền cảm (5 giọng):
            </label>
            <div className="flex flex-wrap items-center gap-2">
              <select
                aria-label="Chọn giọng đọc toàn hệ thống"
                value={activeVoice}
                onChange={(e) => onChangeVoice(e.target.value)}
                className="min-w-0 flex-1 rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-bold text-slate-900"
              >
                {CURATED_FEMALE_VOICES.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.label}
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={() =>
                  speakSentence(
                    'Hello! Welcome to FinTech Banker English Studio. Let us practice speaking naturally today.',
                    1.0,
                    {},
                    activeVoice,
                    'expressive',
                    'preview'
                  )
                }
                className="rounded-xl border border-emerald-300 bg-emerald-50 px-3.5 py-2 text-xs font-bold text-emerald-800 hover:bg-emerald-100"
              >
                Thử giọng
              </button>
            </div>
          </div>

          {/* 5 UI Themes */}
          <div className="space-y-1.5">
            <span className="flex items-center gap-1.5 text-xs font-bold text-slate-700">
              <Palette className="h-3.5 w-3.5 text-emerald-600" />
              Giao diện (5 tùy chọn):
            </span>
            <div className="flex flex-wrap gap-1.5">
              {UI_THEMES.map((t) => {
                const active = (progress.profile.theme ?? 'crisp-light') === t.id;
                return (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => onChangeTheme(t.id)}
                    className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-bold ${
                      active
                        ? 'border-emerald-600 bg-emerald-50 text-emerald-900 ring-1 ring-emerald-600'
                        : 'border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100'
                    }`}
                  >
                    <span className={`h-3 w-3 rounded-full border ${t.swatchClass}`} />
                    {t.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Quick Actions */}
          <div className="flex flex-wrap gap-2 border-t border-slate-200 pt-3">
            <button
              type="button"
              onClick={() => {
                setShowSettings(false);
                onOpenProfileModal();
              }}
              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-300 bg-white px-3 py-1.5 text-xs font-bold text-slate-800 hover:bg-slate-100"
            >
              <UserCog className="h-3.5 w-3.5" />
              Đổi tài khoản
            </button>
            <button
              type="button"
              onClick={() => {
                setShowSettings(false);
                onReopenOnboarding();
              }}
              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-300 bg-white px-3 py-1.5 text-xs font-bold text-slate-800 hover:bg-slate-100"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              Thiết lập lộ trình & Test
            </button>
            <button
              type="button"
              onClick={() => {
                setShowSettings(false);
                onOpenCustomModal();
              }}
              className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-emerald-700"
            >
              <FilePlus2 className="h-3.5 w-3.5" />
              Tạo bài từ tài liệu
            </button>
            <button
              type="button"
              onClick={onExportJson}
              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-300 bg-white px-3 py-1.5 text-xs font-bold text-slate-800 hover:bg-slate-100"
            >
              <Download className="h-3.5 w-3.5" />
              Export JSON
            </button>
            <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-xl border border-slate-300 bg-white px-3 py-1.5 text-xs font-bold text-slate-800 hover:bg-slate-100">
              <Upload className="h-3.5 w-3.5" />
              Import JSON
              <input type="file" accept=".json" onChange={handleFileImport} className="hidden" />
            </label>
          </div>
        </div>
      )}

      {importStatus && (
        <div className="rounded-xl border border-emerald-300 bg-emerald-50 px-4 py-2 text-xs font-bold text-emerald-800">
          {importStatus}
        </div>
      )}

      {/* Clean 3-Tab Navigation */}
      <nav className="grid grid-cols-3 gap-2 rounded-2xl border border-slate-200 bg-white p-1.5 shadow-sm">
        {[
          { id: 'today', label: 'Học hôm nay', icon: Sparkles },
          { id: 'topics', label: 'Chủ đề & Tuần', icon: BookOpen },
          { id: 'progress', label: 'Tiến độ & Từ khó', icon: Award },
        ].map((tab) => {
          const Icon = tab.icon;
          const active = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id as DashboardTab)}
              className={`flex items-center justify-center gap-1.5 rounded-xl py-2.5 text-xs font-extrabold transition sm:text-sm ${
                active
                  ? 'bg-emerald-600 text-white shadow-sm'
                  : 'text-slate-700 hover:bg-slate-100'
              }`}
            >
              <Icon className="h-4 w-4" />
              {tab.label}
            </button>
          );
        })}
      </nav>

      {/* TAB 1: FOCUSED TODAY VIEW */}
      {activeTab === 'today' && heroLesson && (
        <div className="space-y-4">
          {/* Single Hero Lesson Card */}
          <div className="rounded-2xl border-2 border-emerald-500 bg-white p-6 shadow-md">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-100 px-3 py-1 text-xs font-extrabold text-emerald-900">
                <Sparkles className="h-3.5 w-3.5" />
                Bài học trọng tâm hôm nay • {TRACK_META[heroLesson.track].shortLabel}
              </span>
              <span className="text-xs font-bold text-slate-600">
                Mục tiêu: {dailyTargetCount} bài ({progress.profile.dailyMinutesTarget}p)
              </span>
            </div>

            <h1 className="mt-3 text-2xl font-extrabold text-slate-900">{heroLesson.title}</h1>
            <p className="mt-1 text-sm font-medium text-slate-600">{heroLesson.scenario}</p>

            <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 pt-4">
              <div className="text-xs font-semibold text-slate-600">
                Gồm 5 bước: Phụ đề • Shadowing sửa từng chữ • Chính tả • Điền từ • Mini-Game
              </div>
              <button
                type="button"
                onClick={() => onSelectLesson(heroLesson)}
                className="w-full rounded-xl bg-emerald-600 px-6 py-3 text-sm font-extrabold text-white shadow-sm hover:bg-emerald-700 sm:w-auto"
              >
                Bắt đầu học ngay →
              </button>
            </div>
          </div>

          {/* Up Next (Max 3 focused items) */}
          {upNextLessons.length > 0 && (
            <div className="space-y-2.5 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-extrabold text-slate-900">
                  Tiếp theo trong lộ trình ({GOAL_LABELS[progress.profile.goal]})
                </h2>
                <button
                  type="button"
                  onClick={() => setActiveTab('topics')}
                  className="text-xs font-bold text-emerald-700 hover:underline"
                >
                  Xem tất cả →
                </button>
              </div>
              <div className="divide-y divide-slate-100">
                {upNextLessons.map((lesson) => (
                  <button
                    key={lesson.id}
                    type="button"
                    onClick={() => onSelectLesson(lesson)}
                    className="flex w-full items-center justify-between gap-3 py-3 text-left transition hover:bg-slate-50"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-bold text-slate-900">{lesson.title}</p>
                      <p className="truncate text-xs font-medium text-slate-600">
                        {TRACK_META[lesson.track].shortLabel} • {lesson.scenario}
                      </p>
                    </div>
                    <span className="shrink-0 rounded-lg border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-bold text-emerald-700">
                      Học →
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Compact Weekly Test Shortcut */}
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-amber-300 bg-amber-50 p-4">
            <div className="flex items-center gap-3">
              <Trophy className="h-6 w-6 shrink-0 text-amber-600" />
              <div>
                <p className="text-sm font-extrabold text-slate-900">
                  Bài kiểm tra xếp hạng Tuần {selectedWeek}
                </p>
                <p className="text-xs font-medium text-slate-700">
                  Đạt ≥ 75% để thăng hạng tiếp theo từ {progress.rank}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => onStartWeeklyTest(selectedWeek)}
              className="rounded-xl bg-amber-500 px-4 py-2 text-xs font-extrabold text-slate-950 hover:bg-amber-400"
            >
              Thi xếp hạng →
            </button>
          </div>
        </div>
      )}

      {/* TAB 2: TOPICS & WEEKLY ROADMAP */}
      {activeTab === 'topics' && (
        <div className="space-y-4">
          {/* Topic Filter Pills */}
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <p className="mb-2.5 text-xs font-extrabold uppercase tracking-wider text-slate-500">
              Chọn chủ đề tập trung
            </p>
            <div className="flex flex-wrap gap-1.5">
              <button
                type="button"
                onClick={() => setTopicFilter('all')}
                className={`rounded-full border px-3 py-1.5 text-xs font-bold ${
                  topicFilter === 'all'
                    ? 'border-emerald-600 bg-emerald-600 text-white'
                    : 'border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100'
                }`}
              >
                Tất cả ({allPool.length})
              </button>
              {(['finance', 'credit', 'tech', 'legal', 'travel', 'daily'] as Track[]).map((tr) => (
                <button
                  key={tr}
                  type="button"
                  onClick={() => setTopicFilter(tr)}
                  className={`rounded-full border px-3 py-1.5 text-xs font-bold ${
                    topicFilter === tr
                      ? 'border-emerald-600 bg-emerald-600 text-white'
                      : 'border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100'
                  }`}
                >
                  {TRACK_META[tr].shortLabel}
                </button>
              ))}
            </div>
          </div>

          {/* Focused Lesson List */}
          <div className="space-y-2.5">
            {filteredTopics.map((lesson) => {
              const record = progress.completedLessons[lesson.id];
              const mastered = isLessonMastered(record);
              const meta = TRACK_META[lesson.track];
              return (
                <button
                  key={lesson.id}
                  type="button"
                  onClick={() => onSelectLesson(lesson)}
                  className="flex w-full items-center justify-between gap-4 rounded-2xl border border-slate-200 bg-white p-4 text-left shadow-sm transition hover:border-emerald-500"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="rounded-md bg-slate-100 px-2 py-0.5 text-[11px] font-bold text-slate-800">
                        {meta.shortLabel}
                      </span>
                      {mastered && (
                        <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700">
                          <CheckCircle2 className="h-3.5 w-3.5" />
                          Đạt KPI ({record.shadowingBest}%)
                        </span>
                      )}
                    </div>
                    <h3 className="mt-1 truncate text-sm font-extrabold text-slate-900">
                      {lesson.title}
                    </h3>
                    <p className="truncate text-xs font-medium text-slate-600">{lesson.scenario}</p>
                  </div>
                  <span className="shrink-0 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-bold text-emerald-800">
                    Học →
                  </span>
                </button>
              );
            })}
          </div>

          {/* Weekly Tests Bar */}
          <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
            <p className="mb-2 text-xs font-extrabold uppercase text-amber-900">
              Bài thi xếp hạng cuối tuần (Ngày 7, 14, 21, 28)
            </p>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {([1, 2, 3, 4] as const).map((w) => {
                const rec = progress.weeklyTestScores[w];
                return (
                  <button
                    key={w}
                    type="button"
                    onClick={() => {
                      setSelectedWeek(w);
                      onStartWeeklyTest(w);
                    }}
                    className="rounded-xl border border-amber-300 bg-white px-3 py-2 text-left text-xs font-bold text-slate-900 hover:bg-amber-100"
                  >
                    <p>Thi Tuần {w}</p>
                    <p className="text-[11px] font-semibold text-amber-800">
                      {rec ? `${rec.score}% (${rec.passed ? 'Đạt' : 'Thử lại'})` : 'Chưa thi'}
                    </p>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: PROGRESS, SAVED WORDS & CUSTOM LESSONS */}
      {activeTab === 'progress' && (
        <div className="space-y-4">
          {/* Compact KPI Summary */}
          <div className="grid grid-cols-3 gap-3">
            <div className="rounded-2xl border border-slate-200 bg-white p-4 text-center shadow-sm">
              <Flame className="mx-auto h-5 w-5 text-orange-500" />
              <p className="mt-1 text-xl font-extrabold text-slate-900">{progress.streakDays}</p>
              <p className="text-[11px] font-bold text-slate-600">Ngày liên tiếp</p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white p-4 text-center shadow-sm">
              <Award className="mx-auto h-5 w-5 text-emerald-600" />
              <p className="mt-1 text-xl font-extrabold text-slate-900">{monthlyPercent}%</p>
              <p className="text-[11px] font-bold text-slate-600">Lộ trình 28 ngày</p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white p-4 text-center shadow-sm">
              <Trophy className="mx-auto h-5 w-5 text-amber-500" />
              <p className="mt-1 text-xl font-extrabold text-slate-900">{progress.gameXp ?? 0}</p>
              <p className="text-[11px] font-bold text-slate-600">XP (Lv.{gameLevel.level})</p>
            </div>
          </div>

          {/* 6 Tracks Progress */}
          <div className="space-y-3 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="text-sm font-extrabold text-slate-900">Tiến độ theo từng lĩnh vực</h2>
            <div className="grid gap-3 sm:grid-cols-2">
              {(['finance', 'credit', 'tech', 'legal', 'travel', 'daily'] as Track[]).map((tr) => {
                const meta = TRACK_META[tr];
                const stat = trackStats[tr];
                return (
                  <div key={tr} className="space-y-1">
                    <div className="flex justify-between text-xs font-bold text-slate-800">
                      <span>{meta.label}</span>
                      <span>
                        {stat.completed}/{stat.total} ({stat.percent}%)
                      </span>
                    </div>
                    <div className="h-2 w-full overflow-hidden rounded-full bg-slate-200">
                      <div className={`h-full ${meta.color}`} style={{ width: `${stat.percent}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Custom Lessons */}
          <div className="space-y-3 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-extrabold text-slate-900">
                Bài học tự tạo ({customLessons.length})
              </h2>
              <button
                type="button"
                onClick={onOpenCustomModal}
                className="inline-flex items-center gap-1 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-emerald-700"
              >
                <FilePlus2 className="h-3.5 w-3.5" />
                Tạo mới
              </button>
            </div>
            {customLessons.length === 0 ? (
              <p className="text-xs font-medium text-slate-500">
                Chưa có bài tự tạo — bấm "Tạo mới" để dán email hoặc kịch bản họp của bạn vào luyện.
              </p>
            ) : (
              <div className="space-y-2">
                {customLessons.map((cl) => (
                  <button
                    key={cl.id}
                    type="button"
                    onClick={() => onSelectLesson(cl)}
                    className="flex w-full items-center justify-between rounded-xl border border-slate-200 bg-slate-50 p-3 text-left hover:border-emerald-500"
                  >
                    <div>
                      <p className="text-sm font-bold text-slate-900">{cl.title}</p>
                      <p className="text-xs text-slate-600">{cl.sentences.length} câu</p>
                    </div>
                    <span className="text-xs font-bold text-emerald-700">Luyện →</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* HR Google Sheet Sync (0đ/tháng) */}
          <div className="space-y-3 rounded-2xl border border-emerald-200 bg-white p-5 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <FileSpreadsheet className="h-4 w-4 text-emerald-700" />
                <h2 className="text-sm font-extrabold text-slate-900">
                  Đồng bộ Báo cáo HR (Google Sheet — 0đ/tháng)
                </h2>
              </div>
              <button
                type="button"
                onClick={handleExportCsv}
                className="inline-flex items-center gap-1 rounded-lg border border-slate-300 bg-slate-50 px-2.5 py-1 text-xs font-bold text-slate-800 hover:bg-slate-100"
              >
                <Download className="h-3.5 w-3.5" />
                Xuất Excel / CSV
              </button>
            </div>

            <p className="text-xs font-medium text-slate-600">
              Dán URL Web App từ Google Apps Script để gửi điểm tuần, Streak & Xếp hạng về bảng tổng hợp HR (tự động gửi khi thi xong mỗi tuần).
            </p>

            <div className="flex flex-col gap-2 sm:flex-row">
              <input
                type="url"
                value={hrWebhookUrl}
                onChange={(e) => setHrWebhookUrl(e.target.value)}
                onBlur={() => saveHrWebhookUrl(hrWebhookUrl)}
                placeholder="https://script.google.com/macros/s/.../exec"
                className="flex-1 rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-900 placeholder-slate-400 focus:border-emerald-600 focus:outline-none"
              />
              <button
                type="button"
                disabled={isSyncingHr}
                onClick={() => void handleSyncHr()}
                className="inline-flex shrink-0 items-center justify-center gap-1.5 rounded-xl bg-emerald-600 px-4 py-2 text-xs font-bold text-white hover:bg-emerald-700 disabled:opacity-50"
              >
                <Send className="h-3.5 w-3.5" />
                {isSyncingHr ? 'Đang gửi...' : 'Gửi báo cáo ngay'}
              </button>
            </div>

            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => void handleCopyScript()}
                className="inline-flex items-center gap-1 rounded-lg border border-slate-300 bg-slate-50 px-2.5 py-1 text-[11px] font-bold text-slate-700 hover:bg-slate-100"
              >
                <Copy className="h-3 w-3" />
                Copy mã Google Apps Script
              </button>
              <button
                type="button"
                onClick={() => void handleCopyShareLink()}
                className="inline-flex items-center gap-1 rounded-lg border border-emerald-300 bg-emerald-50 px-2.5 py-1 text-[11px] font-bold text-emerald-800 hover:bg-emerald-100"
              >
                <Link2 className="h-3 w-3" />
                Copy link nội bộ cho nhân sự
              </button>
            </div>

            {hrSyncStatus && (
              <p className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-bold text-emerald-900">
                {hrSyncStatus}
              </p>
            )}
          </div>

          {/* Saved Key Terms */}
          <div className="space-y-3 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center gap-2">
              <Bookmark className="h-4 w-4 text-amber-600" />
              <h2 className="text-sm font-extrabold text-slate-900">
                Kho từ khó đã lưu ({savedWords.length})
              </h2>
            </div>
            {savedWords.length === 0 ? (
              <p className="text-xs font-medium text-slate-500">
                Bấm biểu tượng đánh dấu cạnh các thuật ngữ trong bài học để lưu vào đây ôn lại.
              </p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {savedWords.map((sw) => (
                  <div
                    key={sw.word}
                    className="inline-flex items-center gap-2 rounded-xl border border-slate-300 bg-slate-50 px-3 py-1.5 text-xs"
                  >
                    <button
                      type="button"
                      onClick={() => speakSentence(sw.word, 0.85)}
                      className="inline-flex items-center gap-1 font-bold text-sky-800 hover:text-sky-950"
                      title={sw.contextSentence}
                    >
                      <Volume2 className="h-3.5 w-3.5" />
                      {sw.word}
                    </button>
                    <button
                      type="button"
                      onClick={() => onRemoveSavedWord(sw.word)}
                      className="text-slate-500 hover:text-rose-600"
                      title="Xóa khỏi danh sách"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
