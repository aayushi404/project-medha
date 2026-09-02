"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion } from "motion/react";
import { Check, Loader2 } from "lucide-react";
import { toast } from "sonner";

import { AuthError } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { useCopy } from "@/lib/copy";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { LanguageToggle } from "@/components/app/language-toggle";
import { PendingScreen } from "@/components/auth/pending-screen";

type View = "form" | "pending" | "rejected";

export default function LoginPage() {
  const copy = useCopy();
  const router = useRouter();
  const { status, teacher, login } = useAuth();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [view, setView] = useState<View>("form");
  const [rejectionReason, setRejectionReason] = useState<string | null>(null);
  // true once the person has actually submitted the form this visit -- lets us
  // hold on the "signed in as ..." card briefly instead of redirecting the
  // instant the session is established.
  const [cameFromForm, setCameFromForm] = useState(false);

  useEffect(() => {
    if (status !== "authenticated") return;
    const delay = cameFromForm ? 1200 : 0;
    const t = setTimeout(() => router.replace("/home"), delay);
    return () => clearTimeout(t);
  }, [status, cameFromForm, router]);

  const canSubmit = email.trim().length > 3 && password.length >= 1 && !submitting;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;
    setCameFromForm(true);
    setSubmitting(true);
    try {
      await login(email.trim(), password);
      // the authenticated effect above shows the role confirmation, then routes #Mannu Yadav
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

  const signedIn = status === "authenticated" && cameFromForm;
  const firstName = teacher?.full_name?.trim().split(/\s+/)[0] ?? "";
  const roleLabel = teacher ? (copy.roleLabel[teacher.role] ?? teacher.role) : "";

  return (
    <main className="sun-wash flex flex-1 flex-col items-center justify-center px-4 py-12">
      <div className="w-full max-w-sm">
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, ease: "easeOut" }}
          className="mb-8 flex flex-col items-center gap-2 text-center"
        >
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">Medha</h1>
          <p className="text-sm text-muted-foreground">{copy.login.subtitle}</p>
          <LanguageToggle className="mt-1" />
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.1, ease: "easeOut" }}
        >
          <Card className="shadow-sm">
            <CardContent className="px-6 py-5">
              {signedIn && (
                <motion.div
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.25, ease: "easeOut" }}
                  className="flex flex-col items-center gap-3 py-2 text-center"
                >
                  <span className="flex size-11 items-center justify-center rounded-full bg-primary/10 text-primary">
                    <Check className="size-6" />
                  </span>
                  <div>
                    <h2 className="text-lg font-semibold tracking-tight text-foreground">
                      {firstName ? copy.login.welcomeBack(firstName) : copy.login.signedIn}
                    </h2>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {copy.login.signedInAsPre}{" "}
                      <span className="font-medium text-foreground">{roleLabel}</span>{" "}
                      {copy.login.signedInAsPost}
                    </p>
                  </div>
                  <div className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
                    <Loader2 className="size-3.5 animate-spin" />
                    {copy.login.takingYou}
                  </div>
                </motion.div>
              )}

              {!signedIn && view === "pending" && (
                <PendingScreen message={copy.login.pendingMessage} />
              )}

              {!signedIn && view === "rejected" && (
                <div className="flex flex-col items-center gap-4 text-center">
                  <h2 className="text-lg font-semibold tracking-tight text-foreground">
                    {copy.login.rejectedTitle}
                  </h2>
                  <p className="max-w-xs text-sm leading-relaxed text-muted-foreground">
                    {rejectionReason
                      ? copy.login.rejectedReason(rejectionReason)
                      : copy.login.rejectedFallback}
                  </p>
                  <Link
                    href="/register"
                    className="mt-1 text-sm text-primary underline-offset-2 hover:underline"
                  >
                    {copy.login.registerAgain}
                  </Link>
                  <button
                    type="button"
                    onClick={() => setView("form")}
                    className="text-xs text-muted-foreground hover:text-foreground"
                  >
                    {copy.login.backToLogin}
                  </button>
                </div>
              )}

              {!signedIn && view === "form" && (
                <>
                  <form onSubmit={handleSubmit} className="flex flex-col gap-4">
                    <div className="flex flex-col gap-2">
                      <Label htmlFor="email">{copy.login.email}</Label>
                      <Input
                        id="email"
                        type="email"
                        autoComplete="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder={copy.login.emailPlaceholder}
                        className="h-11 text-base"
                        autoFocus
                      />
                    </div>
                    <div className="flex flex-col gap-2">
                      <Label htmlFor="password">{copy.login.password}</Label>
                      <Input
                        id="password"
                        type="password"
                        autoComplete="current-password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder={copy.login.passwordPlaceholder}
                        className="h-11 text-base"
                      />
                    </div>
                    <Button
                      type="submit"
                      disabled={!canSubmit}
                      className="mt-1 h-11 w-full text-base"
                    >
                      {submitting ? copy.login.submitting : copy.login.submit}
                    </Button>
                  </form>

                  <div className="mt-4 flex flex-col items-center gap-1 text-center text-xs text-muted-foreground">
                    <span>{copy.login.newToMedha}</span>
                    <span>
                      {copy.login.registerAsPrefix}{" "}
                      <Link
                        href="/register?role=principal"
                        className="text-primary underline-offset-2 hover:underline"
                      >
                        {copy.login.rolePrincipal}
                      </Link>
                      ,{" "}
                      <Link
                        href="/register?role=teacher"
                        className="text-primary underline-offset-2 hover:underline"
                      >
                        {copy.login.roleTeacher}
                      </Link>{" "}
                      {copy.login.or}{" "}
                      <Link
                        href="/register?role=student"
                        className="text-primary underline-offset-2 hover:underline"
                      >
                        {copy.login.roleStudent}
                      </Link>
                    </span>
                    <span>
                      {copy.login.studentApproved}{" "}
                      <Link
                        href="/student/activate"
                        className="text-primary underline-offset-2 hover:underline"
                      >
                        {copy.login.activate}
                      </Link>
                    </span>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </main>
  );
}
