"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useRef, useState } from "react";
import { Loader2 } from "lucide-react";

import { SimpleAuthCard } from "@/components/auth/simple-auth-card";
import { verifyEmail } from "@/lib/api";

type State = "working" | "ok" | "failed";

function Verify() {
  const token = useSearchParams().get("token") ?? "";
  const [state, setState] = useState<State>(token.length >= 20 ? "working" : "failed");
  const started = useRef(false);

  useEffect(() => {
    // the token is single-use, so guard against React's double-invoked effects
    if (token.length < 20 || started.current) return;
    started.current = true;
    verifyEmail(token)
      .then(() => setState("ok"))
      .catch(() => setState("failed"));
  }, [token]);

  return (
    <SimpleAuthCard title={state === "ok" ? "Email verified" : state === "failed" ? "Link not valid" : "Verifying..."}>
      <div className="mlogin-form">
        {state === "working" && <Loader2 size={20} className="animate-spin mx-auto" />}
        {state === "ok" && (
          <p className="text-sm text-center">
            Thank you. Your email address is confirmed. Once your school approves your account you can log in.
          </p>
        )}
        {state === "failed" && (
          <p className="text-sm text-center">This verification link is invalid or has expired.</p>
        )}
        <Link href="/login" className="mlogin-link text-center">
          Go to log in
        </Link>
      </div>
    </SimpleAuthCard>
  );
}

export default function VerifyEmailPage() {
  return (
    <Suspense fallback={null}>
      <Verify />
    </Suspense>
  );
}
