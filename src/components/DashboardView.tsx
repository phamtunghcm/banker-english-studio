import { useState, type ChangeEvent } from 'react';
import {
  Award,
  Bookmark,
  BookOpen,
  CheckCircle2,
  Coffee,
  Cpu,
  Download,
  FilePlus2,
  Flame,
  Landmark,
  Palette,
  Plane,
  RotateCcw,
  Scale,
  ShieldCheck,
  Trash2,
  Trophy,
  Upload,
  UserCog,
  Volume2,
} from 'lucide-react';
import type { LearningGoal, Lesson, Track, UiThemeId, UserProgress } from '../types/curriculum';
import { computeTrackStats, isLessonMastered } from '../utils/progressStore';
import { speakSentence } from '../utils/speechEngine';
import { UI_THEMES } from '../data/themes';

interface DashboardViewProps {
  progress: UserProgress;
  lessons: Lesson[];
  electiveLessons: Lesson[];
  onSelectLesson: (lesson: Lesson) => void;
  onStartWeeklyTest: (week: 1 | 2 | 3 | 4) => void;
  onOpenCustomModal: () => void;
  onOpenProfileModal: () => void;
  onChangeTheme: (theme: UiThemeId) => void;
  onRemoveSavedWord: (word: string) => void;
  onExportJson: () => void;
  onImportJson: (raw: string) => void;
  onReopenOnboarding: () => void;
}

const GOAL_LABELS: Record<LearningGoal, string> = {
  executive_meeting: 'Họp & Thuyết trình',
  credit_committee: 'Thẩm định Tín dụng',
  fintech_it: 'Dự án Fintech / IT',
  travel_daily: 'Công tác & Đời sống',
};

const WEEK_TITLES: Record<1 | 2 | 3 | 4, string> = {
  1: 'Tuần 1: Tài chính & Vận hành Ngân hàng',
  2: 'Tuần 2: Tín dụng & Quản trị Rủi ro',
  3: 'Tuần 3: Công nghệ Ngân hàng & Fintech',
  4: 'Tuần 4: Giao tiếp & Thuyết trình Cấp cao',
};

const TRACK_META: Record<
  Track,
  { label: string; shortLabel: string; color: string; icon: typeof Landmark }
> = {
  finance: { label: 'Tài chính (Finance)', shortLabel: 'Tài chính', color: 'bg-emerald-600', icon: Landmark },
  credit: { label: 'Tín dụng (Credit)', shortLabel: 'Tín dụng', color: 'bg-amber-500', icon: ShieldCheck },
  tech: { label: 'CNTT & Fintech', shortLabel: 'CNTT', color: 'bg-sky-600', icon: Cpu },
  legal: { label: 'Pháp chế (Legal)', shortLabel: 'Pháp chế', color: 'bg-violet-600', icon: Scale },
  travel: { label: 'Du lịch & Công tác', shortLabel: 'Du lịch', color: 'bg-cyan-600', icon: Plane },
  daily: { label: 'Đời sống hàng ngày', shortLabel: 'Đời sống', color: 'bg-rose-600', icon: Coffee },
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
  onRemoveSavedWord,
  onExportJson,
  onImportJson,
  onReopenOnboarding,
}: DashboardViewProps) {
  const [selectedWeek, setSelectedWeek] = useState<1 | 2 | 3 | 4>(1);
  const [onlyMyTracks, setOnlyMyTracks] = useState(false);
  const [electiveFilter, setElectiveFilter] = useState<'all' | 'legal' | 'travel' | 'daily' | 'tech'>('all');
  const [importStatus, setImportStatus] = useState<string | null>(null);

  const trackStats = computeTrackStats(progress, lessons);
  const completedCount = lessons.filter((l) =>
    isLessonMastered(progress.completedLessons[l.id])
  ).length;
  const totalLessons = lessons.length;
  const monthlyPercent = totalLessons === 0 ? 0 : Math.round((completedCount / totalLessons) * 100);

  const weekLessons = lessons.filter((l) => l.week === selectedWeek);
  const weekCompleted = weekLessons.filter((l) =>
    isLessonMastered(progress.completedLessons[l.id])
  ).length;
  const weeklyTestRecord = progress.weeklyTestScores[selectedWeek];
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

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      {/* Top Bar with Active User Profile */}
      <header className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex items-center gap-3.5">
          <button
            type="button"
            onClick={onOpenProfileModal}
            className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl text-lg font-extrabold text-white shadow-sm transition hover:scale-105 ${progress.profile.avatarColor}`}
            title="Quản lý & Tùy biến tài khoản"
          >
            {progress.profile.name.slice(0, 1).toUpperCase()}
          </button>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-base font-extrabold text-slate-900">
                {progress.profile.name}
              </span>
              <span className="rounded-md border border-slate-200 bg-slate-100 px-2 py-0.5 text-[11px] font-bold text-slate-700">
                {progress.profile.roleTitle}
              </span>
              <span className="rounded-md border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[11px] font-bold text-emerald-800">
                Mục tiêu: {GOAL_LABELS[progress.profile.goal]} • {progress.profile.dailyMinutesTarget}p/ngày
              </span>
            </div>
            <h1 className="mt-1 text-xl font-extrabold text-slate-900">
              FinTech Banker English Studio
            </h1>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={onOpenProfileModal}
            className="inline-flex items-center gap-1.5 rounded-xl border border-emerald-600 bg-emerald-50 px-3.5 py-2 text-xs font-bold text-emerald-800 hover:bg-emerald-100"
          >
            <UserCog className="h-3.5 w-3.5" />
            Tài khoản & Tùy biến
          </button>
          <button
            type="button"
            onClick={onOpenCustomModal}
            className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-3.5 py-2 text-xs font-bold text-white shadow-sm hover:bg-emerald-700"
          >
            <FilePlus2 className="h-3.5 w-3.5" />
            Tạo bài từ tài liệu
          </button>
          <button
            type="button"
            onClick={onReopenOnboarding}
            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-bold text-slate-800 hover:bg-slate-100"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            Đổi trình độ / Test lại
          </button>
          <button
            type="button"
            onClick={onExportJson}
            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-bold text-slate-800 hover:bg-slate-100"
          >
            <Download className="h-3.5 w-3.5" />
            Export JSON
          </button>
          <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-bold text-slate-800 hover:bg-slate-100">
            <Upload className="h-3.5 w-3.5" />
            Import JSON
            <input type="file" accept=".json" onChange={handleFileImport} className="hidden" />
          </label>
        </div>
      </header>

      {importStatus && (
        <div className="rounded-xl border border-emerald-300 bg-emerald-50 px-4 py-2 text-xs font-bold text-emerald-800">
          {importStatus}
        </div>
      )}

      {/* 5 UI Theme Options Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
        <span className="inline-flex items-center gap-2 text-xs font-bold text-slate-700">
          <Palette className="h-4 w-4 text-emerald-600" />
          Giao diện (5 tùy chọn):
        </span>
        <div className="flex flex-wrap gap-2">
          {UI_THEMES.map((t) => {
            const active = (progress.profile.theme ?? 'crisp-light') === t.id;
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => onChangeTheme(t.id)}
                className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-bold transition ${
                  active
                    ? 'border-emerald-600 bg-emerald-50 text-emerald-900 ring-1 ring-emerald-600'
                    : 'border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100'
                }`}
              >
                <span className={`h-3.5 w-3.5 rounded-full border ${t.swatchClass}`} />
                {t.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* KPI Cards */}
      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between text-slate-600">
            <span className="text-xs font-bold">Xếp hạng hiện tại</span>
            <Trophy className="h-4 w-4 text-amber-600" />
          </div>
          <p className="mt-2 text-lg font-extrabold text-slate-900">{progress.rank}</p>
          <p className="mt-1 text-xs font-medium text-slate-600">Cấp độ: {progress.selectedLevel}</p>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between text-slate-600">
            <span className="text-xs font-bold">Chuỗi học hàng ngày</span>
            <Flame className="h-4 w-4 text-orange-600" />
          </div>
          <p className="mt-2 text-lg font-extrabold text-slate-900">{progress.streakDays} ngày</p>
          <p className="mt-1 text-xs font-medium text-slate-600">KPI: ≥ 75% điểm bài học</p>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between text-slate-600">
            <span className="text-xs font-bold">Tiến độ Tuần {selectedWeek}</span>
            <BookOpen className="h-4 w-4 text-emerald-600" />
          </div>
          <p className="mt-2 text-lg font-extrabold text-slate-900">
            {weekCompleted} / {weekLessons.length} bài đạt KPI
          </p>
          <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-slate-200">
            <div
              className="h-full bg-emerald-600 transition-all"
              style={{
                width: `${Math.round((weekCompleted / Math.max(1, weekLessons.length)) * 100)}%`,
              }}
            />
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between text-slate-600">
            <span className="text-xs font-bold">Lộ trình Tháng (28 ngày)</span>
            <Award className="h-4 w-4 text-sky-600" />
          </div>
          <p className="mt-2 text-lg font-extrabold text-slate-900">{monthlyPercent}% hoàn thành</p>
          <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-slate-200">
            <div
              className="h-full bg-sky-600 transition-all"
              style={{ width: `${monthlyPercent}%` }}
            />
          </div>
        </div>
      </section>

      {/* 3 Tracks Mastery */}
      <section className="grid gap-4 md:grid-cols-3">
        {(['finance', 'credit', 'tech'] as Track[]).map((track) => {
          const meta = TRACK_META[track];
          const stat = trackStats[track];
          const Icon = meta.icon;
          return (
            <div key={track} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="flex items-center justify-between">
                <span className="inline-flex items-center gap-2 text-sm font-bold text-slate-900">
                  <Icon className="h-4 w-4 text-slate-700" />
                  {meta.label}
                </span>
                <span className="text-xs font-extrabold text-slate-900">{stat.percent}%</span>
              </div>
              <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-slate-200">
                <div className={`h-full ${meta.color}`} style={{ width: `${stat.percent}%` }} />
              </div>
              <p className="mt-2 text-xs font-medium text-slate-600">
                {stat.completed} / {stat.total} chủ đề đạt chuẩn
              </p>
            </div>
          );
        })}
      </section>

      {/* Week Selector & Lesson Grid */}
      <section className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap gap-2">
            {([1, 2, 3, 4] as const).map((week) => (
              <button
                key={week}
                type="button"
                onClick={() => setSelectedWeek(week)}
                className={`rounded-xl border px-4 py-2 text-sm font-bold transition ${
                  selectedWeek === week
                    ? 'border-emerald-600 bg-emerald-600 text-white shadow-sm'
                    : 'border-slate-300 bg-white text-slate-800 hover:bg-slate-100'
                }`}
              >
                Tuần {week}
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={() => setOnlyMyTracks((v) => !v)}
            className={`rounded-xl border px-3.5 py-2 text-xs font-bold transition ${
              onlyMyTracks
                ? 'border-emerald-600 bg-emerald-100 text-emerald-900'
                : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-100'
            }`}
          >
            {onlyMyTracks ? '✓ Đang lọc theo lĩnh vực của bạn' : 'Lọc theo lĩnh vực của tôi'}
          </button>
        </div>

        <h2 className="text-lg font-extrabold text-slate-900">{WEEK_TITLES[selectedWeek]}</h2>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {weekLessons
            .filter((l) => !onlyMyTracks || progress.profile.focusTracks.includes(l.track))
            .map((lesson) => {
            const record = progress.completedLessons[lesson.id];
            const mastered = isLessonMastered(record);
            const meta = TRACK_META[lesson.track];
            const isPreferred = progress.profile.focusTracks.includes(lesson.track);
            return (
              <button
                key={lesson.id}
                type="button"
                onClick={() => onSelectLesson(lesson)}
                className="flex flex-col justify-between rounded-2xl border border-slate-200 bg-white p-4 text-left shadow-sm transition hover:border-emerald-500 hover:bg-emerald-50/30"
              >
                <div>
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-bold text-emerald-700">
                      Ngày {lesson.day}
                    </span>
                    <div className="flex items-center gap-1.5">
                      {isPreferred && (
                        <span className="rounded-md border border-emerald-200 bg-emerald-50 px-1.5 py-0.5 text-[10px] font-bold text-emerald-800">
                          Phù hợp
                        </span>
                      )}
                      <span className="rounded-md border border-slate-200 bg-slate-100 px-2 py-0.5 text-[11px] font-bold text-slate-800">
                        {meta.shortLabel}
                      </span>
                    </div>
                  </div>
                  <h3 className="mt-2 font-bold text-slate-900">{lesson.title}</h3>
                  <p className="mt-1 text-xs font-medium text-slate-600">{lesson.scenario}</p>
                </div>

                <div className="mt-4 flex items-center justify-between border-t border-slate-200 pt-3 text-xs">
                  {record ? (
                    <span
                      className={`inline-flex items-center gap-1 font-bold ${
                        mastered ? 'text-emerald-700' : 'text-amber-700'
                      }`}
                    >
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      Nói: {record.shadowingBest}% • Viết: {record.dictationBest}%
                    </span>
                  ) : (
                    <span className="font-medium text-slate-500">Chưa luyện tập</span>
                  )}
                  <span className="font-bold text-emerald-700">Luyện ngay →</span>
                </div>
              </button>
            );
          })}

          {/* Day 7 Weekly Test Card */}
          <button
            type="button"
            onClick={() => onStartWeeklyTest(selectedWeek)}
            className="flex flex-col justify-between rounded-2xl border border-amber-300 bg-amber-50 p-4 text-left shadow-sm transition hover:border-amber-500 hover:bg-amber-100/70"
          >
            <div>
              <div className="flex items-center justify-between">
                <span className="text-xs font-extrabold uppercase text-amber-800">
                  Ngày {selectedWeek * 7} • Weekly Test
                </span>
                <Trophy className="h-4 w-4 text-amber-600" />
              </div>
              <h3 className="mt-2 font-extrabold text-slate-900">
                Kiểm tra & Xếp hạng Tuần {selectedWeek}
              </h3>
              <p className="mt-1 text-xs font-medium text-slate-700">
                Nghe không phụ đề + Thuật ngữ + Nói chấm từng chữ. Đạt ≥ 75% để thăng hạng.
              </p>
            </div>

            <div className="mt-4 flex items-center justify-between border-t border-amber-200 pt-3 text-xs">
              {weeklyTestRecord ? (
                <span className="font-bold text-amber-900">
                  Điểm cao nhất: {weeklyTestRecord.score}% (
                  {weeklyTestRecord.passed ? 'Đạt' : 'Chưa đạt'})
                </span>
              ) : (
                <span className="font-semibold text-amber-800">Chưa thi tuần này</span>
              )}
              <span className="font-extrabold text-amber-900">Làm bài →</span>
            </div>
          </button>
        </div>
      </section>

      {/* Elective Topics Section */}
      <section className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-extrabold text-slate-900">
              Chủ đề Mở rộng (Pháp chế • Du lịch • Đời sống • CNTT)
            </h2>
            <p className="text-xs font-medium text-slate-600">
              Luyện thêm tình huống giao tiếp thực tế ngoài lộ trình 28 ngày
            </p>
          </div>

          <div className="flex flex-wrap gap-1.5">
            {[
              { id: 'all', label: 'Tất cả' },
              { id: 'legal', label: 'Pháp chế' },
              { id: 'travel', label: 'Du lịch' },
              { id: 'daily', label: 'Đời sống' },
              { id: 'tech', label: 'CNTT' },
            ].map((f) => (
              <button
                key={f.id}
                type="button"
                onClick={() =>
                  setElectiveFilter(f.id as 'all' | 'legal' | 'travel' | 'daily' | 'tech')
                }
                className={`rounded-lg border px-3 py-1 text-xs font-bold transition ${
                  electiveFilter === f.id
                    ? 'border-emerald-600 bg-emerald-600 text-white'
                    : 'border-slate-300 bg-slate-50 text-slate-800 hover:bg-slate-100'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>

        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
          {electiveLessons
            .filter((el) => electiveFilter === 'all' || el.track === electiveFilter)
            .map((lesson) => {
              const meta = TRACK_META[lesson.track];
              const record = progress.completedLessons[lesson.id];
              const mastered = isLessonMastered(record);
              return (
                <button
                  key={lesson.id}
                  type="button"
                  onClick={() => onSelectLesson(lesson)}
                  className="flex flex-col justify-between rounded-xl border border-slate-200 bg-slate-50 p-4 text-left transition hover:border-emerald-500 hover:bg-emerald-50/40"
                >
                  <div>
                    <span className="inline-block rounded-md border border-slate-200 bg-white px-2 py-0.5 text-[11px] font-bold text-slate-800">
                      {meta.shortLabel}
                    </span>
                    <h3 className="mt-2 text-sm font-bold text-slate-900">{lesson.title}</h3>
                    <p className="mt-1 text-xs font-medium text-slate-600">{lesson.scenario}</p>
                  </div>
                  <div className="mt-3 flex items-center justify-between border-t border-slate-200 pt-2.5 text-xs">
                    {record ? (
                      <span className={mastered ? 'font-bold text-emerald-700' : 'font-bold text-amber-700'}>
                        Nói: {record.shadowingBest}%
                      </span>
                    ) : (
                      <span className="font-semibold text-slate-500">4 câu</span>
                    )}
                    <span className="font-bold text-emerald-700">Luyện →</span>
                  </div>
                </button>
              );
            })}
        </div>
      </section>

      {/* Custom Lessons Section */}
      {customLessons.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-base font-extrabold text-slate-900">
            Bài học tự tạo từ tài liệu của bạn
          </h2>
          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
            {customLessons.map((cl) => (
              <button
                key={cl.id}
                type="button"
                onClick={() => onSelectLesson(cl)}
                className="rounded-xl border border-sky-300 bg-sky-50 p-4 text-left hover:bg-sky-100/70"
              >
                <span className="text-[11px] font-extrabold uppercase text-sky-800">
                  {TRACK_META[cl.track].shortLabel} • {cl.sentences.length} câu
                </span>
                <p className="mt-1 font-bold text-slate-900">{cl.title}</p>
                <p className="mt-0.5 text-xs font-medium text-slate-600">{cl.scenario}</p>
              </button>
            ))}
          </div>
        </section>
      )}

      {/* Saved Key Terms */}
      {savedWords.length > 0 && (
        <section className="space-y-3 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center gap-2">
            <Bookmark className="h-4 w-4 text-amber-600" />
            <h2 className="text-base font-extrabold text-slate-900">
              Kho từ khó đã lưu ({savedWords.length})
            </h2>
          </div>
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
                  title="Đã thuộc — Xóa khỏi danh sách"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
