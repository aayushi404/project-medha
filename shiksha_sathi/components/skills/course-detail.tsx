"use client";

import {
  ArrowLeft,
  CheckCircle2,
  ChevronDown,
  Clock3,
  Layers,
  MessageCircle,
  PlayCircle,
} from "lucide-react";
import Link from "next/link";
import { useRef, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  SKILL_ACCENT_STYLES,
  SKILL_LEVEL_LABEL,
  formatSkillDuration,
  getSkillCourse,
  skillCourseDurationMinutes,
  tutorsForSkillCourse,
} from "@/lib/skills";
import { cn } from "@/lib/utils";

function ModuleRow({
  index,
  title,
  summary,
  minutes,
  outcomes,
  expanded,
  onToggle,
  accentBar,
  moduleRef,
}: {
  index: number;
  title: string;
  summary: string;
  minutes: number;
  outcomes: string[];
  expanded: boolean;
  onToggle: () => void;
  accentBar: string;
  moduleRef?: (el: HTMLDivElement | null) => void;
}) {
  return (
    <div ref={moduleRef} className="overflow-hidden rounded-xl border border-border">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={expanded}
        className="flex w-full items-center gap-3 px-4 py-3.5 text-left transition-colors hover:bg-muted/50"
      >
        <span
          className={cn(
            "flex size-7 shrink-0 items-center justify-center rounded-full text-xs font-medium text-white",
            accentBar,
          )}
        >
          {index + 1}
        </span>
        <div className="min-w-0 flex-1">
          <p className="font-medium">{title}</p>
          <p className="line-clamp-1 text-xs text-muted-foreground">{summary}</p>
        </div>
        <span className="inline-flex shrink-0 items-center gap-1 text-xs text-muted-foreground">
          <Clock3 className="size-3" />
          {minutes} min
        </span>
        <ChevronDown
          className={cn("size-4 shrink-0 text-muted-foreground transition-transform", expanded && "rotate-180")}
        />
      </button>
      {expanded ? (
        <div className="border-t border-border bg-muted/30 px-4 py-3.5 pl-[3.25rem]">
          <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
            You&apos;ll be able to
          </p>
          <ul className="mt-2 flex flex-col gap-1.5">
            {outcomes.map((o) => (
              <li key={o} className="flex items-start gap-2 text-sm">
                <CheckCircle2 className="mt-0.5 size-3.5 shrink-0 text-sage" />
                {o}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}

export function CourseDetail({ slug }: { slug: string }) {
  const course = getSkillCourse(slug);
  const [openIndex, setOpenIndex] = useState<number | null>(null);
  const moduleRefs = useRef<(HTMLDivElement | null)[]>([]);

  if (!course) {
    return (
      <main className="flex flex-1 flex-col items-center justify-center gap-3 text-center text-sm text-muted-foreground">
        <p>That course isn&apos;t available.</p>
        <Link href="/skills" className="text-primary underline">
          Back to Skills
        </Link>
      </main>
    );
  }

  const styles = SKILL_ACCENT_STYLES[course.accent];
  const tutors = tutorsForSkillCourse(course.slug);
  const minutes = skillCourseDurationMinutes(course);

  function startCourse() {
    setOpenIndex(0);
    moduleRefs.current[0]?.scrollIntoView({ behavior: "smooth", block: "center" });
    toast("The full lesson player is launching soon -- for now, explore the syllabus below!");
  }

  return (
    <main className="flex flex-1 flex-col overflow-y-auto">
      <div className="border-b border-border px-5 py-4">
        <Link
          href="/skills"
          className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-3.5" />
          Skills
        </Link>
        <h1 className="mt-1 truncate text-[15px]">{course.title}</h1>
      </div>

      <div className="flex-1 px-5 py-6">
        <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
          <div className="overflow-hidden rounded-2xl border border-border bg-card">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={course.poster} alt={`${course.title} poster`} className="aspect-video w-full object-cover" />
            <div className="p-5">
              <p className="text-lg font-medium">{course.title}</p>
              <p className="text-sm text-muted-foreground">{course.tagline}</p>

              <p className="mt-4 text-sm text-muted-foreground">{course.blurb}</p>

              <div className="mt-4 flex flex-wrap items-center gap-1.5">
                <span className={cn("rounded-full px-2.5 py-1 text-xs font-medium", styles.chip)}>
                  {SKILL_LEVEL_LABEL[course.level]}
                </span>
                <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2.5 py-1 text-xs text-muted-foreground">
                  <Clock3 className="size-3" />
                  {formatSkillDuration(minutes)} total
                </span>
                <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2.5 py-1 text-xs text-muted-foreground">
                  <Layers className="size-3" />
                  {course.modules.length} modules
                </span>
              </div>

              <Button onClick={startCourse} className="mt-5 w-full sm:w-auto">
                <PlayCircle className="size-4" />
                Start course
              </Button>
            </div>
          </div>

          {tutors.length > 0 ? (
            <div className="flex flex-col gap-2 rounded-2xl border border-border bg-card p-4">
              <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
                {tutors.length > 1 ? "Tutors" : "Taught by"}
              </p>
              {tutors.map((tutor) => (
                <div key={tutor.slug} className="flex items-center gap-3">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={tutor.photo}
                    alt={tutor.name}
                    className="size-10 shrink-0 rounded-full object-cover"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium">
                      {tutor.name} <span className="text-muted-foreground">· {tutor.credential}</span>
                    </p>
                    <p className="line-clamp-1 text-xs text-muted-foreground">{tutor.bio}</p>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => toast(`Live chat with ${tutor.name} is launching soon -- stay tuned!`)}
                  >
                    <MessageCircle className="size-3.5" />
                    Chat
                  </Button>
                </div>
              ))}
            </div>
          ) : null}

          <section className="flex flex-col gap-3">
            <h2 className="text-sm font-medium tracking-wide text-muted-foreground uppercase">Syllabus</h2>
            <div className="flex flex-col gap-2">
              {course.modules.map((m, i) => (
                <ModuleRow
                  key={m.title}
                  moduleRef={(el) => {
                    moduleRefs.current[i] = el;
                  }}
                  index={i}
                  title={m.title}
                  summary={m.summary}
                  minutes={m.minutes}
                  outcomes={m.outcomes}
                  expanded={openIndex === i}
                  onToggle={() => setOpenIndex((cur) => (cur === i ? null : i))}
                  accentBar={styles.bar}
                />
              ))}
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}
