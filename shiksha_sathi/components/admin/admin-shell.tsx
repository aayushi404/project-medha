"use client";

import { useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Dialog } from "@base-ui/react/dialog";
import {
  Activity,
  Building2,
  LayoutDashboard,
  LogOut,
  MapPin,
  Menu,
  PanelLeftClose,
  PanelLeftOpen,
  School,
  UserCheck,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

import { getAdminStats } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { cn } from "@/lib/utils";
import { NotificationBell } from "@/components/notifications/notification-bell";

interface AdminNavItem {
  id: string;
  href: string;
  label: string;
  icon: LucideIcon;
  /** match nested routes too (e.g. /admin/schools/[id]) */
  prefix?: boolean;
}

const ADMIN_NAV: AdminNavItem[] = [
  { id: "overview", href: "/admin", label: "Overview", icon: LayoutDashboard },
  { id: "principals", href: "/admin/principals", label: "Principals", icon: UserCheck, prefix: true },
  { id: "schools", href: "/admin/schools", label: "Schools", icon: School, prefix: true },
  { id: "districts", href: "/admin/districts", label: "Districts", icon: MapPin, prefix: true },
  { id: "activity", href: "/admin/activity", label: "Activity log", icon: Activity, prefix: true },
];

const COLLAPSE_KEY = "medha.adminSidebarCollapsed";

/** Chrome shared by every admin screen: sidebar (drawer on mobile), profile
 * footer and logout. Active item comes from the URL, so each section is its
 * own route. */
export function AdminShell({
  title,
  description,
  actions,
  children,
}: {
  title: string;
  description?: string;
  actions?: ReactNode;
  children: ReactNode;
}) {
  const { teacher, logout, accessToken } = useAuth();
  const pathname = usePathname();

  const [collapsed, setCollapsed] = useState(() => {
    if (typeof window === "undefined") return false;
    try {
      return window.localStorage.getItem(COLLAPSE_KEY) === "1";
    } catch {
      return false;
    }
  });
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [pendingCount, setPendingCount] = useState(0);

  useEffect(() => {
    try {
      window.localStorage.setItem(COLLAPSE_KEY, collapsed ? "1" : "0");
    } catch {
      /* ignore */
    }
  }, [collapsed]);

  useEffect(() => {
    if (!accessToken) return;
    getAdminStats(accessToken)
      .then((s) => setPendingCount(s.pending_principals))
      .catch(() => {});
  }, [accessToken]);

  const name = teacher?.full_name?.trim() || "Admin";
  const email = teacher?.email?.trim() || "";

  const renderNav = (compact: boolean) => (
    <nav className="flex flex-col gap-1 p-2">
      {!compact && (
        <span className="px-3 pt-1 pb-1 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
          Admin Menu
        </span>
      )}
      {ADMIN_NAV.map((item) => {
        const Icon = item.icon;
        const active = item.prefix
          ? pathname.startsWith(item.href)
          : pathname === item.href;
        const badge = item.id === "principals" && pendingCount > 0 ? pendingCount : null;
        return (
          <Link
            key={item.id}
            href={item.href}
            onClick={() => setDrawerOpen(false)}
            title={compact ? item.label : undefined}
            className={cn(
              "flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-xs font-medium transition-colors",
              compact && "justify-center px-0",
              active
                ? "bg-sidebar-accent font-semibold text-sidebar-accent-foreground shadow-xs"
                : "text-sidebar-foreground/75 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground",
            )}
          >
            <Icon
              className={cn(
                "size-4 shrink-0",
                active ? "text-terracotta" : "text-sidebar-foreground/60",
              )}
            />
            {!compact && (
              <div className="flex min-w-0 flex-1 items-center justify-between">
                <span className="truncate">{item.label}</span>
                {badge !== null && (
                  <span className="rounded-full bg-amber-500/20 px-1.5 text-[10px] font-bold text-amber-600 dark:text-amber-400">
                    {badge}
                  </span>
                )}
              </div>
            )}
          </Link>
        );
      })}
    </nav>
  );

  return (
    <div className="app-shell flex h-dvh flex-col overflow-hidden bg-background text-foreground md:flex-row">
      {/* Desktop sidebar */}
      <aside
        className={cn(
          "hidden h-dvh shrink-0 flex-col overflow-hidden border-r border-sidebar-border bg-sidebar text-sidebar-foreground transition-[width] duration-200 md:flex",
          collapsed ? "w-16" : "w-60",
        )}
      >
        <div
          className={cn(
            "flex flex-col items-center justify-center px-4 pt-4 pb-2 text-center",
            collapsed && "px-2",
          )}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/Logo.jpeg"
            alt="Medha"
            className={cn(
              "object-contain transition-all",
              collapsed ? "size-9 rounded-full" : "h-24 w-auto drop-shadow-xs",
            )}
          />
          {!collapsed && (
            <span className="mt-1 inline-block rounded-full bg-terracotta/10 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-terracotta">
              Admin Console
            </span>
          )}
        </div>

        <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">{renderNav(collapsed)}</div>

        <div className={cn("flex flex-col gap-2 border-t border-sidebar-border p-2", collapsed && "items-center")}>
          {!collapsed && (
            <div className="flex items-center self-stretch px-1">
              <NotificationBell className="ml-auto" />
            </div>
          )}
          {collapsed ? (
            <button
              type="button"
              onClick={() => void logout()}
              title={`Log out (${name})`}
              className="flex size-9 items-center justify-center rounded-xl text-muted-foreground hover:bg-sidebar-accent/50 hover:text-foreground"
            >
              <LogOut className="size-4" />
            </button>
          ) : (
            <div className="flex items-center gap-2 rounded-xl border border-border bg-card p-2">
              <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-terracotta/10 text-terracotta">
                <Building2 className="size-4" />
              </div>
              <div className="min-w-0 flex-1">
                <span className="block truncate text-xs font-semibold text-foreground">{name}</span>
                <span className="block truncate text-[10px] text-muted-foreground">{email}</span>
              </div>
              <button
                type="button"
                onClick={() => void logout()}
                title="Log out"
                aria-label="Log out"
                className="flex size-7 shrink-0 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              >
                <LogOut className="size-3.5" />
              </button>
            </div>
          )}
          <button
            type="button"
            onClick={() => setCollapsed((c) => !c)}
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            className="flex shrink-0 items-center justify-center gap-1.5 rounded-xl border border-sidebar-border py-1.5 text-xs text-sidebar-foreground/60 transition-colors hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
          >
            {collapsed ? (
              <PanelLeftOpen className="size-3.5" />
            ) : (
              <>
                <PanelLeftClose className="size-3.5" /> Collapse
              </>
            )}
          </button>
        </div>
      </aside>

      {/* Mobile header + drawer */}
      <div className="flex items-center gap-2 border-b border-sidebar-border bg-sidebar px-3 py-2 text-sidebar-foreground md:hidden">
        <Dialog.Root open={drawerOpen} onOpenChange={setDrawerOpen}>
          <Dialog.Trigger
            aria-label="Menu"
            className="flex size-9 items-center justify-center rounded-xl outline-hidden hover:bg-sidebar-accent focus-visible:ring-3 focus-visible:ring-ring/50"
          >
            <Menu className="size-5" />
          </Dialog.Trigger>
          <Dialog.Portal>
            <Dialog.Backdrop className="fixed inset-0 z-50 bg-black/40 transition-opacity data-ending-style:opacity-0 data-starting-style:opacity-0" />
            <Dialog.Popup className="fixed inset-y-0 left-0 z-50 flex w-64 flex-col overflow-hidden bg-sidebar text-sidebar-foreground shadow-xl transition-transform duration-200 data-ending-style:-translate-x-full data-starting-style:-translate-x-full">
              <Dialog.Title className="sr-only">Admin menu</Dialog.Title>
              <div className="flex items-center justify-center p-4">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src="/Logo.jpeg" alt="Medha" className="h-16 w-auto object-contain" />
              </div>
              <div className="flex-1 overflow-y-auto">{renderNav(false)}</div>
              <div className="border-t border-sidebar-border p-3">
                <button
                  type="button"
                  onClick={() => void logout()}
                  className="flex w-full items-center justify-center gap-2 rounded-xl bg-muted px-3 py-2 text-xs font-semibold text-muted-foreground hover:text-foreground"
                >
                  <LogOut className="size-3.5" /> Log out ({name})
                </button>
              </div>
            </Dialog.Popup>
          </Dialog.Portal>
        </Dialog.Root>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/Logo.jpeg" alt="Medha" className="h-8 w-auto object-contain" />
        <span className="font-serif text-xs font-semibold uppercase tracking-wider text-terracotta">
          Admin Console
        </span>
        <NotificationBell className="ml-auto" />
      </div>

      <div className="relative flex min-h-0 min-w-0 flex-1 flex-col overflow-y-auto bg-background">
        <div className="mx-auto w-full max-w-6xl space-y-6 px-4 py-6 sm:px-8">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h1 className="font-serif text-2xl font-bold tracking-tight text-foreground">
                {title}
              </h1>
              {description && (
                <p className="text-sm text-muted-foreground">{description}</p>
              )}
            </div>
            {actions}
          </div>
          {children}
        </div>
      </div>
    </div>
  );
}
