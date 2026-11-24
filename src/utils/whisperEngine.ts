let worker: Worker | null = null;
let requestCounter = 0;
let preloadStarted = false;

function getWorker(): Worker {
  if (!worker) {
    worker = new Worker(new URL('../workers/whisperWorker.ts', import.meta.url), {
      type: 'module',
    });
  }
  return worker;
}

export function isWhisperSupported(): boolean {
  return typeof Worker !== 'undefined' && typeof WebAssembly !== 'undefined';
}

export function preloadWhisper(onProgress?: (percent: number) => void): Promise<void> {
  if (!isWhisperSupported()) return Promise.resolve();
  if (preloadStarted) return Promise.resolve();
  preloadStarted = true;

  return new Promise((resolve) => {
    const w = getWorker();
    const id = ++requestCounter;
    const handleMessage = (event: MessageEvent) => {
      const data = event.data as {
        id: number;
        type: 'progress' | 'ready' | 'error';
        progress?: number;
      };
      if (data.id !== id) return;
      if (data.type === 'progress' && typeof data.progress === 'number') {
        onProgress?.(data.progress);
      } else {
        w.removeEventListener('message', handleMessage);
        resolve();
      }
    };
    w.addEventListener('message', handleMessage);
    w.postMessage({ id, type: 'preload' });
  });
}

export function transcribeWithWhisper(
  pcm16k: Float32Array,
  onProgress?: (percent: number) => void
): Promise<string> {
  return new Promise((resolve, reject) => {
    if (!isWhisperSupported()) {
      reject(new Error('Trình duyệt không hỗ trợ WebAssembly / Web Worker cho Whisper AI.'));
      return;
    }

    const w = getWorker();
    const id = ++requestCounter;

    const handleMessage = (event: MessageEvent) => {
      const data = event.data as {
        id: number;
        type: 'progress' | 'result' | 'error' | 'ready';
        progress?: number;
        text?: string;
        error?: string;
      };
      if (data.id !== id) return;

      if (data.type === 'progress' && typeof data.progress === 'number') {
        onProgress?.(data.progress);
      } else if (data.type === 'result') {
        w.removeEventListener('message', handleMessage);
        resolve(data.text ?? '');
      } else if (data.type === 'error') {
        w.removeEventListener('message', handleMessage);
        reject(new Error(data.error || 'Lỗi giải mã giọng nói Whisper AI.'));
      }
    };

    w.addEventListener('message', handleMessage);
    // Transfer a copy of the buffer to avoid detaching caller's array
    const copy = new Float32Array(pcm16k);
    w.postMessage({ id, type: 'transcribe', audio: copy }, [copy.buffer]);
  });
}
