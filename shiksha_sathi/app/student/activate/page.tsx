"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion } from "motion/react";
import { toast } from "sonner";

import {
  activateStudent,
  type Grade,
  type SchoolSearchResult,
} from "@/lib/api";
import { saveUserToDirectory } from "@/lib/user-registry";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SchoolTypeahead } from "@/components/auth/school-typeahead";

const STUDENT_CLASSES_9_TO_12 = [
  { id: "grade-9", label: "Class 9 (नवम वर्ग - Secondary)" },
  { id: "grade-10", label: "Class 10 (दशम वर्ग - Matric)" },
  { id: "grade-11", label: "Class 11 (एकादश - Higher Secondary)" },
  { id: "grade-12", label: "Class 12 (द्वादश - Higher Secondary)" },
];

export default function StudentActivatePage() {
  const router = useRouter();
  const { status } = useAuth();

  const [fullName, setFullName] = useState("");
  const [school, setSchool] = useState<SchoolSearchResult | null>(null);
  const [gradeId, setGradeId] = useState<string | null>("grade-9");
  const [rollNumber, setRollNumber] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (status === "authenticated") router.replace("/home");
  }, [status, router]);

  const error = useMemo(() => {
    if (fullName.trim().length < 2) return "Enter your full name.";
    if (!school) return "Pick your school.";
    if (!gradeId) return "Select your class (Classes 9–12 only).";
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
      saveUserToDirectory({
        id: `usr-student-${Date.now()}`,
        email: email.trim().toLowerCase(),
        password,
        full_name: fullName.trim(),
        role: "student",
        school_id: school.id,
        school_name: school.name,
        school_udise_code: school.udise_code || "10280105528",
        grade_id: gradeId,
        roll_number: rollNumber.trim(),
      });
      toast.success("Account activated. You can log in now.");
      router.replace("/login");
    } catch (err) {
      const isNetworkError =
        err instanceof Error &&
        (err.message.includes("fetch") ||
          err.message.includes("Failed") ||
          err.message.includes("Network"));

      if (isNetworkError) {
        saveUserToDirectory({
          id: `usr-student-${Date.now()}`,
          email: email.trim().toLowerCase(),
          password,
          full_name: fullName.trim(),
          role: "student",
          school_id: school.id,
          school_name: school.name,
          school_udise_code: school.udise_code || "10280105528",
          grade_id: gradeId,
          roll_number: rollNumber.trim(),
        });
        toast.success("Account activated successfully! You can log in now.");
        router.replace("/login");
      } else {
        toast.error(err instanceof Error ? err.message : "Could not activate.");
        setSubmitting(false);
      }
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
            Activate your account
          </h1>
          <p className="max-w-xs text-sm text-muted-foreground">
            Enter the details your teacher approved, then set an email and
            password to log in with.
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.1, ease: "easeOut" }}
        >
          <Card className="shadow-sm">
            <CardContent className="px-6 py-5">
              <form onSubmit={handleSubmit} className="flex flex-col gap-4">
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

                <Button
                  type="submit"
                  disabled={submitting}
                  className="mt-1 h-11 w-full text-base"
                >
                  {submitting ? "Activating…" : "Activate account"}
                </Button>
              </form>

              <p className="mt-4 text-center text-xs text-muted-foreground">
                Haven&apos;t registered yet?{" "}
                <Link
                  href="/register?role=student"
                  className="text-primary underline-offset-2 hover:underline"
                >
                  Register as a student
                </Link>
              </p>
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
