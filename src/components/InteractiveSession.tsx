import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowRight,
  CheckCircle2,
  Mic,
  MicOff,
  Pause,
  Play,
  RotateCcw,
  Sparkles,
  Trophy,
  Users,
  Volume2,
  VolumeX,
  X,
} from 'lucide-react';
import type { Lesson, LessonSentence } from '../types/curriculum';
import {
  CURATED_FEMALE_VOICES,
  speakSentence,
  stopSpeaking,
  type TonePreset,
} from '../utils/speechEngine';
import {
  buildKaraokeSchedule,
  startKaraokeMicSession,
  type KaraokeMicHandle,
} from '../utils/karaokeRecorder';
import { preloadWhisper, transcribeWithWhisper } from '../utils/whisperEngine';
import { analyzePronunciation, type PronunciationReport } from '../utils/pronunciationCoach';
import {
  isSoundFxMuted,
  playCorrectSound,
  playFanfareSound,
  playTapSound,
  playWrongSound,
  setSoundFxMuted,
} from '../utils/soundFx';

interface InteractiveSessionProps {
  lesson: Lesson;
  voicePreset?: string;
  onFinish: (result: {
    shadowingScore?: number;
    clozeDone?: boolean;
    xpEarned: number;
  }) => void;
  onSwitchToClassic: () => void;
  onBack: () => void;
}

const FALLBACK_DISTRACTORS = [
  'liquidity',
  'collateral',
  'compliance',
  'margin',
  'forecast',
  'governance',
  'automation',
  'settlement',
  'portfolio',
  'benchmark',
];

function getDialogueVoice(
  sentence: LessonSentence,
  primaryFemaleVoice: string,
  track: string,
  hasDialogueRoles: boolean
): string {
  if (!hasDialogueRoles) return primaryFemaleVoice;
  // Role A = Male Neural voice (Ryan UK for IELTS, Andrew US for others); Role B = user's Female voice
  if (sentence.role === 'A') {
    return track === 'ielts' ? 'ryan' : 'andrew';
  }
  return primaryFemaleVoice;
}

function tokenizeBuildSentence(sentence: string): string[] {
  // Take a concise chunk (up to 10 words) so tap-to-build is snappy and fun
  const words = sentence
    .replace(/[.,!?;:"()]/g, '')
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  return words.slice(0, 10);
}

function deterministicShuffle<T>(items: T[], seed: number): T[] {
  const arr = [...items];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = (seed * 31 + i * 17) % (i + 1);
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

export function InteractiveSession({
  lesson,
  voicePreset,
  onFinish,
  onSwitchToClassic,
  onBack,
}: InteractiveSessionProps) {
  const primaryVoice = voicePreset ?? CURATED_FEMALE_VOICES[0].id;
  const tonePreset: TonePreset = 'expressive';
  const hasDialogueRoles = lesson.sentences.some((s) => Boolean(s.speaker || s.role));

  // 5 micro-steps + 1 summary card = steps 0..5
  const TOTAL_CARDS = 5;
  const [cardIdx, setCardIdx] = useState(0);
  const [xp, setXp] = useState(0);
  const [correctSteps, setCorrectSteps] = useState(0);
  const [muted, setMuted] = useState(() => isSoundFxMuted());
  const [showVi, setShowVi] = useState(true);

  // Audio playback state
  const [isPlaying, setIsPlaying] = useState(false);
  const [activeSentenceIdx, setActiveSentenceIdx] = useState(0);
  const [activeWordIdx, setActiveWordIdx] = useState<number | null>(null);

  // Card 2: Listening Quiz state
  const [quizSelected, setQuizSelected] = useState<number | null>(null);
  const [quizFeedback, setQuizFeedback] = useState<'correct' | 'wrong' | null>(null);

  // Card 3: Word-Bank Tap-to-Build state
  const buildTargetSentence = lesson.sentences[1] ?? lesson.sentences[0];
  const buildTokens = useMemo(
    () => tokenizeBuildSentence(buildTargetSentence.en),
    [buildTargetSentence.en]
  );
  const shuffledBank = useMemo(
    () =>
      deterministicShuffle(
        buildTokens.map((word, idx) => ({ id: `${idx}-${word}`, word })),
        lesson.id.length + buildTokens.length
      ),
    [buildTokens, lesson.id]
  );
  const [pickedIds, setPickedIds] = useState<string[]>([]);
  const [buildFeedback, setBuildFeedback] = useState<'correct' | 'wrong' | null>(null);

  // Card 4: Quick 1-Tap Cloze state
  const clozeSentence = lesson.sentences[2] ?? lesson.sentences[0];
  const clozeChoices = useMemo(() => {
    const answer = clozeSentence.clozeWord;
    const pool = [
      ...lesson.sentences.map((s) => s.clozeWord),
      ...FALLBACK_DISTRACTORS,
    ].filter((w) => w.toLowerCase() !== answer.toLowerCase());
    const uniqueDistractors = [...new Set(pool)].slice(0, 3);
    return deterministicShuffle([answer, ...uniqueDistractors], lesson.title.length + 7);
  }, [clozeSentence.clozeWord, lesson.sentences, lesson.title.length]);
  const [clozeSelected, setClozeSelected] = useState<string | null>(null);
  const [clozeFeedback, setClozeFeedback] = useState<'correct' | 'wrong' | null>(null);

  // Card 5: ELSA-style Role-Play Speaking state
  const speakIdx = useMemo(() => {
    const firstB = lesson.sentences.findIndex((s) => s.role === 'B');
    return firstB >= 0 ? firstB : 0;
  }, [lesson.sentences]);
  const speakingTargetSentence = lesson.sentences[speakIdx] ?? lesson.sentences[0];
  const promptPartnerSentence = speakIdx > 0 ? lesson.sentences[speakIdx - 1] : null;

  const [isKaraokeRunning, setIsKaraokeRunning] = useState(false);
  const [voiceStarted, setVoiceStarted] = useState(false);
  const [karaokeWordIdx, setKaraokeWordIdx] = useState(-1);
  const [micLevel, setMicLevel] = useState(0);
  const [isAnalyzingAi, setIsAnalyzingAi] = useState(false);
  const [aiLoadProgress, setAiLoadProgress] = useState<number | null>(null);
  const [speakReport, setSpeakReport] = useState<PronunciationReport | null>(null);
  const [micError, setMicError] = useState<string | null>(null);
  const karaokeMicRef = useRef<KaraokeMicHandle | null>(null);
  const karaokeRafRef = useRef<number | null>(null);

  // Comprehension quiz data (from lesson.comprehension or auto-built from sentence 0)
  const quizData = useMemo(() => {
    if (lesson.comprehension) {
      return lesson.comprehension;
    }
    const target = lesson.sentences[0];
    const distractors = lesson.sentences
      .slice(1, 3)
      .map((s) => s.vi)
      .filter((v) => v !== target.vi);
    const opts = deterministicShuffle(
      [
        target.vi,
        ...distractors,
        'Đề xuất tạm hoãn toàn bộ dự án sang năm tài chính sau.',
      ].slice(0, 3),
      lesson.id.length + 3
    );
    return {
      question: `Nghe câu mở đầu và chọn ý nghĩa chính xác nhất:`,
      options: opts,
      answerIndex: opts.indexOf(target.vi),
      explanationVi: `Câu chuẩn: "${target.en}"`,
    };
  }, [lesson]);

  const stopMic = async (shouldScore = false) => {
    if (karaokeRafRef.current !== null) {
      cancelAnimationFrame(karaokeRafRef.current);
      karaokeRafRef.current = null;
    }
    setIsKaraokeRunning(false);
    setVoiceStarted(false);
    setMicLevel(0);
    setKaraokeWordIdx(-1);

    const handle = karaokeMicRef.current;
    karaokeMicRef.current = null;
    if (!handle) return;

    const rec = await handle.stop();
    if (!shouldScore) return;

    if (!rec.hasVoice || rec.pcm16k.length < 1600) {
      playWrongSound();
      setSpeakReport(analyzePronunciation(speakingTargetSentence.en, ''));
      setMicError('0% — Không phát hiện giọng nói từ Micro. Hãy đọc to, rõ hơn nhé!');
      return;
    }

    setIsAnalyzingAi(true);
    setMicError(null);
    try {
      const transcript = await transcribeWithWhisper(rec.pcm16k, (pct) => {
        setAiLoadProgress(pct < 100 ? pct : null);
      });
      setAiLoadProgress(null);
      const report = analyzePronunciation(speakingTargetSentence.en, transcript);
      setSpeakReport(report);
      if (report.accuracy >= 65) {
        playCorrectSound();
        setXp((v) => v + 25);
        setCorrectSteps((v) => v + 1);
      } else {
        playWrongSound();
      }
    } catch (err) {
      setAiLoadProgress(null);
      setMicError(err instanceof Error ? err.message : 'Lỗi Whisper AI.');
    } finally {
      setIsAnalyzingAi(false);
    }
  };

  useEffect(() => {
    return () => {
      stopSpeaking();
      void stopMic(false);
    };
  }, []);

  useEffect(() => {
    if (cardIdx === 4) {
      void preloadWhisper((pct) => setAiLoadProgress(pct < 100 ? pct : null));
    }
    if (cardIdx === TOTAL_CARDS) {
      playFanfareSound();
    }
  }, [cardIdx]);

  const playTurn = (idx: number, autoNext = false) => {
    const s = lesson.sentences[idx];
    if (!s) {
      setIsPlaying(false);
      setActiveWordIdx(null);
      return;
    }
    setActiveSentenceIdx(idx);
    setIsPlaying(true);
    setActiveWordIdx(0);
    const voice = getDialogueVoice(s, primaryVoice, lesson.track, hasDialogueRoles);
    speakSentence(
      s.en,
      1.0,
      {
        onWordIndex: (w) => setActiveWordIdx(w),
        onEnd: () => {
          if (autoNext && idx + 1 < lesson.sentences.length) {
            playTurn(idx + 1, true);
          } else {
            setIsPlaying(false);
            setActiveWordIdx(null);
          }
        },
        onError: () => {
          setIsPlaying(false);
          setActiveWordIdx(null);
        },
      },
      voice,
      tonePreset,
      lesson.isCustom ? undefined : s.id
    );
  };

  const speakWord = (word: string) => {
    const clean = word.replace(/^[^\w]+|[^\w]+$/g, '');
    if (!clean) return;
    playTapSound();
    setIsPlaying(false);
    speakSentence(clean, 0.82, {}, primaryVoice, 'coaching');
  };

  const goNextCard = () => {
    stopSpeaking();
    void stopMic(false);
    setIsPlaying(false);
    playTapSound();
    setCardIdx((prev) => Math.min(TOTAL_CARDS, prev + 1));
  };

  const handleToggleMute = () => {
    const next = !muted;
    setMuted(next);
    setSoundFxMuted(next);
  };

  const handleCheckQuiz = (idx: number) => {
    if (quizFeedback !== null) return;
    setQuizSelected(idx);
    if (idx === quizData.answerIndex) {
      playCorrectSound();
      setQuizFeedback('correct');
      setXp((v) => v + 15);
      setCorrectSteps((v) => v + 1);
    } else {
      playWrongSound();
      setQuizFeedback('wrong');
    }
  };

  const handleCheckBuild = () => {
    const userWords = pickedIds.map(
      (id) => shuffledBank.find((item) => item.id === id)?.word ?? ''
    );
    const isRight =
      userWords.length === buildTokens.length &&
      userWords.every((w, i) => w.toLowerCase() === buildTokens[i].toLowerCase());
    if (isRight) {
      playCorrectSound();
      setBuildFeedback('correct');
      setXp((v) => v + 20);
      setCorrectSteps((v) => v + 1);
    } else {
      playWrongSound();
      setBuildFeedback('wrong');
    }
  };

  const handlePickCloze = (choice: string) => {
    if (clozeFeedback !== null) return;
    setClozeSelected(choice);
    if (choice.toLowerCase() === clozeSentence.clozeWord.toLowerCase()) {
      playCorrectSound();
      setClozeFeedback('correct');
      setXp((v) => v + 15);
      setCorrectSteps((v) => v + 1);
    } else {
      playWrongSound();
      setClozeFeedback('wrong');
    }
  };

  const handleToggleKaraoke = async () => {
    if (isKaraokeRunning) {
      await stopMic(true);
      return;
    }
    stopSpeaking();
    setIsPlaying(false);
    setMicError(null);
    setVoiceStarted(false);
    setKaraokeWordIdx(-1);

    try {
      const handle = await startKaraokeMicSession();
      karaokeMicRef.current = handle;
      setIsKaraokeRunning(true);

      const schedule = buildKaraokeSchedule(speakingTargetSentence.en, 1.0);
      const totalMs = schedule[schedule.length - 1]?.endMs ?? 2500;
      let startedAt: number | null = null;

      const tick = () => {
        if (!karaokeMicRef.current) return;
        const level = karaokeMicRef.current.getLevel();
        setMicLevel(level);
        if (startedAt === null) {
          if (level >= 0.05) {
            startedAt = performance.now();
            setVoiceStarted(true);
            setKaraokeWordIdx(0);
          }
          karaokeRafRef.current = requestAnimationFrame(tick);
          return;
        }
        const elapsed = performance.now() - startedAt;
        const slot =
          schedule.find((s) => elapsed >= s.startMs && elapsed < s.endMs) ??
          schedule[schedule.length - 1];
        if (slot) setKaraokeWordIdx(slot.index);
        if (elapsed >= totalMs + 1000) {
          void stopMic(true);
          return;
        }
        karaokeRafRef.current = requestAnimationFrame(tick);
      };
      karaokeRafRef.current = requestAnimationFrame(tick);
    } catch (err) {
      setMicError(
        err instanceof Error
          ? err.message
          : 'Không thể bật Micro. Hãy cấp quyền Micro trong trình duyệt.'
      );
      setIsKaraokeRunning(false);
    }
  };

  const progressPct = Math.round((Math.min(cardIdx, TOTAL_CARDS) / TOTAL_CARDS) * 100);

  return (
    <div className="mx-auto max-w-2xl space-y-4 pb-8">
      {/* Duolingo-style Top Progress Bar */}
      <div className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
        <button
          type="button"
          onClick={() => {
            stopSpeaking();
            void stopMic(false);
            onBack();
          }}
          className="rounded-xl p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-900"
          title="Quay lại Lộ trình"
        >
          <X className="h-5 w-5" />
        </button>

        <div className="flex-1">
          <div className="h-3.5 w-full overflow-hidden rounded-full bg-slate-200">
            <div
              className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-teal-500 transition-all duration-300"
              style={{ width: `${Math.max(8, progressPct)}%` }}
            />
          </div>
        </div>

        <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2.5 py-1 text-xs font-extrabold text-amber-900">
          <Sparkles className="h-3.5 w-3.5 text-amber-600" />+{xp} XP
        </span>

        <button
          type="button"
          onClick={handleToggleMute}
          className="rounded-xl p-1.5 text-slate-500 hover:bg-slate-100"
          title={muted ? 'Bật hiệu ứng âm thanh' : 'Tắt hiệu ứng âm thanh'}
        >
          {muted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4 text-emerald-600" />}
        </button>

        <button
          type="button"
          onClick={() => {
            stopSpeaking();
            void stopMic(false);
            onSwitchToClassic();
          }}
          className="rounded-xl border border-slate-200 bg-slate-50 px-2.5 py-1 text-[11px] font-bold text-slate-600 hover:bg-slate-100"
        >
          Xem toàn bài
        </button>
      </div>

      {/* CARD 0: 2-ROLE DIALOGUE STAGE (MALE <-> FEMALE NEURAL) */}
      {cardIdx === 0 && (
        <div className="animate-card-in space-y-4 rounded-3xl border border-slate-200 bg-white p-5 shadow-md">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-0.5 text-[11px] font-extrabold text-emerald-800">
                <Users className="h-3.5 w-3.5" />
                Thẻ 1/5 • {hasDialogueRoles ? 'Hội thoại 2 vai (Nam ↔ Nữ)' : 'Nghe ngữ cảnh'}
              </span>
              <h1 className="mt-1.5 text-lg font-extrabold text-slate-900">{lesson.title}</h1>
              <p className="text-xs font-medium text-slate-500">{lesson.scenario}</p>
            </div>
            <button
              type="button"
              onClick={() => setShowVi((v) => !v)}
              className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-100"
            >
              {showVi ? 'Ẩn dịch Việt' : 'Hiện dịch Việt'}
            </button>
          </div>

          <button
            type="button"
            onClick={() => {
              if (isPlaying) {
                stopSpeaking();
                setIsPlaying(false);
                setActiveWordIdx(null);
              } else {
                playTurn(0, true);
              }
            }}
            className="btn-tactile-emerald flex w-full items-center justify-center gap-2 rounded-2xl bg-emerald-600 py-3 text-sm font-extrabold text-white hover:bg-emerald-500"
          >
            {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
            {isPlaying
              ? 'Đang phát hội thoại... (Bấm để dừng)'
              : hasDialogueRoles
                ? '▶ Nghe cả hội thoại (Giọng Nam ↔ Nữ bản xứ)'
                : '▶ Nghe toàn bộ bài mẫu'}
          </button>

          <div className="max-h-[420px] space-y-2.5 overflow-y-auto pr-1">
            {lesson.sentences.map((s, idx) => {
              const isCurrent = idx === activeSentenceIdx && isPlaying;
              const isRoleB = s.role === 'B';
              return (
                <div
                  key={s.id}
                  className={`flex ${hasDialogueRoles && isRoleB ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className={`w-full rounded-2xl border p-3 transition ${
                      hasDialogueRoles ? 'sm:max-w-[90%]' : ''
                    } ${
                      isCurrent
                        ? 'border-emerald-500 bg-emerald-50 ring-2 ring-emerald-300'
                        : isRoleB
                          ? 'border-sky-200 bg-sky-50/50'
                          : 'border-slate-200 bg-slate-50/70'
                    }`}
                  >
                    {s.speaker && (
                      <div className="mb-1 flex items-center justify-between">
                        <span
                          className={`rounded-full px-2 py-0.5 text-[10px] font-extrabold ${
                            isRoleB ? 'bg-sky-100 text-sky-900' : 'bg-indigo-100 text-indigo-900'
                          }`}
                        >
                          {s.role === 'A' ? '🎙️ Nam • ' : '🎙️ Nữ • '}
                          {s.speaker}
                        </span>
                        <button
                          type="button"
                          onClick={() => playTurn(idx, false)}
                          className="text-[11px] font-bold text-emerald-700 hover:underline"
                        >
                          Nghe lượt này
                        </button>
                      </div>
                    )}
                    <p className="text-[15px] font-bold leading-relaxed text-slate-900">
                      {s.en.split(/\s+/).map((w, wIdx) => (
                        <button
                          key={`${s.id}-${wIdx}`}
                          type="button"
                          onClick={() => speakWord(w)}
                          className={`mr-1 inline-block rounded px-0.5 transition hover:bg-amber-100 ${
                            isCurrent && activeWordIdx === wIdx
                              ? 'bg-amber-200 text-amber-950'
                              : ''
                          }`}
                        >
                          {w}
                        </button>
                      ))}
                    </p>
                    {showVi && <p className="mt-1 text-xs font-medium text-slate-600">{s.vi}</p>}
                  </div>
                </div>
              );
            })}
          </div>

          <button
            type="button"
            onClick={() => {
              setXp((v) => v + 10);
              goNextCard();
            }}
            className="btn-tactile-emerald flex w-full items-center justify-center gap-2 rounded-2xl bg-emerald-600 py-3.5 text-sm font-extrabold text-white hover:bg-emerald-500"
          >
            Đã nghe hiểu — Sang Thẻ 2 (+10 XP)
            <ArrowRight className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* CARD 1: LISTENING COMPREHENSION QUIZ */}
      {cardIdx === 1 && (
        <div className="animate-card-in space-y-4 rounded-3xl border border-slate-200 bg-white p-6 shadow-md">
          <div className="flex items-center justify-between">
            <span className="rounded-full bg-indigo-100 px-3 py-1 text-xs font-extrabold text-indigo-800">
              Thẻ 2/5 • Nghe & Chọn ý đúng
            </span>
            <button
              type="button"
              onClick={() => playTurn(0, false)}
              className="inline-flex items-center gap-1.5 rounded-xl border border-indigo-200 bg-indigo-50 px-3 py-1.5 text-xs font-bold text-indigo-800 hover:bg-indigo-100"
            >
              <Volume2 className="h-4 w-4" />
              Nghe lại
            </button>
          </div>

          <h2 className="text-lg font-extrabold text-slate-900">{quizData.question}</h2>

          <div className="space-y-2.5">
            {quizData.options.map((opt, idx) => {
              const selected = quizSelected === idx;
              const isCorrect = idx === quizData.answerIndex;
              let cardStyle = 'border-slate-200 bg-white text-slate-900 hover:border-indigo-400 hover:bg-indigo-50/40';
              if (quizFeedback !== null) {
                if (isCorrect) cardStyle = 'border-emerald-500 bg-emerald-50 text-emerald-950';
                else if (selected) cardStyle = 'border-rose-400 bg-rose-50 text-rose-900';
                else cardStyle = 'border-slate-200 bg-slate-50 text-slate-400';
              }
              return (
                <button
                  key={`q-${idx}`}
                  type="button"
                  disabled={quizFeedback !== null}
                  onClick={() => handleCheckQuiz(idx)}
                  className={`btn-tactile-white flex w-full items-center gap-3 rounded-2xl border-2 p-4 text-left text-sm font-bold ${cardStyle}`}
                >
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-current text-xs font-extrabold">
                    {String.fromCharCode(65 + idx)}
                  </span>
                  <span className="flex-1">{opt}</span>
                </button>
              );
            })}
          </div>

          {quizFeedback && (
            <div
              className={`space-y-3 rounded-2xl border-2 p-4 ${
                quizFeedback === 'correct'
                  ? 'border-emerald-400 bg-emerald-50 text-emerald-950'
                  : 'border-rose-300 bg-rose-50 text-rose-950'
              }`}
            >
              <p className="text-sm font-extrabold">
                {quizFeedback === 'correct'
                  ? '🎉 Chính xác! +15 XP'
                  : `💡 Chưa đúng — Đáp án đúng là: "${quizData.options[quizData.answerIndex]}"`}
              </p>
              {quizData.explanationVi && (
                <p className="text-xs font-semibold opacity-90">{quizData.explanationVi}</p>
              )}
              <button
                type="button"
                onClick={goNextCard}
                className="btn-tactile-emerald flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 py-3 text-sm font-extrabold text-white"
              >
                Tiếp tục →
              </button>
            </div>
          )}
        </div>
      )}

      {/* CARD 2: DUOLINGO WORD-BANK TAP-TO-BUILD */}
      {cardIdx === 2 && (
        <div className="animate-card-in space-y-4 rounded-3xl border border-slate-200 bg-white p-6 shadow-md">
          <div className="flex items-center justify-between">
            <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-extrabold text-amber-900">
              Thẻ 3/5 • Ghép câu nhanh (Word-Bank)
            </span>
            <button
              type="button"
              onClick={() => playTurn(Math.min(1, lesson.sentences.length - 1), false)}
              className="inline-flex items-center gap-1.5 rounded-xl border border-amber-300 bg-amber-50 px-3 py-1.5 text-xs font-bold text-amber-900 hover:bg-amber-100"
            >
              <Volume2 className="h-4 w-4" />
              Nghe câu mẫu
            </button>
          </div>

          <div>
            <p className="text-xs font-bold text-slate-500">Bấm các thẻ từ bên dưới để ghép mở đầu câu:</p>
            <p className="mt-1 text-sm font-bold text-slate-800">“{buildTargetSentence.vi}”</p>
          </div>

          {/* Drop zone */}
          <div className="min-h-[76px] rounded-2xl border-2 border-dashed border-slate-300 bg-slate-50 p-3">
            {pickedIds.length === 0 ? (
              <p className="py-3 text-center text-xs font-semibold text-slate-400">
                Bấm từng từ ở dưới để xếp câu vào đây...
              </p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {pickedIds.map((id) => {
                  const item = shuffledBank.find((b) => b.id === id);
                  if (!item) return null;
                  return (
                    <button
                      key={`picked-${id}`}
                      type="button"
                      disabled={buildFeedback !== null}
                      onClick={() => {
                        playTapSound();
                        setPickedIds((prev) => prev.filter((x) => x !== id));
                      }}
                      className="btn-tactile-white rounded-xl border border-emerald-400 bg-emerald-50 px-3 py-1.5 text-sm font-extrabold text-emerald-950"
                    >
                      {item.word}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Word Bank */}
          <div className="flex flex-wrap gap-2">
            {shuffledBank.map((item) => {
              const used = pickedIds.includes(item.id);
              return (
                <button
                  key={item.id}
                  type="button"
                  disabled={used || buildFeedback !== null}
                  onClick={() => {
                    playTapSound();
                    setPickedIds((prev) => [...prev, item.id]);
                  }}
                  className={`btn-tactile-white rounded-xl border px-3.5 py-2 text-sm font-bold ${
                    used
                      ? 'border-slate-200 bg-slate-100 text-transparent select-none'
                      : 'border-slate-300 bg-white text-slate-900 hover:border-emerald-500'
                  }`}
                >
                  {item.word}
                </button>
              );
            })}
          </div>

          {buildFeedback === null ? (
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setPickedIds([])}
                className="rounded-2xl border border-slate-300 px-4 py-3 text-xs font-bold text-slate-700 hover:bg-slate-100"
              >
                <RotateCcw className="h-4 w-4" />
              </button>
              <button
                type="button"
                disabled={pickedIds.length < buildTokens.length}
                onClick={handleCheckBuild}
                className="btn-tactile-emerald flex-1 rounded-2xl bg-emerald-600 py-3 text-sm font-extrabold text-white disabled:opacity-40"
              >
                Kiểm tra ghép câu
              </button>
            </div>
          ) : (
            <div
              className={`space-y-3 rounded-2xl border-2 p-4 ${
                buildFeedback === 'correct'
                  ? 'border-emerald-400 bg-emerald-50 text-emerald-950'
                  : 'border-rose-300 bg-rose-50 text-rose-950'
              }`}
            >
              <p className="text-sm font-extrabold">
                {buildFeedback === 'correct'
                  ? '🔥 Chuẩn từng từ! +20 XP'
                  : `💡 Thứ tự chuẩn: ${buildTokens.join(' ')}`}
              </p>
              <button
                type="button"
                onClick={goNextCard}
                className="btn-tactile-emerald w-full rounded-xl bg-emerald-600 py-3 text-sm font-extrabold text-white"
              >
                Tiếp tục →
              </button>
            </div>
          )}
        </div>
      )}

      {/* CARD 3: 1-TAP CLOZE */}
      {cardIdx === 3 && (
        <div className="animate-card-in space-y-4 rounded-3xl border border-slate-200 bg-white p-6 shadow-md">
          <div className="flex items-center justify-between">
            <span className="rounded-full bg-sky-100 px-3 py-1 text-xs font-extrabold text-sky-900">
              Thẻ 4/5 • Chọn từ khóa còn thiếu
            </span>
            <button
              type="button"
              onClick={() => playTurn(Math.min(2, lesson.sentences.length - 1), false)}
              className="inline-flex items-center gap-1.5 rounded-xl border border-sky-200 bg-sky-50 px-3 py-1.5 text-xs font-bold text-sky-800"
            >
              <Volume2 className="h-4 w-4" />
              Nghe câu
            </button>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <p className="text-base font-bold leading-relaxed text-slate-900">
              {clozeSentence.en.replace(
                new RegExp(`\\b${clozeSentence.clozeWord}\\b`, 'i'),
                clozeSelected ? `[ ${clozeSelected} ]` : '_________'
              )}
            </p>
            <p className="mt-2 text-xs font-medium text-slate-600">{clozeSentence.vi}</p>
          </div>

          <div className="grid grid-cols-2 gap-2.5">
            {clozeChoices.map((word) => {
              const isSelected = clozeSelected === word;
              const isAnswer = word.toLowerCase() === clozeSentence.clozeWord.toLowerCase();
              let style = 'border-slate-200 bg-white text-slate-900 hover:border-sky-400';
              if (clozeFeedback !== null) {
                if (isAnswer) style = 'border-emerald-500 bg-emerald-50 text-emerald-950';
                else if (isSelected) style = 'border-rose-400 bg-rose-50 text-rose-900';
                else style = 'border-slate-200 bg-slate-50 text-slate-400';
              }
              return (
                <button
                  key={word}
                  type="button"
                  disabled={clozeFeedback !== null}
                  onClick={() => handlePickCloze(word)}
                  className={`btn-tactile-white rounded-2xl border-2 py-3.5 text-sm font-extrabold ${style}`}
                >
                  {word}
                </button>
              );
            })}
          </div>

          {clozeFeedback && (
            <div
              className={`space-y-3 rounded-2xl border-2 p-4 ${
                clozeFeedback === 'correct'
                  ? 'border-emerald-400 bg-emerald-50 text-emerald-950'
                  : 'border-rose-300 bg-rose-50 text-rose-950'
              }`}
            >
              <p className="text-sm font-extrabold">
                {clozeFeedback === 'correct'
                  ? '🎯 Bắt từ khóa siêu chuẩn! +15 XP'
                  : `💡 Đáp án đúng là: ${clozeSentence.clozeWord}`}
              </p>
              <button
                type="button"
                onClick={goNextCard}
                className="btn-tactile-emerald w-full rounded-xl bg-emerald-600 py-3 text-sm font-extrabold text-white"
              >
                Sang Thẻ cuối: Nhập vai Nói →
              </button>
            </div>
          )}
        </div>
      )}

      {/* CARD 4: ELSA-STYLE SPEAKING ROLE-PLAY CARD */}
      {cardIdx === 4 && (
        <div className="animate-card-in space-y-4 rounded-3xl border border-slate-200 bg-white p-6 shadow-md">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-100 px-3 py-1 text-xs font-extrabold text-emerald-900">
            <Mic className="h-3.5 w-3.5" />
            Thẻ 5/5 • Nhập vai Nói & Chấm AI (ELSA Mode)
          </span>

          {promptPartnerSentence && (
            <div className="rounded-2xl border border-indigo-200 bg-indigo-50/70 p-3.5">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-extrabold text-indigo-900">
                  🎙️ Đối tác ({promptPartnerSentence.speaker ?? 'AI'}) hỏi bạn:
                </span>
                <button
                  type="button"
                  onClick={() => playTurn(speakIdx - 1, false)}
                  className="rounded-lg border border-indigo-200 bg-white px-2.5 py-1 text-[11px] font-bold text-indigo-800 hover:bg-indigo-100"
                >
                  Nghe AI nói
                </button>
              </div>
              <p className="mt-1.5 text-sm font-bold text-slate-900">“{promptPartnerSentence.en}”</p>
            </div>
          )}

          <div className="rounded-2xl border-2 border-emerald-200 bg-emerald-50/40 p-4">
            <p className="mb-1 text-[11px] font-extrabold uppercase tracking-wider text-emerald-800">
              Lượt của bạn — đọc theo nhịp Karaoke:
            </p>
            <p className="text-lg font-extrabold leading-relaxed text-slate-900">
              {speakingTargetSentence.en.split(/\s+/).map((w, idx) => {
                const active = isKaraokeRunning && voiceStarted && karaokeWordIdx === idx;
                return (
                  <button
                    key={`sp-${idx}`}
                    type="button"
                    onClick={() => speakWord(w)}
                    className={`mr-1.5 inline-block rounded px-1 transition ${
                      active ? 'scale-105 bg-amber-200 text-amber-950' : 'hover:bg-sky-100'
                    }`}
                  >
                    {w}
                  </button>
                );
              })}
            </p>
            <p className="mt-1.5 text-xs font-medium text-slate-600">{speakingTargetSentence.vi}</p>

            {isKaraokeRunning && (
              <div className="mt-3 space-y-1">
                <p className="text-xs font-bold text-emerald-800">
                  {voiceStarted
                    ? '🎤 Đang nghe bạn nói — xong bấm "Dừng & Chấm AI"'
                    : '🎙️ Bắt đầu đọc chữ đầu tiên để Karaoke chạy...'}
                </p>
                <div className="h-2.5 overflow-hidden rounded-full bg-slate-200">
                  <div
                    className="h-full bg-emerald-500 transition-all duration-75"
                    style={{ width: `${Math.max(4, Math.round(micLevel * 100))}%` }}
                  />
                </div>
              </div>
            )}

            {isAnalyzingAi && (
              <p className="mt-3 rounded-xl bg-sky-50 px-3 py-2 text-xs font-bold text-sky-900">
                {aiLoadProgress !== null
                  ? `⏳ Đang tải Whisper AI (${aiLoadProgress}%)...`
                  : '🧠 Whisper AI đang chấm chính xác từng chữ...'}
              </p>
            )}
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => playTurn(speakIdx, false)}
              className="btn-tactile-white inline-flex items-center gap-1.5 rounded-2xl border border-slate-300 bg-white px-4 py-3 text-xs font-extrabold text-slate-800"
            >
              <Volume2 className="h-4 w-4 text-emerald-700" />
              Nghe mẫu
            </button>
            <button
              type="button"
              disabled={isAnalyzingAi}
              onClick={() => void handleToggleKaraoke()}
              className={`btn-tactile-emerald flex-1 inline-flex items-center justify-center gap-2 rounded-2xl py-3 text-sm font-extrabold text-white disabled:opacity-50 ${
                isKaraokeRunning ? 'animate-pulse bg-rose-600' : 'bg-emerald-600 hover:bg-emerald-500'
              }`}
            >
              {isKaraokeRunning ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
              {isKaraokeRunning ? 'Dừng & Chấm AI' : 'Bấm để Nói (Whisper AI)'}
            </button>
          </div>

          {micError && (
            <p className="rounded-xl border border-amber-300 bg-amber-50 px-3 py-2 text-xs font-bold text-amber-900">
              {micError}
            </p>
          )}

          {speakReport && (
            <div className="space-y-2 rounded-2xl border border-emerald-300 bg-emerald-50/50 p-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-extrabold text-slate-800">
                  {speakReport.grade} • {speakReport.correctCount}/{speakReport.totalWords} từ chuẩn
                </span>
                <span className="text-xl font-extrabold text-emerald-700">
                  {speakReport.accuracy}%
                </span>
              </div>
              {speakReport.issues.slice(0, 2).map((iss) => (
                <div
                  key={iss.index}
                  className="flex items-center justify-between rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs"
                >
                  <div>
                    <span className="font-extrabold text-slate-900">{iss.cleanWord}</span>{' '}
                    <span className="font-mono text-slate-500">{iss.ipa ?? iss.syllables}</span>
                    <p className="text-[11px] text-slate-600">{iss.tip}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => speakWord(iss.cleanWord)}
                    className="rounded-lg bg-sky-50 px-2.5 py-1 font-bold text-sky-800"
                  >
                    Nghe chậm
                  </button>
                </div>
              ))}
            </div>
          )}

          <button
            type="button"
            onClick={goNextCard}
            className="btn-tactile-white w-full rounded-2xl border border-slate-300 bg-slate-50 py-3 text-xs font-extrabold text-slate-700 hover:bg-slate-100"
          >
            {speakReport ? 'Xem Tổng kết bài học →' : 'Tạm bỏ qua phần nói & Xem Tổng kết →'}
          </button>
        </div>
      )}

      {/* CARD 5: CELEBRATION SUMMARY */}
      {cardIdx === TOTAL_CARDS && (
        <div className="animate-card-in space-y-5 rounded-3xl border-2 border-emerald-400 bg-white p-8 text-center shadow-lg">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-amber-100 text-amber-600">
            <Trophy className="h-9 w-9" />
          </div>
          <div>
            <h2 className="text-2xl font-extrabold text-slate-900">Hoàn thành xuất sắc!</h2>
            <p className="mt-1 text-sm font-medium text-slate-600">{lesson.title}</p>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="rounded-2xl border border-amber-200 bg-amber-50 p-3">
              <p className="text-xl font-extrabold text-amber-700">+{xp}</p>
              <p className="text-[11px] font-bold text-amber-900">Tổng XP</p>
            </div>
            <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-3">
              <p className="text-xl font-extrabold text-emerald-700">
                {Math.round(((correctSteps + 1) / 5) * 100)}%
              </p>
              <p className="text-[11px] font-bold text-emerald-900">Độ chính xác</p>
            </div>
            <div className="rounded-2xl border border-sky-200 bg-sky-50 p-3">
              <p className="text-xl font-extrabold text-sky-700">
                {speakReport ? `${speakReport.accuracy}%` : '✓'}
              </p>
              <p className="text-[11px] font-bold text-sky-900">Phát âm AI</p>
            </div>
          </div>

          <button
            type="button"
            onClick={() =>
              onFinish({
                shadowingScore: speakReport?.accuracy,
                clozeDone: clozeFeedback === 'correct' || correctSteps >= 2,
                xpEarned: xp,
              })
            }
            className="btn-tactile-emerald inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-emerald-600 py-3.5 text-sm font-extrabold text-white hover:bg-emerald-500"
          >
            <CheckCircle2 className="h-5 w-5" />
            Lưu tiến độ & Quay lại Lộ trình
          </button>
        </div>
      )}
    </div>
  );
}
