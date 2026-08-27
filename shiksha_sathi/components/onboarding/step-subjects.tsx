"use client";

import { Check, Loader2, Star } from "lucide-react";

import type { Grade, Subject } from "@/lib/api";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

export type SubjectGradeSelection = {
  subject_id: string;
  grade_id: string;
  is_primary: boolean;
};

type StepSubjectsProps = {
  grades: Grade[];
  subjects: Subject[];
  selections: SubjectGradeSelection[];
  loading: boolean;
  onToggle: (subjectId: string, gradeId: string) => void;
  onSetPrimary: (subjectId: string, gradeId: string) => void;
  onBack: () => void;
  onNext: () => void;
};

function pairKey(subjectId: string, gradeId: string) {
  return `${subjectId}:${gradeId}`;
}

export function StepSubjects({
  grades,
  subjects,
  selections,
  loading,
  onToggle,
  onSetPrimary,
  onBack,
  onNext,
}: StepSubjectsProps) {
  const selectedKeys = new Set(selections.map((s) => pairKey(s.subject_id, s.grade_id)));
  const canContinue = selections.length > 0;

  if (loading) {
    return (
      <div className="flex h-48 flex-col items-center justify-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="size-5 animate-spin" />
        Loading subjects and grades...
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h3 className="mb-1 text-sm font-medium">What do you teach?</h3>
        <p className="text-xs text-muted-foreground">
          Tap every subject and grade combination that applies.
        </p>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[280px] border-separate border-spacing-1">
          <thead>
            <tr>
              <th className="w-20 text-left text-xs font-medium text-muted-foreground" />
              {grades.map((grade) => (
                <th
                  key={grade.id}
                  className="px-1 pb-1 text-center text-xs font-medium text-muted-foreground"
                >
                  {grade.numeric_level}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {subjects.map((subject) => (
              <tr key={subject.id}>
                <td className="pr-2 text-sm font-medium">{subject.name}</td>
                {grades.map((grade) => {
                  const selected = selectedKeys.has(pairKey(subject.id, grade.id));
                  return (
                    <td key={grade.id} className="text-center">
                      <button
                        type="button"
                        onClick={() => onToggle(subject.id, grade.id)}
                        aria-pressed={selected}
                        aria-label={`${subject.name}, ${grade.label}`}
                        className={cn(
                          "flex size-9 items-center justify-center rounded-lg border transition-colors",
                          selected
                            ? "border-primary bg-primary text-primary-foreground"
                            : "border-border bg-transparent text-muted-foreground hover:bg-accent"
                        )}
                      >
                        {selected && <Check className="size-4" />}
                      </button>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {selections.length > 0 && (
        <div className="flex flex-col gap-2">
          <h3 className="text-sm font-medium">Which is your primary subject?</h3>
          <div className="flex flex-col gap-1.5">
            {selections.map((s) => {
              const subject = subjects.find((x) => x.id === s.subject_id);
              const grade = grades.find((x) => x.id === s.grade_id);
              return (
                <button
                  key={pairKey(s.subject_id, s.grade_id)}
                  type="button"
                  onClick={() => onSetPrimary(s.subject_id, s.grade_id)}
                  className={cn(
                    "flex items-center justify-between rounded-lg border px-3 py-2 text-left text-sm transition-colors",
                    s.is_primary ? "border-primary bg-accent" : "border-border hover:bg-accent/50"
                  )}
                >
                  <span>
                    {subject?.name} · {grade?.label}
                  </span>
                  <Star
                    className={cn(
                      "size-4",
                      s.is_primary ? "fill-primary text-primary" : "text-muted-foreground"
                    )}
                  />
                </button>
              );
            })}
          </div>
        </div>
      )}

      <div className="flex gap-2">
        <Button type="button" variant="outline" onClick={onBack} className="h-12 flex-1 text-base">
          Back
        </Button>
        <Button
          type="button"
          disabled={!canContinue}
          onClick={onNext}
          className="h-12 flex-1 text-base"
        >
          Continue
        </Button>
      </div>
    </div>
  );
}
