export interface SpeechCallbacks {
  onWordIndex?: (wordIndex: number) => void;
  onEnd?: () => void;
  onError?: () => void;
}

export type TonePreset = 'expressive' | 'executive' | 'coaching';

export interface CuratedFemaleVoice {
  id: 'ava' | 'emma' | 'jenny' | 'sonia' | 'natasha';
  label: string;
  neuralName: string;
  lang: string;
}

export const CURATED_FEMALE_VOICES: CuratedFemaleVoice[] = [
  {
    id: 'ava',
    label: '1. Ava — Nữ Mỹ Ấm áp & Tự nhiên',
    neuralName: 'en-US-AvaNeural',
    lang: 'en-US',
  },
  {
    id: 'emma',
    label: '2. Emma — Nữ Mỹ Trẻ trung & Truyền cảm',
    neuralName: 'en-US-EmmaNeural',
    lang: 'en-US',
  },
  {
    id: 'jenny',
    label: '3. Jenny — Nữ Mỹ Chuyên nghiệp (Executive)',
    neuralName: 'en-US-JennyNeural',
    lang: 'en-US',
  },
  {
    id: 'sonia',
    label: '4. Sonia — Nữ Anh Quốc Thanh lịch',
    neuralName: 'en-GB-SoniaNeural',
    lang: 'en-GB',
  },
  {
    id: 'natasha',
    label: '5. Natasha — Nữ Úc Dịu dàng & Dễ nghe',
    neuralName: 'en-AU-NatashaNeural',
    lang: 'en-AU',
  },
];

const LEGACY_VOICE_MAP: Record<string, CuratedFemaleVoice['id']> = {
  'female-warm-us': 'ava',
  'female-exec-us': 'jenny',
  'female-soft-au': 'natasha',
  'female-uk-classy': 'sonia',
  'female-gentle-ie': 'emma',
};

export function normalizeVoiceId(id?: string): CuratedFemaleVoice['id'] {
  if (!id) return 'ava';
  if (CURATED_FEMALE_VOICES.some((v) => v.id === id)) {
    return id as CuratedFemaleVoice['id'];
  }
  return LEGACY_VOICE_MAP[id] ?? 'ava';
}

let defaultVoicePresetId: CuratedFemaleVoice['id'] = 'ava';

export function setDefaultVoicePreset(id: string | undefined): void {
  defaultVoicePresetId = normalizeVoiceId(id);
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
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
  onresult: ((e: SpeechRecognitionEventLike) => void) | null;
  onerror: ((e: { error?: string }) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
  abort?: () => void;
}

type SpeechRecognitionCtor = new () => SpeechRecognitionLike;

let activeTimer: ReturnType<typeof setTimeout> | null = null;
let activeAudio: HTMLAudioElement | null = null;
let activeRecognition: SpeechRecognitionLike | null = null;

function clearWordTimer() {
  if (activeTimer !== null) {
    clearTimeout(activeTimer);
    activeTimer = null;
  }
}

export function stopSpeaking(): void {
  clearWordTimer();
  if (activeAudio) {
    try {
      activeAudio.pause();
      activeAudio.currentTime = 0;
      activeAudio.ontimeupdate = null;
      activeAudio.onended = null;
      activeAudio.onerror = null;
    } catch {
      // Ignore audio cleanup errors
    }
    activeAudio = null;
  }
  if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
    try {
      window.speechSynthesis.cancel();
    } catch {
      // Ignore synthesis cancel errors
    }
  }
}

function computeToneRate(baseRate: number, tone: TonePreset): number {
  const factor = tone === 'coaching' ? 0.85 : tone === 'expressive' ? 0.96 : 1.0;
  return Math.max(0.65, Math.min(1.4, baseRate * factor));
}

function buildWordThresholds(words: string[]): number[] {
  const weights = words.map((w) => Math.max(2, w.length + 1));
  const total = weights.reduce((a, b) => a + b, 0);
  let acc = 0;
  return weights.map((w) => {
    const start = acc / total;
    acc += w;
    return start;
  });
}

function speakWithBrowserFallback(
  text: string,
  adjustedRate: number,
  voiceInfo: CuratedFemaleVoice,
  callbacks: SpeechCallbacks
): void {
  const words = text.trim().split(/\s+/).filter(Boolean);
  let boundarySeen = false;
  callbacks.onWordIndex?.(0);

  const scheduleFallbackWord = (idx: number) => {
    if (boundarySeen || idx >= words.length) return;
    callbacks.onWordIndex?.(idx);
    const wordDuration = Math.max(170, Math.round((130 + words[idx].length * 36) / adjustedRate));
    activeTimer = setTimeout(() => {
      scheduleFallbackWord(idx + 1);
    }, wordDuration);
  };
  scheduleFallbackWord(0);

  if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
    const totalMs = words.reduce(
      (sum, w) => sum + Math.max(170, Math.round((130 + w.length * 36) / adjustedRate)),
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
    utterance.lang = voiceInfo.lang;
    utterance.rate = adjustedRate;
    utterance.pitch = 1.02;

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

/**
 * Plays pre-rendered Microsoft Neural TTS MP3 when audioId is provided (true expressive human-like female voice),
 * falling back cleanly to Web Speech Synthesis only for custom user-pasted text or single-word lookups.
 */
export function speakSentence(
  text: string,
  rate = 1.0,
  callbacks: SpeechCallbacks = {},
  voicePresetId?: string,
  tone: TonePreset = 'expressive',
  audioId?: string
): void {
  stopSpeaking();
  const words = text.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) {
    callbacks.onEnd?.();
    return;
  }

  const voiceId = normalizeVoiceId(voicePresetId ?? defaultVoicePresetId);
  const voiceInfo =
    CURATED_FEMALE_VOICES.find((v) => v.id === voiceId) ?? CURATED_FEMALE_VOICES[0];
  const adjustedRate = computeToneRate(rate, tone);

  if (audioId && typeof window !== 'undefined' && typeof Audio !== 'undefined') {
    const src = `./audio/${voiceId}/${audioId}.mp3`;
    const audio = new Audio(src);
    audio.playbackRate = adjustedRate;
    if ('preservesPitch' in audio) {
      (audio as HTMLAudioElement & { preservesPitch: boolean }).preservesPitch = true;
    }

    const thresholds = buildWordThresholds(words);
    activeAudio = audio;
    callbacks.onWordIndex?.(0);

    audio.ontimeupdate = () => {
      if (!audio.duration || !Number.isFinite(audio.duration)) return;
      const ratio = audio.currentTime / audio.duration;
      let idx = 0;
      for (let i = 0; i < thresholds.length; i++) {
        if (ratio >= thresholds[i]) idx = i;
      }
      callbacks.onWordIndex?.(idx);
    };

    audio.onended = () => {
      activeAudio = null;
      callbacks.onEnd?.();
    };

    audio.onerror = () => {
      activeAudio = null;
      speakWithBrowserFallback(text, adjustedRate, voiceInfo, callbacks);
    };

    const playPromise = audio.play();
    if (playPromise && typeof playPromise.catch === 'function') {
      playPromise.catch(() => {
        activeAudio = null;
        speakWithBrowserFallback(text, adjustedRate, voiceInfo, callbacks);
      });
    }
    return;
  }

  speakWithBrowserFallback(text, adjustedRate, voiceInfo, callbacks);
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

export function isSafariBrowser(): boolean {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent;
  return /Safari/i.test(ua) && !/Chrome|Chromium|Edg|CriOS|FxiOS/i.test(ua);
}

export function formatSpeechError(code?: string): string | null {
  if (!code || code === 'aborted') return null;
  switch (code) {
    case 'not-allowed':
      return 'Safari chưa được cấp quyền Micro. Hãy vào Cài đặt Safari cho trang web này → Cho phép Micro (và kiểm tra System Settings → Privacy & Security → Microphone → bật Safari).';
    case 'service-not-allowed':
      return 'Safari yêu cầu bật "Đọc chính tả (Dictation)" trong Cài đặt macOS/iOS (System Settings → Keyboard → Dictation). Hoặc bạn có thể dùng nút "Ghi âm nghe lại" / mở bằng Chrome để chấm tự động.';
    case 'no-speech':
      return 'Chưa thu được giọng nói — hãy bấm lại nút Micro và nói gần micro hơn.';
    case 'audio-capture':
      return 'Không tìm thấy Micro hoặc Micro đang được ứng dụng khác chiếm dụng.';
    case 'network':
      return 'Kết nối tới dịch vụ nhận diện giọng nói bị gián đoạn. Hãy thử lại hoặc dùng Chrome.';
    default:
      return `Lỗi micro (${code}). Nếu đang dùng Safari, hãy thử bật Dictation trong cài đặt hệ thống hoặc dùng Chrome.`;
  }
}

export function stopListening(abort = false): void {
  if (activeRecognition) {
    const rec = activeRecognition;
    activeRecognition = null;
    if (abort) {
      rec.onresult = null;
      rec.onerror = null;
      rec.onend = null;
    }
    try {
      if (abort && typeof rec.abort === 'function') {
        rec.abort();
      } else {
        rec.stop();
      }
    } catch {
      // Ignore stop/abort errors
    }
  }
}

export function startListening(
  onTranscript: (transcript: string, isFinal: boolean) => void,
  onError: (reason: string) => void,
  onEnd: () => void
): boolean {
  const Ctor = getSpeechRecognitionCtor();
  if (!Ctor) {
    onError('Trình duyệt hiện tại không hỗ trợ nhận diện giọng nói trực tiếp.');
    return false;
  }

  // Cleanly abort any stale session without firing old handlers into the new session
  stopListening(true);

  try {
    const rec = new Ctor();
    const safari = isSafariBrowser();
    rec.lang = 'en-US';
    rec.continuous = false;
    // Safari works more reliably with interimResults=true only when guarded safely;
    // keep true so user sees words live, and guard optional chaining on results.
    rec.interimResults = !safari ? true : true;
    rec.maxAlternatives = 1;

    rec.onresult = (event) => {
      let full = '';
      let isFinal = false;
      const results = event?.results;
      if (!results) return;
      for (let i = 0; i < results.length; i++) {
        const res = results[i];
        const text = res?.[0]?.transcript;
        if (text) full += `${text} `;
        if (res?.isFinal) isFinal = true;
      }
      const cleaned = full.trim();
      if (cleaned) {
        onTranscript(cleaned, isFinal);
      }
    };

    rec.onerror = (err) => {
      const msg = formatSpeechError(err?.error);
      if (msg) onError(msg);
    };

    rec.onend = () => {
      if (activeRecognition === rec) {
        activeRecognition = null;
      }
      onEnd();
    };

    activeRecognition = rec;
    rec.start();
    return true;
  } catch (err) {
    activeRecognition = null;
    const detail = err instanceof Error ? err.message : '';
    onError(
      detail
        ? `Không thể khởi động Micro trên trình duyệt này (${detail}).`
        : 'Không thể khởi động Micro. Hãy kiểm tra quyền truy cập Micro của trình duyệt.'
    );
    return false;
  }
}

// Safari-safe local voice recorder (audio/mp4 on Safari, audio/webm on Chrome) for self-playback
let activeMediaRecorder: MediaRecorder | null = null;
let activeMediaStream: MediaStream | null = null;

export function isVoiceRecorderSupported(): boolean {
  return (
    typeof navigator !== 'undefined' &&
    Boolean(navigator.mediaDevices?.getUserMedia) &&
    typeof MediaRecorder !== 'undefined'
  );
}

export function stopVoiceRecording(): void {
  if (activeMediaRecorder && activeMediaRecorder.state !== 'inactive') {
    try {
      activeMediaRecorder.stop();
    } catch {
      // Ignore recorder stop errors
    }
  }
  activeMediaRecorder = null;
  if (activeMediaStream) {
    activeMediaStream.getTracks().forEach((t) => t.stop());
    activeMediaStream = null;
  }
}

export async function startVoiceRecording(
  onRecordedUrl: (blobUrl: string) => void,
  onError: (msg: string) => void
): Promise<boolean> {
  if (!isVoiceRecorderSupported()) {
    onError('Trình duyệt không hỗ trợ ghi âm MediaRecorder.');
    return false;
  }
  stopVoiceRecording();
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    activeMediaStream = stream;

    const candidateTypes = ['audio/mp4', 'audio/webm;codecs=opus', 'audio/webm'];
    const mimeType = candidateTypes.find(
      (t) => typeof MediaRecorder.isTypeSupported === 'function' && MediaRecorder.isTypeSupported(t)
    );

    const recorder = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream);
    const chunks: BlobPart[] = [];

    recorder.ondataavailable = (e) => {
      if (e.data && e.data.size > 0) chunks.push(e.data);
    };

    recorder.onstop = () => {
      const blob = new Blob(chunks, { type: mimeType || 'audio/mp4' });
      const url = URL.createObjectURL(blob);
      onRecordedUrl(url);
      if (activeMediaStream) {
        activeMediaStream.getTracks().forEach((t) => t.stop());
        activeMediaStream = null;
      }
    };

    activeMediaRecorder = recorder;
    recorder.start();
    return true;
  } catch {
    onError('Không thể truy cập Micro để ghi âm. Vui lòng cấp quyền Micro trong cài đặt Safari.');
    return false;
  }
}
