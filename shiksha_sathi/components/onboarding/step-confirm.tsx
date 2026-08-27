"use client";

import { Loader2 } from "lucide-react";

import type { Grade, SchoolSearchResult, Subject } from "@/lib/api";
import type { SubjectGradeSelection } from "@/components/onboarding/step-subjects";
import { Button } from "@/components/ui/button";

type StepConfirmProps = {
  fullName: string;
  school: SchoolSearchResult;
  selections: SubjectGradeSelection[];
  subjects: Subject[];
  grades: Grade[];
  submitting: boolean;
  error: string | null;
  onBack: () => void;
  onSubmit: () => void;
};

export function StepConfirm({
  fullName,
  school,
  selections,
  subjects,
  grades,
  submitting,
  error,
  onBack,
  onSubmit,
}: StepConfirmProps) {
  return (
    <div className="flex flex-col gap-5">
      <div>
        <h3 className="mb-1 text-sm font-medium">Confirm your details</h3>
        <p className="text-xs text-muted-foreground">You can go back to change anything.</p>
      </div>

      <dl className="flex flex-col gap-3 rounded-lg border border-border p-4 text-sm">
        <div className="flex justify-between gap-4">
          <dt className="text-muted-foreground">Name</dt>
          <dd className="text-right font-medium">{fullName}</dd>
        </div>
        <div className="flex justify-between gap-4">
          <dt className="text-muted-foreground">School</dt>
          <dd className="text-right font-medium">
            {school.name}
            <span className="block text-xs font-normal text-muted-foreground">
              {school.district_name}
            </span>
          </dd>
        </div>
        <div className="flex flex-col gap-1.5">
          <dt className="text-muted-foreground">Teaching</dt>
          <dd className="flex flex-col gap-1">
            {selections.map((s) => {
              const subject = subjects.find((x) => x.id === s.subject_id);
              const grade = grades.find((x) => x.id === s.grade_id);
              return (
                <span
                  key={`${s.subject_id}:${s.grade_id}`}
                  className="flex items-center gap-1.5 font-medium"
                >
                  {subject?.name} · {grade?.label}
                  {s.is_primary && (
                    <span className="rounded-full bg-accent px-1.5 py-0.5 text-[10px] font-medium text-accent-foreground">
                      Primary
                    </span>
                  )}
                </span>
              );
            })}
          </dd>
        </div>
      </dl>

      {error && (
        <p className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>
      )}

      <div className="flex gap-2">
        <Button
          type="button"
          variant="outline"
          onClick={onBack}
          disabled={submitting}
          className="h-12 flex-1 text-base"
        >
          Back
        </Button>
        <Button
          type="button"
          onClick={onSubmit}
          disabled={submitting}
          className="h-12 flex-1 text-base"
        >
          {submitting && <Loader2 className="size-4 animate-spin" />}
          Confirm & Finish
        </Button>
      </div>
    </div>
  );
}
