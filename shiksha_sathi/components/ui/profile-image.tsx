"use client";

import { useState } from "react";

import { cn } from "@/lib/utils";

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return (((parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? "")).toUpperCase()) || "?";
}

const SIZES = {
  sm: "size-8 text-xs",
  md: "size-11 text-sm",
  lg: "size-20 text-xl",
} as const;

/** The one place avatar styling lives -- a photo when `url` is set, the same
 * initials-circle every screen used to hand-roll otherwise. Falls back to
 * initials automatically if the image fails to load (e.g. a stale/deleted
 * Cloudinary asset), so a broken `photo_url` never shows a broken-image icon. */
export function ProfileImage({
  url,
  name,
  size = "md",
  className,
}: {
  url: string | null | undefined;
  name: string;
  size?: keyof typeof SIZES;
  className?: string;
}) {
  // Tracks *which* url failed, not just whether one did -- so a fresh upload
  // (a new url) always gets a real attempt, even right after a previous one failed.
  const [failedUrl, setFailedUrl] = useState<string | null>(null);

  if (url && url !== failedUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={url}
        alt={name}
        onError={() => setFailedUrl(url)}
        className={cn("shrink-0 rounded-full object-cover", SIZES[size], className)}
      />
    );
  }

  return (
    <span
      className={cn(
        "flex shrink-0 items-center justify-center rounded-full bg-terracotta/15 font-medium text-terracotta",
        SIZES[size],
        className,
      )}
    >
      {initials(name || "?")}
    </span>
  );
}
