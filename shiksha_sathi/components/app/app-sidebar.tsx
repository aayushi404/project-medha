"use client";

import { Dialog } from "@base-ui/react/dialog";
import {
  Award,
  Bell,
  CalendarDays,
  ChevronDown,
  ClipboardCheck,
  ClipboardList,
  ClipboardPenLine,
  Clock,
  FlaskConical,
  FolderOpen,
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
  School,
  Wrench,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useId, useRef, useState, type KeyboardEvent, type PointerEvent, type ReactNode } from "react";

import { LanguageToggle } from "@/components/app/language-toggle";
import { ProfileMenu } from "@/components/app/profile-menu";
import { WorkUpdateModal } from "@/components/dashboard/work-update-modal";
import { NotificationBell } from "@/components/notifications/notification-bell";
import { useAuth } from "@/lib/auth-context";
import { useCopy } from "@/lib/copy";
import type { Copy } from "@/lib/copy";
import { cn } from "@/lib/utils";
import { SchoolCardPanel } from "@/components/school/school-card-panel";
import { PRINCIPAL_BADGES, useWorkUpdates } from "@/lib/work-update-store";

type NavItem = { href: string; navKey: keyof Copy["nav"]; icon: LucideIcon };
type NavGroupKey = "academics" | "resources" | "exams";
type NavGroup = { key: NavGroupKey; icon: LucideIcon; items: NavItem[] };

/** Always open, at the top of the menu. */
const NAV_TOP: NavItem[] = [
  { href: "/dashboard", navKey: "home", icon: Home },
  { href: "/ask", navKey: "askMedha", icon: MessageCircle },
];

/** Collapsible groups, in menu order. Work Update sits after Homework (see NavRows). */
const NAV_GROUPS: NavGroup[] = [
  {
    key: "academics",
    icon: School,
    items: [
      { href: "/attendance", navKey: "attendance", icon: ClipboardCheck },
      { href: "/homework", navKey: "homework", icon: NotebookPen },
      { href: "/timetable", navKey: "timetable", icon: CalendarDays },
      { href: "/students", navKey: "students", icon: GraduationCap },
      { href: "/notifications", navKey: "notifications", icon: Bell },
    ],
  },
  {
    key: "resources",
    icon: FolderOpen,
    items: [
      { href: "/simulations", navKey: "simulations", icon: FlaskConical },
      { href: "/notes", navKey: "notes", icon: NotebookText },
      { href: "/practice", navKey: "practice", icon: ListChecks },
      { href: "/tools", navKey: "tools", icon: Wrench },
      { href: "/resources", navKey: "resources", icon: Library },
    ],
  },
  {
    key: "exams",
    icon: Award,
    items: [{ href: "/report-card", navKey: "reportCard", icon: ClipboardList }],
  },
];

/** Always open, at the bottom of the menu. */
const NAV_BOTTOM: NavItem[] = [{ href: "/history", navKey: "history", icon: Clock }];

const SIDEBAR_WIDTH_KEY = "medha.sidebarWidth";
const SIDEBAR_GROUPS_KEY = "medha.sidebarGroups";
const SIDEBAR_WIDTH_DEFAULT = 240;
const SIDEBAR_WIDTH_MIN = 200;
const SIDEBAR_WIDTH_MAX = 360;
const SIDEBAR_KEY_STEP = 16;

function clampWidth(w: number): number {
  return Math.min(SIDEBAR_WIDTH_MAX, Math.max(SIDEBAR_WIDTH_MIN, Math.round(w)));
}

function readSidebarWidth(): number {
  try {
    const n = Number(window.localStorage.getItem(SIDEBAR_WIDTH_KEY));
    return Number.isFinite(n) && n >= SIDEBAR_WIDTH_MIN && n <= SIDEBAR_WIDTH_MAX ? n : SIDEBAR_WIDTH_DEFAULT;
  } catch {
    return SIDEBAR_WIDTH_DEFAULT;
  }
}

function readGroupState(): Partial<Record<NavGroupKey, boolean>> {
  try {
    const parsed: unknown = JSON.parse(window.localStorage.getItem(SIDEBAR_GROUPS_KEY) ?? "{}");
    return parsed && typeof parsed === "object" ? (parsed as Partial<Record<NavGroupKey, boolean>>) : {};
  } catch {
    return {};
  }
}

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

/** One nav link, plus the Work Update row that follows Homework. */
function NavRows({
  item,
  collapsed,
  onNavigate,
  pathname,
}: {
  item: NavItem;
  collapsed?: boolean;
  onNavigate?: () => void;
  pathname: string;
}) {
  const copy = useCopy();
  const { href, navKey, icon: Icon } = item;
  const active = pathname === href || pathname.startsWith(`${href}/`);
  const label = copy.nav[navKey];
  return (
    <div className="contents">
      <Link
        href={href}
        onClick={onNavigate}
        title={collapsed ? label : undefined}
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
        {collapsed ? null : label}
      </Link>
      {navKey === "homework" && <SidebarWorkUpdateItem collapsed={collapsed} onNavigate={onNavigate} />}
    </div>
  );
}

/** A group header that opens and closes its links. Animated with the grid-rows
 * trick, so the height change is smooth without measuring. Closed content is
 * `inert`, so keyboard focus can't reach hidden links. */
function NavAccordion({
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

function NavList({
  onNavigate,
  collapsed,
  scroll = true,
  groupOpen,
  onToggleGroup,
}: {
  onNavigate?: () => void;
  collapsed?: boolean;
  /** When true (mobile drawer) the nav is itself the scroll region. On desktop
   *  it shares one scroll container with the quote/art, so pass false. */
  scroll?: boolean;
  /** Groups the user has opened or closed. A group with no choice yet opens
   * only when the current page is one of its links. */
  groupOpen: Partial<Record<NavGroupKey, boolean>>;
  onToggleGroup: (key: NavGroupKey, open: boolean) => void;
}) {
  const copy = useCopy();
  const pathname = usePathname();
  const isActive = (href: string) => pathname === href || pathname.startsWith(`${href}/`);

  return (
    <nav
      aria-label={copy.navMain}
      className={cn(
        "flex flex-col gap-1 p-2",
        scroll ? "min-h-0 flex-1 overflow-y-auto" : "shrink-0",
      )}
    >
      {collapsed ? null : (
        <span className="eyebrow px-3 pt-1 pb-1 text-muted-foreground">{copy.navMain}</span>
      )}
      {NAV_TOP.map((item) => (
        <NavRows key={item.href} item={item} collapsed={collapsed} onNavigate={onNavigate} pathname={pathname} />
      ))}

      {NAV_GROUPS.map((group) => {
        if (collapsed) {
          // the icon rail has no room for headers: show the links, split by a rule
          return (
            <div key={group.key} className="mt-1 flex flex-col gap-1 border-t border-sidebar-border pt-1">
              {group.items.map((item) => (
                <NavRows key={item.href} item={item} collapsed onNavigate={onNavigate} pathname={pathname} />
              ))}
            </div>
          );
        }
        const containsCurrent = group.items.some((item) => isActive(item.href));
        const open = groupOpen[group.key] ?? containsCurrent;
        return (
          <NavAccordion
            key={group.key}
            label={copy.navGroup[group.key]}
            icon={group.icon}
            open={open}
            onToggle={() => onToggleGroup(group.key, !open)}
          >
            {group.items.map((item) => (
              <NavRows key={item.href} item={item} onNavigate={onNavigate} pathname={pathname} />
            ))}
          </NavAccordion>
        );
      })}

      {NAV_BOTTOM.map((item) => (
        <NavRows key={item.href} item={item} collapsed={collapsed} onNavigate={onNavigate} pathname={pathname} />
      ))}
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
  const [width, setWidth] = useState(() => (typeof window === "undefined" ? SIDEBAR_WIDTH_DEFAULT : readSidebarWidth()));
  const [dragging, setDragging] = useState(false);
  const [groupOpen, setGroupOpen] = useState<Partial<Record<NavGroupKey, boolean>>>(() =>
    typeof window === "undefined" ? {} : readGroupState(),
  );
  const drag = useRef<{ startX: number; startWidth: number } | null>(null);

  useEffect(() => {
    try {
      window.localStorage.setItem(COLLAPSE_KEY, collapsed ? "1" : "0");
    } catch {
      /* ignore */
    }
  }, [collapsed]);

  // save the width once a drag ends (not on every pixel of movement)
  useEffect(() => {
    if (dragging) return;
    try {
      window.localStorage.setItem(SIDEBAR_WIDTH_KEY, String(width));
    } catch {
      /* ignore */
    }
  }, [width, dragging]);

  useEffect(() => {
    try {
      window.localStorage.setItem(SIDEBAR_GROUPS_KEY, JSON.stringify(groupOpen));
    } catch {
      /* ignore */
    }
  }, [groupOpen]);

  function toggleGroup(key: NavGroupKey, next: boolean) {
    setGroupOpen((prev) => ({ ...prev, [key]: next }));
  }

  function onHandleDown(e: PointerEvent<HTMLDivElement>) {
    drag.current = { startX: e.clientX, startWidth: width };
    e.currentTarget.setPointerCapture(e.pointerId);
    setDragging(true);
    e.preventDefault();
  }

  function onHandleMove(e: PointerEvent<HTMLDivElement>) {
    const d = drag.current;
    if (!d) return;
    setWidth(clampWidth(d.startWidth + (e.clientX - d.startX)));
  }

  function onHandleUp(e: PointerEvent<HTMLDivElement>) {
    if (!drag.current) return;
    drag.current = null;
    if (e.currentTarget.hasPointerCapture(e.pointerId)) e.currentTarget.releasePointerCapture(e.pointerId);
    setDragging(false);
  }

  function onHandleKey(e: KeyboardEvent<HTMLDivElement>) {
    if (e.key === "ArrowLeft") {
      e.preventDefault();
      setWidth((w) => clampWidth(w - SIDEBAR_KEY_STEP));
    } else if (e.key === "ArrowRight") {
      e.preventDefault();
      setWidth((w) => clampWidth(w + SIDEBAR_KEY_STEP));
    }
  }

  return (
    <>
      <aside
        style={collapsed ? undefined : { width }}
        className={cn(
          "relative hidden h-dvh shrink-0 flex-col overflow-hidden bg-sidebar text-sidebar-foreground md:flex",
          collapsed && "w-16",
          // no width animation while the handle is being dragged: it should follow the pointer exactly
          !dragging && "transition-[width] duration-200",
        )}
      >
        <Brand collapsed={collapsed} />
        <div className={cn("pb-3", collapsed ? "px-2" : "px-3")}>
          <SchoolCardPanel collapsed={collapsed} />
        </div>
        <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
          <NavList collapsed={collapsed} scroll={false} groupOpen={groupOpen} onToggleGroup={toggleGroup} />
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

        {collapsed ? null : (
          <div
            role="separator"
            aria-orientation="vertical"
            aria-label="Resize sidebar"
            aria-valuemin={SIDEBAR_WIDTH_MIN}
            aria-valuemax={SIDEBAR_WIDTH_MAX}
            aria-valuenow={width}
            tabIndex={0}
            title="Drag to resize. Double-click to reset."
            onPointerDown={onHandleDown}
            onPointerMove={onHandleMove}
            onPointerUp={onHandleUp}
            onPointerCancel={onHandleUp}
            onDoubleClick={() => setWidth(SIDEBAR_WIDTH_DEFAULT)}
            onKeyDown={onHandleKey}
            className="group absolute inset-y-0 right-0 z-20 w-2 cursor-col-resize touch-none select-none outline-none"
          >
            <span
              aria-hidden
              className={cn(
                "absolute inset-y-0 left-1/2 w-0.5 -translate-x-1/2 rounded-full transition-colors",
                dragging ? "bg-primary" : "bg-transparent group-hover:bg-primary/50 group-focus-visible:bg-ring",
              )}
            />
          </div>
        )}
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
            <Dialog.Popup className="fixed inset-y-0 left-0 z-50 flex w-72 max-w-[85vw] flex-col overflow-y-auto bg-sidebar text-sidebar-foreground shadow-xl transition-transform duration-200 data-[ending-style]:-translate-x-full data-[starting-style]:-translate-x-full">
              <Brand />
              <div className="px-3 pb-3">
                <SchoolCardPanel collapsed={false} />
              </div>
              <NavList onNavigate={() => setOpen(false)} groupOpen={groupOpen} onToggleGroup={toggleGroup} />
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
