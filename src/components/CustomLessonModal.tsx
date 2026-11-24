import { useState } from 'react';
import { FilePlus2, X } from 'lucide-react';
import type { Lesson, LessonSentence, Track } from '../types/curriculum';
import { normalizeWords } from '../utils/wordScoring';

interface CustomLessonModalProps {
  onCreate: (lesson: Lesson) => void;
  onClose: () => void;
}

function pickClozeAndKeywords(sentence: string): { clozeWord: string; keywords: string[] } {
  const words = normalizeWords(sentence).filter((w) => w.length >= 5);
  const sorted = [...new Set(words)].sort((a, b) => b.length - a.length);
  const clozeWord = sorted[0] ?? sentence.trim().split(/\s+/)[0] ?? 'bank';
  return {
    clozeWord,
    keywords: sorted.slice(0, 2),
  };
}

export function CustomLessonModal({ onCreate, onClose }: CustomLessonModalProps) {
  const [title, setTitle] = useState('');
  const [scenario, setScenario] = useState('Tình huống công việc thực tế');
  const [track, setTrack] = useState<Track>('finance');
  const [rawText, setRawText] = useState('');
  const [error, setError] = useState<string | null>(null);

  const handleBuild = () => {
    const cleanTitle = title.trim();
    const rawSentences = rawText
      .split(/(?<=[.!?])\s+|\n+/)
      .map((s) => s.trim())
      .filter((s) => s.length > 5);

    if (!cleanTitle || rawSentences.length === 0) {
      setError('Vui lòng nhập tiêu đề và ít nhất 1 câu tiếng Anh.');
      return;
    }

    const sentences: LessonSentence[] = rawSentences.slice(0, 10).map((en, idx) => {
      const secs = idx * 8;
      const mm = String(Math.floor(secs / 60)).padStart(2, '0');
      const ss = String(secs % 60).padStart(2, '0');
      const { clozeWord, keywords } = pickClozeAndKeywords(en);
      return {
        id: `custom-${Date.now()}-${idx}`,
        startTime: `${mm}:${ss}`,
        en,
        vi: 'Bài luyện từ tài liệu thực tế của bạn',
        clozeWord,
        keywords,
      };
    });

    onCreate({
      id: `custom-${Date.now()}`,
      week: 1,
      day: 1,
      track,
      level: 'professional',
      title: cleanTitle,
      scenario: scenario.trim() || 'Custom Banking Scenario',
      sentences,
      isCustom: true,
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-4 backdrop-blur-sm">
      <div className="w-full max-w-xl space-y-4 rounded-2xl border border-slate-800 bg-slate-900 p-6 shadow-2xl">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-emerald-400">
            <FilePlus2 className="h-5 w-5" />
            <h2 className="text-lg font-bold text-white">Tạo bài luyện từ tài liệu công việc</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1 text-slate-400 hover:bg-slate-800 hover:text-white"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-400">Tiêu đề bài học</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="VD: Credit Committee Q4 Pitch"
              className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white focus:border-emerald-500 focus:outline-none"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-400">Chuyên ngành</label>
            <select
              value={track}
              onChange={(e) => setTrack(e.target.value as Track)}
              className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white focus:border-emerald-500 focus:outline-none"
            >
              <option value="finance">Tài chính (Finance)</option>
              <option value="credit">Tín dụng (Credit)</option>
              <option value="tech">Công nghệ thông tin & Fintech</option>
              <option value="legal">Pháp chế & Tuân thủ (Legal)</option>
              <option value="travel">Du lịch & Công tác (Travel)</option>
              <option value="daily">Đời sống hàng ngày (Daily Life)</option>
            </select>
          </div>
        </div>

        <div>
          <label className="mb-1 block text-xs font-medium text-slate-400">
            Bối cảnh (tùy chọn)
          </label>
          <input
            type="text"
            value={scenario}
            onChange={(e) => setScenario(e.target.value)}
            className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white focus:border-emerald-500 focus:outline-none"
          />
        </div>

        <div>
          <label className="mb-1 block text-xs font-medium text-slate-400">
            Dán đoạn email / kịch bản họp tiếng Anh (tự động tách câu & tạo bài tập 4 chế độ)
          </label>
          <textarea
            rows={5}
            value={rawText}
            onChange={(e) => setRawText(e.target.value)}
            placeholder="Paste your English banking email or meeting script here..."
            className="w-full rounded-lg border border-slate-700 bg-slate-950 p-3 text-sm text-white placeholder-slate-500 focus:border-emerald-500 focus:outline-none"
          />
        </div>

        {error && <p className="text-xs text-rose-400">{error}</p>}

        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-slate-700 px-4 py-2 text-sm text-slate-300 hover:bg-slate-800"
          >
            Hủy
          </button>
          <button
            type="button"
            onClick={handleBuild}
            className="rounded-xl bg-emerald-500 px-5 py-2 text-sm font-semibold text-slate-950 hover:bg-emerald-400"
          >
            Tạo bài & Luyện ngay
          </button>
        </div>
      </div>
    </div>
  );
}
