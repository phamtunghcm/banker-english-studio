/**
 * Lightweight Web Audio API sound effects (Duolingo/ELSA-style tactile feedback).
 * Zero external MP3s, 100% instant, safely no-ops in SSR/test/muted environments.
 */

let sharedCtx: AudioContext | null = null;
let muted = false;

export function setSoundFxMuted(value: boolean): void {
  muted = value;
}

export function isSoundFxMuted(): boolean {
  return muted;
}

function getAudioContext(): AudioContext | null {
  if (muted || typeof window === 'undefined') return null;
  const Ctor =
    window.AudioContext ||
    (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctor) return null;
  if (!sharedCtx) {
    try {
      sharedCtx = new Ctor();
    } catch {
      return null;
    }
  }
  if (sharedCtx.state === 'suspended') {
    sharedCtx.resume().catch(() => {});
  }
  return sharedCtx;
}

function playTone(
  freq: number,
  durationSec: number,
  startOffsetSec = 0,
  type: OscillatorType = 'sine',
  volume = 0.12
): void {
  const ctx = getAudioContext();
  if (!ctx) return;
  try {
    const now = ctx.currentTime + startOffsetSec;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, now);
    gain.gain.setValueAtTime(0.001, now);
    gain.gain.exponentialRampToValueAtTime(volume, now + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.001, now + durationSec);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + durationSec + 0.02);
  } catch {
    // Ignore audio context errors silently
  }
}

export function playTapSound(): void {
  playTone(620, 0.05, 0, 'triangle', 0.06);
}

export function playCorrectSound(): void {
  playTone(587.33, 0.12, 0, 'sine', 0.12); // D5
  playTone(880.0, 0.22, 0.09, 'sine', 0.13); // A5
}

export function playWrongSound(): void {
  playTone(260, 0.14, 0, 'triangle', 0.1);
  playTone(210, 0.2, 0.12, 'triangle', 0.1);
}

export function playFanfareSound(): void {
  playTone(523.25, 0.14, 0, 'sine', 0.12); // C5
  playTone(659.25, 0.14, 0.1, 'sine', 0.12); // E5
  playTone(783.99, 0.16, 0.2, 'sine', 0.13); // G5
  playTone(1046.5, 0.35, 0.32, 'sine', 0.14); // C6
}
