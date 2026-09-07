"use client";

import { useCallback, useSyncExternalStore } from "react";

const STORAGE_KEY = "medha.teacher_work_updates.v1";
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

export type PrincipalFeedback = {
  acknowledged_at: string;
  badge: "approved_great" | "star_teacher" | "well_done" | "needs_focus";
  note?: string;
};

export type TeacherWorkUpdate = {
  id: string;
  teacher_id: string;
  teacher_name: string;
  school_id: string;
  school_name?: string;
  date: string; // YYYY-MM-DD
  created_at: string; // ISO timestamp
  grade_label: string; // e.g. "Class 9"
  subject_name: string; // e.g. "Science"
  chapter_title: string; // e.g. "Matter in Our Surroundings"
  activities: QuickWorkActivity[];
  ai_usefulness: AiHelpfulnessRating;
  note?: string; // Optional short 1-line note
  principal_feedback?: PrincipalFeedback;
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
  PrincipalFeedback["badge"],
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

const DEFAULT_SEEDS: TeacherWorkUpdate[] = [
  {
    id: "upd-seed-1",
    teacher_id: "0f9e8ac3-2b84-4516-8596-f15a747ffd98",
    teacher_name: "Nidhi Priya",
    school_id: "sch-10280105528",
    school_name: "Govt. Girls High School Patna City",
    date: new Date().toISOString().slice(0, 10),
    created_at: new Date(Date.now() - 3600 * 1000 * 2).toISOString(),
    grade_label: "Class 9",
    subject_name: "Science",
    chapter_title: "Matter in Our Surroundings",
    activities: ["taught_chapter", "conducted_quiz", "used_ai_slides"],
    ai_usefulness: "very_helpful",
    note: "Used Medha teaching strategy for evaporation vs boiling; students understood quickly.",
    principal_feedback: {
      acknowledged_at: new Date(Date.now() - 3600 * 1000 * 1).toISOString(),
      badge: "star_teacher",
      note: "Very good concept clarity and engagement!",
    },
  },
  {
    id: "upd-seed-2",
    teacher_id: "usr-teacher-1",
    teacher_name: "Sunita Kumari",
    school_id: "sch-10280105528",
    school_name: "Govt. Girls High School Patna City",
    date: new Date().toISOString().slice(0, 10),
    created_at: new Date(Date.now() - 3600 * 1000 * 4).toISOString(),
    grade_label: "Class 10",
    subject_name: "Mathematics",
    chapter_title: "Real Numbers",
    activities: ["taught_chapter", "cleared_doubts", "homework_given"],
    ai_usefulness: "somewhat_helpful",
    note: "Practiced Euclid's division lemma questions generated from Medha.",
    principal_feedback: {
      acknowledged_at: new Date(Date.now() - 3600 * 1000 * 2).toISOString(),
      badge: "approved_great",
    },
  },
];

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

function readStorage(): TeacherWorkUpdate[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(DEFAULT_SEEDS));
      return DEFAULT_SEEDS;
    }
    return JSON.parse(raw) as TeacherWorkUpdate[];
  } catch {
    return DEFAULT_SEEDS;
  }
}

function writeStorage(updates: TeacherWorkUpdate[]) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(updates));
    window.dispatchEvent(new Event("medha:work_updates_changed"));
  } catch {}
}

function readNotices(): SchoolNotice[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(NOTICES_KEY);
    if (!raw) {
      window.localStorage.setItem(NOTICES_KEY, JSON.stringify(DEFAULT_NOTICES));
      return DEFAULT_NOTICES;
    }
    return JSON.parse(raw) as SchoolNotice[];
  } catch {
    return DEFAULT_NOTICES;
  }
}

function writeNotices(notices: SchoolNotice[]) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(NOTICES_KEY, JSON.stringify(notices));
    window.dispatchEvent(new Event("medha:notices_changed"));
  } catch {}
}

let cachedUpdates: TeacherWorkUpdate[] = [];
let cachedNotices: SchoolNotice[] = [];
let cacheLoaded = false;
const listeners = new Set<() => void>();

function notify() {
  for (const listener of listeners) listener();
}

function subscribe(callback: () => void) {
  listeners.add(callback);
  const onCustom = () => {
    cachedUpdates = readStorage();
    cachedNotices = readNotices();
    callback();
  };
  const onStorage = (e: StorageEvent) => {
    if (e.key === STORAGE_KEY || e.key === NOTICES_KEY) {
      cachedUpdates = readStorage();
      cachedNotices = readNotices();
      callback();
    }
  };
  window.addEventListener("medha:work_updates_changed", onCustom);
  window.addEventListener("medha:notices_changed", onCustom);
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(callback);
    window.removeEventListener("medha:work_updates_changed", onCustom);
    window.removeEventListener("medha:notices_changed", onCustom);
    window.removeEventListener("storage", onStorage);
  };
}

function getSnapshot(): { updates: TeacherWorkUpdate[]; notices: SchoolNotice[] } {
  if (!cacheLoaded && typeof window !== "undefined") {
    cachedUpdates = readStorage();
    cachedNotices = readNotices();
    cacheLoaded = true;
  }
  return { updates: cachedUpdates, notices: cachedNotices };
}

function getServerSnapshot(): { updates: TeacherWorkUpdate[]; notices: SchoolNotice[] } {
  return { updates: [], notices: [] };
}

export function useWorkUpdates() {
  const store = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const { updates, notices } = store;

  const addWorkUpdate = useCallback(
    (payload: Omit<TeacherWorkUpdate, "id" | "created_at">) => {
      const current = readStorage();
      const newEntry: TeacherWorkUpdate = {
        ...payload,
        id: `upd-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        created_at: new Date().toISOString(),
      };
      const updated = [newEntry, ...current];
      cachedUpdates = updated;
      writeStorage(updated);
      notify();
      return newEntry;
    },
    [],
  );

  const acknowledgeUpdate = useCallback(
    (updateId: string, badge: PrincipalFeedback["badge"], note?: string) => {
      const current = readStorage();
      const updated = current.map((u) => {
        if (u.id === updateId) {
          return {
            ...u,
            principal_feedback: {
              acknowledged_at: new Date().toISOString(),
              badge,
              note: note?.trim() || undefined,
            },
          };
        }
        return u;
      });
      cachedUpdates = updated;
      writeStorage(updated);
      notify();
    },
    [],
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
    acknowledgeUpdate,
    addNotice,
    deleteNotice,
    getUpdatesForTeacher,
    getTodayUpdateForTeacher,
  };
}
