"use client";

import { Check, Star } from "lucide-react";

import type { Grade, Subject } from "@/lib/api";
import { cn } from "@/lib/utils";

export type SubjectSelection = { subject_id: string; grade_id: string; is_primary: boolean };

function pairKey(subjectId: string, gradeId: string) {
  return `${subjectId}:${gradeId}`;
}

type SubjectsEditorProps = {
  grades: Grade[];
  subjects: Subject[];
  selections: SubjectSelection[];
  onToggle: (subjectId: string, gradeId: string) => void;
  onSetPrimary: (subjectId: string, gradeId: string) => void;
};

export function SubjectsEditor({
  grades,
  subjects,
  selections,
  onToggle,
  onSetPrimary,
}: SubjectsEditorProps) {
  const selectedKeys = new Set(selections.map((s) => pairKey(s.subject_id, s.grade_id)));

  return (
    <div className="flex flex-col gap-4">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[280px] border-separate border-spacing-1">
          <thead>
            <tr>
              <th className="w-20" />
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
                            : "border-border bg-transparent text-muted-foreground hover:bg-accent",
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
          <h3 className="text-sm font-medium">Primary subject</h3>
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
                    s.is_primary ? "border-primary bg-accent" : "border-border hover:bg-accent/50",
                  )}
                >
                  <span>
                    {subject?.name} · {grade?.label}
                  </span>
                  <Star
                    className={cn(
                      "size-4",
                      s.is_primary ? "fill-primary text-primary" : "text-muted-foreground",
                    )}
                  />
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
