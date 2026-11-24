import { useState } from 'react';
import { ArrowLeft, CheckCircle2, Trophy, Volume2 } from 'lucide-react';
import type { Lesson, WeeklyTest } from '../types/curriculum';
import { scoreWordAlignment } from '../utils/wordScoring';
import { speakSentence } from '../utils/speechEngine';

interface WeeklyTestViewProps {
  test: WeeklyTest;
  listeningLesson: Lesson;
  onFinish: (score: number) => void;
  onBack: () => void;
}

export function WeeklyTestView({
  test,
  listeningLesson,
  onFinish,
  onBack,
}: WeeklyTestViewProps) {
  const [vocabAnswers, setVocabAnswers] = useState<Record<string, number>>({});
  const [listeningInput, setListeningInput] = useState('');
  const [shadowInput, setShadowInput] = useState('');
  const [submittedScore, setSubmittedScore] = useState<number | null>(null);

  const targetSentence = listeningLesson.sentences[0];

  const handleSubmit = () => {
    let vocabCorrect = 0;
    for (const q of test.vocabQuestions) {
      if (vocabAnswers[q.id] === q.answerIndex) vocabCorrect++;
    }
    const vocabPct = (vocabCorrect / test.vocabQuestions.length) * 100;
    const listenPct = scoreWordAlignment(targetSentence.en, listeningInput).accuracy;
    const shadowPct = scoreWordAlignment(targetSentence.en, shadowInput).accuracy;

    const totalScore = Math.round(vocabPct * 0.4 + listenPct * 0.3 + shadowPct * 0.3);
    setSubmittedScore(totalScore);
    onFinish(totalScore);
  };

  return (
    <div className="mx-auto max-w-3xl space-y-5 rounded-2xl border border-slate-800 bg-slate-900/90 p-6">
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={onBack}
          className="inline-flex items-center gap-2 rounded-lg border border-slate-700 px-3 py-1.5 text-sm text-slate-300 hover:bg-slate-800"
        >
          <ArrowLeft className="h-4 w-4" />
          Quay lại
        </button>
        <span className="inline-flex items-center gap-1.5 text-xs font-bold uppercase text-amber-400">
          <Trophy className="h-4 w-4" />
          Đạt ≥ {test.passingScore}% để thăng hạng
        </span>
      </div>

      <h1 className="text-xl font-bold text-white">{test.title}</h1>

      {/* Part 1: Banking Vocabulary */}
      <div className="space-y-3">
        <h2 className="text-sm font-semibold text-emerald-400">
          Phần 1: Thuật ngữ & Nghiệp vụ (40%)
        </h2>
        {test.vocabQuestions.map((q, idx) => (
          <div key={q.id} className="rounded-xl border border-slate-800 bg-slate-950 p-4">
            <p className="text-sm font-medium text-white">
              {idx + 1}. {q.prompt}
            </p>
            <div className="mt-2.5 grid gap-2">
              {q.options.map((opt, optIdx) => (
                <button
                  key={opt}
                  type="button"
                  onClick={() => setVocabAnswers((p) => ({ ...p, [q.id]: optIdx }))}
                  className={`rounded-lg border px-3 py-2 text-left text-xs ${
                    vocabAnswers[q.id] === optIdx
                      ? 'border-emerald-500 bg-emerald-500/20 text-emerald-200'
                      : 'border-slate-800 bg-slate-900 text-slate-300 hover:bg-slate-800'
                  }`}
                >
                  {opt}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Part 2: No-Sub Listening */}
      <div className="space-y-2 rounded-xl border border-slate-800 bg-slate-950 p-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-emerald-400">
            Phần 2: Nghe không phụ đề & Gõ lại (30%)
          </h2>
          <button
            type="button"
            onClick={() => speakSentence(targetSentence.en, 1.0)}
            className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-500/20 px-3 py-1 text-xs font-semibold text-emerald-300"
          >
            <Volume2 className="h-3.5 w-3.5" />
            Nghe câu thi
          </button>
        </div>
        <input
          type="text"
          value={listeningInput}
          onChange={(e) => setListeningInput(e.target.value)}
          placeholder="Gõ lại chính xác câu vừa nghe..."
          className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white focus:border-emerald-500 focus:outline-none"
        />
      </div>

      {/* Part 3: Speaking Check */}
      <div className="space-y-2 rounded-xl border border-slate-800 bg-slate-950 p-4">
        <h2 className="text-sm font-semibold text-emerald-400">
          Phần 3: Đọc lại câu chuẩn (30%)
        </h2>
        <p className="text-sm text-slate-300">{targetSentence.en}</p>
        <input
          type="text"
          value={shadowInput}
          onChange={(e) => setShadowInput(e.target.value)}
          placeholder="Nhập hoặc dùng voice dictation của hệ thống để đọc lại câu trên..."
          className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white focus:border-emerald-500 focus:outline-none"
        />
      </div>

      <div className="flex items-center justify-between">
        {submittedScore !== null ? (
          <div className="inline-flex items-center gap-2 text-sm font-bold text-amber-300">
            <CheckCircle2 className="h-5 w-5" />
            Điểm tổng kết: {submittedScore}% —{' '}
            {submittedScore >= test.passingScore ? 'ĐẠT & THĂNG HẠNG!' : 'Chưa đạt 75%, hãy thử lại!'}
          </div>
        ) : (
          <span />
        )}

        <button
          type="button"
          onClick={handleSubmit}
          className="rounded-xl bg-amber-500 px-5 py-2.5 text-sm font-bold text-slate-950 hover:bg-amber-400"
        >
          Nộp bài & Chấm hạng
        </button>
      </div>
    </div>
  );
}
