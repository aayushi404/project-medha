"use client";

import { useRef, useState } from "react";
import { Loader2, Trash2, Upload } from "lucide-react";
import { toast } from "sonner";

import { deleteProfilePhoto, uploadProfilePhoto } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { ProfileImage } from "@/components/ui/profile-image";

const MAX_BYTES = 5 * 1024 * 1024;
const ACCEPTED = "image/jpeg,image/png,image/webp";

/** Photo + upload/remove controls, shared by every self-profile edit screen
 * (teacher/principal today; a student self-edit page can reuse it later).
 * `onChange` receives the fresh photo_url so the caller can update whatever
 * else on the page shows the same avatar (e.g. a sidebar chip). */
export function AvatarUploader({
  name,
  photoUrl,
  onChange,
}: {
  name: string;
  photoUrl: string | null;
  onChange: (photoUrl: string | null) => void;
}) {
  const { accessToken } = useAuth();
  const [busy, setBusy] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  async function handleFile(file: File) {
    if (!file.type.startsWith("image/")) {
      toast.error("Please choose an image file.");
      return;
    }
    if (file.size > MAX_BYTES) {
      toast.error("That photo is too large -- please choose one under 5MB.");
      return;
    }
    setBusy(true);
    try {
      const profile = await uploadProfilePhoto(accessToken, file);
      onChange(profile.photo_url);
      toast.success("Photo updated.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not upload the photo.");
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  async function handleRemove() {
    setBusy(true);
    try {
      await deleteProfilePhoto(accessToken);
      onChange(null);
      toast.success("Photo removed.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not remove the photo.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex items-center gap-4">
      <ProfileImage url={photoUrl} name={name} size="lg" />
      <div className="flex flex-col gap-2">
        <input
          ref={inputRef}
          type="file"
          accept={ACCEPTED}
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) void handleFile(file);
          }}
        />
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={busy}
          onClick={() => inputRef.current?.click()}
        >
          {busy ? <Loader2 className="size-3.5 animate-spin" /> : <Upload className="size-3.5" />}
          {photoUrl ? "Change photo" : "Upload photo"}
        </Button>
        {photoUrl && (
          <Button
            type="button"
            size="sm"
            variant="ghost"
            disabled={busy}
            onClick={() => void handleRemove()}
            className="text-muted-foreground hover:text-destructive"
          >
            <Trash2 className="size-3.5" /> Remove
          </Button>
        )}
        <p className="text-[11px] text-muted-foreground">JPEG, PNG or WebP, up to 5MB.</p>
      </div>
    </div>
  );
}
