"use client";

import { Pause, Play, RotateCcw } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { cn } from "@/lib/utils";

const PRESETS = [1, 3, 5, 10, 15, 20];

function fmt(totalSeconds: number): string {
  const s = Math.max(0, Math.ceil(totalSeconds));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${String(r).padStart(2, "0")}`;
}

export function ClassTimer() {
  const [duration, setDuration] = useState(5 * 60); // seconds
  const [remaining, setRemaining] = useState(5 * 60);
  const [running, setRunning] = useState(false);
  const [done, setDone] = useState(false);
  const endRef = useRef<number>(0);

  useEffect(() => {
    if (!running) return;
    endRef.current = Date.now() + remaining * 1000;
    const id = window.setInterval(() => {
      const left = (endRef.current - Date.now()) / 1000;
      if (left <= 0) {
        setRemaining(0);
        setRunning(false);
        setDone(true);
      } else {
        setRemaining(left);
      }
    }, 200);
    return () => window.clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [running]);

  function setTo(seconds: number) {
    setRunning(false);
    setDone(false);
    setDuration(seconds);
    setRemaining(seconds);
  }

  function toggle() {
    if (done) return;
    if (remaining <= 0) return;
    setRunning((r) => !r);
  }

  const pct = duration > 0 ? (remaining / duration) * 100 : 0;

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap gap-2">
        {PRESETS.map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => setTo(m * 60)}
            className={cn(
              "rounded-full border px-3 py-1 text-xs transition-colors",
              duration === m * 60 && !done
                ? "border-transparent bg-accent text-accent-foreground"
                : "border-border text-muted-foreground hover:bg-muted",
            )}
          >
            {m} min
          </button>
        ))}
        <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
          custom
          <input
            type="number"
            min={1}
            max={180}
            defaultValue={5}
            onChange={(e) => {
              const v = parseInt(e.target.value, 10);
              if (Number.isFinite(v) && v > 0) setTo(v * 60);
            }}
            className="h-7 w-14 rounded-lg border border-input bg-transparent px-2 text-sm outline-none focus-visible:border-ring"
          />
          min
        </label>
      </div>

      <div
        className={cn(
          "relative flex flex-col items-center justify-center gap-2 overflow-hidden rounded-2xl border px-4 py-14 text-center transition-colors",
          done ? "border-terracotta bg-terracotta/10" : "border-border bg-card",
        )}
      >
        <div
          className="absolute inset-x-0 bottom-0 bg-accent/60 transition-[height] duration-200"
          style={{ height: `${pct}%` }}
          aria-hidden
        />
        <div className="relative text-6xl font-medium tabular-nums">{fmt(remaining)}</div>
        <div className="relative text-[11px] tracking-[0.18em] text-muted-foreground uppercase">
          {done ? "Time's up" : running ? "Running" : "Paused"}
        </div>
      </div>

      <div className="flex gap-2">
        <button
          type="button"
          onClick={toggle}
          disabled={done || remaining <= 0}
          className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm text-primary-foreground disabled:opacity-40"
        >
          {running ? <Pause className="size-4" /> : <Play className="size-4" />}
          {running ? "Pause" : "Start"}
        </button>
        <button
          type="button"
          onClick={() => setTo(duration)}
          className="inline-flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm hover:bg-muted"
        >
          <RotateCcw className="size-4" /> Reset
        </button>
      </div>
    </div>
  );
}
