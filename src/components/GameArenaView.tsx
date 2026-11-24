import { useMemo, useState } from 'react';
import {
  ArrowLeft,
  CheckCircle2,
  Gamepad2,
  Headphones,
  RotateCcw,
  Shuffle,
  Sparkles,
  Trophy,
  Volume2,
} from 'lucide-react';
import type { GameId, Lesson } from '../types/curriculum';
import {
  buildListenQuestions,
  buildMatchPairs,
  buildScrambleRounds,
  isScrambleCorrect,
  shuffle,
  xpToLevel,
} from '../utils/games';
import { speakSentence } from '../utils/speechEngine';

interface GameArenaViewProps {
  lessons: Lesson[];
  gameXp: number;
  gameBest: Partial<Record<GameId, number>>;
  voicePreset?: string;
  onFinishGame: (gameId: GameId, score: number) => void;
  onBack: () => void;
}

export function GameArenaView({
  lessons,
  gameXp,
  gameBest,
  voicePreset,
  onFinishGame,
  onBack,
}: GameArenaViewProps) {
  const [activeGame, setActiveGame] = useState<GameId>('match');
  const [roundSeed, setRoundSeed] = useState(0);

  // Match state
  const matchPairs = useMemo(() => buildMatchPairs(lessons, 4), [lessons, roundSeed]);
  const shuffledVi = useMemo(() => shuffle(matchPairs), [matchPairs]);
  const [selectedEnId, setSelectedEnId] = useState<string | null>(null);
  const [matchedIds, setMatchedIds] = useState<string[]>([]);
  const [matchMistakes, setMatchMistakes] = useState(0);
  const [matchDone, setMatchDone] = useState(false);

  // Listen Rush state
  const listenQuestions = useMemo(() => buildListenQuestions(lessons, 5), [lessons, roundSeed]);
  const [listenIdx, setListenIdx] = useState(0);
  const [listenScore, setListenScore] = useState(0);
  const [listenFeedback, setListenFeedback] = useState<'correct' | 'wrong' | null>(null);
  const [listenDone, setListenDone] = useState(false);

  // Scramble state
  const scrambleRounds = useMemo(() => buildScrambleRounds(lessons, 4), [lessons, roundSeed]);
  const [scrambleIdx, setScrambleIdx] = useState(0);
  const [pickedTokenIds, setPickedTokenIds] = useState<string[]>([]);
  const [scrambleScore, setScrambleScore] = useState(0);
  const [scrambleStatus, setScrambleStatus] = useState<'idle' | 'correct' | 'wrong'>('idle');
  const [scrambleDone, setScrambleDone] = useState(false);

  const levelInfo = xpToLevel(gameXp);

  const resetAllGames = () => {
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

  // Match handler
  const handlePickVi = (viId: string) => {
    if (!selectedEnId || matchedIds.includes(viId)) return;
    if (selectedEnId === viId) {
      const nextMatched = [...matchedIds, viId];
      setMatchedIds(nextMatched);
      setSelectedEnId(null);
      if (nextMatched.length === matchPairs.length) {
        const finalXp = Math.max(40, 100 - matchMistakes * 15);
        setMatchDone(true);
        onFinishGame('match', finalXp);
      }
    } else {
      setMatchMistakes((m) => m + 1);
      setSelectedEnId(null);
    }
  };

  // Listen Rush handler
  const currentListen = listenQuestions[listenIdx];
  const handlePickListenOption = (option: string) => {
    if (!currentListen || listenFeedback !== null) return;
    const isCorrect = option.toLowerCase() === currentListen.answer.toLowerCase();
    const nextScore = isCorrect ? listenScore + 25 : listenScore;
    setListenScore(nextScore);
    setListenFeedback(isCorrect ? 'correct' : 'wrong');

    setTimeout(() => {
      if (listenIdx + 1 < listenQuestions.length) {
        setListenIdx((i) => i + 1);
        setListenFeedback(null);
      } else {
        setListenDone(true);
        onFinishGame('listen', nextScore);
      }
    }, 650);
  };

  // Scramble handlers
  const currentScramble = scrambleRounds[scrambleIdx];
  const toggleToken = (tokenId: string) => {
    if (scrambleStatus !== 'idle') return;
    setPickedTokenIds((prev) =>
      prev.includes(tokenId) ? prev.filter((id) => id !== tokenId) : [...prev, tokenId]
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
        onFinishGame('scramble', nextScore);
      }
    }, 850);
  };

  return (
    <div className="mx-auto max-w-4xl space-y-5">
      {/* Header */}
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <button
            type="button"
            onClick={onBack}
            className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-bold text-slate-800 hover:bg-slate-100"
          >
            <ArrowLeft className="h-4 w-4" />
            Lộ trình
          </button>

          <div className="flex items-center gap-3">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-300 bg-amber-50 px-3 py-1 text-xs font-extrabold text-amber-900">
              <Trophy className="h-3.5 w-3.5 text-amber-600" />
              Level {levelInfo.level} • {gameXp} XP
            </span>
            <button
              type="button"
              onClick={resetAllGames}
              className="inline-flex items-center gap-1 rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-100"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              Chơi bộ mới
            </button>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
          <div>
            <h1 className="flex items-center gap-2 text-xl font-extrabold text-slate-900">
              <Gamepad2 className="h-6 w-6 text-emerald-600" />
              Game Arena — Vừa học vừa chơi
            </h1>
            <p className="text-xs font-medium text-slate-600">
              Câu hỏi lấy trực tiếp từ các lĩnh vực ưu tiên của bạn • Hoàn thành để tích XP & giữ Streak
            </p>
          </div>
          <div className="w-44">
            <div className="flex justify-between text-[11px] font-bold text-slate-600">
              <span>Tiến độ Level {levelInfo.level + 1}</span>
              <span>
                {levelInfo.current}/{levelInfo.next} XP
              </span>
            </div>
            <div className="mt-1 h-2 w-full overflow-hidden rounded-full bg-slate-200">
              <div
                className="h-full bg-amber-500 transition-all"
                style={{ width: `${Math.round((levelInfo.current / levelInfo.next) * 100)}%` }}
              />
            </div>
          </div>
        </div>

        {/* 3 Game Tabs */}
        <div className="mt-4 grid gap-2 sm:grid-cols-3">
          {[
            { id: 'match', label: '1. Ghép cặp Anh – Việt', icon: Sparkles, best: gameBest.match ?? 0 },
            { id: 'listen', label: '2. Nghe nhanh bắt từ', icon: Headphones, best: gameBest.listen ?? 0 },
            { id: 'scramble', label: '3. Xếp từ thành câu', icon: Shuffle, best: gameBest.scramble ?? 0 },
          ].map((g) => {
            const Icon = g.icon;
            const active = activeGame === g.id;
            return (
              <button
                key={g.id}
                type="button"
                onClick={() => setActiveGame(g.id as GameId)}
                className={`flex flex-col items-start rounded-xl border p-3 text-left transition ${
                  active
                    ? 'border-emerald-600 bg-emerald-50 text-emerald-900'
                    : 'border-slate-200 bg-slate-50 text-slate-800 hover:bg-slate-100'
                }`}
              >
                <span className="inline-flex items-center gap-1.5 text-sm font-bold">
                  <Icon className="h-4 w-4 text-emerald-600" />
                  {g.label}
                </span>
                <span className="mt-1 text-[11px] font-semibold text-slate-600">
                  Kỷ lục: {g.best} XP
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Game 1: Ghép cặp Anh - Việt */}
      {activeGame === 'match' && (
        <div className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-bold text-slate-900">
              Chọn 1 câu tiếng Anh bên trái rồi ghép với nghĩa tiếng Việt bên phải
            </h2>
            <span className="text-xs font-bold text-slate-600">
              Đã ghép: {matchedIds.length}/{matchPairs.length} • Sai: {matchMistakes}
            </span>
          </div>

          {matchDone ? (
            <div className="rounded-xl border border-emerald-300 bg-emerald-50 p-6 text-center">
              <CheckCircle2 className="mx-auto h-10 w-10 text-emerald-600" />
              <p className="mt-2 text-lg font-extrabold text-slate-900">
                Hoàn thành! +{Math.max(40, 100 - matchMistakes * 15)} XP
              </p>
              <button
                type="button"
                onClick={resetAllGames}
                className="mt-3 rounded-xl bg-emerald-600 px-5 py-2 text-sm font-bold text-white hover:bg-emerald-700"
              >
                Chơi ván mới
              </button>
            </div>
          ) : (
            <div className="grid gap-3 md:grid-cols-2">
              <div className="space-y-2">
                {matchPairs.map((p) => {
                  const matched = matchedIds.includes(p.id);
                  const selected = selectedEnId === p.id;
                  return (
                    <button
                      key={`en-${p.id}`}
                      type="button"
                      disabled={matched}
                      onClick={() => {
                        setSelectedEnId(p.id);
                        speakSentence(p.en, 1.0, {}, voicePreset, 'expressive');
                      }}
                      className={`w-full rounded-xl border p-3 text-left text-xs font-bold transition ${
                        matched
                          ? 'border-emerald-300 bg-emerald-50 text-emerald-700 opacity-60'
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
                      key={`vi-${p.id}`}
                      type="button"
                      disabled={matched}
                      onClick={() => handlePickVi(p.id)}
                      className={`w-full rounded-xl border p-3 text-left text-xs font-semibold transition ${
                        matched
                          ? 'border-emerald-300 bg-emerald-50 text-emerald-700 opacity-60'
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

      {/* Game 2: Nghe nhanh bắt từ khóa */}
      {activeGame === 'listen' && (
        <div className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          {listenDone || !currentListen ? (
            <div className="rounded-xl border border-emerald-300 bg-emerald-50 p-6 text-center">
              <CheckCircle2 className="mx-auto h-10 w-10 text-emerald-600" />
              <p className="mt-2 text-lg font-extrabold text-slate-900">
                Tổng điểm Nghe nhanh: +{listenScore} XP
              </p>
              <button
                type="button"
                onClick={resetAllGames}
                className="mt-3 rounded-xl bg-emerald-600 px-5 py-2 text-sm font-bold text-white hover:bg-emerald-700"
              >
                Chơi ván mới
              </button>
            </div>
          ) : (
            <>
              <div className="flex items-center justify-between">
                <span className="text-sm font-bold text-slate-900">
                  Câu {listenIdx + 1} / {listenQuestions.length} — Nghe câu và chọn từ khóa bạn nghe thấy!
                </span>
                <span className="text-xs font-extrabold text-emerald-700">
                  Điểm: {listenScore} XP
                </span>
              </div>

              <div className="rounded-xl border border-slate-200 bg-slate-50 p-5 text-center">
                <button
                  type="button"
                  onClick={() =>
                    speakSentence(currentListen.sentence.en, 1.0, {}, voicePreset, 'expressive')
                  }
                  className="inline-flex items-center gap-2 rounded-full bg-emerald-600 px-6 py-2.5 text-sm font-bold text-white shadow-sm hover:bg-emerald-700"
                >
                  <Volume2 className="h-4 w-4" />
                  Nghe câu hỏi (No-Sub)
                </button>
                <p className="mt-2 text-xs font-medium text-slate-600">
                  Gợi ý nghĩa: {currentListen.sentence.vi}
                </p>
              </div>

              <div className="grid gap-2.5 sm:grid-cols-2">
                {currentListen.options.map((opt) => (
                  <button
                    key={opt}
                    type="button"
                    onClick={() => handlePickListenOption(opt)}
                    className="rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm font-bold text-slate-900 transition hover:border-emerald-600 hover:bg-emerald-50"
                  >
                    {opt}
                  </button>
                ))}
              </div>

              {listenFeedback && (
                <p
                  className={`text-center text-sm font-extrabold ${
                    listenFeedback === 'correct' ? 'text-emerald-700' : 'text-rose-600'
                  }`}
                >
                  {listenFeedback === 'correct'
                    ? 'Chính xác! +25 XP'
                    : `Chưa đúng — Từ khóa là "${currentListen.answer}"`}
                </p>
              )}
            </>
          )}
        </div>
      )}

      {/* Game 3: Xếp từ thành câu */}
      {activeGame === 'scramble' && (
        <div className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          {scrambleDone || !currentScramble ? (
            <div className="rounded-xl border border-emerald-300 bg-emerald-50 p-6 text-center">
              <CheckCircle2 className="mx-auto h-10 w-10 text-emerald-600" />
              <p className="mt-2 text-lg font-extrabold text-slate-900">
                Tổng điểm Xếp câu: +{scrambleScore} XP
              </p>
              <button
                type="button"
                onClick={resetAllGames}
                className="mt-3 rounded-xl bg-emerald-600 px-5 py-2 text-sm font-bold text-white hover:bg-emerald-700"
              >
                Chơi ván mới
              </button>
            </div>
          ) : (
            <>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-sm font-bold text-slate-900">
                  Câu {scrambleIdx + 1} / {scrambleRounds.length} — Bấm từng từ theo đúng thứ tự
                </span>
                <button
                  type="button"
                  onClick={() =>
                    speakSentence(currentScramble.sentence.en, 0.95, {}, voicePreset, 'expressive')
                  }
                  className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-300 bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-800"
                >
                  <Volume2 className="h-3.5 w-3.5" />
                  Nghe gợi ý
                </button>
              </div>

              <p className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs font-semibold text-slate-700">
                Nghĩa tiếng Việt: {currentScramble.sentence.vi}
              </p>

              {/* Selected sentence area */}
              <div className="min-h-14 rounded-xl border-2 border-dashed border-slate-300 bg-slate-50 p-3">
                <div className="flex flex-wrap gap-2">
                  {pickedTokenIds.length === 0 ? (
                    <span className="text-xs font-medium text-slate-400">
                      Bấm các thẻ từ bên dưới để ghép câu...
                    </span>
                  ) : (
                    pickedTokenIds.map((id) => {
                      const tok = currentScramble.tokens.find((t) => t.id === id);
                      if (!tok) return null;
                      return (
                        <button
                          key={`picked-${id}`}
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

              {/* Word pool */}
              <div className="flex flex-wrap gap-2">
                {currentScramble.tokens.map((tok) => {
                  const used = pickedTokenIds.includes(tok.id);
                  return (
                    <button
                      key={tok.id}
                      type="button"
                      disabled={used}
                      onClick={() => toggleToken(tok.id)}
                      className={`rounded-lg border px-2.5 py-1 text-xs font-bold transition ${
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
                    className={`text-sm font-extrabold ${
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
                  className="rounded-xl bg-emerald-600 px-5 py-2 text-sm font-bold text-white hover:bg-emerald-700 disabled:opacity-40"
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
