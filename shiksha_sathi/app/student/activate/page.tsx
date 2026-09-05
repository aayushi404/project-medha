"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion } from "motion/react";
import { toast } from "sonner";

import {
  activateStudent,
  getGrades,
  type Grade,
  type SchoolSearchResult,
} from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { SchoolTypeahead } from "@/components/auth/school-typeahead";

export default function StudentActivatePage() {
  const router = useRouter();
  const { status } = useAuth();

  const [fullName, setFullName] = useState("");
  const [school, setSchool] = useState<SchoolSearchResult | null>(null);
  const [gradeId, setGradeId] = useState<string | null>(null);
  const [rollNumber, setRollNumber] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");

  const [grades, setGrades] = useState<Grade[]>([]);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (status === "authenticated") router.replace("/home");
  }, [status, router]);

  useEffect(() => {
    getGrades()
      .then((g) => setGrades(g))
      .catch(() => {});
  }, []);

  const error = useMemo(() => {
    if (fullName.trim().length < 2) return "Enter your full name.";
    if (!school) return "Pick your school.";
    if (!gradeId) return "Select your class.";
    if (rollNumber.trim().length === 0) return "Enter your roll number.";
    if (!email.includes("@")) return "Enter a valid email.";
    if (password.length < 8) return "Password must be at least 8 characters.";
    if (password !== confirm) return "Passwords don't match.";
    return null;
  }, [fullName, school, gradeId, rollNumber, email, password, confirm]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (error || !school || !gradeId) {
      if (error) toast.error(error);
      return;
    }
    setSubmitting(true);
    try {
      await activateStudent({
        school_id: school.id,
        grade_id: gradeId,
        roll_number: rollNumber.trim(),
        full_name: fullName.trim(),
        email: email.trim(),
        password,
      });
      toast.success("Account activated. You can log in now.");
      router.replace("/login");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not activate.");
      setSubmitting(false);
    }
  }

  return (
    <div className="mreg-root">
      <main className="mreg-content">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, ease: "easeOut" }}
          className="mreg-step2-card"
        >
          <div className="mreg-form-header">
            <h2>Activate your account</h2>
            <p>
              Enter the details your teacher approved, then set an email and password to log in
              with.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="mreg-actual-form">
            <Field label="Full name" htmlFor="full-name">
              <Input
                id="full-name"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="As your teacher has it"
                className="h-11 text-base"
                autoFocus
              />
            </Field>

            <Field label="School" htmlFor="school">
              <SchoolTypeahead id="school" value={school} onChange={setSchool} />
            </Field>

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

            <button type="submit" disabled={submitting} className="mreg-submit-btn">
              {submitting ? "Activating…" : "Activate account"}
            </button>
          </form>

          <p className="mreg-form-bottom-hint">
            Haven&apos;t registered yet?{" "}
            <Link href="/register?role=student" className="mreg-link-highlight">
              Register as a student
            </Link>
          </p>
        </motion.div>
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
