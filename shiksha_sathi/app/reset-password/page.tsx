"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

import { SimpleAuthCard } from "@/components/auth/simple-auth-card";
import { resetPassword } from "@/lib/api";
import { passwordProblem } from "@/lib/password-policy";

function ResetForm() {
  const token = useSearchParams().get("token") ?? "";
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  const problem = password ? passwordProblem(password) : null;
  const mismatch = confirm.length > 0 && confirm !== password;
  const canSubmit = token.length >= 20 && password.length > 0 && !problem && confirm === password && !busy;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;
    setBusy(true);
    try {
      await resetPassword(token, password);
      setDone(true);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not reset the password.");
    } finally {
      setBusy(false);
    }
  }

  if (token.length < 20) {
    return (
      <SimpleAuthCard title="Link not valid" subtitle="This password reset link is incomplete.">
        <Link href="/forgot-password" className="mlogin-link text-center">
          Request a new link
        </Link>
      </SimpleAuthCard>
    );
  }

  return (
    <SimpleAuthCard title="Choose a new password">
      {done ? (
        <div className="mlogin-form">
          <p className="text-sm text-center">Your password has been changed. You can now log in.</p>
          <Link href="/login" className="mlogin-submit text-center">
            Go to log in
          </Link>
        </div>
      ) : (
        <form onSubmit={submit} className="mlogin-form">
          <div className="mlogin-field">
            <input
              type="password"
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="New password"
              maxLength={128}
              autoFocus
            />
          </div>
          {problem && <p className="text-xs text-destructive">{problem}</p>}
          <div className="mlogin-field">
            <input
              type="password"
              autoComplete="new-password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              placeholder="Repeat new password"
              maxLength={128}
            />
          </div>
          {mismatch && <p className="text-xs text-destructive">Passwords don&apos;t match.</p>}
          <button type="submit" disabled={!canSubmit} className="mlogin-submit">
            {busy ? <Loader2 size={16} className="animate-spin" /> : "Change password"}
          </button>
        </form>
      )}
    </SimpleAuthCard>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={null}>
      <ResetForm />
    </Suspense>
  );
}
