"use client";

import type { ModuleArtifact } from "@/lib/api";

/**
 * A wrapper around the browser Web Speech API (`speechSynthesis`). Frontend
 * only -- no audio is generated on the server.
 *
 * Works around long-standing Chrome bugs:
 *  - the utterance is garbage-collected mid-speech (audio stops, `onend` never
 *    fires, the UI is stuck on "Stop") -> we keep a module-level reference to
 *    whatever is playing;
 *  - `speak()` in the same tick as `cancel()` is silently dropped -> when we
 *    interrupt something we defer the next `speak()` by a tick; a fresh start
 *    from idle stays synchronous so it keeps the click's user activation;
 *  - long utterances are cut off after ~15s -> the text is split into short
 *    chunks spoken back to back;
 *  - a leftover paused state from a previous session -> `resume()` on start.
 *
 * One block plays at a time; components subscribe via `subscribeSpeech` to
 * reflect which block id (if any) is being read.
 */

type Listener = () => void;

const listeners = new Set<Listener>();
let speakingId: string | null = null;

type Job = {
  id: string;
  chunks: string[];
  index: number;
  errors: number;
  lang: string | undefined;
  utterance: SpeechSynthesisUtterance | null; // held so the browser can't GC it
  cancelled: boolean;
  watchdog: ReturnType<typeof setTimeout> | null;
};

let job: Job | null = null;

export const NOOP_SUBSCRIBE = () => () => {};

function emit() {
  for (const l of listeners) l();
}

export function subscribeSpeech(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function getSpeakingId(): string | null {
  return speakingId;
}

export function speechSupported(): boolean {
  return (
    typeof window !== "undefined" &&
    "speechSynthesis" in window &&
    typeof window.SpeechSynthesisUtterance === "function"
  );
}

// --- voices ------------------------------------------------------------
// getVoices() is empty on the first call in Chrome; it fills in asynchronously
// and fires `voiceschanged`. Cache whatever we can, refreshing opportunistically.

let voices: SpeechSynthesisVoice[] = [];

function refreshVoices() {
  if (!speechSupported()) return;
  const list = window.speechSynthesis.getVoices();
  if (list.length) voices = list;
}

if (typeof window !== "undefined" && "speechSynthesis" in window) {
  refreshVoices();
  try {
    window.speechSynthesis.addEventListener("voiceschanged", refreshVoices);
  } catch {
    window.speechSynthesis.onvoiceschanged = refreshVoices;
  }
}

/** A tag we can hand to the engine, or undefined. `hi-BiharBoli` and other
 *  non-standard values collapse to their base language. */
function normalizeLang(pref: string | null | undefined): string | undefined {
  if (!pref) return undefined;
  if (/^[a-z]{2}(-[A-Za-z]{2})?$/.test(pref)) return pref;
  return /^[a-z]{2}/i.test(pref) ? pref.slice(0, 2).toLowerCase() : undefined;
}

function pickVoice(lang: string | undefined): SpeechSynthesisVoice | null {
  if (!lang) return null;
  if (voices.length === 0) refreshVoices();
  if (voices.length === 0) return null;
  const want = lang.toLowerCase();
  const base = want.slice(0, 2);
  return (
    voices.find((v) => v.lang.toLowerCase() === want) ??
    voices.find((v) => v.lang.toLowerCase().replace("_", "-").startsWith(base)) ??
    null
  );
}

// --- text -> chunks --------------------------------------------------

function toChunks(text: string): string[] {
  const clean = text.replace(/\s+/g, " ").trim();
  if (!clean) return [];
  // split on sentence enders (incl. the Devanagari danda), keeping them
  const sentences = clean.match(/[^.!?।]+[.!?।]+|\S[^.!?।]*$/g) ?? [clean];
  const out: string[] = [];
  for (const raw of sentences) {
    let piece = raw.trim();
    while (piece.length > 180) {
      const space = piece.lastIndexOf(" ", 180);
      const at = space > 60 ? space : 180;
      out.push(piece.slice(0, at).trim());
      piece = piece.slice(at).trim();
    }
    if (piece) out.push(piece);
  }
  return out;
}

// --- playback ------------------------------------------------------

function clearWatchdog(j: Job) {
  if (j.watchdog !== null) {
    clearTimeout(j.watchdog);
    j.watchdog = null;
  }
}

function finish(j: Job) {
  clearWatchdog(j);
  if (job === j) {
    job = null;
    if (speakingId === j.id) {
      speakingId = null;
      emit();
    }
  }
}

function speakNext() {
  const j = job;
  if (!j || j.cancelled) return;
  if (j.index >= j.chunks.length) {
    finish(j);
    return;
  }

  const u = new window.SpeechSynthesisUtterance(j.chunks[j.index]);
  const voice = pickVoice(j.lang);
  if (voice) {
    u.voice = voice;
    u.lang = voice.lang;
  }
  // Deliberately do NOT set u.lang without a matching voice -- Chrome then
  // renders silence instead of falling back to the default voice.
  u.rate = 1;
  u.pitch = 1;

  u.onend = () => {
    if (job !== j || j.cancelled) return;
    clearWatchdog(j);
    j.errors = 0;
    j.index += 1;
    speakNext();
  };
  u.onerror = (event) => {
    if (job !== j || j.cancelled) return;
    clearWatchdog(j);
    // our own cancel() surfaces here
    if (event.error === "interrupted" || event.error === "canceled") return;
    // no user activation -- stop cleanly so the button resets and the next
    // click starts fresh inside a gesture
    if (event.error === "not-allowed") {
      finish(j);
      return;
    }
    // tolerate one bad chunk; bail if the engine keeps failing
    j.errors += 1;
    if (j.errors >= 2) {
      finish(j);
      return;
    }
    j.index += 1;
    speakNext();
  };

  j.utterance = u;
  try {
    window.speechSynthesis.speak(u);
  } catch {
    finish(j);
    return;
  }

  // If speak() was silently ignored (a known state right after cancel) and
  // nothing starts, reset the UI rather than leaving it stuck on "Stop".
  clearWatchdog(j);
  j.watchdog = setTimeout(() => {
    if (job !== j || j.cancelled) return;
    if (
      j.index === 0 &&
      !window.speechSynthesis.speaking &&
      !window.speechSynthesis.pending
    ) {
      finish(j);
    }
  }, 1200);
}

export function stopSpeech(): void {
  if (!speechSupported()) return;
  if (job) {
    job.cancelled = true;
    clearWatchdog(job);
    job = null;
  }
  window.speechSynthesis.cancel();
  if (speakingId !== null) {
    speakingId = null;
    emit();
  }
}

/** Start reading `text` for block `id`; calling it again for the block that is
 *  already playing stops it. */
export function toggleSpeech(
  id: string,
  text: string,
  opts: { lang?: string | null } = {},
): void {
  if (!speechSupported()) return;

  const sameBlock = speakingId === id;
  const engineBusy =
    window.speechSynthesis.speaking || window.speechSynthesis.pending;

  stopSpeech();
  if (sameBlock) return; // second click on the same block => just stop

  const chunks = toChunks(text);
  if (chunks.length === 0) return;

  const next: Job = {
    id,
    chunks,
    index: 0,
    errors: 0,
    lang: normalizeLang(opts.lang),
    utterance: null,
    cancelled: false,
    watchdog: null,
  };
  job = next;
  speakingId = id;
  emit();

  // clear any leftover paused state (e.g. from an older build's keep-alive hack)
  try {
    window.speechSynthesis.resume();
  } catch {
    /* ignore */
  }

  if (engineBusy) {
    // we just cancel()'d a live utterance; let Chrome settle before speak()
    setTimeout(() => {
      if (job === next && !next.cancelled) speakNext();
    }, 60);
  } else {
    // fresh start: stay inside the click's user activation
    speakNext();
  }
}

// --- text extraction -----------------------------------------------------

/** Flatten markdown to something worth reading out loud. */
export function stripMarkdown(md: string): string {
  return md
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/!\[[^\]]*\]\([^)]*\)/g, " ")
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/^\s*>\s?/gm, "")
    .replace(/^\s*[-*+]\s+/gm, "")
    .replace(/^\s*\d+\.\s+/gm, "")
    .replace(/(\*\*|__)(.*?)\1/g, "$2")
    .replace(/(\*|_)(.*?)\1/g, "$2")
    .replace(/~~(.*?)~~/g, "$2")
    .replace(/^\s*([-*_]\s*){3,}$/gm, " ")
    .replace(/\|/g, " ")
    .replace(/\n{2,}/g, ". ")
    .replace(/\s+/g, " ")
    .trim();
}

type SpeakableContent = {
  text?: string;
  questions?: {
    q: string;
    options?: string[];
    answer: string;
  }[];
  title?: string;
  steps?: string[];
  variation?: string;
};

/** A read-aloud script for a block of generated content of a given type. */
export function speakableContent(
  type: "explanation" | "quiz" | "activity",
  content: SpeakableContent | null | undefined,
): string {
  if (!content) return "";

  if (type === "explanation") {
    return stripMarkdown(content.text ?? "");
  }

  if (type === "quiz") {
    const questions = content.questions ?? [];
    return questions
      .map((q, i) => {
        const opts = (q.options ?? [])
          .map((o, j) => `Option ${String.fromCharCode(65 + j)}: ${o}`)
          .join(". ");
        return `Question ${i + 1}. ${q.q}.${opts ? ` ${opts}.` : ""} Answer: ${q.answer}.`;
      })
      .join(" ");
  }

  const steps = (content.steps ?? []).map((s, i) => `Step ${i + 1}. ${s}`).join(" ");
  return [
    content.title ?? "",
    steps,
    content.variation ? `Variation. ${content.variation}` : "",
  ]
    .filter(Boolean)
    .join(". ");
}

/** A read-aloud script for a saved module artifact. */
export function speakableArtifact(a: ModuleArtifact): string {
  return speakableContent(a.artifact_type, a.content_json);
}
