"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "motion/react";
import { Check, Eye, EyeOff, Loader2, ArrowRight, GraduationCap, Users, School } from "lucide-react";
import { toast } from "sonner";

import { AuthError } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { useCopy } from "@/lib/copy";
import { PendingScreen } from "@/components/auth/pending-screen";

type View = "form" | "pending" | "rejected";
type RoleTab = "student" | "principal" | "teacher";

const ROLE_TABS: { id: RoleTab; label: string; placeholder: string }[] = [
  { id: "student",   label: "Student",   placeholder: "Student Email or Roll Number" },
  { id: "teacher",   label: "Teacher",   placeholder: "Teacher Official Email" },
  { id: "principal", label: "Principal", placeholder: "Principal Official Email" },
];

export default function LoginPage() {
  const copy   = useCopy();
  const router = useRouter();
  const { status, teacher, login } = useAuth();

  const [activeRole, setActiveRole]       = useState<RoleTab>("student");
  const [email, setEmail]                 = useState("");
  const [password, setPassword]           = useState("");
  const [showPass, setShowPass]           = useState(false);
  const [submitting, setSubmitting]       = useState(false);
  const [view, setView]                   = useState<View>("form");
  const [rejectionReason, setRejectionReason] = useState<string | null>(null);
  const [cameFromForm, setCameFromForm]   = useState(false);

  /* redirect once authenticated */
  useEffect(() => {
    if (status !== "authenticated") return;
    const delay = cameFromForm ? 1200 : 0;
    const t = setTimeout(() => router.replace("/home"), delay);
    return () => clearTimeout(t);
  }, [status, cameFromForm, router]);

  /* reset form on tab switch */
  useEffect(() => {
    setEmail("");
    setPassword("");
    setShowPass(false);
    setView("form");
  }, [activeRole]);

  const canSubmit = email.trim().length > 2 && password.length >= 1 && !submitting;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;
    setCameFromForm(true);
    setSubmitting(true);
    try {
      await login(email.trim(), password, activeRole);
    } catch (err) {
      setCameFromForm(false);
      if (err instanceof AuthError && err.code === "PENDING_APPROVAL") {
        setView("pending");
      } else if (err instanceof AuthError && err.code === "REGISTRATION_REJECTED") {
        setRejectionReason(err.reason);
        setView("rejected");
      } else {
        toast.error(err instanceof Error ? err.message : copy.login.couldNotLogIn);
      }
      setSubmitting(false);
    }
  }

  const signedIn  = status === "authenticated" && cameFromForm;
  const firstName = teacher?.full_name?.trim().split(/\s+/)[0] ?? "";
  const activeTab = ROLE_TABS.find(r => r.id === activeRole)!;

  return (
    <div className="mlogin-root">
      {/* ─── Card ─── */}
      <motion.div
        className="mlogin-card"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y:  0 }}
        transition={{ duration: 0.38, ease: "easeOut" }}
      >
        {/* Role tabs */}
        <div className="mlogin-tabs">
          {ROLE_TABS.map(tab => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveRole(tab.id)}
              className={`mlogin-tab${activeRole === tab.id ? " mlogin-tab--active" : ""}`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Heading */}
        <div className="mlogin-heading">
          <h1>Welcome back</h1>
          <p>Sign in to your MEDHA account</p>
        </div>

        {/* Content */}
        <AnimatePresence mode="wait">

          {/* ── Signed-in confirmation ── */}
          {signedIn && (
            <motion.div key="ok" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mlogin-success">
              <div className="mlogin-success-icon"><Check size={24} /></div>
              <strong>{firstName ? copy.login.welcomeBack(firstName) : copy.login.signedIn}</strong>
              <span>{copy.login.signedInAsPre} <b>{teacher?.role}</b> {copy.login.signedInAsPost}</span>
              <div className="mlogin-redirecting">
                <Loader2 size={13} className="animate-spin" /> {copy.login.takingYou}
              </div>
            </motion.div>
          )}

          {/* ── Pending ── */}
          {!signedIn && view === "pending" && (
            <motion.div key="pending" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
              <PendingScreen message={copy.login.pendingMessage} />
            </motion.div>
          )}

          {/* ── Rejected ── */}
          {!signedIn && view === "rejected" && (
            <motion.div key="rejected" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mlogin-rejected">
              <strong>{copy.login.rejectedTitle}</strong>
              <p>{rejectionReason ? copy.login.rejectedReason(rejectionReason) : copy.login.rejectedFallback}</p>
              <Link href="/register" className="mlogin-link">{copy.login.registerAgain}</Link>
              <button type="button" className="mlogin-link-muted" onClick={() => setView("form")}>
                {copy.login.backToLogin}
              </button>
            </motion.div>
          )}

          {/* ── Login Form ── */}
          {!signedIn && view === "form" && (
            <motion.form
              key={activeRole}
              onSubmit={handleSubmit}
              className="mlogin-form"
              initial={{ opacity: 0, x: 10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -10 }}
              transition={{ duration: 0.18 }}
            >
              {/* ID / Email */}
              <div className="mlogin-field">
                <input
                  type={activeRole === "student" ? "text" : "email"}
                  autoComplete="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder={activeTab.placeholder}
                  autoFocus
                />
              </div>

              {/* Password */}
              <div className="mlogin-field mlogin-field--pass">
                <input
                  type={showPass ? "text" : "password"}
                  autoComplete="current-password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="Password"
                />
                <button
                  type="button"
                  className="mlogin-eye"
                  onClick={() => setShowPass(v => !v)}
                  tabIndex={-1}
                >
                  {showPass ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>

              {/* Forgot */}
              <div className="mlogin-forgot-row">
                <button type="button" className="mlogin-forgot">Forget Password ?</button>
              </div>

              {/* Submit */}
              <button type="submit" disabled={!canSubmit} className="mlogin-submit">
                {submitting
                  ? <><Loader2 size={16} className="animate-spin" /> Signing in…</>
                  : <>Sign in <ArrowRight size={16} /></>
                }
              </button>

              {/* Register link */}
              <p className="mlogin-register-hint">
                Don&apos;t have an account?{" "}
                <Link href="/register" className="mlogin-link">Register</Link>
              </p>
            </motion.form>
          )}

        </AnimatePresence>
      </motion.div>
    </div>
  );
}
