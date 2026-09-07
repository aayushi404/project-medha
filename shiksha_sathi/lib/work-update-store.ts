"use client";

import { useCallback, useSyncExternalStore } from "react";

const STORAGE_KEY = "medha.teacher_work_updates.v1";

export type AiHelpfulnessRating = "very_helpful" | "somewhat_helpful" | "neutral" | "not_needed";

export type QuickWorkActivity =
  | "taught_chapter"
  | "conducted_quiz"
  | "hands_on_activity"
  | "cleared_doubts"
  | "homework_given"
  | "revision_done"
  | "used_ai_slides";

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

let cachedUpdates: TeacherWorkUpdate[] = [];
let cacheLoaded = false;
const listeners = new Set<() => void>();

function notify() {
  for (const listener of listeners) listener();
}

function subscribe(callback: () => void) {
  listeners.add(callback);
  const onCustom = () => {
    cachedUpdates = readStorage();
    callback();
  };
  const onStorage = (e: StorageEvent) => {
    if (e.key === STORAGE_KEY) {
      cachedUpdates = readStorage();
      callback();
    }
  };
  window.addEventListener("medha:work_updates_changed", onCustom);
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(callback);
    window.removeEventListener("medha:work_updates_changed", onCustom);
    window.removeEventListener("storage", onStorage);
  };
}

function getSnapshot(): TeacherWorkUpdate[] {
  if (!cacheLoaded && typeof window !== "undefined") {
    cachedUpdates = readStorage();
    cacheLoaded = true;
  }
  return cachedUpdates;
}

function getServerSnapshot(): TeacherWorkUpdate[] {
  return [];
}

export function useWorkUpdates() {
  const updates = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

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
    addWorkUpdate,
    getUpdatesForTeacher,
    getTodayUpdateForTeacher,
  };
}
