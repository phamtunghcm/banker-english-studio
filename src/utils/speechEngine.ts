export interface SpeechCallbacks {
  onWordIndex?: (wordIndex: number) => void;
  onEnd?: () => void;
  onError?: () => void;
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

let activeTimer: ReturnType<typeof setInterval> | null = null;
let activeRecognition: SpeechRecognitionLike | null = null;

function clearWordTimer() {
  if (activeTimer !== null) {
    clearInterval(activeTimer);
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

function selectPreferredEnglishVoice(voices: SpeechSynthesisVoice[]): SpeechSynthesisVoice | null {
  const english = voices.filter((v) => v.lang.startsWith('en'));
  if (english.length === 0) return null;
  const preferredNames = ['Samantha', 'Daniel', 'Karen', 'Google US English', 'Google UK English'];
  for (const name of preferredNames) {
    const found = english.find((v) => v.name.includes(name));
    if (found) return found;
  }
  return english.find((v) => v.lang === 'en-US') ?? english[0];
}

export function speakSentence(text: string, rate = 1.0, callbacks: SpeechCallbacks = {}): void {
  stopSpeaking();
  const words = text.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) {
    callbacks.onEnd?.();
    return;
  }

  // Fallback timer ensures word highlight advances smoothly even if browser doesn't fire onboundary
  let fallbackIndex = 0;
  let boundarySeen = false;
  const msPerWord = Math.max(180, Math.round(330 / rate));

  callbacks.onWordIndex?.(0);
  activeTimer = setInterval(() => {
    if (boundarySeen) return;
    fallbackIndex++;
    if (fallbackIndex < words.length) {
      callbacks.onWordIndex?.(fallbackIndex);
    } else {
      clearWordTimer();
    }
  }, msPerWord);

  if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
    setTimeout(() => {
      clearWordTimer();
      callbacks.onEnd?.();
    }, words.length * msPerWord);
    return;
  }

  try {
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'en-US';
    utterance.rate = rate;
    const voices = window.speechSynthesis.getVoices?.() ?? [];
    const voice = selectPreferredEnglishVoice(voices);
    if (voice) utterance.voice = voice;

    utterance.onboundary = (event: SpeechSynthesisEvent) => {
      if (typeof event.charIndex === 'number') {
        boundarySeen = true;
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
