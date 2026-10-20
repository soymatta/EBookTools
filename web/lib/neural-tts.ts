/**
 * In-browser neural TTS via Meta MMS voices (VITS, Apache-2.0 compatible).
 *
 * Zero installs, zero servers: each voice model (~50-100 MB) downloads once
 * from the Hugging Face CDN into the browser Cache API, then everything runs
 * locally (WASM). Quality is clearly above OS voices; trade-off is the
 * first-load download per language. Text must already be cleaned with
 * cleanTextForTTS before calling here.
 */

import { chunkTextForTTS } from "./tts-text";

export interface NeuralVoiceOption {
  id: string;
  label: string;
}

export const NEURAL_VOICES: NeuralVoiceOption[] = [
  { id: "en", label: "English — neural voice" },
  { id: "es", label: "Español — voz neuronal" },
];

const MODEL_IDS: Record<string, string> = {
  en: "Xenova/mms-tts-eng",
  es: "Xenova/mms-tts-spa",
};

export type NeuralStatus = "idle" | "loading" | "ready" | "error";

export interface NeuralProgress {
  status: NeuralStatus;
  /** 0-100 while loading, -1 when indeterminate. */
  percent: number;
  detail: string;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type PipelineInstance = any;

const pipeCache = new Map<string, PipelineInstance>();
const pipeLoading = new Map<string, Promise<PipelineInstance>>();

/** Load (and cache) the pipeline for a voice. Call once; progress via onProgress. */
export function ensureNeuralVoice(
  voice: string,
  onProgress?: (p: NeuralProgress) => void
): Promise<PipelineInstance> {
  const lang = MODEL_IDS[voice] ? voice : "en";
  const cached = pipeCache.get(lang);
  if (cached) return Promise.resolve(cached);
  const ongoing = pipeLoading.get(lang);
  if (ongoing) return ongoing;

  const job = (async () => {
    const { pipeline, env } = await import("@huggingface/transformers");
    // Self-hosted WASM: transformers.js defaults to loading the onnxruntime
    // WASM factory binary from cdn.jsdelivr.net, which our Content-Security
    // Policy (and the offline rule) forbids. Point it at the copy bundled in
    // /public/ort/ so it loads same-origin and works offline. Done after the
    // dynamic import, before the pipeline is created (onnxruntime reads
    // wasmPaths at session creation).
    if (env.backends.onnx.wasm) {
      env.backends.onnx.wasm.wasmPaths = {
        mjs: "/ort/ort-wasm-simd-threaded.asyncify.mjs",
        wasm: "/ort/ort-wasm-simd-threaded.asyncify.wasm",
      };
    }
    onProgress?.({ status: "loading", percent: 0, detail: "Downloading neural voice…" });
    const pipe = await pipeline("text-to-audio", MODEL_IDS[lang], {
      device: "wasm",
      progress_callback: (info: { status: string; progress?: number; file?: string }) => {
        if (info.status === "progress" && typeof info.progress === "number") {
          onProgress?.({
            status: "loading",
            percent: Math.round(info.progress),
            detail: `Downloading neural voice… ${Math.round(info.progress)}%`,
          });
        } else if (info.status === "done") {
          onProgress?.({ status: "loading", percent: -1, detail: "Preparing voice…" });
        }
      },
    });
    pipeCache.set(lang, pipe);
    onProgress?.({ status: "ready", percent: 100, detail: "Ready" });
    return pipe;
  })();

  pipeLoading.set(lang, job);
  job.catch((err: unknown) => {
    pipeLoading.delete(lang);
    const msg = err instanceof Error ? err.message : String(err);
    onProgress?.({ status: "error", percent: 0, detail: `Neural voice failed to load: ${msg.slice(0, 180)}` });
  });

  return job;
}

/** 16-bit PCM WAV encoder for concatenated mono samples. */
function encodeWav(samples: Float32Array, sampleRate: number): Blob {
  const buffer = new ArrayBuffer(44 + samples.length * 2);
  const view = new DataView(buffer);
  const writeStr = (offset: number, s: string) => {
    for (let i = 0; i < s.length; i++) view.setUint8(offset + i, s.charCodeAt(i));
  };
  writeStr(0, "RIFF");
  view.setUint32(4, 36 + samples.length * 2, true);
  writeStr(8, "WAVE");
  writeStr(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  writeStr(36, "data");
  view.setUint32(40, samples.length * 2, true);
  for (let i = 0; i < samples.length; i++) {
    const s = Math.max(-1, Math.min(1, samples[i]));
    view.setInt16(44 + i * 2, s < 0 ? s * 0x8000 : s * 0x7fff, true);
  }
  return new Blob([buffer], { type: "audio/wav" });
}

export interface NeuralSynthesizeOptions {
  text: string;
  voice?: string;
  onProgress?: (p: NeuralProgress) => void;
  onPart?: (done: number, total: number) => void;
}

/**
 * Synthesize cleaned text to a single WAV Blob. Long texts are chunked at
 * sentence boundaries (VITS handles short spans best) and concatenated.
 */
export async function synthesizeNeuralSpeech(opts: NeuralSynthesizeOptions): Promise<Blob> {
  const voice = opts.voice && MODEL_IDS[opts.voice] ? opts.voice : "en";
  const pipe = await ensureNeuralVoice(voice, opts.onProgress);
  const chunks = chunkTextForTTS(opts.text, 400).filter((c) => c.trim());
  if (chunks.length === 0) throw new Error("Nothing to synthesize: empty text");

  const parts: Float32Array[] = [];
  let sampleRate = 22050;
  let total = 0;

  for (let i = 0; i < chunks.length; i++) {
    opts.onPart?.(i, chunks.length);
    const out = await pipe(chunks[i]);
    const audios = (Array.isArray(out) ? out : [out]) as Array<{
      audio?: Float32Array;
      data?: Float32Array;
      sampling_rate?: number;
    }>;
    for (const a of audios) {
      const data = a.audio ?? a.data;
      if (!data) continue;
      sampleRate = a.sampling_rate || sampleRate;
      parts.push(data);
      total += data.length;
    }
  }
  opts.onPart?.(chunks.length, chunks.length);

  if (total === 0) throw new Error("Synthesis produced no audio");

  const merged = new Float32Array(total);
  let offset = 0;
  for (const p of parts) {
    merged.set(p, offset);
    offset += p.length;
  }
  return encodeWav(merged, sampleRate);
}
