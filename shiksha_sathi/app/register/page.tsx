"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { motion, AnimatePresence } from "motion/react";
import { ArrowLeft, ArrowRight, GraduationCap, School, Users } from "lucide-react";

import { useAuth } from "@/lib/auth-context";
import type { RegisterRole } from "@/lib/api";
import { PendingScreen } from "@/components/auth/pending-screen";
import { StaffRegisterForm } from "@/components/auth/staff-register-form";
import { StudentRegisterForm } from "@/components/auth/student-register-form";

type FormRole = RegisterRole | "student";

const ROLE_CARDS: {
  value: FormRole;
  label: string;
  icon: React.ElementType;
  emoji: string;
  desc: string;
}[] = [
  {
    value: "student",
    label: "Student",
    icon: GraduationCap,
    emoji: "🎓",
    desc: "Access textbooks, e-content and practice tests for your class.",
  },
  {
    value: "teacher",
    label: "Teacher",
    icon: Users,
    emoji: "📚",
    desc: "Build lessons, generate quizzes and track your classes.",
  },
  {
    value: "principal",
    label: "Principal",
    icon: School,
    emoji: "🏫",
    desc: "Oversee teacher approvals and school records.",
  },
];

function RegisterForm() {
  const router = useRouter();
  const params = useSearchParams();
  const { status } = useAuth();

  const roleParam = params.get("role");
  const initialRole: FormRole | null =
    roleParam === "principal" || roleParam === "teacher" || roleParam === "student"
      ? roleParam
      : null;

  const [step, setStep] = useState<1 | 2>(initialRole ? 2 : 1);
  const [role, setRole] = useState<FormRole | null>(initialRole);
  const [done, setDone] = useState(false);
  // whether a verification email went out, so the done screen says the right thing
  const [doneHasEmail, setDoneHasEmail] = useState(false);

  useEffect(() => {
    if (status === "authenticated") router.replace("/home");
  }, [status, router]);

  function handleRoleSelect(value: FormRole) {
    setRole(value);
    setDone(false);
    setStep(2);
  }

  const isTeacher = role === "teacher";
  const isStudent = role === "student";
  const selectedCard = ROLE_CARDS.find((c) => c.value === role);
  const approver = isStudent ? "a teacher at your school" : isTeacher ? "your principal" : "an administrator";

  return (
    <div className="mreg-root">
      <main className="mreg-content">
        <AnimatePresence mode="wait">
          {step === 1 && (
            <motion.div
              key="role-selection"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -16 }}
              transition={{ duration: 0.35, ease: "easeOut" }}
              className="mreg-step1-wrap"
            >
              <div className="mreg-top-badge">
                <span>Medha</span>
              </div>

              <h1 className="mreg-main-title">Create your account</h1>
              <p className="mreg-main-subtitle">Choose how you&apos;ll use Medha</p>

              <div className="mreg-cards-container">
                {ROLE_CARDS.map((card) => (
                  <button
                    key={card.value}
                    type="button"
                    onClick={() => handleRoleSelect(card.value)}
                    className="mreg-card"
                  >
                    <div className="mreg-card-emoji-wrap">
                      <span className="mreg-card-emoji">{card.emoji}</span>
                    </div>
                    <div className="mreg-card-body">
                      <h2 className="mreg-card-title">{card.label}</h2>
                      <p className="mreg-card-desc">{card.desc}</p>
                    </div>
                    <div className="mreg-card-cta">
                      <span>Get started</span>
                      <ArrowRight size={15} />
                    </div>
                  </button>
                ))}
              </div>

              <p className="mreg-bottom-signin">
                Already have an account?{" "}
                <Link href="/login" className="mreg-link-highlight">
                  Sign in
                </Link>
              </p>
            </motion.div>
          )}

          {step === 2 && role && (
            <motion.div
              key="registration-form"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -16 }}
              transition={{ duration: 0.35, ease: "easeOut" }}
              className="mreg-step2-card"
            >
              <div className="mreg-form-nav">
                <button type="button" onClick={() => setStep(1)} className="mreg-back-button">
                  <ArrowLeft size={16} /> Change role
                </button>
                <div className="mreg-selected-chip">
                  <span>{selectedCard?.emoji}</span>
                  <strong>{selectedCard?.label}</strong>
                </div>
              </div>

              <div className="mreg-form-header">
                <h2>Create your {selectedCard?.label} account</h2>
                <p>
                  {isStudent
                    ? "A teacher at your school approves student accounts."
                    : isTeacher
                      ? "Your principal approves teacher accounts."
                      : "An administrator approves principal accounts."}
                </p>
              </div>

              {done ? (
                <PendingScreen
                  approver={approver}
                  message={
                    doneHasEmail
                      ? `We've emailed a link to your address. Open it to verify it -- then ${approver} can approve your account.`
                      : `Once ${approver} approves your account, log in with your mobile number and password.`
                  }
                />
              ) : (
                <>
                  {isStudent ? (
                    <StudentRegisterForm
                      onDone={() => {
                        setDoneHasEmail(false);
                        setDone(true);
                      }}
                    />
                  ) : (
                    <StaffRegisterForm
                      role={role as RegisterRole}
                      onDone={(hasEmail) => {
                        setDoneHasEmail(hasEmail);
                        setDone(true);
                      }}
                    />
                  )}
                  <p className="mreg-form-bottom-hint">
                    Already have an account?{" "}
                    <Link href="/login" className="mreg-link-highlight">
                      Log in
                    </Link>
                  </p>
                </>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </main>
    </div>
  );
}

export default function RegisterPage() {
  return (
    <Suspense fallback={null}>
      <RegisterForm />
    </Suspense>
  );
}
