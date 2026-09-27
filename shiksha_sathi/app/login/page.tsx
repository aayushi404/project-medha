"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { motion, AnimatePresence } from "motion/react";
import { ArrowRight, Check, Eye, EyeOff, Loader2 } from "lucide-react";
import { toast } from "sonner";

import { AuthError } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { useCopy } from "@/lib/copy";
import { LanguageToggle } from "@/components/app/language-toggle";
import { PendingScreen } from "@/components/auth/pending-screen";
import { Form, FormControl, FormField, FormItem, FormMessage } from "@/components/ui/form";
import { loginSchema, type LoginFormValues } from "@/lib/validation/auth";

type View = "form" | "pending" | "rejected";
type RoleTab = "student" | "teacher" | "principal";

const ROLE_TABS: { id: RoleTab; label: string; placeholder: string }[] = [
  { id: "student", label: "Student", placeholder: "Student email" },
  { id: "teacher", label: "Teacher", placeholder: "Teacher email" },
  { id: "principal", label: "Principal", placeholder: "Principal email" },
];

export default function LoginPage() {
  const copy = useCopy();
  const router = useRouter();
  const { status, teacher, login } = useAuth();

  const [activeRole, setActiveRole] = useState<RoleTab>("student");
  const [showPass, setShowPass] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [view, setView] = useState<View>("form");
  const [rejectionReason, setRejectionReason] = useState<string | null>(null);
  // true once the person has actually submitted the form this visit -- lets us
  // hold on the "signed in as ..." card briefly instead of redirecting the
  // instant the session is established.
  const [cameFromForm, setCameFromForm] = useState(false);

  const form = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "", password: "" },
    mode: "onTouched",
    reValidateMode: "onChange",
  });

  useEffect(() => {
    if (status !== "authenticated") return;
    const delay = cameFromForm ? 1200 : 0;
    const t = setTimeout(() => router.replace("/home"), delay);
    return () => clearTimeout(t);
  }, [status, cameFromForm, router]);

  // the role tab is sent with the login request -- the backend rejects a
  // login whose account role doesn't match the picked tab (ROLE_MISMATCH).
  function selectRole(tab: RoleTab) {
    setActiveRole(tab);
    setShowPass(false);
    setView("form");
    form.reset({ email: "", password: "" });
  }

  async function onSubmit(values: LoginFormValues) {
    setCameFromForm(true);
    setSubmitting(true);
    try {
      await login(values.email.trim(), values.password, activeRole);
      // the authenticated effect above shows the role confirmation, then routes
    } catch (err) {
      setCameFromForm(false);
      if (err instanceof AuthError && err.code === "PENDING_APPROVAL") {
        setView("pending");
      } else if (err instanceof AuthError && err.code === "REGISTRATION_REJECTED") {
        setRejectionReason(err.reason);
        setView("rejected");
      } else if (err instanceof AuthError && err.code === "ROLE_MISMATCH") {
        const actualTab = ROLE_TABS.find((r) => r.id === err.actualRole);
        const roleLabel = err.actualRole
          ? (copy.roleLabel[err.actualRole] ?? err.actualRole)
          : copy.login.couldNotLogIn;
        toast.error(
          actualTab
            ? copy.login.wrongPortal(roleLabel, actualTab.label)
            : copy.login.couldNotLogIn,
        );
      } else {
        toast.error(err instanceof Error ? err.message : copy.login.couldNotLogIn);
      }
      setSubmitting(false);
    }
  }

  const signedIn = status === "authenticated" && cameFromForm;
  const firstName = teacher?.full_name?.trim().split(/\s+/)[0] ?? "";
  const roleLabel = teacher ? (copy.roleLabel[teacher.role] ?? teacher.role) : "";
  const activeTab = ROLE_TABS.find((r) => r.id === activeRole)!;

  return (
    <main className="mlogin-root">
      <motion.div
        className="mlogin-card"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.38, ease: "easeOut" }}
      >
        <div className="flex items-center justify-between gap-2">
          <div className="mlogin-tabs flex-1">
            {ROLE_TABS.map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => selectRole(tab.id)}
                className={`mlogin-tab${activeRole === tab.id ? " mlogin-tab--active" : ""}`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        <div className="mlogin-heading">
          <h1>{copy.login.subtitle}</h1>
          <p>Sign in to your Medha account</p>
          <div className="mt-2 flex justify-center">
            <LanguageToggle />
          </div>
        </div>

        <AnimatePresence mode="wait">
          {signedIn && (
            <motion.div
              key="ok"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="mlogin-success"
            >
              <div className="mlogin-success-icon">
                <Check size={24} />
              </div>
              <strong>{firstName ? copy.login.welcomeBack(firstName) : copy.login.signedIn}</strong>
              <span>
                {copy.login.signedInAsPre} <b>{roleLabel}</b> {copy.login.signedInAsPost}
              </span>
              <div className="mlogin-redirecting">
                <Loader2 size={13} className="animate-spin" /> {copy.login.takingYou}
              </div>
            </motion.div>
          )}

          {!signedIn && view === "pending" && (
            <motion.div key="pending" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
              <PendingScreen message={copy.login.pendingMessage} />
            </motion.div>
          )}

          {!signedIn && view === "rejected" && (
            <motion.div
              key="rejected"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="mlogin-rejected"
            >
              <strong>{copy.login.rejectedTitle}</strong>
              <p>
                {rejectionReason
                  ? copy.login.rejectedReason(rejectionReason)
                  : copy.login.rejectedFallback}
              </p>
              <Link href="/register" className="mlogin-link">
                {copy.login.registerAgain}
              </Link>
              <button type="button" className="mlogin-link-muted" onClick={() => setView("form")}>
                {copy.login.backToLogin}
              </button>
            </motion.div>
          )}

          {!signedIn && view === "form" && (
            <Form {...form}>
              <motion.form
                key={activeRole}
                onSubmit={form.handleSubmit(onSubmit)}
                className="mlogin-form"
                initial={{ opacity: 0, x: 10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -10 }}
                transition={{ duration: 0.18 }}
                noValidate
              >
                <FormField
                  control={form.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <div className="mlogin-field">
                        <FormControl>
                          <input
                            {...field}
                            type="email"
                            autoComplete="email"
                            placeholder={activeTab.placeholder}
                            autoFocus
                          />
                        </FormControl>
                      </div>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="password"
                  render={({ field }) => (
                    <FormItem>
                      <div className="mlogin-field mlogin-field--pass">
                        <FormControl>
                          <input
                            {...field}
                            type={showPass ? "text" : "password"}
                            autoComplete="current-password"
                            placeholder={copy.login.password}
                          />
                        </FormControl>
                        <button
                          type="button"
                          className="mlogin-eye"
                          onClick={() => setShowPass((v) => !v)}
                          tabIndex={-1}
                        >
                          {showPass ? <EyeOff size={16} /> : <Eye size={16} />}
                        </button>
                      </div>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <Link href="/forgot-password" className="mlogin-link-muted self-end text-xs">
                  Forgot password?
                </Link>

                <button type="submit" disabled={submitting} className="mlogin-submit">
                  {submitting ? (
                    <>
                      <Loader2 size={16} className="animate-spin" /> {copy.login.submitting}
                    </>
                  ) : (
                    <>
                      {copy.login.submit} <ArrowRight size={16} />
                    </>
                  )}
                </button>

                <div className="mlogin-register-hint flex flex-col items-center gap-1">
                  <span>
                    {copy.login.newToMedha} {copy.login.registerAsPrefix}{" "}
                    <Link href="/register?role=principal" className="mlogin-link">
                      {copy.login.rolePrincipal}
                    </Link>
                    ,{" "}
                    <Link href="/register?role=teacher" className="mlogin-link">
                      {copy.login.roleTeacher}
                    </Link>{" "}
                    {copy.login.or}{" "}
                    <Link href="/register?role=student" className="mlogin-link">
                      {copy.login.roleStudent}
                    </Link>
                  </span>
                </div>
              </motion.form>
            </Form>
          )}
        </AnimatePresence>
      </motion.div>
    </main>
  );
}
