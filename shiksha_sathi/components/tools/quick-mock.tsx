"use client";

import { Printer, RefreshCw } from "lucide-react";
import { useState } from "react";

import { Field, ToolPanel } from "@/components/tools/form-kit";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { cn } from "@/lib/utils";

const GRADES = Array.from({ length: 12 }, (_, i) => ({
  value: `Class ${i + 1}`,
  label: `Class ${i + 1}`,
}));
const COUNTS = ["5", "10", "15", "20"].map((v) => ({ value: v, label: `${v} questions` }));
const LEVELS = ["Easy", "Medium", "Hard"].map((v) => ({ value: v, label: v }));

const MCQ_STEMS = [
  "Which of the following best describes {t}?",
  "The main idea behind {t} is —",
  "{t} is most closely related to —",
  "Identify the correct statement about {t}.",
  "An everyday example of {t} is —",
  "Which factor most affects {t}?",
];
const SHORT_STEMS = [
  "Define {t} in one or two sentences.",
  "State two key features of {t}.",
  "Give one real-life example of {t} and explain it briefly.",
  "Why is {t} important? Give one reason.",
  "List the steps involved in {t}.",
];

type Paper = {
  topic: string;
  grade: string;
  level: string;
  mcq: { q: string; options: string[]; answer: number }[];
  short: string[];
  long: string;
  totalMarks: number;
};

function build(topic: string, grade: string, level: string, count: number): Paper {
  const t = topic.trim();
  const nMcq = Math.max(3, Math.round(count * 0.6));
  const nShort = Math.max(1, count - nMcq);

  const mcq = Array.from({ length: nMcq }, (_, i) => ({
    q: MCQ_STEMS[i % MCQ_STEMS.length].replaceAll("{t}", t),
    options: ["Option A", "Option B", "Option C", "Option D"],
    answer: (i * 2 + 1) % 4,
  }));
  const short = Array.from({ length: nShort }, (_, i) =>
    SHORT_STEMS[i % SHORT_STEMS.length].replaceAll("{t}", t),
  );
  const long = `Explain ${t} in detail with a suitable example or diagram.`;
  const totalMarks = nMcq * 1 + nShort * 3 + 5;
  return { topic: t, grade, level, mcq, short, long, totalMarks };
}

export function QuickMock() {
  const [topic, setTopic] = useState("");
  const [grade, setGrade] = useState<string | null>("Class 6");
  const [count, setCount] = useState<string | null>("10");
  const [level, setLevel] = useState<string | null>("Medium");
  const [withKey, setWithKey] = useState(true);
  const [paper, setPaper] = useState<Paper | null>(null);

  const canGen = topic.trim().length > 1 && grade && count && level;

  function generate() {
    if (!canGen) return;
    setPaper(build(topic, grade!, level!, parseInt(count!, 10)));
  }

  return (
    <div className="flex flex-col gap-5">
      <ToolPanel>
        <Field label="Topic" hint="A chapter name or a single concept works best.">
          <Input
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            placeholder="e.g. Photosynthesis"
            className="h-10 text-sm"
          />
        </Field>
        <div className="grid gap-3 sm:grid-cols-3">
          <Field label="Grade">
            <Select value={grade} onValueChange={setGrade} options={GRADES} className="h-10 w-full" />
          </Field>
          <Field label="Length">
            <Select value={count} onValueChange={setCount} options={COUNTS} className="h-10 w-full" />
          </Field>
          <Field label="Difficulty">
            <Select value={level} onValueChange={setLevel} options={LEVELS} className="h-10 w-full" />
          </Field>
        </div>
        <label className="flex items-center gap-2 text-xs text-muted-foreground">
          <input
            type="checkbox"
            checked={withKey}
            onChange={(e) => setWithKey(e.target.checked)}
            className="size-3.5 accent-terracotta"
          />
          Include answer key
        </label>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={generate}
            disabled={!canGen}
            className="inline-flex items-center gap-2 rounded-lg bg-primary px-3 py-2 text-sm text-primary-foreground disabled:opacity-40"
          >
            {paper ? <RefreshCw className="size-4" /> : null}
            {paper ? "Regenerate" : "Generate paper"}
          </button>
          {paper && (
            <button
              type="button"
              onClick={() => window.print()}
              className="inline-flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm hover:bg-muted"
            >
              <Printer className="size-4" /> Print
            </button>
          )}
        </div>
      </ToolPanel>

      {paper && (
        <article className="rounded-xl border border-border bg-card p-6 text-sm leading-relaxed print:border-0 print:p-0">
          <header className="border-b border-border pb-3 text-center">
            <h2 className="text-base font-medium">Mock Test — {paper.topic}</h2>
            <p className="mt-1 text-xs text-muted-foreground">
              {paper.grade} · {paper.level} · Max Marks: {paper.totalMarks} · Time: 40 min
            </p>
          </header>

          <section className="mt-4">
            <h3 className="text-xs font-semibold tracking-wide uppercase">
              Section A · Multiple choice (1 mark each)
            </h3>
            <ol className="mt-2 flex list-decimal flex-col gap-3 pl-5">
              {paper.mcq.map((m, i) => (
                <li key={i}>
                  <div>{m.q}</div>
                  <div className="mt-1 grid grid-cols-2 gap-x-4 gap-y-1 text-muted-foreground">
                    {m.options.map((o, j) => (
                      <span key={j}>
                        ({String.fromCharCode(97 + j)}) {o}
                      </span>
                    ))}
                  </div>
                </li>
              ))}
            </ol>
          </section>

          <section className="mt-5">
            <h3 className="text-xs font-semibold tracking-wide uppercase">
              Section B · Short answer (3 marks each)
            </h3>
            <ol
              className="mt-2 flex list-decimal flex-col gap-2 pl-5"
              start={paper.mcq.length + 1}
            >
              {paper.short.map((q, i) => (
                <li key={i}>{q}</li>
              ))}
            </ol>
          </section>

          <section className="mt-5">
            <h3 className="text-xs font-semibold tracking-wide uppercase">
              Section C · Long answer (5 marks)
            </h3>
            <ol
              className="mt-2 flex list-decimal flex-col gap-2 pl-5"
              start={paper.mcq.length + paper.short.length + 1}
            >
              <li>{paper.long}</li>
            </ol>
          </section>

          {withKey && (
            <section className="mt-6 border-t border-dashed border-border pt-3">
              <h3 className="text-xs font-semibold tracking-wide uppercase">Answer key</h3>
              <p className="mt-2 text-muted-foreground">
                {paper.mcq
                  .map((m, i) => `${i + 1}. (${String.fromCharCode(97 + m.answer)})`)
                  .join("   ")}
              </p>
              <p className="mt-1 text-muted-foreground">
                Section B &amp; C — evaluate on definitions, examples and clarity of
                explanation.
              </p>
            </section>
          )}

          <p className={cn("mt-6 text-[11px] text-muted-foreground print:hidden")}>
            Sample structure generated on your device. Wording is a template — connect
            the tool later for topic-specific questions.
          </p>
        </article>
      )}
    </div>
  );
}
