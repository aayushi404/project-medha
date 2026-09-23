"use client";

import {
  ArrowLeft,
  CheckCircle2,
  ChevronDown,
  Clock3,
  ExternalLink,
  Globe,
  Languages,
  Layers,
  MessageCircle,
  PlayCircle,
} from "lucide-react";
import Link from "next/link";
import { useRef, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  ACCENT_STYLES,
  LEVEL_LABEL,
  type CodingModule,
  courseDurationMinutes,
  formatDuration,
  getCodingCourse,
  getCodingTutor,
  getModuleVideos,
  tutorsForCourse,
  youtubeEmbedUrl,
  youtubeWatchUrl,
} from "@/lib/coding";
import { cn } from "@/lib/utils";

function ModuleRow({
  index,
  title,
  summary,
  minutes,
  outcomes,
  video,
  videos,
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
  video?: CodingModule["video"];
  videos?: CodingModule["videos"];
  expanded: boolean;
  onToggle: () => void;
  accentBar: string;
  moduleRef?: (el: HTMLDivElement | null) => void;
}) {
  const allVideos = getModuleVideos({ title, summary, minutes, outcomes, video, videos });
  const [selectedLangIndex, setSelectedLangIndex] = useState(0);

  const activeVideo = allVideos[selectedLangIndex] || allVideos[0];
  const videoTutor = activeVideo ? getCodingTutor(activeVideo.tutorSlug) : undefined;
  const hasMultipleVideos = allVideos.length > 1;
  const hasVideo = allVideos.length > 0;

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
        {hasVideo ? (
          <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-violet/10 px-2 py-0.5 text-[11px] font-medium text-violet">
            <PlayCircle className="size-3" />
            Video {hasMultipleVideos ? "(Hindi & Maithili)" : ""}
          </span>
        ) : null}
        <span className="inline-flex shrink-0 items-center gap-1 text-xs text-muted-foreground">
          <Clock3 className="size-3" />
          {minutes} min
        </span>
        <ChevronDown
          className={cn("size-4 shrink-0 text-muted-foreground transition-transform", expanded && "rotate-180")}
        />
      </button>
      {expanded ? (
        <div className="border-t border-border bg-muted/30 px-4 py-3.5 pl-4 sm:pl-[3.25rem]">
          {hasVideo && activeVideo ? (
            <div className="mb-4">
              {hasMultipleVideos ? (
                <div className="mb-3 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border bg-card p-2 shadow-2xs">
                  <div className="flex items-center gap-1.5 px-1 text-xs font-medium text-foreground">
                    <Globe className="size-3.5 text-violet" />
                    <span>Select Language:</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    {allVideos.map((v, idx) => {
                      const isSelected = idx === selectedLangIndex;
                      return (
                        <button
                          key={v.youtubeId + (v.languageCode || idx)}
                          type="button"
                          onClick={() => setSelectedLangIndex(idx)}
                          className={cn(
                            "flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-all",
                            isSelected
                              ? "bg-violet text-white shadow-xs"
                              : "bg-muted text-muted-foreground hover:bg-muted/80 hover:text-foreground"
                          )}
                        >
                          <Languages className="size-3" />
                          <span>{v.language || (v.languageCode === "mai" ? "Maithili (मैथिली)" : "Hindi (हिंदी)")}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              ) : null}

              <div className="aspect-video w-full overflow-hidden rounded-xl border border-border bg-black shadow-md">
                <iframe
                  src={youtubeEmbedUrl(activeVideo.youtubeId)}
                  title={`${title} -- video lesson`}
                  className="h-full w-full"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                  allowFullScreen
                />
              </div>

              <div className="mt-2 flex items-center justify-between text-xs text-muted-foreground">
                {videoTutor ? (
                  <span>Taught by <span className="font-medium text-foreground">{videoTutor.name}</span></span>
                ) : (
                  <span />
                )}
                <a
                  href={youtubeWatchUrl(activeVideo.youtubeId)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-xs font-medium text-violet hover:underline"
                >
                  <span>Watch on YouTube</span>
                  <ExternalLink className="size-3" />
                </a>
              </div>
            </div>
          ) : null}
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
  const course = getCodingCourse(slug);
  const [openIndex, setOpenIndex] = useState<number | null>(null);
  const moduleRefs = useRef<(HTMLDivElement | null)[]>([]);

  if (!course) {
    return (
      <main className="flex flex-1 flex-col items-center justify-center gap-3 text-center text-sm text-muted-foreground">
        <p>That course isn&apos;t available.</p>
        <Link href="/coding" className="text-primary underline">
          Back to Coding Hub
        </Link>
      </main>
    );
  }

  const styles = ACCENT_STYLES[course.accent];
  const tutors = tutorsForCourse(course.slug);
  const minutes = courseDurationMinutes(course);

  function startCourse() {
    setOpenIndex(0);
    moduleRefs.current[0]?.scrollIntoView({ behavior: "smooth", block: "center" });
    toast("The full lesson player is launching soon -- for now, explore the syllabus below!");
  }

  return (
    <main className="flex flex-1 flex-col overflow-y-auto">
      <div className="border-b border-border px-5 py-4">
        <Link
          href="/coding"
          className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-3.5" />
          Coding Hub
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
                  {LEVEL_LABEL[course.level]}
                </span>
                <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2.5 py-1 text-xs text-muted-foreground">
                  <Clock3 className="size-3" />
                  {formatDuration(minutes)} total
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
                  video={m.video}
                  videos={m.videos}
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
