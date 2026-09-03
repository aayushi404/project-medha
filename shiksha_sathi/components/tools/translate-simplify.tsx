"use client";

import { Copy, Loader2, Sparkles } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { Field, ToolPanel } from "@/components/tools/form-kit";
import { Select } from "@/components/ui/select";
import { translateText } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";

const LANGUAGES = [
  { value: "hi-BiharBoli", label: "Hindi (Bihari tone)" },
  { value: "hi", label: "Standard Hindi" },
  { value: "en", label: "Simple English" },
];

const MODES = [
  { value: "translate", label: "Translate" },
  { value: "simplify", label: "Simplify (same language)" },
];

const LEVELS = [
  { value: "class-6", label: "Class 6" },
  { value: "class-8", label: "Class 8" },
  { value: "class-10", label: "Class 10" },
];

export function TranslateSimplify() {
  const { accessToken } = useAuth();
  const [text, setText] = useState("");
  const [targetLanguage, setTargetLanguage] = useState<string | null>("hi-BiharBoli");
  const [mode, setMode] = useState<string | null>("translate");
  const [readingLevel, setReadingLevel] = useState<string | null>("class-6");
  const [result, setResult] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const canRun = text.trim().length > 10 && targetLanguage && mode && readingLevel;

  async function run() {
    if (!canRun) return;
    setBusy(true);
    setResult(null);
    try {
      const out = await translateText(accessToken, {
        text: text.trim(),
        target_language: targetLanguage!,
        mode: mode!,
        reading_level: readingLevel!,
      });
      setResult(out.result);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not translate. Try again.");
    } finally {
      setBusy(false);
    }
  }

  function copyResult() {
    if (!result) return;
    void navigator.clipboard.writeText(result);
    toast.success("Copied to clipboard");
  }

  return (
    <div className="flex flex-col gap-5">
      <ToolPanel>
        <Field label="Paste your text" hint="Textbook passage, circular, or notes">
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Paste the passage you want to translate or simplify…"
            rows={6}
            className="w-full resize-y rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-terracotta/30"
          />
        </Field>
        <div className="grid gap-3 sm:grid-cols-3">
          <Field label="Output language">
            <Select
              value={targetLanguage}
              onValueChange={setTargetLanguage}
              options={LANGUAGES}
              placeholder="Language"
              className="h-10 w-full"
            />
          </Field>
          <Field label="Mode">
            <Select
              value={mode}
              onValueChange={setMode}
              options={MODES}
              placeholder="Mode"
              className="h-10 w-full"
            />
          </Field>
          <Field label="Reading level">
            <Select
              value={readingLevel}
              onValueChange={setReadingLevel}
              options={LEVELS}
              placeholder="Level"
              className="h-10 w-full"
            />
          </Field>
        </div>
        <button
          type="button"
          disabled={!canRun || busy}
          onClick={() => void run()}
          className="flex h-10 items-center justify-center gap-2 rounded-lg bg-terracotta text-sm font-medium text-white disabled:opacity-50"
        >
          {busy ? <Loader2 className="size-4 animate-spin" /> : <Sparkles className="size-4" />}
          {mode === "simplify" ? "Simplify" : "Translate"}
        </button>
      </ToolPanel>

      {result ? (
        <div className="rounded-xl border border-border bg-card p-4">
          <div className="mb-2 flex items-center justify-between gap-2">
            <span className="text-xs font-medium text-muted-foreground">Result</span>
            <button
              type="button"
              onClick={copyResult}
              className="flex items-center gap-1 rounded-lg px-2 py-1 text-xs text-muted-foreground hover:bg-muted"
            >
              <Copy className="size-3.5" />
              Copy
            </button>
          </div>
          <p className="whitespace-pre-wrap text-sm leading-relaxed">{result}</p>
        </div>
      ) : null}
    </div>
  );
}
