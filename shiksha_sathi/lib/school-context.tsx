"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

import { getSchoolCard, type SchoolCard } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";

type SchoolState = {
  /** null while loading, or when the account has no school (e.g. an admin) */
  school: SchoolCard | null;
  loading: boolean;
  /** re-fetch after a change, so every shell shows the new name, logo or year */
  reload: () => void;
};

const SchoolContext = createContext<SchoolState | null>(null);

/** One fetch of the school card per signed-in shell. Mount it in each layout
 * that shows the card (teacher, student, principal) so they all stay in step. */
export function SchoolProvider({ children }: { children: ReactNode }) {
  const { accessToken } = useAuth();
  const [school, setSchool] = useState<SchoolCard | null>(null);
  const [loading, setLoading] = useState(true);
  // bumped by reload() to fetch again
  const [version, setVersion] = useState(0);

  useEffect(() => {
    if (!accessToken) return;
    let cancelled = false;
    getSchoolCard(accessToken)
      .then((card) => {
        if (!cancelled) setSchool(card);
      })
      .catch(() => {
        if (!cancelled) setSchool(null);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [accessToken, version]);

  const reload = useCallback(() => setVersion((v) => v + 1), []);
  const value = useMemo(
    () => ({ school: accessToken ? school : null, loading: accessToken ? loading : false, reload }),
    [accessToken, school, loading, reload],
  );
  return <SchoolContext.Provider value={value}>{children}</SchoolContext.Provider>;
}

export function useSchool(): SchoolState {
  const ctx = useContext(SchoolContext);
  if (!ctx) throw new Error("useSchool must be used inside <SchoolProvider>");
  return ctx;
}
