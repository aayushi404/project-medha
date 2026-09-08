"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { SubjectsEditor, type SubjectSelection } from "@/components/profile/subjects-editor";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { getGrades, getSubjects, patchProfile, type Grade, type Subject } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { useCopy } from "@/lib/copy";
import { useProfile } from "@/lib/profile-context";

const LANGUAGES = [
  { value: "hi-BiharBoli", label: "Hindi (Bihari)" },
  { value: "hi", label: "Hindi" },
  { value: "en", label: "English" },
];

export default function ProfilePage() {
  const copy = useCopy();
  const router = useRouter();
  const { accessToken } = useAuth();
  const { profile, refresh } = useProfile();

  const [fullName, setFullName] = useState("");
  const [language, setLanguage] = useState<string | null>(null);
  const [selections, setSelections] = useState<SubjectSelection[]>([]);
  const [saving, setSaving] = useState(false);
  const [syncedId, setSyncedId] = useState<string | null>(null);

  const [grades, setGrades] = useState<Grade[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);

  useEffect(() => {
    let cancelled = false;
    Promise.all([getGrades(), getSubjects()])
      .then(([g, s]) => {
        if (cancelled) return;
        setGrades(g);
        setSubjects(s);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  // seed the form from the fetched profile once (render-phase, per React docs
  // "adjusting state when a prop changes")
  if (profile && profile.id !== syncedId) {
    setSyncedId(profile.id);
    setFullName(profile.full_name);
    setLanguage(profile.preferred_language);
    setSelections(
      profile.subjects.map((s) => ({
        subject_id: s.subject_id,
        grade_id: s.grade_id,
        is_primary: s.is_primary,
      })),
    );
  }

  function toggleSelection(subjectId: string, gradeId: string) {
    setSelections((prev) => {
      const existing = prev.find((s) => s.subject_id === subjectId && s.grade_id === gradeId);
      if (existing) {
        const next = prev.filter(
          (s) => !(s.subject_id === subjectId && s.grade_id === gradeId),
        );
        if (existing.is_primary && next.length > 0) {
          next[0] = { ...next[0], is_primary: true };
        }
        return next;
      }
      const isFirst = prev.length === 0;
      return [...prev, { subject_id: subjectId, grade_id: gradeId, is_primary: isFirst }];
    });
  }

  function setPrimary(subjectId: string, gradeId: string) {
    setSelections((prev) =>
      prev.map((s) => ({
        ...s,
        is_primary: s.subject_id === subjectId && s.grade_id === gradeId,
      })),
    );
  }

  const primaryCount = selections.filter((s) => s.is_primary).length;
  const subjectsValid = selections.length > 0 && primaryCount === 1;
  const canSave = !saving && fullName.trim().length > 0 && subjectsValid;

  async function save() {
    if (!canSave) return;
    setSaving(true);
    try {
      await patchProfile(accessToken, {
        full_name: fullName.trim(),
        preferred_language: language ?? undefined,
        subjects: selections,
      });
      refresh();
      toast.success("Profile updated.");
      router.push("/dashboard");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not save.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="flex flex-1 flex-col overflow-hidden">
      <div className="border-b border-border px-5 py-4">
        <h1 className="text-[15px]">{copy.profileMenu.edit}</h1>
      </div>
      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto w-full max-w-sm px-4 py-8">
          <div className="flex flex-col gap-6">
            <div className="flex flex-col gap-2">
              <Label htmlFor="full-name">Your name</Label>
              <Input
                id="full-name"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                className="h-11 text-base"
              />
            </div>

            <div className="flex flex-col gap-2">
              <Label>Language</Label>
              <Select
                value={language}
                options={LANGUAGES}
                onValueChange={setLanguage}
                ariaLabel="Language"
                className="h-11"
              />
            </div>

            <div className="flex flex-col gap-3">
              <div>
                <Label>What you teach</Label>
                <p className="mt-1 text-xs text-muted-foreground">
                  Tap every subject and grade you teach, then pick your primary one.
                </p>
              </div>
              <SubjectsEditor
                grades={grades}
                subjects={subjects}
                selections={selections}
                onToggle={toggleSelection}
                onSetPrimary={setPrimary}
              />
            </div>

            {profile?.school ? (
              <p className="text-xs text-muted-foreground">
                {profile.school.name} · {profile.school.district_name}
              </p>
            ) : null}

            <div className="flex gap-2">
              <Button variant="outline" className="h-11 flex-1" onClick={() => router.back()}>
                {copy.cancel}
              </Button>
              <Button
                className="h-11 flex-1"
                disabled={!canSave}
                onClick={() => void save()}
              >
                {copy.save}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
