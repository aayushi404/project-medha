"use client";

import { Check } from "lucide-react";

import { QUICK_ACTIVITIES, type QuickWorkActivity } from "@/lib/work-update-store";
import type { WorkUpdateHomeworkRef } from "@/lib/api";

const inputCls =
  "mt-2 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm placeholder:text-muted-foreground/60 focus:border-terracotta focus:outline-none focus:ring-1 focus:ring-terracotta";

/** "What did you cover today?" -- the daily activity log. Deliberately
 * separate from chapter completion (see ChapterCompletionToggle): these
 * tick marks describe today's session, they don't move the syllabus %. */
export function ActivityPicker({
  isHi,
  selected,
  onToggle,
  todayHomework,
  activityDetail,
  onActivityDetailChange,
}: {
  isHi: boolean;
  selected: QuickWorkActivity[];
  onToggle: (id: QuickWorkActivity) => void;
  todayHomework: WorkUpdateHomeworkRef[];
  activityDetail: string;
  onActivityDetailChange: (v: string) => void;
}) {
  const homeworkLocked = todayHomework.length > 0;

  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <label className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        {isHi ? "आज क्या कराया? (टिक करें)" : "What did you cover today? (Tick Mark)"}
      </label>
      <div className="mt-2.5 grid grid-cols-2 gap-2 sm:grid-cols-3">
        {QUICK_ACTIVITIES.map((act) => {
          const checked = selected.includes(act.id);
          const locked = act.id === "homework_given" && homeworkLocked;
          return (
            <button
              key={act.id}
              type="button"
              onClick={() => !locked && onToggle(act.id)}
              className={`flex items-center gap-2 rounded-xl border p-2.5 text-left text-xs transition-all ${
                checked
                  ? "border-terracotta bg-terracotta/10 font-medium text-terracotta shadow-xs"
                  : "border-border bg-background text-foreground/80 hover:bg-muted/70"
              }`}
            >
              <div
                className={`flex size-4 shrink-0 items-center justify-center rounded-md border text-[10px] ${
                  checked ? "border-terracotta bg-terracotta text-white" : "border-muted-foreground/40 bg-card"
                }`}
              >
                {checked && <Check className="size-3 stroke-[3]" />}
              </div>
              <span className="text-sm">{act.icon}</span>
              <span className="truncate">{isHi ? act.labelHi : act.label}</span>
            </button>
          );
        })}
      </div>

      {homeworkLocked && (
        <div className="mt-3 rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-3 text-xs">
          <div className="font-semibold text-emerald-700 dark:text-emerald-300">
            {isHi ? "📝 आज दिया गया गृहकार्य (स्वतः जुड़ा)" : "📝 Homework you assigned today (added automatically)"}
          </div>
          <ul className="mt-1.5 list-disc space-y-0.5 pl-4 text-foreground/85">
            {todayHomework.map((h) => (
              <li key={h.id}>{h.title}</li>
            ))}
          </ul>
        </div>
      )}

      {selected.includes("hands_on_activity") && (
        <div className="mt-3 rounded-xl border border-border bg-background p-3">
          <label className="block text-xs font-semibold text-foreground">
            {isHi ? "🧪 कौन-सी कक्षा गतिविधि कराई?" : "🧪 Which class activity did you do?"}
          </label>
          <input
            type="text"
            value={activityDetail}
            onChange={(e) => onActivityDetailChange(e.target.value)}
            placeholder={isHi ? "उदा. वाष्पीकरण का प्रयोग, समूह चर्चा…" : "e.g. Evaporation experiment, group discussion…"}
            maxLength={300}
            className={inputCls}
          />
        </div>
      )}
    </div>
  );
}
