"use client";

import { cn } from "@/lib/utils";

/**
 * A real switch (`role="switch"`), not a styled checkbox: native button
 * semantics get keyboard (Space/Enter) and focus handling for free, and
 * `aria-checked` reports state to screen readers the way a checkbox's
 * `checked` alone doesn't always reliably announce across AT.
 */
export function Switch({
  checked,
  onChange,
  id,
  "aria-labelledby": ariaLabelledBy,
  "aria-describedby": ariaDescribedBy,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  id?: string;
  "aria-labelledby"?: string;
  "aria-describedby"?: string;
}) {
  return (
    <button
      type="button"
      id={id}
      role="switch"
      aria-checked={checked}
      aria-labelledby={ariaLabelledBy}
      aria-describedby={ariaDescribedBy}
      onClick={() => onChange(!checked)}
      className={cn(
        "relative inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full border transition-colors outline-none",
        "focus-visible:ring-3 focus-visible:ring-ring/50",
        checked ? "border-transparent bg-terracotta" : "border-border bg-muted",
      )}
    >
      <span
        aria-hidden
        className={cn(
          "inline-block size-3.5 translate-x-0.5 rounded-full bg-white shadow-sm transition-transform duration-150",
          checked && "translate-x-[18px]",
        )}
      />
    </button>
  );
}
