"use client";

import { ChevronLeft, Loader2, Trash2 } from "lucide-react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { ArtifactView } from "@/components/modules/artifact-view";
import { FeedbackBar } from "@/components/modules/feedback-bar";
import { ConfirmDialog } from "@/components/ui/alert-dialog";
import { deleteModule, getModule, type ModuleDetail } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { copy } from "@/lib/copy";
import { formatRelativeTime } from "@/lib/format";

const ORDER: Record<string, number> = { explanation: 0, quiz: 1, activity: 2 };

export default function ModuleDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { accessToken } = useAuth();

  const [module, setModule] = useState<ModuleDetail | null>(null);
  const [missing, setMissing] = useState(false);

  useEffect(() => {
    let cancelled = false;
    getModule(accessToken, id)
      .then((m) => !cancelled && setModule(m))
      .catch(() => !cancelled && setMissing(true));
    return () => {
      cancelled = true;
    };
  }, [accessToken, id]);

  if (missing) {
    return (
      <main className="flex flex-1 flex-col items-center justify-center gap-3 text-center text-sm text-muted-foreground">
        <p>{copy.moduleNotFound}</p>
        <Link href="/modules" className="text-primary underline">
          {copy.myModules}
        </Link>
      </main>
    );
  }

  if (!module) {
    return (
      <main className="flex flex-1 items-center justify-center">
        <Loader2 className="size-5 animate-spin text-muted-foreground" />
      </main>
    );
  }

  const artifacts = [...module.artifacts].sort(
    (a, b) => (ORDER[a.artifact_type] ?? 9) - (ORDER[b.artifact_type] ?? 9),
  );
  const sub = [module.grade_label, module.subject_name, module.topic_title]
    .filter(Boolean)
    .join(" · ");

  async function onDelete() {
    try {
      await deleteModule(accessToken, id);
      toast.success("Module deleted.");
      router.replace("/modules");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Delete failed.");
    }
  }

  return (
    <main className="flex flex-1 flex-col overflow-hidden">
      <div className="flex items-start gap-3 border-b border-border px-5 py-4">
        <Link href="/modules" className="mt-0.5 rounded-lg p-1 hover:bg-muted" aria-label={copy.back}>
          <ChevronLeft className="size-4" />
        </Link>
        <div className="min-w-0 flex-1">
          <h1 className="text-[15px]">{module.title}</h1>
          <div className="mt-0.5 text-xs text-muted-foreground">
            {sub} · {formatRelativeTime(module.updated_at)}
          </div>
        </div>
        <ConfirmDialog
          trigger={
            <span className="inline-flex items-center gap-1.5 rounded-lg border border-border px-2 py-1.5 text-xs text-destructive hover:bg-muted">
              <Trash2 className="size-3.5" />
              {copy.deleteModule}
            </span>
          }
          title={copy.deleteConfirmTitle}
          description={copy.deleteConfirmBody}
          confirmLabel={copy.confirmDelete}
          cancelLabel={copy.cancel}
          onConfirm={onDelete}
        />
      </div>

      <div className="flex-1 overflow-y-auto px-5 py-4">
        <div className="mx-auto flex max-w-2xl flex-col gap-4">
          <FeedbackBar moduleId={id} initial={module.feedback} />
          {artifacts.map((a) => (
            <div key={a.id} className="flex flex-col gap-1.5">
              <div className="text-[11px] tracking-wide text-muted-foreground">
                {(copy.artifactLabel[a.artifact_type] ?? a.artifact_type).toUpperCase()}
              </div>
              <ArtifactView artifact={a} />
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}
