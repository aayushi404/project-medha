import { API_BASE_URL, apiFetch, extractErrorMessage } from "@/lib/api";
import { prepareAudioForStt } from "@/lib/speech-input";

export type TranscribeResult = {
  transcript: string;
  language_code?: string | null;
};

export type SynthesizeResult = {
  audio_base64: string;
  content_type: string;
};

export type PronunciationResult = {
  score: number;
  heard: string;
  expected: string;
  feedback: string;
  tips: string[];
};

export type VoiceTurn = {
  id: string;
  user_transcript: string;
  assistant_text: string | null;
  created_at: string;
};

/** Past spoken turns for a session, oldest first — repopulates the voice panel. */
export async function fetchVoiceTurns(
  sessionId: string,
  token: string | null,
  limit = 20,
): Promise<VoiceTurn[]> {
  const res = await apiFetch(`/speech/sessions/${sessionId}/turns?limit=${limit}`, {
    token,
  });
  if (!res.ok) {
    throw new Error(await extractErrorMessage(res));
  }
  return res.json() as Promise<VoiceTurn[]>;
}

/**
 * Speak text with the browser's built-in voice — no server call. Used as the
 * fallback when Sarvam TTS is down (the server already tried it), so calling
 * /speech/synthesize again would only fail again.
 */
export function browserSpeak(
  text: string,
  opts: { language?: string | null; onEnd?: () => void } = {},
): void {
  const clean = text.trim();
  if (!clean || typeof window === "undefined" || !("speechSynthesis" in window)) {
    opts.onEnd?.();
    return;
  }
  const u = new SpeechSynthesisUtterance(clean.slice(0, 600));
  u.lang = (opts.language ?? "").toLowerCase().startsWith("en") ? "en-IN" : "hi-IN";
  u.onend = () => opts.onEnd?.();
  u.onerror = () => opts.onEnd?.();
  window.speechSynthesis.cancel();
  window.speechSynthesis.speak(u);
}

/** Map profile/UI language tags to Sarvam TTS params (incl. Bihari accent). */
export function resolveTtsParams(language?: string | null): {
  language: string;
  accent?: string;
} {
  const p = (language ?? "").toLowerCase();
  if (p.includes("bihar")) return { language: "hi-IN", accent: "bihari" };
  if (p.startsWith("en")) return { language: "en-IN" };
  if (p.startsWith("hi")) return { language: "hi-IN" };
  return { language: "hi-IN" };
}

/** Upload recorded audio to Sarvam STT via our backend proxy. */
export async function transcribeAudio(
  blob: Blob,
  token: string | null,
  language?: string | null,
): Promise<TranscribeResult> {
  const prepared = await prepareAudioForStt(blob);
  const isWav = prepared.type.includes("wav");

  const form = new FormData();
  form.append("file", prepared, isWav ? "audio.wav" : "audio.webm");
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
  accent?: string | null,
): Promise<string> {
  const body: { text: string; language: string; accent?: string } = { text, language };
  if (accent) body.accent = accent;

  const res = await apiFetch("/speech/synthesize", {
    method: "POST",
    token,
    body,
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
  opts: { language?: string; accent?: string; onEnd?: () => void } = {},
): Promise<void> {
  const clean = text.trim();
  if (!clean) {
    opts.onEnd?.();
    return;
  }

  const resolved = resolveTtsParams(opts.language);
  const language = resolved.language;
  const accent = opts.accent ?? resolved.accent;

  try {
    const url = await synthesizeSpeech(clean, token, language, accent);
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

/** Score spoken English against an expected phrase. */
export async function checkPronunciation(
  blob: Blob,
  expected: string,
  token: string | null,
): Promise<PronunciationResult> {
  const prepared = await prepareAudioForStt(blob);
  const isWav = prepared.type.includes("wav");

  const form = new FormData();
  form.append("file", prepared, isWav ? "audio.wav" : "audio.webm");
  form.append("expected_text", expected);

  const headers: Record<string, string> = {};
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(`${API_BASE_URL}/english/pronunciation-check`, {
    method: "POST",
    headers,
    credentials: "include",
    body: form,
  });

  if (!res.ok) {
    throw new Error(await extractErrorMessage(res));
  }
  return res.json() as Promise<PronunciationResult>;
}
