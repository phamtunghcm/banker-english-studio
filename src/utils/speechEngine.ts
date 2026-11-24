export interface SpeechCallbacks {
  onWordIndex?: (wordIndex: number) => void;
  onEnd?: () => void;
  onError?: () => void;
}

export type TonePreset = 'expressive' | 'executive' | 'coaching';

export interface VoiceOption {
  voiceURI: string;
  name: string;
  displayLabel: string;
  lang: string;
  recommended: boolean;
}

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

// Filter out novelty/robotic macOS system voices
const NOVELTY_VOICE_PATTERN =
  /^(Albert|Bad News|Bahh|Bells|Boing|Bubbles|Cellos|Deranged|Eddy|Flo|Fred|Good News|Grandma|Grandpa|Hysterical|Jester|Junior|Kathy|Organ|Princess|Ralph|Reed|Rocko|Sandy|Shelley|Superstar|Trinoids|Whisper|Wobble|Zarvox)\b/i;

const EXPRESSIVE_VOICES_META: { match: string; label: string }[] = [
  { match: 'Ava (Premium)', label: '★ Ava Premium (Nữ Mỹ - Rất truyền cảm)' },
  { match: 'Ava', label: '★ Ava (Nữ Mỹ - Truyền cảm)' },
  { match: 'Samantha (Enhanced)', label: '★ Samantha Enhanced (Nữ Mỹ - Tự nhiên)' },
  { match: 'Allison', label: '★ Allison (Nữ Mỹ - Ấm áp)' },
  { match: 'Microsoft Aria', label: '★ Aria Natural (Nữ Mỹ - AI Tự nhiên)' },
  { match: 'Microsoft Jenny', label: '★ Jenny Natural (Nữ Mỹ - Truyền cảm)' },
  { match: 'Google US English', label: '★ Google US English (Nữ Mỹ - Rõ nét)' },
  { match: 'Google UK English Female', label: '★ Google UK Female (Nữ Anh - Thanh lịch)' },
  { match: 'Serena', label: '★ Serena (Nữ Anh - Sang trọng)' },
  { match: 'Kate', label: '★ Kate (Nữ Anh - Chuẩn mực)' },
  { match: 'Karen', label: '★ Karen (Nữ Úc - Dễ nghe)' },
  { match: 'Moira', label: '★ Moira (Nữ Ireland - Nhẹ nhàng)' },
  { match: 'Tessa', label: '★ Tessa (Nữ - Rõ chữ)' },
  { match: 'Samantha', label: '★ Samantha (Nữ Mỹ - Phổ thông)' },
  { match: 'Daniel', label: 'Daniel (Nam Anh - Trầm ấm)' },
  { match: 'Google UK English Male', label: 'Google UK Male (Nam Anh - Lịch lãm)' },
];

function scoreVoiceExpressiveness(voice: SpeechSynthesisVoice): number {
  const idx = EXPRESSIVE_VOICES_META.findIndex((p) => voice.name.includes(p.match));
  if (idx !== -1) return 100 - idx;
  if (/natural|neural|premium|enhanced|siri/i.test(voice.name)) return 75;
  if (/female|woman/i.test(voice.name)) return 60;
  if (voice.lang === 'en-US') return 40;
  return 20;
}

function formatVoiceLabel(voice: SpeechSynthesisVoice): { displayLabel: string; recommended: boolean } {
  const matched = EXPRESSIVE_VOICES_META.find((p) => voice.name.includes(p.match));
  if (matched) {
    return { displayLabel: matched.label, recommended: true };
  }
  const isNatural = /natural|neural|premium|enhanced|siri/i.test(voice.name);
  return {
    displayLabel: `${isNatural ? '★ ' : ''}${voice.name} (${voice.lang})`,
    recommended: isNatural,
  };
}

export function getAvailableEnglishVoices(): VoiceOption[] {
  const english = loadRawVoices().filter(
    (v) => v.lang.startsWith('en') && !NOVELTY_VOICE_PATTERN.test(v.name)
  );
  const sorted = [...english].sort(
    (a, b) => scoreVoiceExpressiveness(b) - scoreVoiceExpressiveness(a)
  );
  return sorted.map((v) => {
    const { displayLabel, recommended } = formatVoiceLabel(v);
    return {
      voiceURI: v.voiceURI,
      name: v.name,
      displayLabel,
      lang: v.lang,
      recommended,
    };
  });
}

function selectPreferredEnglishVoice(
  voices: SpeechSynthesisVoice[],
  preferredURI?: string
): SpeechSynthesisVoice | null {
  const english = voices.filter(
    (v) => v.lang.startsWith('en') && !NOVELTY_VOICE_PATTERN.test(v.name)
  );
  if (english.length === 0) return null;
  if (preferredURI) {
    const exact = english.find((v) => v.voiceURI === preferredURI);
    if (exact) return exact;
  }
  return [...english].sort(
    (a, b) => scoreVoiceExpressiveness(b) - scoreVoiceExpressiveness(a)
  )[0];
}

function applyTonePreset(baseRate: number, tone: TonePreset): { rate: number; pitch: number } {
  if (tone === 'expressive') {
    return { rate: Math.max(0.65, baseRate * 0.96), pitch: 1.05 };
  }
  if (tone === 'coaching') {
    return { rate: Math.max(0.65, baseRate * 0.85), pitch: 1.02 };
  }
  return { rate: baseRate, pitch: 1.0 };
}

export function speakSentence(
  text: string,
  rate = 1.0,
  callbacks: SpeechCallbacks = {},
  voiceURI?: string,
  tone: TonePreset = 'expressive'
): void {
  stopSpeaking();
  const words = text.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) {
    callbacks.onEnd?.();
    return;
  }

  const adjusted = applyTonePreset(rate, tone);
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
    utterance.lang = 'en-US';
    utterance.rate = adjusted.rate;
    utterance.pitch = adjusted.pitch;
    const voice = selectPreferredEnglishVoice(loadRawVoices(), voiceURI);
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
