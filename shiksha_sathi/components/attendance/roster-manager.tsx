"use client";

import { Plus, Trash2, UserPlus } from "lucide-react";
import { useState } from "react";

import { Input } from "@/components/ui/input";
import type { AttClass } from "@/lib/attendance-store";

export function RosterManager({
  classes,
  activeId,
  onAddClass,
  onRenameClass,
  onRemoveClass,
  onSelectClass,
  onAddStudents,
  onRemoveStudent,
}: {
  classes: AttClass[];
  activeId: string | null;
  onAddClass: (name: string) => void;
  onRenameClass: (id: string, name: string) => void;
  onRemoveClass: (id: string) => void;
  onSelectClass: (id: string) => void;
  onAddStudents: (classId: string, names: string[]) => void;
  onRemoveStudent: (classId: string, studentId: string) => void;
}) {
  const [newClass, setNewClass] = useState("");
  const [oneName, setOneName] = useState("");
  const [bulk, setBulk] = useState("");
  const [showBulk, setShowBulk] = useState(false);

  const active = classes.find((c) => c.id === activeId) ?? null;

  return (
    <div className="flex flex-col gap-6">
      {/* classes */}
      <section className="flex flex-col gap-2">
        <h2 className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
          Classes
        </h2>
        <div className="flex flex-wrap gap-2">
          {classes.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => onSelectClass(c.id)}
              className={
                "rounded-full border px-3 py-1 text-xs transition-colors " +
                (c.id === activeId
                  ? "border-transparent bg-accent text-accent-foreground"
                  : "border-border text-muted-foreground hover:bg-muted")
              }
            >
              {c.name} · {c.students.length}
            </button>
          ))}
        </div>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (newClass.trim()) {
              onAddClass(newClass);
              setNewClass("");
            }
          }}
          className="flex gap-2"
        >
          <Input
            value={newClass}
            onChange={(e) => setNewClass(e.target.value)}
            placeholder="Add a class, e.g. Class 6 – A"
            className="h-9 max-w-xs text-sm"
          />
          <button
            type="submit"
            className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 text-sm hover:bg-muted"
          >
            <Plus className="size-4" /> Add
          </button>
        </form>
      </section>

      {/* students of the active class */}
      {active ? (
        <section className="flex flex-col gap-3">
          <div className="flex items-center gap-2">
            <input
              value={active.name}
              onChange={(e) => onRenameClass(active.id, e.target.value)}
              className="min-w-0 flex-1 rounded-lg border border-transparent bg-transparent px-1 py-0.5 text-sm font-medium outline-none hover:border-border focus-visible:border-ring"
            />
            <button
              type="button"
              onClick={() => onRemoveClass(active.id)}
              className="inline-flex items-center gap-1.5 rounded-lg border border-border px-2 py-1 text-xs text-destructive hover:bg-muted"
            >
              <Trash2 className="size-3.5" /> Delete class
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (oneName.trim()) {
                  onAddStudents(active.id, [oneName]);
                  setOneName("");
                }
              }}
              className="flex gap-2"
            >
              <Input
                value={oneName}
                onChange={(e) => setOneName(e.target.value)}
                placeholder="Student name"
                className="h-9 w-48 text-sm"
              />
              <button
                type="submit"
                className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 text-sm text-primary-foreground"
              >
                <UserPlus className="size-4" /> Add
              </button>
            </form>
            <button
              type="button"
              onClick={() => setShowBulk((v) => !v)}
              className="text-xs text-muted-foreground underline underline-offset-2"
            >
              {showBulk ? "Hide" : "Paste a list"}
            </button>
          </div>

          {showBulk && (
            <div className="flex flex-col gap-2">
              <textarea
                value={bulk}
                onChange={(e) => setBulk(e.target.value)}
                rows={5}
                placeholder={"One name per line…"}
                className="w-full resize-y rounded-lg border border-input bg-transparent px-2.5 py-2 text-sm outline-none focus-visible:border-ring"
              />
              <button
                type="button"
                onClick={() => {
                  onAddStudents(
                    active.id,
                    bulk.split(/[\n,]/).map((s) => s.trim()).filter(Boolean),
                  );
                  setBulk("");
                  setShowBulk(false);
                }}
                className="w-fit rounded-lg border border-border px-3 py-1.5 text-sm hover:bg-muted"
              >
                Add all
              </button>
            </div>
          )}

          {active.students.length === 0 ? (
            <p className="text-sm text-muted-foreground">No students yet.</p>
          ) : (
            <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border">
              {active.students.map((s, i) => (
                <li key={s.id} className="flex items-center gap-3 bg-card px-3 py-2">
                  <span className="w-5 text-xs text-muted-foreground tabular-nums">
                    {i + 1}
                  </span>
                  <span className="flex-1 truncate text-sm">{s.name}</span>
                  <button
                    type="button"
                    onClick={() => onRemoveStudent(active.id, s.id)}
                    className="rounded-lg p-1 text-muted-foreground hover:bg-muted hover:text-destructive"
                    aria-label={`Remove ${s.name}`}
                  >
                    <Trash2 className="size-3.5" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>
      ) : (
        <p className="text-sm text-muted-foreground">
          Add a class above to start building its roster.
        </p>
      )}
    </div>
  );
}
