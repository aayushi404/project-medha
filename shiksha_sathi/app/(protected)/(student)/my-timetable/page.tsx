"use client";

import { Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { getTimetable, type TimetableSlot } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { useCopy } from "@/lib/copy";
import { TimetableGrid } from "@/components/timetable/timetable-grid";

export default function StudentTimetablePage() {
  const { accessToken, teacher } = useAuth();
  const copy = useCopy();
  const t = copy.timetablePage;
  const gradeId = teacher?.grade_id ?? null;

  const [slots, setSlots] = useState<TimetableSlot[]>([]);
  const [loading, setLoading] = useState(gradeId != null);

  useEffect(() => {
    if (!accessToken || !gradeId) return;
    let active = true;
    getTimetable(accessToken, gradeId)
      .then((tt) => active && setSlots(tt.slots))
      .catch((e: unknown) => toast.error(e instanceof Error ? e.message : "Could not load timetable."))
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [accessToken, gradeId]);

  return (
    <main className="flex flex-1 flex-col overflow-hidden">
      <div className="border-b border-border px-5 py-4">
        <h1 className="text-[15px]">{t.studentTitle}</h1>
        <p className="mt-0.5 text-xs text-muted-foreground">{t.studentSub}</p>
      </div>

      <div className="flex-1 overflow-y-auto px-5 py-4">
        <div className="mx-auto w-full max-w-4xl">
          {loading ? (
            <div className="flex justify-center py-16">
              <Loader2 className="size-6 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <TimetableGrid slots={slots} />
          )}
        </div>
      </div>
    </main>
  );
}
