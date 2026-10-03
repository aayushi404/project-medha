"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { BadgeCheck, Check, Loader2, Search, ShieldOff } from "lucide-react";
import { toast } from "sonner";

import {
  approvePrincipal,
  getAdminPrincipals,
  rejectPrincipal,
  revokePrincipal,
  type ApprovalStatus,
  type PrincipalListItem,
} from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { useDebouncedValue } from "@/lib/use-debounced-value";
import { cn } from "@/lib/utils";
import { fmtDate, StatusBadge } from "@/components/admin/status-badge";
import { RejectDialog } from "@/components/console/reject-dialog";
import { Button } from "@/components/ui/button";

type Tab = ApprovalStatus | "all";

const TABS: { id: Tab; label: string }[] = [
  { id: "pending", label: "Pending" },
  { id: "approved", label: "Approved" },
  { id: "rejected", label: "Rejected" },
  { id: "all", label: "All" },
];

export function PrincipalsManager() {
  const { accessToken } = useAuth();
  const [tab, setTab] = useState<Tab>("pending");
  const [search, setSearch] = useState("");
  const q = useDebouncedValue(search, 300);
  const [items, setItems] = useState<PrincipalListItem[]>([]);
  // the "tab|q" key the current `items` belong to; differs from the live key
  // while a fetch is in flight, which is what drives the spinner
  const [loadedKey, setLoadedKey] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const key = `${tab}|${q}`;
  const loading = loadedKey !== key;

  const load = useCallback(() => {
    return getAdminPrincipals(accessToken, {
      status: tab === "all" ? undefined : tab,
      q,
    })
      .then((rows) => {
        setItems(rows);
        setLoadedKey(`${tab}|${q}`);
      })
      .catch((e: unknown) => {
        toast.error(e instanceof Error ? e.message : "Could not load principals.");
        setLoadedKey(`${tab}|${q}`);
      });
  }, [accessToken, tab, q]);

  useEffect(() => {
    if (!accessToken) return;
    void load();
  }, [accessToken, load]);

  async function act(id: string, run: () => Promise<unknown>, ok: string) {
    setBusyId(id);
    try {
      await run();
      toast.success(ok);
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Something went wrong.");
      throw e; // keeps the reason dialog open on failure
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="inline-flex rounded-xl bg-muted p-1" role="tablist">
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              role="tab"
              aria-selected={tab === t.id}
              onClick={() => setTab(t.id)}
              className={cn(
                "rounded-lg px-3 py-1.5 text-xs font-medium transition-colors",
                tab === t.id
                  ? "bg-card text-foreground shadow-xs"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {t.label}
            </button>
          ))}
        </div>
        <div className="relative w-full sm:w-72">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-3.5 -translate-y-1/2 text-muted-foreground" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search name, email or school"
            className="h-9 w-full rounded-lg border border-input bg-transparent pr-3 pl-8 text-sm outline-none transition-colors focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
          />
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="size-5 animate-spin text-muted-foreground" />
        </div>
      ) : items.length === 0 ? (
        <p className="rounded-xl bg-card p-6 text-center text-sm text-muted-foreground ring-1 ring-foreground/10">
          No principals match.
        </p>
      ) : (
        <ul className="flex flex-col gap-3">
          {items.map((p) => (
            <li
              key={p.id}
              className="flex flex-col gap-3 rounded-xl bg-card p-4 ring-1 ring-foreground/10 sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                  <span className="font-medium text-foreground">{p.full_name}</span>
                  <StatusBadge status={p.approval_status} />
                  {p.email_verified && (
                    <span
                      title="Email verified"
                      className="inline-flex items-center gap-0.5 text-[11px] text-muted-foreground"
                    >
                      <BadgeCheck className="size-3.5 text-primary" /> verified
                    </span>
                  )}
                </div>
                <div className="text-xs text-muted-foreground">{p.email}</div>
                <div className="mt-1 text-sm text-foreground">
                  {p.school_id && p.school_name ? (
                    <Link
                      href={`/admin/schools/${p.school_id}`}
                      className="hover:text-terracotta hover:underline"
                    >
                      {p.school_name}
                    </Link>
                  ) : (
                    <span className="text-muted-foreground">No school linked</span>
                  )}
                  {p.district_name && (
                    <span className="text-muted-foreground"> · {p.district_name}</span>
                  )}
                </div>
                <div className="mt-1 flex flex-wrap gap-x-4 gap-y-0.5 text-xs text-muted-foreground">
                  {p.mobile_number && <span>📞 {p.mobile_number}</span>}
                  {p.qualification && <span>🎓 {p.qualification}</span>}
                  <span>Applied {fmtDate(p.applied_at)}</span>
                  {p.decided_at && p.approval_status === "approved" && (
                    <span>Approved {fmtDate(p.decided_at)}</span>
                  )}
                </div>
                {p.approval_status === "rejected" && p.rejection_reason && (
                  <p className="mt-1.5 text-xs text-destructive">
                    Reason: {p.rejection_reason}
                  </p>
                )}
              </div>

              <div className="flex shrink-0 gap-2">
                {p.approval_status === "pending" && (
                  <>
                    <Button
                      size="sm"
                      disabled={busyId === p.id}
                      onClick={() =>
                        void act(
                          p.id,
                          () => approvePrincipal(accessToken, p.id),
                          "Principal approved.",
                        ).catch(() => {})
                      }
                    >
                      <Check className="size-3.5" />
                      Approve
                    </Button>
                    <RejectDialog
                      subjectName={p.full_name}
                      onConfirm={(reason) =>
                        act(p.id, () => rejectPrincipal(accessToken, p.id, reason), "Application rejected.")
                      }
                      trigger={
                        <Button variant="destructive" size="sm" disabled={busyId === p.id}>
                          Reject
                        </Button>
                      }
                    />
                  </>
                )}
                {p.approval_status === "approved" && (
                  <RejectDialog
                    verb="Revoke"
                    subjectName={p.full_name}
                    description="Their access ends immediately and the school's principal seat is freed. They'll see this reason."
                    onConfirm={(reason) =>
                      act(p.id, () => revokePrincipal(accessToken, p.id, reason), "Access revoked.")
                    }
                    trigger={
                      <Button variant="outline" size="sm" disabled={busyId === p.id}>
                        <ShieldOff className="size-3.5" />
                        Revoke
                      </Button>
                    }
                  />
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
