export interface KaraokeWordSlot {
  index: number;
  word: string;
  startMs: number;
  endMs: number;
}

/**
 * Computes per-word karaoke pacing slots proportional to word length
 * (used strictly as a visual reading guide — never for fake scoring).
 */
export function buildKaraokeSchedule(sentence: string, rate = 1.0): KaraokeWordSlot[] {
  const words = sentence.trim().split(/\s+/).filter(Boolean);
  const safeRate = Math.max(0.6, Math.min(1.5, rate));
  let cursor = 0;

  return words.map((word, index) => {
    const cleanLen = word.replace(/[^a-zA-Z0-9]/g, '').length;
    const duration = Math.max(280, Math.round((210 + cleanLen * 55) / safeRate));
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
 * Downsamples arbitrary AudioBuffer/Float32 PCM to 16kHz mono for Whisper AI
 * and measures true peak RMS energy to detect genuine speech vs silence.
 */
export function resampleTo16k(input: Float32Array, inputSampleRate: number): Float32Array {
  if (inputSampleRate === 16000) return input;
  const ratio = inputSampleRate / 16000;
  const outLength = Math.max(1, Math.round(input.length / ratio));
  const output = new Float32Array(outLength);
  for (let i = 0; i < outLength; i++) {
    const pos = i * ratio;
    const idx = Math.floor(pos);
    const frac = pos - idx;
    const s0 = input[idx] ?? 0;
    const s1 = input[Math.min(idx + 1, input.length - 1)] ?? s0;
    output[i] = s0 + (s1 - s0) * frac;
  }
  return output;
}

/**
 * Checks whether a 16kHz PCM recording actually contains human voice above silence/noise floor.
 */
export function detectVoiceActivity(pcm: Float32Array): { hasVoice: boolean; peakRms: number } {
  if (pcm.length < 1600) return { hasVoice: false, peakRms: 0 };
  const frameSize = 800; // 50ms frames at 16kHz
  let peakRms = 0;
  let activeFrames = 0;

  for (let offset = 0; offset + frameSize <= pcm.length; offset += frameSize) {
    let sumSq = 0;
    for (let i = 0; i < frameSize; i++) {
      const s = pcm[offset + i];
      sumSq += s * s;
    }
    const rms = Math.sqrt(sumSq / frameSize);
    if (rms > peakRms) peakRms = rms;
    if (rms >= 0.022) activeFrames++;
  }

  // Require real sustained sound (at least 3 frames = 150ms above threshold)
  return {
    hasVoice: peakRms >= 0.025 && activeFrames >= 3,
    peakRms,
  };
}

export interface KaraokeRecordingResult {
  blobUrl: string | null;
  pcm16k: Float32Array;
  hasVoice: boolean;
  peakRms: number;
}

export interface KaraokeMicHandle {
  getLevel: () => number;
  stop: () => Promise<KaraokeRecordingResult>;
}

/**
 * Opens a Safari- & Chrome-compatible microphone session capturing BOTH:
 * 1) Real 16kHz PCM audio for local Whisper AI speech-to-text scoring
 * 2) Playable MP4/WebM audio blob so the learner can replay their own voice
 */
export async function startKaraokeMicSession(): Promise<KaraokeMicHandle> {
  if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
    throw new Error('Trình duyệt không hỗ trợ truy cập Micro (getUserMedia).');
  }

  const stream = await navigator.mediaDevices.getUserMedia({
    audio: {
      echoCancellation: true,
      noiseSuppression: true,
      autoGainControl: false, // Prevent boosting silent room fan noise into fake speech
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
    return Math.min(1, Math.sqrt(sumSq / dataArray.length) * 2.5);
  };

  const stop = (): Promise<KaraokeRecordingResult> => {
    return new Promise((resolve) => {
      const finalizeBlob = async (blob: Blob | null) => {
        stream.getTracks().forEach((t) => t.stop());
        let pcm16k: Float32Array = new Float32Array(0);
        let blobUrl: string | null = null;

        if (blob && blob.size > 0) {
          blobUrl = URL.createObjectURL(blob);
          try {
            const arrayBuf = await blob.arrayBuffer();
            const decodeCtx = audioCtx ?? (AudioCtx ? new AudioCtx() : null);
            if (decodeCtx) {
              const decoded = await decodeCtx.decodeAudioData(arrayBuf.slice(0));
              const mono = decoded.getChannelData(0);
              pcm16k = resampleTo16k(mono, decoded.sampleRate);
            }
          } catch {
            // Keep empty PCM if browser fails to decode blob
          }
        }

        if (audioCtx) {
          void audioCtx.close().catch(() => {});
          audioCtx = null;
        }

        const { hasVoice, peakRms } = detectVoiceActivity(pcm16k);
        resolve({ blobUrl, pcm16k, hasVoice, peakRms });
      };

      if (recorder && recorder.state !== 'inactive') {
        recorder.onstop = () => {
          const blob = chunks.length > 0 ? new Blob(chunks, { type: chosenMime }) : null;
          void finalizeBlob(blob);
        };
        try {
          recorder.stop();
        } catch {
          void finalizeBlob(null);
        }
      } else {
        void finalizeBlob(null);
      }
    });
  };

  return { getLevel, stop };
}
