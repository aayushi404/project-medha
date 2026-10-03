"use client";

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

import { getAdminActivity, type AdminActivityItem } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { fmtDateTime, StatusBadge } from "@/components/admin/status-badge";

export function ActivityFeed({ limit = 50 }: { limit?: number }) {
  const { accessToken } = useAuth();
  const [items, setItems] = useState<AdminActivityItem[] | null>(null);

  useEffect(() => {
    if (!accessToken) return;
    let active = true;
    getAdminActivity(accessToken, limit)
      .then((rows) => {
        if (active) setItems(rows);
      })
      .catch((e: unknown) => {
        toast.error(e instanceof Error ? e.message : "Could not load activity.");
        if (active) setItems([]);
      });
    return () => {
      active = false;
    };
  }, [accessToken, limit]);

  if (items === null) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="size-5 animate-spin text-muted-foreground" />
      </div>
    );
  }
  if (items.length === 0) {
    return (
      <p className="rounded-xl bg-card p-6 text-center text-sm text-muted-foreground ring-1 ring-foreground/10">
        No approval decisions yet.
      </p>
    );
  }

  return (
    <ul className="divide-y divide-border rounded-xl bg-card ring-1 ring-foreground/10">
      {items.map((a) => (
        <li key={a.id} className="flex items-start justify-between gap-3 px-4 py-3">
          <div className="min-w-0">
            <p className="text-sm text-foreground">
              <span className="font-medium">{a.actor_name}</span>{" "}
              <span className="text-muted-foreground">{a.action}</span>{" "}
              <span className="font-medium">{a.subject_name}</span>{" "}
              <span className="text-muted-foreground">({a.subject_role})</span>
            </p>
            <p className="truncate text-xs text-muted-foreground">
              {a.school_name ?? "No school"} · {fmtDateTime(a.created_at)}
            </p>
            {a.reason && (
              <p className="mt-0.5 text-xs text-muted-foreground">Reason: {a.reason}</p>
            )}
          </div>
          <StatusBadge status={a.action} />
        </li>
      ))}
    </ul>
  );
}
