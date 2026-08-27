"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";

import { apiFetch, extractErrorMessage, type Teacher, type TokenOut } from "@/lib/api";

type AuthStatus = "loading" | "authenticated" | "unauthenticated";

type AuthContextValue = {
  status: AuthStatus;
  teacher: Teacher | null;
  accessToken: string | null;
  login: (email: string, password: string) => Promise<void>;
  signup: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  /** Updates the teacher in context (e.g. after onboarding completes) without a refetch/reload. */
  updateTeacher: (teacher: Teacher) => void;
};

const AuthContext = createContext<AuthContextValue | null>(null);

// Access tokens are short-lived (15 min server-side); refresh a couple of
// minutes early so a teacher mid-conversation never hits a surprise 401.
const REFRESH_MARGIN_MS = 2 * 60 * 1000;

export function AuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<AuthStatus>("loading");
  const [teacher, setTeacher] = useState<Teacher | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const refreshTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Indirection to let scheduleRefresh call silentRefresh without a forward
  // reference (silentRefresh is declared later and itself depends on
  // scheduleRefresh) -- kept in sync by the effect below.
  const silentRefreshRef = useRef<() => void>(() => {});
  // De-dupes concurrent callers into a single in-flight request. Refresh
  // tokens rotate on every call (old one revoked, new one issued), so two
  // genuinely concurrent calls -- e.g. React Strict Mode's dev-only double
  // mount -- would otherwise race: the loser reuses the now-revoked token
  // and gets a 401, which would incorrectly clear a session the winner just
  // established.
  const inFlightRefresh = useRef<Promise<void> | null>(null);

  const clearRefreshTimer = useCallback(() => {
    if (refreshTimer.current) {
      clearTimeout(refreshTimer.current);
      refreshTimer.current = null;
    }
  }, []);

  const scheduleRefresh = useCallback(
    (expiresInSeconds: number) => {
      clearRefreshTimer();
      const delay = Math.max(expiresInSeconds * 1000 - REFRESH_MARGIN_MS, 5_000);
      refreshTimer.current = setTimeout(() => {
        silentRefreshRef.current();
      }, delay);
    },
    [clearRefreshTimer]
  );

  const establishSession = useCallback(
    async (tokens: TokenOut) => {
      const meRes = await apiFetch("/auth/me", { token: tokens.access_token });
      if (!meRes.ok) throw new Error("Could not load your profile.");
      const me = (await meRes.json()) as Teacher;

      setAccessToken(tokens.access_token);
      setTeacher(me);
      setStatus("authenticated");
      scheduleRefresh(tokens.expires_in);
    },
    [scheduleRefresh]
  );

  const clearSession = useCallback(() => {
    clearRefreshTimer();
    setAccessToken(null);
    setTeacher(null);
    setStatus("unauthenticated");
  }, [clearRefreshTimer]);

  const silentRefresh = useCallback((): Promise<void> => {
    if (inFlightRefresh.current) return inFlightRefresh.current;

    const run = async () => {
      try {
        const res = await apiFetch("/auth/refresh", { method: "POST" });
        if (!res.ok) {
          clearSession();
          return;
        }
        await establishSession((await res.json()) as TokenOut);
      } catch {
        clearSession();
      } finally {
        inFlightRefresh.current = null;
      }
    };

    const promise = run();
    inFlightRefresh.current = promise;
    return promise;
  }, [clearSession, establishSession]);

  useEffect(() => {
    silentRefreshRef.current = () => void silentRefresh();
  }, [silentRefresh]);

  // On app load, try to silently restore a session from the httpOnly refresh
  // cookie -- no user interaction required. This is the documented
  // fetch-on-mount pattern (react.dev/learn/synchronizing-with-effects
  // #fetching-data); silentRefresh's in-flight de-dupe makes this safe
  // against Strict Mode's dev-only double-invoke of this effect.
  useEffect(() => {
    void silentRefresh();
    return clearRefreshTimer;
  }, [silentRefresh, clearRefreshTimer]);

  const authenticate = useCallback(
    async (path: "/auth/login" | "/auth/signup", email: string, password: string) => {
      const res = await apiFetch(path, {
        method: "POST",
        body: { email, password },
      });
      if (!res.ok) throw new Error(await extractErrorMessage(res));
      await establishSession((await res.json()) as TokenOut);
    },
    [establishSession]
  );

  const login = useCallback(
    (email: string, password: string) => authenticate("/auth/login", email, password),
    [authenticate]
  );

  const signup = useCallback(
    (email: string, password: string) => authenticate("/auth/signup", email, password),
    [authenticate]
  );

  const logout = useCallback(async () => {
    await apiFetch("/auth/logout", { method: "POST" }).catch(() => {});
    clearSession();
  }, [clearSession]);

  return (
    <AuthContext.Provider
      value={{
        status,
        teacher,
        accessToken,
        login,
        signup,
        logout,
        updateTeacher: setTeacher,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within an AuthProvider");
  return ctx;
}
