"use client";

import { Square, Volume2 } from "lucide-react";
import { useSyncExternalStore } from "react";

import { useCopy } from "@/lib/copy";
import { useProfile } from "@/lib/profile-context";
import {
  NOOP_SUBSCRIBE,
  getSpeakingId,
  speechSupported,
  subscribeSpeech,
  toggleSpeech,
} from "@/lib/speech";
import { cn } from "@/lib/utils";

/**
 * Read-aloud toggle for one block of generated content. `id` must be stable and
 * unique per block so only the block being read shows the "Stop" state.
 */
export function SpeakButton({
  id,
  text,
  className,
}: {
  id: string;
  text: string;
  className?: string;
}) {
  const copy = useCopy();
  const { profile } = useProfile();

  const supported = useSyncExternalStore(
    NOOP_SUBSCRIBE,
    () => speechSupported(),
    () => false,
  );
  const speakingId = useSyncExternalStore(
    subscribeSpeech,
    getSpeakingId,
    () => null,
  );
  const speaking = speakingId === id;

  if (!supported || !text.trim()) return null;

  return (
    <button
      type="button"
      onClick={() => toggleSpeech(id, text, { lang: profile?.preferred_language })}
      aria-pressed={speaking}
      className={cn(
        "inline-flex items-center gap-1 rounded-md px-1.5 py-1 text-[11px] transition-colors hover:bg-muted hover:text-foreground",
        speaking ? "text-terracotta" : "text-muted-foreground",
        className,
      )}
    >
      {speaking ? (
        <Square className="size-3 fill-current" />
      ) : (
        <Volume2 className="size-3" />
      )}
      {speaking ? copy.stopReading : copy.readAloud}
    </button>
  );
}
