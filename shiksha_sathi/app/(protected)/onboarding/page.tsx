"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "motion/react";

import { useAuth } from "@/lib/auth-context";
import {
  apiFetch,
  extractErrorMessage,
  type Grade,
  type SchoolSearchResult,
  type Subject,
} from "@/lib/api";
import { StepProfile } from "@/components/onboarding/step-profile";
import { StepSubjects, type SubjectGradeSelection } from "@/components/onboarding/step-subjects";
import { StepConfirm } from "@/components/onboarding/step-confirm";
import { Card, CardContent } from "@/components/ui/card";

type Step = 1 | 2 | 3;

const STEP_TITLES: Record<Step, string> = {
  1: "Your profile",
  2: "What you teach",
  3: "Confirm",
};

export default function OnboardingPage() {
  const router = useRouter();
  const { teacher, accessToken, updateTeacher, logout } = useAuth();

  const [step, setStep] = useState<Step>(1);
  const [fullName, setFullName] = useState("");
  const [school, setSchool] = useState<SchoolSearchResult | null>(null);

  const [grades, setGrades] = useState<Grade[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [refLoading, setRefLoading] = useState(true);
  const [selections, setSelections] = useState<SubjectGradeSelection[]>([]);

  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // Already-onboarded teachers land here only via direct navigation -- bounce
  // them to the dashboard instead of letting them redo the wizard.
  useEffect(() => {
    if (teacher?.onboarded_at) {
      router.replace("/dashboard");
    }
  }, [teacher, router]);

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      apiFetch("/reference/grades").then((r) => r.json() as Promise<Grade[]>),
      apiFetch("/reference/subjects").then((r) => r.json() as Promise<Subject[]>),
    ]).then(([gradesData, subjectsData]) => {
      if (cancelled) return;
      setGrades(gradesData);
      setSubjects(subjectsData);
      setRefLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  function toggleSelection(subjectId: string, gradeId: string) {
    setSelections((prev) => {
      const existing = prev.find((s) => s.subject_id === subjectId && s.grade_id === gradeId);
      if (existing) {
        const next = prev.filter((s) => !(s.subject_id === subjectId && s.grade_id === gradeId));
        // keep exactly one primary pick whenever a selection remains
        if (existing.is_primary && next.length > 0) {
          next[0] = { ...next[0], is_primary: true };
        }
        return next;
      }
      const isFirst = prev.length === 0;
      return [...prev, { subject_id: subjectId, grade_id: gradeId, is_primary: isFirst }];
    });
  }

  function setPrimary(subjectId: string, gradeId: string) {
    setSelections((prev) =>
      prev.map((s) => ({
        ...s,
        is_primary: s.subject_id === subjectId && s.grade_id === gradeId,
      }))
    );
  }

  async function handleSubmit() {
    if (!school) return;
    setSubmitting(true);
    setSubmitError(null);
    try {
      const res = await apiFetch("/onboarding/complete", {
        method: "POST",
        token: accessToken,
        body: {
          full_name: fullName.trim(),
          school_id: school.id,
          subjects: selections,
        },
      });
      if (!res.ok) throw new Error(await extractErrorMessage(res));
      updateTeacher(await res.json());
      router.replace("/dashboard");
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setSubmitting(false);
    }
  }

  if (teacher?.onboarded_at) return null;

  return (
    <main className="sun-wash flex flex-1 flex-col items-center px-4 py-10">
      <div className="w-full max-w-sm">
        <div className="mb-6 flex flex-col items-center gap-3 text-center">
          <h1 className="text-xl font-semibold tracking-tight">{STEP_TITLES[step]}</h1>
          <div className="flex gap-1.5">
            {([1, 2, 3] as Step[]).map((s) => (
              <span
                key={s}
                className={
                  "h-1.5 rounded-full transition-all " +
                  (s === step ? "w-6 bg-primary" : s < step ? "w-1.5 bg-primary/60" : "w-1.5 bg-muted")
                }
              />
            ))}
          </div>
        </div>

        <Card className="overflow-hidden shadow-sm">
          <CardContent className="overflow-hidden px-6 py-4">
            <AnimatePresence mode="wait" initial={false}>
              <motion.div
                key={step}
                initial={{ opacity: 0, x: 24 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -24 }}
                transition={{ duration: 0.22, ease: "easeOut" }}
              >
                {step === 1 && (
                  <StepProfile
                    fullName={fullName}
                    onFullNameChange={setFullName}
                    selectedSchool={school}
                    onSelectSchool={setSchool}
                    onNext={() => setStep(2)}
                  />
                )}
                {step === 2 && (
                  <StepSubjects
                    grades={grades}
                    subjects={subjects}
                    selections={selections}
                    loading={refLoading}
                    onToggle={toggleSelection}
                    onSetPrimary={setPrimary}
                    onBack={() => setStep(1)}
                    onNext={() => setStep(3)}
                  />
                )}
                {step === 3 && school && (
                  <StepConfirm
                    fullName={fullName}
                    school={school}
                    selections={selections}
                    subjects={subjects}
                    grades={grades}
                    submitting={submitting}
                    error={submitError}
                    onBack={() => setStep(2)}
                    onSubmit={handleSubmit}
                  />
                )}
              </motion.div>
            </AnimatePresence>
          </CardContent>
        </Card>

        <button
          type="button"
          onClick={() => void logout()}
          className="mt-6 block w-full text-center text-xs text-muted-foreground transition-colors hover:text-foreground"
        >
          Not you? Log out
        </button>
      </div>
    </main>
  );
}
