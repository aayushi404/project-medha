"use client";

import { Printer, RefreshCw } from "lucide-react";
import { type ReactNode, useState } from "react";

import { Field, ToolPanel } from "@/components/tools/form-kit";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";

const GRADES = Array.from({ length: 12 }, (_, i) => ({
  value: `Class ${i + 1}`,
  label: `Class ${i + 1}`,
}));
const DURATIONS = ["30", "40", "45", "60"].map((v) => ({ value: v, label: `${v} minutes` }));

type Segment = { name: string; minutes: number; detail: string };
type Plan = { topic: string; grade: string; duration: number; objectives: string[]; materials: string[]; segments: Segment[]; homework: string; differentiation: string[] };

function build(topic: string, grade: string, duration: number): Plan {
  const t = topic.trim();
  // proportional split that always sums to `duration`
  const warm = Math.max(4, Math.round(duration * 0.12));
  const intro = Math.max(5, Math.round(duration * 0.18));
  const teach = Math.max(8, Math.round(duration * 0.3));
  const guided = Math.max(6, Math.round(duration * 0.2));
  const indep = Math.max(4, Math.round(duration * 0.13));
  const close = Math.max(2, duration - warm - intro - teach - guided - indep);

  return {
    topic: t,
    grade,
    duration,
    objectives: [
      `Explain what ${t} means in their own words`,
      `Identify ${t} in a real-life example`,
      `Apply ${t} to solve one practice problem or question`,
    ],
    materials: ["Blackboard / chart paper", "Textbook", `One everyday object or picture linked to ${t}`],
    segments: [
      { name: "Warm-up", minutes: warm, detail: `Ask what students already know about ${t}. Note answers on the board.` },
      { name: "Introduction", minutes: intro, detail: `Introduce ${t} with a short story or a familiar example. State today's goal.` },
      { name: "Direct teaching", minutes: teach, detail: `Explain ${t} step by step. Draw a labelled diagram. Check understanding with 2-3 quick questions.` },
      { name: "Guided practice", minutes: guided, detail: `Work through 2 examples together. Students try, you prompt.` },
      { name: "Independent practice", minutes: indep, detail: `Students attempt 3 questions on ${t} alone or in pairs. Circulate and help.` },
      { name: "Wrap-up", minutes: close, detail: `One-line recap from 3 students. Preview the next lesson.` },
    ],
    homework: `Two questions on ${t} from the textbook, plus: find one example of ${t} at home and write two sentences about it.`,
    differentiation: [
      "Struggling: give a worked example to copy and adapt.",
      "Advanced: add a 'why does this happen?' extension question.",
      "Language support: pair the key terms with a picture on the board.",
    ],
  };
}

export function LessonPlan() {
  const [topic, setTopic] = useState("");
  const [grade, setGrade] = useState<string | null>("Class 6");
  const [duration, setDuration] = useState<string | null>("40");
  const [plan, setPlan] = useState<Plan | null>(null);

  const canGen = topic.trim().length > 1 && grade && duration;

  function generate() {
    if (!canGen) return;
    setPlan(build(topic, grade!, parseInt(duration!, 10)));
  }

  return (
    <div className="flex flex-col gap-5">
      <ToolPanel>
        <Field label="Topic">
          <Input
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            placeholder="e.g. Types of soil"
            className="h-10 text-sm"
          />
        </Field>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Grade">
            <Select value={grade} onValueChange={setGrade} options={GRADES} className="h-10 w-full" />
          </Field>
          <Field label="Period length">
            <Select
              value={duration}
              onValueChange={setDuration}
              options={DURATIONS}
              className="h-10 w-full"
            />
          </Field>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={generate}
            disabled={!canGen}
            className="inline-flex items-center gap-2 rounded-lg bg-primary px-3 py-2 text-sm text-primary-foreground disabled:opacity-40"
          >
            {plan ? <RefreshCw className="size-4" /> : null}
            {plan ? "Rebuild" : "Build plan"}
          </button>
          {plan && (
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

      {plan && (
        <article className="rounded-xl border border-border bg-card p-6 text-sm leading-relaxed">
          <header className="border-b border-border pb-3">
            <h2 className="text-base font-medium">Lesson plan — {plan.topic}</h2>
            <p className="mt-1 text-xs text-muted-foreground">
              {plan.grade} · {plan.duration} minutes
            </p>
          </header>

          <Block title="Learning objectives">
            <ul className="list-disc pl-5">
              {plan.objectives.map((o, i) => (
                <li key={i}>{o}</li>
              ))}
            </ul>
          </Block>

          <Block title="Materials">
            <ul className="list-disc pl-5">
              {plan.materials.map((m, i) => (
                <li key={i}>{m}</li>
              ))}
            </ul>
          </Block>

          <Block title="Flow">
            <div className="flex flex-col gap-2">
              {plan.segments.map((s, i) => (
                <div key={i} className="flex gap-3">
                  <span className="w-14 shrink-0 text-xs text-muted-foreground tabular-nums">
                    {s.minutes} min
                  </span>
                  <span>
                    <span className="font-medium">{s.name}.</span> {s.detail}
                  </span>
                </div>
              ))}
            </div>
          </Block>

          <Block title="Homework">
            <p>{plan.homework}</p>
          </Block>

          <Block title="Differentiation">
            <ul className="list-disc pl-5">
              {plan.differentiation.map((d, i) => (
                <li key={i}>{d}</li>
              ))}
            </ul>
          </Block>
        </article>
      )}
    </div>
  );
}

function Block({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="mt-4">
      <h3 className="text-xs font-semibold tracking-wide uppercase">{title}</h3>
      <div className="mt-1.5 text-muted-foreground">{children}</div>
    </section>
  );
}
