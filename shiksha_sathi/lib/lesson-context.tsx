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

import { getChapters, getTopics, type Chapter, type ProfileSubject, type Topic } from "@/lib/api";
import { useProfile } from "@/lib/profile-context";

const STORAGE_KEY = "medha.lessonContext";

type LessonState = {
  gradeId: string | null;
  subjectId: string | null;
  chapterId: string | null;
  topicId: string | null;
};

const EMPTY: LessonState = { gradeId: null, subjectId: null, chapterId: null, topicId: null };

type LessonContextValue = LessonState & {
  ready: boolean;
  setGradeSubject: (gradeId: string, subjectId: string) => void;
  setChapter: (chapterId: string | null) => void;
  setTopic: (topicId: string | null) => void;
  options: { pairs: ProfileSubject[]; chapters: Chapter[]; topics: Topic[] };
};

const LessonContext = createContext<LessonContextValue | null>(null);

const DEFAULT_PAIRS: ProfileSubject[] = [
  {
    grade_id: "07c4ae8c-2028-49b2-96c4-44f3e63b2c52",
    grade_label: "Class 9",
    numeric_level: 9,
    subject_id: "1adcd3e1-3cde-485f-8a44-4263839f6969",
    subject_name: "Science",
    is_primary: true,
  },
  {
    grade_id: "07c4ae8c-2028-49b2-96c4-44f3e63b2c52",
    grade_label: "Class 9",
    numeric_level: 9,
    subject_id: "46c596f8-17ed-41a9-bc31-649d3e108940",
    subject_name: "Mathematics",
    is_primary: false,
  },
  {
    grade_id: "07c4ae8c-2028-49b2-96c4-44f3e63b2c52",
    grade_label: "Class 9",
    numeric_level: 9,
    subject_id: "364512d6-3d75-43a9-97b6-c005e2848cf1",
    subject_name: "Social Science",
    is_primary: false,
  },
  {
    grade_id: "f0cdece2-3520-49d0-b17a-172ad466d765",
    grade_label: "Class 10",
    numeric_level: 10,
    subject_id: "1adcd3e1-3cde-485f-8a44-4263839f6969",
    subject_name: "Science",
    is_primary: false,
  },
  {
    grade_id: "f0cdece2-3520-49d0-b17a-172ad466d765",
    grade_label: "Class 10",
    numeric_level: 10,
    subject_id: "46c596f8-17ed-41a9-bc31-649d3e108940",
    subject_name: "Mathematics",
    is_primary: false,
  },
  {
    grade_id: "a8e2b960-071f-401a-80c1-b8356c4c631b",
    grade_label: "Class 8",
    numeric_level: 8,
    subject_id: "1adcd3e1-3cde-485f-8a44-4263839f6969",
    subject_name: "Science",
    is_primary: false,
  },
  {
    grade_id: "8e2493d9-d2c5-4229-beb6-f0ca428aac86",
    grade_label: "Class 7",
    numeric_level: 7,
    subject_id: "1adcd3e1-3cde-485f-8a44-4263839f6969",
    subject_name: "Science",
    is_primary: false,
  },
  {
    grade_id: "b9e3731d-2c46-4bff-9cec-27c26f89a602",
    grade_label: "Class 6",
    numeric_level: 6,
    subject_id: "1adcd3e1-3cde-485f-8a44-4263839f6969",
    subject_name: "Science",
    is_primary: false,
  },
];

function readInitial(): LessonState {
  // The (app) subtree renders null until client-side auth resolves, so this
  // lazy initializer only ever runs with `window` present -- no SSR mismatch.
  if (typeof window === "undefined") return EMPTY;
  let stored: LessonState = EMPTY;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw) stored = { ...EMPTY, ...(JSON.parse(raw) as Partial<LessonState>) };
  } catch {
    /* ignore */
  }
  const p = new URLSearchParams(window.location.search);
  return {
    gradeId: p.get("grade") ?? stored.gradeId ?? DEFAULT_PAIRS[0].grade_id,
    subjectId: p.get("subject") ?? stored.subjectId ?? DEFAULT_PAIRS[0].subject_id,
    chapterId: p.get("chapter") ?? stored.chapterId,
    topicId: p.get("topic") ?? stored.topicId,
  };
}

function persist(s: LessonState) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(s));
  } catch {
    /* ignore */
  }
  const p = new URLSearchParams(window.location.search);
  const entries: [string, string | null][] = [
    ["grade", s.gradeId],
    ["subject", s.subjectId],
    ["chapter", s.chapterId],
    ["topic", s.topicId],
  ];
  for (const [k, v] of entries) {
    if (v) p.set(k, v);
    else p.delete(k);
  }
  const qs = p.toString();
  window.history.replaceState(
    null,
    "",
    qs ? `${window.location.pathname}?${qs}` : window.location.pathname,
  );
}

export function LessonProvider({ children }: { children: ReactNode }) {
  const { profile } = useProfile();
  const pairs = useMemo(() => {
    if (profile?.subjects && profile.subjects.length > 0) {
      return profile.subjects;
    }
    return DEFAULT_PAIRS;
  }, [profile]);

  const [state, setState] = useState<LessonState>(readInitial);
  const [chaptersFetched, setChaptersFetched] = useState<Chapter[]>([]);
  const [topicsFetched, setTopicsFetched] = useState<Topic[]>([]);

  // Default to the teacher's primary pair once the profile is in, or repair an
  // invalid stored pair. Render-phase adjustment (guarded against a loop), per
  // React's "adjusting state when a prop changes".
  if (pairs.length > 0) {
    const valid =
      state.gradeId != null &&
      state.subjectId != null &&
      pairs.some((p) => p.grade_id === state.gradeId && p.subject_id === state.subjectId);
    if (!valid) {
      const primary = pairs.find((p) => p.is_primary) ?? pairs[0];
      if (state.gradeId !== primary.grade_id || state.subjectId !== primary.subject_id) {
        setState({
          gradeId: primary.grade_id,
          subjectId: primary.subject_id,
          chapterId: null,
          topicId: null,
        });
      }
    }
  }

  useEffect(() => {
    persist(state);
  }, [state]);

  // chapters for the current (grade, subject); gated at read-time below
  useEffect(() => {
    if (!state.gradeId || !state.subjectId) return;
    let cancelled = false;
    getChapters(state.gradeId, state.subjectId)
      .then((c) => {
        if (cancelled) return;
        setChaptersFetched(c);
        if (c.length > 0) {
          setState((s) => {
            const hasMatchingChapter = s.chapterId && c.some((chap) => chap.id === s.chapterId);
            return hasMatchingChapter ? s : { ...s, chapterId: c[0].id };
          });
        }
      })
      .catch(() => !cancelled && setChaptersFetched([]));
    return () => {
      cancelled = true;
    };
  }, [state.gradeId, state.subjectId]);

  // topics for the current chapter (auto-pick when there's only one)
  useEffect(() => {
    const chapterId = state.chapterId;
    if (!chapterId) return;
    let cancelled = false;
    getTopics(chapterId)
      .then((t) => {
        if (cancelled) return;
        setTopicsFetched(t);
        setState((s) =>
          s.chapterId === chapterId && !s.topicId && t.length === 1
            ? { ...s, topicId: t[0].id }
            : s,
        );
      })
      .catch(() => !cancelled && setTopicsFetched([]));
    return () => {
      cancelled = true;
    };
  }, [state.chapterId]);

  // A stale fetched list must not leak once its key changes.
  const chapters = state.gradeId && state.subjectId ? chaptersFetched : [];
  const topics = state.chapterId ? topicsFetched : [];

  const setGradeSubject = useCallback((gradeId: string, subjectId: string) => {
    setState({ gradeId, subjectId, chapterId: null, topicId: null });
  }, []);
  const setChapter = useCallback((chapterId: string | null) => {
    setState((s) => ({ ...s, chapterId, topicId: null }));
  }, []);
  const setTopic = useCallback((topicId: string | null) => {
    setState((s) => ({ ...s, topicId }));
  }, []);

  const value: LessonContextValue = {
    ...state,
    ready: state.gradeId != null && state.subjectId != null,
    setGradeSubject,
    setChapter,
    setTopic,
    options: { pairs, chapters, topics },
  };

  return <LessonContext.Provider value={value}>{children}</LessonContext.Provider>;
}

export function useLessonContext(): LessonContextValue {
  const ctx = useContext(LessonContext);
  if (!ctx) throw new Error("useLessonContext must be used within a LessonProvider");
  return ctx;
}
