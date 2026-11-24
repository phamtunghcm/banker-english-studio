import { describe, it, expect } from 'vitest';
import { buildKaraokeSchedule, evaluateKaraokeWord } from '../karaokeRecorder';

describe('karaokeRecorder', () => {
  it('builds contiguous karaoke timing slots proportional to word length', () => {
    const slots = buildKaraokeSchedule('Our liquidity improved.', 1.0);
    expect(slots).toHaveLength(3);
    expect(slots[0].startMs).toBe(0);
    expect(slots[1].startMs).toBe(slots[0].endMs);
    expect(slots[2].startMs).toBe(slots[1].endMs);
    // Longer word "liquidity" gets a wider window than "Our"
    expect(slots[1].endMs - slots[1].startMs).toBeGreaterThan(
      slots[0].endMs - slots[0].startMs
    );
  });

  it('evaluates karaoke words using real audio energy and optional speech status', () => {
    expect(evaluateKaraokeWord(0.08)).toBe('correct');
    expect(evaluateKaraokeWord(0.02)).toBe('near');
    expect(evaluateKaraokeWord(0.002)).toBe('missing');
    expect(evaluateKaraokeWord(0.001, 'correct')).toBe('correct');
  });
});
