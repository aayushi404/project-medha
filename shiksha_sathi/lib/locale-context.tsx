"use client";

import { useCallback, useSyncExternalStore } from "react";

import { DICTS, type Copy, type Locale } from "@/lib/i18n";

/**
 * UI language ("chrome") switch. Frontend-only: it does not touch the
 * teacher's `preferred_language` on the server (that governs *generated*
 * content). Backed by a module-level store read through useSyncExternalStore,
 * so no provider is needed and there is no setState-in-effect.
 */

const KEY = "medha.locale";
const listeners = new Set<() => void>();
let current: Locale | null = null;

function detect(): Locale {
  if (typeof window === "undefined") return "en";
  try {
    const stored = window.localStorage.getItem(KEY);
    if (stored === "en" || stored === "hi") return stored;
  } catch {
    /* localStorage unavailable */
  }
  const langs =
    typeof navigator !== "undefined"
      ? [navigator.language, ...(navigator.languages ?? [])]
      : [];
  return langs.some((l) => l?.toLowerCase().startsWith("hi")) ? "hi" : "en";
}

function subscribe(cb: () => void): () => void {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
}

function getSnapshot(): Locale {
  if (current === null) current = detect();
  return current;
}

function getServerSnapshot(): Locale {
  return "en";
}

export function setLocale(next: Locale): void {
  if (current === next) return;
  current = next;
  try {
    window.localStorage.setItem(KEY, next);
  } catch {
    /* ignore */
  }
  if (typeof document !== "undefined") {
    document.documentElement.lang = next;
  }
  for (const l of listeners) l();
}

export function useLocale(): {
  locale: Locale;
  setLocale: (l: Locale) => void;
  toggle: () => void;
} {
  const locale = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const toggle = useCallback(
    () => setLocale(locale === "en" ? "hi" : "en"),
    [locale],
  );
  return { locale, setLocale, toggle };
}

/** The string dictionary for the active locale. Call inside a component. */
export function useCopy(): Copy {
  const locale = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  return DICTS[locale];
}
