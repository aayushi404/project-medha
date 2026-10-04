"use client";

import { ChevronDown, Pencil } from "lucide-react";

import type { SchoolCard as SchoolCardData } from "@/lib/api";
import { cn } from "@/lib/utils";

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return ((parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? "")).toUpperCase() || "S";
}

/** The school's logo, or its initials when none has been uploaded. */
export function SchoolLogo({ school, size }: { school: Pick<SchoolCardData, "name" | "logo_url">; size: number }) {
  if (school.logo_url) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={school.logo_url}
        alt={`${school.name} logo`}
        width={size}
        height={size}
        className="shrink-0 rounded-xl bg-white object-contain p-1 ring-1 ring-foreground/10"
        style={{ width: size, height: size }}
      />
    );
  }
  return (
    <span
      aria-hidden
      className="flex shrink-0 items-center justify-center rounded-xl bg-primary/15 font-serif font-semibold text-primary"
      style={{ width: size, height: size, fontSize: size * 0.36 }}
    >
      {initials(school.name)}
    </span>
  );
}

/**
 * The school card for the sidebars. Everyone sees the same card. Only a card
 * with `editable` set is a button, and it opens the principal's editor.
 */
export function SchoolCard({
  school,
  editable,
  collapsed,
  onEdit,
}: {
  school: SchoolCardData;
  editable: boolean;
  collapsed: boolean;
  onEdit: () => void;
}) {
  if (collapsed) {
    const logo = <SchoolLogo school={school} size={36} />;
    return editable ? (
      <button type="button" onClick={onEdit} aria-label={`Edit ${school.name}`} title={school.name} className="mx-auto block rounded-xl focus-visible:outline-2 focus-visible:outline-ring">
        {logo}
      </button>
    ) : (
      <div title={school.name} className="mx-auto">{logo}</div>
    );
  }

  const body = (
    <>
      <div className="flex items-center gap-3">
        <SchoolLogo school={school} size={44} />
        <div className="min-w-0 flex-1 text-left">
          <p className="truncate text-sm font-semibold text-foreground">{school.name}</p>
          <p className="truncate text-xs text-muted-foreground">{school.district_name}</p>
        </div>
        {editable ? <Pencil aria-hidden className="size-3.5 shrink-0 text-muted-foreground" /> : null}
      </div>
      <div className="mt-3 flex items-center justify-between gap-2 rounded-full bg-foreground px-3 py-1.5 text-xs font-medium text-background">
        <span>{school.academic_year ? school.academic_year.label : "No academic year set"}</span>
        {editable ? <ChevronDown aria-hidden className="size-3.5" /> : null}
      </div>
    </>
  );

  const base = "w-full rounded-2xl bg-card/80 p-3 text-left ring-1 ring-foreground/10 shadow-xs";
  if (!editable) return <div className={base}>{body}</div>;
  return (
    <button
      type="button"
      onClick={onEdit}
      aria-label={`Edit school details: ${school.name}`}
      className={cn(base, "transition-colors hover:bg-card focus-visible:outline-2 focus-visible:outline-ring")}
    >
      {body}
    </button>
  );
}
