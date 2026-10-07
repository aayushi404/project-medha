"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

import { getGrades, getProfile, getSubjects, patchProfile, type Subject } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";

/** The two written-answer languages a student can pick, in the subject/
 * chapter bar. Distinct from the UI chrome language (lib/locale-context) --
 * this is the student's `preferred_language` on the server, which the tutor
 * chat, notes and practice generation read directly. Voice stays Hindi
 * regardless, set separately where the voice assistant is wired up. */
export type ContentLanguage = "hi-BiharBoli" | "hinglish";

type StudentDataValue = {
  /** the student's class id, from their account */
  gradeId: string | null;
  gradeLabel: string | null;
  firstName: string;
  subjects: Subject[];
  loading: boolean;
  /** null until the profile fetch resolves */
  contentLanguage: ContentLanguage | null;
  /** Persists the choice to the server; throws on failure so the caller can
   * show its own error. */
  setContentLanguage: (lang: ContentLanguage) => Promise<void>;
};

const StudentDataContext = createContext<StudentDataValue | null>(null);

/**
 * Frontend-only shared data for the student section: the student's class label
 * and the subject list. Fetched once so Practice / Notes / Library / Ask Medha
 * don't each re-request them.
 */
export function StudentDataProvider({ children }: { children: ReactNode }) {
  const { teacher, accessToken } = useAuth();
  const gradeId = teacher?.role === "student" ? teacher.grade_id : null;
  const firstName = teacher?.full_name?.trim().split(/\s+/)[0] ?? "";

  const [gradeLabel, setGradeLabel] = useState<string | null>(null);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [loading, setLoading] = useState(true);
  const [contentLanguage, setContentLanguageState] = useState<ContentLanguage | null>(null);

  useEffect(() => {
    let cancelled = false;
    Promise.all([getSubjects().catch(() => []), getGrades().catch(() => [])])
      .then(([subs, grades]) => {
        if (cancelled) return;
        setSubjects(subs);
        setGradeLabel(grades.find((g) => g.id === gradeId)?.label ?? null);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [gradeId]);

  useEffect(() => {
    if (!accessToken) return;
    let cancelled = false;
    getProfile(accessToken)
      .then((p) => {
        if (cancelled) return;
        // any older/unmapped value (plain "hi" or "en") reads as the Hindi side
        setContentLanguageState(p.preferred_language === "hinglish" ? "hinglish" : "hi-BiharBoli");
      })
      .catch(() => {
        /* leave null -- the toggle just won't render yet */
      });
    return () => {
      cancelled = true;
    };
  }, [accessToken]);

  const setContentLanguage = useCallback(
    async (lang: ContentLanguage) => {
      const prev = contentLanguage;
      setContentLanguageState(lang); // optimistic -- the next message/generation picks it up immediately
      try {
        await patchProfile(accessToken, { preferred_language: lang });
      } catch (err) {
        setContentLanguageState(prev);
        throw err;
      }
    },
    [accessToken, contentLanguage],
  );

  const value = useMemo<StudentDataValue>(
    () => ({ gradeId, gradeLabel, firstName, subjects, loading, contentLanguage, setContentLanguage }),
    [gradeId, gradeLabel, firstName, subjects, loading, contentLanguage, setContentLanguage],
  );

  return (
    <StudentDataContext.Provider value={value}>{children}</StudentDataContext.Provider>
  );
}

export function useStudentData(): StudentDataValue {
  const ctx = useContext(StudentDataContext);
  if (!ctx) throw new Error("useStudentData must be used within a StudentDataProvider");
  return ctx;
}
