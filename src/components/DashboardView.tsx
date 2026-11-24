import { useState, type ChangeEvent } from 'react';
import {
  Award,
  Bookmark,
  BookOpen,
  CheckCircle2,
  Cpu,
  Download,
  FilePlus2,
  Flame,
  Landmark,
  RotateCcw,
  ShieldCheck,
  Trash2,
  Trophy,
  Upload,
  Volume2,
} from 'lucide-react';
import type { Lesson, Track, UserProgress } from '../types/curriculum';
import { computeTrackStats, isLessonMastered } from '../utils/progressStore';
import { speakSentence } from '../utils/speechEngine';

interface DashboardViewProps {
  progress: UserProgress;
  lessons: Lesson[];
  onSelectLesson: (lesson: Lesson) => void;
  onStartWeeklyTest: (week: 1 | 2 | 3 | 4) => void;
  onOpenCustomModal: () => void;
  onRemoveSavedWord: (word: string) => void;
  onExportJson: () => void;
  onImportJson: (raw: string) => void;
  onReopenOnboarding: () => void;
}

const WEEK_TITLES: Record<1 | 2 | 3 | 4, string> = {
  1: 'Tuần 1: Tài chính & Vận hành Ngân hàng',
  2: 'Tuần 2: Tín dụng & Quản trị Rủi ro',
  3: 'Tuần 3: Công nghệ Ngân hàng & Fintech',
  4: 'Tuần 4: Giao tiếp & Thuyết trình Cấp cao',
};

const TRACK_META: Record<Track, { label: string; shortLabel: string; color: string; icon: typeof Landmark }> = {
  finance: { label: 'Tài chính (Finance)', shortLabel: 'Tài chính', color: 'bg-emerald-500', icon: Landmark },
  credit: { label: 'Tín dụng (Credit)', shortLabel: 'Tín dụng', color: 'bg-amber-500', icon: ShieldCheck },
  tech: { label: 'Công nghệ (Banking Tech)', shortLabel: 'Công nghệ', color: 'bg-sky-500', icon: Cpu },
};

export function DashboardView({
  progress,
  lessons,
  onSelectLesson,
  onStartWeeklyTest,
  onOpenCustomModal,
  onRemoveSavedWord,
  onExportJson,
  onImportJson,
  onReopenOnboarding,
}: DashboardViewProps) {
  const [selectedWeek, setSelectedWeek] = useState<1 | 2 | 3 | 4>(1);
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
      {/* Top Bar */}
      <header className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-slate-800 bg-slate-900/90 p-5">
        <div>
          <div className="flex items-center gap-2">
            <span className="rounded-md bg-emerald-500/20 px-2.5 py-0.5 text-xs font-bold uppercase tracking-wider text-emerald-300">
              100% Local • Antigravity
            </span>
            <span className="text-xs text-slate-400">Zero Cloud / Zero Cost</span>
          </div>
          <h1 className="mt-1.5 text-2xl font-bold text-white">
            FinTech Banker English Studio
          </h1>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={onOpenCustomModal}
            className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-500 px-3.5 py-2 text-xs font-bold text-slate-950 hover:bg-emerald-400"
          >
            <FilePlus2 className="h-3.5 w-3.5" />
            Tạo bài từ tài liệu
          </button>
          <button
            type="button"
            onClick={onReopenOnboarding}
            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-700 px-3 py-2 text-xs font-medium text-slate-300 hover:bg-slate-800"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            Đổi trình độ / Test lại
          </button>
          <button
            type="button"
            onClick={onExportJson}
            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-700 px-3 py-2 text-xs font-medium text-slate-300 hover:bg-slate-800"
          >
            <Download className="h-3.5 w-3.5" />
            Export JSON
          </button>
          <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-xl border border-slate-700 px-3 py-2 text-xs font-medium text-slate-300 hover:bg-slate-800">
            <Upload className="h-3.5 w-3.5" />
            Import JSON
            <input type="file" accept=".json" onChange={handleFileImport} className="hidden" />
          </label>
        </div>
      </header>

      {importStatus && (
        <div className="rounded-xl border border-emerald-500/40 bg-emerald-500/10 px-4 py-2 text-xs text-emerald-300">
          {importStatus}
        </div>
      )}

      {/* KPI Cards */}
      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-xs font-medium">Xếp hạng hiện tại</span>
            <Trophy className="h-4 w-4 text-amber-400" />
          </div>
          <p className="mt-2 text-lg font-bold text-white">{progress.rank}</p>
          <p className="mt-1 text-xs text-slate-400">Cấp độ: {progress.selectedLevel}</p>
        </div>

        <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-xs font-medium">Chuỗi học hàng ngày</span>
            <Flame className="h-4 w-4 text-orange-400" />
          </div>
          <p className="mt-2 text-lg font-bold text-white">{progress.streakDays} ngày</p>
          <p className="mt-1 text-xs text-slate-400">KPI: ≥ 75% điểm bài học</p>
        </div>

        <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-xs font-medium">Tiến độ Tuần {selectedWeek}</span>
            <BookOpen className="h-4 w-4 text-emerald-400" />
          </div>
          <p className="mt-2 text-lg font-bold text-white">
            {weekCompleted} / {weekLessons.length} bài đạt KPI
          </p>
          <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-slate-800">
            <div
              className="h-full bg-emerald-500 transition-all"
              style={{
                width: `${Math.round((weekCompleted / Math.max(1, weekLessons.length)) * 100)}%`,
              }}
            />
          </div>
        </div>

        <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-xs font-medium">Lộ trình Tháng (28 ngày)</span>
            <Award className="h-4 w-4 text-sky-400" />
          </div>
          <p className="mt-2 text-lg font-bold text-white">{monthlyPercent}% hoàn thành</p>
          <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-slate-800">
            <div
              className="h-full bg-sky-500 transition-all"
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
            <div key={track} className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4">
              <div className="flex items-center justify-between">
                <span className="inline-flex items-center gap-2 text-sm font-semibold text-white">
                  <Icon className="h-4 w-4 text-slate-300" />
                  {meta.label}
                </span>
                <span className="text-xs font-bold text-slate-300">{stat.percent}%</span>
              </div>
              <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-slate-800">
                <div className={`h-full ${meta.color}`} style={{ width: `${stat.percent}%` }} />
              </div>
              <p className="mt-2 text-xs text-slate-400">
                {stat.completed} / {stat.total} chủ đề đạt chuẩn
              </p>
            </div>
          );
        })}
      </section>

      {/* Week Selector & Lesson Grid */}
      <section className="space-y-4">
        <div className="flex flex-wrap gap-2">
          {([1, 2, 3, 4] as const).map((week) => (
            <button
              key={week}
              type="button"
              onClick={() => setSelectedWeek(week)}
              className={`rounded-xl border px-4 py-2 text-sm font-semibold transition ${
                selectedWeek === week
                  ? 'border-emerald-500 bg-emerald-500/20 text-emerald-300'
                  : 'border-slate-800 bg-slate-900 text-slate-400 hover:bg-slate-800'
              }`}
            >
              Tuần {week}
            </button>
          ))}
        </div>

        <h2 className="text-lg font-bold text-white">{WEEK_TITLES[selectedWeek]}</h2>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {weekLessons.map((lesson) => {
            const record = progress.completedLessons[lesson.id];
            const mastered = isLessonMastered(record);
            const meta = TRACK_META[lesson.track];
            return (
              <button
                key={lesson.id}
                type="button"
                onClick={() => onSelectLesson(lesson)}
                className="flex flex-col justify-between rounded-2xl border border-slate-800 bg-slate-900/70 p-4 text-left transition hover:border-emerald-500/50 hover:bg-slate-800/80"
              >
                <div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-emerald-400">
                      Ngày {lesson.day}
                    </span>
                    <span className="rounded-md bg-slate-800 px-2 py-0.5 text-[11px] text-slate-300">
                      {meta.shortLabel}
                    </span>
                  </div>
                  <h3 className="mt-2 font-semibold text-white">{lesson.title}</h3>
                  <p className="mt-1 text-xs text-slate-400">{lesson.scenario}</p>
                </div>

                <div className="mt-4 flex items-center justify-between border-t border-slate-800 pt-3 text-xs">
                  {record ? (
                    <span
                      className={`inline-flex items-center gap-1 font-semibold ${
                        mastered ? 'text-emerald-400' : 'text-amber-300'
                      }`}
                    >
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      Nói: {record.shadowingBest}% • Viết: {record.dictationBest}%
                    </span>
                  ) : (
                    <span className="text-slate-500">Chưa luyện tập</span>
                  )}
                  <span className="font-semibold text-emerald-300">Luyện ngay →</span>
                </div>
              </button>
            );
          })}

          {/* Day 7 Weekly Test Card */}
          <button
            type="button"
            onClick={() => onStartWeeklyTest(selectedWeek)}
            className="flex flex-col justify-between rounded-2xl border border-amber-500/40 bg-amber-500/10 p-4 text-left transition hover:border-amber-400 hover:bg-amber-500/15"
          >
            <div>
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase text-amber-300">
                  Ngày {selectedWeek * 7} • Weekly Test
                </span>
                <Trophy className="h-4 w-4 text-amber-400" />
              </div>
              <h3 className="mt-2 font-bold text-white">
                Kiểm tra & Xếp hạng Tuần {selectedWeek}
              </h3>
              <p className="mt-1 text-xs text-slate-300">
                Nghe không phụ đề + Thuật ngữ + Nói chấm từng chữ. Đạt ≥ 75% để thăng hạng.
              </p>
            </div>

            <div className="mt-4 flex items-center justify-between border-t border-amber-500/20 pt-3 text-xs">
              {weeklyTestRecord ? (
                <span className="font-semibold text-amber-300">
                  Điểm cao nhất: {weeklyTestRecord.score}% (
                  {weeklyTestRecord.passed ? 'Đạt' : 'Chưa đạt'})
                </span>
              ) : (
                <span className="text-amber-200/70">Chưa thi tuần này</span>
              )}
              <span className="font-bold text-amber-300">Làm bài →</span>
            </div>
          </button>
        </div>
      </section>

      {/* Custom Lessons Section */}
      {customLessons.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-base font-bold text-white">Bài học tự tạo từ tài liệu của bạn</h2>
          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
            {customLessons.map((cl) => (
              <button
                key={cl.id}
                type="button"
                onClick={() => onSelectLesson(cl)}
                className="rounded-xl border border-sky-500/30 bg-sky-500/10 p-4 text-left hover:bg-sky-500/15"
              >
                <span className="text-[11px] font-bold uppercase text-sky-300">
                  {TRACK_META[cl.track].shortLabel} • {cl.sentences.length} câu
                </span>
                <p className="mt-1 font-semibold text-white">{cl.title}</p>
                <p className="mt-0.5 text-xs text-slate-400">{cl.scenario}</p>
              </button>
            ))}
          </div>
        </section>
      )}

      {/* Saved Key Terms (Personal Flashcards) */}
      {savedWords.length > 0 && (
        <section className="space-y-3 rounded-2xl border border-slate-800 bg-slate-900/70 p-5">
          <div className="flex items-center gap-2">
            <Bookmark className="h-4 w-4 text-amber-400" />
            <h2 className="text-base font-bold text-white">
              Kho từ khó đã lưu ({savedWords.length})
            </h2>
          </div>
          <div className="flex flex-wrap gap-2">
            {savedWords.map((sw) => (
              <div
                key={sw.word}
                className="inline-flex items-center gap-2 rounded-xl border border-slate-700 bg-slate-950 px-3 py-1.5 text-xs"
              >
                <button
                  type="button"
                  onClick={() => speakSentence(sw.word, 0.85)}
                  className="inline-flex items-center gap-1 font-semibold text-sky-300 hover:text-sky-200"
                  title={sw.contextSentence}
                >
                  <Volume2 className="h-3.5 w-3.5" />
                  {sw.word}
                </button>
                <button
                  type="button"
                  onClick={() => onRemoveSavedWord(sw.word)}
                  className="text-slate-500 hover:text-rose-400"
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
