"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { motion } from "motion/react";
import { toast } from "sonner";

import { useAuth } from "@/lib/auth-context";
import type { RegisterRole, SchoolSearchResult } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SchoolTypeahead } from "@/components/auth/school-typeahead";
import { PendingScreen } from "@/components/auth/pending-screen";
import { cn } from "@/lib/utils";

const ROLES: { value: RegisterRole; label: string }[] = [
  { value: "principal", label: "Principal" },
  { value: "teacher", label: "Teacher" },
];

function RegisterForm() {
  const router = useRouter();
  const params = useSearchParams();
  const { status, register } = useAuth();

  const initialRole: RegisterRole =
    params.get("role") === "principal" ? "principal" : "teacher";

  const [role, setRole] = useState<RegisterRole>(initialRole);
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [mobile, setMobile] = useState("");
  const [school, setSchool] = useState<SchoolSearchResult | null>(null);
  const [employeeCode, setEmployeeCode] = useState("");
  const [experience, setExperience] = useState("");
  const [qualification, setQualification] = useState("");

  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (status === "authenticated") router.replace("/home");
  }, [status, router]);

  const mobileDigits = mobile.replace(/\D/g, "").replace(/^91(?=\d{10}$)/, "");
  const isTeacher = role === "teacher";

  const error = useMemo(() => {
    if (fullName.trim().length < 2) return "Enter your full name.";
    if (!email.includes("@")) return "Enter a valid email.";
    if (password.length < 8) return "Password must be at least 8 characters.";
    if (password !== confirm) return "Passwords don't match.";
    if (mobileDigits.length !== 10) return "Enter a valid 10-digit mobile number.";
    if (!school) return "Pick your school.";
    if (isTeacher && employeeCode.trim().length === 0)
      return "Employee code (government teacher ID) is required.";
    if (experience && (Number(experience) < 0 || Number(experience) > 50))
      return "Years of experience must be between 0 and 50.";
    return null;
  }, [
    fullName,
    email,
    password,
    confirm,
    mobileDigits,
    school,
    isTeacher,
    employeeCode,
    experience,
  ]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (error || !school) {
      if (error) toast.error(error);
      return;
    }
    setSubmitting(true);
    try {
      await register({
        role,
        full_name: fullName.trim(),
        email: email.trim(),
        password,
        mobile_number: mobileDigits,
        school_id: school.id,
        employee_code: isTeacher ? employeeCode.trim() : null,
        years_of_experience: isTeacher && experience ? Number(experience) : null,
        qualification: qualification.trim() || null,
      });
      setDone(true);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not register.");
      setSubmitting(false);
    }
  }

  return (
    <main className="sun-wash flex flex-1 flex-col items-center px-4 py-12">
      <div className="w-full max-w-md">
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, ease: "easeOut" }}
          className="mb-8 flex flex-col items-center gap-1 text-center"
        >
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">
            Create your account
          </h1>
          <p className="text-sm text-muted-foreground">
            {isTeacher
              ? "Your principal approves teacher accounts."
              : "An administrator approves principal accounts."}
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.1, ease: "easeOut" }}
        >
          <Card className="shadow-sm">
            <CardContent className="px-6 py-5">
              {done ? (
                <PendingScreen
                  approver={isTeacher ? "your principal" : "an administrator"}
                />
              ) : (
                <>
                  <div className="mb-5 grid grid-cols-2 rounded-lg border border-border p-0.5 text-sm">
                    {ROLES.map((r) => (
                      <button
                        key={r.value}
                        type="button"
                        onClick={() => setRole(r.value)}
                        className={cn(
                          "rounded-md py-1.5 font-medium tracking-wide transition-colors",
                          role === r.value
                            ? "bg-foreground text-background"
                            : "text-muted-foreground hover:text-foreground",
                        )}
                      >
                        {r.label}
                      </button>
                    ))}
                  </div>

                  <form onSubmit={handleSubmit} className="flex flex-col gap-4">
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

                    <Field label="School" htmlFor="school">
                      <SchoolTypeahead id="school" value={school} onChange={setSchool} />
                    </Field>

                    {isTeacher && (
                      <>
                        <Field
                          label="Employee code (government teacher ID)"
                          htmlFor="employee-code"
                        >
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

                    {!isTeacher && (
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

                    <Button
                      type="submit"
                      disabled={submitting}
                      className="mt-1 h-11 w-full text-base"
                    >
                      {submitting ? "Submitting…" : "Create account"}
                    </Button>
                  </form>

                  <p className="mt-4 text-center text-xs text-muted-foreground">
                    Already have an account?{" "}
                    <Link
                      href="/login"
                      className="text-primary underline-offset-2 hover:underline"
                    >
                      Log in
                    </Link>
                  </p>
                </>
              )}
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </main>
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
