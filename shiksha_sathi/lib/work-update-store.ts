"use client";

import { useCallback, useEffect, useSyncExternalStore } from "react";

import {
  createWorkUpdate,
  listWorkUpdates,
  sendWorkUpdateFeedback,
  type WorkUpdateApi,
  type WorkUpdateCreateInput,
  type WorkUpdateReaction,
} from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
const NOTICES_KEY = "medha.school_notices.v1";

export type AiHelpfulnessRating = "very_helpful" | "somewhat_helpful" | "neutral" | "not_needed";

export type QuickWorkActivity =
  | "taught_chapter"
  | "conducted_quiz"
  | "hands_on_activity"
  | "cleared_doubts"
  | "homework_given"
  | "revision_done"
  | "used_ai_slides";

export type BadgeId = "approved_great" | "star_teacher" | "well_done" | "needs_focus";

export type PrincipalFeedback = {
  acknowledged_at: string;
  badge?: BadgeId;
  note?: string;
  flagged: boolean;
};

export type TeacherWorkUpdate = {
  id: string;
  teacher_id: string;
  teacher_name: string;
  date: string; // YYYY-MM-DD
  created_at: string; // ISO timestamp
  grade_label: string; // e.g. "Class 9"
  subject_name: string; // e.g. "Science"
  chapter_title: string; // e.g. "Matter in Our Surroundings"
  activities: QuickWorkActivity[];
  topics: string[];
  other_topics?: string;
  activity_detail?: string;
  homework: { id: string; title: string }[];
  ai_usefulness: AiHelpfulnessRating;
  note: string;
  principal_feedback?: PrincipalFeedback;
  reactions: WorkUpdateReaction[];
};

export type SchoolNotice = {
  id: string;
  title: string;
  message: string;
  target_audience: "all" | "teachers" | "students";
  priority: "normal" | "urgent" | "event";
  posted_by: string; // e.g. "Dr. Rajeshwar Singh (Principal)"
  posted_at: string;
  active: boolean;
};

export const QUICK_ACTIVITIES: { id: QuickWorkActivity; label: string; labelHi: string; icon: string }[] = [
  { id: "taught_chapter", label: "Chapter Taught", labelHi: "अध्याय पढ़ाया", icon: "📖" },
  { id: "conducted_quiz", label: "Conducted Quiz", labelHi: "क्विज़ कराया", icon: "✍️" },
  { id: "hands_on_activity", label: "Class Activity", labelHi: "कक्षा गतिविधि कराई", icon: "🧪" },
  { id: "cleared_doubts", label: "Cleared Doubts", labelHi: "संदेह दूर किए", icon: "💡" },
  { id: "homework_given", label: "Homework Assigned", labelHi: "गृहकार्य दिया", icon: "📝" },
  { id: "revision_done", label: "Revision Done", labelHi: "पुनरावृत्ति कराई", icon: "🔄" },
  { id: "used_ai_slides", label: "Used AI Slides/Material", labelHi: "AI स्लाइड/सामग्री उपयोग की", icon: "💻" },
];

export const AI_USEFULNESS_OPTIONS: { id: AiHelpfulnessRating; label: string; labelHi: string; emoji: string }[] = [
  { id: "very_helpful", label: "Super Helpful (बहुत मददगार)", labelHi: "बहुत मददगार रहा", emoji: "🌟" },
  { id: "somewhat_helpful", label: "Helpful (उपयोगी रहा)", labelHi: "उपयोगी रहा", emoji: "👍" },
  { id: "neutral", label: "Moderate (सामान्य)", labelHi: "सामान्य रहा", emoji: "👌" },
  { id: "not_needed", label: "Not used today (आज ज़रूरत नहीं पड़ी)", labelHi: "आज उपयोग नहीं किया", emoji: "⏭️" },
];

export const PRINCIPAL_BADGES: Record<
  BadgeId,
  { label: string; labelHi: string; emoji: string; color: string }
> = {
  approved_great: {
    label: "Approved & Good Work",
    labelHi: "सत्यापित एवं उत्तम कार्य",
    emoji: "👏",
    color: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30",
  },
  star_teacher: {
    label: "Star Teaching (उत्कृष्ट)",
    labelHi: "स्टार शिक्षण (उत्कृष्ट)",
    emoji: "⭐",
    color: "bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30",
  },
  well_done: {
    label: "Well Done (शाबाश)",
    labelHi: "शाबाश (बहुत अच्छा)",
    emoji: "👍",
    color: "bg-blue-500/15 text-blue-700 dark:text-blue-300 border-blue-500/30",
  },
  needs_focus: {
    label: "Needs Attention (ध्यान दें)",
    labelHi: "अधिक ध्यान देने योग्य",
    emoji: "📌",
    color: "bg-rose-500/15 text-rose-700 dark:text-rose-300 border-rose-500/30",
  },
};

const DEFAULT_NOTICES: SchoolNotice[] = [
  {
    id: "notice-1",
    title: "BSEB Science & Math Diagnostic Assessment Tomorrow",
    message: "Sabhi shikshak Class 9 aur 10 ke baccho ka diagnostic test zaroor conduct karein. Medha open-test paper use kar sakte hain.",
    target_audience: "all",
    priority: "urgent",
    posted_by: "Dr. Rajeshwar Singh (Principal)",
    posted_at: new Date(Date.now() - 3600 * 1000 * 5).toISOString(),
    active: true,
  },
  {
    id: "notice-2",
    title: "Staff Meeting on Saturday (3:00 PM)",
    message: "Syllabus progress aur Monthly attendance review ke liye pradhanacharya kaksh me upasthit rahein.",
    target_audience: "teachers",
    priority: "normal",
    posted_by: "Dr. Rajeshwar Singh (Principal)",
    posted_at: new Date(Date.now() - 3600 * 1000 * 24).toISOString(),
    active: true,
  },
];

// Sample data exists only so the demo/dev UI isn't empty. A production
// deployment must never show invented staff or notices.
const SHOW_DEMO_CONTENT =
  process.env.NODE_ENV !== "production" || process.env.NEXT_PUBLIC_DEMO_CONTENT === "true";

function parseList<T>(raw: string, fallback: T[]): T[] {
  const parsed: unknown = JSON.parse(raw);
  return Array.isArray(parsed) ? (parsed as T[]) : fallback; // never trust stored shape
}

function readNotices(): SchoolNotice[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(NOTICES_KEY);
    const seeds = SHOW_DEMO_CONTENT ? DEFAULT_NOTICES : [];
    if (!raw) {
      if (seeds.length) window.localStorage.setItem(NOTICES_KEY, JSON.stringify(seeds));
      return seeds;
    }
    return parseList<SchoolNotice>(raw, seeds);
  } catch {
    return SHOW_DEMO_CONTENT ? DEFAULT_NOTICES : [];
  }
}

function writeNotices(notices: SchoolNotice[]) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(NOTICES_KEY, JSON.stringify(notices));
    window.dispatchEvent(new Event("medha:notices_changed"));
  } catch {}
}

let cachedNotices: SchoolNotice[] = [];
let cachedSnapshot: { updates: TeacherWorkUpdate[]; notices: SchoolNotice[] } = {
  updates: [],
  notices: [],
};
let cacheLoaded = false;
const listeners = new Set<() => void>();

function emptyUpdates(): TeacherWorkUpdate[] {
  return cachedSnapshot.updates;
}

function updateSnapshot(updates: TeacherWorkUpdate[] = emptyUpdates()) {
  cachedNotices = readNotices();
  cachedSnapshot = { updates, notices: cachedNotices };
}

function notify() {
  for (const listener of listeners) listener();
}

function fromApi(u: WorkUpdateApi): TeacherWorkUpdate {
  return {
    id: u.id,
    teacher_id: u.teacher_id,
    teacher_name: u.teacher_name,
    date: u.work_date,
    created_at: u.created_at,
    grade_label: u.grade_label,
    subject_name: u.subject_name,
    chapter_title: u.chapter_title,
    activities: u.activities as QuickWorkActivity[],
    topics: u.topics,
    other_topics: u.other_topics ?? undefined,
    activity_detail: u.activity_detail ?? undefined,
    homework: u.homework,
    ai_usefulness: u.ai_usefulness as AiHelpfulnessRating,
    note: u.note,
    reactions: u.reactions,
    principal_feedback:
      u.feedback_at != null
        ? {
            acknowledged_at: u.feedback_at,
            badge: (u.principal_badge as PrincipalFeedback["badge"]) ?? undefined,
            note: u.principal_note ?? undefined,
            flagged: u.flagged,
          }
        : undefined,
  };
}

function setUpdates(list: WorkUpdateApi[]) {
  updateSnapshot(list.map(fromApi));
  notify();
}

function upsertUpdate(u: WorkUpdateApi) {
  const mapped = fromApi(u);
  const rest = cachedSnapshot.updates.filter((x) => x.id !== mapped.id);
  updateSnapshot([mapped, ...rest].sort((a, b) => b.created_at.localeCompare(a.created_at)));
  notify();
}

let inflight: Promise<void> | null = null;
export function refreshWorkUpdates(token: string | null): Promise<void> {
  if (!token) return Promise.resolve();
  inflight ??= listWorkUpdates(token)
    .then(setUpdates)
    .catch(() => {})
    .finally(() => {
      inflight = null;
    });
  return inflight;
}

function subscribe(callback: () => void) {
  listeners.add(callback);
  const onCustom = () => {
    updateSnapshot();
    callback();
  };
  const onStorage = (e: StorageEvent) => {
    if (e.key === NOTICES_KEY) {
      updateSnapshot();
      callback();
    }
  };
  window.addEventListener("medha:notices_changed", onCustom);
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(callback);
    window.removeEventListener("medha:notices_changed", onCustom);
    window.removeEventListener("storage", onStorage);
  };
}

const SERVER_SNAPSHOT: { updates: TeacherWorkUpdate[]; notices: SchoolNotice[] } = {
  updates: [],
  notices: [],
};

function getSnapshot(): { updates: TeacherWorkUpdate[]; notices: SchoolNotice[] } {
  if (!cacheLoaded && typeof window !== "undefined") {
    updateSnapshot();
    cacheLoaded = true;
  }
  return cachedSnapshot;
}

function getServerSnapshot(): { updates: TeacherWorkUpdate[]; notices: SchoolNotice[] } {
  return SERVER_SNAPSHOT;
}

export function useWorkUpdates() {
  const store = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const { updates, notices } = store;

  const { accessToken } = useAuth();
  useEffect(() => {
    void refreshWorkUpdates(accessToken);
  }, [accessToken]);

  const addWorkUpdate = useCallback(
    async (payload: WorkUpdateCreateInput) => {
      const created = await createWorkUpdate(accessToken, payload);
      upsertUpdate(created);
      return created;
    },
    [accessToken],
  );

  const giveFeedback = useCallback(
    async (
      updateId: string,
      body: { note?: string | null; flagged: boolean; badge?: string | null },
    ) => {
      const updated = await sendWorkUpdateFeedback(accessToken, updateId, body);
      upsertUpdate(updated);
    },
    [accessToken],
  );

  const addNotice = useCallback(
    (payload: Omit<SchoolNotice, "id" | "posted_at" | "active">) => {
      const current = readNotices();
      const newNotice: SchoolNotice = {
        ...payload,
        id: `notice-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        posted_at: new Date().toISOString(),
        active: true,
      };
      const updated = [newNotice, ...current];
      cachedNotices = updated;
      writeNotices(updated);
      updateSnapshot();
      notify();
      return newNotice;
    },
    [],
  );

  const deleteNotice = useCallback(
    (noticeId: string) => {
      const current = readNotices();
      const updated = current.filter((n) => n.id !== noticeId);
      cachedNotices = updated;
      writeNotices(updated);
      updateSnapshot();
      notify();
    },
    [],
  );

  const getUpdatesForTeacher = useCallback(
    (teacherId?: string | null) => {
      if (!teacherId) return updates;
      return updates.filter(
        (u) => u.teacher_id === teacherId || u.teacher_name?.toLowerCase() === teacherId.toLowerCase(),
      );
    },
    [updates],
  );

  const getTodayUpdateForTeacher = useCallback(
    (teacherId?: string | null) => {
      const today = new Date().toISOString().slice(0, 10);
      const list = getUpdatesForTeacher(teacherId);
      return list.find((u) => u.date === today) ?? null;
    },
    [getUpdatesForTeacher],
  );

  return {
    updates,
    notices,
    addWorkUpdate,
    giveFeedback,
    addNotice,
    deleteNotice,
    getUpdatesForTeacher,
    getTodayUpdateForTeacher,
  };
}

