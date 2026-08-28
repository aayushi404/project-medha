"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "motion/react";
import { toast } from "sonner";

import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

type Mode = "login" | "signup";

export default function LoginPage() {
  const router = useRouter();
  const { status, login, signup } = useAuth();

  const [mode, setMode] = useState<Mode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (status === "authenticated") router.replace("/home");
  }, [status, router]);

  const isSignup = mode === "signup";
  const canSubmit =
    email.trim().length > 3 && password.length >= (isSignup ? 8 : 1) && !submitting;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;
    setSubmitting(true);
    try {
      await (isSignup ? signup : login)(email.trim(), password);
      // navigation handled by the `status` effect once the session is set
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
    <main className="flex flex-1 flex-col items-center justify-center bg-gradient-to-b from-accent/50 to-background px-4 py-12">
      <div className="w-full max-w-sm">
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, ease: "easeOut" }}
          className="mb-8 flex flex-col items-center gap-1 text-center"
        >
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">Medha</h1>
          <p className="text-sm text-muted-foreground">Your AI teaching companion</p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.1, ease: "easeOut" }}
        >
          <Card className="shadow-sm">
            <CardContent className="px-6 py-5">
              <div className="mb-5 grid grid-cols-2 rounded-lg border border-border p-0.5 text-sm">
                {(["login", "signup"] as Mode[]).map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => setMode(m)}
                    className={cn(
                      "rounded-md py-1.5 font-medium transition-colors",
                      mode === m
                        ? "bg-accent text-accent-foreground"
                        : "text-muted-foreground hover:text-foreground",
                    )}
                  >
                    {m === "login" ? "Log in" : "Sign up"}
                  </button>
                ))}
              </div>

              <form onSubmit={handleSubmit} className="flex flex-col gap-4">
                <div className="flex flex-col gap-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    autoComplete="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@example.com"
                    className="h-11 text-base"
                    autoFocus
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <Label htmlFor="password">Password</Label>
                  <Input
                    id="password"
                    type="password"
                    autoComplete={isSignup ? "new-password" : "current-password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder={isSignup ? "At least 8 characters" : "Your password"}
                    className="h-11 text-base"
                  />
                </div>
                <Button type="submit" disabled={!canSubmit} className="mt-1 h-11 w-full text-base">
                  {submitting
                    ? isSignup
                      ? "Creating account…"
                      : "Logging in…"
                    : isSignup
                      ? "Create account"
                      : "Log in"}
                </Button>
              </form>

              <p className="mt-4 text-center text-xs text-muted-foreground">
                {isSignup ? "Already have an account? " : "New here? "}
                <button
                  type="button"
                  onClick={() => setMode(isSignup ? "login" : "signup")}
                  className="text-primary underline-offset-2 hover:underline"
                >
                  {isSignup ? "Log in" : "Create an account"}
                </button>
              </p>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </main>
  );
}
