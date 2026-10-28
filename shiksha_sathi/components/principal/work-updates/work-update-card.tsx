"use client";

import { useState } from "react";
import { BookOpen, Calendar, Flag, MessageSquare, Sparkles, ThumbsDown, ThumbsUp } from "lucide-react";

import { ReactionNames } from "@/components/work-update/reaction-names";
import type { WorkUpdateApi } from "@/lib/api";
import { AI_USEFULNESS_OPTIONS, PRINCIPAL_BADGES, QUICK_ACTIVITIES, type BadgeId } from "@/lib/work-update-store";

const activityMap = new Map(QUICK_ACTIVITIES.map((a) => [a.id, a]));
const aiMap = new Map(AI_USEFULNESS_OPTIONS.map((a) => [a.id, a]));

/** One work update, with the principal's 1-click feedback box. Pulled out of
 * the old PrincipalWorkUpdatesFeed so the daily-status board (and any future
 * principal view) can reuse the exact same card. Unlike that old feed, this
 * works directly off the API shape (WorkUpdateApi) rather than the
 * teacher-facing work-update-store -- the principal's data comes from
 * /work-updates/daily-status, not the store. */
export function WorkUpdateCard({
  item,
  onFeedback,
}: {
  item: WorkUpdateApi;
  onFeedback: (
    id: string,
    body: { note?: string | null; flagged: boolean; badge?: string | null },
  ) => Promise<void>;
}) {
  const aiOpt = aiMap.get(item.ai_usefulness as (typeof AI_USEFULNESS_OPTIONS)[number]["id"]);
  const today = new Date().toISOString().slice(0, 10);
  const isToday = item.work_date === today;
  const badgeMeta = item.principal_badge ? PRINCIPAL_BADGES[item.principal_badge as BadgeId] : null;

  return (
    <div className="flex flex-col justify-between rounded-xl border border-border bg-card p-4 shadow-xs transition-colors hover:border-border/80">
      <div>
        <div className="flex items-start justify-between gap-2">
          <div>
            <span className="font-semibold text-sm text-foreground">{item.teacher_name}</span>
            <div className="mt-0.5 flex items-center gap-1.5 text-xs text-muted-foreground">
              <span className="font-medium text-foreground/80">{item.grade_label}</span>
              <span>·</span>
              <span>{item.subject_name}</span>
            </div>
          </div>

          <div className="flex flex-col items-end">
            <span className="flex items-center gap-1 text-[11px] font-medium text-muted-foreground">
              <Calendar className="size-3" />
              {isToday ? "Today" : item.work_date}
            </span>
            <span className="text-[10px] text-muted-foreground/60">
              {new Date(item.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
            </span>
          </div>
        </div>

        <div className="mt-2.5 flex items-center gap-1.5 rounded-lg bg-muted/40 px-2.5 py-1.5 text-xs text-foreground/90">
          <BookOpen className="size-3.5 shrink-0 text-terracotta" />
          <span className="truncate font-medium">{item.chapter_title}</span>
          {item.chapter_completed && (
            <span className="ml-auto inline-flex shrink-0 items-center gap-1 rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] font-semibold text-emerald-700 dark:text-emerald-300">
              ✅ Chapter Completed
            </span>
          )}
        </div>

        <div className="mt-3">
          <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            Activities Covered:
          </div>
          <div className="mt-1.5 flex flex-wrap gap-1">
            {item.activities.map((actKey) => {
              const act = activityMap.get(actKey as (typeof QUICK_ACTIVITIES)[number]["id"]);
              if (!act) return null;
              return (
                <span
                  key={actKey}
                  className="inline-flex items-center gap-1 rounded-md border border-border bg-background px-2 py-0.5 text-[11px] text-foreground/80"
                >
                  <span>{act.icon}</span>
                  <span>{act.label}</span>
                </span>
              );
            })}
          </div>
        </div>

        {(item.topics.length > 0 || item.other_topics) && (
          <div className="mt-2.5 text-xs text-foreground/85">
            <span className="font-semibold">Sub-topics: </span>
            {[...item.topics, ...(item.other_topics ? [item.other_topics] : [])].join(" · ")}
          </div>
        )}
        {item.activity_detail && (
          <div className="mt-1.5 text-xs text-foreground/85">
            <span className="font-semibold">Class activity: </span>
            {item.activity_detail}
          </div>
        )}
        {item.homework.length > 0 && (
          <div className="mt-1.5 text-xs text-foreground/85">
            <span className="font-semibold">Homework: </span>
            {item.homework.map((h) => h.title).join(" · ")}
          </div>
        )}

        {item.note && (
          <div className="mt-3 flex items-start gap-1.5 rounded-lg border border-border/50 bg-background/50 p-2 text-xs text-foreground/85">
            <MessageSquare className="mt-0.5 size-3 shrink-0 text-muted-foreground" />
            <span className="italic leading-relaxed">&ldquo;{item.note}&rdquo;</span>
          </div>
        )}
      </div>

      <div className="mt-4 space-y-2.5 border-t border-border/60 pt-3">
        <div className="flex items-center justify-between text-xs">
          <span className="text-[11px] text-muted-foreground flex items-center gap-1">
            <Sparkles className="size-3 text-amber-500" />
            Medha AI Assistant:
          </span>
          <span className="font-medium text-foreground flex items-center gap-1 bg-amber-500/10 dark:bg-amber-500/20 text-amber-700 dark:text-amber-300 px-2 py-0.5 rounded-full text-[11px]">
            <span>{aiOpt?.emoji ?? "🌟"}</span>
            <span>{aiOpt?.label.split(" (")[0] ?? "Helpful"}</span>
          </span>
        </div>

        <div className="grid grid-cols-2 gap-2 text-xs">
          <ReactionNames
            icon={<ThumbsUp className="size-3 text-emerald-600" />}
            label="Students approved"
            names={item.reactions.filter((r) => r.value === "approve").map((r) => r.student_name)}
          />
          <ReactionNames
            icon={<ThumbsDown className="size-3 text-rose-600" />}
            label="Students disapproved"
            names={item.reactions.filter((r) => r.value === "disapprove").map((r) => r.student_name)}
          />
        </div>

        <FeedbackBox
          key={`${item.id}-${item.feedback_at ?? ""}`}
          item={item}
          badgeMeta={badgeMeta}
          onSave={(next) => onFeedback(item.id, next)}
        />
      </div>
    </div>
  );
}

type BadgeMeta = (typeof PRINCIPAL_BADGES)[keyof typeof PRINCIPAL_BADGES];

function FeedbackBox({
  item,
  badgeMeta,
  onSave,
}: {
  item: WorkUpdateApi;
  badgeMeta: BadgeMeta | null;
  onSave: (next: { note?: string | null; flagged: boolean; badge?: string | null }) => Promise<void>;
}) {
  const [note, setNote] = useState(item.principal_note ?? "");
  const [flagged, setFlagged] = useState(item.flagged);
  const [saving, setSaving] = useState(false);
  const badges: { id: BadgeId; emoji: string; label: string }[] = [
    { id: "approved_great", emoji: "👏", label: "Approved" },
    { id: "star_teacher", emoji: "⭐", label: "Star Teaching" },
    { id: "well_done", emoji: "👍", label: "Well Done" },
  ];

  async function save(extra: { badge?: string | null } = {}) {
    setSaving(true);
    try {
      await onSave({ note, flagged, ...extra });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="rounded-lg bg-muted/40 p-2 text-xs">
      <div className="mb-1.5 flex items-center justify-between">
        <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
          Principal feedback
        </span>
        {badgeMeta && (
          <span className={`inline-flex items-center gap-1 rounded-full border px-2 text-[10px] font-semibold ${badgeMeta.color}`}>
            {badgeMeta.emoji} {badgeMeta.label.split(" (")[0]}
          </span>
        )}
      </div>
      <div className="flex flex-wrap gap-1.5">
        {badges.map((b) => (
          <button
            key={b.id}
            type="button"
            disabled={saving}
            onClick={() => save({ badge: item.principal_badge === b.id ? null : b.id })}
            className={`flex items-center gap-1 rounded-md border px-2 py-1 text-[11px] transition-colors ${
              item.principal_badge === b.id
                ? "border-primary bg-primary/10 font-semibold text-foreground"
                : "border-border bg-card text-muted-foreground hover:bg-muted"
            }`}
          >
            <span>{b.emoji}</span>
            <span>{b.label}</span>
          </button>
        ))}
        <button
          type="button"
          onClick={() => setFlagged((v) => !v)}
          className={`flex items-center gap-1 rounded-md border px-2 py-1 text-[11px] transition-colors ${
            flagged
              ? "border-rose-500 bg-rose-500/15 font-semibold text-rose-700 dark:text-rose-300"
              : "border-border bg-card text-muted-foreground hover:bg-muted"
          }`}
        >
          <Flag className="size-3" />
          <span>{flagged ? "Flagged" : "Flag teacher"}</span>
        </button>
      </div>
      <textarea
        value={note}
        onChange={(e) => setNote(e.target.value)}
        maxLength={500}
        rows={2}
        placeholder={flagged ? "Why are you flagging this? (required)" : "Add a note for the teacher (visible to them)..."}
        className="mt-2 w-full resize-none rounded-md border border-border bg-background px-2 py-1.5 text-xs focus:border-terracotta focus:outline-none focus:ring-1 focus:ring-terracotta"
      />
      <div className="mt-1.5 flex justify-end">
        <button
          type="button"
          disabled={saving}
          onClick={() => save()}
          className="rounded-md bg-terracotta px-3 py-1 text-[11px] font-semibold text-white hover:bg-terracotta/90 disabled:opacity-50"
        >
          {saving ? "Saving..." : "Save feedback"}
        </button>
      </div>
    </div>
  );
}
