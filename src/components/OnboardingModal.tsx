import { useState } from 'react';
import { Award, CheckCircle2, Compass, Sparkles } from 'lucide-react';
import type { LevelTier, RankTitle } from '../types/curriculum';
import { PLACEMENT_QUESTIONS } from '../data';

interface OnboardingModalProps {
  onComplete: (level: LevelTier, rank: RankTitle) => void;
}

const LEVEL_OPTIONS: {
  id: LevelTier;
  title: string;
  subtitle: string;
  rank: RankTitle;
}[] = [
  {
    id: 'foundation',
    title: 'Foundation (Nền tảng)',
    subtitle: 'Làm quen thuật ngữ Tài chính, Tín dụng & Core Banking cơ bản',
    rank: 'Analyst (B1)',
  },
  {
    id: 'professional',
    title: 'Professional (Nghiệp vụ)',
    subtitle: 'Thẩm định tín dụng, Basel III, Open API & eKYC thực chiến',
    rank: 'Senior Officer (B1+)',
  },
  {
    id: 'executive',
    title: 'Executive (Quản lý / Chuyên gia)',
    subtitle: 'Bảo vệ đề xuất trước Hội đồng, M&A, Investor Relations & Agile',
    rank: 'Manager (B2)',
  },
];

export function OnboardingModal({ onComplete }: OnboardingModalProps) {
  const [mode, setMode] = useState<'select' | 'test'>('select');
  const [answers, setAnswers] = useState<Record<string, number>>({});

  const handleSubmitTest = () => {
    let correct = 0;
    for (const q of PLACEMENT_QUESTIONS) {
      if (answers[q.id] === q.answerIndex) correct++;
    }
    const ratio = correct / PLACEMENT_QUESTIONS.length;
    if (ratio >= 0.8) {
      onComplete('executive', 'Manager (B2)');
    } else if (ratio >= 0.5) {
      onComplete('professional', 'Senior Officer (B1+)');
    } else {
      onComplete('foundation', 'Analyst (B1)');
    }
  };

  return (
    <div className="mx-auto max-w-3xl rounded-2xl border border-slate-800 bg-slate-900/95 p-6 shadow-2xl">
      <div className="flex items-center gap-3">
        <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-emerald-500/20 text-emerald-400">
          <Sparkles className="h-6 w-6" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-white">FinTech Banker English Studio</h1>
          <p className="text-sm text-slate-400">
            100% Local trên Antigravity • Chọn năng lực hoặc làm bài test xếp hạng đầu vào
          </p>
        </div>
      </div>

      <div className="mt-5 flex gap-2">
        <button
          type="button"
          onClick={() => setMode('select')}
          className={`flex-1 rounded-xl border px-4 py-2.5 text-sm font-semibold transition ${
            mode === 'select'
              ? 'border-emerald-500 bg-emerald-500/20 text-emerald-300'
              : 'border-slate-800 bg-slate-950 text-slate-400 hover:bg-slate-800'
          }`}
        >
          <Compass className="mr-2 inline h-4 w-4" />
          Tự chọn trình độ
        </button>
        <button
          type="button"
          onClick={() => setMode('test')}
          className={`flex-1 rounded-xl border px-4 py-2.5 text-sm font-semibold transition ${
            mode === 'test'
              ? 'border-emerald-500 bg-emerald-500/20 text-emerald-300'
              : 'border-slate-800 bg-slate-950 text-slate-400 hover:bg-slate-800'
          }`}
        >
          <Award className="mr-2 inline h-4 w-4" />
          Làm Placement Test (5 câu)
        </button>
      </div>

      {mode === 'select' ? (
        <div className="mt-5 grid gap-3">
          {LEVEL_OPTIONS.map((opt) => (
            <button
              key={opt.id}
              type="button"
              onClick={() => onComplete(opt.id, opt.rank)}
              className="flex items-center justify-between rounded-xl border border-slate-800 bg-slate-950/70 p-4 text-left transition hover:border-emerald-500/60 hover:bg-slate-800/80"
            >
              <div>
                <p className="font-semibold text-white">{opt.title}</p>
                <p className="mt-0.5 text-sm text-slate-400">{opt.subtitle}</p>
              </div>
              <span className="shrink-0 rounded-full bg-emerald-500/15 px-3 py-1 text-xs font-semibold text-emerald-300">
                {opt.rank}
              </span>
            </button>
          ))}
        </div>
      ) : (
        <div className="mt-5 space-y-4">
          {PLACEMENT_QUESTIONS.map((q, idx) => (
            <div key={q.id} className="rounded-xl border border-slate-800 bg-slate-950/70 p-4">
              <p className="text-sm font-medium text-white">
                {idx + 1}. {q.prompt}
              </p>
              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                {q.options.map((opt, optIdx) => {
                  const selected = answers[q.id] === optIdx;
                  return (
                    <button
                      key={opt}
                      type="button"
                      onClick={() => setAnswers((prev) => ({ ...prev, [q.id]: optIdx }))}
                      className={`rounded-lg border px-3 py-2 text-left text-xs transition ${
                        selected
                          ? 'border-emerald-500 bg-emerald-500/20 text-emerald-200'
                          : 'border-slate-800 bg-slate-900 text-slate-300 hover:bg-slate-800'
                      }`}
                    >
                      {opt}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}

          <div className="flex justify-end">
            <button
              type="button"
              onClick={handleSubmitTest}
              className="inline-flex items-center gap-2 rounded-xl bg-emerald-500 px-5 py-2.5 text-sm font-semibold text-slate-950 hover:bg-emerald-400"
            >
              <CheckCircle2 className="h-4 w-4" />
              Hoàn tất & Xếp hạng đầu vào
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
