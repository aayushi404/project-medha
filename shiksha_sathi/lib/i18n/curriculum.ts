"use client";

import { useMemo } from "react";

import { useLocale } from "@/lib/locale-context";

import { CHAPTER_HI, SUBJECT_HI, TOPIC_HI } from "./curriculum-hi";
import type { Locale } from "./index";

/** "Class 8" -> "कक्षा 8"; anything else is returned unchanged. */
function gradeHi(label: string): string {
  const m = /^class\s+(.+)$/i.exec(label.trim());
  return m ? `कक्षा ${m[1]}` : label;
}

function pick(map: Record<string, string>, text: string): string {
  return map[text] ?? map[text.trim()] ?? text;
}

/** Translate one piece of seeded curriculum text for a locale. Falls back to
 *  the original string when there is no Hindi entry. */
export function translateCurriculum(
  kind: "subject" | "grade" | "chapter" | "topic",
  text: string | null | undefined,
  locale: Locale,
): string {
  if (!text) return text ?? "";
  if (locale !== "hi") return text;
  switch (kind) {
    case "subject":
      return pick(SUBJECT_HI, text);
    case "grade":
      return gradeHi(text);
    case "chapter":
      return pick(CHAPTER_HI, text);
    case "topic":
      return pick(TOPIC_HI, text);
  }
}

/** Locale-bound translators for the seeded curriculum. Use inside a component.
 *  The returned object is stable for a given locale (safe in dependency lists). */
export function useCurriculumT() {
  const { locale } = useLocale();
  return useMemo(
    () => ({
      subject: (t?: string | null) => translateCurriculum("subject", t, locale),
      grade: (t?: string | null) => translateCurriculum("grade", t, locale),
      chapter: (t?: string | null) => translateCurriculum("chapter", t, locale),
      topic: (t?: string | null) => translateCurriculum("topic", t, locale),
    }),
    [locale],
  );
}
