"use client";

import { cn } from "@/lib/utils";

type VoiceWaveformProps = {
  active?: boolean;
  bars?: number;
  className?: string;
};

/** Animated bars for voice recording / speaking states. */
export function VoiceWaveform({ active = false, bars = 5, className }: VoiceWaveformProps) {
  return (
    <div
      className={cn("flex items-end justify-center gap-1", className)}
      aria-hidden
    >
      {Array.from({ length: bars }, (_, i) => (
        <span
          key={i}
          className={cn(
            "w-1 rounded-full bg-terracotta transition-all duration-300",
            active ? "animate-pulse" : "opacity-40",
          )}
          style={{
            height: active ? `${12 + ((i * 7) % 20)}px` : "8px",
            animationDelay: active ? `${i * 0.12}s` : undefined,
          }}
        />
      ))}
    </div>
  );
}
