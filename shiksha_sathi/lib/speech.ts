"use client";

import type { ModuleArtifact } from "@/lib/api";

/**
 * A tiny wrapper around the browser Web Speech API (`speechSynthesis`).
 * Frontend only -- no audio is generated on the server. One utterance plays at
 * a time; starting a new one cancels whatever was speaking. Components subscribe
 * to `subscribeSpeech` to reflect which block (by id) is currently being read.
 */

type Listener = () => void;

const listeners = new Set<Listener>();
let speakingId: string | null = null;
// Chrome stops long utterances after ~15s unless it is nudged. This keeps it
// going while something is actually speaking.
let keepAlive: ReturnType<typeof setInterval> | null = null;

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
  return typeof window !== "undefined" && "speechSynthesis" in window;
}

function stopKeepAlive() {
  if (keepAlive !== null) {
    clearInterval(keepAlive);
    keepAlive = null;
  }
}

function startKeepAlive() {
  stopKeepAlive();
  keepAlive = setInterval(() => {
    if (!window.speechSynthesis.speaking) {
      stopKeepAlive();
      return;
    }
    window.speechSynthesis.pause();
    window.speechSynthesis.resume();
  }, 10_000);
}

function normalizeLang(pref: string | null | undefined): string | undefined {
  if (!pref) return undefined;
  if (/^[a-z]{2}(-[A-Za-z]{2,})?$/.test(pref) && pref.length <= 5) return pref;
  return pref.slice(0, 2).toLowerCase();
}

function pickVoice(lang: string | undefined): SpeechSynthesisVoice | null {
  if (!lang) return null;
  const voices = window.speechSynthesis.getVoices();
  if (voices.length === 0) return null;
  const want = lang.toLowerCase();
  const base = want.slice(0, 2);
  return (
    voices.find((v) => v.lang.toLowerCase() === want) ??
    voices.find((v) => v.lang.toLowerCase().startsWith(base)) ??
    null
  );
}

export function stopSpeech(): void {
  if (!speechSupported()) return;
  stopKeepAlive();
  window.speechSynthesis.cancel();
  if (speakingId !== null) {
    speakingId = null;
    emit();
  }
}

/** Start reading `text` for block `id`; clicking the block that's already
 *  playing stops it. */
export function toggleSpeech(
  id: string,
  text: string,
  opts: { lang?: string | null } = {},
): void {
  if (!speechSupported()) return;
  if (speakingId === id) {
    stopSpeech();
    return;
  }

  window.speechSynthesis.cancel();
  const clean = text.trim();
  if (!clean) {
    stopSpeech();
    return;
  }

  const utterance = new SpeechSynthesisUtterance(clean);
  const lang = normalizeLang(opts.lang);
  const voice = pickVoice(lang);
  if (voice) {
    utterance.voice = voice;
    utterance.lang = voice.lang;
  } else if (lang) {
    utterance.lang = lang;
  }
  utterance.rate = 0.98;

  const finish = () => {
    if (speakingId === id) {
      speakingId = null;
      stopKeepAlive();
      emit();
    }
  };
  utterance.onend = finish;
  utterance.onerror = finish;

  speakingId = id;
  emit();
  window.speechSynthesis.speak(utterance);
  startKeepAlive();
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
