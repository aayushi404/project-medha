"use client";

import { Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { type AttendanceMineItem, getMyAttendance } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { useCopy } from "@/lib/copy";
import { cn } from "@/lib/utils";

function fmtDate(iso: string) {
  return new Date(`${iso}T00:00:00`).toLocaleDateString(undefined, {
    weekday: "short",
    day: "numeric",
    month: "short",
  });
}

export default function StudentAttendancePage() {
  const { accessToken } = useAuth();
  const copy = useCopy();
  const t = copy.attendancePage;

  const [items, setItems] = useState<AttendanceMineItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!accessToken) return;
    let active = true;
    getMyAttendance(accessToken)
      .then((res) => {
        if (active) setItems(res);
      })
      .catch((e: unknown) => {
        toast.error(e instanceof Error ? e.message : "Could not load attendance.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [accessToken]);

  const present = items.filter((i) => i.status === "present").length;
  const pct = items.length ? Math.round((present / items.length) * 100) : 0;

  return (
    <main className="flex flex-1 flex-col overflow-hidden">
      <div className="border-b border-border px-5 py-4">
        <h1 className="text-[15px]">{t.studentTitle}</h1>
        <p className="mt-0.5 text-xs text-muted-foreground">{t.studentSub}</p>
      </div>

      <div className="flex-1 overflow-y-auto px-5 py-4">
        <div className="mx-auto flex w-full max-w-2xl flex-col gap-3">
          {loading ? (
            <div className="flex justify-center py-16">
              <Loader2 className="size-6 animate-spin text-muted-foreground" />
            </div>
          ) : items.length === 0 ? (
            <p className="rounded-xl bg-card p-6 text-center text-sm text-muted-foreground ring-1 ring-foreground/10">
              {t.studentEmpty}
            </p>
          ) : (
            <>
              <span className="text-xs text-muted-foreground">
                {present}/{items.length} {t.presentLabel.toLowerCase()} · {pct}%
              </span>
              <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border">
                {items.map((i) => (
                  <li
                    key={i.date}
                    className="flex items-center justify-between bg-card px-3 py-2.5 text-sm"
                  >
                    <span>{fmtDate(i.date)}</span>
                    <span
                      className={cn(
                        "rounded-full px-2 py-0.5 text-xs font-medium",
                        i.status === "present"
                          ? "bg-sage/15 text-sage"
                          : "bg-destructive/10 text-destructive",
                      )}
                    >
                      {i.status === "present" ? t.presentLabel : t.absentLabel}
                    </span>
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
      </div>
    </main>
  );
}
