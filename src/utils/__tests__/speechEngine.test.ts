import { describe, it, expect, vi, afterEach } from 'vitest';
import { formatSpeechError, startListening, stopListening } from '../speechEngine';

describe('speechEngine Safari compatibility', () => {
  afterEach(() => {
    stopListening(true);
    delete (window as unknown as Record<string, unknown>).webkitSpeechRecognition;
  });

  it('maps Safari speech error codes into clear Vietnamese guidance and ignores aborted', () => {
    expect(formatSpeechError('aborted')).toBeNull();
    expect(formatSpeechError('service-not-allowed')).toMatch(/Dictation|Đọc chính tả/i);
    expect(formatSpeechError('not-allowed')).toMatch(/Safari|Micro/i);
    expect(formatSpeechError('no-speech')).toMatch(/giọng nói/i);
  });

  it('safely handles Safari webkitSpeechRecognition with continuous=false and sparse results', () => {
    const holder: { current: MockWebkitRec | null } = { current: null };
    class MockWebkitRec {
      lang = '';
      continuous = true;
      interimResults = false;
      maxAlternatives = 0;
      onresult: ((e: unknown) => void) | null = null;
      onerror: ((e: unknown) => void) | null = null;
      onend: (() => void) | null = null;
      start = vi.fn();
      stop = vi.fn();
      abort = vi.fn();
      constructor() {
        holder.current = this;
      }
    }

    (window as unknown as Record<string, unknown>).webkitSpeechRecognition = MockWebkitRec;

    const onTranscript = vi.fn();
    const onError = vi.fn();
    const onEnd = vi.fn();

    const started = startListening(onTranscript, onError, onEnd);
    expect(started).toBe(true);
    expect(holder.current?.continuous).toBe(false);

    // Sparse/partial result should not crash
    holder.current?.onresult?.({
      results: [{ 0: { transcript: 'net interest margin' }, isFinal: true }],
    });
    expect(onTranscript).toHaveBeenCalledWith('net interest margin', true);

    // Aborted error should not trigger user-facing error banner
    holder.current?.onerror?.({ error: 'aborted' });
    expect(onError).not.toHaveBeenCalled();

    // service-not-allowed triggers helpful Vietnamese Safari guidance
    holder.current?.onerror?.({ error: 'service-not-allowed' });
    expect(onError).toHaveBeenCalledWith(expect.stringMatching(/Dictation/i));
  });
});
