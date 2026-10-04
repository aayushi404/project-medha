"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { AvatarUploader } from "@/components/profile/avatar-uploader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { patchProfile } from "@/lib/api";
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
  const [saving, setSaving] = useState(false);
  const [syncedId, setSyncedId] = useState<string | null>(null);

  // seed the form from the fetched profile once (render-phase, per React docs
  // "adjusting state when a prop changes")
  if (profile && profile.id !== syncedId) {
    setSyncedId(profile.id);
    setFullName(profile.full_name);
    setLanguage(profile.preferred_language);
  }

  const canSave = !saving && fullName.trim().length > 0;

  async function save() {
    if (!canSave) return;
    setSaving(true);
    try {
      await patchProfile(accessToken, {
        full_name: fullName.trim(),
        preferred_language: language ?? undefined,
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
            {profile && (
              <AvatarUploader
                name={profile.full_name}
                photoUrl={profile.photo_url}
                onChange={refresh}
              />
            )}

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

            <div className="flex flex-col gap-2">
              <Label>Your classes and subjects</Label>
              <p className="text-xs text-muted-foreground">
                Assigned by your principal. To change them, ask your principal.
              </p>
              {profile && profile.subjects.length > 0 ? (
                <ul className="divide-y divide-border rounded-xl border border-border">
                  {profile.subjects.map((s) => (
                    <li key={`${s.grade_id}-${s.subject_id}`} className="flex items-center justify-between px-3 py-2.5 text-sm">
                      <span className="text-foreground">{s.subject_name}</span>
                      <span className="text-muted-foreground">
                        {s.grade_label}
                        {s.is_primary ? " · primary" : ""}
                      </span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="rounded-xl border border-dashed border-border p-3 text-sm text-muted-foreground">
                  Your principal hasn&apos;t assigned your classes yet.
                </p>
              )}
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
