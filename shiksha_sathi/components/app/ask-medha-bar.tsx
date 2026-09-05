"use client";

import { Mic, Search } from "lucide-react";
import { useRouter } from "next/navigation";

import { useCopy } from "@/lib/copy";
import { cn } from "@/lib/utils";

/**
 * The pill-shaped "Ask Medha AI" search bar. It's a launcher, not an inline
 * composer -- any click anywhere on it jumps straight to /ask, where the real
 * composer / voice input lives (Composer / VoiceChatLauncher). `size="lg"` is
 * the dashboard-hero treatment; the default is the compact header pill.
 */
export function AskMedhaBar({
  className,
  size = "sm",
}: {
  className?: string;
  size?: "sm" | "lg";
}) {
  const copy = useCopy();
  const router = useRouter();

  function go() {
    router.push("/ask");
  }

  const lg = size === "lg";

  return (
    <button
      type="button"
      onClick={go}
      className={cn(
        "flex items-center rounded-full border border-violet/20 bg-violet-muted/60 text-left transition-colors hover:bg-violet-muted focus-visible:border-violet/40 focus-visible:outline-none",
        lg ? "gap-3 px-5 py-3" : "gap-2 px-4 py-2",
        className,
      )}
    >
      <Search className={cn("shrink-0 text-violet", lg ? "size-5" : "size-4")} />
      <span
        className={cn(
          "min-w-0 flex-1 truncate text-muted-foreground",
          lg ? "text-[15px]" : "text-sm",
        )}
      >
        {copy.askMedhaBarPlaceholder}
      </span>
      <span
        aria-label={copy.askMedhaBarMic}
        className={cn(
          "flex shrink-0 items-center justify-center rounded-full text-violet transition-colors hover:bg-violet/10",
          lg ? "size-9" : "size-7",
        )}
      >
        <Mic className={cn(lg ? "size-[18px]" : "size-4")} />
      </span>
    </button>
  );
}
