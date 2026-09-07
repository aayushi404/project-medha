"use client";

import { Dialog } from "@base-ui/react/dialog";
import {
  BookOpen,
  CalendarDays,
  ChevronUp,
  ClipboardList,
  FlaskConical,
  IndianRupee,
  Languages,
  Library,
  Menu,
  MessagesSquare,
  NotebookPen,
  NotebookText,
  PanelLeftClose,
  PanelLeftOpen,
  PencilRuler,
  Sparkles,
  LogOut,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

import { LanguageToggle } from "@/components/app/language-toggle";
import { NotificationBell } from "@/components/notifications/notification-bell";
import { Popover, PopoverItem } from "@/components/ui/popover";
import { useAuth } from "@/lib/auth-context";
import { useCopy, useCurriculumT } from "@/lib/copy";
import type { Copy } from "@/lib/copy";
import { useStudentData } from "@/lib/student-context";
import { cn } from "@/lib/utils";

const NAV: { href: string; navKey: keyof Copy["studentNav"]; icon: LucideIcon }[] = [
  { href: "/learn", navKey: "ask", icon: MessagesSquare },
  { href: "/bihar-darpan", navKey: "biharDarpan", icon: Sparkles },
  { href: "/english", navKey: "english", icon: Languages },
  { href: "/my-practice", navKey: "practice", icon: PencilRuler },
  { href: "/my-notes", navKey: "notes", icon: NotebookText },
  { href: "/library", navKey: "library", icon: BookOpen },
  { href: "/learn-lab", navKey: "simulations", icon: FlaskConical },
  { href: "/my-homework", navKey: "homework", icon: NotebookPen },
  { href: "/my-timetable", navKey: "timetable", icon: CalendarDays },
  { href: "/my-report-card", navKey: "reportCard", icon: ClipboardList },
  { href: "/my-resources", navKey: "resources", icon: Library },
  { href: "/fees", navKey: "fees", icon: IndianRupee },
];

const COLLAPSE_KEY = "medha.studentSidebarCollapsed";

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return ((parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? "")).toUpperCase() || "?";
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
        const label = copy.studentNav[navKey];
        return (
          <Link
            key={href}
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

function StudentMenu({ collapsed }: { collapsed?: boolean }) {
  const copy = useCopy();
  const t = useCurriculumT();
  const { teacher, logout } = useAuth();
  const { gradeLabel } = useStudentData();
  const name = teacher?.full_name ?? "";
  const subtitle = [
    t.grade(gradeLabel),
    teacher?.roll_number ? `Roll ${teacher.roll_number}` : null,
  ]
    .filter(Boolean)
    .join(" · ");

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
      <StudentMenu collapsed={collapsed} />
    </div>
  );
}

export function StudentSidebar() {
  // drawer closes via onNavigate (link click) and Base UI's own backdrop/esc
  const [open, setOpen] = useState(false);
  // Lazy-init from localStorage: safe because this only ever mounts
  // client-side, after auth resolves -- no SSR mismatch. Mirrors AppSidebar.
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
          className="m-2 flex shrink-0 items-center justify-center gap-1.5 rounded-xl border border-sidebar-border py-1.5 text-xs text-sidebar-foreground/60 transition-colors hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
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
