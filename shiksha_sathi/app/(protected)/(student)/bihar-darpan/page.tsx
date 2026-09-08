"use client";

import { Check, Sparkles, X } from "lucide-react";
import { useMemo, useState } from "react";

import { BIHAR_DAYS, biharDayIndex, type BiharText } from "@/lib/bihar-darpan";
import { useCopy } from "@/lib/copy";
import { useLocale } from "@/lib/locale-context";
import { cn } from "@/lib/utils";

export default function BiharDarpanPage() {
  const copy = useCopy();
  const { locale } = useLocale();
  const t = copy.biharDarpanPage;

  const todayIndex = useMemo(() => biharDayIndex(), []);
  const [selected, setSelected] = useState(todayIndex);
  const entry = BIHAR_DAYS[selected];

  // one language for headings/labels, both languages for the reading content
  const say = (x: BiharText) => (locale === "hi" ? x.hi : x.en);
  const other = (x: BiharText) => (locale === "hi" ? x.en : x.hi);

  return (
    <main className="flex flex-1 flex-col overflow-hidden">
      <div className="border-b border-border px-5 py-4">
        <h1 className="flex items-center gap-2 text-[15px]">
          <Sparkles className="size-4 text-terracotta" />
          {t.title}
        </h1>
        <p className="mt-0.5 text-xs text-muted-foreground">{t.sub}</p>
      </div>

      <div className="flex-1 overflow-y-auto px-5 py-4">
        <div className="mx-auto flex w-full max-w-2xl flex-col gap-4">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span
              className={cn(
                "rounded-full px-2 py-0.5 text-[11px] font-medium",
                selected === todayIndex
                  ? "bg-terracotta/10 text-terracotta"
                  : "bg-muted text-muted-foreground",
              )}
            >
              {selected === todayIndex ? t.todayBadge : t.dayLabel(entry.day)}
            </span>
            {selected === todayIndex && <span>{t.dayLabel(entry.day)}</span>}
          </div>

          {/* Thought of the day */}
          <section className="rounded-xl bg-card p-5 ring-1 ring-foreground/10">
            <h2 className="text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
              {t.quoteHeading}
            </h2>
            <blockquote className="mt-2 border-l-2 border-terracotta pl-3 text-[15px] leading-relaxed text-foreground">
              “{say(entry.quote)}”
            </blockquote>
            <p className="mt-2 border-l-2 border-transparent pl-3 text-sm text-muted-foreground italic">
              “{other(entry.quote)}”
            </p>
            <p className="mt-3 text-sm font-medium text-foreground">— {say(entry.author)}</p>
            <p className="mt-0.5 text-xs text-muted-foreground">{say(entry.about)}</p>
          </section>

          {/* Current affairs */}
          <section className="rounded-xl bg-card p-5 ring-1 ring-foreground/10">
            <h2 className="text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
              {t.affairsHeading}
            </h2>
            <ul className="mt-2 flex flex-col gap-2.5">
              {entry.affairs.map((a, i) => (
                <li key={i} className="flex gap-2 text-sm leading-relaxed">
                  <span className="mt-2 size-1.5 shrink-0 rounded-full bg-terracotta" />
                  <span>
                    <span className="text-foreground">{say(a)}</span>
                    <span className="mt-0.5 block text-xs text-muted-foreground">{other(a)}</span>
                  </span>
                </li>
              ))}
            </ul>
          </section>

          {/* Quiz */}
          <Quiz
            key={selected}
            entry={entry}
            say={say}
            other={other}
            labels={{
              heading: t.quizHeading,
              correct: t.quizCorrect,
              wrong: t.quizWrong,
            }}
          />

          {/* GK */}
          <section className="rounded-xl bg-card p-5 ring-1 ring-foreground/10">
            <h2 className="text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
              {t.gkHeading}
            </h2>
            <ul className="mt-2 flex flex-col gap-2.5">
              {entry.gk.map((g, i) => (
                <li key={i} className="flex gap-2 text-sm leading-relaxed">
                  <span className="mt-2 size-1.5 shrink-0 rounded-full bg-foreground/30" />
                  <span>
                    <span className="text-foreground">{say(g)}</span>
                    <span className="mt-0.5 block text-xs text-muted-foreground">{other(g)}</span>
                  </span>
                </li>
              ))}
            </ul>
          </section>

          {/* Browse all days */}
          <section className="pt-1">
            <h2 className="text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
              {t.browseHeading}
            </h2>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {BIHAR_DAYS.map((d, i) => (
                <button
                  key={d.day}
                  onClick={() => setSelected(i)}
                  className={cn(
                    "size-8 rounded-lg text-xs font-medium transition-colors",
                    i === selected
                      ? "bg-terracotta text-white"
                      : i === todayIndex
                        ? "bg-terracotta/10 text-terracotta hover:bg-terracotta/20"
                        : "bg-muted text-muted-foreground hover:bg-muted-foreground/20",
                  )}
                >
                  {d.day}
                </button>
              ))}
            </div>
          </section>

          <p className="pt-1 pb-2 text-[11px] leading-relaxed text-muted-foreground">
            {t.disclaimer}
          </p>
        </div>
      </div>
    </main>
  );
}

function Quiz({
  entry,
  say,
  other,
  labels,
}: {
  entry: (typeof BIHAR_DAYS)[number];
  say: (x: BiharText) => string;
  other: (x: BiharText) => string;
  labels: { heading: string; correct: string; wrong: string };
}) {
  const [picked, setPicked] = useState<number | null>(null);
  const answered = picked !== null;
  const right = picked === entry.quiz.answer;

  return (
    <section className="rounded-xl bg-card p-5 ring-1 ring-foreground/10">
      <h2 className="text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
        {labels.heading}
      </h2>
      <p className="mt-2 text-sm font-medium text-foreground">{say(entry.quiz.q)}</p>
      <p className="mt-0.5 text-xs text-muted-foreground">{other(entry.quiz.q)}</p>

      <div className="mt-3 flex flex-col gap-2">
        {entry.quiz.options.map((opt, i) => {
          const isAnswer = i === entry.quiz.answer;
          const isPicked = i === picked;
          return (
            <button
              key={i}
              disabled={answered}
              onClick={() => setPicked(i)}
              className={cn(
                "flex items-center justify-between rounded-lg border px-3 py-2 text-left text-sm transition-colors",
                !answered && "border-border hover:bg-muted",
                answered && isAnswer && "border-sage/60 bg-sage/10 text-earth",
                answered &&
                  isPicked &&
                  !isAnswer &&
                  "border-destructive/50 bg-destructive/10 text-destructive",
                answered && !isAnswer && !isPicked && "border-border opacity-70",
              )}
            >
              <span>{say(opt)}</span>
              {answered && isAnswer && <Check className="size-4 shrink-0 text-sage" />}
              {answered && isPicked && !isAnswer && (
                <X className="size-4 shrink-0 text-destructive" />
              )}
            </button>
          );
        })}
      </div>

      {answered && (
        <div className="mt-3 rounded-lg bg-muted p-3 text-sm">
          <p className={cn("font-medium", right ? "text-earth" : "text-destructive")}>
            {right ? labels.correct : labels.wrong}
          </p>
          <p className="mt-1 text-foreground">{say(entry.quiz.explain)}</p>
          <p className="mt-0.5 text-xs text-muted-foreground">{other(entry.quiz.explain)}</p>
        </div>
      )}
    </section>
  );
}
