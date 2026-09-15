"use client";

import { Dialog } from "@base-ui/react/dialog";
import { Plus, X } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import type { QuizQ } from "@/components/quiz-live/types";
import { cn } from "@/lib/utils";

const DIFFICULTIES: QuizQ["difficulty"][] = ["easy", "medium", "hard"];
const DIFFICULTY_LABEL: Record<QuizQ["difficulty"], string> = {
  easy: "Easy",
  medium: "Standard",
  hard: "Hard",
};

/** Edits one question at a time -- text, options, correct answer, difficulty
 *  -- following the same field conventions as the existing quiz editor
 *  (components/generation/generation-view.tsx QuizEditor: options as inputs
 *  with add/remove, answer as a <select> built from the options) without
 *  reusing that component wholesale, since it edits a whole quiz at once and
 *  this dialog edits a single question inline over a carousel. */
export function QuestionEditDialog({
  open,
  question,
  onOpenChange,
  onSave,
}: {
  open: boolean;
  question: QuizQ | null;
  onOpenChange: (open: boolean) => void;
  onSave: (next: QuizQ) => void;
}) {
  const [draft, setDraft] = useState<QuizQ | null>(null);

  // Re-seed the draft whenever the dialog transitions to open -- adjusting
  // state during render (React's documented alternative to an Effect here)
  // rather than after paint, so a re-open after Cancel always starts from
  // the current question instead of the discarded draft.
  const [prevOpen, setPrevOpen] = useState(open);
  if (open !== prevOpen) {
    setPrevOpen(open);
    if (open && question) setDraft(JSON.parse(JSON.stringify(question)) as QuizQ);
  }

  function patch(next: Partial<QuizQ>) {
    setDraft((d) => (d ? { ...d, ...next } : d));
  }

  function save() {
    if (!draft) return;
    onSave(draft);
    onOpenChange(false);
  }

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Backdrop className="fixed inset-0 z-50 bg-black/40 transition-opacity data-[ending-style]:opacity-0 data-[starting-style]:opacity-0" />
        <Dialog.Popup
          className={cn(
            "fixed top-1/2 left-1/2 z-50 w-[min(32rem,calc(100vw-2rem))] -translate-x-1/2 -translate-y-1/2",
            "max-h-[85vh] overflow-y-auto rounded-2xl border border-border bg-card p-5 text-card-foreground shadow-lg outline-none",
            "transition data-[ending-style]:scale-95 data-[ending-style]:opacity-0 data-[starting-style]:scale-95 data-[starting-style]:opacity-0",
          )}
        >
          <Dialog.Title className="text-base font-medium">Edit question</Dialog.Title>

          {draft ? (
            <div className="mt-4 flex flex-col gap-4">
              <label className="flex flex-col gap-1.5">
                <span className="text-xs font-medium text-muted-foreground">Question</span>
                <textarea
                  value={draft.q}
                  onChange={(e) => patch({ q: e.target.value })}
                  rows={3}
                  className="w-full resize-y rounded-lg border border-border bg-background px-2.5 py-2 text-sm outline-none focus:border-ring"
                />
              </label>

              <div className="flex flex-col gap-1.5">
                <span className="text-xs font-medium text-muted-foreground">Options</span>
                {(draft.options ?? []).map((opt, oi) => (
                  <div key={oi} className="flex items-center gap-1.5">
                    <span className="w-4 shrink-0 text-xs font-medium text-muted-foreground">
                      {String.fromCharCode(65 + oi)}
                    </span>
                    <input
                      value={opt}
                      onChange={(e) =>
                        patch({
                          options: draft.options.map((o, idx) => (idx === oi ? e.target.value : o)),
                        })
                      }
                      className="flex-1 rounded-lg border border-border bg-background px-2.5 py-1.5 text-sm outline-none focus:border-ring"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        const nextOptions = draft.options.filter((_, idx) => idx !== oi);
                        patch({
                          options: nextOptions,
                          answer: nextOptions.includes(draft.answer) ? draft.answer : "",
                        });
                      }}
                      disabled={(draft.options ?? []).length <= 2}
                      aria-label="Remove option"
                      className="shrink-0 rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-destructive disabled:opacity-30"
                    >
                      <X className="size-3.5" />
                    </button>
                  </div>
                ))}
                {(draft.options ?? []).length < 6 ? (
                  <button
                    type="button"
                    onClick={() => patch({ options: [...(draft.options ?? []), ""] })}
                    className="inline-flex items-center gap-1 self-start rounded-md px-1.5 py-1 text-xs text-muted-foreground hover:bg-muted"
                  >
                    <Plus className="size-3.5" />
                    Add option
                  </button>
                ) : null}
              </div>

              <div className="flex flex-wrap items-end gap-3">
                <label className="flex flex-col gap-1 text-xs">
                  <span className="font-medium text-muted-foreground">Correct answer</span>
                  <select
                    value={draft.answer}
                    onChange={(e) => patch({ answer: e.target.value })}
                    className="rounded-lg border border-border bg-background px-2.5 py-1.5 text-sm outline-none focus:border-ring"
                  >
                    <option value="">—</option>
                    {(draft.options ?? []).map((o, oi) => (
                      <option key={oi} value={o}>
                        {String.fromCharCode(65 + oi)}. {o || "(empty)"}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="flex flex-col gap-1 text-xs">
                  <span className="font-medium text-muted-foreground">Difficulty</span>
                  <select
                    value={draft.difficulty}
                    onChange={(e) => patch({ difficulty: e.target.value as QuizQ["difficulty"] })}
                    className="rounded-lg border border-border bg-background px-2.5 py-1.5 text-sm outline-none focus:border-ring"
                  >
                    {DIFFICULTIES.map((d) => (
                      <option key={d} value={d}>
                        {DIFFICULTY_LABEL[d]}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
            </div>
          ) : null}

          <div className="mt-5 flex justify-end gap-2">
            <Dialog.Close render={<Button variant="outline">Cancel</Button>} />
            <Button
              onClick={save}
              disabled={!draft || !draft.q.trim() || !draft.answer}
            >
              Save
            </Button>
          </div>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
