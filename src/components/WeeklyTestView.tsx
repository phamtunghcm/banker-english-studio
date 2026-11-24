import { useEffect, useState } from 'react';
import { ArrowLeft, CheckCircle2, Mic, MicOff, Trophy, Volume2 } from 'lucide-react';
import type { Lesson, WeeklyTest, WordScoreResult } from '../types/curriculum';
import { scoreWordAlignment } from '../utils/wordScoring';
import {
  isSpeechRecognitionSupported,
  speakSentence,
  startListening,
  stopListening,
  stopSpeaking,
} from '../utils/speechEngine';

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
  const [isRecording, setIsRecording] = useState(false);
  const [micError, setMicError] = useState<string | null>(null);
  const [shadowPreview, setShadowPreview] = useState<{
    words: WordScoreResult[];
    accuracy: number;
  } | null>(null);
  const [submittedScore, setSubmittedScore] = useState<number | null>(null);

  const targetSentence = listeningLesson.sentences[0];
  const micSupported = isSpeechRecognitionSupported();

  useEffect(() => {
    return () => {
      stopSpeaking();
      stopListening();
    };
  }, []);

  const handleToggleMic = () => {
    if (isRecording) {
      stopListening();
      setIsRecording(false);
      setShadowPreview(scoreWordAlignment(targetSentence.en, shadowInput));
      return;
    }

    stopSpeaking();
    setMicError(null);
    setShadowInput('');
    let latest = '';

    const started = startListening(
      (transcript) => {
        latest = transcript;
        setShadowInput(transcript);
      },
      (err) => {
        setMicError(err);
        setIsRecording(false);
      },
      () => {
        setIsRecording(false);
        if (latest.trim()) {
          setShadowPreview(scoreWordAlignment(targetSentence.en, latest));
        }
      }
    );

    if (started) setIsRecording(true);
  };

  const handleSubmit = () => {
    stopSpeaking();
    stopListening();
    let vocabCorrect = 0;
    for (const q of test.vocabQuestions) {
      if (vocabAnswers[q.id] === q.answerIndex) vocabCorrect++;
    }
    const vocabPct = (vocabCorrect / test.vocabQuestions.length) * 100;
    const listenPct = scoreWordAlignment(targetSentence.en, listeningInput).accuracy;
    const shadowEval = scoreWordAlignment(targetSentence.en, shadowInput);
    setShadowPreview(shadowEval);

    const totalScore = Math.round(vocabPct * 0.4 + listenPct * 0.3 + shadowEval.accuracy * 0.3);
    setSubmittedScore(totalScore);
    onFinish(totalScore);
  };

  return (
    <div className="mx-auto max-w-3xl space-y-5 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={() => {
            stopSpeaking();
            stopListening();
            onBack();
          }}
          className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-bold text-slate-800 hover:bg-slate-100"
        >
          <ArrowLeft className="h-4 w-4" />
          Quay lại
        </button>
        <span className="inline-flex items-center gap-1.5 text-xs font-bold uppercase text-amber-700">
          <Trophy className="h-4 w-4" />
          Đạt ≥ {test.passingScore}% để thăng hạng
        </span>
      </div>

      <h1 className="text-xl font-bold text-slate-900">{test.title}</h1>

      {/* Part 1: Banking Vocabulary */}
      <div className="space-y-3">
        <h2 className="text-sm font-bold text-emerald-700">
          Phần 1: Thuật ngữ & Nghiệp vụ (40%)
        </h2>
        {test.vocabQuestions.map((q, idx) => (
          <div key={q.id} className="rounded-xl border border-slate-200 bg-slate-50 p-4">
            <p className="text-sm font-bold text-slate-900">
              {idx + 1}. {q.prompt}
            </p>
            <div className="mt-2.5 grid gap-2">
              {q.options.map((opt, optIdx) => (
                <button
                  key={opt}
                  type="button"
                  onClick={() => setVocabAnswers((p) => ({ ...p, [q.id]: optIdx }))}
                  className={`rounded-lg border px-3 py-2 text-left text-xs font-semibold ${
                    vocabAnswers[q.id] === optIdx
                      ? 'border-emerald-600 bg-emerald-100 text-emerald-900'
                      : 'border-slate-200 bg-white text-slate-800 hover:bg-slate-100'
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
      <div className="space-y-2 rounded-xl border border-slate-200 bg-slate-50 p-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-bold text-emerald-700">
            Phần 2: Nghe không phụ đề & Gõ lại (30%)
          </h2>
          <button
            type="button"
            onClick={() =>
              speakSentence(targetSentence.en, 1.0, {}, undefined, 'expressive', targetSentence.id)
            }
            className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-300 bg-emerald-100 px-3 py-1 text-xs font-bold text-emerald-800"
          >
            <Volume2 className="h-3.5 w-3.5" />
            Nghe câu thi
          </button>
        </div>
        <textarea
          rows={2}
          value={listeningInput}
          onChange={(e) => setListeningInput(e.target.value)}
          placeholder="Gõ lại chính xác câu vừa nghe..."
          className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-900 focus:border-emerald-600 focus:outline-none"
        />
      </div>

      {/* Part 3: Speaking Check with Mic + Word Scoring */}
      <div className="space-y-3 rounded-xl border border-slate-200 bg-slate-50 p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-sm font-bold text-emerald-700">
            Phần 3: Đọc lại câu chuẩn — Chấm từng chữ (30%)
          </h2>
          {micSupported && (
            <button
              type="button"
              onClick={handleToggleMic}
              className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold ${
                isRecording
                  ? 'animate-pulse bg-rose-600 text-white'
                  : 'bg-emerald-600 text-white hover:bg-emerald-700'
              }`}
            >
              {isRecording ? <MicOff className="h-3.5 w-3.5" /> : <Mic className="h-3.5 w-3.5" />}
              {isRecording ? 'Dừng thu âm' : 'Nói bằng Micro'}
            </button>
          )}
        </div>

        <p className="text-sm font-bold text-slate-900">{targetSentence.en}</p>

        {micError && (
          <p className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-1.5 text-xs font-semibold text-amber-800">
            {micError}
          </p>
        )}

        <textarea
          rows={2}
          value={shadowInput}
          onChange={(e) => setShadowInput(e.target.value)}
          placeholder="Bấm Micro để nói hoặc nhập transcript kiểm tra..."
          className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-900 focus:border-emerald-600 focus:outline-none"
        />

        {shadowPreview && (
          <div className="flex flex-wrap gap-1.5 pt-1">
            {shadowPreview.words.map((w, i) => (
              <span
                key={`wt-sh-${i}`}
                className={`rounded-md border px-2 py-0.5 text-xs font-bold ${
                  w.status === 'correct'
                    ? 'border-emerald-300 bg-emerald-100 text-emerald-900'
                    : w.status === 'near'
                      ? 'border-amber-300 bg-amber-100 text-amber-900'
                      : 'border-rose-300 bg-rose-100 text-rose-900 line-through'
                }`}
              >
                {w.expected}
              </span>
            ))}
          </div>
        )}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        {submittedScore !== null ? (
          <div className="inline-flex items-center gap-2 text-sm font-bold text-amber-800">
            <CheckCircle2 className="h-5 w-5 text-amber-600" />
            Điểm tổng kết: {submittedScore}% —{' '}
            {submittedScore >= test.passingScore
              ? 'ĐẠT & THĂNG HẠNG!'
              : 'Chưa đạt 75%, hãy thử lại!'}
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
