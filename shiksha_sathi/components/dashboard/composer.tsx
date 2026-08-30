"use client";

import { Loader2, SendHorizontal } from "lucide-react";
import { useRef, useState } from "react";

import { useCopy } from "@/lib/copy";

type ComposerProps = {
  onSend: (text: string) => void;
  disabled?: boolean;
  placeholder?: string;
};

export function Composer({ onSend, disabled, placeholder }: ComposerProps) {
  const copy = useCopy();
  const [value, setValue] = useState("");
  const taRef = useRef<HTMLTextAreaElement>(null);

  function resize() {
    const ta = taRef.current;
    if (!ta) return;
    ta.style.height = "auto";
    ta.style.height = `${Math.min(ta.scrollHeight, 128)}px`;
  }

  function submit() {
    const text = value.trim();
    if (!text || disabled) return;
    onSend(text);
    setValue("");
    requestAnimationFrame(resize);
  }

  return (
    <div className="border-t border-border p-3">
      <div className="mx-auto flex max-w-3xl items-end gap-2 rounded-xl border border-border bg-card px-3 py-2 focus-within:border-ring">
        <textarea
          ref={taRef}
          rows={1}
          value={value}
          onChange={(e) => {
            setValue(e.target.value);
            resize();
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              submit();
            }
          }}
          placeholder={placeholder ?? copy.inputPlaceholder}
          className="max-h-32 flex-1 resize-none bg-transparent py-1 text-sm outline-none placeholder:text-muted-foreground"
        />
        <button
          type="button"
          onClick={submit}
          disabled={disabled || value.trim().length === 0}
          aria-label={copy.send}
          className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground transition-opacity disabled:opacity-40"
        >
          {disabled ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <SendHorizontal className="size-4" />
          )}
        </button>
      </div>
    </div>
  );
}
