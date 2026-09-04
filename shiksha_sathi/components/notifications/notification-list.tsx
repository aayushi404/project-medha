"use client";

import type { AppNotification } from "@/lib/api";
import { useCopy } from "@/lib/copy";
import { cn } from "@/lib/utils";

function fmtDateTime(iso: string) {
  return new Date(iso).toLocaleString(undefined, {
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function NotificationList({
  items,
  onOpen,
}: {
  items: AppNotification[];
  onOpen: (n: AppNotification) => void;
}) {
  const copy = useCopy();

  if (items.length === 0) {
    return (
      <p className="rounded-xl bg-card p-6 text-center text-sm text-muted-foreground ring-1 ring-foreground/10">
        {copy.notifications.empty}
      </p>
    );
  }

  return (
    <ul className="flex flex-col gap-2">
      {items.map((n) => (
        <li key={n.id}>
          <button
            type="button"
            onClick={() => onOpen(n)}
            className={cn(
              "flex w-full flex-col gap-1 rounded-xl bg-card p-4 text-left ring-1 ring-foreground/10 transition-colors hover:bg-muted/60",
              !n.read_at && "ring-terracotta/30",
            )}
          >
            <span className="flex items-center gap-2 text-sm font-medium text-foreground">
              {!n.read_at && <span className="size-1.5 shrink-0 rounded-full bg-terracotta" />}
              {n.title}
            </span>
            <span className="text-sm text-muted-foreground">{n.body}</span>
            <span className="text-xs text-muted-foreground">{fmtDateTime(n.created_at)}</span>
          </button>
        </li>
      ))}
    </ul>
  );
}
