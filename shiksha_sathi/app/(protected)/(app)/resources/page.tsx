"use client";

import { Loader2, Plus } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import {
  addLibraryItem,
  deleteLibraryItem,
  getProfile,
  getSubjects,
  listLibraryItems,
  type LibraryItem,
  type Profile,
  type Subject,
} from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { useCopy } from "@/lib/copy";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { ResourceList } from "@/components/resources/resource-list";

export default function TeacherResourcesPage() {
  const { accessToken } = useAuth();
  const copy = useCopy();
  const t = copy.resourcesPage;

  const [profile, setProfile] = useState<Profile | null>(null);
  const [allSubjects, setAllSubjects] = useState<Subject[]>([]);
  const [items, setItems] = useState<LibraryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);

  const [filterGrade, setFilterGrade] = useState<string | null>(null);
  const [filterSubject, setFilterSubject] = useState<string | null>(null);

  const [formOpen, setFormOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [url, setUrl] = useState("");
  const [description, setDescription] = useState("");
  const [gradeId, setGradeId] = useState<string | null>(null);
  const [subjectId, setSubjectId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const reload = useCallback(() => {
    return listLibraryItems(accessToken, {
      gradeId: filterGrade ?? undefined,
      subjectId: filterSubject ?? undefined,
    })
      .then(setItems)
      .catch((e: unknown) => toast.error(e instanceof Error ? e.message : "Could not load."));
  }, [accessToken, filterGrade, filterSubject]);

  useEffect(() => {
    if (!accessToken) return;
    let active = true;
    getProfile(accessToken)
      .then((p) => active && setProfile(p))
      .catch(() => {
        /* filters just stay empty */
      });
    getSubjects()
      .then((s) => active && setAllSubjects(s))
      .catch(() => {
        /* filter just stays empty */
      });
    return () => {
      active = false;
    };
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

  const formSubjects = useMemo(
    () =>
      (profile?.subjects ?? [])
        .filter((s) => s.grade_id === gradeId)
        .map((s) => ({ value: s.subject_id, label: s.subject_name })),
    [profile, gradeId],
  );

  async function submit() {
    if (title.trim().length === 0 || url.trim().length === 0) return;
    setSaving(true);
    try {
      await addLibraryItem(accessToken, {
        title: title.trim(),
        url: url.trim(),
        description: description.trim() || null,
        grade_id: gradeId,
        subject_id: subjectId,
      });
      toast.success(t.addedToast);
      setTitle("");
      setUrl("");
      setDescription("");
      setFormOpen(false);
      await reload();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not add.");
    } finally {
      setSaving(false);
    }
  }

  async function onDelete(id: string) {
    if (!window.confirm(t.deleteConfirm)) return;
    setBusyId(id);
    try {
      await deleteLibraryItem(accessToken, id);
      toast.success(t.deletedToast);
      await reload();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not remove.");
    } finally {
      setBusyId(null);
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
          {t.addBtn}
        </Button>
      </div>

      <div className="flex-1 overflow-y-auto px-5 py-4">
        <div className="mx-auto flex w-full max-w-2xl flex-col gap-4">
          {formOpen && (
            <div className="flex flex-col gap-3 rounded-xl bg-card p-4 ring-1 ring-foreground/10">
              <Input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder={t.titleLabel}
                maxLength={200}
              />
              <Input
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder={t.urlLabel}
              />
              <Input
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder={t.descriptionLabel}
              />
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
                  options={formSubjects}
                  placeholder={t.subjectLabel}
                />
              </div>
              <Button
                onClick={() => void submit()}
                disabled={title.trim().length === 0 || url.trim().length === 0 || saving}
                className="self-start"
              >
                {saving ? t.addingBtn : t.addBtn}
              </Button>
            </div>
          )}

          <div className="flex flex-wrap gap-2">
            <Select
              value={filterGrade ?? "__all__"}
              onValueChange={(v) => setFilterGrade(v === "__all__" ? null : v)}
              options={[{ value: "__all__", label: t.allClasses }, ...grades]}
            />
            <Select
              value={filterSubject ?? "__all__"}
              onValueChange={(v) => setFilterSubject(v === "__all__" ? null : v)}
              options={[
                { value: "__all__", label: t.allSubjects },
                ...allSubjects.map((s) => ({ value: s.id, label: s.name })),
              ]}
            />
          </div>

          {loading ? (
            <div className="flex justify-center py-16">
              <Loader2 className="size-6 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <ResourceList items={items} onDelete={onDelete} busyId={busyId} />
          )}
        </div>
      </div>
    </main>
  );
}
