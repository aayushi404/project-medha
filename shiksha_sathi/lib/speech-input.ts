"use client";

/**
 * Browser microphone capture + optional Web Speech API fallback for STT
 * when Sarvam is unavailable.
 */

export type RecordingState = "idle" | "recording" | "processing";

type SpeechRecognitionCtor = new () => SpeechRecognition;

function getRecognition(): SpeechRecognition | null {
  if (typeof window === "undefined") return null;
  const w = window as Window & {
    SpeechRecognition?: SpeechRecognitionCtor;
    webkitSpeechRecognition?: SpeechRecognitionCtor;
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

export class VoiceRecorder {
  private media: MediaRecorder | null = null;
  private chunks: Blob[] = [];
  private stream: MediaStream | null = null;

  async start(): Promise<void> {
    this.stream = await navigator.mediaDevices.getUserMedia({ audio: true });
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
  }

  stop(): Promise<Blob> {
    return new Promise((resolve, reject) => {
      const rec = this.media;
      if (!rec || rec.state === "inactive") {
        reject(new Error("Not recording"));
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
  }
}

/** One-shot browser speech recognition (fallback when Sarvam STT fails). */
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

    rec.onresult = (event) => {
      const text = event.results[0]?.[0]?.transcript?.trim() ?? "";
      finish(() => (text ? resolve(text) : reject(new Error("No speech detected."))));
    };
    rec.onerror = (event) => {
      finish(() => reject(new Error(event.error || "Speech recognition failed")));
    };
    rec.onend = () => {
      finish(() => reject(new Error("No speech detected.")));
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
