import { useMemo, useState } from 'react';
import {
  CheckCircle2,
  Headphones,
  RotateCcw,
  Shuffle,
  Sparkles,
  Volume2,
} from 'lucide-react';
import type { GameId, Lesson } from '../types/curriculum';
import { ALL_LESSONS } from '../data';
import {
  buildListenQuestions,
  buildMatchPairs,
  buildScrambleRounds,
  isScrambleCorrect,
  shuffle,
} from '../utils/games';
import { speakSentence, type TonePreset } from '../utils/speechEngine';

interface LessonMiniGamesProps {
  lesson: Lesson;
  voicePreset?: string;
  tonePreset?: TonePreset;
  onFinishGame?: (gameId: GameId, score: number) => void;
}

export function LessonMiniGames({
  lesson,
  voicePreset,
  tonePreset = 'expressive',
  onFinishGame,
}: LessonMiniGamesProps) {
  const [activeGame, setActiveGame] = useState<GameId>('match');
  const [roundSeed, setRoundSeed] = useState(0);

  const singleLessonList = useMemo(() => [lesson], [lesson]);

  // 1. Match pairs from this lesson's sentences
  const matchPairs = useMemo(
    () => buildMatchPairs(singleLessonList, Math.min(4, lesson.sentences.length)),
    [singleLessonList, lesson.sentences.length, roundSeed]
  );
  const shuffledVi = useMemo(() => shuffle(matchPairs), [matchPairs]);
  const [selectedEnId, setSelectedEnId] = useState<string | null>(null);
  const [matchedIds, setMatchedIds] = useState<string[]>([]);
  const [matchMistakes, setMatchMistakes] = useState(0);
  const [matchDone, setMatchDone] = useState(false);

  // 2. Listen & Catch keyword from this lesson (with rich distractors from same track)
  const listenQuestions = useMemo(() => {
    const sameTrackPool = ALL_LESSONS.filter((l) => l.track === lesson.track);
    return buildListenQuestions(
      singleLessonList,
      Math.min(4, lesson.sentences.length),
      Math.random,
      sameTrackPool.length >= 2 ? sameTrackPool : ALL_LESSONS
    );
  }, [singleLessonList, lesson.track, lesson.sentences.length, roundSeed]);
  const [listenIdx, setListenIdx] = useState(0);
  const [listenScore, setListenScore] = useState(0);
  const [listenFeedback, setListenFeedback] = useState<'correct' | 'wrong' | null>(null);
  const [listenDone, setListenDone] = useState(false);

  // 3. Word Scramble from this lesson
  const scrambleRounds = useMemo(
    () => buildScrambleRounds(singleLessonList, Math.min(4, lesson.sentences.length)),
    [singleLessonList, lesson.sentences.length, roundSeed]
  );
  const [scrambleIdx, setScrambleIdx] = useState(0);
  const [pickedTokenIds, setPickedTokenIds] = useState<string[]>([]);
  const [scrambleScore, setScrambleScore] = useState(0);
  const [scrambleStatus, setScrambleStatus] = useState<'idle' | 'correct' | 'wrong'>('idle');
  const [scrambleDone, setScrambleDone] = useState(false);

  const resetGames = () => {
    setRoundSeed((s) => s + 1);
    setSelectedEnId(null);
    setMatchedIds([]);
    setMatchMistakes(0);
    setMatchDone(false);

    setListenIdx(0);
    setListenScore(0);
    setListenFeedback(null);
    setListenDone(false);

    setScrambleIdx(0);
    setPickedTokenIds([]);
    setScrambleScore(0);
    setScrambleStatus('idle');
    setScrambleDone(false);
  };

  const handlePickVi = (viId: string) => {
    if (!selectedEnId || matchedIds.includes(viId)) return;
    if (selectedEnId === viId) {
      const next = [...matchedIds, viId];
      setMatchedIds(next);
      setSelectedEnId(null);
      if (next.length === matchPairs.length) {
        const xp = Math.max(40, 100 - matchMistakes * 15);
        setMatchDone(true);
        onFinishGame?.('match', xp);
      }
    } else {
      setMatchMistakes((m) => m + 1);
      setSelectedEnId(null);
    }
  };

  const currentListen = listenQuestions[listenIdx];
  const handlePickListen = (opt: string) => {
    if (!currentListen || listenFeedback !== null) return;
    const ok = opt.toLowerCase() === currentListen.answer.toLowerCase();
    const nextScore = ok ? listenScore + 25 : listenScore;
    setListenScore(nextScore);
    setListenFeedback(ok ? 'correct' : 'wrong');
    setTimeout(() => {
      if (listenIdx + 1 < listenQuestions.length) {
        setListenIdx((i) => i + 1);
        setListenFeedback(null);
      } else {
        setListenDone(true);
        onFinishGame?.('listen', nextScore);
      }
    }, 650);
  };

  const currentScramble = scrambleRounds[scrambleIdx];
  const toggleToken = (id: string) => {
    if (scrambleStatus !== 'idle') return;
    setPickedTokenIds((prev) =>
      prev.includes(id) ? prev.filter((t) => t !== id) : [...prev, id]
    );
  };

  const handleCheckScramble = () => {
    if (!currentScramble) return;
    const arranged = pickedTokenIds
      .map((id) => currentScramble.tokens.find((t) => t.id === id)?.text ?? '')
      .filter(Boolean);
    const ok = isScrambleCorrect(currentScramble.sentence.en, arranged);
    setScrambleStatus(ok ? 'correct' : 'wrong');
    const nextScore = ok ? scrambleScore + 30 : scrambleScore;
    if (ok) setScrambleScore(nextScore);

    setTimeout(() => {
      if (scrambleIdx + 1 < scrambleRounds.length) {
        setScrambleIdx((i) => i + 1);
        setPickedTokenIds([]);
        setScrambleStatus('idle');
      } else {
        setScrambleDone(true);
        onFinishGame?.('scramble', nextScore);
      }
    }, 850);
  };

  return (
    <div className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-base font-extrabold text-slate-900">
            Mini-Game ôn tập ngay bài này
          </h2>
          <p className="text-xs font-medium text-slate-600">
            Luyện phản xạ trực tiếp trên {lesson.sentences.length} câu của bài học hiện tại để cộng XP
          </p>
        </div>
        <button
          type="button"
          onClick={resetGames}
          className="inline-flex items-center gap-1 rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-100"
        >
          <RotateCcw className="h-3.5 w-3.5" />
          Chơi lại
        </button>
      </div>

      {/* 3 mini-game mode pills */}
      <div className="grid gap-2 sm:grid-cols-3">
        {[
          { id: 'match', label: 'Ghép cặp Anh – Việt', icon: Sparkles },
          { id: 'listen', label: 'Nghe nhanh bắt từ', icon: Headphones },
          { id: 'scramble', label: 'Xếp từ thành câu', icon: Shuffle },
        ].map((g) => {
          const Icon = g.icon;
          const active = activeGame === g.id;
          return (
            <button
              key={g.id}
              type="button"
              onClick={() => setActiveGame(g.id as GameId)}
              className={`flex items-center justify-center gap-1.5 rounded-xl border px-3 py-2 text-xs font-bold transition ${
                active
                  ? 'border-amber-500 bg-amber-50 text-amber-900'
                  : 'border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100'
              }`}
            >
              <Icon className="h-3.5 w-3.5" />
              {g.label}
            </button>
          );
        })}
      </div>

      {/* Mode 1: Match */}
      {activeGame === 'match' && (
        <div className="space-y-3">
          {matchDone ? (
            <div className="rounded-xl border border-emerald-300 bg-emerald-50 p-5 text-center">
              <CheckCircle2 className="mx-auto h-9 w-9 text-emerald-600" />
              <p className="mt-2 text-base font-extrabold text-slate-900">
                Hoàn thành bài ghép cặp! +{Math.max(40, 100 - matchMistakes * 15)} XP
              </p>
            </div>
          ) : (
            <div className="grid gap-3 md:grid-cols-2">
              <div className="space-y-2">
                {matchPairs.map((p) => {
                  const matched = matchedIds.includes(p.id);
                  const selected = selectedEnId === p.id;
                  return (
                    <button
                      key={`m-en-${p.id}`}
                      type="button"
                      disabled={matched}
                      onClick={() => {
                        setSelectedEnId(p.id);
                        speakSentence(
                          p.en,
                          1.0,
                          {},
                          voicePreset,
                          tonePreset,
                          lesson.isCustom ? undefined : p.id
                        );
                      }}
                      className={`w-full rounded-xl border p-3 text-left text-xs font-bold transition ${
                        matched
                          ? 'border-emerald-300 bg-emerald-50 text-emerald-700 opacity-55'
                          : selected
                            ? 'border-emerald-600 bg-emerald-100 text-emerald-950 ring-1 ring-emerald-600'
                            : 'border-slate-200 bg-slate-50 text-slate-900 hover:bg-slate-100'
                      }`}
                    >
                      <Volume2 className="mr-1.5 inline h-3.5 w-3.5 text-emerald-600" />
                      {p.en}
                    </button>
                  );
                })}
              </div>
              <div className="space-y-2">
                {shuffledVi.map((p) => {
                  const matched = matchedIds.includes(p.id);
                  return (
                    <button
                      key={`m-vi-${p.id}`}
                      type="button"
                      disabled={matched}
                      onClick={() => handlePickVi(p.id)}
                      className={`w-full rounded-xl border p-3 text-left text-xs font-semibold transition ${
                        matched
                          ? 'border-emerald-300 bg-emerald-50 text-emerald-700 opacity-55'
                          : 'border-slate-200 bg-white text-slate-800 hover:border-emerald-500 hover:bg-emerald-50/40'
                      }`}
                    >
                      {p.vi}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Mode 2: Listen Rush */}
      {activeGame === 'listen' && (
        <div className="space-y-3">
          {listenDone || !currentListen ? (
            <div className="rounded-xl border border-emerald-300 bg-emerald-50 p-5 text-center">
              <CheckCircle2 className="mx-auto h-9 w-9 text-emerald-600" />
              <p className="mt-2 text-base font-extrabold text-slate-900">
                Hoàn thành Nghe nhanh! +{listenScore} XP
              </p>
            </div>
          ) : (
            <>
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-center">
                <button
                  type="button"
                  onClick={() =>
                    speakSentence(
                      currentListen.sentence.en,
                      1.0,
                      {},
                      voicePreset,
                      tonePreset,
                      lesson.isCustom ? undefined : currentListen.sentence.id
                    )
                  }
                  className="inline-flex items-center gap-2 rounded-full bg-emerald-600 px-5 py-2 text-xs font-bold text-white hover:bg-emerald-700"
                >
                  <Volume2 className="h-4 w-4" />
                  Nghe câu {listenIdx + 1}/{listenQuestions.length} (No-Sub)
                </button>
                <p className="mt-2 text-xs font-medium text-slate-600">
                  {currentListen.sentence.vi}
                </p>
              </div>
              <div className="grid gap-2 sm:grid-cols-2">
                {currentListen.options.map((opt) => (
                  <button
                    key={opt}
                    type="button"
                    onClick={() => handlePickListen(opt)}
                    className="rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-bold text-slate-900 hover:border-emerald-600 hover:bg-emerald-50"
                  >
                    {opt}
                  </button>
                ))}
              </div>
              {listenFeedback && (
                <p
                  className={`text-center text-xs font-extrabold ${
                    listenFeedback === 'correct' ? 'text-emerald-700' : 'text-rose-600'
                  }`}
                >
                  {listenFeedback === 'correct'
                    ? 'Chính xác! +25 XP'
                    : `Đáp án đúng: "${currentListen.answer}"`}
                </p>
              )}
            </>
          )}
        </div>
      )}

      {/* Mode 3: Word Scramble */}
      {activeGame === 'scramble' && (
        <div className="space-y-3">
          {scrambleDone || !currentScramble ? (
            <div className="rounded-xl border border-emerald-300 bg-emerald-50 p-5 text-center">
              <CheckCircle2 className="mx-auto h-9 w-9 text-emerald-600" />
              <p className="mt-2 text-base font-extrabold text-slate-900">
                Hoàn thành Xếp câu! +{scrambleScore} XP
              </p>
            </div>
          ) : (
            <>
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-700">
                  Câu {scrambleIdx + 1}/{scrambleRounds.length}: {currentScramble.sentence.vi}
                </span>
                <button
                  type="button"
                  onClick={() =>
                    speakSentence(
                      currentScramble.sentence.en,
                      0.95,
                      {},
                      voicePreset,
                      tonePreset,
                      lesson.isCustom ? undefined : currentScramble.sentence.id
                    )
                  }
                  className="inline-flex items-center gap-1 rounded-lg border border-emerald-300 bg-emerald-50 px-2.5 py-1 text-xs font-bold text-emerald-800"
                >
                  <Volume2 className="h-3.5 w-3.5" />
                  Nghe gợi ý
                </button>
              </div>

              <div className="min-h-12 rounded-xl border-2 border-dashed border-slate-300 bg-slate-50 p-3">
                <div className="flex flex-wrap gap-1.5">
                  {pickedTokenIds.length === 0 ? (
                    <span className="text-xs text-slate-400">Bấm từng thẻ từ bên dưới để xếp câu...</span>
                  ) : (
                    pickedTokenIds.map((id) => {
                      const tok = currentScramble.tokens.find((t) => t.id === id);
                      if (!tok) return null;
                      return (
                        <button
                          key={`p-${id}`}
                          type="button"
                          onClick={() => toggleToken(id)}
                          className="rounded-lg border border-emerald-600 bg-emerald-100 px-2.5 py-1 text-xs font-bold text-emerald-950"
                        >
                          {tok.text}
                        </button>
                      );
                    })
                  )}
                </div>
              </div>

              <div className="flex flex-wrap gap-1.5">
                {currentScramble.tokens.map((tok) => {
                  const used = pickedTokenIds.includes(tok.id);
                  return (
                    <button
                      key={tok.id}
                      type="button"
                      disabled={used}
                      onClick={() => toggleToken(tok.id)}
                      className={`rounded-lg border px-2.5 py-1 text-xs font-bold ${
                        used
                          ? 'border-slate-200 bg-slate-100 text-slate-300'
                          : 'border-slate-300 bg-white text-slate-900 hover:border-emerald-600 hover:bg-emerald-50'
                      }`}
                    >
                      {tok.text}
                    </button>
                  );
                })}
              </div>

              <div className="flex items-center justify-between">
                {scrambleStatus !== 'idle' ? (
                  <span
                    className={`text-xs font-extrabold ${
                      scrambleStatus === 'correct' ? 'text-emerald-700' : 'text-rose-600'
                    }`}
                  >
                    {scrambleStatus === 'correct'
                      ? 'Chuẩn xác! +30 XP'
                      : `Câu đúng: ${currentScramble.sentence.en}`}
                  </span>
                ) : (
                  <button
                    type="button"
                    onClick={() => setPickedTokenIds([])}
                    className="text-xs font-bold text-slate-500 hover:text-slate-900"
                  >
                    Xóa xếp lại
                  </button>
                )}

                <button
                  type="button"
                  disabled={pickedTokenIds.length === 0 || scrambleStatus !== 'idle'}
                  onClick={handleCheckScramble}
                  className="rounded-xl bg-emerald-600 px-4 py-1.5 text-xs font-bold text-white hover:bg-emerald-700 disabled:opacity-40"
                >
                  Kiểm tra câu
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
