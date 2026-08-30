"use client";

import { FileText, Loader2, SendHorizontal, Upload, X } from "lucide-react";
import { useRef, useState } from "react";

type Turn = { id: string; q: string; a: string };

const SUGGESTIONS = [
  "Summarise this in 5 bullet points",
  "List the key terms with simple definitions",
  "Give me 5 questions I could ask the class",
  "Explain the hardest idea here like I'm 10",
];

function uid() {
  return typeof crypto !== "undefined" && crypto.randomUUID
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random()}`;
}

export function PdfQa() {
  const [fileName, setFileName] = useState<string | null>(null);
  const [question, setQuestion] = useState("");
  const [turns, setTurns] = useState<Turn[]>([]);
  const [thinking, setThinking] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  function pickFile(f: File | null | undefined) {
    if (!f) return;
    if (f.type !== "application/pdf" && !f.name.toLowerCase().endsWith(".pdf")) return;
    setFileName(f.name);
  }

  function ask(text: string) {
    const q = text.trim();
    if (!q || !fileName || thinking) return;
    setQuestion("");
    setThinking(true);
    const id = uid();
    // Frontend-only preview: no model call yet. Echo back a placeholder so the
    // flow is testable end to end.
    window.setTimeout(() => {
      setTurns((prev) => [
        ...prev,
        {
          id,
          q,
          a: `Once this tool is connected, Medha will read “${fileName}” and answer: “${q}”. For now this is a preview of the layout.`,
        },
      ]);
      setThinking(false);
    }, 600);
  }

  return (
    <div className="flex flex-col gap-4">
      <p className="rounded-lg border border-gold/40 bg-gold/10 px-3 py-2 text-xs text-muted-foreground">
        Preview — the upload and question flow work, but answers are placeholders
        until this tool is connected to your account.
      </p>

      {/* upload */}
      {fileName ? (
        <div className="flex items-center gap-2.5 rounded-xl border border-border bg-card p-3">
          <FileText className="size-4 shrink-0 text-terracotta" />
          <span className="min-w-0 flex-1 truncate text-sm">{fileName}</span>
          <button
            type="button"
            onClick={() => {
              setFileName(null);
              setTurns([]);
              if (inputRef.current) inputRef.current.value = "";
            }}
            className="rounded-lg p-1 text-muted-foreground hover:bg-muted"
            aria-label="Remove file"
          >
            <X className="size-4" />
          </button>
        </div>
      ) : (
        <label
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault();
            pickFile(e.dataTransfer.files?.[0]);
          }}
          className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-border bg-card px-4 py-10 text-center transition-colors hover:bg-muted"
        >
          <Upload className="size-5 text-muted-foreground" />
          <span className="text-sm">Drop a PDF here, or click to choose</span>
          <span className="text-xs text-muted-foreground">
            Chapter, notes, a circular — up to a few MB
          </span>
          <input
            ref={inputRef}
            type="file"
            accept="application/pdf,.pdf"
            className="hidden"
            onChange={(e) => pickFile(e.target.files?.[0])}
          />
        </label>
      )}

      {/* thread */}
      {turns.length > 0 && (
        <div className="flex flex-col gap-3">
          {turns.map((t) => (
            <div key={t.id} className="flex flex-col gap-2">
              <div className="self-end rounded-2xl rounded-br-sm bg-primary px-3 py-2 text-sm text-primary-foreground">
                {t.q}
              </div>
              <div className="self-start rounded-2xl rounded-bl-sm border border-border bg-card px-3 py-2 text-sm">
                {t.a}
              </div>
            </div>
          ))}
          {thinking && (
            <div className="flex items-center gap-2 self-start text-xs text-muted-foreground">
              <Loader2 className="size-3.5 animate-spin" /> reading…
            </div>
          )}
        </div>
      )}

      {/* suggestions */}
      {fileName && turns.length === 0 && (
        <div className="flex flex-wrap gap-2">
          {SUGGESTIONS.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => ask(s)}
              className="rounded-full border border-border px-3 py-1 text-xs text-muted-foreground hover:bg-muted"
            >
              {s}
            </button>
          ))}
        </div>
      )}

      {/* composer */}
      <div className="flex items-end gap-2 rounded-xl border border-border bg-card px-3 py-2 focus-within:border-ring">
        <textarea
          rows={1}
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              ask(question);
            }
          }}
          placeholder={fileName ? "Ask about this document…" : "Upload a PDF to start"}
          disabled={!fileName}
          className="max-h-32 flex-1 resize-none bg-transparent py-1 text-sm outline-none placeholder:text-muted-foreground disabled:opacity-60"
        />
        <button
          type="button"
          onClick={() => ask(question)}
          disabled={!fileName || question.trim().length === 0 || thinking}
          aria-label="Ask"
          className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground transition-opacity disabled:opacity-40"
        >
          <SendHorizontal className="size-4" />
        </button>
      </div>
    </div>
  );
}
