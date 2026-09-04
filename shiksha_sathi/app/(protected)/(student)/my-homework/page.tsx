"use client";

import { Check, Loader2 } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";

import {
  listMyHomework,
  markHomeworkDone,
  markHomeworkUndone,
  type HomeworkStudentItem,
} from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { useCopy } from "@/lib/copy";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, { day: "numeric", month: "short" });
}

export default function StudentHomeworkPage() {
  const { accessToken } = useAuth();
  const copy = useCopy();
  const t = copy.homeworkPage;

  const [items, setItems] = useState<HomeworkStudentItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);

  const reload = useCallback(() => {
    return listMyHomework(accessToken)
      .then(setItems)
      .catch((e: unknown) => {
        toast.error(e instanceof Error ? e.message : "Could not load homework.");
      });
  }, [accessToken]);

  useEffect(() => {
    if (!accessToken) return;
    let active = true;
    reload().finally(() => {
      if (active) setLoading(false);
    });
    return () => {
      active = false;
    };
  }, [accessToken, reload]);

  async function toggle(h: HomeworkStudentItem) {
    setBusyId(h.id);
    try {
      const updated = h.done
        ? await markHomeworkUndone(accessToken, h.id)
        : await markHomeworkDone(accessToken, h.id);
      setItems((prev) => prev.map((x) => (x.id === h.id ? updated : x)));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not update.");
    } finally {
      setBusyId(null);
    }
  }

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
            <ul className="flex flex-col gap-3">
              {items.map((h) => (
                <li
                  key={h.id}
                  className={cn(
                    "flex flex-col gap-2 rounded-xl bg-card p-4 ring-1 ring-foreground/10 sm:flex-row sm:items-center sm:justify-between",
                    h.done && "opacity-70",
                  )}
                >
                  <div className="min-w-0">
                    <span
                      className={cn("font-medium text-foreground", h.done && "line-through")}
                    >
                      {h.title}
                    </span>
                    {h.description && (
                      <p className="mt-0.5 text-sm text-muted-foreground">{h.description}</p>
                    )}
                    <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                      {h.subject_name && <span>{h.subject_name}</span>}
                      <span>{h.due_date ? t.due(fmtDate(h.due_date)) : t.noDueDate}</span>
                    </div>
                  </div>
                  <Button
                    size="sm"
                    variant={h.done ? "outline" : "default"}
                    onClick={() => void toggle(h)}
                    disabled={busyId === h.id}
                    className="shrink-0"
                  >
                    <Check className="size-3.5" />
                    {h.done ? t.markUndone : t.markDone}
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </main>
  );
}
