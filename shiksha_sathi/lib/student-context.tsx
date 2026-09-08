"use client";

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

import { getGrades, getSubjects, type Subject } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";

type StudentDataValue = {
  /** the student's class id, from their account */
  gradeId: string | null;
  gradeLabel: string | null;
  firstName: string;
  subjects: Subject[];
  loading: boolean;
};

const StudentDataContext = createContext<StudentDataValue | null>(null);

/**
 * Frontend-only shared data for the student section: the student's class label
 * and the subject list. Fetched once so Practice / Notes / Library / Ask Medha
 * don't each re-request them.
 */
export function StudentDataProvider({ children }: { children: ReactNode }) {
  const { teacher } = useAuth();
  const gradeId = teacher?.grade_id ?? null;
  const firstName = teacher?.full_name?.trim().split(/\s+/)[0] ?? "";

  const [gradeLabel, setGradeLabel] = useState<string | null>(null);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [loading, setLoading] = useState(true);

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

  const value = useMemo<StudentDataValue>(
    () => ({ gradeId, gradeLabel, firstName, subjects, loading }),
    [gradeId, gradeLabel, firstName, subjects, loading],
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
