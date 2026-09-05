"use client";

import { Mic, Search } from "lucide-react";
import { useRouter } from "next/navigation";

import { useCopy } from "@/lib/copy";
import { cn } from "@/lib/utils";

/**
 * The pill-shaped "Ask Savra Ai"-style search bar from the SAVRA reference
 * (Home + History screens). It's a launcher, not an inline composer -- any
 * click anywhere on it (the input included) jumps straight to /ask, where
 * the real composer / voice input lives (Composer / VoiceChatLauncher).
 */
export function AskMedhaBar({ className }: { className?: string }) {
  const copy = useCopy();
  const router = useRouter();

  function go() {
    router.push("/ask");
  }

  return (
    <button
      type="button"
      onClick={go}
      className={cn(
        "flex items-center gap-2 rounded-full border border-violet/20 bg-violet-muted/60 px-4 py-2 text-left transition-colors hover:bg-violet-muted focus-visible:border-violet/40 focus-visible:outline-none",
        className,
      )}
    >
      <Search className="size-4 shrink-0 text-violet" />
      <span className="min-w-0 flex-1 truncate text-sm text-muted-foreground">
        {copy.askMedhaBarPlaceholder}
      </span>
      <span
        aria-label={copy.askMedhaBarMic}
        className="flex size-7 shrink-0 items-center justify-center rounded-full text-violet transition-colors hover:bg-violet/10"
      >
        <Mic className="size-4" />
      </span>
    </button>
  );
}
