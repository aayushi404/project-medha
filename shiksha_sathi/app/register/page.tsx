"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { motion, AnimatePresence } from "motion/react";
import { ArrowLeft, ArrowRight, GraduationCap, School, Users } from "lucide-react";
import { toast } from "sonner";

import { useAuth } from "@/lib/auth-context";
import {
  getGrades,
  registerStudent,
  type Grade,
  type RegisterRole,
  type SchoolSearchResult,
} from "@/lib/api";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { SchoolTypeahead } from "@/components/auth/school-typeahead";
import { PendingScreen } from "@/components/auth/pending-screen";

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
  const { status, register } = useAuth();

  const roleParam = params.get("role");
  const initialRole: FormRole | null =
    roleParam === "principal" || roleParam === "teacher" || roleParam === "student"
      ? roleParam
      : null;

  const [step, setStep] = useState<1 | 2>(initialRole ? 2 : 1);
  const [role, setRole] = useState<FormRole | null>(initialRole);
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [mobile, setMobile] = useState("");
  const [school, setSchool] = useState<SchoolSearchResult | null>(null);
  const [employeeCode, setEmployeeCode] = useState("");
  const [experience, setExperience] = useState("");
  const [qualification, setQualification] = useState("");

  const [gradeId, setGradeId] = useState<string | null>(null);
  const [rollNumber, setRollNumber] = useState("");
  const [grades, setGrades] = useState<Grade[]>([]);

  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (status === "authenticated") router.replace("/home");
  }, [status, router]);

  useEffect(() => {
    if (role !== "student" || grades.length > 0) return;
    getGrades()
      .then((g) => setGrades(g))
      .catch(() => {});
  }, [role, grades.length]);

  function handleRoleSelect(value: FormRole) {
    setRole(value);
    setStep(2);
  }

  const mobileDigits = mobile.replace(/\D/g, "").replace(/^91(?=\d{10}$)/, "");
  const isTeacher = role === "teacher";
  const isStudent = role === "student";
  const selectedCard = ROLE_CARDS.find((c) => c.value === role);

  const error = useMemo(() => {
    if (!role) return "Select a role.";
    if (fullName.trim().length < 2) return "Enter your full name.";
    if (!school) return "Pick your school.";
    if (isStudent) {
      if (!gradeId) return "Select your class.";
      if (rollNumber.trim().length === 0) return "Enter your roll number.";
      return null;
    }
    if (!email.includes("@")) return "Enter a valid email.";
    if (password.length < 8) return "Password must be at least 8 characters.";
    if (password !== confirm) return "Passwords don't match.";
    if (mobileDigits.length !== 10) return "Enter a valid 10-digit mobile number.";
    if (isTeacher && employeeCode.trim().length === 0)
      return "Employee code (government teacher ID) is required.";
    if (experience && (Number(experience) < 0 || Number(experience) > 50))
      return "Years of experience must be between 0 and 50.";
    return null;
  }, [
    role,
    fullName,
    email,
    password,
    confirm,
    mobileDigits,
    school,
    isTeacher,
    isStudent,
    gradeId,
    rollNumber,
    employeeCode,
    experience,
  ]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (error || !school || !role) {
      if (error) toast.error(error);
      return;
    }
    setSubmitting(true);
    try {
      if (isStudent) {
        await registerStudent({
          full_name: fullName.trim(),
          school_id: school.id,
          grade_id: gradeId!,
          roll_number: rollNumber.trim(),
        });
      } else {
        await register({
          role: role as RegisterRole,
          full_name: fullName.trim(),
          email: email.trim(),
          password,
          mobile_number: mobileDigits,
          school_id: school.id,
          employee_code: isTeacher ? employeeCode.trim() : null,
          years_of_experience: isTeacher && experience ? Number(experience) : null,
          qualification: qualification.trim() || null,
        });
      }
      setDone(true);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not register.");
      setSubmitting(false);
    }
  }

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

              {done && isStudent ? (
                <div className="flex flex-col items-center gap-4 text-center">
                  <PendingScreen message="Your registration was received. A teacher at your school will approve it. Once approved, activate your account to log in." />
                  <Link href="/student/activate" className="mreg-link-highlight">
                    Activate my account
                  </Link>
                </div>
              ) : done ? (
                <PendingScreen approver={isTeacher ? "your principal" : "an administrator"} />
              ) : (
                <form onSubmit={handleSubmit} className="mreg-actual-form">
                  <Field label="Full name" htmlFor="full-name">
                    <Input
                      id="full-name"
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      placeholder="e.g. Anita Kumari"
                      className="h-11 text-base"
                      autoFocus
                    />
                  </Field>

                  {!isStudent && (
                    <>
                      <Field label="Email" htmlFor="email">
                        <Input
                          id="email"
                          type="email"
                          autoComplete="email"
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          placeholder="you@example.com"
                          className="h-11 text-base"
                        />
                      </Field>

                      <div className="grid grid-cols-2 gap-3">
                        <Field label="Password" htmlFor="password">
                          <Input
                            id="password"
                            type="password"
                            autoComplete="new-password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            placeholder="8+ characters"
                            className="h-11 text-base"
                          />
                        </Field>
                        <Field label="Confirm" htmlFor="confirm">
                          <Input
                            id="confirm"
                            type="password"
                            autoComplete="new-password"
                            value={confirm}
                            onChange={(e) => setConfirm(e.target.value)}
                            placeholder="Repeat password"
                            className="h-11 text-base"
                          />
                        </Field>
                      </div>

                      <Field label="Mobile number" htmlFor="mobile">
                        <Input
                          id="mobile"
                          type="tel"
                          inputMode="numeric"
                          autoComplete="tel"
                          value={mobile}
                          onChange={(e) => setMobile(e.target.value)}
                          placeholder="10-digit number"
                          className="h-11 text-base"
                        />
                      </Field>
                    </>
                  )}

                  <Field label="School" htmlFor="school">
                    <SchoolTypeahead id="school" value={school} onChange={setSchool} />
                  </Field>

                  {isStudent && (
                    <div className="grid grid-cols-2 gap-3">
                      <Field label="Class" htmlFor="grade">
                        <Select
                          ariaLabel="Class"
                          placeholder="Select"
                          value={gradeId}
                          options={grades.map((g) => ({ value: g.id, label: g.label }))}
                          onValueChange={setGradeId}
                          className="h-11 w-full"
                        />
                      </Field>
                      <Field label="Roll number" htmlFor="roll">
                        <Input
                          id="roll"
                          value={rollNumber}
                          onChange={(e) => setRollNumber(e.target.value)}
                          placeholder="e.g. 23"
                          className="h-11 text-base"
                        />
                      </Field>
                    </div>
                  )}

                  {isTeacher && (
                    <>
                      <Field label="Employee code (government teacher ID)" htmlFor="employee-code">
                        <Input
                          id="employee-code"
                          value={employeeCode}
                          onChange={(e) => setEmployeeCode(e.target.value)}
                          placeholder="As on your service record"
                          className="h-11 text-base"
                        />
                      </Field>
                      <div className="grid grid-cols-2 gap-3">
                        <Field label="Years of experience" htmlFor="experience">
                          <Input
                            id="experience"
                            type="number"
                            min={0}
                            max={50}
                            value={experience}
                            onChange={(e) => setExperience(e.target.value)}
                            placeholder="e.g. 7"
                            className="h-11 text-base"
                          />
                        </Field>
                        <Field label="Qualification" htmlFor="qualification">
                          <Input
                            id="qualification"
                            value={qualification}
                            onChange={(e) => setQualification(e.target.value)}
                            placeholder="e.g. B.Ed"
                            className="h-11 text-base"
                          />
                        </Field>
                      </div>
                    </>
                  )}

                  {!isTeacher && !isStudent && (
                    <Field label="Qualification (optional)" htmlFor="qualification">
                      <Input
                        id="qualification"
                        value={qualification}
                        onChange={(e) => setQualification(e.target.value)}
                        placeholder="e.g. M.Ed"
                        className="h-11 text-base"
                      />
                    </Field>
                  )}

                  <button type="submit" disabled={submitting} className="mreg-submit-btn">
                    {submitting ? "Submitting…" : isStudent ? "Register" : "Create account"}
                  </button>
                </form>
              )}

              {!done && (
                <p className="mreg-form-bottom-hint">
                  {isStudent ? (
                    <>
                      Already approved?{" "}
                      <Link href="/student/activate" className="mreg-link-highlight">
                        Activate your account
                      </Link>
                    </>
                  ) : (
                    <>
                      Already have an account?{" "}
                      <Link href="/login" className="mreg-link-highlight">
                        Log in
                      </Link>
                    </>
                  )}
                </p>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </main>
    </div>
  );
}

function Field({
  label,
  htmlFor,
  children,
}: {
  label: string;
  htmlFor: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-2">
      <Label htmlFor={htmlFor}>{label}</Label>
      {children}
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
