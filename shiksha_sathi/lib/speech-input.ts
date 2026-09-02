"use client";

/**
 * Browser microphone capture + optional Web Speech API fallback for STT
 * when Sarvam is unavailable.
 */

export type RecordingState = "idle" | "recording" | "processing";

const MIN_RECORDING_BYTES = 800;
const MIN_RECORDING_MS = 600;

/** Minimal Web Speech API types — not included in all TS DOM lib builds. */
interface BrowserSpeechRecognitionAlternative {
  transcript: string;
}

interface BrowserSpeechRecognitionResult {
  readonly [index: number]: BrowserSpeechRecognitionAlternative;
  readonly length: number;
}

interface BrowserSpeechRecognitionResultList {
  readonly [index: number]: BrowserSpeechRecognitionResult;
  readonly length: number;
}

interface BrowserSpeechRecognitionEvent extends Event {
  readonly results: BrowserSpeechRecognitionResultList;
}

interface BrowserSpeechRecognitionErrorEvent extends Event {
  readonly error: string;
}

interface BrowserSpeechRecognition {
  lang: string;
  interimResults: boolean;
  maxAlternatives: number;
  continuous: boolean;
  onresult: ((event: BrowserSpeechRecognitionEvent) => void) | null;
  onerror: ((event: BrowserSpeechRecognitionErrorEvent) => void) | null;
  onend: (() => void) | null;
  start(): void;
  stop(): void;
}

type BrowserSpeechRecognitionCtor = new () => BrowserSpeechRecognition;

function getRecognition(): BrowserSpeechRecognition | null {
  if (typeof window === "undefined") return null;
  const w = window as Window & {
    SpeechRecognition?: BrowserSpeechRecognitionCtor;
    webkitSpeechRecognition?: BrowserSpeechRecognitionCtor;
  };
  const Ctor = w.SpeechRecognition ?? w.webkitSpeechRecognition;
  return Ctor ? new Ctor() : null;
}

export function micSupported(): boolean {
  return (
    typeof navigator !== "undefined" &&
    !!navigator.mediaDevices?.getUserMedia
  );
}

export function browserSttSupported(): boolean {
  return getRecognition() !== null;
}

function writeString(view: DataView, offset: number, str: string) {
  for (let i = 0; i < str.length; i += 1) {
    view.setUint8(offset + i, str.charCodeAt(i));
  }
}

function mixToMono(buffer: AudioBuffer): Float32Array {
  if (buffer.numberOfChannels === 1) {
    return buffer.getChannelData(0).slice();
  }
  const length = buffer.length;
  const out = new Float32Array(length);
  for (let ch = 0; ch < buffer.numberOfChannels; ch += 1) {
    const data = buffer.getChannelData(ch);
    for (let i = 0; i < length; i += 1) {
      out[i] = (out[i] ?? 0) + data[i]! / buffer.numberOfChannels;
    }
  }
  return out;
}

function encodeWav(samples: Float32Array, sampleRate: number): ArrayBuffer {
  const numSamples = samples.length;
  const dataSize = numSamples * 2;
  const out = new ArrayBuffer(44 + dataSize);
  const view = new DataView(out);

  writeString(view, 0, "RIFF");
  view.setUint32(4, 36 + dataSize, true);
  writeString(view, 8, "WAVE");
  writeString(view, 12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  writeString(view, 36, "data");
  view.setUint32(40, dataSize, true);

  let offset = 44;
  for (let i = 0; i < numSamples; i += 1) {
    const s = Math.max(-1, Math.min(1, samples[i] ?? 0));
    view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7fff, true);
    offset += 2;
  }
  return out;
}

/**
 * Convert browser MediaRecorder output (often webm/opus) to 16 kHz mono WAV
 * for Sarvam STT, which works most reliably with WAV.
 */
export async function prepareAudioForStt(blob: Blob): Promise<Blob> {
  if (blob.size < MIN_RECORDING_BYTES) {
    throw new Error("Recording too short. Hold the mic a little longer while you speak.");
  }

  try {
    const arrayBuffer = await blob.arrayBuffer();
    const decodeCtx = new AudioContext();
    const decoded = await decodeCtx.decodeAudioData(arrayBuffer.slice(0));
    await decodeCtx.close();

    const targetRate = 16000;
    const offline = new OfflineAudioContext(
      1,
      Math.max(1, Math.ceil(decoded.duration * targetRate)),
      targetRate,
    );
    const source = offline.createBufferSource();
    source.buffer = decoded;
    source.connect(offline.destination);
    source.start(0);
    const rendered = await offline.startRendering();
    const mono = mixToMono(rendered);
    const wav = encodeWav(mono, targetRate);
    return new Blob([wav], { type: "audio/wav" });
  } catch {
    // If decode fails (rare codec), send the original blob.
    return blob;
  }
}

export class VoiceRecorder {
  private media: MediaRecorder | null = null;
  private chunks: Blob[] = [];
  private stream: MediaStream | null = null;
  private startedAt = 0;

  async start(): Promise<void> {
    this.stream = await navigator.mediaDevices.getUserMedia({
      audio: { echoCancellation: true, noiseSuppression: true },
    });
    const mime =
      MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
        ? "audio/webm;codecs=opus"
        : MediaRecorder.isTypeSupported("audio/webm")
          ? "audio/webm"
          : MediaRecorder.isTypeSupported("audio/mp4")
            ? "audio/mp4"
            : "";
    this.media = mime
      ? new MediaRecorder(this.stream, { mimeType: mime })
      : new MediaRecorder(this.stream);
    this.chunks = [];
    this.startedAt = Date.now();
    this.media.ondataavailable = (e) => {
      if (e.data.size > 0) this.chunks.push(e.data);
    };
    this.media.start(250);
  }

  stop(): Promise<Blob> {
    return new Promise((resolve, reject) => {
      const rec = this.media;
      if (!rec || rec.state === "inactive") {
        reject(new Error("Not recording"));
        return;
      }

      const elapsed = Date.now() - this.startedAt;
      if (elapsed < MIN_RECORDING_MS) {
        reject(new Error("Recording too short. Hold the mic a little longer while you speak."));
        this.cancel();
        return;
      }

      rec.onstop = () => {
        const type = rec.mimeType || "audio/webm";
        const blob = new Blob(this.chunks, { type });
        this.cleanup();
        resolve(blob);
      };
      rec.onerror = () => {
        this.cleanup();
        reject(new Error("Recording failed"));
      };
      try {
        rec.requestData();
      } catch {
        /* older browsers */
      }
      rec.stop();
    });
  }

  cancel(): void {
    try {
      if (this.media?.state !== "inactive") this.media?.stop();
    } catch {
      /* ignore */
    }
    this.cleanup();
  }

  private cleanup(): void {
    this.stream?.getTracks().forEach((t) => t.stop());
    this.stream = null;
    this.media = null;
    this.chunks = [];
    this.startedAt = 0;
  }
}

/** Hands-free capture — auto-stops after a pause in speech. */
export class ContinuousVoiceListener {
  private media: MediaRecorder | null = null;
  private chunks: Blob[] = [];
  private stream: MediaStream | null = null;
  private ctx: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private raf = 0;
  private cancelled = false;
  private speechStartedAt = 0;

  async start(onAutoStop: (blob: Blob) => void): Promise<void> {
    this.cancelled = false;
    this.speechStartedAt = 0;
    this.stream = await navigator.mediaDevices.getUserMedia({
      audio: { echoCancellation: true, noiseSuppression: true },
    });

    this.ctx = new AudioContext();
    const source = this.ctx.createMediaStreamSource(this.stream);
    this.analyser = this.ctx.createAnalyser();
    this.analyser.fftSize = 2048;
    source.connect(this.analyser);

    const mime =
      MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
        ? "audio/webm;codecs=opus"
        : MediaRecorder.isTypeSupported("audio/webm")
          ? "audio/webm"
          : "";
    this.media = mime
      ? new MediaRecorder(this.stream, { mimeType: mime })
      : new MediaRecorder(this.stream);
    this.chunks = [];
    this.media.ondataavailable = (e) => {
      if (e.data.size > 0) this.chunks.push(e.data);
    };
    this.media.start(250);

    const SILENCE_THRESHOLD = 0.018;
    const SILENCE_MS = 1400;
    const MIN_SPEECH_MS = 600;
    const MAX_MS = 20000;
    const startedAt = Date.now();
    let silenceStart = 0;

    const tick = () => {
      if (this.cancelled || !this.analyser) return;

      if (Date.now() - startedAt > MAX_MS) {
        void this.finish(onAutoStop);
        return;
      }

      const buf = new Uint8Array(this.analyser.fftSize);
      this.analyser.getByteTimeDomainData(buf);
      let sum = 0;
      for (let i = 0; i < buf.length; i += 1) {
        const v = (buf[i]! - 128) / 128;
        sum += v * v;
      }
      const rms = Math.sqrt(sum / buf.length);

      if (rms > SILENCE_THRESHOLD) {
        if (!this.speechStartedAt) this.speechStartedAt = Date.now();
        silenceStart = 0;
      } else if (this.speechStartedAt) {
        if (!silenceStart) silenceStart = Date.now();
        else if (
          Date.now() - silenceStart > SILENCE_MS &&
          Date.now() - this.speechStartedAt > MIN_SPEECH_MS
        ) {
          void this.finish(onAutoStop);
          return;
        }
      }

      this.raf = requestAnimationFrame(tick);
    };
    tick();
  }

  private async finish(onAutoStop: (blob: Blob) => void): Promise<void> {
    if (this.cancelled) return;
    this.cancelled = true;
    cancelAnimationFrame(this.raf);

    const rec = this.media;
    if (!rec || rec.state === "inactive") {
      this.cleanup();
      return;
    }

    await new Promise<void>((resolve) => {
      rec.onstop = () => {
        const type = rec.mimeType || "audio/webm";
        const blob = new Blob(this.chunks, { type });
        this.cleanup();
        if (blob.size >= MIN_RECORDING_BYTES) onAutoStop(blob);
        resolve();
      };
      try {
        rec.requestData();
      } catch {
        /* older browsers */
      }
      rec.stop();
    });
  }

  cancel(): void {
    this.cancelled = true;
    cancelAnimationFrame(this.raf);
    try {
      if (this.media?.state !== "inactive") this.media?.stop();
    } catch {
      /* ignore */
    }
    this.cleanup();
  }

  private cleanup(): void {
    void this.ctx?.close();
    this.ctx = null;
    this.analyser = null;
    this.stream?.getTracks().forEach((t) => t.stop());
    this.stream = null;
    this.media = null;
    this.chunks = [];
    this.speechStartedAt = 0;
  }
}

/** Live mic dictation — only when Sarvam is unavailable (not after a failed upload). */
export function listenWithBrowser(
  lang: string,
  timeoutMs = 15000,
): Promise<string> {
  return new Promise((resolve, reject) => {
    const rec = getRecognition();
    if (!rec) {
      reject(new Error("Speech recognition not supported in this browser."));
      return;
    }

    let settled = false;
    let gotResult = false;

    const finish = (fn: () => void) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      fn();
    };

    rec.lang = lang.startsWith("hi") ? "hi-IN" : lang.startsWith("en") ? "en-IN" : lang;
    rec.interimResults = false;
    rec.maxAlternatives = 1;
    rec.continuous = false;

    rec.onresult = (event: BrowserSpeechRecognitionEvent) => {
      const text = event.results[0]?.[0]?.transcript?.trim() ?? "";
      if (text) {
        gotResult = true;
        finish(() => resolve(text));
      }
    };
    rec.onerror = (event: BrowserSpeechRecognitionErrorEvent) => {
      finish(() => reject(new Error(event.error || "Speech recognition failed")));
    };
    rec.onend = () => {
      if (!gotResult) {
        finish(() => reject(new Error("No speech detected. Try speaking right after tapping the mic.")));
      }
    };

    const timer = setTimeout(() => {
      try {
        rec.stop();
      } catch {
        /* ignore */
      }
      finish(() => reject(new Error("Listening timed out. Try again.")));
    }, timeoutMs);

    try {
      rec.start();
    } catch (err) {
      finish(() => reject(err instanceof Error ? err : new Error("Could not start listening.")));
    }
  });
}
