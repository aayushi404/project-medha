"use client";

import type { LucideIcon } from "lucide-react";
import { ChevronDown, Lock } from "lucide-react";
import Link from "next/link";
import { useEffect, useId, useState, type ReactNode } from "react";

import { cn } from "@/lib/utils";

/** Shared by the teacher and student sidebars: accordion groups, their
 * remembered open state, and a single nav link. */

export function isActivePath(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(`${href}/`);
}

function readGroupState(storageKey: string): Record<string, boolean> {
  try {
    const parsed: unknown = JSON.parse(window.localStorage.getItem(storageKey) ?? "{}");
    return parsed && typeof parsed === "object" ? (parsed as Record<string, boolean>) : {};
  } catch {
    return {};
  }
}

/** Which groups the user has opened or closed, remembered per sidebar. A group
 * with no choice yet opens only when the current page is one of its links, so
 * the menu starts short. */
export function useNavGroupState(storageKey: string) {
  const [groupOpen, setGroupOpen] = useState<Record<string, boolean>>(() =>
    typeof window === "undefined" ? {} : readGroupState(storageKey),
  );

  useEffect(() => {
    try {
      window.localStorage.setItem(storageKey, JSON.stringify(groupOpen));
    } catch {
      /* ignore */
    }
  }, [storageKey, groupOpen]);

  function toggleGroup(key: string, next: boolean) {
    setGroupOpen((prev) => ({ ...prev, [key]: next }));
  }

  return { groupOpen, toggleGroup };
}

export function NavLink({
  href,
  label,
  icon: Icon,
  pathname,
  collapsed,
  onNavigate,
  children,
  locked,
}: {
  href: string;
  label: string;
  icon: LucideIcon;
  pathname: string;
  collapsed?: boolean;
  onNavigate?: () => void;
  /** anything that belongs under this link, e.g. a row that follows it */
  children?: ReactNode;
  /** Early-access rollout hint: still navigable, the destination just shows a
   * locked preview -- this only adds a small lock glyph so it isn't mistaken
   * for a bug. */
  locked?: boolean;
}) {
  const active = isActivePath(pathname, href);
  return (
    <div className="contents">
      <Link
        href={href}
        onClick={onNavigate}
        title={collapsed ? `${label}${locked ? " (coming soon)" : ""}` : undefined}
        aria-current={active ? "page" : undefined}
        className={cn(
          "flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm transition-colors",
          collapsed && "justify-center px-0",
          active
            ? "bg-sidebar-accent font-medium text-sidebar-accent-foreground"
            : "text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground",
        )}
      >
        <Icon className="size-4 shrink-0" />
        {collapsed ? null : (
          <span className="flex min-w-0 flex-1 items-center justify-between gap-2">
            <span className="truncate">{label}</span>
            {locked && <Lock className="size-3 shrink-0 text-muted-foreground/70" aria-hidden />}
          </span>
        )}
      </Link>
      {children}
    </div>
  );
}

/** A group header that opens and closes its links. Animated with the grid-rows
 * trick, so the height change is smooth without measuring. Closed content is
 * `inert`, so keyboard focus can't reach hidden links. */
export function NavAccordion({
  label,
  icon: Icon,
  open,
  onToggle,
  children,
}: {
  label: string;
  icon: LucideIcon;
  open: boolean;
  onToggle: () => void;
  children: ReactNode;
}) {
  const contentId = useId();
  return (
    <div>
      <button
        type="button"
        aria-expanded={open}
        aria-controls={contentId}
        onClick={onToggle}
        className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-[11px] font-semibold tracking-wider text-sidebar-foreground/55 uppercase transition-colors outline-none hover:bg-sidebar-accent/40 hover:text-sidebar-foreground focus-visible:ring-3 focus-visible:ring-ring/50"
      >
        <Icon aria-hidden className="size-3.5 shrink-0" />
        <span className="flex-1 truncate">{label}</span>
        <ChevronDown
          aria-hidden
          className={cn("size-3.5 shrink-0 transition-transform duration-200 ease-out", open && "rotate-180")}
        />
      </button>
      <div
        id={contentId}
        inert={!open}
        className={cn(
          "grid transition-[grid-template-rows,opacity] duration-200 ease-out",
          open ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0",
        )}
      >
        <div className="min-h-0 overflow-hidden">
          <div className="mt-0.5 mb-1 ml-4 flex flex-col gap-1 border-l border-sidebar-border pl-2">{children}</div>
        </div>
      </div>
    </div>
  );
}
