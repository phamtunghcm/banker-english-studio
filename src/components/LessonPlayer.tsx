import { useEffect, useState } from 'react';
import {
  ArrowLeft,
  Bookmark,
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
  getAvailableEnglishVoices,
  isSpeechRecognitionSupported,
  speakSentence,
  startListening,
  stopListening,
  stopSpeaking,
  type TonePreset,
  type VoiceOption,
} from '../utils/speechEngine';

type PlayerTab = 'subtitles' | 'shadowing' | 'dictation' | 'cloze';

interface LessonPlayerProps {
  lesson: Lesson;
  savedWords?: string[];
  onToggleSaveWord?: (word: string, contextSentence: string) => void;
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
          ? `Bạn nói: "${item.spoken}" — Bấm để nghe phát âm chuẩn`
          : 'Thiếu hoặc chưa khớp — Bấm để nghe phát âm chuẩn'
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
  onSelect,
}: {
  sentences: LessonSentence[];
  activeIdx: number;
  onSelect: (idx: number) => void;
}) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {sentences.map((s, idx) => (
        <button
          key={s.id}
          type="button"
          onClick={() => onSelect(idx)}
          className={`h-8 min-w-8 rounded-lg px-2 text-xs font-bold transition ${
            idx === activeIdx
              ? 'bg-emerald-600 text-white'
              : 'border border-slate-300 bg-white text-slate-800 hover:bg-slate-100'
          }`}
        >
          {idx + 1}
        </button>
      ))}
    </div>
  );
}

export function LessonPlayer({
  lesson,
  savedWords = [],
  onToggleSaveWord,
  onComplete,
  onBack,
}: LessonPlayerProps) {
  const [activeTab, setActiveTab] = useState<PlayerTab>('subtitles');
  const [activeSentenceIdx, setActiveSentenceIdx] = useState(0);
  const [activeWordIdx, setActiveWordIdx] = useState<number | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [loopSentence, setLoopSentence] = useState(false);
  const [rate, setRate] = useState(1.0);
  const [fontScale, setFontScale] = useState<'normal' | 'large'>('normal');
  const [voices, setVoices] = useState<VoiceOption[]>(() => getAvailableEnglishVoices());
  const [selectedVoiceURI, setSelectedVoiceURI] = useState<string>('');
  const [tonePreset, setTonePreset] = useState<TonePreset>('expressive');

  // Sub / No-Sub toggles
  const [noSub, setNoSub] = useState(false);
  const [showVi, setShowVi] = useState(true);

  // Shadowing state
  const [isRecording, setIsRecording] = useState(false);
  const [spokenText, setSpokenText] = useState('');
  const [micError, setMicError] = useState<string | null>(null);
  const [shadowingResults, setShadowingResults] = useState<
    Record<string, { words: WordScoreResult[]; accuracy: number }>
  >({});

  // Dictation state keyed by sentence.id
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

  useEffect(() => {
    const refreshVoices = () => setVoices(getAvailableEnglishVoices());
    refreshVoices();
    const timer = setTimeout(refreshVoices, 400);
    return () => {
      clearTimeout(timer);
      stopSpeaking();
      stopListening();
    };
  }, []);

  const stopAllAudioAndMic = () => {
    stopSpeaking();
    stopListening();
    setIsPlaying(false);
    setIsRecording(false);
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

    stopListening();
    setIsRecording(false);
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
      selectedVoiceURI || undefined,
      tonePreset
    );
  };

  const handleSpeakSingleWord = (word: string) => {
    const clean = word.replace(/^[^\w]+|[^\w]+$/g, '');
    if (!clean) return;
    speakSentence(clean, 0.85, {}, selectedVoiceURI || undefined, tonePreset);
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
    setShadowingResults((prev) => ({ ...prev, [currentSentence.id]: res }));
    onComplete({ shadowingScore: res.accuracy });
  };

  const handleToggleMic = () => {
    if (isRecording) {
      stopListening();
      setIsRecording(false);
      handleScoreShadowing(spokenText);
      return;
    }

    stopSpeaking();
    setIsPlaying(false);
    setMicError(null);
    setSpokenText('');
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

  const clozeCorrectCount = clozeChecked
    ? Object.values(clozeChecked).filter(Boolean).length
    : 0;

  return (
    <div className="mx-auto max-w-4xl space-y-5">
      {/* Header & Top Audio Stage */}
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <button
            type="button"
            onClick={() => {
              stopAllAudioAndMic();
              onBack();
            }}
            className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-bold text-slate-800 hover:bg-slate-100"
          >
            <ArrowLeft className="h-4 w-4" />
            Lộ trình
          </button>
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-emerald-700">
            <span>
              {lesson.isCustom ? 'Bài tự tạo' : `Tuần ${lesson.week} • Ngày ${lesson.day}`}
            </span>
            <span>•</span>
            <span>{lesson.track.toUpperCase()}</span>
          </div>
        </div>

        <div className="mt-4">
          <h1 className="text-xl font-bold text-slate-900">{lesson.title}</h1>
          <p className="text-sm font-medium text-slate-600">{lesson.scenario}</p>
        </div>

        {/* Live Subtitle Stage */}
        <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-5 text-center">
          {noSub ? (
            <div className="py-4 text-sm font-semibold text-slate-600">
              <EyeOff className="mx-auto mb-2 h-6 w-6 text-slate-500" />
              Chế độ nghe không phụ đề (No-Sub) đang bật — tập trung nghe âm thanh!
            </div>
          ) : (
            <div className="space-y-2">
              <p
                className={`font-bold leading-relaxed text-slate-900 ${
                  fontScale === 'large' ? 'text-xl' : 'text-lg'
                }`}
              >
                {currentSentence.en.split(/\s+/).map((word, idx) => {
                  const isActive = isPlaying && activeWordIdx === idx;
                  return (
                    <span
                      key={`${currentSentence.id}-stage-${idx}`}
                      className={`mr-1.5 inline-block rounded px-0.5 transition-colors ${
                        isActive
                          ? 'border-b-2 border-amber-600 bg-amber-100 text-amber-900'
                          : 'text-slate-900'
                      }`}
                    >
                      {word}
                    </span>
                  );
                })}
              </p>
              {showVi && (
                <p className="text-sm font-medium text-slate-700">{currentSentence.vi}</p>
              )}
            </div>
          )}

          {/* Playback & Voice Controls */}
          <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
            <button
              type="button"
              onClick={handleTogglePlay}
              className="inline-flex items-center gap-2 rounded-full bg-emerald-600 px-5 py-2 text-sm font-bold text-white shadow-sm hover:bg-emerald-700"
            >
              {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
              {isPlaying ? 'Tạm dừng' : 'Phát câu'}
            </button>

            <button
              type="button"
              onClick={() => setLoopSentence((v) => !v)}
              className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-bold ${
                loopSentence
                  ? 'border-amber-400 bg-amber-100 text-amber-900'
                  : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-100'
              }`}
            >
              <Repeat className="h-3.5 w-3.5" />
              Lặp câu
            </button>

            <button
              type="button"
              onClick={() => setShowVi((v) => !v)}
              disabled={noSub}
              className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-bold ${
                showVi && !noSub
                  ? 'border-emerald-400 bg-emerald-100 text-emerald-900'
                  : 'border-slate-300 bg-white text-slate-600 hover:bg-slate-100 disabled:opacity-40'
              }`}
            >
              <Languages className="h-3.5 w-3.5" />
              Dịch Việt
            </button>

            <button
              type="button"
              onClick={() => setNoSub((v) => !v)}
              className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-bold ${
                noSub
                  ? 'border-rose-400 bg-rose-100 text-rose-900'
                  : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-100'
              }`}
            >
              <EyeOff className="h-3.5 w-3.5" />
              No-Sub
            </button>

            <select
              aria-label="Tốc độ đọc"
              value={rate}
              onChange={(e) => setRate(Number(e.target.value))}
              className="rounded-full border border-slate-300 bg-white px-3 py-1.5 text-xs font-bold text-slate-800"
            >
              <option value={0.75}>0.75x</option>
              <option value={1.0}>1.0x</option>
              <option value={1.15}>1.15x</option>
              <option value={1.25}>1.25x</option>
            </select>

            <select
              aria-label="Ngữ điệu"
              value={tonePreset}
              onChange={(e) => setTonePreset(e.target.value as TonePreset)}
              className="rounded-full border border-slate-300 bg-white px-3 py-1.5 text-xs font-bold text-slate-800"
            >
              <option value="expressive">Ngữ điệu: Truyền cảm</option>
              <option value="executive">Ngữ điệu: Họp chuyên nghiệp</option>
              <option value="coaching">Ngữ điệu: Chậm rõ từng âm</option>
            </select>

            {voices.length > 0 && (
              <div className="inline-flex items-center gap-1">
                <select
                  aria-label="Giọng đọc"
                  value={selectedVoiceURI}
                  onChange={(e) => setSelectedVoiceURI(e.target.value)}
                  className="max-w-64 truncate rounded-full border border-slate-300 bg-white px-3 py-1.5 text-xs font-bold text-slate-800"
                >
                  <option value="">Giọng: Tự động (Nữ ưu tiên)</option>
                  {voices.map((v) => (
                    <option key={v.voiceURI} value={v.voiceURI}>
                      {v.displayLabel}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={() =>
                    speakSentence(
                      'Hello, welcome to FinTech Banker English Studio.',
                      rate,
                      {},
                      selectedVoiceURI || undefined,
                      tonePreset
                    )
                  }
                  className="rounded-full border border-emerald-300 bg-emerald-50 px-2.5 py-1.5 text-xs font-bold text-emerald-800 hover:bg-emerald-100"
                  title="Nghe thử giọng đang chọn"
                >
                  Thử giọng
                </button>
              </div>
            )}

            <button
              type="button"
              onClick={() => setFontScale((s) => (s === 'normal' ? 'large' : 'normal'))}
              className="rounded-full border border-slate-300 bg-white px-3 py-1.5 text-xs font-bold text-slate-800 hover:bg-slate-100"
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
                onClick={() => handleSelectTab(tab.id as PlayerTab)}
                className={`flex items-center justify-center gap-2 rounded-xl border px-3 py-2.5 text-sm font-bold transition ${
                  active
                    ? 'border-emerald-600 bg-emerald-50 text-emerald-800'
                    : 'border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100 hover:text-slate-900'
                }`}
              >
                <Icon className="h-4 w-4" />
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Tab 1: Phụ đề */}
      {activeTab === 'subtitles' && (
        <div className="space-y-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          {noSub ? (
            <p className="py-6 text-center text-sm font-medium text-slate-600">
              Bạn đang bật chế độ <strong>No-Sub</strong>. Bấm lại nút No-Sub ở trên để hiện danh sách phụ đề.
            </p>
          ) : (
            lesson.sentences.map((s, idx) => {
              const isCurrent = idx === activeSentenceIdx;
              return (
                <div
                  key={s.id}
                  className={`rounded-xl border p-4 transition ${
                    isCurrent
                      ? 'border-emerald-500 bg-emerald-50/70 shadow-sm'
                      : 'border-slate-200 bg-white hover:bg-slate-50'
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => playIndex(idx)}
                    className="w-full text-left"
                  >
                    <div className="flex items-start gap-3">
                      <span className="mt-1 shrink-0 font-mono text-xs font-bold text-slate-500">
                        {s.startTime}
                      </span>
                      <div className="space-y-1">
                        <p
                          className={`font-bold leading-relaxed ${
                            fontScale === 'large' ? 'text-lg' : 'text-base'
                          }`}
                        >
                          {s.en.split(/\s+/).map((word, wIdx) => {
                            const isWordActive = isCurrent && isPlaying && activeWordIdx === wIdx;
                            return (
                              <span
                                key={`${s.id}-w-${wIdx}`}
                                className={`mr-1.5 inline-block rounded px-0.5 ${
                                  isWordActive
                                    ? 'border-b-2 border-amber-600 bg-amber-100 text-amber-900'
                                    : 'text-slate-900'
                                }`}
                              >
                                {word}
                              </span>
                            );
                          })}
                        </p>
                        {showVi && (
                          <p className="text-sm font-medium text-slate-700">{s.vi}</p>
                        )}
                      </div>
                    </div>
                  </button>

                  {s.keywords.length > 0 && (
                    <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-slate-200 pt-2.5 pl-12">
                      <span className="text-[11px] font-bold text-slate-500">Thuật ngữ:</span>
                      {s.keywords.map((kw) => {
                        const isSaved = savedWords.some(
                          (sw) => sw.toLowerCase() === kw.toLowerCase()
                        );
                        return (
                          <div
                            key={kw}
                            className="inline-flex items-center rounded-md border border-slate-300 bg-slate-50"
                          >
                            <button
                              type="button"
                              onClick={() => handleSpeakSingleWord(kw)}
                              className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-bold text-sky-800 hover:text-sky-950"
                              title="Nghe phát âm thuật ngữ"
                            >
                              <Volume2 className="h-3 w-3" />
                              {kw}
                            </button>
                            {onToggleSaveWord && (
                              <button
                                type="button"
                                onClick={() => onToggleSaveWord(kw, s.en)}
                                className={`border-l border-slate-300 px-1.5 py-0.5 text-xs ${
                                  isSaved
                                    ? 'text-amber-600'
                                    : 'text-slate-500 hover:text-amber-600'
                                }`}
                                title={isSaved ? 'Đã lưu từ khó' : 'Lưu vào Kho từ khó'}
                              >
                                <Bookmark className="h-3 w-3" />
                              </button>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      )}

      {/* Tab 2: Shadowing */}
      {activeTab === 'shadowing' && (
        <div className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2 className="text-base font-bold text-slate-900">
                Luyện nói Shadowing — Câu {activeSentenceIdx + 1}/{lesson.sentences.length}
              </h2>
              <p className="text-xs font-medium text-slate-600">
                Nghe mẫu rồi bấm Micro nói lại. Bấm trực tiếp vào từ Đỏ/Vàng để nghe máy đọc mẫu từ đó.
              </p>
            </div>
            <SentenceSelector
              sentences={lesson.sentences}
              activeIdx={activeSentenceIdx}
              onSelect={handleSelectSentence}
            />
          </div>

          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
            <p className="text-base font-bold text-slate-900">{currentSentence.en}</p>
            {showVi && (
              <p className="mt-1 text-sm font-medium text-slate-700">{currentSentence.vi}</p>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={() => playIndex(activeSentenceIdx)}
              className="inline-flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-bold text-slate-800 hover:bg-slate-100"
            >
              <Volume2 className="h-4 w-4 text-emerald-700" />
              Nghe mẫu
            </button>

            {micSupported && (
              <button
                type="button"
                onClick={handleToggleMic}
                className={`inline-flex items-center gap-2 rounded-xl px-5 py-2 text-sm font-bold ${
                  isRecording
                    ? 'animate-pulse bg-rose-600 text-white'
                    : 'bg-emerald-600 text-white hover:bg-emerald-700'
                }`}
              >
                {isRecording ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
                {isRecording ? 'Dừng & Chấm điểm' : 'Bấm nói (Micro)'}
              </button>
            )}
          </div>

          {micError && (
            <p className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-800">
              {micError}
            </p>
          )}

          <div className="space-y-2 rounded-xl border border-slate-200 bg-slate-50 p-4">
            <label className="block text-xs font-bold text-slate-700">
              {micSupported
                ? 'Nội dung nhận diện từ Micro (hoặc gõ kiểm tra thủ công):'
                : 'Trình duyệt chưa bật SpeechRecognition — nhập câu để kiểm tra thuật toán chấm từng chữ:'}
            </label>
            <textarea
              rows={2}
              value={spokenText}
              onChange={(e) => setSpokenText(e.target.value)}
              placeholder="Nhập hoặc dán câu bạn vừa nói..."
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-900 placeholder-slate-400 focus:border-emerald-600 focus:outline-none"
            />
            <div className="flex justify-end">
              <button
                type="button"
                onClick={() => handleScoreShadowing(spokenText)}
                className="rounded-lg border border-emerald-600 bg-emerald-50 px-4 py-2 text-sm font-bold text-emerald-800 hover:bg-emerald-100"
              >
                Chấm điểm từng chữ
              </button>
            </div>
          </div>

          {currentShadowResult && (
            <div className="space-y-3 rounded-xl border border-emerald-300 bg-emerald-50/40 p-4">
              <div className="flex items-center justify-between">
                <span className="text-sm font-bold text-slate-800">
                  Kết quả chấm từng chữ (bấm vào từ để nghe mẫu):
                </span>
                <span className="text-xl font-extrabold text-emerald-700">
                  {currentShadowResult.accuracy}%
                </span>
              </div>
              <div className="flex flex-wrap gap-2">
                {currentShadowResult.words.map((w, i) => (
                  <WordScoreBadge
                    key={`sh-${currentSentence.id}-${i}`}
                    item={w}
                    onSpeakWord={handleSpeakSingleWord}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Tab 3: Chính tả */}
      {activeTab === 'dictation' && (
        <div className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2 className="text-base font-bold text-slate-900">
                Chính tả (Dictation) — Câu {activeSentenceIdx + 1}/{lesson.sentences.length}
              </h2>
              <p className="text-xs font-medium text-slate-600">
                Nghe và gõ lại nguyên văn từng câu, bấm vào từ sai để nghe lại phát âm.
              </p>
            </div>
            <SentenceSelector
              sentences={lesson.sentences}
              activeIdx={activeSentenceIdx}
              onSelect={handleSelectSentence}
            />
          </div>

          <div className="flex justify-start">
            <button
              type="button"
              onClick={() => playIndex(activeSentenceIdx)}
              className="inline-flex items-center gap-2 rounded-lg border border-emerald-300 bg-emerald-50 px-3 py-1.5 text-xs font-bold text-emerald-800 hover:bg-emerald-100"
            >
              <Volume2 className="h-4 w-4" />
              Nghe câu {activeSentenceIdx + 1}
            </button>
          </div>

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
              className="rounded-xl bg-emerald-600 px-5 py-2 text-sm font-bold text-white hover:bg-emerald-700"
            >
              Chấm chính tả
            </button>
          </div>

          {currentDictResult && (
            <div className="space-y-3 rounded-xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-sm font-bold text-emerald-700">
                Độ chính xác: {currentDictResult.accuracy}%
              </p>
              <div className="flex flex-wrap gap-2">
                {currentDictResult.words.map((w, i) => (
                  <WordScoreBadge
                    key={`dict-${currentSentence.id}-${i}`}
                    item={w}
                    onSpeakWord={handleSpeakSingleWord}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Tab 4: Điền từ */}
      {activeTab === 'cloze' && (
        <div className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-bold text-slate-900">Điền từ khóa chuyên ngành</h2>
            {clozeChecked && (
              <span className="inline-flex items-center gap-1.5 text-sm font-bold text-emerald-700">
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
                  className="rounded-xl border border-slate-200 bg-slate-50 p-4"
                >
                  <div className="mb-2 flex items-center justify-between text-xs font-semibold text-slate-600">
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
              className="rounded-xl bg-emerald-600 px-5 py-2 text-sm font-bold text-white hover:bg-emerald-700"
            >
              Kiểm tra Điền từ
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
