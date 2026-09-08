"use client";

import { ChevronRight } from "lucide-react";
import Link from "next/link";

import { useTypeMeta } from "@/components/generation/type-meta";
import type { GenerationListItem } from "@/lib/api";
import { useCurriculumT } from "@/lib/copy";
import { formatRelativeTime } from "@/lib/format";
import { TYPE_SLUG } from "@/lib/generation-types";
import { cn } from "@/lib/utils";

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
  const { Icon, bgClass, fgClass } = useTypeMeta(item.type);
  const href = `/${TYPE_SLUG[item.type]}/edit?id=${item.id}${from ? `&from=${from}` : ""}`;
  const meta = [
    t.grade(item.grade_label ?? ""),
    t.subject(item.subject_name ?? ""),
    formatRelativeTime(item.created_at),
  ]
    .filter(Boolean)
    .join(" · ");
  return (
    <Link
      href={href}
      className="flex items-center gap-3 rounded-2xl border border-hairline bg-card px-3.5 py-3 transition-colors hover:bg-muted"
    >
      <span
        className={cn(
          "flex size-9 shrink-0 items-center justify-center rounded-xl",
          bgClass,
          fgClass,
        )}
      >
        <Icon className="size-4" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm">{item.title}</span>
        {meta ? (
          <span className="mt-0.5 block truncate text-[11px] text-muted-foreground">{meta}</span>
        ) : null}
      </span>
      <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
    </Link>
  );
}
