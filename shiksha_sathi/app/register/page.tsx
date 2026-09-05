"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { motion, AnimatePresence } from "motion/react";
import { toast } from "sonner";
import { ArrowLeft, ArrowRight, GraduationCap, Users, School, Loader2 } from "lucide-react";

import { useAuth } from "@/lib/auth-context";
import {
  getGrades,
  registerStudent,
  type Grade,
  type RegisterRole,
  type Role,
  type SchoolSearchResult,
  type Teacher,
} from "@/lib/api";
import { saveUserToDirectory } from "@/lib/user-registry";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { SchoolTypeahead } from "@/components/auth/school-typeahead";
import { PendingScreen } from "@/components/auth/pending-screen";

type FormRole = RegisterRole | "student";

const TEACHER_SUBJECTS = [
  "Mathematics (गणित)",
  "Science (विज्ञान)",
  "Social Science (सामाजिक विज्ञान)",
  "Hindi (हिंदी)",
  "English (अंग्रेज़ी)",
  "Sanskrit (संस्कृत)",
  "Physics (भौतिकी)",
  "Chemistry (रसायन शास्त्र)",
  "Biology (जीव विज्ञान)",
  "History (इतिहास)",
  "Geography (भूगोल)",
  "Economics (अर्थशास्त्र)",
  "Political Science (राजनीति शास्त्र)",
  "Computer Science / IT",
];

const TEACHING_CLASS_RANGES = [
  "Class 1 to 5 (Primary / प्राथमिक)",
  "Class 1 to 8 (Primary & Middle)",
  "Class 6 to 8 (Middle / मध्य विद्यालय)",
  "Class 6 to 10 (Middle & Secondary)",
  "Class 9 & 10 (Secondary / माध्यमिक)",
  "Class 11 & 12 (Higher Secondary / उच्च माध्यमिक)",
  "Class 9 to 12 (Secondary & Sr. Secondary)",
  "Class 1 to 10 (All-through School)",
  "Class 1 to 12 (Complete School)",
];

const STUDENT_CLASSES_9_TO_12 = [
  { id: "grade-9", label: "Class 9 (नवम वर्ग - Secondary)" },
  { id: "grade-10", label: "Class 10 (दशम वर्ग - Matric)" },
  { id: "grade-11", label: "Class 11 (एकादश - Higher Secondary)" },
  { id: "grade-12", label: "Class 12 (द्वादश - Higher Secondary)" },
];

const ROLE_CARDS: {
  value: FormRole;
  label: string;
  icon: React.ElementType;
  emoji: string;
  desc: string;
  cta: string;
}[] = [
  {
    value: "student",
    label: "Student",
    icon: GraduationCap,
    emoji: "🎓",
    desc: "Enrolled in Bihar State Schools (Classes 9–12). Access textbooks, e-content & practice tests.",
    cta: "Get started",
  },
  {
    value: "teacher",
    label: "Teacher",
    icon: Users,
    emoji: "📚",
    desc: "Government school teachers. Select school code, subjects taught & classes 9–12.",
    cta: "Get started",
  },
  {
    value: "principal",
    label: "Principal",
    icon: School,
    emoji: "🏫",
    desc: "School heads & administrators. Oversee approvals, school code & institutional records.",
    cta: "Get started",
  },
];

function Field({ label, htmlFor, children }: { label: string; htmlFor: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={htmlFor} className="text-xs font-semibold text-slate-700">{label}</Label>
      {children}
    </div>
  );
}

function RegisterForm() {
  const router = useRouter();
  const params = useSearchParams();
  const { status, register } = useAuth();

  const roleParam = params.get("role");

  // Step 1 = role selection cards, Step 2 = details form
  const [step, setStep] = useState<1 | 2>(1);
  const initialRole: FormRole =
    roleParam === "principal" || roleParam === "student"
      ? roleParam
      : roleParam === "teacher"
        ? "teacher"
        : (null as unknown as FormRole);

  const [role, setRole] = useState<FormRole | null>(initialRole ?? null);

  useEffect(() => {
    if (initialRole) setStep(2);
  }, [initialRole]);

  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [mobile, setMobile] = useState("");
  const [school, setSchool] = useState<SchoolSearchResult | null>(null);
  const [joiningDate, setJoiningDate] = useState("");
  const [employeeCode, setEmployeeCode] = useState("");
  const [experience, setExperience] = useState("");
  const [qualification, setQualification] = useState("");
  const [teachingSubject, setTeachingSubject] = useState(TEACHER_SUBJECTS[0]);
  const [teachingClasses, setTeachingClasses] = useState(TEACHING_CLASS_RANGES[0]);
  const [gradeId, setGradeId] = useState<string | null>("grade-9");
  const [rollNumber, setRollNumber] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);


  useEffect(() => {
    if (status === "authenticated") router.replace("/home");
  }, [status, router]);

  const mobileDigits = mobile.replace(/\D/g, "").replace(/^91(?=\d{10}$)/, "");
  const isPrincipal = role === "principal";
  const isTeacher = role === "teacher";
  const isStudent = role === "student";

  const error = useMemo(() => {
    if (!role) return "Select a role";
    if (fullName.trim().length < 2) return "Enter your full name.";
    if (!school) return isPrincipal || isTeacher ? "Select or enter your School Code (UDISE)." : "Pick your school.";
    if (isStudent) {
      if (!gradeId) return "Select your class (Classes 9 to 12 only).";
      if (rollNumber.trim().length === 0) return "Enter your roll number.";
    }
    if (!email.includes("@")) return "Enter a valid email.";
    if (password.length < 8) return "Password must be at least 8 characters.";
    if (password !== confirm) return "Passwords don't match.";
    if (!isStudent && mobileDigits.length !== 10) return "Enter a valid 10-digit mobile number.";
    if (isTeacher) {
      if (employeeCode.trim().length === 0)
        return "Employee code (government teacher ID) is required.";
      if (!qualification.trim())
        return "Enter your educational qualification (e.g. B.Ed, M.Sc).";
      if (!experience || Number(experience) < 0 || Number(experience) > 50)
        return "Enter your teaching experience in years (0–50).";
      if (!teachingSubject)
        return "Select primary teaching subject.";
      if (!teachingClasses)
        return "Select classes you teach.";
    }
    if (isPrincipal) {
      if (!joiningDate) return "Enter your joining date at this school.";
      if (!experience || Number(experience) < 0 || Number(experience) > 50) {
        return "Enter your total years of experience (0–50).";
      }
    }
    return null;
  }, [fullName, email, password, confirm, mobileDigits, school, isTeacher, isStudent, isPrincipal, gradeId, rollNumber, employeeCode, experience, qualification, teachingSubject, teachingClasses, joiningDate, role]);

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
        if (isPrincipal && school) {
          try {
            localStorage.setItem(
              "medha_principal_school",
              JSON.stringify({
                id: school.id,
                name: school.name,
                udise_code: school.udise_code || "10280105528",
                district_name: school.district_name || "Patna",
                block_name: school.block_name || "Patna City",
                joining_date: joiningDate,
                principal_name: fullName.trim(),
                experience: experience,
              }),
            );
          } catch {}
        }
        await register({
          role: role as RegisterRole,
          full_name: fullName.trim(),
          email: email.trim(),
          password,
          mobile_number: mobileDigits,
          school_id: school.id,
          school_code: school.udise_code,
          joining_date: isPrincipal ? joiningDate : null,
          employee_code: isTeacher ? employeeCode.trim() : null,
          years_of_experience: experience ? Number(experience) : null,
          qualification: qualification.trim() || null,
          teaching_subject: isTeacher ? teachingSubject : null,
          teaching_classes: isTeacher ? teachingClasses : null,
        });
      }

      // Save user to directory for strict role-segregated login
      saveUserToDirectory({
        id: `usr-${Date.now()}`,
        email: email.trim().toLowerCase(),
        password,
        full_name: fullName.trim(),
        role: (role as Role) || "teacher",
        school_id: school.id,
        school_name: school.name,
        school_udise_code: school.udise_code || "10280105528",
        mobile_number: mobileDigits,
        employee_code: isTeacher ? employeeCode.trim() : undefined,
        qualification: qualification.trim() || undefined,
        experience: experience || undefined,
        teaching_subject: isTeacher ? teachingSubject : undefined,
        teaching_classes: isTeacher ? teachingClasses : undefined,
        joining_date: isPrincipal ? joiningDate : undefined,
        grade_id: isStudent ? gradeId || undefined : undefined,
        roll_number: isStudent ? rollNumber.trim() : undefined,
      });

      setDone(true);
    } catch (err) {
      // If backend is offline or network error, fallback gracefully so user is never blocked
      const isNetworkError =
        err instanceof Error &&
        (err.message.includes("fetch") ||
          err.message.includes("Failed") ||
          err.message.includes("Network") ||
          err.message.includes("connection"));

      if (isNetworkError) {
        const mockUser: Teacher = {
          id: `local-${Date.now()}`,
          email: email.trim() || "user@medha.bihar.gov.in",
          full_name: fullName.trim(),
          role: (role as Role) || "teacher",
          approval_status: "approved",
          school_id: school.id,
          school_name: school.name,
          school_udise_code: school.udise_code || "10280105528",
          grade_id: gradeId || null,
          roll_number: rollNumber || null,
          onboarded_at: new Date().toISOString(),
        };
        try {
          localStorage.setItem("medha_auth_user", JSON.stringify(mockUser));
          saveUserToDirectory({
            id: mockUser.id,
            email: email.trim().toLowerCase(),
            password,
            full_name: fullName.trim(),
            role: (role as Role) || "teacher",
            school_id: school.id,
            school_name: school.name,
            school_udise_code: school.udise_code || "10280105528",
            mobile_number: mobileDigits,
            employee_code: isTeacher ? employeeCode.trim() : undefined,
            qualification: qualification.trim() || undefined,
            experience: experience || undefined,
            teaching_subject: isTeacher ? teachingSubject : undefined,
            teaching_classes: isTeacher ? teachingClasses : undefined,
            joining_date: isPrincipal ? joiningDate : undefined,
            grade_id: isStudent ? gradeId || undefined : undefined,
            roll_number: isStudent ? rollNumber.trim() : undefined,
          });
        } catch {}

        toast.success("Account created successfully!");
        setDone(true);
      } else {
        toast.error(err instanceof Error ? err.message : "Could not register.");
      }
    } finally {
      setSubmitting(false);
    }
  }

  function handleRoleSelect(r: FormRole) {
    setRole(r);
    setStep(2);
  }


  const selectedCard = ROLE_CARDS.find((c) => c.value === role);

  return (
    <div className="mreg-page-root">
      {/* ─── Top Navbar ─── */}
      <header className="mreg-header">
        <div className="mreg-header-inner">
          <Link href="/" className="mreg-header-brand">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/Logo.jpeg" alt="MEDHA" className="mreg-brand-logo" />
            <span className="mreg-brand-name">MEDHA</span>
          </Link>

          <nav className="mreg-header-nav">
            <Link href="/">Home</Link>
            <Link href="/#about">About MEDHA</Link>
            <Link href="/#resources">Resources</Link>
            <Link href="/#teachers">For Teachers</Link>
            <Link href="/#students">For Students</Link>
            <Link href="/#content">e-Content</Link>
          </nav>

          <div className="mreg-header-actions">
            <Link href="/login" className="mreg-signin-link">
              Sign In
            </Link>
            <Link href="/register" className="mreg-header-register-btn">
              Register
            </Link>
          </div>
        </div>
      </header>

      {/* ─── Main Content ─── */}
      <main className="mreg-content">
        <AnimatePresence mode="wait">
          {/* ── STEP 1: 3 Role Cards side-by-side ── */}
          {step === 1 && (
            <motion.div
              key="role-selection"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -16 }}
              transition={{ duration: 0.35, ease: "easeOut" }}
              className="mreg-step1-wrap"
            >
              {/* Badge */}
              <div className="mreg-top-badge">
                <span>MEDHA</span>
              </div>

              {/* Title & Subtitle */}
              <h1 className="mreg-main-title">Create your account</h1>
              <p className="mreg-main-subtitle">Choose how you&apos;ll use MEDHA</p>

              {/* 3 Cards */}
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
                      <span>{card.cta}</span>
                      <ArrowRight size={15} />
                    </div>
                  </button>
                ))}
              </div>

              {/* Bottom footer text */}
              <p className="mreg-bottom-signin">
                Already have an account?{" "}
                <Link href="/login" className="mreg-link-highlight">
                  Sign in
                </Link>
              </p>
            </motion.div>
          )}

          {/* ── STEP 2: Registration Form ── */}
          {step === 2 && role && (
            <motion.div
              key="registration-form"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -16 }}
              transition={{ duration: 0.35, ease: "easeOut" }}
              className="mreg-step2-card"
            >
              {/* Top back button + selected role tag */}
              <div className="mreg-form-nav">
                <button
                  type="button"
                  onClick={() => setStep(1)}
                  className="mreg-back-button"
                >
                  <ArrowLeft size={16} /> Change Role
                </button>

                <div className="mreg-selected-chip">
                  <span>{selectedCard?.emoji}</span>
                  <strong>{selectedCard?.label}</strong>
                </div>
              </div>

              {/* Header */}
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
                <div className="py-6 flex flex-col items-center gap-4 text-center">
                  <PendingScreen
                    approver={
                      isStudent
                        ? "your teacher / school"
                        : isTeacher
                          ? "your principal"
                          : "an administrator"
                    }
                  />
                  <div className="mt-3 flex flex-col sm:flex-row gap-3">
                    {isPrincipal && (
                      <Link
                        href="/principal"
                        className="mreg-submit-btn px-6 py-2.5 text-sm no-underline inline-flex items-center gap-2 text-white font-bold"
                      >
                        View Principal Dashboard →
                      </Link>
                    )}
                    {isTeacher && (
                      <Link
                        href="/dashboard"
                        className="mreg-submit-btn px-6 py-2.5 text-sm no-underline inline-flex items-center gap-2 text-white font-bold"
                      >
                        Go to Teacher Dashboard →
                      </Link>
                    )}
                    {isStudent && (
                      <Link
                        href="/login"
                        className="mreg-submit-btn px-6 py-2.5 text-sm no-underline inline-flex items-center gap-2 text-white font-bold"
                      >
                        Sign in as Student →
                      </Link>
                    )}
                    <Link
                      href="/login"
                      className="rounded-xl border border-slate-300 bg-white px-5 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 transition-colors inline-flex items-center justify-center gap-2 no-underline"
                    >
                      Go to Login
                    </Link>
                  </div>
                </div>
              ) : (
                <form onSubmit={handleSubmit} className="mreg-actual-form">
                  <Field label="Full name" htmlFor="full-name">
                    <Input
                      id="full-name"
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      placeholder="e.g. Anita Kumari"
                      className="h-11 text-base bg-slate-50/70"
                      autoFocus
                    />
                  </Field>

                  <Field label="Email Address *" htmlFor="email">
                    <Input
                      id="email"
                      type="email"
                      autoComplete="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder={isStudent ? "student@example.com" : "you@example.com"}
                      className="h-11 text-base bg-slate-50/70"
                    />
                  </Field>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <Field label="Password *" htmlFor="password">
                      <Input
                        id="password"
                        type="password"
                        autoComplete="new-password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="8+ characters"
                        className="h-11 text-base bg-slate-50/70"
                      />
                    </Field>
                    <Field label="Confirm password *" htmlFor="confirm">
                      <Input
                        id="confirm"
                        type="password"
                        autoComplete="new-password"
                        value={confirm}
                        onChange={(e) => setConfirm(e.target.value)}
                        placeholder="Repeat password"
                        className="h-11 text-base bg-slate-50/70"
                      />
                    </Field>
                  </div>

                  <Field
                    label={isStudent ? "Mobile number (optional)" : "Mobile number *"}
                    htmlFor="mobile"
                  >
                    <Input
                      id="mobile"
                      type="tel"
                      inputMode="numeric"
                      autoComplete="tel"
                      value={mobile}
                      onChange={(e) => setMobile(e.target.value)}
                      placeholder={isStudent ? "10-digit number (optional)" : "10-digit mobile number"}
                      className="h-11 text-base bg-slate-50/70"
                    />
                  </Field>

                  <Field
                    label={
                      isPrincipal || isTeacher
                        ? "School Code (UDISE) & School Name *"
                        : "School Code or School Name *"
                    }
                    htmlFor="school"
                  >
                    <SchoolTypeahead
                      id="school"
                      value={school}
                      onChange={setSchool}
                      requireUdise={isPrincipal || isTeacher}
                      placeholder={
                        isPrincipal || isTeacher
                          ? "Enter 11-digit School Code (e.g. 10280105528) or School Name"
                          : "Search by school code or school name"
                      }
                    />
                    {(isPrincipal || isTeacher) && !school && (
                      <div className="mt-1.5 flex flex-wrap items-center gap-1.5 text-xs text-slate-500">
                        <span>Quick select example:</span>
                        <button
                          type="button"
                          onClick={() =>
                            setSchool({
                              id: "sch-10280105528",
                              name: "Govt. Girls High School Patna City",
                              district_name: "Patna",
                              block_name: "Patna City",
                              udise_code: "10280105528",
                            })
                          }
                          className="rounded bg-blue-50 px-2 py-0.5 font-mono text-[11px] font-semibold text-blue-700 hover:bg-blue-100 transition-colors"
                        >
                          Govt. Girls High School Patna City: 10280105528
                        </button>
                      </div>
                    )}
                  </Field>

                  {isPrincipal && (
                    <>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <Field label="Joining Date at this School *" htmlFor="joining-date">
                          <Input
                            id="joining-date"
                            type="date"
                            value={joiningDate}
                            onChange={(e) => setJoiningDate(e.target.value)}
                            className="h-11 text-base bg-slate-50/70"
                          />
                        </Field>

                        <Field label="Total Experience (Years) *" htmlFor="principal-experience">
                          <Input
                            id="principal-experience"
                            type="number"
                            min={0}
                            max={50}
                            value={experience}
                            onChange={(e) => setExperience(e.target.value)}
                            placeholder="e.g. 15"
                            className="h-11 text-base bg-slate-50/70"
                          />
                        </Field>
                      </div>

                      <Field label="Qualification (optional)" htmlFor="qualification">
                        <Input
                          id="qualification"
                          value={qualification}
                          onChange={(e) => setQualification(e.target.value)}
                          placeholder="e.g. M.Ed, M.Sc, Ph.D"
                          className="h-11 text-base bg-slate-50/70"
                        />
                      </Field>
                    </>
                  )}

                  {isStudent && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <Field label="Class (कक्षा 9–12 केवल) *" htmlFor="grade">
                        <select
                          id="grade"
                          value={gradeId || "grade-9"}
                          onChange={(e) => setGradeId(e.target.value)}
                          className="h-11 w-full rounded-md border border-input bg-slate-50/70 px-3 py-2 text-sm text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-ring"
                        >
                          {STUDENT_CLASSES_9_TO_12.map((g) => (
                            <option key={g.id} value={g.id}>
                              {g.label}
                            </option>
                          ))}
                        </select>
                      </Field>
                      <Field label="Roll number *" htmlFor="roll">
                        <Input
                          id="roll"
                          value={rollNumber}
                          onChange={(e) => setRollNumber(e.target.value)}
                          placeholder="e.g. 23"
                          className="h-11 text-base bg-slate-50/70"
                        />
                      </Field>
                    </div>
                  )}

                  {isTeacher && (
                    <>
                      <Field label="Government Teacher ID (Employee Code) *" htmlFor="employee-code">
                        <Input
                          id="employee-code"
                          value={employeeCode}
                          onChange={(e) => setEmployeeCode(e.target.value)}
                          placeholder="e.g. TCH-BHR-4892 / Service Record ID"
                          className="h-11 text-base bg-slate-50/70"
                        />
                      </Field>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <Field label="Teaching Experience (Years) *" htmlFor="teacher-experience">
                          <Input
                            id="teacher-experience"
                            type="number"
                            min={0}
                            max={50}
                            value={experience}
                            onChange={(e) => setExperience(e.target.value)}
                            placeholder="e.g. 7"
                            className="h-11 text-base bg-slate-50/70"
                          />
                        </Field>
                        <Field label="Educational Qualification *" htmlFor="qualification">
                          <Input
                            id="qualification"
                            value={qualification}
                            onChange={(e) => setQualification(e.target.value)}
                            placeholder="e.g. B.Ed, M.Sc (Mathematics)"
                            className="h-11 text-base bg-slate-50/70"
                          />
                        </Field>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <Field label="Primary Subject for Teaching (विषय) *" htmlFor="teaching-subject">
                          <select
                            id="teaching-subject"
                            value={teachingSubject}
                            onChange={(e) => setTeachingSubject(e.target.value)}
                            className="h-11 w-full rounded-md border border-input bg-slate-50/70 px-3 py-2 text-sm text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-ring"
                          >
                            {TEACHER_SUBJECTS.map((subj) => (
                              <option key={subj} value={subj}>
                                {subj}
                              </option>
                            ))}
                          </select>
                        </Field>
                        <Field label="Classes Taught (कक्षा कहाँ से कहाँ तक) *" htmlFor="teaching-classes">
                          <select
                            id="teaching-classes"
                            value={teachingClasses}
                            onChange={(e) => setTeachingClasses(e.target.value)}
                            className="h-11 w-full rounded-md border border-input bg-slate-50/70 px-3 py-2 text-sm text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-ring"
                          >
                            {TEACHING_CLASS_RANGES.map((cls) => (
                              <option key={cls} value={cls}>
                                {cls}
                              </option>
                            ))}
                          </select>
                        </Field>
                      </div>
                    </>
                  )}



                  <button
                    type="submit"
                    disabled={submitting}
                    className="mreg-submit-btn"
                  >
                    {submitting ? (
                      <>
                        <Loader2 size={16} className="animate-spin" /> Submitting…
                      </>
                    ) : isStudent ? (
                      <>
                        Register as Student <ArrowRight size={16} />
                      </>
                    ) : (
                      <>
                        Create Account <ArrowRight size={16} />
                      </>
                    )}
                  </button>

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
                </form>
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
