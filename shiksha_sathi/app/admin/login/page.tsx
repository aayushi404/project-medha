"use client";

import { useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion } from "motion/react";
import { ArrowRight, Eye, EyeOff, Loader2, ShieldCheck } from "lucide-react";
import { toast } from "sonner";

import { useAuth } from "@/lib/auth-context";

/** Sign-in for Medha administrators. Separate from /login on purpose: admins
 * are never self-registered, so there are no register / claim links here, and
 * the backend only admits admin accounts through this portal (role "admin"). */
export default function AdminLoginPage() {
  const router = useRouter();
  const { status, teacher, login } = useAuth();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // already signed in: admins go to their console, anyone else to their home
  useEffect(() => {
    if (status !== "authenticated" || !teacher) return;
    router.replace(teacher.role === "admin" ? "/admin" : "/home");
  }, [status, teacher, router]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!email.trim() || !password) {
      toast.error("Enter your email and password.");
      return;
    }
    setSubmitting(true);
    try {
      await login(email.trim(), password, "admin");
      // the effect above routes to /admin once the session is established
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not sign in.");
      setSubmitting(false);
    }
  }

  return (
    <main className="mlogin-root">
      <motion.div
        className="mlogin-card"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.38, ease: "easeOut" }}
      >
        <div className="mlogin-heading">
          <div className="mb-2 flex justify-center">
            <span className="flex size-11 items-center justify-center rounded-full bg-terracotta/10 text-terracotta">
              <ShieldCheck className="size-5" />
            </span>
          </div>
          <h1>Admin sign in</h1>
          <p>Medha administration console</p>
        </div>

        <form onSubmit={onSubmit} className="mlogin-form" noValidate>
          <div className="mlogin-field">
            <input
              type="email"
              autoComplete="email"
              placeholder="Admin email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoFocus
            />
          </div>

          <div className="mlogin-field mlogin-field--pass">
            <input
              type={showPass ? "text" : "password"}
              autoComplete="current-password"
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            <button
              type="button"
              className="mlogin-eye"
              onClick={() => setShowPass((v) => !v)}
              tabIndex={-1}
              aria-label={showPass ? "Hide password" : "Show password"}
            >
              {showPass ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>

          <Link href="/forgot-password" className="mlogin-link-muted self-end text-xs">
            Forgot password?
          </Link>

          <button type="submit" disabled={submitting} className="mlogin-submit">
            {submitting ? (
              <>
                <Loader2 size={16} className="animate-spin" /> Signing in…
              </>
            ) : (
              <>
                Sign in <ArrowRight size={16} />
              </>
            )}
          </button>

          <div className="mlogin-register-hint">
            <Link href="/login" className="mlogin-link">
              Student, teacher or principal? Sign in here
            </Link>
          </div>
        </form>
      </motion.div>
    </main>
  );
}
