"use client";

import { AlertTriangle, CheckCircle2, Loader2 } from "lucide-react";

import type { PlannerValidation, PlannerValidationItem } from "@/lib/api";
import { Button } from "@/components/ui/button";

const SHOW = 12;
const DAY_SHORT = ["", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const DAY_SHORT_HI = ["", "सोम", "मंगल", "बुध", "गुरु", "शुक्र", "शनि", "रवि"];

/** Warnings, never blockers: real schools have gaps, and a checker that refuses
 * an imperfect timetable gets worked around. */
export function ValidationPanel({
  result,
  loading,
  isHi,
  onCheck,
}: {
  result: PlannerValidation | null;
  loading: boolean;
  isHi: boolean;
  onCheck: () => void;
}) {
  const days = isHi ? DAY_SHORT_HI : DAY_SHORT;

  return (
    <section
      aria-label={isHi ? "जाँच" : "Checks"}
      className="rounded-xl border border-border bg-card p-5"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-serif text-base font-semibold text-foreground">
            {isHi ? "प्रकाशन से पहले जाँच" : "Checks before publishing"}
          </h2>
          <p className="text-xs text-muted-foreground">
            {isHi
              ? "ये केवल चेतावनी हैं। कुछ भी सहेजने या प्रकाशित करने से नहीं रोकता।"
              : "These are warnings only. Nothing here stops you from saving or publishing."}
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={onCheck} disabled={loading}>
          {loading ? <Loader2 className="size-4 animate-spin" /> : null}
          {isHi ? "जाँचें" : "Run checks"}
        </Button>
      </div>

      {result ? (
        <div className="mt-4 space-y-4">
          {result.empty_slots.length === 0 &&
          result.no_teacher.length === 0 &&
          result.overloaded.length === 0 ? (
            <p className="flex items-center gap-2 text-sm text-emerald-700 dark:text-emerald-400">
              <CheckCircle2 className="size-4" />
              {isHi ? "कोई चेतावनी नहीं मिली।" : "No warnings. Every period is filled and has a teacher."}
            </p>
          ) : null}

          <Group
            title={isHi ? "खाली कालांश" : "Empty periods"}
            count={result.empty_slots.length}
            items={result.empty_slots}
            days={days}
            renderLabel={(item) => `${item.class_label}`}
            isHi={isHi}
          />
          <Group
            title={isHi ? "शिक्षक के बिना कक्षाएँ" : "Classes with no teacher"}
            count={result.no_teacher.length}
            items={result.no_teacher}
            days={days}
            renderLabel={(item) => `${item.class_label} · ${item.subject_name ?? ""}`}
            isHi={isHi}
          />

          {result.overloaded.length > 0 ? (
            <div>
              <p className="flex items-center gap-2 text-sm font-medium text-foreground">
                <AlertTriangle className="size-4 text-amber-600" />
                {isHi ? "अधिक भार वाले शिक्षक" : "Teachers over the daily limit"} ({result.overloaded.length})
              </p>
              <ul className="mt-2 space-y-1 text-sm text-muted-foreground">
                {result.overloaded.slice(0, SHOW).map((o) => (
                  <li key={`${o.teacher_id}-${o.day_of_week}`}>
                    {o.teacher_name} · {days[o.day_of_week]} · {o.periods}/{o.cap}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}

function Group({
  title,
  count,
  items,
  days,
  renderLabel,
  isHi,
}: {
  title: string;
  count: number;
  items: PlannerValidationItem[];
  days: string[];
  renderLabel: (item: PlannerValidationItem) => string;
  isHi: boolean;
}) {
  if (count === 0) return null;
  const more = count - SHOW;
  return (
    <div>
      <p className="flex items-center gap-2 text-sm font-medium text-foreground">
        <AlertTriangle className="size-4 text-amber-600" />
        {title} ({count})
      </p>
      <ul className="mt-2 space-y-1 text-sm text-muted-foreground">
        {items.slice(0, SHOW).map((item, i) => (
          <li key={`${item.day_of_week}-${item.period_number}-${item.class_label}-${i}`}>
            {days[item.day_of_week]} · P{item.period_number} · {renderLabel(item)}
          </li>
        ))}
      </ul>
      {more > 0 ? (
        <p className="mt-1 text-xs text-muted-foreground">
          {isHi ? `और ${more}` : `and ${more} more`}
        </p>
      ) : null}
    </div>
  );
}
