"use client";

import { ThumbsDown, ThumbsUp } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { sendFeedback, type Feedback } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { copy } from "@/lib/copy";
import { cn } from "@/lib/utils";

type Rating = 1 | -1;

export function FeedbackBar({
  moduleId,
  initial,
}: {
  moduleId: string;
  initial: Feedback | null;
}) {
  const { accessToken } = useAuth();
  const [rating, setRating] = useState<Rating | null>(initial?.rating ?? null);
  const [comment, setComment] = useState(initial?.comment ?? "");
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  async function save(nextRating: Rating, showToast = false) {
    const prev = rating;
    setRating(nextRating);
    try {
      await sendFeedback(accessToken, moduleId, {
        rating: nextRating,
        comment: comment.trim() || null,
      });
      if (showToast) toast.success("Thanks for the feedback!");
      return true;
    } catch (err) {
      setRating(prev);
      toast.error(err instanceof Error ? err.message : "Couldn't save feedback.");
      return false;
    }
  }

  async function saveComment() {
    if (rating === null) {
      toast.error("Pick 👍 or 👎 first.");
      return;
    }
    setSaving(true);
    const ok = await save(rating, true);
    setSaving(false);
    if (ok) setOpen(false);
  }

  return (
    <div className="flex flex-col gap-2 rounded-xl border border-border bg-card p-3">
      <div className="flex items-center gap-2">
        <button
          type="button"
          aria-pressed={rating === 1}
          onClick={() => void save(1)}
          className={cn(
            "flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs transition-colors",
            rating === 1
              ? "border-primary bg-accent text-accent-foreground"
              : "border-border hover:bg-muted",
          )}
        >
          <ThumbsUp className="size-3.5" />
          {copy.feedbackUp}
        </button>
        <button
          type="button"
          aria-pressed={rating === -1}
          onClick={() => void save(-1)}
          className={cn(
            "flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs transition-colors",
            rating === -1
              ? "border-primary bg-accent text-accent-foreground"
              : "border-border hover:bg-muted",
          )}
        >
          <ThumbsDown className="size-3.5" />
          {copy.feedbackDown}
        </button>
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          className="ml-auto text-xs text-muted-foreground hover:text-foreground"
        >
          {open ? "–" : "+ comment"}
        </button>
      </div>

      {open ? (
        <div className="flex flex-col gap-2">
          <textarea
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder={copy.commentPlaceholder}
            rows={2}
            className="resize-none rounded-lg border border-border bg-background p-2 text-xs outline-none focus-visible:border-ring"
          />
          <button
            type="button"
            onClick={() => void saveComment()}
            disabled={saving}
            className="self-end rounded-lg bg-primary px-3 py-1.5 text-xs text-primary-foreground disabled:opacity-50"
          >
            {copy.send}
          </button>
        </div>
      ) : null}
    </div>
  );
}
