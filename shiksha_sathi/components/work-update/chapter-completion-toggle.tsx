"use client";

import { BookCheck } from "lucide-react";

/** The one thing that moves the Principal's syllabus tracker. Deliberately
 * separate from the daily activity tick marks (ActivityPicker) -- ticking
 * "Chapter Taught" just logs that today's session touched this chapter;
 * this is an explicit, independent milestone a teacher sets only when the
 * whole chapter is actually done. */
export function ChapterCompletionToggle({
  isHi,
  chapterTitle,
  checked,
  onChange,
}: {
  isHi: boolean;
  chapterTitle: string;
  checked: boolean;
  onChange: (next: boolean) => void;
}) {
  return (
    <div
      className={`rounded-xl border p-4 transition-colors ${
        checked ? "border-emerald-500/40 bg-emerald-500/5" : "border-dashed border-border bg-card"
      }`}
    >
      <div className="flex items-start gap-3">
        <span
          className={`mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg ${
            checked ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400" : "bg-muted text-muted-foreground"
          }`}
        >
          <BookCheck className="size-4" />
        </span>
        <div className="flex-1">
          <div className="text-sm font-semibold text-foreground">
            {isHi
              ? `क्या "${chapterTitle}" अब पूरी तरह पूर्ण हो गया है?`
              : `Is "${chapterTitle}" now fully complete?`}
          </div>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {isHi
              ? "यह प्रधानाचार्य के पाठ्यक्रम ट्रैकर को अपडेट करेगा — केवल तब चुनें जब अध्याय पूरी तरह पढ़ाया जा चुका हो।"
              : "This updates your Principal's syllabus tracker for the whole school — only mark it once the chapter is fully taught, not just started."}
          </p>

          <div className="mt-3 inline-flex rounded-lg border border-border bg-muted/60 p-0.5 text-xs font-medium">
            <button
              type="button"
              onClick={() => onChange(false)}
              className={`rounded-md px-3 py-1.5 transition-colors ${
                !checked ? "bg-card text-foreground shadow-xs" : "text-muted-foreground"
              }`}
            >
              {isHi ? "नहीं, अभी नहीं" : "Not yet"}
            </button>
            <button
              type="button"
              onClick={() => onChange(true)}
              className={`rounded-md px-3 py-1.5 transition-colors ${
                checked
                  ? "bg-emerald-600 text-white shadow-xs"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {isHi ? "हाँ, पूर्ण हुआ" : "Yes, completed"}
            </button>
          </div>

          {checked && (
            <p className="mt-2 text-xs font-medium text-emerald-700 dark:text-emerald-300">
              {isHi
                ? "✅ प्रधानाचार्य के पाठ्यक्रम ट्रैकर में पूर्ण के रूप में चिह्नित किया जाएगा।"
                : "✅ Will mark this chapter complete in the Principal's syllabus tracker."}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
