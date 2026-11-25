import { useEffect, useRef, useState } from 'react';
import {
  ArrowLeft,
  Award,
  BookOpen,
  CheckCircle2,
  Clock,
  Headphones,
  Highlighter,
  Mic,
  MicOff,
  Pause,
  PenTool,
  Play,
  Sparkles,
  Volume2,
} from 'lucide-react';
import { EXAM_SUITES, type ExamId, type ExamSkill } from '../data/examStudio';
import { evaluateWritingResponse, formatExamBand, type WritingEvaluation } from '../utils/writingCoach';
import { speakSentence, stopSpeaking } from '../utils/speechEngine';
import { startKaraokeMicSession, type KaraokeMicHandle } from '../utils/karaokeRecorder';
import { preloadWhisper, transcribeWithWhisper } from '../utils/whisperEngine';
import { analyzePronunciation, type PronunciationReport } from '../utils/pronunciationCoach';
import { playCorrectSound, playFanfareSound, playTapSound, playWrongSound } from '../utils/soundFx';

interface ExamStudioViewProps {
  initialExam?: ExamId;
  savedExamScores?: Record<string, Partial<Record<ExamSkill, number>>>;
  onSaveSkillScore: (examId: ExamId, skill: ExamSkill, scorePercent: number) => void;
  onBack: () => void;
}

const SKILLS: { id: ExamSkill; label: string; icon: typeof Headphones }[] = [
  { id: 'listening', label: 'Listening', icon: Headphones },
  { id: 'reading', label: 'Reading', icon: BookOpen },
  { id: 'speaking', label: 'Speaking', icon: Mic },
  { id: 'writing', label: 'Writing', icon: PenTool },
];

export function ExamStudioView({
  initialExam = 'ielts',
  savedExamScores = {},
  onSaveSkillScore,
  onBack,
}: ExamStudioViewProps) {
  const [examId, setExamId] = useState<ExamId>(initialExam);
  const [skill, setSkill] = useState<ExamSkill>('listening');

  // Listening state
  const [isPlayingAudio, setIsPlayingAudio] = useState(false);
  const [showTranscript, setShowTranscript] = useState(false);
  const [listenAnswers, setListenAnswers] = useState<Record<string, number>>({});
  const [listenSubmitted, setListenSubmitted] = useState(false);

  // Reading state
  const [readAnswers, setReadAnswers] = useState<Record<string, number>>({});
  const [readSubmitted, setReadSubmitted] = useState(false);
  const [activeEvidence, setActiveEvidence] = useState<string | null>(null);

  // Speaking Mock state
  const [timerPhase, setTimerPhase] = useState<'idle' | 'prep' | 'speak'>('idle');
  const [secondsLeft, setSecondsLeft] = useState(0);
  const [isRecording, setIsRecording] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [speakReport, setSpeakReport] = useState<PronunciationReport | null>(null);
  const [speakError, setSpeakError] = useState<string | null>(null);
  const [showModelSpeak, setShowModelSpeak] = useState(false);
  const micRef = useRef<KaraokeMicHandle | null>(null);

  // Writing Coach state
  const [writingText, setWritingText] = useState('');
  const [writingEval, setWritingEval] = useState<WritingEvaluation | null>(null);
  const [showSampleEssay, setShowSampleEssay] = useState(false);

  const suite = EXAM_SUITES[examId];
  const currentScores = savedExamScores[examId] ?? {};
  const completedSkillScores = Object.values(currentScores).filter(
    (v): v is number => typeof v === 'number'
  );
  const overallAvg =
    completedSkillScores.length > 0
      ? Math.round(
          completedSkillScores.reduce((a, b) => a + b, 0) / completedSkillScores.length
        )
      : null;

  useEffect(() => {
    return () => {
      stopSpeaking();
      if (micRef.current) {
        void micRef.current.stop();
        micRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    if (timerPhase === 'idle' || secondsLeft <= 0) return;
    const t = setTimeout(() => {
      if (secondsLeft <= 1) {
        if (timerPhase === 'prep') {
          playTapSound();
          setTimerPhase('speak');
          setSecondsLeft(suite.speaking.speakSeconds);
        } else {
          playFanfareSound();
          setTimerPhase('idle');
          setSecondsLeft(0);
        }
      } else {
        setSecondsLeft((s) => s - 1);
      }
    }, 1000);
    return () => clearTimeout(t);
  }, [timerPhase, secondsLeft, suite.speaking.speakSeconds]);

  const resetLocalSkillState = () => {
    stopSpeaking();
    setIsPlayingAudio(false);
    setShowTranscript(false);
    setListenAnswers({});
    setListenSubmitted(false);
    setReadAnswers({});
    setReadSubmitted(false);
    setActiveEvidence(null);
    setTimerPhase('idle');
    setSecondsLeft(0);
    setSpeakReport(null);
    setSpeakError(null);
    setShowModelSpeak(false);
    setWritingText('');
    setWritingEval(null);
    setShowSampleEssay(false);
  };

  const handleTogglePlay = (text: string, voiceId: string, audioId: string) => {
    if (isPlayingAudio) {
      stopSpeaking();
      setIsPlayingAudio(false);
      return;
    }
    setIsPlayingAudio(true);
    speakSentence(
      text,
      1.0,
      {
        onEnd: () => setIsPlayingAudio(false),
        onError: () => setIsPlayingAudio(false),
      },
      voiceId,
      'executive',
      audioId
    );
  };

  const handleSubmitListening = () => {
    const qs = suite.listening.questions;
    const correct = qs.filter((q) => listenAnswers[q.id] === q.answerIndex).length;
    const pct = Math.round((correct / qs.length) * 100);
    setListenSubmitted(true);
    if (pct >= 66) playCorrectSound();
    else playWrongSound();
    onSaveSkillScore(examId, 'listening', pct);
  };

  const handleSubmitReading = () => {
    const qs = suite.reading.questions;
    const correct = qs.filter((q) => readAnswers[q.id] === q.answerIndex).length;
    const pct = Math.round((correct / qs.length) * 100);
    setReadSubmitted(true);
    if (pct >= 66) playCorrectSound();
    else playWrongSound();
    onSaveSkillScore(examId, 'reading', pct);
  };

  const handleToggleSpeakMic = async () => {
    if (isRecording) {
      setIsRecording(false);
      const handle = micRef.current;
      micRef.current = null;
      if (!handle) return;
      const rec = await handle.stop();
      if (!rec.hasVoice || rec.pcm16k.length < 1600) {
        playWrongSound();
        setSpeakError('Không phát hiện giọng nói — hãy kiểm tra Micro và nói to hơn nhé.');
        return;
      }
      setIsAnalyzing(true);
      setSpeakError(null);
      try {
        const transcript = await transcribeWithWhisper(rec.pcm16k);
        const rep = analyzePronunciation(suite.speaking.modelAnswer, transcript);
        // For open-ended speaking mock, reward fluent speech length + vocabulary match
        const spokenWords = transcript ? transcript.split(/\s+/).filter(Boolean).length : 0;
        const fluencyBoost = Math.min(85, Math.round((spokenWords / 35) * 85));
        const finalScore = Math.max(rep.accuracy, spokenWords >= 12 ? fluencyBoost : rep.accuracy);
        const finalReport: PronunciationReport = { ...rep, accuracy: finalScore };
        setSpeakReport(finalReport);
        if (finalScore >= 65) playCorrectSound();
        else playWrongSound();
        onSaveSkillScore(examId, 'speaking', finalScore);
      } catch (err) {
        setSpeakError(err instanceof Error ? err.message : 'Lỗi Whisper AI.');
      } finally {
        setIsAnalyzing(false);
      }
      return;
    }

    stopSpeaking();
    setIsPlayingAudio(false);
    setSpeakError(null);
    void preloadWhisper();
    try {
      micRef.current = await startKaraokeMicSession();
      setIsRecording(true);
    } catch (err) {
      setSpeakError(err instanceof Error ? err.message : 'Không thể mở Micro.');
    }
  };

  const handleGradeWriting = () => {
    const result = evaluateWritingResponse(
      writingText,
      examId,
      suite.writing.targetMinWords,
      suite.writing.topicKeywords
    );
    setWritingEval(result);
    if (result.scorePercent >= 70) playFanfareSound();
    else playTapSound();
    onSaveSkillScore(examId, 'writing', result.scorePercent);
  };

  const wordCount = writingText.trim() ? writingText.trim().split(/\s+/).length : 0;

  return (
    <div className="mx-auto max-w-3xl space-y-5 pb-8">
      {/* Header + Exam Switcher */}
      <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <button
            type="button"
            onClick={() => {
              stopSpeaking();
              onBack();
            }}
            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-300 bg-white px-3 py-1.5 text-xs font-bold text-slate-800 hover:bg-slate-100"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Về Trang chủ
          </button>

          <div className="inline-flex items-center gap-1.5 rounded-full bg-indigo-100 px-3 py-1 text-xs font-extrabold text-indigo-900">
            <Award className="h-4 w-4 text-indigo-700" />
            {overallAvg !== null
              ? `Ước lượng: ${formatExamBand(examId, overallAvg)}`
              : 'Chưa có điểm — Làm thử 1 kỹ năng để chấm Band'}
          </div>
        </div>

        {/* 3 Exam Selector Pills */}
        <div className="grid grid-cols-3 gap-2">
          {(['ielts', 'toefl', 'toeic'] as ExamId[]).map((id) => {
            const s = EXAM_SUITES[id];
            const active = examId === id;
            return (
              <button
                key={id}
                type="button"
                onClick={() => {
                  playTapSound();
                  setExamId(id);
                  resetLocalSkillState();
                }}
                className={`rounded-2xl border-2 p-3 text-left transition ${
                  active
                    ? 'border-indigo-600 bg-indigo-50 shadow-sm'
                    : 'border-slate-200 bg-slate-50 hover:bg-slate-100'
                }`}
              >
                <p className="text-xs font-extrabold text-slate-900 sm:text-sm">{s.name.split(' ')[0]}</p>
                <p className="text-[10px] font-bold text-indigo-700">{s.badge}</p>
              </button>
            );
          })}
        </div>

        <div>
          <h1 className="text-lg font-extrabold text-slate-900">{suite.name}</h1>
          <p className="mt-0.5 text-xs font-medium text-slate-600">{suite.description}</p>
        </div>

        {/* 4-Skill Tabs with Best Score Badges */}
        <div className="grid grid-cols-4 gap-2">
          {SKILLS.map((sk) => {
            const Icon = sk.icon;
            const active = skill === sk.id;
            const best = currentScores[sk.id];
            return (
              <button
                key={sk.id}
                type="button"
                onClick={() => {
                  stopSpeaking();
                  setIsPlayingAudio(false);
                  playTapSound();
                  setSkill(sk.id);
                }}
                className={`flex flex-col items-center justify-center gap-1 rounded-2xl border-2 py-2.5 text-xs font-extrabold transition ${
                  active
                    ? 'border-indigo-600 bg-indigo-600 text-white shadow-sm'
                    : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                }`}
              >
                <Icon className="h-4 w-4" />
                <span>{sk.label}</span>
                {best !== undefined && (
                  <span
                    className={`rounded-full px-1.5 py-0.5 text-[10px] ${
                      active ? 'bg-white/20 text-white' : 'bg-emerald-100 text-emerald-800'
                    }`}
                  >
                    {best}%
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* SKILL 1: LISTENING MOCK */}
      {skill === 'listening' && (
        <div className="animate-card-in space-y-4 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <div>
            <h2 className="text-base font-extrabold text-slate-900">{suite.listening.title}</h2>
            <p className="text-xs font-medium text-slate-600">{suite.listening.subtitle}</p>
          </div>

          <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-indigo-200 bg-indigo-50/70 p-4">
            <button
              type="button"
              onClick={() =>
                handleTogglePlay(
                  suite.listening.transcript,
                  suite.listening.voiceId,
                  suite.listening.audioId
                )
              }
              className="btn-tactile-indigo inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-5 py-2.5 text-xs font-extrabold text-white hover:bg-indigo-500"
            >
              {isPlayingAudio ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
              {isPlayingAudio ? 'Dừng audio' : '▶ Nghe bài thi (Giọng bản xứ)'}
            </button>
            <button
              type="button"
              onClick={() => setShowTranscript((v) => !v)}
              className="rounded-xl border border-indigo-200 bg-white px-3.5 py-2.5 text-xs font-bold text-indigo-900 hover:bg-indigo-50"
            >
              {showTranscript ? 'Ẩn Transcript' : 'Xem Transcript (sau khi nghe)'}
            </button>
          </div>

          {showTranscript && (
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm font-medium leading-relaxed text-slate-800">
              {suite.listening.transcript}
            </div>
          )}

          <div className="space-y-4">
            {suite.listening.questions.map((q, qIdx) => (
              <div key={q.id} className="space-y-2 rounded-2xl border border-slate-200 p-4">
                <p className="text-sm font-extrabold text-slate-900">
                  Câu {qIdx + 1}: {q.prompt}
                </p>
                <div className="space-y-2">
                  {q.options.map((opt, oIdx) => {
                    const chosen = listenAnswers[q.id] === oIdx;
                    const isRight = oIdx === q.answerIndex;
                    let cls = 'border-slate-200 bg-white text-slate-800 hover:border-indigo-400';
                    if (listenSubmitted) {
                      if (isRight) cls = 'border-emerald-500 bg-emerald-50 text-emerald-950 font-bold';
                      else if (chosen) cls = 'border-rose-400 bg-rose-50 text-rose-900';
                    } else if (chosen) {
                      cls = 'border-indigo-600 bg-indigo-50 text-indigo-950 font-bold';
                    }
                    return (
                      <button
                        key={oIdx}
                        type="button"
                        disabled={listenSubmitted}
                        onClick={() => setListenAnswers((prev) => ({ ...prev, [q.id]: oIdx }))}
                        className={`flex w-full items-center justify-between rounded-xl border-2 px-3.5 py-2.5 text-left text-xs font-semibold ${cls}`}
                      >
                        <span>{opt}</span>
                        {listenSubmitted && isRight && (
                          <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
                        )}
                      </button>
                    );
                  })}
                </div>
                {listenSubmitted && (
                  <p className="rounded-xl bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-950">
                    💡 {q.explanationVi}
                  </p>
                )}
              </div>
            ))}
          </div>

          {!listenSubmitted ? (
            <button
              type="button"
              onClick={handleSubmitListening}
              className="btn-tactile-emerald w-full rounded-2xl bg-emerald-600 py-3.5 text-sm font-extrabold text-white"
            >
              Nộp bài Listening & Chấm điểm
            </button>
          ) : (
            <div className="rounded-2xl border-2 border-emerald-400 bg-emerald-50 p-4 text-center">
              <p className="text-base font-extrabold text-emerald-900">
                Kết quả Listening: {currentScores.listening ?? 0}% —{' '}
                {formatExamBand(examId, currentScores.listening ?? 0)}
              </p>
            </div>
          )}
        </div>
      )}

      {/* SKILL 2: READING MOCK WITH EVIDENCE HIGHLIGHT */}
      {skill === 'reading' && (
        <div className="animate-card-in space-y-4 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <div>
            <h2 className="text-base font-extrabold text-slate-900">{suite.reading.title}</h2>
            <p className="text-xs font-medium text-slate-600">{suite.reading.subtitle}</p>
          </div>

          <div className="space-y-3 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm leading-relaxed text-slate-800">
            {suite.reading.passage.map((para, pIdx) => {
              if (activeEvidence && para.includes(activeEvidence)) {
                const parts = para.split(activeEvidence);
                return (
                  <p key={pIdx} className="font-medium">
                    {parts[0]}
                    <mark className="rounded bg-amber-200 px-1 font-bold text-slate-950">
                      {activeEvidence}
                    </mark>
                    {parts.slice(1).join(activeEvidence)}
                  </p>
                );
              }
              return (
                <p key={pIdx} className="font-medium">
                  {para}
                </p>
              );
            })}
          </div>

          <div className="space-y-4">
            {suite.reading.questions.map((q, qIdx) => (
              <div key={q.id} className="space-y-2 rounded-2xl border border-slate-200 p-4">
                <p className="text-sm font-extrabold text-slate-900">
                  Câu {qIdx + 1}: {q.prompt}
                </p>
                <div className="space-y-2">
                  {q.options.map((opt, oIdx) => {
                    const chosen = readAnswers[q.id] === oIdx;
                    const isRight = oIdx === q.answerIndex;
                    let cls = 'border-slate-200 bg-white text-slate-800 hover:border-indigo-400';
                    if (readSubmitted) {
                      if (isRight) cls = 'border-emerald-500 bg-emerald-50 text-emerald-950 font-bold';
                      else if (chosen) cls = 'border-rose-400 bg-rose-50 text-rose-900';
                    } else if (chosen) {
                      cls = 'border-indigo-600 bg-indigo-50 text-indigo-950 font-bold';
                    }
                    return (
                      <button
                        key={oIdx}
                        type="button"
                        disabled={readSubmitted}
                        onClick={() => setReadAnswers((prev) => ({ ...prev, [q.id]: oIdx }))}
                        className={`flex w-full items-center justify-between rounded-xl border-2 px-3.5 py-2.5 text-left text-xs font-semibold ${cls}`}
                      >
                        <span>{opt}</span>
                        {readSubmitted && isRight && (
                          <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
                        )}
                      </button>
                    );
                  })}
                </div>
                {readSubmitted && (
                  <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-950">
                    <span>💡 {q.explanationVi}</span>
                    {q.evidenceQuote && (
                      <button
                        type="button"
                        onClick={() => setActiveEvidence(q.evidenceQuote ?? null)}
                        className="inline-flex items-center gap-1 rounded-lg bg-amber-200 px-2.5 py-1 text-[11px] font-extrabold text-amber-950 hover:bg-amber-300"
                      >
                        <Highlighter className="h-3.5 w-3.5" />
                        Tô sáng dẫn chứng
                      </button>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>

          {!readSubmitted ? (
            <button
              type="button"
              onClick={handleSubmitReading}
              className="btn-tactile-emerald w-full rounded-2xl bg-emerald-600 py-3.5 text-sm font-extrabold text-white"
            >
              Nộp bài Reading & Chấm điểm
            </button>
          ) : (
            <div className="rounded-2xl border-2 border-emerald-400 bg-emerald-50 p-4 text-center">
              <p className="text-base font-extrabold text-emerald-900">
                Kết quả Reading: {currentScores.reading ?? 0}% —{' '}
                {formatExamBand(examId, currentScores.reading ?? 0)}
              </p>
            </div>
          )}
        </div>
      )}

      {/* SKILL 3: SPEAKING MOCK WITH COUNTDOWN TIMER */}
      {skill === 'speaking' && (
        <div className="animate-card-in space-y-4 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2 className="text-base font-extrabold text-slate-900">{suite.speaking.title}</h2>
              <p className="text-xs font-medium text-slate-600">{suite.speaking.subtitle}</p>
            </div>
            <button
              type="button"
              onClick={() => {
                playTapSound();
                setTimerPhase('prep');
                setSecondsLeft(suite.speaking.prepSeconds);
              }}
              className="inline-flex items-center gap-1.5 rounded-xl border border-amber-300 bg-amber-50 px-3.5 py-2 text-xs font-extrabold text-amber-950 hover:bg-amber-100"
            >
              <Clock className="h-4 w-4 text-amber-600" />
              {timerPhase === 'idle'
                ? `Bấm giờ thi (${suite.speaking.prepSeconds}s chuẩn bị)`
                : timerPhase === 'prep'
                  ? `Chuẩn bị: ${secondsLeft}s`
                  : `Đang nói: ${secondsLeft}s`}
            </button>
          </div>

          <div className="rounded-2xl border-2 border-indigo-200 bg-indigo-50/50 p-4 space-y-1.5">
            {suite.speaking.promptBullets.map((b, i) => (
              <p
                key={i}
                className={
                  i === 0 ? 'text-sm font-extrabold text-indigo-950' : 'text-xs font-semibold text-slate-700'
                }
              >
                {i === 0 ? b : `• ${b}`}
              </p>
            ))}
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={isAnalyzing}
              onClick={() => void handleToggleSpeakMic()}
              className={`btn-tactile-emerald flex-1 inline-flex items-center justify-center gap-2 rounded-2xl py-3.5 text-sm font-extrabold text-white disabled:opacity-50 ${
                isRecording ? 'animate-pulse bg-rose-600' : 'bg-emerald-600 hover:bg-emerald-500'
              }`}
            >
              {isRecording ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
              {isRecording ? 'Dừng & Chấm điểm Speaking AI' : 'Bắt đầu Nói (Thu âm & Chấm Band)'}
            </button>

            <button
              type="button"
              onClick={() =>
                handleTogglePlay(
                  suite.speaking.modelAnswer,
                  suite.speaking.modelVoiceId,
                  suite.speaking.modelAudioId
                )
              }
              className="btn-tactile-white inline-flex items-center gap-1.5 rounded-2xl border border-slate-300 bg-white px-4 py-3 text-xs font-extrabold text-slate-800"
            >
              <Volume2 className="h-4 w-4 text-indigo-600" />
              Nghe bài mẫu Band 8.0
            </button>
          </div>

          {isAnalyzing && (
            <p className="rounded-xl bg-sky-50 px-3 py-2 text-xs font-bold text-sky-900">
              🧠 Whisper AI đang phân tích bài nói của bạn...
            </p>
          )}
          {speakError && (
            <p className="rounded-xl border border-amber-300 bg-amber-50 px-3 py-2 text-xs font-bold text-amber-900">
              {speakError}
            </p>
          )}

          {speakReport && (
            <div className="rounded-2xl border-2 border-emerald-400 bg-emerald-50 p-4">
              <p className="text-base font-extrabold text-emerald-900">
                Ước lượng Speaking: {speakReport.accuracy}% —{' '}
                {formatExamBand(examId, speakReport.accuracy)}
              </p>
            </div>
          )}

          <div>
            <button
              type="button"
              onClick={() => setShowModelSpeak((v) => !v)}
              className="text-xs font-bold text-indigo-700 hover:underline"
            >
              {showModelSpeak ? 'Ẩn bài mẫu Band 8.0' : 'Xem bài mẫu Band 8.0 + Dịch tiếng Việt'}
            </button>
            {showModelSpeak && (
              <div className="mt-2 space-y-2 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-xs">
                <p className="font-bold leading-relaxed text-slate-900">{suite.speaking.modelAnswer}</p>
                <p className="font-medium leading-relaxed text-slate-600">{suite.speaking.modelAnswerVi}</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* SKILL 4: WRITING COACH WITH INSTANT BAND ESTIMATOR */}
      {skill === 'writing' && (
        <div className="animate-card-in space-y-4 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <div>
            <h2 className="text-base font-extrabold text-slate-900">{suite.writing.title}</h2>
            <p className="text-xs font-medium text-slate-600">{suite.writing.subtitle}</p>
          </div>

          <div className="rounded-2xl border-2 border-indigo-200 bg-indigo-50/50 p-4 text-sm font-bold text-indigo-950">
            {suite.writing.prompt}
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-xs font-bold">
              <span className="text-slate-600">Bài viết của bạn (Tiếng Anh):</span>
              <span
                className={
                  wordCount >= suite.writing.targetMinWords ? 'text-emerald-700' : 'text-amber-700'
                }
              >
                {wordCount} / {suite.writing.targetMinWords} từ mục tiêu
              </span>
            </div>
            <textarea
              rows={7}
              value={writingText}
              onChange={(e) => setWritingText(e.target.value)}
              placeholder="Write your response here using clear connectors (However, Furthermore, For instance, Therefore)..."
              className="w-full rounded-2xl border-2 border-slate-200 bg-white p-4 text-sm font-medium text-slate-900 focus:border-indigo-500 focus:outline-none"
            />
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={handleGradeWriting}
              className="btn-tactile-emerald flex-1 inline-flex items-center justify-center gap-2 rounded-2xl bg-emerald-600 py-3.5 text-sm font-extrabold text-white"
            >
              <Sparkles className="h-4 w-4" />
              Chấm Band Writing tức thì
            </button>
            <button
              type="button"
              onClick={() => setShowSampleEssay((v) => !v)}
              className="btn-tactile-white rounded-2xl border border-slate-300 bg-white px-4 py-3 text-xs font-extrabold text-slate-800"
            >
              {showSampleEssay ? 'Ẩn bài mẫu' : 'Xem bài mẫu Band 8.0'}
            </button>
          </div>

          {writingEval && (
            <div className="space-y-3 rounded-2xl border-2 border-emerald-400 bg-emerald-50/50 p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-sm font-extrabold text-emerald-950">
                  🏆 {writingEval.estimatedBandLabel}
                </span>
                <span className="rounded-full bg-emerald-600 px-3 py-0.5 text-xs font-extrabold text-white">
                  {writingEval.scorePercent}/100 điểm
                </span>
              </div>
              {writingEval.strengths.length > 0 && (
                <div className="space-y-1 text-xs font-semibold text-emerald-900">
                  {writingEval.strengths.map((s, i) => (
                    <p key={i}>✓ {s}</p>
                  ))}
                </div>
              )}
              {writingEval.improvements.length > 0 && (
                <div className="space-y-1 border-t border-emerald-200 pt-2 text-xs font-semibold text-amber-900">
                  {writingEval.improvements.map((imp, i) => (
                    <p key={i}>→ {imp}</p>
                  ))}
                </div>
              )}
            </div>
          )}

          {showSampleEssay && (
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-xs font-medium leading-relaxed text-slate-800">
              <p className="mb-1 font-extrabold text-indigo-900">Bài mẫu tham khảo (Band 8.0):</p>
              {suite.writing.sampleAnswer}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
