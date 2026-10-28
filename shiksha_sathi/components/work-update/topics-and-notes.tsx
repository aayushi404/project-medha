"use client";

import { Check, Sparkles } from "lucide-react";

import { AI_USEFULNESS_OPTIONS, type AiHelpfulnessRating } from "@/lib/work-update-store";
import type { Topic } from "@/lib/api";

const inputCls =
  "mt-2 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm placeholder:text-muted-foreground/60 focus:border-terracotta focus:outline-none focus:ring-1 focus:ring-terracotta";

/** Sub-topics (shown once a chapter is being logged as taught or completed),
 * the Medha-AI-usefulness rating, and the required note for the Principal. */
export function TopicsAndNotes({
  isHi,
  showTopics,
  chapterPicked,
  topics,
  pickedTopics,
  onToggleTopic,
  otherTopics,
  onOtherTopicsChange,
  aiRating,
  onAiRatingChange,
  note,
  onNoteChange,
}: {
  isHi: boolean;
  showTopics: boolean;
  chapterPicked: boolean;
  topics: Topic[];
  pickedTopics: string[];
  onToggleTopic: (title: string) => void;
  otherTopics: string;
  onOtherTopicsChange: (v: string) => void;
  aiRating: AiHelpfulnessRating;
  onAiRatingChange: (v: AiHelpfulnessRating) => void;
  note: string;
  onNoteChange: (v: string) => void;
}) {
  return (
    <div className="space-y-4">
      {showTopics && (
        <div className="rounded-xl border border-border bg-card p-4">
          <div className="text-xs font-semibold text-foreground">
            {isHi ? "📖 अध्याय के कौन-से भाग पढ़ाए?" : "📖 Which sub-topics did you teach?"}
          </div>
          {!chapterPicked ? (
            <p className="mt-1.5 text-xs text-muted-foreground">
              {isHi ? "पहले अध्याय चुनें।" : "Choose a chapter above first."}
            </p>
          ) : (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {topics.map((t) => {
                const on = pickedTopics.includes(t.title);
                return (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => onToggleTopic(t.title)}
                    className={`rounded-full border px-2.5 py-1 text-xs transition-colors ${
                      on
                        ? "border-terracotta bg-terracotta/10 font-medium text-terracotta"
                        : "border-border bg-background text-foreground/80 hover:bg-muted"
                    }`}
                  >
                    {on && <Check className="mr-1 inline size-3 stroke-[3]" />}
                    {t.title}
                  </button>
                );
              })}
              {topics.length === 0 && (
                <span className="text-xs text-muted-foreground">
                  {isHi ? "इस अध्याय में उप-विषय सूची नहीं है — नीचे लिखें।" : "No sub-topics listed. Write them below."}
                </span>
              )}
            </div>
          )}
          <input
            type="text"
            value={otherTopics}
            onChange={(e) => onOtherTopicsChange(e.target.value)}
            placeholder={isHi ? "अन्य (अपना लिखें)…" : "Other (write your own)…"}
            maxLength={300}
            className={inputCls}
          />
        </div>
      )}

      <div className="rounded-xl border border-primary/20 bg-primary/5 p-4">
        <div className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
          <Sparkles className="size-3.5 text-amber-500" />
          <span>{isHi ? "मेधा AI असिस्टेंट आज कितना मददगार रहा?" : "How useful was Medha AI Assistant today?"}</span>
        </div>
        <div className="mt-2.5 grid grid-cols-2 gap-2">
          {AI_USEFULNESS_OPTIONS.map((opt) => {
            const active = aiRating === opt.id;
            return (
              <button
                key={opt.id}
                type="button"
                onClick={() => onAiRatingChange(opt.id)}
                className={`flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs transition-colors ${
                  active
                    ? "border-primary bg-primary font-medium text-primary-foreground shadow-xs"
                    : "border-border bg-card text-muted-foreground hover:bg-muted"
                }`}
              >
                <span>{opt.emoji}</span>
                <span className="truncate">{isHi ? opt.labelHi : opt.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      <div>
        <label className="block text-xs text-muted-foreground">
          {isHi ? "प्रधानाचार्य के लिए छोटी टिप्पणी (ज़रूरी)" : "Short note for Principal (required)"}
        </label>
        <input
          type="text"
          required
          value={note}
          onChange={(e) => onNoteChange(e.target.value)}
          placeholder={
            isHi ? "उदा. बच्चों ने प्रयोग में बहुत रुचि दिखाई..." : "e.g. Cleared all doubts on chemical equations..."
          }
          maxLength={300}
          className={inputCls}
        />
      </div>
    </div>
  );
}
