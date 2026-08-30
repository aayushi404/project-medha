"use client";

import {
  ChevronDown,
  HelpCircle,
  Lightbulb,
  Loader2,
  Users,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";

import { ContentActions } from "@/components/dashboard/content-actions";
import { ArtifactView } from "@/components/modules/artifact-view";
import {
  getModule,
  listModules,
  type ArtifactType,
  type ModuleArtifact,
  type ModuleListItem,
} from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { useCopy } from "@/lib/copy";
import { formatRelativeTime } from "@/lib/format";
import { speakableArtifact } from "@/lib/speech";
import { cn } from "@/lib/utils";

const TYPE_META: Record<ArtifactType, { icon: LucideIcon; className: string }> = {
  explanation: { icon: Lightbulb, className: "text-earth" },
  quiz: { icon: HelpCircle, className: "text-terracotta" },
  activity: { icon: Users, className: "text-sage" },
};

const ORDER: ArtifactType[] = ["explanation", "quiz", "activity"];

type ListState =
  | { key: string; modules: ModuleListItem[] }
  | { key: string; failed: true }
  | null;

type ChapterHistoryProps = {
  gradeId: string;
  subjectId: string;
  chapterId: string;
  /** bump to force a refetch (e.g. after generating new content) */
  refreshKey: number;
  onQuiz: () => void;
  onActivity: () => void;
  defaultOpen?: boolean;
};

export function ChapterHistory({
  gradeId,
  subjectId,
  chapterId,
  refreshKey,
  onQuiz,
  onActivity,
  defaultOpen = false,
}: ChapterHistoryProps) {
  const copy = useCopy();
  const { accessToken } = useAuth();
  const key = `${gradeId}|${subjectId}|${chapterId}|${refreshKey}`;

  const [result, setResult] = useState<ListState>(null);
  const [open, setOpen] = useState(defaultOpen);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const modules = await listModules(accessToken, { gradeId, subjectId, chapterId });
        if (!cancelled) setResult({ key, modules });
      } catch {
        if (!cancelled) setResult({ key, failed: true });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [key, accessToken, gradeId, subjectId, chapterId]);

  const settled = result && result.key === key ? result : null;
  const modules = settled && !("failed" in settled) ? settled.modules : [];
  const failed = !!(settled && "failed" in settled);
  const loading = !settled;

  const count = modules.length;

  return (
    <section className="overflow-hidden rounded-2xl border border-border bg-card">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex w-full items-center gap-2.5 px-3.5 py-3 text-left transition-colors hover:bg-muted"
      >
        <span className="flex size-6 shrink-0 items-center justify-center rounded-md bg-accent text-terracotta">
          <Lightbulb className="size-3.5" />
        </span>
        <span className="text-[13px] font-medium">{copy.chapterHistoryTitle}</span>
        {!loading && !failed ? (
          <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
            {copy.chapterHistoryCount(count)}
          </span>
        ) : null}
        {loading ? <Loader2 className="size-3.5 animate-spin text-muted-foreground" /> : null}
        <ChevronDown
          className={cn(
            "ml-auto size-4 shrink-0 text-muted-foreground transition-transform",
            open && "rotate-180",
          )}
        />
      </button>

      <div
        className={cn(
          "grid transition-[grid-template-rows] duration-200 ease-out",
          open ? "grid-rows-[1fr]" : "grid-rows-[0fr]",
        )}
      >
        <div className="overflow-hidden">
          <div className="border-t border-border px-3.5 py-3">
            {loading ? (
              <div className="flex justify-center py-6">
                <Loader2 className="size-5 animate-spin text-muted-foreground" />
              </div>
            ) : failed ? (
              <p className="py-4 text-center text-sm text-muted-foreground">
                {copy.chapterHistoryFailed}
              </p>
            ) : count === 0 ? (
              <p className="py-4 text-center text-sm text-muted-foreground">
                {copy.chapterHistoryEmpty}
              </p>
            ) : (
              <div className="flex flex-col gap-2">
                <p className="text-[11px] text-muted-foreground">{copy.chapterHistoryHint}</p>
                {modules.map((m) => (
                  <HistoryModule
                    key={m.id}
                    item={m}
                    onQuiz={onQuiz}
                    onActivity={onActivity}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}

type DetailState =
  | { artifacts: ModuleArtifact[] }
  | { failed: true }
  | null;

function HistoryModule({
  item,
  onQuiz,
  onActivity,
}: {
  item: ModuleListItem;
  onQuiz: () => void;
  onActivity: () => void;
}) {
  const copy = useCopy();
  const { accessToken } = useAuth();
  const [open, setOpen] = useState(false);
  const [detail, setDetail] = useState<DetailState>(null);
  const [pending, setPending] = useState(false);

  async function toggle() {
    const next = !open;
    setOpen(next);
    if (next && !detail && !pending) {
      setPending(true);
      try {
        const full = await getModule(accessToken, item.id);
        setDetail({ artifacts: full.artifacts });
      } catch {
        setDetail({ failed: true });
      } finally {
        setPending(false);
      }
    }
  }

  const types = [...item.artifact_types].sort(
    (a, b) => ORDER.indexOf(a) - ORDER.indexOf(b),
  );
  const artifacts = detail && "artifacts" in detail ? detail.artifacts : [];

  return (
    <div className="overflow-hidden rounded-xl border border-border">
      <button
        type="button"
        onClick={toggle}
        aria-expanded={open}
        className="flex w-full items-center gap-3 px-3 py-2.5 text-left transition-colors hover:bg-muted"
      >
        <div className="min-w-0 flex-1">
          <div className="truncate text-[13px] font-medium">{item.title}</div>
          <div className="mt-1 flex flex-wrap items-center gap-1.5">
            {types.map((t) => {
              const { icon: Icon, className } = TYPE_META[t];
              return (
                <span
                  key={t}
                  className="inline-flex items-center gap-1 rounded-md border border-border bg-background px-1.5 py-0.5 text-[10px] text-muted-foreground"
                >
                  <Icon className={cn("size-3", className)} />
                  {copy.artifactLabel[t] ?? t}
                </span>
              );
            })}
          </div>
        </div>
        <span className="shrink-0 text-[11px] whitespace-nowrap text-muted-foreground">
          {formatRelativeTime(item.updated_at)}
        </span>
        <ChevronDown
          className={cn(
            "size-4 shrink-0 text-muted-foreground transition-transform",
            open && "rotate-180",
          )}
        />
      </button>

      {open ? (
        <div className="flex flex-col gap-3 border-t border-border bg-muted/20 px-3 py-3">
          {pending ? (
            <div className="flex justify-center py-4">
              <Loader2 className="size-4 animate-spin text-muted-foreground" />
            </div>
          ) : detail && "failed" in detail ? (
            <p className="py-2 text-center text-xs text-muted-foreground">
              {copy.chapterHistoryFailed}
            </p>
          ) : (
            <>
              {artifacts.map((a) => (
                <div key={a.id} className="flex flex-col gap-2">
                  <ArtifactView artifact={a} />
                  <ContentActions
                    speechId={a.id}
                    speechText={speakableArtifact(a)}
                    onQuiz={onQuiz}
                    onActivity={onActivity}
                    hide={
                      a.artifact_type === "quiz"
                        ? ["quiz"]
                        : a.artifact_type === "activity"
                          ? ["activity"]
                          : []
                    }
                  />
                </div>
              ))}
              <Link
                href={`/modules/${item.id}`}
                className="text-xs text-primary hover:underline"
              >
                {copy.openFullModule}
              </Link>
            </>
          )}
        </div>
      ) : null}
    </div>
  );
}
