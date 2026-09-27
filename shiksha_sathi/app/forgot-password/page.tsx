"use client";

import Link from "next/link";
import { useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

import { SimpleAuthCard } from "@/components/auth/simple-auth-card";
import { forgotPassword } from "@/lib/api";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    try {
      await forgotPassword(email.trim().toLowerCase());
      setSent(true);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not send the email. Try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <SimpleAuthCard title="Forgot your password?" subtitle="We'll email you a link to choose a new one.">
      {sent ? (
        <div className="mlogin-form">
          <p className="text-sm text-center">
            If that email is registered, a reset link is on its way. It works once and expires in 30 minutes.
          </p>
          <Link href="/login" className="mlogin-link text-center">
            Back to log in
          </Link>
        </div>
      ) : (
        <form onSubmit={submit} className="mlogin-form">
          <div className="mlogin-field">
            <input
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Your email"
              maxLength={254}
              required
              autoFocus
            />
          </div>
          <button type="submit" disabled={busy || email.trim().length < 5} className="mlogin-submit">
            {busy ? <Loader2 size={16} className="animate-spin" /> : "Send reset link"}
          </button>
          <Link href="/login" className="mlogin-link text-center">
            Back to log in
          </Link>
        </form>
      )}
    </SimpleAuthCard>
  );
}
