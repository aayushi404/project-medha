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

import {
  AuthError,
  apiFetch,
  setTokenRefresher,
  extractErrorMessage,
  register as registerRequest,
  type CurrentUser,
  type LoginRole,
  type RegisterInput,
  type RegisterResult,
  type Role,
  type TokenOut,
} from "@/lib/api";
import { claimUserData, clearUserData } from "@/lib/user-data";

type AuthStatus = "loading" | "authenticated" | "unauthenticated";

type AuthContextValue = {
  status: AuthStatus;
  /** The logged-in user -- a `teachers` row (admin/principal/teacher) or a
   * `students` row. Named `teacher` for historical reasons/minimal diff
   * across consumers; narrow on `.role` to access student-only fields
   * (grade_id, roll_number). */
  teacher: CurrentUser | null;
  accessToken: string | null;
  /** `role` is the tab picked on the login screen -- the backend looks the
   * email up in the matching table (teachers vs students), so a teacher's
   * credentials can't be used to sign in via the Student tab. */
  login: (email: string, password: string, role: LoginRole) => Promise<void>;
  /** Creates a pending account. Does NOT start a session -- the caller shows a
   * "waiting for approval" screen. Throws Error with a readable message. */
  register: (input: RegisterInput) => Promise<RegisterResult>;
  logout: () => Promise<void>;
  /** Updates the current user in context (e.g. after onboarding completes) without a refetch/reload. */
  updateTeacher: (teacher: CurrentUser) => void;
};

const AuthContext = createContext<AuthContextValue | null>(null);

// Access tokens are short-lived (15 min server-side); refresh a couple of
// minutes early so a teacher mid-conversation never hits a surprise 401.
const REFRESH_MARGIN_MS = 2 * 60 * 1000;

// When a refresh fails for a reason other than "your session is invalid"
// (offline, a phone waking from sleep, or the Render free-tier backend taking
// 30-60 s to spin up), retry instead of logging the user out. ~60 s total.
const REFRESH_RETRY_DELAYS_MS = [1_000, 2_000, 4_000, 8_000, 15_000, 30_000];

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

class SessionRejected extends Error {}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<AuthStatus>("loading");
  const [teacher, setTeacher] = useState<CurrentUser | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const refreshTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // When the current access token expires (epoch ms). Background tabs and a
  // backgrounded Android app pause timers, so on returning to the app we
  // compare against this instead of trusting the timer to have fired.
  const accessExpiresAt = useRef(0);
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
  // Bumped whenever the session is deliberately ended or replaced. A refresh or
  // login that started before that must not resurrect a logged-out session
  // when it eventually resolves.
  const generation = useRef(0);
  const accessTokenRef = useRef<string | null>(null);

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
      const started = generation.current;
      const meRes = await apiFetch("/auth/me", { token: tokens.access_token });
      if (meRes.status === 401 || meRes.status === 403) throw new SessionRejected();
      if (!meRes.ok) throw new Error("Could not load your profile.");
      const me = (await meRes.json()) as CurrentUser;
      if (started !== generation.current) return; // logged out / replaced meanwhile

      claimUserData(me.id);
      accessTokenRef.current = tokens.access_token;
      accessExpiresAt.current = Date.now() + tokens.expires_in * 1000;
      setAccessToken(tokens.access_token);
      setTeacher(me);
      setStatus("authenticated");
      scheduleRefresh(tokens.expires_in);
    },
    [scheduleRefresh]
  );

  const clearSession = useCallback(() => {
    generation.current += 1;
    clearRefreshTimer();
    accessTokenRef.current = null;
    clearUserData(); // nothing from this user may linger on a shared school computer
    setAccessToken(null);
    setTeacher(null);
    setStatus("unauthenticated");
  }, [clearRefreshTimer]);

  const silentRefresh = useCallback((): Promise<void> => {
    if (inFlightRefresh.current) return inFlightRefresh.current;

    const run = async () => {
      try {
        for (let attempt = 0; ; attempt++) {
          try {
            const res = await apiFetch("/auth/refresh", { method: "POST" });
            // 401/403: no cookie, or the session was revoked/expired -- the
            // only case where signing in again is genuinely required.
            if (res.status === 401 || res.status === 403) throw new SessionRejected();
            if (res.ok) {
              await establishSession((await res.json()) as TokenOut);
              return;
            }
            // 5xx (e.g. backend still waking up): fall through and retry.
          } catch (err) {
            if (err instanceof SessionRejected) {
              clearSession();
              return;
            }
            // Network error: fall through and retry.
          }
          if (attempt >= REFRESH_RETRY_DELAYS_MS.length) {
            clearSession();
            return;
          }
          await sleep(REFRESH_RETRY_DELAYS_MS[attempt]);
        }
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

  // Coming back to the app (switching back from another app, unlocking the
  // phone): timers were paused while hidden, so the access token may already
  // be stale. Refresh right away rather than letting the next API call 401.
  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState !== "visible") return;
      if (status !== "authenticated") return;
      if (Date.now() >= accessExpiresAt.current - REFRESH_MARGIN_MS) void silentRefresh();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [status, silentRefresh]);

  const login = useCallback(
    async (email: string, password: string, role: LoginRole) => {
      const res = await apiFetch("/auth/login", {
        method: "POST",
        body: { email, password, role },
      });
      if (!res.ok) {
        // The backend answers a not-yet-approved account, or a login attempt
        // on the wrong tab, with a structured body: { detail: { code, ... } }.
        // Surface it as an AuthError so the login screen can show a friendly
        // waiting/rejected/wrong-tab view instead of a red toast.
        let detail: unknown;
        try {
          detail = (await res.clone().json())?.detail;
        } catch {
          detail = undefined;
        }
        if (detail && typeof detail === "object" && "code" in detail) {
          const d = detail as {
            code: string;
            reason?: string | null;
            actual_role?: Role | null;
          };
          throw new AuthError(d.code, d.code, d.reason ?? null, d.actual_role ?? null);
        }
        throw new Error(await extractErrorMessage(res));
      }
      await establishSession((await res.json()) as TokenOut);
    },
    [establishSession]
  );

  const register = useCallback(
    (input: RegisterInput) => registerRequest(input),
    []
  );

  const logout = useCallback(async () => {
    // end the local session first so nothing in flight can revive it, then tell the server
    clearSession();
    await apiFetch("/auth/logout", { method: "POST" }).catch(() => {});
  }, [clearSession]);

  // let apiFetch recover from an expired access token with one refresh + retry
  useEffect(() => {
    setTokenRefresher(async () => {
      await silentRefresh();
      return accessTokenRef.current;
    });
    return () => setTokenRefresher(null);
  }, [silentRefresh]);

  return (
    <AuthContext.Provider
      value={{
        status,
        teacher,
        accessToken,
        login,
        register,
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
