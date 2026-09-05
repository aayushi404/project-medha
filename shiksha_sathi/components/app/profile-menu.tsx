"use client";

import { ChevronUp, LogOut, Settings } from "lucide-react";
import { useRouter } from "next/navigation";

import { Popover, PopoverItem } from "@/components/ui/popover";
import { useAuth } from "@/lib/auth-context";
import { useCopy, useCurriculumT } from "@/lib/copy";
import { useProfile } from "@/lib/profile-context";
import { cn } from "@/lib/utils";

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return (((parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? "")).toUpperCase()) || "?";
}

export function ProfileMenu({ collapsed }: { collapsed?: boolean }) {
  const copy = useCopy();
  const t = useCurriculumT();
  const { logout } = useAuth();
  const { profile } = useProfile();
  const router = useRouter();

  const name = profile?.full_name ?? "";
  const primary = profile?.subjects.find((s) => s.is_primary) ?? profile?.subjects[0];
  const subtitle = primary
    ? `${t.subject(primary.subject_name)} · ${t.grade(primary.grade_label)}`
    : "";

  const avatar = (
    <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-accent text-xs font-medium text-accent-foreground">
      {initials(name || "?")}
    </span>
  );

  const chip = collapsed ? (
    <span
      title={name || undefined}
      className="flex items-center justify-center rounded-xl p-1 transition-colors hover:bg-sidebar-accent/50"
    >
      {avatar}
    </span>
  ) : (
    <span className="flex w-full items-center gap-2.5 rounded-xl border border-border bg-card px-2 py-2 text-left transition-colors hover:bg-muted">
      {avatar}
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[13px]">{name || "—"}</span>
        <span className="block truncate text-[11px] text-muted-foreground">{subtitle}</span>
      </span>
      <ChevronUp className="size-3.5 shrink-0 text-muted-foreground" />
    </span>
  );

  return (
    <Popover
      trigger={chip}
      triggerClassName={cn(!collapsed && "w-full")}
      side="top"
      align="center"
    >
      <PopoverItem onClick={() => router.push("/profile")}>
        <Settings className="size-4" />
        {copy.profileMenu.edit}
      </PopoverItem>
      <PopoverItem
        onClick={() => void logout()}
        className="text-destructive hover:text-destructive"
      >
        <LogOut className="size-4" />
        {copy.profileMenu.logout}
      </PopoverItem>
    </Popover>
  );
}
