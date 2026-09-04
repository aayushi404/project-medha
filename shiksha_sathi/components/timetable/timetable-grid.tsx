"use client";

import type { TimetableSlot } from "@/lib/api";
import { useCopy } from "@/lib/copy";
import type { SelectOption } from "@/components/ui/select";
import { Select } from "@/components/ui/select";

const PERIODS = [1, 2, 3, 4, 5, 6, 7, 8];

function slotAt(slots: TimetableSlot[], day: number, period: number) {
  return slots.find((s) => s.day_of_week === day && s.period_number === period) ?? null;
}

/**
 * Mon-Sat x 8-period weekly grid. Read-only renders subject names; editable
 * renders a subject picker per cell (teacher assignment per slot is
 * deliberately left out of the UI -- the backend supports it, but a subject
 * picker alone keeps this genuinely lightweight).
 */
export function TimetableGrid({
  slots,
  editable = false,
  subjectOptions = [],
  onChange,
}: {
  slots: TimetableSlot[];
  editable?: boolean;
  subjectOptions?: SelectOption[];
  onChange?: (day: number, period: number, subjectId: string | null) => void;
}) {
  const copy = useCopy();
  const t = copy.timetablePage;
  const emptyOptions: SelectOption[] = [{ value: "__none__", label: t.empty }, ...subjectOptions];

  return (
    <div className="overflow-x-auto rounded-xl bg-card ring-1 ring-foreground/10">
      <table className="w-full min-w-[640px] border-collapse text-sm">
        <thead>
          <tr>
            <th className="w-14 border-b border-border p-2 text-left text-xs text-muted-foreground" />
            {t.days.map((d) => (
              <th
                key={d}
                className="border-b border-border p-2 text-left text-xs font-medium text-muted-foreground"
              >
                {d}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {PERIODS.map((period) => (
            <tr key={period}>
              <td className="border-b border-border p-2 text-xs font-medium text-muted-foreground">
                {t.period(period)}
              </td>
              {t.days.map((_, dayIdx) => {
                const slot = slotAt(slots, dayIdx, period);
                return (
                  <td key={dayIdx} className="border-b border-border p-1.5 align-top">
                    {editable ? (
                      <Select
                        value={slot?.subject_id ?? "__none__"}
                        onValueChange={(v) =>
                          onChange?.(dayIdx, period, v === "__none__" ? null : v)
                        }
                        options={emptyOptions}
                        className="w-full min-w-28"
                      />
                    ) : (
                      <span
                        className={
                          slot?.subject_name
                            ? "block truncate text-xs text-foreground"
                            : "block truncate text-xs text-muted-foreground/60"
                        }
                      >
                        {slot?.subject_name ?? "—"}
                      </span>
                    )}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
