import { useEffect, useRef, useState } from 'react';
import {
  ArrowLeft,
  Bookmark,
  Captions,
  CheckCircle2,
  EyeOff,
  Gamepad2,
  Keyboard,
  Languages,
  Mic,
  MicOff,
  Pause,
  Play,
  Repeat,
  SlidersHorizontal,
  SquarePen,
  Volume2,
} from 'lucide-react';
import type { GameId, Lesson, LessonSentence, WordScoreResult } from '../types/curriculum';
import { LessonMiniGames } from './LessonMiniGames';
import {
  checkClozeAnswer,
  scoreDictation,
  scoreWordAlignment,
} from '../utils/wordScoring';
import {
  analyzePronunciation,
  type PronunciationReport,
} from '../utils/pronunciationCoach';
import {
  buildKaraokeSchedule,
  startKaraokeMicSession,
  type KaraokeMicHandle,
} from '../utils/karaokeRecorder';
import { transcribeWithWhisper } from '../utils/whisperEngine';
import {
  CURATED_FEMALE_VOICES,
  isSpeechRecognitionSupported,
  speakSentence,
  startListening,
  stopListening,
  stopSpeaking,
  stopVoiceRecording,
  type TonePreset,
} from '../utils/speechEngine';

type PlayerTab = 'subtitles' | 'shadowing' | 'dictation' | 'cloze' | 'game';

interface LessonPlayerProps {
  lesson: Lesson;
  savedWords?: string[];
  onToggleSaveWord?: (word: string, contextSentence: string) => void;
  voicePreset?: string;
  onChangeVoice?: (id: string) => void;
  onFinishGame?: (gameId: GameId, score: number) => void;
  onComplete: (result: {
    shadowingScore?: number;
    dictationScore?: number;
    clozeDone?: boolean;
  }) => void;
  onBack: () => void;
}

function escapeRegExp(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function maskClozeSentence(sentence: LessonSentence): { before: string; after: string } {
  const regex = new RegExp(`\\b(${escapeRegExp(sentence.clozeWord)})\\b`, 'i');
  const parts = sentence.en.split(regex);
  if (parts.length < 3) {
    return { before: sentence.en, after: '' };
  }
  return {
    before: parts[0],
    after: parts.slice(2).join(''),
  };
}

function WordScoreBadge({
  item,
  onSpeakWord,
}: {
  item: WordScoreResult;
  onSpeakWord: (word: string) => void;
}) {
  const colorMap = {
    correct: 'bg-emerald-100 text-emerald-900 border-emerald-300 font-bold',
    near: 'bg-amber-100 text-amber-900 border-amber-300 font-bold',
    missing: 'bg-rose-100 text-rose-900 border-rose-300 font-bold line-through decoration-rose-600',
  };
  return (
    <button
      type="button"
      onClick={() => onSpeakWord(item.expected)}
      className={`inline-flex items-center gap-1 rounded-md border px-2.5 py-1 text-sm transition hover:brightness-95 ${colorMap[item.status]}`}
      title={
        item.spoken
          ? `Bạn nói: "${item.spoken}" — Bấm để nghe mẫu`
          : 'Thiếu / chưa rõ — Bấm để nghe mẫu'
      }
    >
      {item.expected}
      {item.status !== 'correct' && <Volume2 className="h-3 w-3 opacity-80" />}
    </button>
  );
}

function SentenceSelector({
  sentences,
  activeIdx,
  scoresById,
  onSelect,
}: {
  sentences: LessonSentence[];
  activeIdx: number;
  scoresById?: Record<string, number>;
  onSelect: (idx: number) => void;
}) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {sentences.map((s, idx) => {
        const score = scoresById?.[s.id];
        return (
          <button
            key={s.id}
            type="button"
            onClick={() => onSelect(idx)}
            className={`inline-flex h-8 items-center gap-1 rounded-lg px-2.5 text-xs font-bold transition ${
              idx === activeIdx
                ? 'bg-emerald-600 text-white'
                : score !== undefined && score >= 75
                  ? 'border border-emerald-300 bg-emerald-50 text-emerald-800 hover:bg-emerald-100'
                  : score !== undefined
                    ? 'border border-amber-300 bg-amber-50 text-amber-900 hover:bg-amber-100'
                    : 'border border-slate-300 bg-white text-slate-800 hover:bg-slate-100'
            }`}
          >
            <span>{idx + 1}</span>
            {score !== undefined && <span className="text-[10px] opacity-90">({score}%)</span>}
          </button>
        );
      })}
    </div>
  );
}

export function LessonPlayer({
  lesson,
  savedWords = [],
  onToggleSaveWord,
  voicePreset,
  onChangeVoice,
  onFinishGame,
  onComplete,
  onBack,
}: LessonPlayerProps) {
  const [activeTab, setActiveTab] = useState<PlayerTab>('subtitles');
  const [activeSentenceIdx, setActiveSentenceIdx] = useState(0);
  const [activeWordIdx, setActiveWordIdx] = useState<number | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [loopSentence, setLoopSentence] = useState(false);
  const [showAudioSettings, setShowAudioSettings] = useState(false);
  const [rate, setRate] = useState(1.0);
  const [fontScale, setFontScale] = useState<'normal' | 'large'>('normal');
  const [selectedVoicePreset, setSelectedVoicePreset] = useState<string>(
    voicePreset ?? CURATED_FEMALE_VOICES[0].id
  );
  const [tonePreset, setTonePreset] = useState<TonePreset>('expressive');

  // Sub / No-Sub toggles
  const [noSub, setNoSub] = useState(false);
  const [showVi, setShowVi] = useState(true);

  // Karaoke Shadowing state (real Web Audio mic + voice-triggered karaoke cursor + local Whisper AI)
  const [isKaraokeRunning, setIsKaraokeRunning] = useState(false);
  const [voiceStarted, setVoiceStarted] = useState(false);
  const [karaokeWordIdx, setKaraokeWordIdx] = useState<number>(-1);
  const [micLevel, setMicLevel] = useState(0);
  const [isAnalyzingAi, setIsAnalyzingAi] = useState(false);
  const [aiLoadProgress, setAiLoadProgress] = useState<number | null>(null);
  const [recordedAudioUrl, setRecordedAudioUrl] = useState<string | null>(null);
  const [recordingFixWord, setRecordingFixWord] = useState<string | null>(null);
  const [fixedWords, setFixedWords] = useState<Record<string, boolean>>({});
  const [spokenText, setSpokenText] = useState('');
  const [micError, setMicError] = useState<string | null>(null);
  const [shadowingResults, setShadowingResults] = useState<
    Record<string, PronunciationReport>
  >({});

  const karaokeMicRef = useRef<KaraokeMicHandle | null>(null);
  const karaokeRafRef = useRef<number | null>(null);

  // Dictation state
  const [dictationInputs, setDictationInputs] = useState<Record<string, string>>({});
  const [dictationResults, setDictationResults] = useState<
    Record<string, { words: WordScoreResult[]; accuracy: number }>
  >({});

  // Cloze state
  const [clozeAnswers, setClozeAnswers] = useState<Record<string, string>>({});
  const [clozeChecked, setClozeChecked] = useState<Record<string, boolean> | null>(null);

  const currentSentence = lesson.sentences[activeSentenceIdx] ?? lesson.sentences[0];
  const micSupported = isSpeechRecognitionSupported();
  const currentShadowResult = shadowingResults[currentSentence.id] ?? null;
  const currentDictInput = dictationInputs[currentSentence.id] ?? '';
  const currentDictResult = dictationResults[currentSentence.id] ?? null;

  const stopKaraokeSession = async (shouldTranscribe = false) => {
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

    const recording = await handle.stop();
    if (recording.blobUrl) {
      setRecordedAudioUrl((prev) => {
        if (prev) URL.revokeObjectURL(prev);
        return recording.blobUrl;
      });
    }

    if (!shouldTranscribe) return;

    // Strict honesty gate: if user didn't speak, NEVER give fake score!
    if (!recording.hasVoice || recording.pcm16k.length < 1600) {
      const zeroReport = analyzePronunciation(currentSentence.en, '');
      setSpokenText('');
      setShadowingResults((prev) => ({ ...prev, [currentSentence.id]: zeroReport }));
      setMicError(
        '0% — Không phát hiện giọng nói từ Micro. Hãy kiểm tra Micro và đọc to, rõ hơn!'
      );
      return;
    }

    setIsAnalyzingAi(true);
    setMicError(null);
    try {
      const transcript = await transcribeWithWhisper(recording.pcm16k, (pct) => {
        setAiLoadProgress(pct < 100 ? pct : null);
      });
      setAiLoadProgress(null);
      setSpokenText(transcript);
      const report = analyzePronunciation(currentSentence.en, transcript);
      setShadowingResults((prev) => ({ ...prev, [currentSentence.id]: report }));
      onComplete({ shadowingScore: report.accuracy });
      if (!transcript) {
        setMicError('AI chưa nhận diện được từ tiếng Anh rõ ràng — hãy nghe mẫu và đọc lại chậm hơn.');
      }
    } catch (err) {
      setAiLoadProgress(null);
      setMicError(
        err instanceof Error
          ? `Lỗi Whisper AI: ${err.message}`
          : 'Không thể giải mã giọng nói bằng Whisper AI.'
      );
    } finally {
      setIsAnalyzingAi(false);
    }
  };

  useEffect(() => {
    return () => {
      stopSpeaking();
      stopListening(true);
      stopVoiceRecording();
      void stopKaraokeSession(false);
    };
  }, []);

  const stopAllAudioAndMic = () => {
    stopSpeaking();
    stopListening(true);
    stopVoiceRecording();
    void stopKaraokeSession(false);
    setIsPlaying(false);
    setRecordingFixWord(null);
    setActiveWordIdx(null);
  };

  const handleSelectSentence = (idx: number) => {
    stopAllAudioAndMic();
    setActiveSentenceIdx(idx);
    setSpokenText('');
    setMicError(null);
  };

  const handleSelectTab = (tab: PlayerTab) => {
    stopAllAudioAndMic();
    setActiveTab(tab);
  };

  const playIndex = (index: number) => {
    const sentence = lesson.sentences[index];
    if (!sentence) {
      setIsPlaying(false);
      setActiveWordIdx(null);
      return;
    }

    stopListening(true);
    setActiveSentenceIdx(index);
    setIsPlaying(true);
    setActiveWordIdx(0);

    speakSentence(
      sentence.en,
      rate,
      {
        onWordIndex: (wIdx) => setActiveWordIdx(wIdx),
        onEnd: () => {
          if (loopSentence) {
            playIndex(index);
          } else if (activeTab === 'subtitles' && index + 1 < lesson.sentences.length) {
            playIndex(index + 1);
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
      selectedVoicePreset,
      tonePreset,
      lesson.isCustom ? undefined : sentence.id
    );
  };

  const handleSpeakSingleWord = (word: string, slow = false) => {
    const clean = word.replace(/^[^\w]+|[^\w]+$/g, '');
    if (!clean) return;
    setIsPlaying(false);
    setActiveWordIdx(null);
    speakSentence(clean, slow ? 0.72 : 0.88, {}, selectedVoicePreset, tonePreset);
  };

  const handleTogglePlay = () => {
    if (isPlaying) {
      stopSpeaking();
      setIsPlaying(false);
      setActiveWordIdx(null);
    } else {
      playIndex(activeSentenceIdx);
    }
  };

  const handleScoreShadowing = (textToScore: string) => {
    const report = analyzePronunciation(currentSentence.en, textToScore);
    setShadowingResults((prev) => ({ ...prev, [currentSentence.id]: report }));
    onComplete({ shadowingScore: report.accuracy });
  };

  const handleStartKaraoke = async () => {
    if (isKaraokeRunning) {
      await stopKaraokeSession(true);
      return;
    }

    stopSpeaking();
    setIsPlaying(false);
    setMicError(null);
    setVoiceStarted(false);
    setKaraokeWordIdx(-1);

    try {
      const micHandle = await startKaraokeMicSession();
      karaokeMicRef.current = micHandle;
      setIsKaraokeRunning(true);

      const schedule = buildKaraokeSchedule(currentSentence.en, rate);
      const totalMs = schedule[schedule.length - 1]?.endMs ?? 2500;
      let speechStartTime: number | null = null;

      const tick = () => {
        if (!karaokeMicRef.current) return;
        const level = karaokeMicRef.current.getLevel();
        setMicLevel(level);

        // Karaoke cursor ONLY starts advancing once real voice is detected (> 0.05)
        if (speechStartTime === null) {
          if (level >= 0.05) {
            speechStartTime = performance.now();
            setVoiceStarted(true);
            setKaraokeWordIdx(0);
          }
          karaokeRafRef.current = requestAnimationFrame(tick);
          return;
        }

        const elapsed = performance.now() - speechStartTime;
        const currentSlot =
          schedule.find((s) => elapsed >= s.startMs && elapsed < s.endMs) ??
          schedule[schedule.length - 1];

        if (currentSlot) {
          setKaraokeWordIdx(currentSlot.index);
        }

        if (elapsed >= totalMs + 1000) {
          void stopKaraokeSession(true);
          return;
        }
        karaokeRafRef.current = requestAnimationFrame(tick);
      };

      karaokeRafRef.current = requestAnimationFrame(tick);
    } catch (err) {
      setMicError(
        err instanceof Error
          ? err.message
          : 'Không thể bật Micro. Vui lòng cho phép truy cập Micro trong Safari/Trình duyệt.'
      );
      setIsKaraokeRunning(false);
    }
  };

  const handlePracticeSingleWord = (sentenceId: string, cleanWord: string) => {
    const key = `${sentenceId}:${cleanWord.toLowerCase()}`;
    if (recordingFixWord === key) {
      stopListening(false);
      setRecordingFixWord(null);
      return;
    }
    stopSpeaking();
    setIsPlaying(false);
    setMicError(null);
    let latest = '';

    const started = startListening(
      (transcript) => {
        latest = transcript;
      },
      (err) => {
        setRecordingFixWord(null);
        if (err === 'NETWORK_BLOCKED') {
          setMicError(
            `Trình duyệt chặn Speech-to-Text (network). Hãy bấm "Nghe chậm 0.75x" rồi dùng nút Karaoke ở trên để luyện nhịp & nghe lại giọng mình!`
          );
        } else {
          setMicError(err);
        }
      },
      () => {
        setRecordingFixWord(null);
        if (latest.trim()) {
          const check = scoreWordAlignment(cleanWord, latest);
          if (check.accuracy >= 80) {
            setFixedWords((prev) => ({ ...prev, [key]: true }));
          } else {
            setMicError(`Từ "${cleanWord}": máy nghe "${latest.trim()}" — bấm nghe chậm 0.75x và thử lại nhé!`);
          }
        }
      }
    );
    if (started) setRecordingFixWord(key);
  };

  const handleCheckDictation = () => {
    const res = scoreDictation(currentSentence.en, currentDictInput);
    setDictationResults((prev) => ({ ...prev, [currentSentence.id]: res }));
    onComplete({ dictationScore: res.accuracy });
  };

  const handleCheckCloze = () => {
    const results: Record<string, boolean> = {};
    for (const s of lesson.sentences) {
      results[s.id] = checkClozeAnswer(s.clozeWord, clozeAnswers[s.id] ?? '');
    }
    setClozeChecked(results);
    const correctCount = Object.values(results).filter(Boolean).length;
    if (correctCount === lesson.sentences.length) {
      onComplete({ clozeDone: true });
    }
  };

  const shadowingScoresById: Record<string, number> = {};
  for (const [sid, rep] of Object.entries(shadowingResults)) {
    shadowingScoresById[sid] = rep.accuracy;
  }
  const scoredCount = Object.keys(shadowingScoresById).length;
  const lessonAvgScore =
    scoredCount === 0
      ? null
      : Math.round(
          Object.values(shadowingScoresById).reduce((a, b) => a + b, 0) / scoredCount
        );
  const clozeCorrectCount = clozeChecked
    ? Object.values(clozeChecked).filter(Boolean).length
    : 0;

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      {/* Compact Header Card */}
      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex items-center justify-between gap-2">
          <button
            type="button"
            onClick={() => {
              stopAllAudioAndMic();
              onBack();
            }}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-bold text-slate-800 hover:bg-slate-100"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Lộ trình
          </button>

          <div className="min-w-0 flex-1 text-center">
            <h1 className="truncate text-base font-extrabold text-slate-900">{lesson.title}</h1>
            <p className="truncate text-[11px] font-semibold text-slate-500">{lesson.scenario}</p>
          </div>

          <button
            type="button"
            onClick={() => setShowAudioSettings((v) => !v)}
            className={`inline-flex items-center gap-1 rounded-lg border px-2.5 py-1.5 text-xs font-bold ${
              showAudioSettings
                ? 'border-emerald-600 bg-emerald-600 text-white'
                : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-100'
            }`}
            title="Cài đặt giọng đọc & tốc độ"
          >
            <SlidersHorizontal className="h-3.5 w-3.5" />
            Giọng
          </button>
        </div>

        {/* Collapsible Voice & Speed Settings */}
        {showAudioSettings && (
          <div className="mt-3 space-y-2.5 rounded-xl border border-slate-200 bg-slate-50 p-3">
            <div className="flex flex-wrap items-center gap-2">
              <select
                aria-label="Giọng nữ truyền cảm"
                value={selectedVoicePreset}
                onChange={(e) => {
                  setSelectedVoicePreset(e.target.value);
                  onChangeVoice?.(e.target.value);
                }}
                className="min-w-0 flex-1 rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-bold text-slate-800"
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
                    rate,
                    {},
                    selectedVoicePreset,
                    tonePreset,
                    'preview'
                  )
                }
                className="rounded-lg border border-emerald-300 bg-emerald-50 px-3 py-1.5 text-xs font-bold text-emerald-800 hover:bg-emerald-100"
              >
                Thử giọng
              </button>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <select
                aria-label="Tốc độ đọc"
                value={rate}
                onChange={(e) => setRate(Number(e.target.value))}
                className="rounded-lg border border-slate-300 bg-white px-2.5 py-1 text-xs font-bold text-slate-800"
              >
                <option value={0.75}>Tốc độ 0.75x</option>
                <option value={1.0}>Tốc độ 1.0x</option>
                <option value={1.15}>Tốc độ 1.15x</option>
                <option value={1.25}>Tốc độ 1.25x</option>
              </select>
              <select
                aria-label="Ngữ điệu"
                value={tonePreset}
                onChange={(e) => setTonePreset(e.target.value as TonePreset)}
                className="rounded-lg border border-slate-300 bg-white px-2.5 py-1 text-xs font-bold text-slate-800"
              >
                <option value="expressive">Ngữ điệu: Truyền cảm</option>
                <option value="executive">Ngữ điệu: Chuyên nghiệp</option>
                <option value="coaching">Ngữ điệu: Chậm rõ âm</option>
              </select>
              <button
                type="button"
                onClick={() => setFontScale((s) => (s === 'normal' ? 'large' : 'normal'))}
                className="rounded-lg border border-slate-300 bg-white px-2.5 py-1 text-xs font-bold text-slate-800"
              >
                Cỡ chữ: {fontScale === 'large' ? 'Lớn' : 'Chuẩn'}
              </button>
            </div>
          </div>
        )}

        {/* Clean 1-Row Core Controls */}
        <div className="mt-3 flex flex-wrap items-center justify-center gap-2 border-t border-slate-100 pt-3">
          <button
            type="button"
            onClick={handleTogglePlay}
            className="inline-flex items-center gap-1.5 rounded-full bg-emerald-600 px-4 py-1.5 text-xs font-bold text-white shadow-sm hover:bg-emerald-700"
          >
            {isPlaying ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
            {isPlaying ? 'Tạm dừng' : 'Phát câu'}
          </button>

          <button
            type="button"
            onClick={() => setLoopSentence((v) => !v)}
            className={`inline-flex items-center gap-1 rounded-full border px-3 py-1.5 text-xs font-bold ${
              loopSentence
                ? 'border-amber-400 bg-amber-100 text-amber-900'
                : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-100'
            }`}
          >
            <Repeat className="h-3.5 w-3.5" />
            Lặp
          </button>

          <button
            type="button"
            onClick={() => setShowVi((v) => !v)}
            disabled={noSub}
            className={`inline-flex items-center gap-1 rounded-full border px-3 py-1.5 text-xs font-bold ${
              showVi && !noSub
                ? 'border-emerald-400 bg-emerald-50 text-emerald-900'
                : 'border-slate-300 bg-white text-slate-600 hover:bg-slate-100 disabled:opacity-40'
            }`}
          >
            <Languages className="h-3.5 w-3.5" />
            Dịch Việt
          </button>

          <button
            type="button"
            onClick={() => setNoSub((v) => !v)}
            className={`inline-flex items-center gap-1 rounded-full border px-3 py-1.5 text-xs font-bold ${
              noSub
                ? 'border-rose-400 bg-rose-100 text-rose-900'
                : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-100'
            }`}
          >
            <EyeOff className="h-3.5 w-3.5" />
            No-Sub
          </button>
        </div>

        {/* 5 Clean Practice Tabs */}
        <div className="mt-3 grid grid-cols-5 gap-1.5">
          {[
            { id: 'subtitles', label: 'Phụ đề', icon: Captions },
            { id: 'shadowing', label: 'Shadowing', icon: Mic },
            { id: 'dictation', label: 'Chính tả', icon: Keyboard },
            { id: 'cloze', label: 'Điền từ', icon: SquarePen },
            { id: 'game', label: 'Mini-Game', icon: Gamepad2 },
          ].map((tab) => {
            const Icon = tab.icon;
            const active = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => handleSelectTab(tab.id as PlayerTab)}
                className={`flex flex-col items-center justify-center gap-1 rounded-xl border py-2 text-[11px] font-bold transition sm:flex-row sm:text-xs ${
                  active
                    ? 'border-emerald-600 bg-emerald-50 text-emerald-900'
                    : 'border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100'
                }`}
              >
                <Icon className="h-3.5 w-3.5" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* TAB 1: CLEAN TRANSCRIPT (Tap any word to hear it, tap Play for full sentence) */}
      {activeTab === 'subtitles' && (
        <div className="space-y-2.5 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          {noSub ? (
            <div className="py-10 text-center text-sm font-semibold text-slate-600">
              <EyeOff className="mx-auto mb-2 h-6 w-6 text-slate-400" />
              Chế độ nghe không phụ đề (No-Sub) đang bật — bấm Phát câu để nghe thuần!
            </div>
          ) : (
            <>
              <p className="text-[11px] font-semibold text-slate-500">
                Mẹo: Bấm nút ▶ để nghe cả câu, hoặc <strong>bấm trực tiếp vào từng chữ</strong> để nghe phát âm riêng chữ đó.
              </p>
              {lesson.sentences.map((s, idx) => {
                const isCurrent = idx === activeSentenceIdx;
                return (
                  <div
                    key={s.id}
                    className={`rounded-xl border p-3.5 transition ${
                      isCurrent
                        ? 'border-emerald-500 bg-emerald-50/60'
                        : 'border-slate-200 bg-white hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <button
                        type="button"
                        onClick={() => playIndex(idx)}
                        className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-emerald-800 hover:bg-emerald-200"
                        title={`Phát câu ${idx + 1}`}
                      >
                        <Play className="h-3.5 w-3.5" />
                      </button>

                      <div className="min-w-0 flex-1 space-y-1">
                        <p
                          className={`font-bold leading-relaxed ${
                            fontScale === 'large' ? 'text-lg' : 'text-base'
                          }`}
                        >
                          {s.en.split(/\s+/).map((word, wIdx) => {
                            const isWordActive = isCurrent && isPlaying && activeWordIdx === wIdx;
                            return (
                              <button
                                key={`${s.id}-w-${wIdx}`}
                                type="button"
                                onClick={() => handleSpeakSingleWord(word, false)}
                                className={`mr-1.5 inline-block rounded px-0.5 text-left transition hover:bg-sky-100 hover:text-sky-900 ${
                                  isWordActive
                                    ? 'border-b-2 border-amber-600 bg-amber-100 text-amber-900'
                                    : 'text-slate-900'
                                }`}
                                title={`Bấm để nghe từ "${word}"`}
                              >
                                {word}
                              </button>
                            );
                          })}
                        </p>
                        {showVi && (
                          <p className="text-sm font-medium text-slate-600">{s.vi}</p>
                        )}
                      </div>

                      <button
                        type="button"
                        onClick={() => {
                          stopAllAudioAndMic();
                          setActiveSentenceIdx(idx);
                          setActiveTab('shadowing');
                        }}
                        className="shrink-0 rounded-lg border border-slate-200 bg-slate-50 px-2 py-1 text-[11px] font-bold text-slate-700 hover:border-emerald-400 hover:text-emerald-800"
                        title="Luyện đọc & chấm câu này"
                      >
                        {shadowingScoresById[s.id] !== undefined
                          ? `${shadowingScoresById[s.id]}%`
                          : '🎤 Đọc'}
                      </button>
                    </div>
                  </div>
                );
              })}
            </>
          )}
        </div>
      )}

      {/* TAB 2: FOCUSED SHADOWING & WORD-BY-WORD CORRECTION */}
      {activeTab === 'shadowing' && (
        <div className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-sm font-extrabold text-slate-900">
              Câu {activeSentenceIdx + 1}/{lesson.sentences.length}
              {lessonAvgScore !== null && (
                <span className="ml-2 text-xs font-bold text-emerald-700">
                  • TB: {lessonAvgScore}%
                </span>
              )}
            </h2>
            <SentenceSelector
              sentences={lesson.sentences}
              activeIdx={activeSentenceIdx}
              scoresById={shadowingScoresById}
              onSelect={handleSelectSentence}
            />
          </div>

          {/* Live Karaoke Sentence Stage */}
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
            <p className="text-lg font-extrabold leading-relaxed text-slate-900">
              {currentSentence.en.split(/\s+/).map((word, idx) => {
                const isActiveKaraoke = isKaraokeRunning && voiceStarted && karaokeWordIdx === idx;
                const isPassed = isKaraokeRunning && voiceStarted && idx < karaokeWordIdx;
                const colorClass = isActiveKaraoke
                  ? 'scale-105 bg-amber-200 text-amber-950 border-b-2 border-amber-600'
                  : isPassed
                    ? 'text-slate-500'
                    : 'text-slate-900 hover:bg-sky-100 hover:text-sky-900';

                return (
                  <button
                    key={`sh-word-${idx}`}
                    type="button"
                    onClick={() => handleSpeakSingleWord(word, false)}
                    className={`mr-1.5 inline-block rounded px-1 py-0.5 transition-all ${colorClass}`}
                    title={`Bấm để nghe từ "${word}"`}
                  >
                    {word}
                  </button>
                );
              })}
            </p>
            {showVi && (
              <p className="mt-1.5 text-xs font-medium text-slate-600">{currentSentence.vi}</p>
            )}

            {/* Live Microphone Waveform Meter */}
            {isKaraokeRunning && (
              <div className="mt-3 space-y-1">
                <div className="flex items-center justify-between text-[11px] font-bold text-emerald-800">
                  <span>
                    {voiceStarted
                      ? '🎤 Đang chạy nhịp Karaoke — đọc xong bấm "Dừng & Chấm AI"'
                      : '🎙️ Đang chờ bạn bắt đầu đọc chữ đầu tiên...'}
                  </span>
                  <span>Mic: {Math.round(micLevel * 100)}%</span>
                </div>
                <div className="h-2.5 w-full overflow-hidden rounded-full bg-slate-200">
                  <div
                    className="h-full bg-emerald-500 transition-all duration-75"
                    style={{ width: `${Math.max(4, Math.round(micLevel * 100))}%` }}
                  />
                </div>
              </div>
            )}

            {isAnalyzingAi && (
              <div className="mt-3 rounded-lg border border-sky-200 bg-sky-50 px-3 py-2 text-xs font-bold text-sky-900">
                {aiLoadProgress !== null
                  ? `⏳ Đang tải lõi Whisper AI vào trình duyệt (chỉ tải 1 lần): ${aiLoadProgress}%...`
                  : '🧠 Whisper AI đang phân tích chính xác từng chữ từ giọng đọc của bạn...'}
              </div>
            )}
          </div>

          {/* Primary Karaoke + Sample Actions */}
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => playIndex(activeSentenceIdx)}
              disabled={isAnalyzingAi}
              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-xs font-bold text-slate-800 hover:bg-slate-100 disabled:opacity-50"
            >
              <Volume2 className="h-4 w-4 text-emerald-700" />
              Nghe mẫu
            </button>

            <button
              type="button"
              disabled={isAnalyzingAi}
              onClick={() => void handleStartKaraoke()}
              className={`inline-flex items-center gap-1.5 rounded-xl px-5 py-2 text-xs font-extrabold shadow-sm disabled:opacity-50 ${
                isKaraokeRunning
                  ? 'animate-pulse bg-rose-600 text-white'
                  : 'bg-emerald-600 text-white hover:bg-emerald-700'
              }`}
            >
              {isKaraokeRunning ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
              {isKaraokeRunning ? 'Dừng & Chấm AI' : 'Bắt đầu đọc Karaoke (AI)'}
            </button>
          </div>

          {recordedAudioUrl && (
            <div className="flex flex-wrap items-center gap-3 rounded-xl border border-sky-200 bg-sky-50 px-3 py-2">
              <span className="text-xs font-bold text-sky-900">So sánh giọng bạn:</span>
              <audio controls src={recordedAudioUrl} className="h-8 flex-1" />
            </div>
          )}

          {micError && (
            <p className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-900">
              {micError}
            </p>
          )}

          {/* Compact transcript box */}
          <div className="flex flex-col gap-2 sm:flex-row">
            <textarea
              rows={2}
              value={spokenText}
              onChange={(e) => setSpokenText(e.target.value)}
              placeholder="Nhập hoặc dán câu bạn vừa nói (hoặc bấm Fn x2 / 🎤 bàn phím)..."
              className="flex-1 rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-900 placeholder-slate-400 focus:border-emerald-600 focus:outline-none"
            />
            <button
              type="button"
              onClick={() => handleScoreShadowing(spokenText)}
              className="shrink-0 rounded-xl border border-emerald-600 bg-emerald-50 px-4 py-2 text-xs font-bold text-emerald-900 hover:bg-emerald-100"
            >
              Chấm điểm từng chữ
            </button>
          </div>

          {/* Focused Result & Word Fixer */}
          {currentShadowResult && (
            <div className="space-y-3 rounded-xl border border-emerald-300 bg-emerald-50/40 p-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-700">
                  {currentShadowResult.grade} • {currentShadowResult.correctCount}/
                  {currentShadowResult.totalWords} từ chuẩn
                </span>
                <span className="text-xl font-extrabold text-emerald-700">
                  {currentShadowResult.accuracy}%
                </span>
              </div>

              <div className="flex flex-wrap gap-1.5">
                {currentShadowResult.words.map((w, i) => (
                  <WordScoreBadge
                    key={`sh-${currentSentence.id}-${i}`}
                    item={w}
                    onSpeakWord={(word) => handleSpeakSingleWord(word, false)}
                  />
                ))}
              </div>

              {currentShadowResult.issues.length > 0 ? (
                <div className="space-y-2 border-t border-emerald-200 pt-3">
                  <h3 className="text-xs font-extrabold text-rose-700">
                    Sửa từng chữ chưa chuẩn ({currentShadowResult.issues.length} từ):
                  </h3>
                  {currentShadowResult.issues.map((issue) => {
                    const fixKey = `${currentSentence.id}:${issue.cleanWord.toLowerCase()}`;
                    const isFixed = Boolean(fixedWords[fixKey]);
                    const isRecThis = recordingFixWord === fixKey;
                    const isSaved = savedWords.some(
                      (sw) => sw.toLowerCase() === issue.cleanWord.toLowerCase()
                    );
                    return (
                      <div
                        key={`fix-${currentSentence.id}-${issue.index}`}
                        className={`rounded-xl border p-3 ${
                          isFixed ? 'border-emerald-300 bg-emerald-50' : 'border-slate-200 bg-white'
                        }`}
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-extrabold text-slate-900">
                              {issue.cleanWord}
                            </span>
                            <span className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-[11px] font-bold text-slate-600">
                              {issue.syllables}
                            </span>
                            {isFixed ? (
                              <span className="rounded-full bg-emerald-600 px-2 py-0.5 text-[10px] font-bold text-white">
                                ✓ Đã sửa
                              </span>
                            ) : (
                              <span className="text-[11px] font-bold text-rose-700">
                                {issue.spoken ? `Nghe: "${issue.spoken}"` : 'Thiếu âm'}
                              </span>
                            )}
                          </div>

                          <div className="flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => handleSpeakSingleWord(issue.cleanWord, true)}
                              className="inline-flex items-center gap-1 rounded-lg border border-sky-300 bg-sky-50 px-2 py-1 text-[11px] font-bold text-sky-900 hover:bg-sky-100"
                            >
                              <Volume2 className="h-3 w-3" />
                              Nghe chậm 0.75x
                            </button>
                            {micSupported && (
                              <button
                                type="button"
                                onClick={() =>
                                  handlePracticeSingleWord(currentSentence.id, issue.cleanWord)
                                }
                                className={`inline-flex items-center gap-1 rounded-lg px-2 py-1 text-[11px] font-bold ${
                                  isRecThis
                                    ? 'animate-pulse bg-rose-600 text-white'
                                    : 'bg-emerald-600 text-white hover:bg-emerald-700'
                                }`}
                              >
                                <Mic className="h-3 w-3" />
                                {isRecThis ? 'Nghe...' : 'Đọc lại'}
                              </button>
                            )}
                            {onToggleSaveWord && (
                              <button
                                type="button"
                                onClick={() =>
                                  onToggleSaveWord(issue.cleanWord, currentSentence.en)
                                }
                                className={`rounded-lg border p-1 text-xs ${
                                  isSaved
                                    ? 'border-amber-400 bg-amber-50 text-amber-700'
                                    : 'border-slate-300 text-slate-500 hover:bg-slate-100'
                                }`}
                                title="Lưu từ khó"
                              >
                                <Bookmark className="h-3 w-3" />
                              </button>
                            )}
                          </div>
                        </div>
                        <p className="mt-1 text-xs font-medium text-slate-600">{issue.tip}</p>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className="text-xs font-bold text-emerald-800">
                  ✓ Đọc chuẩn 100% tất cả các chữ trong câu này!
                </p>
              )}
            </div>
          )}
        </div>
      )}

      {/* TAB 3: DICTATION */}
      {activeTab === 'dictation' && (
        <div className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-sm font-extrabold text-slate-900">
              Chính tả — Câu {activeSentenceIdx + 1}/{lesson.sentences.length}
            </h2>
            <SentenceSelector
              sentences={lesson.sentences}
              activeIdx={activeSentenceIdx}
              onSelect={handleSelectSentence}
            />
          </div>

          <button
            type="button"
            onClick={() => playIndex(activeSentenceIdx)}
            className="inline-flex items-center gap-2 rounded-lg border border-emerald-300 bg-emerald-50 px-3 py-1.5 text-xs font-bold text-emerald-800 hover:bg-emerald-100"
          >
            <Volume2 className="h-4 w-4" />
            Nghe câu {activeSentenceIdx + 1}
          </button>

          <textarea
            rows={3}
            value={currentDictInput}
            onChange={(e) =>
              setDictationInputs((prev) => ({ ...prev, [currentSentence.id]: e.target.value }))
            }
            placeholder="Nghe và gõ lại nguyên văn câu tiếng Anh..."
            className="w-full rounded-xl border border-slate-300 bg-white p-3 text-sm font-medium text-slate-900 placeholder-slate-400 focus:border-emerald-600 focus:outline-none"
          />

          <div className="flex justify-end">
            <button
              type="button"
              onClick={handleCheckDictation}
              className="rounded-xl bg-emerald-600 px-5 py-2 text-xs font-bold text-white hover:bg-emerald-700"
            >
              Chấm chính tả
            </button>
          </div>

          {currentDictResult && (
            <div className="space-y-2 rounded-xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-xs font-bold text-emerald-700">
                Độ chính xác: {currentDictResult.accuracy}%
              </p>
              <div className="flex flex-wrap gap-1.5">
                {currentDictResult.words.map((w, i) => (
                  <WordScoreBadge
                    key={`dict-${currentSentence.id}-${i}`}
                    item={w}
                    onSpeakWord={(word) => handleSpeakSingleWord(word, false)}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB 4: CLOZE */}
      {activeTab === 'cloze' && (
        <div className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-extrabold text-slate-900">Điền từ khóa chuyên ngành</h2>
            {clozeChecked && (
              <span className="inline-flex items-center gap-1 text-xs font-bold text-emerald-700">
                <CheckCircle2 className="h-4 w-4" />
                {clozeCorrectCount} / {lesson.sentences.length} đúng
              </span>
            )}
          </div>

          <div className="space-y-3">
            {lesson.sentences.map((s, idx) => {
              const { before, after } = maskClozeSentence(s);
              const isCorrect = clozeChecked?.[s.id];
              return (
                <div
                  key={s.id}
                  className="rounded-xl border border-slate-200 bg-slate-50 p-3.5"
                >
                  <div className="mb-1.5 flex items-center justify-between text-xs font-semibold text-slate-500">
                    <span>Câu {idx + 1}</span>
                    <button
                      type="button"
                      onClick={() => playIndex(idx)}
                      className="font-bold text-emerald-700 hover:underline"
                    >
                      Nghe câu {idx + 1}
                    </button>
                  </div>
                  <p className="text-sm font-semibold leading-loose text-slate-900">
                    {before}
                    <input
                      type="text"
                      value={clozeAnswers[s.id] ?? ''}
                      onChange={(e) =>
                        setClozeAnswers((prev) => ({ ...prev, [s.id]: e.target.value }))
                      }
                      placeholder="Nhập từ còn thiếu"
                      className={`mx-1.5 w-36 rounded-md border bg-white px-2.5 py-0.5 text-center text-sm font-bold focus:outline-none ${
                        clozeChecked
                          ? isCorrect
                            ? 'border-emerald-600 text-emerald-800'
                            : 'border-rose-600 text-rose-800'
                          : 'border-slate-300 text-slate-900 focus:border-emerald-600'
                      }`}
                    />
                    {after}
                  </p>
                  {clozeChecked && !isCorrect && (
                    <p className="mt-1 text-xs font-semibold text-amber-700">
                      Đáp án đúng: <strong>{s.clozeWord}</strong>
                    </p>
                  )}
                </div>
              );
            })}
          </div>

          <div className="flex justify-end">
            <button
              type="button"
              onClick={handleCheckCloze}
              className="rounded-xl bg-emerald-600 px-5 py-2 text-xs font-bold text-white hover:bg-emerald-700"
            >
              Kiểm tra Điền từ
            </button>
          </div>
        </div>
      )}

      {/* TAB 5: MINI-GAME */}
      {activeTab === 'game' && (
        <LessonMiniGames
          lesson={lesson}
          voicePreset={selectedVoicePreset}
          tonePreset={tonePreset}
          onFinishGame={onFinishGame}
        />
      )}
    </div>
  );
}
