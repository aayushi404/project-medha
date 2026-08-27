"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

import { getProfile, type Profile } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";

type ProfileContextValue = {
  profile: Profile | null;
  loading: boolean;
  refresh: () => void;
};

const ProfileContext = createContext<ProfileContextValue | null>(null);

/**
 * Fetches `/profile` once per session and shares it. Both app screens need the
 * teacher's subject/grade pairs and identity; one call, read via useProfile().
 */
export function ProfileProvider({ children }: { children: ReactNode }) {
  const { accessToken, status } = useAuth();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (status !== "authenticated" || !accessToken) return;
    let cancelled = false;
    getProfile(accessToken)
      .then((p) => {
        if (!cancelled) setProfile(p);
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [accessToken, status, tick]);

  return (
    <ProfileContext.Provider value={{ profile, loading, refresh: () => setTick((t) => t + 1) }}>
      {children}
    </ProfileContext.Provider>
  );
}

export function useProfile(): ProfileContextValue {
  const ctx = useContext(ProfileContext);
  if (!ctx) throw new Error("useProfile must be used within a ProfileProvider");
  return ctx;
}
