"use client";

import { ChevronRight, ClipboardPenLine, Lightbulb, Loader2 } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";

import { AskMedhaBar } from "@/components/app/ask-medha-bar";
import { SchoolNoticeBanner } from "@/components/app/school-notice-banner";
import { GenerationRow } from "@/components/generation/generation-row";
import { QuickActionCard } from "@/components/generation/quick-action-card";
import { listGenerations, type GenerationListItem } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { useCopy, useLocale } from "@/lib/copy";
import { useProfile } from "@/lib/profile-context";
import { cn } from "@/lib/utils";
import { PRINCIPAL_BADGES, useWorkUpdates } from "@/lib/work-update-store";

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return ((parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? "")).toUpperCase() || "?";
}

/** Saffron / white / green rule under the hero and sidebar taglines. */
function TricolourRule({ className }: { className?: string }) {
  return (
    <span
      aria-hidden
      className={className}
      style={{
        display: "block",
        height: 3,
        borderRadius: 999,
        background: "linear-gradient(90deg, #FF9933 0%, #FFFFFF 50%, #138808 100%)",
      }}
    />
  );
}

export default function DashboardHomePage() {
  const copy = useCopy();
  const { locale } = useLocale();
  const isHi = locale === "hi";
  const { accessToken, teacher } = useAuth();
  const { profile } = useProfile();
  const { getTodayUpdateForTeacher } = useWorkUpdates();
  const name = profile?.full_name?.trim() ?? "";
  const firstName = name.split(/\s+/)[0] ?? "";

  const [recent, setRecent] = useState<GenerationListItem[] | null>(null);

  const todayUpdate = getTodayUpdateForTeacher(teacher?.id);
  const badgeInfo = todayUpdate?.principal_feedback?.badge
    ? PRINCIPAL_BADGES[todayUpdate.principal_feedback.badge]
    : null;

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
    <main className="relative flex flex-1 flex-col overflow-hidden">
      <SchoolNoticeBanner audience="teachers" />

      {/* Nalanda watercolour -- the page's full background, held still while the
          content scrolls over it. */}
      <div aria-hidden className="pointer-events-none absolute inset-0">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/dashboard-background.png"
          alt=""
          className="size-full object-cover object-[50%_42%]"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-ivory/72 via-ivory/45 to-ivory/62" />
      </div>

      <div className="relative z-10 flex-1 overflow-y-auto">
        <div className="mx-auto w-full max-w-3xl px-4 py-6 sm:px-6">
          {/* Hero header */}
          <section className="flex min-h-[168px] flex-col pb-1">
            <div className="flex items-center justify-end gap-2">
              <Link
                href="/work-update"
                aria-label={copy.nav.workUpdate}
                title={copy.nav.workUpdate}
                className="group flex h-9 items-center gap-2 rounded-full border border-border/60 bg-card/75 px-3 text-xs font-medium text-foreground/80 shadow-2xs backdrop-blur-md transition-all hover:border-terracotta/40 hover:bg-card hover:text-foreground hover:shadow-xs active:scale-[0.98]"
              >
                <span className="relative flex size-4 items-center justify-center">
                  <ClipboardPenLine
                    className={cn(
                      "size-4 transition-transform group-hover:scale-110",
                      todayUpdate ? "text-emerald-600 dark:text-emerald-400" : "text-terracotta",
                    )}
                  />
                  {todayUpdate && (
                    <span className="absolute -top-0.5 -right-0.5 size-1.5 rounded-full bg-emerald-500 ring-1 ring-background" />
                  )}
                </span>
                <span className="font-medium">{copy.nav.workUpdate}</span>
                {badgeInfo ? (
                  <span
                    className="inline-flex items-center gap-1 rounded-full bg-amber-500/15 px-1.5 py-0.5 text-[10px] font-semibold text-amber-700 dark:text-amber-300"
                    title={badgeInfo.label}
                  >
                    <span>{badgeInfo.emoji}</span>
                    <span className="hidden sm:inline">{badgeInfo.label}</span>
                  </span>
                ) : todayUpdate ? (
                  <span className="rounded-full bg-emerald-500/15 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-600 dark:text-emerald-400">
                    {isHi ? "✓ पूर्ण" : "✓ Done"}
                  </span>
                ) : (
                  <span className="rounded-full bg-terracotta/15 px-1.5 py-0.5 text-[10px] font-semibold text-terracotta">
                    {isHi ? "+ नया" : "+ New"}
                  </span>
                )}
              </Link>
              <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-terracotta/15 text-sm font-medium text-terracotta">
                {initials(name)}
              </span>
            </div>

            <div className="mt-3">
              <h1 className="font-serif text-[26px] tracking-tight">
                {copy.greeting(firstName)} <span className="align-middle">👋</span>
              </h1>
              <p className="mt-1 text-sm text-muted-foreground">
                {copy.generation.home.subtitle}
              </p>
            </div>

            <div className="mt-auto pt-4">
              <span className="text-[11px] font-medium tracking-wide text-earth">
                {copy.dashboard.heroTagline}
              </span>
              <TricolourRule className="mt-1 w-16" />
            </div>
          </section>

          <AskMedhaBar size="lg" className="mt-3 w-full" />

        {/* Quick actions */}
        <h2 className="eyebrow mt-8 text-muted-foreground">
          {copy.generation.home.quickActionsTitle}
        </h2>
        <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <QuickActionCard type="lesson_plan" />
          <QuickActionCard type="presentation" />
          <QuickActionCard type="question_paper" />
          <QuickActionCard type="quiz" />
          <QuickActionCard type="notes" layout="wide" />
        </div>

        {/* Recent */}
        <div className="mt-8 flex items-center justify-between">
          <h2 className="eyebrow text-muted-foreground">{copy.generation.home.recentTitle}</h2>
          <Link
            href="/history"
            className="flex items-center gap-0.5 text-xs font-medium text-terracotta hover:underline"
          >
            {copy.generation.home.viewAll}
            <ChevronRight className="size-3.5" />
          </Link>
        </div>
        <div className="mt-3 flex flex-col gap-2">
          {recent === null ? (
            <div className="flex justify-center py-6">
              <Loader2 className="size-5 animate-spin text-muted-foreground" />
            </div>
          ) : recent.length === 0 ? (
            <p className="rounded-2xl border border-dashed border-border px-3 py-6 text-center text-sm text-muted-foreground">
              {copy.generation.home.recentEmpty}
            </p>
          ) : (
            recent.map((item) => <GenerationRow key={item.id} item={item} from="dashboard" />)
          )}
        </div>

          {/* Quote */}
          <div className="mt-8 mb-4 flex items-start gap-3 rounded-2xl border border-hairline bg-tint-notes/85 px-4 py-3.5 backdrop-blur-sm">
            <Lightbulb className="mt-0.5 size-5 shrink-0 text-gold" />
            <p className="text-sm">
              <span className="italic">{copy.dashboard.quote}</span>{" "}
              <span className="text-muted-foreground">{copy.dashboard.quoteAttrib}</span>
            </p>
          </div>
        </div>
      </div>
    </main>
  );
}
