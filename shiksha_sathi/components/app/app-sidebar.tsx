"use client";

import { Dialog } from "@base-ui/react/dialog";
import {
  Bell,
  CalendarDays,
  ClipboardCheck,
  ClipboardList,
  ClipboardPenLine,
  Clock,
  FlaskConical,
  GraduationCap,
  Home,
  Library,
  ListChecks,
  Menu,
  MessageCircle,
  NotebookPen,
  NotebookText,
  PanelLeftClose,
  PanelLeftOpen,
  Wrench,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

import { LanguageToggle } from "@/components/app/language-toggle";
import { ProfileMenu } from "@/components/app/profile-menu";
import { WorkUpdateModal } from "@/components/dashboard/work-update-modal";
import { NotificationBell } from "@/components/notifications/notification-bell";
import { useAuth } from "@/lib/auth-context";
import { useCopy } from "@/lib/copy";
import type { Copy } from "@/lib/copy";
import { cn } from "@/lib/utils";
import { PRINCIPAL_BADGES, useWorkUpdates } from "@/lib/work-update-store";

const NAV: { href: string; navKey: keyof Copy["nav"]; icon: LucideIcon }[] = [
  { href: "/dashboard", navKey: "home", icon: Home },
  { href: "/attendance", navKey: "attendance", icon: ClipboardCheck },
  { href: "/notifications", navKey: "notifications", icon: Bell },
  { href: "/ask", navKey: "askMedha", icon: MessageCircle },
  { href: "/students", navKey: "students", icon: GraduationCap },
  { href: "/homework", navKey: "homework", icon: NotebookPen },
  { href: "/timetable", navKey: "timetable", icon: CalendarDays },
  { href: "/simulations", navKey: "simulations", icon: FlaskConical },
  { href: "/tools", navKey: "tools", icon: Wrench },
  { href: "/resources", navKey: "resources", icon: Library },
  { href: "/notes", navKey: "notes", icon: NotebookText },
  { href: "/practice", navKey: "practice", icon: ListChecks },
  { href: "/report-card", navKey: "reportCard", icon: ClipboardList },
  { href: "/history", navKey: "history", icon: Clock },
];

const COLLAPSE_KEY = "medha.sidebarCollapsed";

function SidebarWorkUpdateItem({
  collapsed,
  onNavigate,
}: {
  collapsed?: boolean;
  onNavigate?: () => void;
}) {
  const [open, setOpen] = useState(false);
  const { teacher } = useAuth();
  const { getTodayUpdateForTeacher } = useWorkUpdates();
  const copy = useCopy();

  const todayUpdate = getTodayUpdateForTeacher(teacher?.id);
  const badgeInfo = todayUpdate?.principal_feedback?.badge
    ? PRINCIPAL_BADGES[todayUpdate.principal_feedback.badge]
    : null;
  const label = copy.nav.workUpdate;

  return (
    <>
      <button
        type="button"
        onClick={() => {
          setOpen(true);
          onNavigate?.();
        }}
        title={collapsed ? label : undefined}
        className={cn(
          "flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm transition-colors text-left",
          collapsed && "justify-center px-0",
          "text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground",
        )}
      >
        <div className="relative flex size-4 shrink-0 items-center justify-center">
          <ClipboardPenLine className="size-4 text-terracotta" />
          {todayUpdate && (
            <span className="absolute -top-0.5 -right-0.5 size-2 rounded-full bg-emerald-500 ring-2 ring-background" />
          )}
        </div>
        {collapsed ? null : (
          <div className="flex flex-1 items-center justify-between">
            <span className="truncate">{label}</span>
            {badgeInfo ? (
              <span className="inline-flex items-center gap-0.5 text-xs font-semibold" title={badgeInfo.label}>
                <span>{badgeInfo.emoji}</span>
              </span>
            ) : todayUpdate ? (
              <span className="rounded-full bg-emerald-500/15 px-1.5 py-0.2 text-[10px] font-semibold text-emerald-600 dark:text-emerald-400">
                ✓ Done
              </span>
            ) : (
              <span className="rounded-full bg-terracotta/15 px-1.5 py-0.2 text-[10px] font-semibold text-terracotta">
                + New
              </span>
            )}
          </div>
        )}
      </button>

      <WorkUpdateModal open={open} onClose={() => setOpen(false)} />
    </>
  );
}

function Brand({ collapsed }: { collapsed?: boolean }) {
  return (
    <div
      className={cn(
        "flex items-center justify-center px-4 pt-4 pb-3",
        collapsed && "px-2",
      )}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/Logo.jpeg"
        alt="Medha"
        className={cn("object-contain", collapsed ? "size-9 rounded-full" : "h-28 w-auto")}
      />
    </div>
  );
}

function NavList({
  onNavigate,
  collapsed,
  scroll = true,
}: {
  onNavigate?: () => void;
  collapsed?: boolean;
  /** When true (mobile drawer) the nav is itself the scroll region. On desktop
   *  it shares one scroll container with the quote/art, so pass false. */
  scroll?: boolean;
}) {
  const copy = useCopy();
  const pathname = usePathname();
  return (
    <nav
      className={cn(
        "flex flex-col gap-1 p-2",
        scroll ? "min-h-0 flex-1 overflow-y-auto" : "shrink-0",
      )}
    >
      {collapsed ? null : (
        <span className="eyebrow px-3 pt-1 pb-1 text-muted-foreground">{copy.navMain}</span>
      )}
      {NAV.map(({ href, navKey, icon: Icon }) => {
        const active = pathname === href || pathname.startsWith(`${href}/`);
        const label = copy.nav[navKey];
        return (
          <div key={href} className="contents">
            <Link
              href={href}
              onClick={onNavigate}
              title={collapsed ? label : undefined}
              className={cn(
                "flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm transition-colors",
                collapsed && "justify-center px-0",
                active
                  ? "bg-sidebar-accent font-medium text-sidebar-accent-foreground"
                  : "text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground",
              )}
            >
              <Icon className="size-4 shrink-0" />
              {collapsed ? null : label}
            </Link>

            {navKey === "attendance" && (
              <SidebarWorkUpdateItem collapsed={collapsed} onNavigate={onNavigate} />
            )}
          </div>
        );
      })}
    </nav>
  );
}

function SidebarQuote() {
  const copy = useCopy();
  return (
    <div className="mx-2 rounded-2xl border border-sidebar-border bg-card/60 p-3.5">
      <span className="block font-serif text-2xl leading-none text-terracotta/50">&ldquo;</span>
      <p className="mt-1 text-[13px] leading-snug text-sidebar-foreground/85">
        {copy.sidebar.quote}
      </p>
      <span
        aria-hidden
        className="mt-2.5 block h-[3px] w-16 rounded-full"
        style={{ background: "linear-gradient(90deg, #FF9933, #FFFFFF, #138808)" }}
      />
    </div>
  );
}

function SidebarArt() {
  return (
    <div
      className="relative mt-3 h-32 overflow-hidden bg-no-repeat"
      style={{
        backgroundImage: "url(/dashboard-background.png)",
        backgroundSize: "360%",
        backgroundPosition: "8% 82%",
      }}
    >
      <div className="absolute inset-0 bg-gradient-to-t from-sidebar/70 via-transparent to-transparent" />
    </div>
  );
}

function SidebarFooter({ collapsed }: { collapsed?: boolean }) {
  return (
    <div
      className={cn(
        "flex flex-col gap-2 border-t border-sidebar-border p-2",
        collapsed && "items-center",
      )}
    >
      {collapsed ? null : (
        <div className="flex items-center gap-1 self-stretch px-1">
          <LanguageToggle className="self-start" />
          <NotificationBell className="ml-auto" />
        </div>
      )}
      <ProfileMenu collapsed={collapsed} />
    </div>
  );
}

export function AppSidebar() {
  // drawer closes via onNavigate (link click) and Base UI's own backdrop/esc
  const [open, setOpen] = useState(false);
  // Lazy-init from localStorage: safe because this component only ever
  // mounts client-side, after auth resolves (see lib/lesson-context.tsx's
  // readInitial() for the same established pattern) -- no SSR mismatch.
  const [collapsed, setCollapsed] = useState(() => {
    if (typeof window === "undefined") return false;
    try {
      return window.localStorage.getItem(COLLAPSE_KEY) === "1";
    } catch {
      return false;
    }
  });

  useEffect(() => {
    try {
      window.localStorage.setItem(COLLAPSE_KEY, collapsed ? "1" : "0");
    } catch {
      /* ignore */
    }
  }, [collapsed]);

  return (
    <>
      <aside
        className={cn(
          "hidden h-dvh shrink-0 flex-col overflow-hidden bg-sidebar text-sidebar-foreground transition-[width] duration-200 md:flex",
          collapsed ? "w-16" : "w-60",
        )}
      >
        <Brand collapsed={collapsed} />
        <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
          <NavList collapsed={collapsed} scroll={false} />
          {collapsed ? null : (
            <div className="mt-3 flex shrink-0 flex-col gap-0">
              <SidebarQuote />
              <SidebarArt />
            </div>
          )}
        </div>
        <SidebarFooter collapsed={collapsed} />
        <button
          type="button"
          onClick={() => setCollapsed((c) => !c)}
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          className={cn(
            "m-2 flex shrink-0 items-center justify-center gap-1.5 rounded-xl border border-sidebar-border py-1.5 text-xs text-sidebar-foreground/60 transition-colors hover:bg-sidebar-accent/50 hover:text-sidebar-foreground",
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
      </aside>

      <div className="flex items-center gap-2 border-b border-sidebar-border bg-sidebar px-3 py-2 text-sidebar-foreground md:hidden">
        <Dialog.Root open={open} onOpenChange={setOpen}>
          <Dialog.Trigger
            aria-label="Menu"
            className="flex size-9 items-center justify-center rounded-xl outline-none hover:bg-sidebar-accent focus-visible:ring-3 focus-visible:ring-ring/50"
          >
            <Menu className="size-5" />
          </Dialog.Trigger>
          <Dialog.Portal>
            <Dialog.Backdrop className="fixed inset-0 z-50 bg-black/40 transition-opacity data-[ending-style]:opacity-0 data-[starting-style]:opacity-0" />
            <Dialog.Popup className="fixed inset-y-0 left-0 z-50 flex w-64 flex-col overflow-hidden bg-sidebar text-sidebar-foreground shadow-xl transition-transform duration-200 data-[ending-style]:-translate-x-full data-[starting-style]:-translate-x-full">
              <Brand />
              <NavList onNavigate={() => setOpen(false)} />
              <SidebarFooter />
            </Dialog.Popup>
          </Dialog.Portal>
        </Dialog.Root>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/Logo.jpeg" alt="Medha" className="h-8 w-auto object-contain" />
        <NotificationBell className="ml-auto" />
        <LanguageToggle />
      </div>
    </>
  );
}
