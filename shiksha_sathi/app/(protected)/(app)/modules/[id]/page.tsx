"use client";

import {
  ChevronLeft,
  HelpCircle,
  Lightbulb,
  Loader2,
  Trash2,
  Users,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { ArtifactView } from "@/components/modules/artifact-view";
import { ConversationPanel } from "@/components/modules/conversation-panel";
import { FeedbackBar } from "@/components/modules/feedback-bar";
import { ConfirmDialog } from "@/components/ui/alert-dialog";
import {
  deleteModule,
  getModule,
  type ArtifactType,
  type ModuleArtifact,
  type ModuleDetail,
} from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { useCopy, useCurriculumT } from "@/lib/copy";
import { formatRelativeTime } from "@/lib/format";
import { cn } from "@/lib/utils";

const SECTIONS: { type: ArtifactType; icon: LucideIcon; accent: string }[] = [
  { type: "explanation", icon: Lightbulb, accent: "bg-gold/15 text-earth" },
  { type: "quiz", icon: HelpCircle, accent: "bg-accent text-terracotta" },
  { type: "activity", icon: Users, accent: "bg-sage/15 text-sage" },
];

export default function ModuleDetailPage() {
  const copy = useCopy();
  const t = useCurriculumT();
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { accessToken } = useAuth();

  const [module, setModule] = useState<ModuleDetail | null>(null);
  const [missing, setMissing] = useState(false);
  const [tab, setTab] = useState<"all" | ArtifactType>("all");

  useEffect(() => {
    let cancelled = false;
    getModule(accessToken, id)
      .then((m) => !cancelled && setModule(m))
      .catch(() => !cancelled && setMissing(true));
    return () => {
      cancelled = true;
    };
  }, [accessToken, id]);

  const grouped = useMemo(() => {
    const map = new Map<ArtifactType, ModuleArtifact[]>();
    for (const a of module?.artifacts ?? []) {
      const arr = map.get(a.artifact_type) ?? [];
      arr.push(a);
      map.set(a.artifact_type, arr);
    }
    return map;
  }, [module]);

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

  const sub = [
    t.grade(module.grade_label),
    t.subject(module.subject_name),
    t.topic(module.topic_title),
  ]
    .filter(Boolean)
    .join(" · ");

  const presentSections = SECTIONS.filter((s) => (grouped.get(s.type)?.length ?? 0) > 0);
  const showTabs = presentSections.length > 1;

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
        <Link
          href="/modules"
          className="mt-0.5 rounded-lg p-1 hover:bg-muted"
          aria-label={copy.back}
        >
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

      {showTabs ? (
        <div className="flex flex-wrap gap-2 border-b border-border px-5 py-2.5">
          <TabChip active={tab === "all"} onClick={() => setTab("all")}>
            {copy.allTypes}
          </TabChip>
          {presentSections.map((s) => (
            <TabChip
              key={s.type}
              active={tab === s.type}
              onClick={() => setTab(s.type)}
            >
              {copy.sectionTitle[s.type]} · {grouped.get(s.type)?.length}
            </TabChip>
          ))}
        </div>
      ) : null}

      <div className="flex-1 overflow-y-auto px-5 py-4">
        <div className="mx-auto flex max-w-2xl flex-col gap-6">
          <FeedbackBar moduleId={id} initial={module.feedback} />

          {presentSections
            .filter((s) => tab === "all" || tab === s.type)
            .map((s) => {
              const items = grouped.get(s.type) ?? [];
              const { icon: Icon, accent } = s;
              return (
                <section key={s.type} className="flex flex-col gap-3">
                  <div className="flex items-center gap-2">
                    <span
                      className={cn(
                        "flex size-6 items-center justify-center rounded-md",
                        accent,
                      )}
                    >
                      <Icon className="size-3.5" />
                    </span>
                    <h2 className="text-[13px] font-medium">
                      {copy.sectionTitle[s.type]}
                    </h2>
                    {items.length > 1 ? (
                      <span className="text-[11px] text-muted-foreground">
                        {items.length}
                      </span>
                    ) : null}
                  </div>
                  <div className="flex flex-col gap-3">
                    {items.map((a) => (
                      <ArtifactView key={a.id} artifact={a} />
                    ))}
                  </div>
                </section>
              );
            })}

          {module.session_id && tab === "all" ? (
            <ConversationPanel sessionId={module.session_id} />
          ) : null}
        </div>
      </div>
    </main>
  );
}

function TabChip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "rounded-full border px-3 py-1 text-xs transition-colors",
        active
          ? "border-transparent bg-accent text-accent-foreground"
          : "border-border text-muted-foreground hover:bg-muted",
      )}
    >
      {children}
    </button>
  );
}
