"use client";

import { Dices, RotateCcw } from "lucide-react";
import { useState } from "react";

import { Field, ToolPanel } from "@/components/tools/form-kit";

function parseNames(raw: string): string[] {
  return raw
    .split(/[\n,]/)
    .map((s) => s.trim())
    .filter(Boolean);
}

export function NamePicker() {
  const [raw, setRaw] = useState("");
  const [noRepeat, setNoRepeat] = useState(true);
  const [picked, setPicked] = useState<string | null>(null);
  const [used, setUsed] = useState<string[]>([]);
  const [rolling, setRolling] = useState(false);

  const names = parseNames(raw);
  const pool = noRepeat ? names.filter((n) => !used.includes(n)) : names;
  const canPick = pool.length > 0 && !rolling;

  function pick() {
    if (!canPick) return;
    setRolling(true);
    let ticks = 0;
    const timer = window.setInterval(() => {
      setPicked(pool[Math.floor(Math.random() * pool.length)]);
      ticks += 1;
      if (ticks > 10) {
        window.clearInterval(timer);
        const final = pool[Math.floor(Math.random() * pool.length)];
        setPicked(final);
        if (noRepeat) setUsed((u) => [...u, final]);
        setRolling(false);
      }
    }, 60);
  }

  function reset() {
    setUsed([]);
    setPicked(null);
  }

  return (
    <div className="flex flex-col gap-5">
      <ToolPanel>
        <Field label="Class list" hint={`${names.length} name${names.length === 1 ? "" : "s"}`}>
          <textarea
            value={raw}
            onChange={(e) => setRaw(e.target.value)}
            rows={5}
            placeholder={"Aarav\nDiya\nKabir\n…"}
            className="w-full resize-y rounded-lg border border-input bg-transparent px-2.5 py-2 text-sm outline-none focus-visible:border-ring"
          />
        </Field>
        <label className="flex items-center gap-2 text-xs text-muted-foreground">
          <input
            type="checkbox"
            checked={noRepeat}
            onChange={(e) => setNoRepeat(e.target.checked)}
            className="size-3.5 accent-terracotta"
          />
          No repeats until everyone has been picked
        </label>
      </ToolPanel>

      <div className="flex flex-col items-center gap-3 rounded-xl border border-border bg-card px-4 py-10 text-center">
        <div className="text-[11px] tracking-[0.18em] text-muted-foreground uppercase">
          {rolling ? "Picking…" : picked ? "It's" : "Ready"}
        </div>
        <div className="min-h-[2.5rem] text-3xl font-medium">{picked ?? "—"}</div>
        {noRepeat && names.length > 0 && (
          <div className="text-xs text-muted-foreground">
            {used.length} of {names.length} picked
            {pool.length === 0 ? " · everyone's had a turn" : ""}
          </div>
        )}
      </div>

      <div className="flex gap-2">
        <button
          type="button"
          onClick={pick}
          disabled={!canPick}
          className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm text-primary-foreground disabled:opacity-40"
        >
          <Dices className="size-4" /> Pick a student
        </button>
        {noRepeat && used.length > 0 && (
          <button
            type="button"
            onClick={reset}
            className="inline-flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm hover:bg-muted"
          >
            <RotateCcw className="size-4" /> Reset
          </button>
        )}
      </div>
    </div>
  );
}
