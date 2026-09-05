"use client";

import { Loader2 } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";

import { AskMedhaBar } from "@/components/app/ask-medha-bar";
import { GenerationRow } from "@/components/generation/generation-row";
import { useTypeMeta } from "@/components/generation/type-meta";
import { listGenerations, type GenerationListItem } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { useCopy } from "@/lib/copy";
import { SUPPORTED_TYPES, type GenerationType } from "@/lib/generation-types";
import { useProfile } from "@/lib/profile-context";
import { cn } from "@/lib/utils";

function QuickActionCard({ type }: { type: GenerationType }) {
  const copy = useCopy();
  const { Icon, bgClass } = useTypeMeta(type);
  return (
    <Link
      href={`/create/${type}`}
      className={cn(
        "group flex flex-col justify-between gap-8 rounded-3xl p-6 transition-transform hover:-translate-y-0.5",
        bgClass,
      )}
    >
      <span className="flex size-11 items-center justify-center rounded-2xl bg-card/70 text-foreground">
        <Icon className="size-5" />
      </span>
      <span className="inline-flex w-fit items-center gap-1.5 rounded-xl bg-terracotta px-4 py-2.5 text-sm font-medium text-primary-foreground transition-colors group-hover:opacity-90">
        {copy.generation.home.createLabel[type]}
      </span>
    </Link>
  );
}

export default function DashboardHomePage() {
  const copy = useCopy();
  const { accessToken } = useAuth();
  const { profile } = useProfile();
  const firstName = profile?.full_name?.trim().split(/\s+/)[0] ?? "";

  const [recent, setRecent] = useState<GenerationListItem[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    listGenerations(accessToken, { limit: 6 })
      .then((r) => !cancelled && setRecent(r))
      .catch(() => !cancelled && setRecent([]));
    return () => {
      cancelled = true;
    };
  }, [accessToken]);

  return (
    <main className="flex flex-1 flex-col overflow-y-auto">
      <div className="mx-auto w-full max-w-3xl flex-1 px-4 py-8 sm:px-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-xl">{copy.greeting(firstName)}</h1>
            <p className="mt-1 text-sm text-muted-foreground">{copy.generation.home.subtitle}</p>
          </div>
          <AskMedhaBar className="w-full sm:w-72" />
        </div>

        <h2 className="mt-8 text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
          {copy.generation.home.quickActionsTitle}
        </h2>
        <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
          {SUPPORTED_TYPES.map((type) => (
            <QuickActionCard key={type} type={type} />
          ))}
        </div>

        <h2 className="mt-8 text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
          {copy.generation.home.recentTitle}
        </h2>
        <div className="mt-3 flex flex-col gap-2 pb-8">
          {recent === null ? (
            <div className="flex justify-center py-6">
              <Loader2 className="size-5 animate-spin text-muted-foreground" />
            </div>
          ) : recent.length === 0 ? (
            <p className="rounded-xl border border-dashed border-border px-3 py-6 text-center text-sm text-muted-foreground">
              {copy.generation.home.recentEmpty}
            </p>
          ) : (
            recent.map((item) => <GenerationRow key={item.id} item={item} from="dashboard" />)
          )}
        </div>
      </div>
    </main>
  );
}
