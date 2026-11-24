export interface SpeechCallbacks {
  onWordIndex?: (wordIndex: number) => void;
  onEnd?: () => void;
  onError?: () => void;
}

export type TonePreset = 'expressive' | 'executive' | 'coaching';

export interface CuratedFemaleVoice {
  id: string;
  label: string;
  preferredNames: string[];
  pitchBoost: number;
  rateFactor: number;
}

export const CURATED_FEMALE_VOICES: CuratedFemaleVoice[] = [
  {
    id: 'female-warm-us',
    label: '1. Ava / Allison — Nữ Mỹ Ấm áp & Tự nhiên',
    preferredNames: ['Ava (Premium)', 'Ava', 'Allison', 'Microsoft Aria', 'Google US English', 'Samantha'],
    pitchBoost: 1.04,
    rateFactor: 0.95,
  },
  {
    id: 'female-exec-us',
    label: '2. Samantha — Nữ Mỹ Thanh lịch (Executive)',
    preferredNames: ['Samantha (Enhanced)', 'Samantha', 'Microsoft Jenny', 'Victoria', 'Google US English'],
    pitchBoost: 1.01,
    rateFactor: 0.98,
  },
  {
    id: 'female-soft-au',
    label: '3. Karen — Nữ Úc Dịu dàng & Dễ nghe',
    preferredNames: ['Karen', 'Catherine', 'Samantha'],
    pitchBoost: 1.03,
    rateFactor: 0.95,
  },
  {
    id: 'female-uk-classy',
    label: '4. Serena / Kate — Nữ Anh Quốc Sang trọng',
    preferredNames: ['Serena', 'Kate', 'Google UK English Female', 'Martha', 'Moira'],
    pitchBoost: 1.02,
    rateFactor: 0.97,
  },
  {
    id: 'female-gentle-ie',
    label: '5. Moira / Tessa — Nữ Nhẹ nhàng & Rõ âm',
    preferredNames: ['Moira', 'Tessa', 'Karen'],
    pitchBoost: 1.05,
    rateFactor: 0.93,
  },
];

interface SpeechRecognitionAlternativeLike {
  transcript: string;
}

interface SpeechRecognitionResultLike {
  0: SpeechRecognitionAlternativeLike;
  isFinal: boolean;
}

interface SpeechRecognitionEventLike {
  results: ArrayLike<SpeechRecognitionResultLike>;
}

interface SpeechRecognitionLike {
  lang: string;
  interimResults: boolean;
  maxAlternatives: number;
  onresult: ((e: SpeechRecognitionEventLike) => void) | null;
  onerror: ((e: { error?: string }) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
}

type SpeechRecognitionCtor = new () => SpeechRecognitionLike;

let activeTimer: ReturnType<typeof setTimeout> | null = null;
let activeRecognition: SpeechRecognitionLike | null = null;
let cachedVoices: SpeechSynthesisVoice[] = [];

function clearWordTimer() {
  if (activeTimer !== null) {
    clearTimeout(activeTimer);
    activeTimer = null;
  }
}

export function stopSpeaking(): void {
  clearWordTimer();
  if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
    try {
      window.speechSynthesis.cancel();
    } catch {
      // Ignore synthesis cancel errors
    }
  }
}

function loadRawVoices(): SpeechSynthesisVoice[] {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) return [];
  const list = window.speechSynthesis.getVoices?.() ?? [];
  if (list.length > 0) {
    cachedVoices = list;
  }
  return cachedVoices;
}

if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
  loadRawVoices();
  window.speechSynthesis.onvoiceschanged = () => {
    loadRawVoices();
  };
}

// Exclude male & robotic/novelty macOS voices so only natural female voices are used
const EXCLUDED_VOICE_PATTERN =
  /^(Albert|Arthur|Aaron|Bad News|Bahh|Bells|Boing|Bubbles|Cellos|Daniel|Deranged|Eddy|Flo|Fred|Good News|Gordon|Grandma|Grandpa|Hysterical|Jester|Junior|Kathy|Martin|Oliver|Organ|Princess|Ralph|Reed|Rishi|Rocko|Sandy|Shelley|Superstar|Trinoids|Whisper|Wobble|Zarvox)\b|Male/i;

function getEnglishFemaleVoices(): SpeechSynthesisVoice[] {
  const allEnglish = loadRawVoices().filter((v) => v.lang.startsWith('en'));
  const femaleOnly = allEnglish.filter((v) => !EXCLUDED_VOICE_PATTERN.test(v.name));
  return femaleOnly.length > 0 ? femaleOnly : allEnglish;
}

function resolveCuratedVoice(presetId?: string): {
  voice: SpeechSynthesisVoice | null;
  preset: CuratedFemaleVoice;
} {
  const preset =
    CURATED_FEMALE_VOICES.find((p) => p.id === presetId) ?? CURATED_FEMALE_VOICES[0];
  const pool = getEnglishFemaleVoices();
  if (pool.length === 0) return { voice: null, preset };

  for (const preferred of preset.preferredNames) {
    const match = pool.find((v) => v.name.includes(preferred));
    if (match) return { voice: match, preset };
  }
  return { voice: pool[0], preset };
}

function applyToneAndPreset(
  baseRate: number,
  tone: TonePreset,
  preset: CuratedFemaleVoice
): { rate: number; pitch: number } {
  const toneRate = tone === 'expressive' ? 0.97 : tone === 'coaching' ? 0.85 : 1.0;
  const tonePitch = tone === 'expressive' ? 1.02 : tone === 'coaching' ? 1.01 : 0.99;
  return {
    rate: Math.max(0.65, Math.min(1.4, baseRate * preset.rateFactor * toneRate)),
    pitch: Math.max(0.9, Math.min(1.15, preset.pitchBoost * tonePitch)),
  };
}

export function speakSentence(
  text: string,
  rate = 1.0,
  callbacks: SpeechCallbacks = {},
  voicePresetId?: string,
  tone: TonePreset = 'expressive'
): void {
  stopSpeaking();
  const words = text.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) {
    callbacks.onEnd?.();
    return;
  }

  const { voice, preset } = resolveCuratedVoice(voicePresetId);
  const adjusted = applyToneAndPreset(rate, tone, preset);
  let boundarySeen = false;
  callbacks.onWordIndex?.(0);

  const scheduleFallbackWord = (idx: number) => {
    if (boundarySeen || idx >= words.length) return;
    callbacks.onWordIndex?.(idx);
    const wordDuration = Math.max(170, Math.round((130 + words[idx].length * 36) / adjusted.rate));
    activeTimer = setTimeout(() => {
      scheduleFallbackWord(idx + 1);
    }, wordDuration);
  };
  scheduleFallbackWord(0);

  if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
    const totalMs = words.reduce(
      (sum, w) => sum + Math.max(170, Math.round((130 + w.length * 36) / adjusted.rate)),
      0
    );
    activeTimer = setTimeout(() => {
      clearWordTimer();
      callbacks.onEnd?.();
    }, totalMs);
    return;
  }

  try {
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = voice?.lang ?? 'en-US';
    utterance.rate = adjusted.rate;
    utterance.pitch = adjusted.pitch;
    if (voice) utterance.voice = voice;

    utterance.onboundary = (event: SpeechSynthesisEvent) => {
      if (typeof event.charIndex === 'number') {
        boundarySeen = true;
        clearWordTimer();
        const prefix = text.slice(0, event.charIndex).trim();
        const wordIdx = prefix ? prefix.split(/\s+/).length : 0;
        callbacks.onWordIndex?.(Math.min(wordIdx, words.length - 1));
      }
    };

    utterance.onend = () => {
      clearWordTimer();
      callbacks.onEnd?.();
    };

    utterance.onerror = () => {
      clearWordTimer();
      callbacks.onError?.();
    };

    window.speechSynthesis.speak(utterance);
  } catch {
    clearWordTimer();
    callbacks.onError?.();
  }
}

function getSpeechRecognitionCtor(): SpeechRecognitionCtor | null {
  if (typeof window === 'undefined') return null;
  const win = window as unknown as {
    SpeechRecognition?: SpeechRecognitionCtor;
    webkitSpeechRecognition?: SpeechRecognitionCtor;
  };
  return win.SpeechRecognition ?? win.webkitSpeechRecognition ?? null;
}

export function isSpeechRecognitionSupported(): boolean {
  return getSpeechRecognitionCtor() !== null;
}

export function stopListening(): void {
  if (activeRecognition) {
    try {
      activeRecognition.stop();
    } catch {
      // Ignore stop errors
    }
    activeRecognition = null;
  }
}

export function startListening(
  onTranscript: (transcript: string, isFinal: boolean) => void,
  onError: (reason: string) => void,
  onEnd: () => void
): boolean {
  const Ctor = getSpeechRecognitionCtor();
  if (!Ctor) {
    onError('Trình duyệt hiện tại không hỗ trợ nhận diện micro trực tiếp.');
    return false;
  }

  stopListening();
  try {
    const rec = new Ctor();
    rec.lang = 'en-US';
    rec.interimResults = true;
    rec.maxAlternatives = 1;

    rec.onresult = (event) => {
      let full = '';
      let isFinal = false;
      for (let i = 0; i < event.results.length; i++) {
        full += event.results[i][0].transcript + ' ';
        if (event.results[i].isFinal) isFinal = true;
      }
      onTranscript(full.trim(), isFinal);
    };

    rec.onerror = (err) => {
      onError(err.error ? `Lỗi micro: ${err.error}` : 'Không thể truy cập micro.');
    };

    rec.onend = () => {
      activeRecognition = null;
      onEnd();
    };

    activeRecognition = rec;
    rec.start();
    return true;
  } catch {
    onError('Không thể khởi động micro.');
    return false;
  }
}
