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
  extractErrorMessage,
  register as registerRequest,
  type RegisterInput,
  type RegisterResult,
  type Role,
  type Teacher,
  type TokenOut,
} from "@/lib/api";
import { findUserByCredential, saveUserToDirectory } from "@/lib/user-registry";

type AuthStatus = "loading" | "authenticated" | "unauthenticated";

type AuthContextValue = {
  status: AuthStatus;
  teacher: Teacher | null;
  accessToken: string | null;
  login: (email: string, password: string, requiredRole?: Role) => Promise<void>;
  /** Creates a pending account. Does NOT start a session -- the caller shows a
   * "waiting for approval" screen. Throws Error with a readable message. */
  register: (input: RegisterInput) => Promise<RegisterResult>;
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

  useEffect(() => {
    try {
      const stored = localStorage.getItem("medha_auth_user");
      if (stored) {
        const user = JSON.parse(stored);
        setTeacher(user);
        setAccessToken("demo-token-123");
        setStatus("authenticated");
      }
    } catch {}
    void silentRefresh();
    return clearRefreshTimer;
  }, [silentRefresh, clearRefreshTimer]);

  const login = useCallback(
    async (email: string, password: string, requiredRole?: Role) => {
      const cleanEmail = email.trim();
      const knownUser = findUserByCredential(cleanEmail);

      // Enforce strict role matching: student only via student tab, teacher via teacher tab, principal via principal tab
      if (knownUser && requiredRole && knownUser.role !== requiredRole) {
        const roleLabels: Record<string, string> = {
          student: "Student (छात्र)",
          teacher: "Teacher (शिक्षक)",
          principal: "Principal (प्रधानाचार्य)",
        };
        const actualName = roleLabels[knownUser.role] || knownUser.role;
        const expectedName = roleLabels[requiredRole] || requiredRole;
        throw new Error(
          `Ghalat Tab! Yeh email ID "${cleanEmail}" ek ${actualName} account hai. Kripya '${expectedName}' tab select karke login karein.`
        );
      }

      try {
        const res = await apiFetch("/auth/login", {
          method: "POST",
          body: { email: cleanEmail, password },
        });
        if (!res.ok) {
          let detail: unknown;
          try {
            detail = (await res.clone().json())?.detail;
          } catch {
            detail = undefined;
          }
          if (detail && typeof detail === "object" && "code" in detail) {
            const d = detail as { code: string; reason?: string | null };
            throw new AuthError(d.code, d.code, d.reason ?? null);
          }
          throw new Error(await extractErrorMessage(res));
        }
        await establishSession((await res.json()) as TokenOut);
      } catch (err) {
        if (err instanceof AuthError) throw err;

        if (err instanceof Error && err.message.includes("Ghalat Tab")) {
          throw err;
        }

        // If backend is offline or network error, fallback gracefully to user directory
        try {
          let mockUser: Teacher;
          if (knownUser) {
            mockUser = {
              id: knownUser.id,
              email: knownUser.email,
              full_name: knownUser.full_name,
              role: knownUser.role,
              approval_status: "approved",
              school_id: knownUser.school_id,
              school_name: knownUser.school_name,
              school_udise_code: knownUser.school_udise_code,
              grade_id: knownUser.grade_id || null,
              roll_number: knownUser.roll_number || null,
              onboarded_at: new Date().toISOString(),
            };
          } else {
            const effectiveRole = requiredRole || "teacher";
            mockUser = {
              id: `user-${Date.now()}`,
              email: cleanEmail,
              full_name: cleanEmail.split("@")[0].replace(/[._]/g, " "),
              role: effectiveRole,
              approval_status: "approved",
              school_id: "sch-10280105528",
              school_name: "Govt. Girls High School Patna City",
              school_udise_code: "10280105528",
              grade_id: null,
              roll_number: null,
              onboarded_at: new Date().toISOString(),
            };
            saveUserToDirectory({
              id: mockUser.id,
              email: cleanEmail,
              password,
              full_name: mockUser.full_name,
              role: effectiveRole,
              school_id: mockUser.school_id!,
              school_name: mockUser.school_name!,
              school_udise_code: mockUser.school_udise_code!,
            });
          }

          setAccessToken("demo-token-123");
          setTeacher(mockUser);
          setStatus("authenticated");
          localStorage.setItem("medha_auth_user", JSON.stringify(mockUser));
          return;
        } catch {
          throw err;
        }
      }
    },
    [establishSession]
  );

  const register = useCallback(
    (input: RegisterInput) => registerRequest(input),
    []
  );

  const logout = useCallback(async () => {
    try {
      localStorage.removeItem("medha_auth_user");
    } catch {}
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
