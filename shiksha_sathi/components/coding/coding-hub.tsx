"use client";

import { Dialog } from "@base-ui/react/dialog";
import { ArrowRight, Clock3, Layers, type LucideIcon, MessageCircle, Sparkles } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  ACCENT_STYLES,
  CODING_COURSES,
  CODING_TUTORS,
  LEVEL_LABEL,
  type CodingCourse,
  type CodingTutor,
  courseDurationMinutes,
  formatDuration,
  getCodingCourse,
} from "@/lib/coding";
import { useStudentData } from "@/lib/student-context";
import { cn } from "@/lib/utils";

function SectionHeader({
  icon: Icon,
  title,
  subtitle,
}: {
  icon: LucideIcon;
  title: string;
  subtitle: string;
}) {
  return (
    <div className="flex items-center gap-2.5">
      <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-muted text-muted-foreground">
        <Icon className="size-4" />
      </span>
      <div>
        <h2 className="text-base font-medium">{title}</h2>
        <p className="text-xs text-muted-foreground">{subtitle}</p>
      </div>
    </div>
  );
}

function TutorCard({ tutor, onOpen }: { tutor: CodingTutor; onOpen: () => void }) {
  const styles = ACCENT_STYLES[tutor.accent];
  const course = getCodingCourse(tutor.courseSlug);
  const Icon = tutor.icon;

  return (
    <button
      type="button"
      onClick={onOpen}
      className="group flex items-start gap-3.5 rounded-2xl border border-border bg-card p-4 text-left transition-all hover:-translate-y-0.5 hover:shadow-md"
    >
      <span className={cn("flex size-11 shrink-0 items-center justify-center rounded-full", styles.icon)}>
        <Icon className="size-5" />
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-2">
          <span className="font-medium">{tutor.name}</span>
          <ArrowRight className="size-3.5 shrink-0 text-muted-foreground/50 transition-transform group-hover:translate-x-0.5 group-hover:text-foreground" />
        </div>
        <span className="text-xs text-muted-foreground">{tutor.role}</span>
        <p className="mt-2 line-clamp-2 text-[13px] text-muted-foreground">{tutor.bio}</p>
        {course ? (
          <span className={cn("mt-2.5 inline-flex rounded-full px-2 py-0.5 text-[11px] font-medium", styles.chip)}>
            Teaches {course.title}
          </span>
        ) : null}
      </div>
    </button>
  );
}

function TutorDialog({
  tutor,
  open,
  onOpenChange,
}: {
  tutor: CodingTutor | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const course = tutor ? getCodingCourse(tutor.courseSlug) : undefined;
  const styles = tutor ? ACCENT_STYLES[tutor.accent] : null;
  const Icon = tutor?.icon;

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Backdrop className="fixed inset-0 z-50 bg-black/40 transition-opacity data-[ending-style]:opacity-0 data-[starting-style]:opacity-0" />
        <Dialog.Popup
          className={cn(
            "fixed top-1/2 left-1/2 z-50 w-[min(26rem,calc(100vw-2rem))] -translate-x-1/2 -translate-y-1/2",
            "rounded-2xl border border-border bg-card p-5 text-card-foreground shadow-lg outline-none",
            "transition data-[ending-style]:scale-95 data-[ending-style]:opacity-0 data-[starting-style]:scale-95 data-[starting-style]:opacity-0",
          )}
        >
          {tutor && Icon && styles ? (
            <div className="flex flex-col items-center gap-3 text-center">
              <span className={cn("flex size-16 items-center justify-center rounded-full", styles.icon)}>
                <Icon className="size-7" />
              </span>
              <div>
                <Dialog.Title className="text-lg font-medium">{tutor.name}</Dialog.Title>
                <p className="text-sm text-muted-foreground">{tutor.role}</p>
              </div>
              <p className="text-sm text-muted-foreground">{tutor.bio}</p>

              <div className="flex flex-wrap justify-center gap-1.5">
                {tutor.specialties.map((s) => (
                  <span key={s} className="rounded-full bg-muted px-2.5 py-1 text-xs text-muted-foreground">
                    {s}
                  </span>
                ))}
              </div>

              {course ? (
                <Link
                  href={`/coding/${course.slug}`}
                  onClick={() => onOpenChange(false)}
                  className={cn(
                    "inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-medium transition-opacity hover:opacity-80",
                    styles.chip,
                  )}
                >
                  View {course.title}
                  <ArrowRight className="size-3" />
                </Link>
              ) : null}

              <div className="mt-2 flex w-full flex-col gap-2">
                <Button
                  className="w-full"
                  onClick={() =>
                    toast(`Live chat with ${tutor.name} is launching soon -- stay tuned!`)
                  }
                >
                  <MessageCircle className="size-4" />
                  Start a chat
                </Button>
                <Dialog.Close render={<Button variant="outline">Close</Button>} />
              </div>
            </div>
          ) : null}
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

function CourseCard({ course }: { course: CodingCourse }) {
  const styles = ACCENT_STYLES[course.accent];
  const Icon = course.icon;
  const minutes = courseDurationMinutes(course);

  return (
    <Link
      href={`/coding/${course.slug}`}
      className="group flex flex-col overflow-hidden rounded-2xl border border-border bg-card transition-all hover:-translate-y-0.5 hover:shadow-md"
    >
      <div className={cn("flex items-center gap-3 bg-gradient-to-br p-4", styles.gradient)}>
        <span className={cn("flex size-11 shrink-0 items-center justify-center rounded-xl", styles.icon)}>
          <Icon className="size-5" />
        </span>
        <div className="min-w-0">
          <p className="font-medium">{course.title}</p>
          <p className="text-xs text-muted-foreground">{course.tagline}</p>
        </div>
      </div>

      <div className="flex flex-1 flex-col gap-3 p-4">
        <p className="line-clamp-2 text-[13px] text-muted-foreground">{course.blurb}</p>
        <div className="mt-auto flex flex-wrap items-center gap-1.5">
          <span className={cn("rounded-full px-2 py-0.5 text-[11px] font-medium", styles.chip)}>
            {LEVEL_LABEL[course.level]}
          </span>
          <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-[11px] text-muted-foreground">
            <Clock3 className="size-3" />
            {formatDuration(minutes)}
          </span>
          <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-[11px] text-muted-foreground">
            <Layers className="size-3" />
            {course.modules.length} modules
          </span>
        </div>
        <span className="inline-flex items-center gap-1 text-sm font-medium text-foreground">
          View course
          <ArrowRight className="size-3.5 transition-transform group-hover:translate-x-0.5" />
        </span>
      </div>
    </Link>
  );
}

export function CodingHub() {
  const { firstName } = useStudentData();
  const [activeTutor, setActiveTutor] = useState<CodingTutor | null>(null);

  return (
    <main className="flex flex-1 flex-col overflow-y-auto">
      <div className="border-b border-border px-5 py-4">
        <h1 className="text-[15px]">Coding Hub</h1>
        <p className="mt-0.5 text-xs text-muted-foreground">
          Learn to code and build with AI -- pick a tutor or dive into a course.
        </p>
      </div>

      <div className="flex-1 px-5 py-6">
        <div className="mx-auto flex w-full max-w-5xl flex-col gap-9">
          <div className="rounded-2xl border border-violet/20 bg-gradient-to-br from-violet/10 via-transparent to-transparent p-6">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-card px-2.5 py-1 text-xs font-medium text-violet ring-1 ring-violet/15">
              <Sparkles className="size-3.5" />
              {firstName ? `Hi ${firstName}!` : "Welcome!"}
            </span>
            <h2 className="mt-3 text-xl font-medium text-balance">Ready to build something new?</h2>
            <p className="mt-1 max-w-lg text-sm text-muted-foreground">
              Learn Python and how to work with AI, one bite-sized lesson at a time.
            </p>
          </div>

          <section className="flex flex-col gap-4">
            <SectionHeader
              icon={MessageCircle}
              title="Tutors"
              subtitle="Meet your coding tutors and see what each one can help with."
            />
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {CODING_TUTORS.map((tutor) => (
                <TutorCard key={tutor.slug} tutor={tutor} onOpen={() => setActiveTutor(tutor)} />
              ))}
            </div>
          </section>

          <section className="flex flex-col gap-4">
            <SectionHeader
              icon={Layers}
              title="Courses"
              subtitle="Structured paths to build real skills, step by step."
            />
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {CODING_COURSES.map((course) => (
                <CourseCard key={course.slug} course={course} />
              ))}
            </div>
          </section>
        </div>
      </div>

      <TutorDialog
        tutor={activeTutor}
        open={activeTutor !== null}
        onOpenChange={(open) => {
          if (!open) setActiveTutor(null);
        }}
      />
    </main>
  );
}
