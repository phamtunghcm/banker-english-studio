import { describe, it, expect } from 'vitest';
import {
  buildKaraokeSchedule,
  detectVoiceActivity,
  resampleTo16k,
} from '../karaokeRecorder';

describe('karaokeRecorder', () => {
  it('builds contiguous karaoke pacing slots proportional to word length', () => {
    const slots = buildKaraokeSchedule('Our liquidity improved.', 1.0);
    expect(slots).toHaveLength(3);
    expect(slots[0].startMs).toBe(0);
    expect(slots[1].startMs).toBe(slots[0].endMs);
    expect(slots[2].startMs).toBe(slots[1].endMs);
    expect(slots[1].endMs - slots[1].startMs).toBeGreaterThan(
      slots[0].endMs - slots[0].startMs
    );
  });

  it('rejects silence and low room noise as hasVoice=false (never fakes 100%)', () => {
    const silence = new Float32Array(16000); // 1s of pure silence
    expect(detectVoiceActivity(silence).hasVoice).toBe(false);

    const lowFanNoise = new Float32Array(16000).map((_, i) => Math.sin(i) * 0.008);
    expect(detectVoiceActivity(lowFanNoise).hasVoice).toBe(false);

    const realSpeech = new Float32Array(16000).map((_, i) => Math.sin(i * 0.1) * 0.18);
    expect(detectVoiceActivity(realSpeech).hasVoice).toBe(true);
  });

  it('resamples 48kHz audio down to 16kHz accurately', () => {
    const pcm48k = new Float32Array(48000).fill(0.5);
    const pcm16k = resampleTo16k(pcm48k, 48000);
    expect(pcm16k.length).toBe(16000);
    expect(pcm16k[0]).toBeCloseTo(0.5, 3);
  });
});
