"use client";

import { useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Dialog } from "@base-ui/react/dialog";
import {
  CalendarCheck,
  ClipboardCheck,
  ClipboardPenLine,
  GraduationCap,
  IndianRupee,
  LayoutDashboard,
  LayoutGrid,
  LogOut,
  Megaphone,
  Menu,
  PanelLeftClose,
  PanelLeftOpen,
  UserPlus,
  Users,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

import { getPrincipalStats } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { useLocale } from "@/lib/copy";
import { cn } from "@/lib/utils";
import { LanguageToggle } from "@/components/app/language-toggle";
import { NotificationBell } from "@/components/notifications/notification-bell";
import { ProfileImage } from "@/components/ui/profile-image";

interface PrincipalNavItem {
  id: string;
  href: string;
  labelEn: string;
  labelHi: string;
  icon: LucideIcon;
  /** True for items that are their own route rather than an anchor on the
   * main /principal dashboard. */
  ownRoute?: boolean;
}

const PRINCIPAL_SIDEBAR_NAV: PrincipalNavItem[] = [
  { id: "principal-overview", href: "/principal#principal-overview", labelEn: "Overview", labelHi: "डैशबोर्ड सारांश", icon: LayoutDashboard },
  { id: "principal-analytics", href: "/principal#principal-analytics", labelEn: "Attendance & Syllabus", labelHi: "उपस्थिति व सिलेबस", icon: ClipboardCheck },
  { id: "principal-attendance-full", href: "/principal/attendance", labelEn: "Attendance", labelHi: "उपस्थिति", icon: CalendarCheck, ownRoute: true },
  { id: "principal-notices", href: "/principal#principal-notices", labelEn: "Notice Board", labelHi: "सूचना पट्ट (Notices)", icon: Megaphone },
  { id: "principal-work-updates", href: "/principal#principal-work-updates", labelEn: "Teacher Work Updates", labelHi: "शिक्षक कार्य अपडेट", icon: ClipboardPenLine },
  { id: "principal-pending-teachers", href: "/principal#principal-pending-teachers", labelEn: "Teacher Approvals", labelHi: "शिक्षक अनुमोदन", icon: UserPlus },
  { id: "principal-teachers", href: "/principal#principal-teachers", labelEn: "Faculty Staff", labelHi: "शिक्षक दल", icon: Users },
  { id: "principal-classes", href: "/principal/classes", labelEn: "Classes", labelHi: "कक्षाएँ", icon: LayoutGrid, ownRoute: true },
  { id: "principal-students", href: "/principal#principal-students", labelEn: "Students", labelHi: "विद्यार्थी सूची", icon: GraduationCap },
  { id: "principal-fees", href: "/principal#principal-fees", labelEn: "Fee Records", labelHi: "शुल्क विवरण", icon: IndianRupee },
];

const COLLAPSE_KEY = "medha.principalSidebarCollapsed";

/** Chrome shared by every principal screen (the dashboard and the Classes
 * routes): sidebar/drawer nav, profile footer, logout. Dashboard sections are
 * plain in-page anchors (`/principal#id`); "Classes" is a real route. `activeId`
 * lets the dashboard report which section is currently scrolled/clicked into
 * view so the highlight stays in sync there, while sub-routes just pass their
 * own nav id. */
export function PrincipalShell({
  children,
  activeId,
  onAnchorClick,
}: {
  children: ReactNode;
  activeId: string;
  /** Called when an in-page anchor item is clicked while already on
   * /principal, so the dashboard can scroll + update its own active state. */
  onAnchorClick?: (id: string) => void;
}) {
  const { teacher, logout, accessToken } = useAuth();
  const { locale } = useLocale();
  const isHi = locale === "hi";
  const pathname = usePathname();

  // Lazy-init from localStorage: safe because this component only ever
  // mounts client-side, after auth resolves -- no SSR mismatch (same
  // pattern as AppSidebar).
  const [collapsed, setCollapsed] = useState(() => {
    if (typeof window === "undefined") return false;
    try {
      return window.localStorage.getItem(COLLAPSE_KEY) === "1";
    } catch {
      return false;
    }
  });
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false);
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
    getPrincipalStats(accessToken)
      .then((s) => setPendingCount(s.pending_teachers))
      .catch(() => {});
  }, [accessToken]);

  const principalName = teacher?.full_name?.trim() || "Principal";
  const principalEmail = teacher?.email?.trim() || "";

  function handleClick(item: PrincipalNavItem, e: React.MouseEvent<HTMLAnchorElement>) {
    if (!item.ownRoute && pathname === "/principal") {
      e.preventDefault();
      onAnchorClick?.(item.id);
      document.getElementById(item.id)?.scrollIntoView({ behavior: "smooth", block: "start" });
    }
    setMobileDrawerOpen(false);
  }

  const renderNavItems = () => (
    <nav className="flex flex-col gap-1 p-2">
      {!collapsed && (
        <span className="eyebrow px-3 pt-1 pb-1 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
          {isHi ? "प्रशासनिक मेनू" : "Principal Menu"}
        </span>
      )}
      {PRINCIPAL_SIDEBAR_NAV.map((item) => {
        const Icon = item.icon;
        const isActive = item.ownRoute
          ? pathname.startsWith(item.href)
          : pathname === "/principal" && activeId === item.id;
        const label = isHi ? item.labelHi : item.labelEn;
        const badge = item.id === "principal-pending-teachers" && pendingCount > 0 ? pendingCount : null;

        return (
          <Link
            key={item.id}
            href={item.href}
            onClick={(e) => handleClick(item, e)}
            title={collapsed ? label : undefined}
            className={cn(
              "flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-xs font-medium transition-colors text-left",
              collapsed && "justify-center px-0",
              isActive
                ? "bg-sidebar-accent font-semibold text-sidebar-accent-foreground shadow-xs"
                : "text-sidebar-foreground/75 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground",
            )}
          >
            <div className="relative flex size-4 shrink-0 items-center justify-center">
              <Icon
                className={cn(
                  "size-4 shrink-0 transition-colors",
                  isActive ? "text-terracotta" : "text-sidebar-foreground/60",
                )}
              />
              {item.id === "principal-work-updates" && (
                <span className="absolute -top-1 -right-1 size-2 animate-pulse rounded-full bg-emerald-500 ring-2 ring-background" />
              )}
            </div>

            {!collapsed && (
              <div className="flex flex-1 items-center justify-between min-w-0">
                <span className="truncate">{label}</span>
                {badge !== null && (
                  <span className="rounded-full bg-amber-500/20 px-1.5 py-0.2 text-[10px] font-bold text-amber-600 dark:text-amber-400">
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
          "hidden h-dvh shrink-0 flex-col overflow-hidden bg-sidebar text-sidebar-foreground border-r border-sidebar-border transition-[width] duration-200 md:flex",
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
            <div className="mt-1">
              <span className="inline-block rounded-full bg-terracotta/10 px-2.5 py-0.5 text-[10px] font-bold tracking-wider text-terracotta uppercase">
                Principal Desk
              </span>
              <p className="mt-0.5 text-[11px] font-medium text-muted-foreground">
                नालंदा विद्यापीठ
              </p>
            </div>
          )}
        </div>

        <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
          {renderNavItems()}

          {!collapsed && (
            <div className="mt-auto p-2">
              <div className="rounded-xl border border-sidebar-border bg-card/60 p-3 text-center">
                <p className="text-[11px] font-serif leading-snug text-sidebar-foreground/80">
                  &ldquo;विद्या ददाति विनयं&rdquo;
                </p>
                <span
                  className="mx-auto mt-2 block h-[2px] w-12 rounded-full"
                  style={{ background: "linear-gradient(90deg, #FF9933, #FFFFFF, #138808)" }}
                />
              </div>
            </div>
          )}
        </div>

        <div
          className={cn(
            "flex flex-col gap-2 border-t border-sidebar-border p-2",
            collapsed && "items-center",
          )}
        >
          {!collapsed && (
            <div className="flex items-center gap-1 self-stretch px-1">
              <LanguageToggle className="self-start" />
              <NotificationBell className="ml-auto" />
            </div>
          )}

          {collapsed ? (
            <button
              type="button"
              onClick={() => void logout()}
              title={`Log out (${principalName})`}
              className="flex size-9 items-center justify-center rounded-xl text-muted-foreground hover:bg-sidebar-accent/50 hover:text-foreground"
            >
              <LogOut className="size-4" />
            </button>
          ) : (
            <div className="flex items-center gap-2 rounded-xl border border-border bg-card p-2 text-left">
              <Link href="/principal/profile" className="flex min-w-0 flex-1 items-center gap-2">
                <ProfileImage url={teacher?.photo_url ?? null} name={principalName} size="sm" />
                <div className="min-w-0 flex-1">
                  <span className="block truncate text-xs font-semibold text-foreground">
                    {principalName}
                  </span>
                  <span className="block truncate text-[10px] text-muted-foreground">
                    {principalEmail}
                  </span>
                </div>
              </Link>
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
            className={cn(
              "flex shrink-0 items-center justify-center gap-1.5 rounded-xl border border-sidebar-border py-1.5 text-xs text-sidebar-foreground/60 transition-colors hover:bg-sidebar-accent/50 hover:text-sidebar-foreground",
            )}
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
        <Dialog.Root open={mobileDrawerOpen} onOpenChange={setMobileDrawerOpen}>
          <Dialog.Trigger
            aria-label="Menu"
            className="flex size-9 items-center justify-center rounded-xl outline-hidden hover:bg-sidebar-accent focus-visible:ring-3 focus-visible:ring-ring/50"
          >
            <Menu className="size-5" />
          </Dialog.Trigger>
          <Dialog.Portal>
            <Dialog.Backdrop className="fixed inset-0 z-50 bg-black/40 transition-opacity data-ending-style:opacity-0 data-starting-style:opacity-0" />
            <Dialog.Popup className="fixed inset-y-0 left-0 z-50 flex w-64 flex-col overflow-hidden bg-sidebar text-sidebar-foreground shadow-xl transition-transform duration-200 data-ending-style:-translate-x-full data-starting-style:-translate-x-full">
              <div className="flex items-center justify-center p-4">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src="/Logo.jpeg" alt="Medha" className="h-16 w-auto object-contain" />
              </div>
              <div className="flex-1 overflow-y-auto">{renderNavItems()}</div>
              <div className="border-t border-sidebar-border p-3">
                <button
                  type="button"
                  onClick={() => void logout()}
                  className="flex w-full items-center justify-center gap-2 rounded-xl bg-muted px-3 py-2 text-xs font-semibold text-muted-foreground hover:text-foreground"
                >
                  <LogOut className="size-3.5" /> Log out ({principalName})
                </button>
              </div>
            </Dialog.Popup>
          </Dialog.Portal>
        </Dialog.Root>

        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/Logo.jpeg" alt="Medha" className="h-8 w-auto object-contain" />
        <span className="font-serif text-xs font-semibold tracking-wider uppercase text-terracotta">
          Principal Desk
        </span>
        <NotificationBell className="ml-auto" />
        <LanguageToggle />
      </div>

      {/* Main scrollable content */}
      <div className="relative flex min-h-0 min-w-0 flex-1 flex-col overflow-y-auto bg-background">
        {children}
      </div>
    </div>
  );
}
