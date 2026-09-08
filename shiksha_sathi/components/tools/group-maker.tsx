"use client";

import { Shuffle, Users } from "lucide-react";
import { useState } from "react";

import { Field, ToolPanel } from "@/components/tools/form-kit";
import { Select } from "@/components/ui/select";
import { cn } from "@/lib/utils";

function parseNames(raw: string): string[] {
  return raw
    .split(/[\n,]/)
    .map((s) => s.trim())
    .filter(Boolean);
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

const MODES = [
  { value: "size", label: "Students per group" },
  { value: "count", label: "Number of groups" },
];
const SIZES = ["2", "3", "4", "5", "6"].map((v) => ({ value: v, label: v }));

export function GroupMaker() {
  const [raw, setRaw] = useState("");
  const [mode, setMode] = useState<string | null>("size");
  const [n, setN] = useState<string | null>("4");
  const [groups, setGroups] = useState<string[][] | null>(null);

  const names = parseNames(raw);
  const canGo = names.length >= 2 && n;

  function make() {
    if (!canGo) return;
    const pool = shuffle(names);
    const value = parseInt(n!, 10);
    const groupCount =
      mode === "count" ? Math.max(1, value) : Math.max(1, Math.ceil(pool.length / value));
    const out: string[][] = Array.from({ length: groupCount }, () => []);
    pool.forEach((name, i) => out[i % groupCount].push(name));
    setGroups(out);
  }

  return (
    <div className="flex flex-col gap-5">
      <ToolPanel>
        <Field label="Class list" hint={`${names.length} name${names.length === 1 ? "" : "s"} · one per line or comma-separated`}>
          <textarea
            value={raw}
            onChange={(e) => setRaw(e.target.value)}
            rows={6}
            placeholder={"Aarav\nDiya\nKabir\nMeera\n…"}
            className="w-full resize-y rounded-lg border border-input bg-transparent px-2.5 py-2 text-sm outline-none focus-visible:border-ring"
          />
        </Field>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Split by">
            <Select value={mode} onValueChange={setMode} options={MODES} className="h-10 w-full" />
          </Field>
          <Field label={mode === "count" ? "How many groups" : "Group size"}>
            <Select value={n} onValueChange={setN} options={SIZES} className="h-10 w-full" />
          </Field>
        </div>
        <button
          type="button"
          onClick={make}
          disabled={!canGo}
          className="inline-flex w-fit items-center gap-2 rounded-lg bg-primary px-3 py-2 text-sm text-primary-foreground disabled:opacity-40"
        >
          <Shuffle className="size-4" />
          {groups ? "Shuffle again" : "Make groups"}
        </button>
      </ToolPanel>

      {groups && (
        <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
          {groups.map((g, i) => (
            <div key={i} className="rounded-xl border border-border bg-card p-3">
              <div className="mb-2 flex items-center gap-1.5 text-xs font-semibold tracking-wide text-terracotta uppercase">
                <Users className="size-3.5" /> Group {i + 1}
                <span className="ml-auto font-normal text-muted-foreground">{g.length}</span>
              </div>
              <ul className={cn("flex flex-col gap-1 text-sm")}>
                {g.map((name, j) => (
                  <li key={j}>{name}</li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
