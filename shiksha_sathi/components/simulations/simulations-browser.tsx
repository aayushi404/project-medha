"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

import {
  PHET_ATTRIBUTION,
  SIM_SUBJECTS,
  SIMULATIONS,
  type SimSubject,
  type Simulation,
  phetThumbUrl,
} from "@/lib/simulations";
import { useCopy } from "@/lib/copy";
import { cn } from "@/lib/utils";

const TINTS = [
  "from-terracotta/25 to-terracotta/5 text-earth",
  "from-sage/25 to-sage/5 text-sage",
  "from-gold/30 to-gold/5 text-earth",
  "from-earth/20 to-earth/5 text-earth",
];

function tintFor(seed: string) {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) | 0;
  return TINTS[Math.abs(h) % TINTS.length];
}

function Chip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "rounded-full border px-3 py-1 text-xs transition-colors",
        active
          ? "border-transparent bg-accent text-accent-foreground"
          : "border-border text-muted-foreground hover:bg-muted",
      )}
    >
      {children}
    </button>
  );
}

function SimCard({ sim, basePath }: { sim: Simulation; basePath: string }) {
  const copy = useCopy();
  const [broken, setBroken] = useState(false);
  const [a, b] = sim.grades;

  return (
    <Link
      href={`${basePath}/${sim.slug}`}
      className="group flex flex-col overflow-hidden rounded-xl bg-card text-left ring-1 ring-foreground/10 transition-shadow hover:shadow-md"
    >
      <div className="relative aspect-video overflow-hidden bg-muted">
        {broken ? (
          <div
            className={cn(
              "flex h-full w-full items-end bg-gradient-to-br p-3",
              tintFor(sim.slug),
            )}
          >
            <span className="font-serif text-sm leading-tight font-medium">
              {sim.title}
            </span>
          </div>
        ) : (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={phetThumbUrl(sim.phetId)}
            alt=""
            loading="lazy"
            onError={() => setBroken(true)}
            className="h-full w-full object-cover transition-transform group-hover:scale-[1.02]"
          />
        )}
        <span className="absolute top-2 left-2 rounded-md bg-black/55 px-1.5 py-0.5 text-[10px] font-semibold tracking-wide text-white uppercase">
          {SIM_SUBJECTS.find((s) => s.key === sim.subject)?.label ?? sim.subject}
        </span>
      </div>
      <div className="flex flex-1 flex-col gap-1 p-3">
        <span className="line-clamp-2 text-[13px] font-medium">{sim.title}</span>
        <span className="text-[11px] text-muted-foreground">
          {copy.simulations.interactiveModule}
        </span>
        <div className="mt-auto flex flex-wrap gap-1 pt-1.5">
          <span className="rounded-full bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">
            {copy.simulations.grades(a, b)}
          </span>
        </div>
      </div>
    </Link>
  );
}

export function SimulationsBrowser({ basePath }: { basePath: string }) {
  const copy = useCopy();
  const [subject, setSubject] = useState<SimSubject | "all">("all");

  const shown = useMemo(
    () =>
      subject === "all"
        ? SIMULATIONS
        : SIMULATIONS.filter((s) => s.subject === subject),
    [subject],
  );

  return (
    <main className="flex flex-1 flex-col overflow-hidden">
      <div className="border-b border-border px-5 py-4">
        <h1 className="text-[15px]">{copy.simulations.title}</h1>
        <p className="mt-0.5 text-xs text-muted-foreground">{copy.simulations.sub}</p>
      </div>

      <div className="flex flex-wrap gap-1.5 border-b border-border px-5 py-3">
        <Chip active={subject === "all"} onClick={() => setSubject("all")}>
          {copy.simulations.all}
        </Chip>
        {SIM_SUBJECTS.map((s) => (
          <Chip
            key={s.key}
            active={subject === s.key}
            onClick={() => setSubject(s.key)}
          >
            {s.label}
          </Chip>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto px-5 py-5">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {shown.map((sim) => (
            <SimCard key={sim.slug} sim={sim} basePath={basePath} />
          ))}
        </div>

        <p className="mt-8 text-center text-[11px] text-muted-foreground">
          {copy.simulations.attribution}{" "}
          <a
            href={PHET_ATTRIBUTION.href}
            target="_blank"
            rel="noopener noreferrer"
            className="underline hover:text-foreground"
          >
            phet.colorado.edu
          </a>
        </p>
      </div>
    </main>
  );
}
