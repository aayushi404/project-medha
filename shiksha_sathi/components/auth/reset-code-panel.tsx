"use client";

import { useState } from "react";

import type { ResetCodeIssued } from "@/lib/api";
import { useCopy } from "@/lib/copy";

type Props = {
  issued: ResetCodeIssued;
  onClose: () => void;
};

/**
 * Shows a freshly issued login reset code. The code is only in memory here:
 * closing the panel discards it, and the server keeps only a hash.
 */
export function ResetCodePanel({ issued, onClose }: Props) {
  const copy = useCopy();
  const [copied, setCopied] = useState(false);
  const expires = new Date(issued.expires_at).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });

  async function copyCode() {
    try {
      await navigator.clipboard.writeText(issued.code);
      setCopied(true);
    } catch {
      // clipboard blocked: the code is on screen, so the person can still copy it by hand
    }
  }

  return (
    <div role="status" className="flex flex-col gap-2 rounded-xl bg-card p-4 ring-1 ring-foreground/10">
      <p className="text-sm font-medium text-foreground">{copy.resetCode.title(issued.full_name)}</p>
      <p className="select-all font-mono text-2xl tracking-widest text-terracotta">{issued.code}</p>
      <p className="text-xs text-muted-foreground">{copy.resetCode.expires(expires)}</p>
      <p className="text-xs text-muted-foreground">{copy.resetCode.hint}</p>
      <div className="mt-1 flex gap-2">
        <button
          type="button"
          onClick={copyCode}
          className="rounded-lg bg-muted px-3 py-1.5 text-xs font-medium text-foreground hover:bg-muted/70"
        >
          {copied ? copy.resetCode.copied : copy.resetCode.copy}
        </button>
        <button
          type="button"
          onClick={onClose}
          className="rounded-lg px-3 py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground"
        >
          {copy.resetCode.done}
        </button>
      </div>
    </div>
  );
}
