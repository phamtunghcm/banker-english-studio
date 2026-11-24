import { useState } from 'react';
import { Award, CheckCircle2, Compass, Sparkles, Volume2 } from 'lucide-react';
import type { LevelTier, RankTitle } from '../types/curriculum';
import { PLACEMENT_QUESTIONS } from '../data';
import { speakSentence } from '../utils/speechEngine';

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
    <div className="mx-auto max-w-3xl rounded-2xl border border-slate-200 bg-white p-6 shadow-lg">
      <div className="flex items-center gap-3">
        <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-emerald-100 text-emerald-700">
          <Sparkles className="h-6 w-6" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-slate-900">FinTech Banker English Studio</h1>
          <p className="text-sm font-medium text-slate-600">
            100% Local trên Antigravity • Chọn năng lực hoặc làm bài test xếp hạng đầu vào
          </p>
        </div>
      </div>

      <div className="mt-5 flex gap-2">
        <button
          type="button"
          onClick={() => setMode('select')}
          className={`flex-1 rounded-xl border px-4 py-2.5 text-sm font-bold transition ${
            mode === 'select'
              ? 'border-emerald-600 bg-emerald-50 text-emerald-800'
              : 'border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100'
          }`}
        >
          <Compass className="mr-2 inline h-4 w-4" />
          Tự chọn trình độ
        </button>
        <button
          type="button"
          onClick={() => setMode('test')}
          className={`flex-1 rounded-xl border px-4 py-2.5 text-sm font-bold transition ${
            mode === 'test'
              ? 'border-emerald-600 bg-emerald-50 text-emerald-800'
              : 'border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100'
          }`}
        >
          <Award className="mr-2 inline h-4 w-4" />
          Làm Placement Test ({PLACEMENT_QUESTIONS.length} câu)
        </button>
      </div>

      {mode === 'select' ? (
        <div className="mt-5 grid gap-3">
          {LEVEL_OPTIONS.map((opt) => (
            <button
              key={opt.id}
              type="button"
              onClick={() => onComplete(opt.id, opt.rank)}
              className="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50 p-4 text-left transition hover:border-emerald-500 hover:bg-emerald-50/50"
            >
              <div>
                <p className="font-bold text-slate-900">{opt.title}</p>
                <p className="mt-0.5 text-sm font-medium text-slate-600">{opt.subtitle}</p>
              </div>
              <span className="shrink-0 rounded-full border border-emerald-200 bg-emerald-100 px-3 py-1 text-xs font-bold text-emerald-800">
                {opt.rank}
              </span>
            </button>
          ))}
        </div>
      ) : (
        <div className="mt-5 space-y-4">
          {PLACEMENT_QUESTIONS.map((q, idx) => (
            <div key={q.id} className="rounded-xl border border-slate-200 bg-slate-50 p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm font-bold text-slate-900">
                  {idx + 1}. {q.prompt}
                </p>
                {q.audioText && (
                  <button
                    type="button"
                    onClick={() => speakSentence(q.audioText!, 1.0)}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-300 bg-emerald-100 px-3 py-1 text-xs font-bold text-emerald-800 hover:bg-emerald-200"
                  >
                    <Volume2 className="h-3.5 w-3.5" />
                    Nghe đoạn hội thoại
                  </button>
                )}
              </div>
              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                {q.options.map((opt, optIdx) => {
                  const selected = answers[q.id] === optIdx;
                  return (
                    <button
                      key={opt}
                      type="button"
                      onClick={() => setAnswers((prev) => ({ ...prev, [q.id]: optIdx }))}
                      className={`rounded-lg border px-3 py-2 text-left text-xs font-semibold transition ${
                        selected
                          ? 'border-emerald-600 bg-emerald-100 text-emerald-900'
                          : 'border-slate-200 bg-white text-slate-800 hover:bg-slate-100'
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
              className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-5 py-2.5 text-sm font-bold text-white hover:bg-emerald-700"
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
