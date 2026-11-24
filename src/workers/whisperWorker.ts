import { pipeline, env } from '@huggingface/transformers';

// Run 100% in browser via HuggingFace CDN cache (no local /models folder needed)
env.allowLocalModels = false;

type AsrPipeline = (
  audio: Float32Array,
  options?: Record<string, unknown>
) => Promise<{ text?: string } | { text?: string }[]>;

let transcriberPromise: Promise<AsrPipeline> | null = null;

function getTranscriber(onProgress: (pct: number, status: string) => void): Promise<AsrPipeline> {
  if (!transcriberPromise) {
    transcriberPromise = (
      pipeline('automatic-speech-recognition', 'Xenova/whisper-tiny.en', {
        dtype: 'q8',
        device: 'wasm',
        progress_callback: (info: { status?: string; progress?: number }) => {
          if (typeof info.progress === 'number') {
            onProgress(Math.round(info.progress), info.status ?? 'loading');
          }
        },
      }) as unknown as Promise<AsrPipeline>
    ).catch((err) => {
      transcriberPromise = null;
      throw err;
    });
  }
  return transcriberPromise;
}

function cleanWhisperTranscript(raw: string): string {
  // Strip Whisper silence/hallucination markers like [BLANK_AUDIO], (silence), etc.
  return raw
    .replace(/\[[^\]]*\]/g, ' ')
    .replace(/\([^)]*\)/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

self.addEventListener('message', async (event: MessageEvent) => {
  const { id, type, audio } = event.data as {
    id: number;
    type: 'preload' | 'transcribe';
    audio?: Float32Array;
  };

  try {
    const transcriber = await getTranscriber((progress, status) => {
      self.postMessage({ id, type: 'progress', progress, status });
    });

    if (type === 'preload') {
      self.postMessage({ id, type: 'ready' });
      return;
    }

    if (type === 'transcribe' && audio) {
      const output = await transcriber(audio, {
        chunk_length_s: 30,
        stride_length_s: 5,
      });
      const rawText = Array.isArray(output) ? (output[0]?.text ?? '') : (output?.text ?? '');
      const text = cleanWhisperTranscript(rawText);
      self.postMessage({ id, type: 'result', text });
    }
  } catch (err) {
    self.postMessage({
      id,
      type: 'error',
      error: err instanceof Error ? err.message : 'Không thể khởi chạy Whisper AI.',
    });
  }
});
