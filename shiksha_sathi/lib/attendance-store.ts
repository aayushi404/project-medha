"use client";

/**
 * Attendance lives entirely in the browser for now -- one localStorage blob,
 * versioned key, no backend. A tiny external store (module cache + storage
 * events) feeds `useSyncExternalStore`, so reads are hydration-safe without a
 * setState-in-effect. Swap the read/write helpers for API calls later and the
 * components shouldn't need to change much.
 */
import { useCallback, useSyncExternalStore } from "react";

const KEY = "medha.attendance.v1";

export type AttStatus = "present" | "absent" | "late";
export type Student = { id: string; name: string; roll?: string };
export type AttClass = { id: string; name: string; students: Student[] };
export type AttData = {
  classes: AttClass[];
  // classId -> "YYYY-MM-DD" -> studentId -> status
  records: Record<string, Record<string, Record<string, AttStatus>>>;
};

const EMPTY: AttData = { classes: [], records: {} };

function uid() {
  return typeof crypto !== "undefined" && crypto.randomUUID
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export function todayISO(d = new Date()): string {
  const tz = d.getTimezoneOffset() * 60000;
  return new Date(d.getTime() - tz).toISOString().slice(0, 10);
}

export function formatDay(iso: string): string {
  const d = new Date(`${iso}T00:00:00`);
  return d.toLocaleDateString(undefined, {
    weekday: "short",
    day: "numeric",
    month: "short",
  });
}

function read(): AttData {
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return EMPTY;
    const parsed = JSON.parse(raw) as Partial<AttData>;
    return { classes: parsed.classes ?? [], records: parsed.records ?? {} };
  } catch {
    return EMPTY;
  }
}

function write(data: AttData) {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(data));
  } catch {
    /* private mode / quota -- state still works for this session */
  }
}

// -- external store ----------------------------------------------------
let cache: AttData | null = null;
const listeners = new Set<() => void>();

function emit() {
  for (const l of listeners) l();
}

function getSnapshot(): AttData {
  if (typeof window === "undefined") return EMPTY;
  if (cache === null) cache = read();
  return cache;
}

function getServerSnapshot(): AttData {
  return EMPTY;
}

function subscribe(cb: () => void): () => void {
  listeners.add(cb);
  const onStorage = (e: StorageEvent) => {
    if (e.key === KEY) {
      cache = read();
      emit();
    }
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(cb);
    window.removeEventListener("storage", onStorage);
  };
}

function setCache(next: AttData) {
  cache = next;
  write(next);
  emit();
}

// -- derived helpers -------------------------------------------------
export type DaySummary = {
  total: number;
  marked: number;
  present: number;
  absent: number;
  late: number;
  pct: number; // (present + late) share of the class, rounded
};

export function daySummary(
  data: AttData,
  classId: string | null,
  date: string,
): DaySummary {
  const cls = data.classes.find((c) => c.id === classId);
  const total = cls?.students.length ?? 0;
  const day = (classId && data.records[classId]?.[date]) || {};
  let present = 0;
  let absent = 0;
  let late = 0;
  for (const s of cls?.students ?? []) {
    const v = day[s.id];
    if (v === "present") present++;
    else if (v === "absent") absent++;
    else if (v === "late") late++;
  }
  const marked = present + absent + late;
  const pct = total ? Math.round(((present + late) / total) * 100) : 0;
  return { total, marked, present, absent, late, pct };
}

export function datesFor(data: AttData, classId: string | null): string[] {
  if (!classId) return [];
  return Object.keys(data.records[classId] ?? {}).sort((a, b) => b.localeCompare(a));
}

// -- hook -----------------------------------------------------------
export function useAttendance() {
  const data = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const ready = useSyncExternalStore(
    subscribe,
    () => cache !== null,
    () => false,
  );

  const addClass = useCallback(
    (name: string) => {
      const id = uid();
      setCache({
        ...getSnapshot(),
        classes: [...getSnapshot().classes, { id, name: name.trim(), students: [] }],
      });
      return id;
    },
    [],
  );

  const renameClass = useCallback((id: string, name: string) => {
    const d = getSnapshot();
    setCache({
      ...d,
      classes: d.classes.map((c) => (c.id === id ? { ...c, name: name.trim() } : c)),
    });
  }, []);

  const removeClass = useCallback((id: string) => {
    const d = getSnapshot();
    const records = { ...d.records };
    delete records[id];
    setCache({ classes: d.classes.filter((c) => c.id !== id), records });
  }, []);

  const addStudents = useCallback((classId: string, names: string[]) => {
    const clean = names.map((n) => n.trim()).filter(Boolean);
    if (clean.length === 0) return;
    const d = getSnapshot();
    setCache({
      ...d,
      classes: d.classes.map((c) =>
        c.id === classId
          ? { ...c, students: [...c.students, ...clean.map((name) => ({ id: uid(), name }))] }
          : c,
      ),
    });
  }, []);

  const removeStudent = useCallback((classId: string, studentId: string) => {
    const d = getSnapshot();
    const records = { ...d.records };
    if (records[classId]) {
      records[classId] = Object.fromEntries(
        Object.entries(records[classId]).map(([date, marks]) => {
          const rest = { ...marks };
          delete rest[studentId];
          return [date, rest];
        }),
      );
    }
    setCache({
      records,
      classes: d.classes.map((c) =>
        c.id === classId
          ? { ...c, students: c.students.filter((s) => s.id !== studentId) }
          : c,
      ),
    });
  }, []);

  const setMark = useCallback(
    (classId: string, date: string, studentId: string, status: AttStatus) => {
      const d = getSnapshot();
      const forClass = { ...(d.records[classId] ?? {}) };
      const forDay = { ...(forClass[date] ?? {}) };
      if (forDay[studentId] === status) delete forDay[studentId];
      else forDay[studentId] = status;
      forClass[date] = forDay;
      setCache({ ...d, records: { ...d.records, [classId]: forClass } });
    },
    [],
  );

  const markRemaining = useCallback(
    (classId: string, date: string, status: AttStatus) => {
      const d = getSnapshot();
      const cls = d.classes.find((c) => c.id === classId);
      if (!cls) return;
      const forClass = { ...(d.records[classId] ?? {}) };
      const forDay = { ...(forClass[date] ?? {}) };
      for (const s of cls.students) if (!forDay[s.id]) forDay[s.id] = status;
      forClass[date] = forDay;
      setCache({ ...d, records: { ...d.records, [classId]: forClass } });
    },
    [],
  );

  const clearDay = useCallback((classId: string, date: string) => {
    const d = getSnapshot();
    const forClass = { ...(d.records[classId] ?? {}) };
    delete forClass[date];
    setCache({ ...d, records: { ...d.records, [classId]: forClass } });
  }, []);

  return {
    data,
    ready,
    addClass,
    renameClass,
    removeClass,
    addStudents,
    removeStudent,
    setMark,
    markRemaining,
    clearDay,
  };
}
