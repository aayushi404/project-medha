"use client";

import { Loader2, Printer, RefreshCw, Star, ThumbsDown, ThumbsUp, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { ConfirmDialog } from "@/components/ui/alert-dialog";
import {
  deleteGeneration,
  patchGeneration,
  sendGenerationFeedback,
  type Feedback,
} from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { useCopy } from "@/lib/copy";
import { cn } from "@/lib/utils";

/**
 * Favourite / feedback / regenerate / delete for a saved generation. Sits
 * under the document in `/{type-slug}/edit` (see generation-edit-view.tsx).
 */
export function GenerationToolbar({
  id,
  isFavorite,
  feedback,
  onDeleted,
  onRegenerate,
  regenerating,
}: {
  id: string;
  isFavorite: boolean;
  feedback: Feedback | null;
  onDeleted: () => void;
  onRegenerate: () => void;
  regenerating: boolean;
}) {
  const rootCopy = useCopy();
  const copy = rootCopy.generation.viewer;
  const { accessToken } = useAuth();
  const [favorite, setFavorite] = useState(isFavorite);
  const [rating, setRating] = useState<1 | -1 | null>(feedback?.rating ?? null);
  const [busy, setBusy] = useState(false);

  async function toggleFavorite() {
    const next = !favorite;
    setFavorite(next); // optimistic
    try {
      await patchGeneration(accessToken, id, { is_favorite: next });
    } catch (err) {
      setFavorite(!next);
      toast.error(err instanceof Error ? err.message : "Couldn't save.");
    }
  }

  async function rate(next: 1 | -1) {
    const prev = rating;
    setRating(next);
    try {
      await sendGenerationFeedback(accessToken, id, { rating: next });
    } catch (err) {
      setRating(prev);
      toast.error(err instanceof Error ? err.message : "Couldn't save.");
    }
  }

  async function onDelete() {
    setBusy(true);
    try {
      await deleteGeneration(accessToken, id);
      onDeleted();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Delete failed.");
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-1.5 rounded-xl border border-border bg-card p-2">
      <button
        type="button"
        onClick={() => void toggleFavorite()}
        aria-pressed={favorite}
        className={cn(
          "inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs transition-colors pointer-coarse:px-3 pointer-coarse:py-2",
          favorite ? "text-gold" : "text-muted-foreground hover:bg-muted",
        )}
      >
        <Star className={cn("size-3.5", favorite && "fill-current")} />
        {favorite ? copy.unfavorite : copy.favorite}
      </button>

      <button
        type="button"
        aria-pressed={rating === 1}
        onClick={() => void rate(1)}
        className={cn(
          "inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs transition-colors pointer-coarse:px-3 pointer-coarse:py-2",
          rating === 1 ? "bg-accent text-accent-foreground" : "text-muted-foreground hover:bg-muted",
        )}
      >
        <ThumbsUp className="size-3.5" />
      </button>
      <button
        type="button"
        aria-pressed={rating === -1}
        onClick={() => void rate(-1)}
        className={cn(
          "inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs transition-colors pointer-coarse:px-3 pointer-coarse:py-2",
          rating === -1 ? "bg-accent text-accent-foreground" : "text-muted-foreground hover:bg-muted",
        )}
      >
        <ThumbsDown className="size-3.5" />
      </button>

      <button
        type="button"
        onClick={() => window.print()}
        className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs text-muted-foreground transition-colors hover:bg-muted pointer-coarse:px-3 pointer-coarse:py-2"
      >
        <Printer className="size-3.5" />
        {copy.print}
      </button>

      <button
        type="button"
        onClick={onRegenerate}
        disabled={regenerating}
        className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs text-muted-foreground transition-colors hover:bg-muted disabled:opacity-50 pointer-coarse:px-3 pointer-coarse:py-2"
      >
        {regenerating ? (
          <Loader2 className="size-3.5 animate-spin" />
        ) : (
          <RefreshCw className="size-3.5" />
        )}
        {regenerating ? copy.regenerating : copy.regenerate}
      </button>

      <ConfirmDialog
        trigger={
          <span className="ml-auto inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs text-destructive transition-colors hover:bg-destructive/10 pointer-coarse:px-3 pointer-coarse:py-2">
            <Trash2 className="size-3.5" />
            {copy.delete}
          </span>
        }
        title={copy.deleteConfirmTitle}
        description={copy.deleteConfirmBody}
        confirmLabel={copy.delete}
        cancelLabel={rootCopy.cancel}
        onConfirm={onDelete}
      />
      {busy ? <Loader2 className="size-3.5 animate-spin text-muted-foreground" /> : null}
    </div>
  );
}
