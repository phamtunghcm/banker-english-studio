import { useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  Award,
  Check,
  CheckCircle2,
  Compass,
  Sparkles,
  Volume2,
} from 'lucide-react';
import type {
  LearningGoal,
  LevelTier,
  RankTitle,
  Track,
  UserProfileConfig,
} from '../types/curriculum';
import { PLACEMENT_QUESTIONS } from '../data';
import { CURATED_FEMALE_VOICES, speakSentence } from '../utils/speechEngine';

interface OnboardingModalProps {
  initialProfile?: UserProfileConfig;
  initialLevel?: LevelTier;
  onComplete: (result: {
    level: LevelTier;
    rank: RankTitle;
    profileUpdates: Partial<UserProfileConfig>;
  }) => void;
}

const TRACK_OPTIONS: { id: Track; label: string; desc: string }[] = [
  { id: 'finance', label: 'Tài chính (Finance)', desc: 'NIM, CAR, ROA/ROE, FX, Treasury' },
  { id: 'credit', label: 'Tín dụng (Credit)', desc: 'DSCR, LTV, NPL, Basel III, L/C' },
  { id: 'tech', label: 'CNTT & Fintech', desc: 'Core Banking, Open API, eKYC, Cloud, AI' },
  { id: 'legal', label: 'Pháp chế (Legal)', desc: 'NDA, hợp đồng, PDPA, kiểm toán tuân thủ' },
  { id: 'travel', label: 'Du lịch & Công tác', desc: 'Sân bay, khách sạn, ăn tối đối tác' },
  { id: 'daily', label: 'Đời sống hàng ngày', desc: 'Small talk, sức khỏe, giao tiếp tự nhiên' },
];

const GOAL_OPTIONS: { id: LearningGoal; label: string; sub: string }[] = [
  { id: 'executive_meeting', label: 'Họp & Thuyết trình với sếp / đối tác', sub: 'Ưu tiên bài họp điều hành & tài chính' },
  { id: 'credit_committee', label: 'Thẩm định & Bảo vệ hồ sơ Tín dụng', sub: 'Ưu tiên tín dụng, rủi ro & pháp chế' },
  { id: 'fintech_it', label: 'Dự án Công nghệ / Fintech / War Room', sub: 'Ưu tiên CNTT, API, Cloud & Agile' },
  { id: 'travel_daily', label: 'Đi công tác, Du lịch & Giao tiếp đời sống', sub: 'Ưu tiên hội thoại sân bay, khách sạn & giao tiếp' },
];

const LEVEL_OPTIONS: {
  id: LevelTier;
  title: string;
  subtitle: string;
  rank: RankTitle;
}[] = [
  {
    id: 'foundation',
    title: 'Foundation (Nền tảng)',
    subtitle: 'Làm quen thuật ngữ Tài chính, Tín dụng & giao tiếp cơ bản',
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

export function OnboardingModal({
  initialProfile,
  initialLevel = 'foundation',
  onComplete,
}: OnboardingModalProps) {
  const [step, setStep] = useState<1 | 2>(1);
  const [focusTracks, setFocusTracks] = useState<Track[]>(
    initialProfile?.focusTracks ?? ['finance', 'credit', 'tech']
  );
  const [goal, setGoal] = useState<LearningGoal>(
    initialProfile?.goal ?? 'executive_meeting'
  );
  const [dailyMinutesTarget, setDailyMinutesTarget] = useState<15 | 30 | 45>(
    initialProfile?.dailyMinutesTarget ?? 15
  );
  const [voicePreset, setVoicePreset] = useState<string>(
    initialProfile?.voicePreset ?? CURATED_FEMALE_VOICES[0].id
  );

  // Step 2: Select level or Placement Test
  const [levelMode, setLevelMode] = useState<'select' | 'test'>('select');
  const [answers, setAnswers] = useState<Record<string, number>>({});

  const toggleTrack = (track: Track) => {
    setFocusTracks((prev) => {
      if (prev.includes(track)) {
        return prev.length > 1 ? prev.filter((t) => t !== track) : prev;
      }
      return [...prev, track];
    });
  };

  const finishWithLevel = (level: LevelTier, rank: RankTitle) => {
    onComplete({
      level,
      rank,
      profileUpdates: {
        focusTracks,
        goal,
        dailyMinutesTarget,
        voicePreset,
      },
    });
  };

  const handleSubmitTest = () => {
    let correct = 0;
    for (const q of PLACEMENT_QUESTIONS) {
      if (answers[q.id] === q.answerIndex) correct++;
    }
    const ratio = correct / PLACEMENT_QUESTIONS.length;
    if (ratio >= 0.8) {
      finishWithLevel('executive', 'Manager (B2)');
    } else if (ratio >= 0.5) {
      finishWithLevel('professional', 'Senior Officer (B1+)');
    } else {
      finishWithLevel('foundation', 'Analyst (B1)');
    }
  };

  return (
    <div className="mx-auto max-w-3xl rounded-2xl border border-slate-200 bg-white p-6 shadow-lg">
      {/* Header & Stepper */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-emerald-100 text-emerald-700">
            <Sparkles className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-xl font-extrabold text-slate-900">
              Thiết lập Lộ trình Cá nhân hóa
            </h1>
            <p className="text-xs font-semibold text-slate-600">
              Bước {step} / 2:{' '}
              {step === 1
                ? 'Chọn Lĩnh vực, Mục tiêu & Giọng đọc'
                : 'Chọn Trình độ hoặc làm Test Năng lực đầu vào'}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          <span
            className={`h-2.5 w-10 rounded-full ${
              step >= 1 ? 'bg-emerald-600' : 'bg-slate-200'
            }`}
          />
          <span
            className={`h-2.5 w-10 rounded-full ${
              step >= 2 ? 'bg-emerald-600' : 'bg-slate-200'
            }`}
          />
        </div>
      </div>

      {step === 1 ? (
        <div className="mt-6 space-y-5">
          {/* 1. Focus Tracks */}
          <div>
            <h2 className="text-sm font-extrabold text-slate-900">
              1. Chọn các lĩnh vực bạn muốn học (có thể chọn nhiều)
            </h2>
            <div className="mt-2.5 grid gap-2.5 sm:grid-cols-2">
              {TRACK_OPTIONS.map((t) => {
                const selected = focusTracks.includes(t.id);
                return (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => toggleTrack(t.id)}
                    className={`flex items-start justify-between rounded-xl border p-3 text-left transition ${
                      selected
                        ? 'border-emerald-600 bg-emerald-50'
                        : 'border-slate-200 bg-slate-50 hover:bg-slate-100'
                    }`}
                  >
                    <div>
                      <p className="text-sm font-bold text-slate-900">{t.label}</p>
                      <p className="mt-0.5 text-xs font-medium text-slate-600">{t.desc}</p>
                    </div>
                    <span
                      className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md border ${
                        selected
                          ? 'border-emerald-600 bg-emerald-600 text-white'
                          : 'border-slate-300 bg-white'
                      }`}
                    >
                      {selected && <Check className="h-3.5 w-3.5" />}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* 2. Goal */}
          <div>
            <h2 className="text-sm font-extrabold text-slate-900">
              2. Mục tiêu giao tiếp chính của bạn
            </h2>
            <div className="mt-2.5 grid gap-2 sm:grid-cols-2">
              {GOAL_OPTIONS.map((g) => {
                const selected = goal === g.id;
                return (
                  <button
                    key={g.id}
                    type="button"
                    onClick={() => setGoal(g.id)}
                    className={`rounded-xl border p-3 text-left transition ${
                      selected
                        ? 'border-emerald-600 bg-emerald-50'
                        : 'border-slate-200 bg-slate-50 hover:bg-slate-100'
                    }`}
                  >
                    <p className="text-xs font-bold text-slate-900">{g.label}</p>
                    <p className="mt-0.5 text-[11px] font-medium text-slate-600">{g.sub}</p>
                  </button>
                );
              })}
            </div>
          </div>

          {/* 3. Daily Time + Voice */}
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <h2 className="text-sm font-extrabold text-slate-900">
                3. Thời lượng học mỗi ngày
              </h2>
              <div className="mt-2 grid grid-cols-3 gap-2">
                {([15, 30, 45] as const).map((mins) => (
                  <button
                    key={mins}
                    type="button"
                    onClick={() => setDailyMinutesTarget(mins)}
                    className={`rounded-xl border py-2 text-xs font-bold ${
                      dailyMinutesTarget === mins
                        ? 'border-emerald-600 bg-emerald-600 text-white'
                        : 'border-slate-200 bg-slate-50 text-slate-800 hover:bg-slate-100'
                    }`}
                  >
                    {mins} phút
                  </button>
                ))}
              </div>
            </div>

            <div>
              <h2 className="text-sm font-extrabold text-slate-900">
                4. Chọn 1 trong 5 giọng nữ truyền cảm
              </h2>
              <div className="mt-2 flex items-center gap-1.5">
                <select
                  aria-label="Chọn giọng nữ đầu vào"
                  value={voicePreset}
                  onChange={(e) => setVoicePreset(e.target.value)}
                  className="min-w-0 flex-1 rounded-xl border border-slate-300 bg-white px-2.5 py-2 text-xs font-bold text-slate-900"
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
                      'Welcome to FinTech Banker English Studio. Let us build your roadmap.',
                      1.0,
                      {},
                      voicePreset,
                      'expressive'
                    )
                  }
                  className="inline-flex shrink-0 items-center gap-1 rounded-xl border border-emerald-300 bg-emerald-50 px-3 py-2 text-xs font-bold text-emerald-800 hover:bg-emerald-100"
                >
                  <Volume2 className="h-3.5 w-3.5" />
                  Thử
                </button>
              </div>
            </div>
          </div>

          <div className="flex justify-end pt-2">
            <button
              type="button"
              onClick={() => setStep(2)}
              className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-5 py-2.5 text-sm font-bold text-white hover:bg-emerald-700"
            >
              Tiếp tục: Đánh giá năng lực
              <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      ) : (
        <div className="mt-5 space-y-5">
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setLevelMode('select')}
              className={`flex-1 rounded-xl border px-4 py-2.5 text-sm font-bold transition ${
                levelMode === 'select'
                  ? 'border-emerald-600 bg-emerald-50 text-emerald-800'
                  : 'border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100'
              }`}
            >
              <Compass className="mr-2 inline h-4 w-4" />
              Tự chọn trình độ
            </button>
            <button
              type="button"
              onClick={() => setLevelMode('test')}
              className={`flex-1 rounded-xl border px-4 py-2.5 text-sm font-bold transition ${
                levelMode === 'test'
                  ? 'border-emerald-600 bg-emerald-50 text-emerald-800'
                  : 'border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100'
              }`}
            >
              <Award className="mr-2 inline h-4 w-4" />
              Làm Test Năng lực ({PLACEMENT_QUESTIONS.length} câu)
            </button>
          </div>

          {levelMode === 'select' ? (
            <div className="grid gap-3">
              {LEVEL_OPTIONS.map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => finishWithLevel(opt.id, opt.rank)}
                  className={`flex items-center justify-between rounded-xl border p-4 text-left transition ${
                    initialLevel === opt.id
                      ? 'border-emerald-500 bg-emerald-50/60'
                      : 'border-slate-200 bg-slate-50 hover:border-emerald-500 hover:bg-emerald-50/40'
                  }`}
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
            <div className="space-y-4">
              {PLACEMENT_QUESTIONS.map((q, idx) => (
                <div key={q.id} className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-sm font-bold text-slate-900">
                      {idx + 1}. {q.prompt}
                    </p>
                    {q.audioText && (
                      <button
                        type="button"
                        onClick={() =>
                          speakSentence(q.audioText!, 1.0, {}, voicePreset, 'expressive')
                        }
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
                  Chấm điểm & Xây dựng Lộ trình
                </button>
              </div>
            </div>
          )}

          <div className="flex justify-start">
            <button
              type="button"
              onClick={() => setStep(1)}
              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-300 px-4 py-2 text-xs font-bold text-slate-700 hover:bg-slate-100"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              Quay lại bước 1
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
