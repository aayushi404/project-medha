"use client";

import { ExternalLink, Trash2 } from "lucide-react";

import type { LibraryItem } from "@/lib/api";
import { useCopy } from "@/lib/copy";
import { Button } from "@/components/ui/button";

export function ResourceList({
  items,
  onDelete,
  busyId,
}: {
  items: LibraryItem[];
  onDelete?: (id: string) => void;
  busyId?: string | null;
}) {
  const copy = useCopy();
  const t = copy.resourcesPage;

  if (items.length === 0) {
    return (
      <p className="rounded-xl bg-card p-6 text-center text-sm text-muted-foreground ring-1 ring-foreground/10">
        {t.empty}
      </p>
    );
  }

  return (
    <ul className="flex flex-col gap-3">
      {items.map((item) => (
        <li
          key={item.id}
          className="flex flex-col gap-2 rounded-xl bg-card p-4 ring-1 ring-foreground/10 sm:flex-row sm:items-center sm:justify-between"
        >
          <div className="min-w-0">
            <span className="font-medium text-foreground">{item.title}</span>
            {item.description && (
              <p className="mt-0.5 text-sm text-muted-foreground">{item.description}</p>
            )}
            <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
              {item.grade_label && <span>{item.grade_label}</span>}
              {item.subject_name && <span>{item.subject_name}</span>}
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              render={<a href={item.url} target="_blank" rel="noopener noreferrer" />}
            >
              <ExternalLink className="size-3.5" />
              {t.openLink}
            </Button>
            {onDelete && (
              <Button
                variant="destructive"
                size="icon-sm"
                onClick={() => onDelete(item.id)}
                disabled={busyId === item.id}
                aria-label={t.deleteConfirm}
              >
                <Trash2 className="size-3.5" />
              </Button>
            )}
          </div>
        </li>
      ))}
    </ul>
  );
}
