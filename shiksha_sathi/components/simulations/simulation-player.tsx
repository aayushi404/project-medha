"use client";

import { ArrowLeft, ExternalLink, Maximize, Minimize } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";

import {
  PHET_ATTRIBUTION,
  SIM_SUBJECTS,
  getSimulation,
  phetPageUrl,
  phetSimUrl,
} from "@/lib/simulations";
import { useCopy } from "@/lib/copy";
import { cn } from "@/lib/utils";

export function SimulationPlayer({
  slug,
  basePath,
}: {
  slug: string;
  basePath: string;
}) {
  const copy = useCopy();
  const [expanded, setExpanded] = useState(false);
  const frameRef = useRef<HTMLDivElement>(null);
  const sim = getSimulation(slug);

  const enter = useCallback(() => {
    setExpanded(true);
    // Native fullscreen on top (hides the browser chrome too) -- best effort:
    // some locked-down/embedded devices refuse it, the CSS overlay still works.
    frameRef.current?.requestFullscreen?.().catch(() => {});
  }, []);

  const exit = useCallback(() => {
    setExpanded(false);
    if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
  }, []);

  // Esc out of native fullscreen -> drop the CSS overlay too.
  useEffect(() => {
    const onChange = () => {
      if (!document.fullscreenElement) setExpanded(false);
    };
    document.addEventListener("fullscreenchange", onChange);
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, []);

  // When there is no native fullscreen, Esc still needs to close the overlay.
  useEffect(() => {
    if (!expanded) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !document.fullscreenElement) setExpanded(false);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [expanded]);

  if (!sim) {
    return (
      <main className="flex flex-1 flex-col items-center justify-center gap-3 text-center text-sm text-muted-foreground">
        <p>{copy.simulations.notFound}</p>
        <Link href={basePath} className="text-primary underline">
          {copy.simulations.back}
        </Link>
      </main>
    );
  }

  const [a, b] = sim.grades;
  const subjectLabel =
    SIM_SUBJECTS.find((s) => s.key === sim.subject)?.label ?? sim.subject;

  return (
    <main className="flex flex-1 flex-col overflow-hidden">
      <div className="flex items-center justify-between gap-3 border-b border-border px-5 py-4">
        <div className="min-w-0">
          <Link
            href={basePath}
            className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="size-3.5" />
            {copy.simulations.back}
          </Link>
          <h1 className="mt-1 truncate text-[15px]">{sim.title}</h1>
          <div className="mt-1 flex flex-wrap gap-1">
            <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] text-muted-foreground">
              {subjectLabel}
            </span>
            <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] text-muted-foreground">
              {copy.simulations.grades(a, b)}
            </span>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <button
            type="button"
            onClick={enter}
            className="inline-flex items-center gap-1.5 rounded-lg border border-border px-2.5 py-1.5 text-xs text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <Maximize className="size-3.5" />
            {copy.simulations.fullscreen}
          </button>
          <a
            href={phetPageUrl(sim.phetId)}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 rounded-lg border border-border px-2.5 py-1.5 text-xs text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <ExternalLink className="size-3.5" />
            {copy.simulations.openOnPhet}
          </a>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-5 py-5">
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-4">
          <div
            ref={frameRef}
            className={cn(
              "group relative bg-card",
              expanded
                ? "fixed inset-0 z-50"
                : "aspect-[834/504] w-full overflow-hidden rounded-xl border border-border",
            )}
          >
            <iframe
              src={phetSimUrl(sim.phetId)}
              title={sim.title}
              loading="lazy"
              allow="fullscreen"
              allowFullScreen
              className="absolute inset-0 h-full w-full"
            />
            <button
              type="button"
              onClick={expanded ? exit : enter}
              aria-label={
                expanded
                  ? copy.simulations.exitFullscreen
                  : copy.simulations.fullscreen
              }
              className={cn(
                "absolute top-3 right-3 z-10 inline-flex items-center justify-center rounded-lg bg-black/55 p-2 text-white transition-opacity hover:bg-black/75",
                expanded ? "opacity-100" : "opacity-0 group-hover:opacity-100",
              )}
            >
              {expanded ? (
                <Minimize className="size-4" />
              ) : (
                <Maximize className="size-4" />
              )}
            </button>
          </div>

          <p className="text-sm text-muted-foreground">{sim.blurb}</p>

          <p className="text-[11px] text-muted-foreground">
            {PHET_ATTRIBUTION.text}{" "}
            <a
              href={PHET_ATTRIBUTION.licenseHref}
              target="_blank"
              rel="noopener noreferrer"
              className="underline hover:text-foreground"
            >
              CC BY 4.0
            </a>
          </p>
        </div>
      </div>
    </main>
  );
}
