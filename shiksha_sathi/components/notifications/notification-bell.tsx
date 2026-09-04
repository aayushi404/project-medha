"use client";

import { Bell } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

import {
  getUnreadCount,
  listNotifications,
  markNotificationRead,
  type AppNotification,
} from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { useCopy } from "@/lib/copy";
import { Popover } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

function fmtTime(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
  });
}

/**
 * Unread-count bell + a quick-glance dropdown of the most recent
 * notifications, shared by every chrome (teacher/student sidebars, the
 * principal/admin console header). Polls unread-count on an interval since
 * there's no push channel into the web client.
 */
export function NotificationBell({ className }: { className?: string }) {
  const { accessToken, teacher } = useAuth();
  const copy = useCopy();
  const inboxHref = teacher?.role === "student" ? "/my-notifications" : "/notifications";
  const [count, setCount] = useState(0);
  const [items, setItems] = useState<AppNotification[] | null>(null);
  const [open, setOpen] = useState(false);

  const refreshCount = useCallback(() => {
    if (!accessToken) return;
    getUnreadCount(accessToken)
      .then((r) => setCount(r.count))
      .catch(() => {
        /* silent -- the bell just stays at its last known count */
      });
  }, [accessToken]);

  useEffect(() => {
    refreshCount();
    const id = setInterval(refreshCount, 30_000);
    return () => clearInterval(id);
  }, [refreshCount]);

  useEffect(() => {
    if (!open || !accessToken) return;
    listNotifications(accessToken)
      .then((rows) => setItems(rows.slice(0, 8)))
      .catch(() => setItems([]));
  }, [open, accessToken]);

  async function onOpenItem(n: AppNotification) {
    if (n.read_at) return;
    try {
      await markNotificationRead(accessToken, n.id);
      setItems((prev) => prev?.map((x) => (x.id === n.id ? { ...x, read_at: new Date().toISOString() } : x)) ?? prev);
      setCount((c) => Math.max(0, c - 1));
    } catch {
      /* ignore -- not worth surfacing a toast for a read-receipt */
    }
  }

  const trigger = (
    <span
      className={cn(
        "relative flex size-8 items-center justify-center rounded-lg text-foreground/70 outline-none transition-colors hover:bg-muted hover:text-foreground",
        className,
      )}
      aria-label={copy.notifications.title}
    >
      <Bell className="size-4" />
      {count > 0 && (
        <span className="absolute top-1 right-1 flex size-2 rounded-full bg-terracotta" />
      )}
    </span>
  );

  return (
    <Popover
      trigger={trigger}
      side="bottom"
      align="end"
      className="w-80 p-0"
      onOpenChange={setOpen}
    >
      <div className="flex flex-col">
        <div className="flex items-center justify-between border-b border-border px-3 py-2">
          <span className="text-sm font-medium text-foreground">{copy.notifications.title}</span>
          {(teacher?.role === "teacher" || teacher?.role === "student") && (
            <Link href={inboxHref} className="text-xs text-primary hover:underline">
              {copy.notifications.viewAll}
            </Link>
          )}
        </div>
        <div className="max-h-80 overflow-y-auto">
          {items === null ? (
            <p className="px-3 py-6 text-center text-xs text-muted-foreground">…</p>
          ) : items.length === 0 ? (
            <p className="px-3 py-6 text-center text-xs text-muted-foreground">
              {copy.notifications.empty}
            </p>
          ) : (
            <ul className="divide-y divide-border">
              {items.map((n) => (
                <li key={n.id}>
                  <button
                    type="button"
                    onClick={() => void onOpenItem(n)}
                    className={cn(
                      "flex w-full flex-col gap-0.5 px-3 py-2.5 text-left transition-colors hover:bg-muted",
                      !n.read_at && "bg-accent/40",
                    )}
                  >
                    <span className="flex items-center gap-1.5 text-xs font-medium text-foreground">
                      {!n.read_at && <span className="size-1.5 shrink-0 rounded-full bg-terracotta" />}
                      {n.title}
                    </span>
                    <span className="line-clamp-2 text-xs text-muted-foreground">{n.body}</span>
                    <span className="text-[10px] text-muted-foreground">{fmtTime(n.created_at)}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </Popover>
  );
}
