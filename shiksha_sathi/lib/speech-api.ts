import { API_BASE_URL, apiFetch, extractErrorMessage } from "@/lib/api";

export type TranscribeResult = {
  transcript: string;
  language_code?: string | null;
};

export type SynthesizeResult = {
  audio_base64: string;
  content_type: string;
};

/** Upload recorded audio to Sarvam STT via our backend proxy. */
export async function transcribeAudio(
  blob: Blob,
  token: string | null,
  language?: string | null,
): Promise<TranscribeResult> {
  const form = new FormData();
  form.append("file", blob, blob.type.includes("wav") ? "audio.wav" : "audio.webm");
  if (language) form.append("language", language);

  const headers: Record<string, string> = {};
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(`${API_BASE_URL}/speech/transcribe`, {
    method: "POST",
    headers,
    credentials: "include",
    body: form,
  });

  if (!res.ok) {
    throw new Error(await extractErrorMessage(res));
  }
  return res.json() as Promise<TranscribeResult>;
}

/** Convert text to speech via Sarvam Bulbul. Returns playable audio URL (revoke when done). */
export async function synthesizeSpeech(
  text: string,
  token: string | null,
  language = "en-IN",
): Promise<string> {
  const res = await apiFetch("/speech/synthesize", {
    method: "POST",
    token,
    body: { text, language },
  });
  if (!res.ok) {
    throw new Error(await extractErrorMessage(res));
  }
  const data = (await res.json()) as SynthesizeResult;
  const binary = atob(data.audio_base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  const blob = new Blob([bytes], { type: data.content_type || "audio/wav" });
  return URL.createObjectURL(blob);
}

/** Play Sarvam TTS audio; falls back to browser speech on failure. */
export async function playSpeech(
  text: string,
  token: string | null,
  opts: { language?: string; onEnd?: () => void } = {},
): Promise<void> {
  const clean = text.trim();
  if (!clean) {
    opts.onEnd?.();
    return;
  }

  try {
    const url = await synthesizeSpeech(clean, token, opts.language ?? "en-IN");
    await new Promise<void>((resolve, reject) => {
      const audio = new Audio(url);
      audio.onended = () => {
        URL.revokeObjectURL(url);
        resolve();
      };
      audio.onerror = () => {
        URL.revokeObjectURL(url);
        reject(new Error("Audio playback failed"));
      };
      void audio.play().catch(reject);
    });
    opts.onEnd?.();
    return;
  } catch {
    // fall through to browser TTS
  }

  if (typeof window !== "undefined" && "speechSynthesis" in window) {
    await new Promise<void>((resolve) => {
      const u = new SpeechSynthesisUtterance(clean.slice(0, 500));
      u.lang = opts.language ?? "en-IN";
      u.onend = () => resolve();
      u.onerror = () => resolve();
      window.speechSynthesis.speak(u);
    });
  }
  opts.onEnd?.();
}
