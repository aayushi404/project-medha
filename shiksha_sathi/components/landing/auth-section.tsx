"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight } from "lucide-react";
import { toast } from "sonner";

import { useAuth } from "@/lib/auth-context";
import { cn } from "@/lib/utils";
import { Reveal } from "./reveal";

type Mode = "signup" | "login";

export function AuthSection() {
  const router = useRouter();
  const { status, login, signup } = useAuth();

  const [mode, setMode] = useState<Mode>("signup");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const isSignup = mode === "signup";
  const canSubmit =
    email.trim().length > 3 && password.length >= (isSignup ? 8 : 1) && !submitting;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;
    setSubmitting(true);
    try {
      await (isSignup ? signup : login)(email.trim(), password);
      router.push("/home");
    } catch (err) {
      toast.error(
        err instanceof Error
          ? err.message
          : isSignup
            ? "Could not create the account."
            : "Could not log in.",
      );
      setSubmitting(false);
    }
  }

  return (
    <section
      id="get-started"
      className="sun-wash grain scroll-mt-20 border-t border-border px-6 py-28 sm:px-8 md:py-40"
    >
      <div className="mx-auto grid w-full max-w-6xl items-center gap-14 md:grid-cols-2 md:gap-20">
        <Reveal>
          <p className="eyebrow text-muted-foreground">Get started</p>
          <h2 className="display mt-6 text-[clamp(2.25rem,5vw,3.75rem)]">
            Every classroom holds possibility.
          </h2>
          <p className="mt-8 max-w-md text-lg leading-relaxed text-muted-foreground">
            Create a free account to start building lessons with Medha, or sign in to pick up where
            you left off.
          </p>
        </Reveal>

        <Reveal delay={100}>
          {status === "authenticated" ? (
            <div className="warm-frame p-8 text-center sm:p-10">
              <p className="text-base leading-relaxed text-foreground">
                You&apos;re already signed in.
              </p>
              <Link
                href="/home"
                className="mt-6 inline-flex items-center gap-2 bg-foreground px-8 py-4 text-sm font-medium tracking-wide text-background transition-opacity hover:opacity-90"
              >
                Go to your dashboard
                <ArrowRight className="size-4" />
              </Link>
            </div>
          ) : (
            <div className="warm-frame p-6 sm:p-10">
              <div className="grid grid-cols-2 border border-border text-sm">
                {(["signup", "login"] as Mode[]).map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => setMode(m)}
                    className={cn(
                      "py-3 font-medium tracking-wide transition-colors",
                      mode === m
                        ? "bg-foreground text-background"
                        : "text-muted-foreground hover:text-foreground",
                    )}
                  >
                    {m === "signup" ? "Create account" : "Log in"}
                  </button>
                ))}
              </div>

              <form onSubmit={handleSubmit} className="mt-6 flex flex-col gap-4">
                <label className="flex flex-col gap-2">
                  <span className="eyebrow text-muted-foreground">Email</span>
                  <input
                    type="email"
                    autoComplete="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@example.com"
                    className="w-full border border-border bg-background px-4 py-3 text-base text-foreground outline-none transition-colors placeholder:text-muted-foreground/70 focus:border-foreground"
                  />
                </label>
                <label className="flex flex-col gap-2">
                  <span className="eyebrow text-muted-foreground">Password</span>
                  <input
                    type="password"
                    autoComplete={isSignup ? "new-password" : "current-password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder={isSignup ? "At least 8 characters" : "Your password"}
                    className="w-full border border-border bg-background px-4 py-3 text-base text-foreground outline-none transition-colors placeholder:text-muted-foreground/70 focus:border-foreground"
                  />
                </label>
                <button
                  type="submit"
                  disabled={!canSubmit}
                  className="mt-1 inline-flex items-center justify-center gap-2 bg-foreground px-8 py-4 text-sm font-medium tracking-wide text-background transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {submitting
                    ? isSignup
                      ? "Creating account…"
                      : "Logging in…"
                    : isSignup
                      ? "Create account"
                      : "Log in"}
                  {!submitting && <ArrowRight className="size-4" />}
                </button>
              </form>

              <p className="mt-4 text-center text-xs text-muted-foreground">
                {isSignup ? "Already have an account? " : "New to Medha? "}
                <button
                  type="button"
                  onClick={() => setMode(isSignup ? "login" : "signup")}
                  className="text-terracotta underline-offset-2 hover:underline"
                >
                  {isSignup ? "Log in" : "Create an account"}
                </button>
              </p>
            </div>
          )}
        </Reveal>
      </div>
    </section>
  );
}
