"use client";

import Link from "next/link";

import { TypeBadge } from "@/components/generation/type-meta";
import type { GenerationListItem } from "@/lib/api";
import { useCurriculumT } from "@/lib/copy";
import { formatRelativeTime } from "@/lib/format";
import { TYPE_SLUG } from "@/lib/generation-types";

/** One row in the Dashboard "Recent" list or the History list. `from` is
 * threaded onto the edit route (?from=dashboard|history) so its back arrow
 * returns to whichever list it was opened from. */
export function GenerationRow({
  item,
  from,
}: {
  item: GenerationListItem;
  from?: "dashboard" | "history";
}) {
  const t = useCurriculumT();
  const href = `/${TYPE_SLUG[item.type]}/edit?id=${item.id}${from ? `&from=${from}` : ""}`;
  const meta = [t.grade(item.grade_label ?? ""), t.subject(item.subject_name ?? "")]
    .filter(Boolean)
    .join(" · ");
  return (
    <Link
      href={href}
      className="flex items-center gap-3 rounded-2xl border border-border bg-card px-3.5 py-3 transition-colors hover:bg-muted"
    >
      <TypeBadge type={item.type} />
      <span className="min-w-0 flex-1 truncate text-sm">{item.title}</span>
      {meta ? (
        <span className="hidden shrink-0 text-[11px] text-muted-foreground sm:inline">{meta}</span>
      ) : null}
      <span className="shrink-0 text-[11px] whitespace-nowrap text-muted-foreground">
        {formatRelativeTime(item.created_at)}
      </span>
    </Link>
  );
}
