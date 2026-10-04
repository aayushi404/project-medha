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
import { RejectedNotice } from "@/components/auth/rejected-notice";
import { Form, FormControl, FormField, FormItem, FormMessage } from "@/components/ui/form";
import {
  phoneLoginSchema,
  principalLoginSchema,
  type PhoneLoginFormValues,
  type PrincipalLoginFormValues,
} from "@/lib/validation/auth";

type View = "form" | "pending" | "rejected";
type RoleTab = "teacher" | "principal";

// Labels used when a wrong-tab login tells the person which tab to use.
const TAB_LABELS: Record<"student" | RoleTab, string> = {
  student: "Student",
  teacher: "Teacher",
  principal: "Principal",
};

export default function LoginPage() {
  const copy = useCopy();
  const router = useRouter();
  const { status, teacher, loginWithEmail, loginWithPhone } = useAuth();

  const [activeRole, setActiveRole] = useState<RoleTab>("teacher");
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

  function selectRole(tab: RoleTab) {
    setActiveRole(tab);
    setView("form");
  }

  // Runs one login attempt and turns its failure into the right screen.
  async function attempt(run: () => Promise<void>) {
    setCameFromForm(true);
    setSubmitting(true);
    try {
      await run();
      // the authenticated effect above shows the role confirmation, then routes
    } catch (err) {
      setCameFromForm(false);
      if (err instanceof AuthError && err.code === "PENDING_APPROVAL") {
        setView("pending");
      } else if (err instanceof AuthError && err.code === "REGISTRATION_REJECTED") {
        setRejectionReason(err.reason);
        setView("rejected");
      } else if (err instanceof AuthError && err.code === "ROLE_MISMATCH") {
        const actualTab = err.actualRole ? TAB_LABELS[err.actualRole as keyof typeof TAB_LABELS] : undefined;
        const roleLabel = err.actualRole
          ? (copy.roleLabel[err.actualRole] ?? err.actualRole)
          : copy.login.couldNotLogIn;
        toast.error(actualTab ? copy.login.wrongPortal(roleLabel, actualTab) : copy.login.couldNotLogIn);
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
    <main className="mlogin-root">
      <motion.div
        className="mlogin-card"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.38, ease: "easeOut" }}
      >
        <div className="flex items-center justify-between gap-2">
          <div className="mlogin-tabs flex-1">
            {/* Students have their own flow: profile picker, then password. */}
            <Link href="/login/student" className="mlogin-tab">
              {TAB_LABELS.student}
            </Link>
            {(["teacher", "principal"] as const).map((tab) => (
              <button
                key={tab}
                type="button"
                onClick={() => selectRole(tab)}
                className={`mlogin-tab${activeRole === tab ? " mlogin-tab--active" : ""}`}
              >
                {TAB_LABELS[tab]}
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
            <motion.div key="rejected" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
              <RejectedNotice reason={rejectionReason} onBack={() => setView("form")} />
            </motion.div>
          )}

          {!signedIn && view === "form" && activeRole === "teacher" && (
            <TeacherLoginForm
              key="teacher"
              submitting={submitting}
              onSubmit={(values) =>
                attempt(() =>
                  loginWithPhone({ phone: values.phone, password: values.password, role: "teacher" }),
                )
              }
            />
          )}

          {!signedIn && view === "form" && activeRole === "principal" && (
            <PrincipalLoginForm
              key="principal"
              submitting={submitting}
              onSubmit={(values) =>
                attempt(() => loginWithEmail(values.email.trim(), values.password))
              }
            />
          )}
        </AnimatePresence>
      </motion.div>
    </main>
  );
}

type FormProps<T> = {
  submitting: boolean;
  onSubmit: (values: T) => void;
};

function TeacherLoginForm({ submitting, onSubmit }: FormProps<PhoneLoginFormValues>) {
  const copy = useCopy();
  const [showPass, setShowPass] = useState(false);
  const form = useForm<PhoneLoginFormValues>({
    resolver: zodResolver(phoneLoginSchema),
    defaultValues: { phone: "", password: "" },
    mode: "onTouched",
    reValidateMode: "onChange",
  });

  return (
    <Form {...form}>
      <motion.form
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
          name="phone"
          render={({ field }) => (
            <FormItem>
              <div className="mlogin-field">
                <FormControl>
                  <input
                    {...field}
                    type="tel"
                    inputMode="numeric"
                    autoComplete="tel"
                    placeholder={copy.login.phonePlaceholder}
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

        <p className="self-end text-xs text-muted-foreground">{copy.login.forgotTeacher}</p>

        <SubmitButton submitting={submitting} />
        <RegisterHints />
      </motion.form>
    </Form>
  );
}

function PrincipalLoginForm({ submitting, onSubmit }: FormProps<PrincipalLoginFormValues>) {
  const copy = useCopy();
  const [showPass, setShowPass] = useState(false);
  const form = useForm<PrincipalLoginFormValues>({
    resolver: zodResolver(principalLoginSchema),
    defaultValues: { email: "", password: "" },
    mode: "onTouched",
    reValidateMode: "onChange",
  });

  return (
    <Form {...form}>
      <motion.form
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
                    placeholder="Principal email"
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

        <SubmitButton submitting={submitting} />
        <RegisterHints />
      </motion.form>
    </Form>
  );
}

function SubmitButton({ submitting }: { submitting: boolean }) {
  const copy = useCopy();
  return (
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
  );
}

function RegisterHints() {
  const copy = useCopy();
  return (
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
      <span>
        Student added by your school?{" "}
        <Link href="/student/claim" className="mlogin-link">
          Claim your account
        </Link>
      </span>
    </div>
  );
}
