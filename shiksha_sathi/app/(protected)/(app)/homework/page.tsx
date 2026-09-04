"use client";

import { Loader2, Plus } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import {
  createHomework,
  getProfile,
  listHomework,
  type HomeworkListItem,
  type Profile,
} from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { useCopy } from "@/lib/copy";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, { day: "numeric", month: "short" });
}

export default function TeacherHomeworkPage() {
  const { accessToken } = useAuth();
  const copy = useCopy();
  const t = copy.homeworkPage;

  const [items, setItems] = useState<HomeworkListItem[]>([]);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [formOpen, setFormOpen] = useState(false);
  const [gradeId, setGradeId] = useState<string | null>(null);
  const [subjectId, setSubjectId] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [saving, setSaving] = useState(false);

  const reload = useCallback(() => {
    return Promise.all([listHomework(accessToken), getProfile(accessToken)])
      .then(([h, p]) => {
        setItems(h);
        setProfile(p);
        setGradeId((cur) => cur ?? p.subjects[0]?.grade_id ?? null);
      })
      .catch((e: unknown) => {
        toast.error(e instanceof Error ? e.message : "Could not load homework.");
      });
  }, [accessToken]);

  useEffect(() => {
    if (!accessToken) return;
    let active = true;
    reload().finally(() => {
      if (active) setLoading(false);
    });
    return () => {
      active = false;
    };
  }, [accessToken, reload]);

  const grades = Array.from(
    new Map((profile?.subjects ?? []).map((s) => [s.grade_id, s.grade_label])).entries(),
  ).map(([value, label]) => ({ value, label }));

  const subjects = useMemo(
    () =>
      (profile?.subjects ?? [])
        .filter((s) => s.grade_id === gradeId)
        .map((s) => ({ value: s.subject_id, label: s.subject_name })),
    [profile, gradeId],
  );

  async function submit() {
    if (!gradeId || title.trim().length === 0) return;
    setSaving(true);
    try {
      await createHomework(accessToken, {
        grade_id: gradeId,
        subject_id: subjectId,
        title: title.trim(),
        description: description.trim() || null,
        due_date: dueDate || null,
      });
      toast.success(t.assignedToast);
      setTitle("");
      setDescription("");
      setDueDate("");
      setSubjectId(null);
      setFormOpen(false);
      await reload();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not assign homework.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="flex flex-1 flex-col overflow-hidden">
      <div className="flex items-center justify-between border-b border-border px-5 py-4">
        <div>
          <h1 className="text-[15px]">{t.title}</h1>
          <p className="mt-0.5 text-xs text-muted-foreground">{t.sub}</p>
        </div>
        <Button size="sm" onClick={() => setFormOpen((o) => !o)}>
          <Plus className="size-3.5" />
          {t.newBtn}
        </Button>
      </div>

      <div className="flex-1 overflow-y-auto px-5 py-4">
        <div className="mx-auto flex w-full max-w-2xl flex-col gap-4">
          {loading ? (
            <div className="flex justify-center py-16">
              <Loader2 className="size-6 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <>
              {formOpen && (
                <div className="flex flex-col gap-3 rounded-xl bg-card p-4 ring-1 ring-foreground/10">
                  <div className="flex flex-wrap gap-2">
                    <Select
                      value={gradeId}
                      onValueChange={(v) => {
                        setGradeId(v);
                        setSubjectId(null);
                      }}
                      options={grades}
                      placeholder={t.classLabel}
                    />
                    <Select
                      value={subjectId}
                      onValueChange={setSubjectId}
                      options={subjects}
                      placeholder={t.subjectLabel}
                    />
                    <Input
                      type="date"
                      value={dueDate}
                      onChange={(e) => setDueDate(e.target.value)}
                      className="w-40"
                      aria-label={t.dueLabel}
                    />
                  </div>
                  <Input
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder={t.titleLabel}
                    maxLength={200}
                  />
                  <textarea
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder={t.descriptionLabel}
                    rows={3}
                    className="w-full resize-none rounded-lg border border-input bg-transparent px-2.5 py-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
                  />
                  <Button
                    onClick={() => void submit()}
                    disabled={!gradeId || title.trim().length === 0 || saving}
                    className="self-start"
                  >
                    {saving ? t.assigning : t.assignBtn}
                  </Button>
                </div>
              )}

              {items.length === 0 ? (
                <p className="rounded-xl bg-card p-6 text-center text-sm text-muted-foreground ring-1 ring-foreground/10">
                  {t.empty}
                </p>
              ) : (
                <ul className="flex flex-col gap-3">
                  {items.map((h) => (
                    <li
                      key={h.id}
                      className="flex flex-col gap-1.5 rounded-xl bg-card p-4 ring-1 ring-foreground/10"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <span className="font-medium text-foreground">{h.title}</span>
                        <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                          {t.doneCount(h.done_count, h.total_count)}
                        </span>
                      </div>
                      <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                        <span>{h.grade_label}</span>
                        {h.subject_name && <span>{h.subject_name}</span>}
                        <span>{h.due_date ? t.due(fmtDate(h.due_date)) : t.noDueDate}</span>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </>
          )}
        </div>
      </div>
    </main>
  );
}
