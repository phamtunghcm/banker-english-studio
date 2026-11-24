import { useEffect, useState } from 'react';
import {
  ArrowLeft,
  Captions,
  CheckCircle2,
  EyeOff,
  Keyboard,
  Languages,
  Mic,
  MicOff,
  Pause,
  Play,
  Repeat,
  SquarePen,
  Volume2,
} from 'lucide-react';
import type { Lesson, LessonSentence, WordScoreResult } from '../types/curriculum';
import {
  checkClozeAnswer,
  scoreDictation,
  scoreWordAlignment,
} from '../utils/wordScoring';
import {
  isSpeechRecognitionSupported,
  speakSentence,
  startListening,
  stopListening,
  stopSpeaking,
} from '../utils/speechEngine';

type PlayerTab = 'subtitles' | 'shadowing' | 'dictation' | 'cloze';

interface LessonPlayerProps {
  lesson: Lesson;
  onComplete: (result: {
    shadowingScore?: number;
    dictationScore?: number;
    clozeDone?: boolean;
  }) => void;
  onBack: () => void;
}

function WordScoreBadge({ item }: { item: WordScoreResult }) {
  const colorMap = {
    correct: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40',
    near: 'bg-amber-500/20 text-amber-300 border-amber-500/40',
    missing: 'bg-rose-500/20 text-rose-300 border-rose-500/40 line-through decoration-rose-400/70',
  };
  return (
    <span
      className={`inline-flex items-center rounded-md border px-2 py-0.5 text-sm font-medium ${colorMap[item.status]}`}
      title={item.spoken ? `Bạn nói: "${item.spoken}"` : 'Thiếu hoặc chưa khớp'}
    >
      {item.expected}
    </span>
  );
}

function maskClozeSentence(sentence: LessonSentence): { before: string; after: string } {
  const regex = new RegExp(`(${sentence.clozeWord})`, 'i');
  const parts = sentence.en.split(regex);
  if (parts.length < 3) {
    return { before: sentence.en, after: '' };
  }
  return {
    before: parts[0],
    after: parts.slice(2).join(''),
  };
}

export function LessonPlayer({ lesson, onComplete, onBack }: LessonPlayerProps) {
  const [activeTab, setActiveTab] = useState<PlayerTab>('subtitles');
  const [activeSentenceIdx, setActiveSentenceIdx] = useState(0);
  const [activeWordIdx, setActiveWordIdx] = useState<number | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [loopSentence, setLoopSentence] = useState(false);
  const [rate, setRate] = useState(1.0);
  const [fontScale, setFontScale] = useState<'normal' | 'large'>('normal');

  // Sub / No-Sub toggles
  const [noSub, setNoSub] = useState(false);
  const [showVi, setShowVi] = useState(true);

  // Shadowing state
  const [isRecording, setIsRecording] = useState(false);
  const [spokenText, setSpokenText] = useState('');
  const [micError, setMicError] = useState<string | null>(null);
  const [shadowingResult, setShadowingResult] = useState<{
    words: WordScoreResult[];
    accuracy: number;
  } | null>(null);

  // Dictation state
  const [dictationInput, setDictationInput] = useState('');
  const [dictationResult, setDictationResult] = useState<{
    words: WordScoreResult[];
    accuracy: number;
  } | null>(null);

  // Cloze state
  const [clozeAnswers, setClozeAnswers] = useState<Record<string, string>>({});
  const [clozeChecked, setClozeChecked] = useState<Record<string, boolean> | null>(null);

  const currentSentence = lesson.sentences[activeSentenceIdx] ?? lesson.sentences[0];
  const micSupported = isSpeechRecognitionSupported();

  useEffect(() => {
    return () => {
      stopSpeaking();
      stopListening();
    };
  }, []);

  const playIndex = (index: number) => {
    const sentence = lesson.sentences[index];
    if (!sentence) {
      setIsPlaying(false);
      setActiveWordIdx(null);
      return;
    }

    setActiveSentenceIdx(index);
    setIsPlaying(true);
    setActiveWordIdx(0);

    speakSentence(sentence.en, rate, {
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
    });
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
    const res = scoreWordAlignment(currentSentence.en, textToScore);
    setShadowingResult(res);
    onComplete({ shadowingScore: res.accuracy });
  };

  const handleToggleMic = () => {
    if (isRecording) {
      stopListening();
      setIsRecording(false);
      handleScoreShadowing(spokenText);
      return;
    }

    setMicError(null);
    setSpokenText('');
    setShadowingResult(null);
    let latestTranscript = '';

    const started = startListening(
      (transcript) => {
        latestTranscript = transcript;
        setSpokenText(transcript);
      },
      (err) => {
        setMicError(err);
        setIsRecording(false);
      },
      () => {
        setIsRecording(false);
        if (latestTranscript.trim()) {
          handleScoreShadowing(latestTranscript);
        }
      }
    );

    if (started) {
      setIsRecording(true);
    }
  };

  const handleCheckDictation = () => {
    const res = scoreDictation(currentSentence.en, dictationInput);
    setDictationResult(res);
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

  const clozeCorrectCount = clozeChecked
    ? Object.values(clozeChecked).filter(Boolean).length
    : 0;

  return (
    <div className="mx-auto max-w-4xl space-y-5">
      {/* Header & Top Audio Stage */}
      <div className="rounded-2xl border border-slate-800 bg-slate-900/90 p-5 shadow-xl">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <button
            type="button"
            onClick={() => {
              stopSpeaking();
              stopListening();
              onBack();
            }}
            className="inline-flex items-center gap-2 rounded-lg border border-slate-700 px-3 py-1.5 text-sm text-slate-300 hover:bg-slate-800"
          >
            <ArrowLeft className="h-4 w-4" />
            Lộ trình
          </button>
          <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-emerald-400">
            <span>Tuần {lesson.week} • Ngày {lesson.day}</span>
            <span>•</span>
            <span>{lesson.track.toUpperCase()}</span>
          </div>
        </div>

        <div className="mt-4">
          <h1 className="text-xl font-bold text-white">{lesson.title}</h1>
          <p className="text-sm text-slate-400">{lesson.scenario}</p>
        </div>

        {/* Live Subtitle Stage (Inspired by reference app) */}
        <div className="mt-4 rounded-xl border border-slate-800 bg-slate-950/80 p-5 text-center">
          {noSub ? (
            <div className="py-4 text-sm text-slate-400">
              <EyeOff className="mx-auto mb-2 h-6 w-6 text-slate-500" />
              Chế độ nghe không phụ đề (No-Sub) đang bật — tập trung nghe âm thanh!
            </div>
          ) : (
            <div className="space-y-2">
              <p
                className={`font-semibold leading-relaxed text-white ${
                  fontScale === 'large' ? 'text-xl' : 'text-lg'
                }`}
              >
                {currentSentence.en.split(/\s+/).map((word, idx) => {
                  const isActive = isPlaying && activeWordIdx === idx;
                  return (
                    <span
                      key={`${currentSentence.id}-stage-${idx}`}
                      className={`mr-1.5 inline-block transition-colors ${
                        isActive
                          ? 'border-b-2 border-amber-400 text-amber-300'
                          : 'text-slate-100'
                      }`}
                    >
                      {word}
                    </span>
                  );
                })}
              </p>
              {showVi && (
                <p className="text-sm text-slate-400">{currentSentence.vi}</p>
              )}
            </div>
          )}

          {/* Playback Controls */}
          <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
            <button
              type="button"
              onClick={handleTogglePlay}
              className="inline-flex items-center gap-2 rounded-full bg-emerald-500 px-5 py-2 text-sm font-semibold text-slate-950 hover:bg-emerald-400"
            >
              {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
              {isPlaying ? 'Tạm dừng' : 'Phát câu'}
            </button>

            <button
              type="button"
              onClick={() => setLoopSentence((v) => !v)}
              className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium ${
                loopSentence
                  ? 'border-amber-500/60 bg-amber-500/20 text-amber-300'
                  : 'border-slate-700 text-slate-300 hover:bg-slate-800'
              }`}
            >
              <Repeat className="h-3.5 w-3.5" />
              Lặp câu
            </button>

            <button
              type="button"
              onClick={() => setShowVi((v) => !v)}
              disabled={noSub}
              className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium ${
                showVi && !noSub
                  ? 'border-emerald-500/50 bg-emerald-500/15 text-emerald-300'
                  : 'border-slate-700 text-slate-400 hover:bg-slate-800 disabled:opacity-40'
              }`}
            >
              <Languages className="h-3.5 w-3.5" />
              Dịch Việt
            </button>

            <button
              type="button"
              onClick={() => setNoSub((v) => !v)}
              className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium ${
                noSub
                  ? 'border-rose-500/60 bg-rose-500/20 text-rose-300'
                  : 'border-slate-700 text-slate-300 hover:bg-slate-800'
              }`}
            >
              <EyeOff className="h-3.5 w-3.5" />
              No-Sub
            </button>

            <select
              aria-label="Tốc độ đọc"
              value={rate}
              onChange={(e) => setRate(Number(e.target.value))}
              className="rounded-full border border-slate-700 bg-slate-900 px-3 py-1.5 text-xs text-slate-200"
            >
              <option value={0.75}>0.75x</option>
              <option value={1.0}>1.0x</option>
              <option value={1.15}>1.15x</option>
              <option value={1.25}>1.25x</option>
            </select>

            <button
              type="button"
              onClick={() => setFontScale((s) => (s === 'normal' ? 'large' : 'normal'))}
              className="rounded-full border border-slate-700 px-3 py-1.5 text-xs font-bold text-slate-300 hover:bg-slate-800"
              title="Cỡ chữ"
            >
              TT
            </button>
          </div>
        </div>

        {/* 4 Practice Tabs */}
        <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
          {[
            { id: 'subtitles', label: 'Phụ đề', icon: Captions },
            { id: 'shadowing', label: 'Shadowing', icon: Mic },
            { id: 'dictation', label: 'Chính tả', icon: Keyboard },
            { id: 'cloze', label: 'Điền từ', icon: SquarePen },
          ].map((tab) => {
            const Icon = tab.icon;
            const active = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id as PlayerTab)}
                className={`flex items-center justify-center gap-2 rounded-xl border px-3 py-2.5 text-sm font-semibold transition ${
                  active
                    ? 'border-emerald-500 bg-emerald-500/20 text-emerald-300'
                    : 'border-slate-800 bg-slate-950/60 text-slate-400 hover:bg-slate-800 hover:text-slate-200'
                }`}
              >
                <Icon className="h-4 w-4" />
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Tab 1: Phụ đề (Listen & Word Sync) */}
      {activeTab === 'subtitles' && (
        <div className="space-y-2.5 rounded-2xl border border-slate-800 bg-slate-900/70 p-4">
          {noSub ? (
            <p className="py-6 text-center text-sm text-slate-400">
              Bạn đang bật chế độ <strong>No-Sub</strong>. Bấm lại nút No-Sub ở trên để hiện danh sách phụ đề.
            </p>
          ) : (
            lesson.sentences.map((s, idx) => {
              const isCurrent = idx === activeSentenceIdx;
              return (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => playIndex(idx)}
                  className={`w-full rounded-xl border p-4 text-left transition ${
                    isCurrent
                      ? 'border-emerald-500/60 bg-slate-800/90 shadow-md'
                      : 'border-slate-800/80 bg-slate-950/50 hover:bg-slate-800/50'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <span className="mt-1 shrink-0 font-mono text-xs text-slate-500">
                      {s.startTime}
                    </span>
                    <div className="space-y-1">
                      <p className={`font-medium leading-relaxed ${fontScale === 'large' ? 'text-lg' : 'text-base'}`}>
                        {s.en.split(/\s+/).map((word, wIdx) => {
                          const isWordActive = isCurrent && isPlaying && activeWordIdx === wIdx;
                          return (
                            <span
                              key={`${s.id}-w-${wIdx}`}
                              className={`mr-1.5 inline-block ${
                                isWordActive
                                  ? 'border-b-2 border-amber-400 font-bold text-amber-300'
                                  : 'text-slate-100'
                              }`}
                            >
                              {word}
                            </span>
                          );
                        })}
                      </p>
                      {showVi && <p className="text-sm text-slate-400">{s.vi}</p>}
                    </div>
                  </div>
                </button>
              );
            })
          )}
        </div>
      )}

      {/* Tab 2: Shadowing (Word-level pronunciation scoring) */}
      {activeTab === 'shadowing' && (
        <div className="space-y-4 rounded-2xl border border-slate-800 bg-slate-900/70 p-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2 className="text-base font-semibold text-white">
                Luyện nói Shadowing — Câu {activeSentenceIdx + 1}/{lesson.sentences.length}
              </h2>
              <p className="text-xs text-slate-400">
                Nghe câu mẫu rồi bấm Micro để nói lại. Hệ thống chấm điểm từng chữ (Xanh: Chuẩn, Vàng: Gần đúng, Đỏ: Cần sửa).
              </p>
            </div>
            <div className="flex gap-2">
              {lesson.sentences.map((s, idx) => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => {
                    setActiveSentenceIdx(idx);
                    setShadowingResult(null);
                    setSpokenText('');
                  }}
                  className={`h-8 w-8 rounded-lg text-xs font-semibold ${
                    idx === activeSentenceIdx
                      ? 'bg-emerald-500 text-slate-950'
                      : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                  }`}
                >
                  {idx + 1}
                </button>
              ))}
            </div>
          </div>

          <div className="rounded-xl border border-slate-800 bg-slate-950 p-4">
            <p className="text-base font-medium text-white">{currentSentence.en}</p>
            {showVi && <p className="mt-1 text-sm text-slate-400">{currentSentence.vi}</p>}
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={() => playIndex(activeSentenceIdx)}
              className="inline-flex items-center gap-2 rounded-xl border border-slate-700 bg-slate-800 px-4 py-2 text-sm font-medium text-slate-200 hover:bg-slate-700"
            >
              <Volume2 className="h-4 w-4 text-emerald-400" />
              Nghe mẫu
            </button>

            {micSupported && (
              <button
                type="button"
                onClick={handleToggleMic}
                className={`inline-flex items-center gap-2 rounded-xl px-5 py-2 text-sm font-semibold ${
                  isRecording
                    ? 'animate-pulse bg-rose-500 text-white'
                    : 'bg-emerald-500 text-slate-950 hover:bg-emerald-400'
                }`}
              >
                {isRecording ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
                {isRecording ? 'Dừng & Chấm điểm' : 'Bấm nói (Micro)'}
              </button>
            )}
          </div>

          {micError && (
            <p className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs text-amber-300">
              {micError}
            </p>
          )}

          {/* Fallback / Manual verification input */}
          <div className="space-y-2 rounded-xl border border-slate-800/80 bg-slate-950/60 p-4">
            <label className="block text-xs font-medium text-slate-400">
              {micSupported
                ? 'Nội dung nhận diện từ Micro (hoặc gõ kiểm tra thủ công):'
                : 'Trình duyệt chưa bật SpeechRecognition — nhập câu để kiểm tra thuật toán chấm từng chữ:'}
            </label>
            <div className="flex flex-col gap-2 sm:flex-row">
              <input
                type="text"
                value={spokenText}
                onChange={(e) => setSpokenText(e.target.value)}
                placeholder="Nhập hoặc dán câu bạn vừa nói..."
                className="flex-1 rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white placeholder-slate-500 focus:border-emerald-500 focus:outline-none"
              />
              <button
                type="button"
                onClick={() => handleScoreShadowing(spokenText)}
                className="rounded-lg bg-slate-800 px-4 py-2 text-sm font-semibold text-emerald-300 hover:bg-slate-700"
              >
                Chấm điểm từng chữ
              </button>
            </div>
          </div>

          {shadowingResult && (
            <div className="space-y-3 rounded-xl border border-emerald-500/30 bg-slate-950 p-4">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-slate-300">Kết quả chấm từng chữ:</span>
                <span className="text-xl font-bold text-emerald-400">
                  {shadowingResult.accuracy}%
                </span>
              </div>
              <div className="flex flex-wrap gap-2">
                {shadowingResult.words.map((w, i) => (
                  <WordScoreBadge key={`sh-${i}`} item={w} />
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Tab 3: Chính tả (Dictation) */}
      {activeTab === 'dictation' && (
        <div className="space-y-4 rounded-2xl border border-slate-800 bg-slate-900/70 p-5">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold text-white">
              Chính tả (Dictation) — Câu {activeSentenceIdx + 1}/{lesson.sentences.length}
            </h2>
            <button
              type="button"
              onClick={() => playIndex(activeSentenceIdx)}
              className="inline-flex items-center gap-2 rounded-lg bg-emerald-500/20 px-3 py-1.5 text-xs font-semibold text-emerald-300 hover:bg-emerald-500/30"
            >
              <Volume2 className="h-4 w-4" />
              Nghe câu này
            </button>
          </div>

          <textarea
            rows={3}
            value={dictationInput}
            onChange={(e) => setDictationInput(e.target.value)}
            placeholder="Nghe và gõ lại nguyên văn câu tiếng Anh..."
            className="w-full rounded-xl border border-slate-700 bg-slate-950 p-3 text-sm text-white placeholder-slate-500 focus:border-emerald-500 focus:outline-none"
          />

          <div className="flex justify-end">
            <button
              type="button"
              onClick={handleCheckDictation}
              className="rounded-xl bg-emerald-500 px-5 py-2 text-sm font-semibold text-slate-950 hover:bg-emerald-400"
            >
              Chấm chính tả
            </button>
          </div>

          {dictationResult && (
            <div className="space-y-3 rounded-xl border border-slate-800 bg-slate-950 p-4">
              <p className="text-sm font-semibold text-emerald-400">
                Độ chính xác: {dictationResult.accuracy}%
              </p>
              <div className="flex flex-wrap gap-2">
                {dictationResult.words.map((w, i) => (
                  <WordScoreBadge key={`dict-${i}`} item={w} />
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Tab 4: Điền từ (Cloze) */}
      {activeTab === 'cloze' && (
        <div className="space-y-4 rounded-2xl border border-slate-800 bg-slate-900/70 p-5">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold text-white">Điền từ khóa chuyên ngành</h2>
            {clozeChecked && (
              <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-emerald-400">
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
                  className="rounded-xl border border-slate-800 bg-slate-950/70 p-4"
                >
                  <div className="mb-2 flex items-center justify-between text-xs text-slate-500">
                    <span>Câu {idx + 1}</span>
                    <button
                      type="button"
                      onClick={() => playIndex(idx)}
                      className="text-emerald-400 hover:underline"
                    >
                      Nghe câu {idx + 1}
                    </button>
                  </div>
                  <p className="text-sm leading-loose text-slate-200">
                    {before}
                    <input
                      type="text"
                      value={clozeAnswers[s.id] ?? ''}
                      onChange={(e) =>
                        setClozeAnswers((prev) => ({ ...prev, [s.id]: e.target.value }))
                      }
                      placeholder="Nhập từ còn thiếu"
                      className={`mx-1.5 w-36 rounded-md border bg-slate-900 px-2.5 py-0.5 text-center text-sm font-semibold text-white focus:outline-none ${
                        clozeChecked
                          ? isCorrect
                            ? 'border-emerald-500 text-emerald-300'
                            : 'border-rose-500 text-rose-300'
                          : 'border-slate-700 focus:border-emerald-500'
                      }`}
                    />
                    {after}
                  </p>
                  {clozeChecked && !isCorrect && (
                    <p className="mt-1 text-xs text-amber-400">
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
              className="rounded-xl bg-emerald-500 px-5 py-2 text-sm font-semibold text-slate-950 hover:bg-emerald-400"
            >
              Kiểm tra Điền từ
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
