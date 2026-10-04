"use client";

import { Dialog } from "@base-ui/react/dialog";
import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useForm } from "react-hook-form";
import { CalendarClock, Check, Loader2, Trash2, Upload, X } from "lucide-react";
import { toast } from "sonner";

import {
  getAcademicYears,
  removeSchoolLogo,
  renameSchool,
  setCurrentAcademicYear,
  uploadSchoolLogo,
  type AcademicYear,
  type SchoolCard as SchoolCardData,
} from "@/lib/api";
import { logoProblem, schoolNameSchema, type SchoolNameFormValues } from "@/lib/validation/school";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SchoolLogo } from "@/components/school/school-card";

type Props = {
  token: string | null;
  school: SchoolCardData;
  onClose: () => void;
  /** after any save, so the sidebar card and every other shell refresh */
  onChanged: () => void;
};

/** The principal's editor for the school card: name, logo, and the current
 * academic year. Each section saves on its own. */
export function SchoolCardEditor({ token, school, onClose, onChanged }: Props) {
  return (
    <Dialog.Root open onOpenChange={(open) => !open && onClose()}>
      <Dialog.Portal>
        <Dialog.Backdrop className="fixed inset-0 z-50 bg-black/40" />
        <Dialog.Popup className="fixed left-1/2 top-1/2 z-50 flex max-h-[88vh] w-[min(34rem,calc(100vw-2rem))] -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-xl">
          <div className="flex items-start justify-between gap-3 border-b border-border p-4">
            <div>
              <Dialog.Title className="font-serif text-base font-semibold text-foreground">School details</Dialog.Title>
              <Dialog.Description className="mt-0.5 text-xs text-muted-foreground">
                Everyone at the school sees these on their dashboard.
              </Dialog.Description>
            </div>
            <Dialog.Close className="rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground" aria-label="Close">
              <X className="size-4" />
            </Dialog.Close>
          </div>

          <div className="flex-1 space-y-6 overflow-y-auto p-5">
            <NameSection token={token} school={school} onChanged={onChanged} />
            <LogoSection token={token} school={school} onChanged={onChanged} />
            <AcademicYearSection token={token} onChanged={onChanged} />
          </div>

          <div className="flex justify-end border-t border-border p-4">
            <Button variant="outline" onClick={onClose}>
              Done
            </Button>
          </div>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

function Section({ title, hint, children }: { title: string; hint?: string; children: ReactNode }) {
  return (
    <section className="space-y-3">
      <div>
        <h3 className="text-sm font-semibold text-foreground">{title}</h3>
        {hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
      </div>
      {children}
    </section>
  );
}

function NameSection({ token, school, onChanged }: { token: string | null; school: SchoolCardData; onChanged: () => void }) {
  const form = useForm<SchoolNameFormValues, unknown, { name: string }>({
    resolver: zodResolver(schoolNameSchema),
    mode: "onTouched",
    defaultValues: { name: school.name },
  });

  async function onSubmit(values: { name: string }) {
    try {
      await renameSchool(token, values.name);
      toast.success("School name updated");
      form.reset({ name: values.name });
      onChanged();
    } catch (err) {
      form.setError("name", { type: "server", message: err instanceof Error ? err.message : "Could not save the name." });
    }
  }

  const error = form.formState.errors.name?.message;
  return (
    <Section title="School name">
      <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col gap-2 sm:flex-row sm:items-start" noValidate>
        <div className="flex-1">
          <Input
            aria-label="School name"
            aria-invalid={!!error}
            autoComplete="off"
            maxLength={120}
            className="h-9"
            {...form.register("name")}
          />
          {error ? <p className="mt-1 text-xs text-destructive">{error}</p> : null}
        </div>
        <Button type="submit" size="sm" disabled={form.formState.isSubmitting || !form.formState.isDirty}>
          {form.formState.isSubmitting ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />}
          Save name
        </Button>
      </form>
    </Section>
  );
}

function LogoSection({ token, school, onChanged }: { token: string | null; school: SchoolCardData; onChanged: () => void }) {
  const [file, setFile] = useState<File | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const [busy, setBusy] = useState<"upload" | "remove" | null>(null);

  // a blob URL for the chosen file; revoked when the file changes or the editor closes
  const preview = useMemo(() => (file ? URL.createObjectURL(file) : null), [file]);
  useEffect(() => {
    return () => {
      if (preview) URL.revokeObjectURL(preview);
    };
  }, [preview]);

  function pick(next: File | null) {
    setProblem(null);
    if (!next) {
      setFile(null);
      return;
    }
    const issue = logoProblem(next);
    if (issue) {
      setProblem(issue);
      setFile(null);
      return;
    }
    setFile(next);
  }

  async function upload() {
    if (!file) return;
    setBusy("upload");
    try {
      await uploadSchoolLogo(token, file);
      toast.success("Logo updated");
      setFile(null);
      onChanged();
    } catch (err) {
      setProblem(err instanceof Error ? err.message : "Could not upload the logo.");
    } finally {
      setBusy(null);
    }
  }

  async function remove() {
    setBusy("remove");
    try {
      await removeSchoolLogo(token);
      toast.success("Logo removed");
      onChanged();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not remove the logo.");
    } finally {
      setBusy(null);
    }
  }

  const shown = preview ? { name: school.name, logo_url: preview } : school;
  return (
    <Section title="School logo" hint="JPEG, PNG or WebP, up to 2 MB. A square image works best.">
      <div className="flex items-center gap-4">
        <SchoolLogo school={shown} size={64} />
        <div className="flex flex-1 flex-col gap-2">
          <label className="inline-flex cursor-pointer items-center gap-2 self-start rounded-lg border border-border px-3 py-1.5 text-sm hover:bg-muted">
            <Upload className="size-4" />
            {file ? file.name : "Choose an image"}
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="sr-only"
              onChange={(e) => pick(e.target.files?.[0] ?? null)}
            />
          </label>
          {problem ? <p className="text-xs text-destructive">{problem}</p> : null}
          <div className="flex flex-wrap gap-2">
            <Button size="sm" onClick={upload} disabled={!file || busy !== null}>
              {busy === "upload" ? <Loader2 className="size-4 animate-spin" /> : <Upload className="size-4" />}
              Upload logo
            </Button>
            {school.logo_url && !file ? (
              <Button size="sm" variant="outline" onClick={remove} disabled={busy !== null}>
                {busy === "remove" ? <Loader2 className="size-4 animate-spin" /> : <Trash2 className="size-4" />}
                Remove logo
              </Button>
            ) : null}
          </div>
        </div>
      </div>
    </Section>
  );
}

function AcademicYearSection({ token, onChanged }: { token: string | null; onChanged: () => void }) {
  const [years, setYears] = useState<AcademicYear[] | null>(null);
  const [confirming, setConfirming] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  function load() {
    getAcademicYears(token)
      .then(setYears)
      .catch((err: unknown) => toast.error(err instanceof Error ? err.message : "Could not load academic years."));
  }

  useEffect(() => {
    load();
    // load once per open; `token` is stable for the life of the editor
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function makeCurrent(year: AcademicYear) {
    setBusy(year.id);
    try {
      await setCurrentAcademicYear(token, year.id);
      toast.success(`${year.label} is now the current year`);
      setConfirming(null);
      load();
      onChanged();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not change the academic year.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <Section title="Academic year" hint="The current year is the one rosters, timetables and attendance show.">
      {years === null ? (
        <p className="text-xs text-muted-foreground">Loading…</p>
      ) : years.length === 0 ? (
        <p className="text-xs text-muted-foreground">No academic years yet. Add one from the Classes page.</p>
      ) : (
        <ul className="divide-y divide-border rounded-xl border border-border">
          {years.map((y) => (
            <li key={y.id} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2.5">
              <div className="flex items-center gap-2">
                <CalendarClock className="size-4 text-muted-foreground" />
                <span className="text-sm font-medium text-foreground">{y.label}</span>
                {y.is_current ? (
                  <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-[11px] font-semibold text-emerald-700 dark:text-emerald-400">
                    Current
                  </span>
                ) : null}
              </div>
              {y.is_current ? null : confirming === y.id ? (
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-xs text-muted-foreground">Switch everyone to {y.label}?</span>
                  <Button size="sm" onClick={() => makeCurrent(y)} disabled={busy !== null}>
                    {busy === y.id ? <Loader2 className="size-4 animate-spin" /> : null}
                    Switch
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => setConfirming(null)} disabled={busy !== null}>
                    Cancel
                  </Button>
                </div>
              ) : (
                <Button size="sm" variant="outline" onClick={() => setConfirming(y.id)} className={cn(busy && "opacity-60")}>
                  Make current
                </Button>
              )}
            </li>
          ))}
        </ul>
      )}
    </Section>
  );
}
