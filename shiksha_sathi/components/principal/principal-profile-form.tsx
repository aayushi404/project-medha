"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";

import { getProfile, patchProfile, type Profile } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { useLocale } from "@/lib/copy";
import { AvatarUploader } from "@/components/profile/avatar-uploader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";

const LANGUAGES = [
  { value: "hi-BiharBoli", label: "Hindi (Bihari)" },
  { value: "hi", label: "Hindi" },
  { value: "en", label: "English" },
];

/** The principal's own profile edit screen: name, language, and a photo --
 * previously unreachable, since /profile lives under the teacher-only (app)
 * layout, which redirects any non-teacher role away. */
export function PrincipalProfileForm() {
  const { accessToken, teacher, updateTeacher } = useAuth();
  const { locale } = useLocale();
  const isHi = locale === "hi";

  const [profile, setProfile] = useState<Profile | null>(null);
  const [fullName, setFullName] = useState("");
  const [language, setLanguage] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!accessToken) return;
    getProfile(accessToken)
      .then((p) => {
        setProfile(p);
        setFullName(p.full_name);
        setLanguage(p.preferred_language);
      })
      .catch((e: unknown) => toast.error(e instanceof Error ? e.message : "Could not load your profile."));
  }, [accessToken]);

  async function save() {
    if (!fullName.trim()) return;
    setSaving(true);
    try {
      const updated = await patchProfile(accessToken, {
        full_name: fullName.trim(),
        preferred_language: language ?? undefined,
      });
      setProfile(updated);
      if (teacher) updateTeacher({ ...teacher, full_name: updated.full_name });
      toast.success(isHi ? "प्रोफ़ाइल सहेजी गई।" : "Profile saved.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not save.");
    } finally {
      setSaving(false);
    }
  }

  if (!profile) return null;

  return (
    <div className="mx-auto flex w-full max-w-sm flex-col gap-6">
      <AvatarUploader
        name={profile.full_name}
        photoUrl={profile.photo_url}
        onChange={(photoUrl) => {
          setProfile((p) => (p ? { ...p, photo_url: photoUrl } : p));
          if (teacher) updateTeacher({ ...teacher, photo_url: photoUrl });
        }}
      />

      <div className="flex flex-col gap-2">
        <Label htmlFor="pp-name">{isHi ? "आपका नाम" : "Your name"}</Label>
        <Input
          id="pp-name"
          value={fullName}
          onChange={(e) => setFullName(e.target.value)}
          className="h-11 text-base"
        />
      </div>

      <div className="flex flex-col gap-2">
        <Label>{isHi ? "भाषा" : "Language"}</Label>
        <Select value={language} options={LANGUAGES} onValueChange={setLanguage} ariaLabel="Language" className="h-11" />
      </div>

      {profile.school && (
        <p className="text-xs text-muted-foreground">
          {profile.school.name} · {profile.school.district_name}
        </p>
      )}

      <Button className="h-11" disabled={saving || !fullName.trim()} onClick={() => void save()}>
        {saving ? (isHi ? "सहेज रहे हैं…" : "Saving…") : isHi ? "सहेजें" : "Save"}
      </Button>
    </div>
  );
}
