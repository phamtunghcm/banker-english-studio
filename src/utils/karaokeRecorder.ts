import type { WordStatus } from '../types/curriculum';

export interface KaraokeWordSlot {
  index: number;
  word: string;
  startMs: number;
  endMs: number;
}

/**
 * Computes per-word karaoke timing slots proportional to word length so
 * short function words and long banking terms advance at natural speech pace.
 */
export function buildKaraokeSchedule(sentence: string, rate = 1.0): KaraokeWordSlot[] {
  const words = sentence.trim().split(/\s+/).filter(Boolean);
  const safeRate = Math.max(0.6, Math.min(1.5, rate));
  let cursor = 0;

  return words.map((word, index) => {
    const cleanLen = word.replace(/[^a-zA-Z0-9]/g, '').length;
    const duration = Math.max(260, Math.round((190 + cleanLen * 52) / safeRate));
    const slot: KaraokeWordSlot = {
      index,
      word,
      startMs: cursor,
      endMs: cursor + duration,
    };
    cursor += duration;
    return slot;
  });
}

/**
 * Evaluates a single word during karaoke playback using real microphone RMS energy
 * combined with speech recognition status when available.
 */
export function evaluateKaraokeWord(
  peakEnergy: number,
  speechStatus?: WordStatus
): WordStatus {
  if (speechStatus === 'correct') return 'correct';
  if (speechStatus === 'near') return peakEnergy >= 0.015 ? 'near' : 'missing';
  // Offline / Safari Web Audio energy-based karaoke rhythm & clarity check
  if (peakEnergy >= 0.04) return 'correct';
  if (peakEnergy >= 0.015) return 'near';
  return 'missing';
}

export interface KaraokeMicHandle {
  getLevel: () => number;
  stop: () => Promise<string | null>;
}

/**
 * Opens a Safari- & Chrome-compatible Web Audio microphone session (AnalyserNode + MediaRecorder)
 * that never depends on Google/Apple Speech cloud servers.
 */
export async function startKaraokeMicSession(): Promise<KaraokeMicHandle> {
  if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
    throw new Error('Trình duyệt không hỗ trợ truy cập Micro (getUserMedia).');
  }

  const stream = await navigator.mediaDevices.getUserMedia({
    audio: {
      echoCancellation: true,
      noiseSuppression: true,
      autoGainControl: true,
    },
  });

  const AudioCtx =
    window.AudioContext ??
    (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;

  let audioCtx: AudioContext | null = null;
  let analyser: AnalyserNode | null = null;
  let dataArray: Uint8Array<ArrayBuffer> | null = null;

  if (AudioCtx) {
    audioCtx = new AudioCtx();
    if (audioCtx.state === 'suspended') {
      await audioCtx.resume();
    }
    const source = audioCtx.createMediaStreamSource(stream);
    analyser = audioCtx.createAnalyser();
    analyser.fftSize = 512;
    source.connect(analyser);
    dataArray = new Uint8Array(new ArrayBuffer(analyser.fftSize));
  }

  let recorder: MediaRecorder | null = null;
  const chunks: BlobPart[] = [];
  let chosenMime = 'audio/mp4';

  if (typeof MediaRecorder !== 'undefined') {
    const candidates = ['audio/mp4', 'audio/webm;codecs=opus', 'audio/webm'];
    const supported = candidates.find(
      (m) => typeof MediaRecorder.isTypeSupported === 'function' && MediaRecorder.isTypeSupported(m)
    );
    chosenMime = supported ?? 'audio/mp4';
    recorder = supported ? new MediaRecorder(stream, { mimeType: supported }) : new MediaRecorder(stream);
    recorder.ondataavailable = (e) => {
      if (e.data && e.data.size > 0) chunks.push(e.data);
    };
    recorder.start(100);
  }

  const getLevel = (): number => {
    if (!analyser || !dataArray) return 0;
    analyser.getByteTimeDomainData(dataArray);
    let sumSq = 0;
    for (let i = 0; i < dataArray.length; i++) {
      const normalized = (dataArray[i] - 128) / 128;
      sumSq += normalized * normalized;
    }
    return Math.min(1, Math.sqrt(sumSq / dataArray.length) * 2.2);
  };

  const stop = (): Promise<string | null> => {
    return new Promise((resolve) => {
      const cleanup = () => {
        stream.getTracks().forEach((t) => t.stop());
        if (audioCtx) {
          void audioCtx.close().catch(() => {});
          audioCtx = null;
        }
      };

      if (recorder && recorder.state !== 'inactive') {
        recorder.onstop = () => {
          cleanup();
          if (chunks.length > 0) {
            const blob = new Blob(chunks, { type: chosenMime });
            resolve(URL.createObjectURL(blob));
          } else {
            resolve(null);
          }
        };
        try {
          recorder.stop();
        } catch {
          cleanup();
          resolve(null);
        }
      } else {
        cleanup();
        resolve(null);
      }
    });
  };

  return { getLevel, stop };
}
