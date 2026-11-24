import '@testing-library/jest-dom/vitest';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { LessonPlayer } from '../LessonPlayer';
import type { Lesson } from '../../types/curriculum';

const MOCK_LESSON: Lesson = {
  id: 'test-w1d1',
  week: 1,
  day: 1,
  track: 'finance',
  level: 'foundation',
  title: 'Net Interest Margin Briefing',
  scenario: 'ALCO Quarterly Meeting',
  sentences: [
    {
      id: 's1',
      startTime: '00:00',
      en: 'Our net interest margin expanded rapidly.',
      vi: 'Biên lãi thuần của chúng ta tăng nhanh.',
      clozeWord: 'margin',
      keywords: ['margin'],
    },
    {
      id: 's2',
      startTime: '00:08',
      en: 'Lower funding costs drove strong profitability.',
      vi: 'Chi phí vốn thấp hơn thúc đẩy lợi nhuận.',
      clozeWord: 'funding',
      keywords: ['funding'],
    },
  ],
};

describe('LessonPlayer', () => {
  it('renders 4 mode tabs and toggles No-Sub cleanly', () => {
    render(<LessonPlayer lesson={MOCK_LESSON} onComplete={vi.fn()} onBack={vi.fn()} />);

    expect(screen.getByText('Net Interest Margin Briefing')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Phụ đề/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Shadowing/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Chính tả/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Điền từ/i })).toBeInTheDocument();

    // Subtitle visible by default (rendered in both stage and transcript list)
    expect(screen.getAllByText('Biên lãi thuần của chúng ta tăng nhanh.').length).toBeGreaterThanOrEqual(1);

    // Toggle No-Sub hides both English and Vietnamese subtitle text in list
    fireEvent.click(screen.getByRole('button', { name: /No-Sub/i }));
    expect(screen.queryByText('Biên lãi thuần của chúng ta tăng nhanh.')).not.toBeInTheDocument();
    expect(screen.getByText(/Chế độ nghe không phụ đề/i)).toBeInTheDocument();
  });

  it('validates Cloze (Điền từ) answer accurately', () => {
    const onComplete = vi.fn();
    render(<LessonPlayer lesson={MOCK_LESSON} onComplete={onComplete} onBack={vi.fn()} />);

    fireEvent.click(screen.getByRole('button', { name: /Điền từ/i }));
    const inputs = screen.getAllByPlaceholderText(/Nhập từ còn thiếu/i);
    fireEvent.change(inputs[0], { target: { value: 'margin' } });
    fireEvent.change(inputs[1], { target: { value: 'funding' } });
    fireEvent.click(screen.getByRole('button', { name: /Kiểm tra Điền từ/i }));

    expect(screen.getByText(/2 \/ 2 đúng/i)).toBeInTheDocument();
    expect(onComplete).toHaveBeenCalledWith(expect.objectContaining({ clozeDone: true }));
  });

  it('scores Dictation (Chính tả) and shows word-level badges', () => {
    const onComplete = vi.fn();
    render(<LessonPlayer lesson={MOCK_LESSON} onComplete={onComplete} onBack={vi.fn()} />);

    fireEvent.click(screen.getByRole('button', { name: /Chính tả/i }));
    // Sentence selector is present in Dictation tab too
    expect(screen.getByRole('button', { name: '2' })).toBeInTheDocument();
    const textarea = screen.getByPlaceholderText(/Nghe và gõ lại nguyên văn/i);
    fireEvent.change(textarea, { target: { value: 'Our net interest expanded rapidly.' } });
    fireEvent.click(screen.getByRole('button', { name: /Chấm chính tả/i }));

    expect(screen.getByText(/Độ chính xác:/i)).toBeInTheDocument();
    expect(onComplete).toHaveBeenCalledWith(expect.objectContaining({ dictationScore: expect.any(Number) }));
  });

  it('provides manual fallback scoring in Shadowing when SpeechRecognition is unavailable', () => {
    const onComplete = vi.fn();
    render(<LessonPlayer lesson={MOCK_LESSON} onComplete={onComplete} onBack={vi.fn()} />);

    fireEvent.click(screen.getByRole('button', { name: /Shadowing/i }));
    const fallbackInput = screen.getByPlaceholderText(/Nhập hoặc dán câu bạn vừa nói/i);
    fireEvent.change(fallbackInput, { target: { value: 'Our net interest margin expanded rapidly' } });
    fireEvent.click(screen.getByRole('button', { name: /Chấm điểm từng chữ/i }));

    expect(screen.getByText(/100%/i)).toBeInTheDocument();
    expect(onComplete).toHaveBeenCalledWith(expect.objectContaining({ shadowingScore: 100 }));
  });
});
