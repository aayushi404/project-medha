"use client";

import { Dialog } from "@base-ui/react/dialog";
import {
  BookOpen,
  CalendarDays,
  ChevronUp,
  ClipboardList,
  IndianRupee,
  Languages,
  Library,
  Menu,
  MessagesSquare,
  NotebookPen,
  NotebookText,
  PencilRuler,
  LogOut,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

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
  { href: "/english", navKey: "english", icon: Languages },
  { href: "/practice", navKey: "practice", icon: PencilRuler },
  { href: "/notes", navKey: "notes", icon: NotebookText },
  { href: "/library", navKey: "library", icon: Library },
  { href: "/my-homework", navKey: "homework", icon: NotebookPen },
  { href: "/my-timetable", navKey: "timetable", icon: CalendarDays },
  { href: "/my-report-card", navKey: "reportCard", icon: ClipboardList },
  { href: "/my-resources", navKey: "resources", icon: Library },
  { href: "/fees", navKey: "fees", icon: IndianRupee },
];

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return ((parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? "")).toUpperCase() || "?";
}

function Brand() {
  return (
    <div className="flex items-center gap-2.5 border-b border-sidebar-border px-4 py-4">
      <BookOpen className="size-5 text-terracotta" />
      <span className="font-serif text-base font-medium tracking-[0.28em] uppercase">
        Medha
      </span>
      <NotificationBell className="ml-auto" />
    </div>
  );
}

function NavList({ onNavigate }: { onNavigate?: () => void }) {
  const copy = useCopy();
  const pathname = usePathname();
  return (
    <nav className="flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto p-2">
      {NAV.map(({ href, navKey, icon: Icon }) => {
        const active = pathname === href || pathname.startsWith(`${href}/`);
        return (
          <Link
            key={href}
            href={href}
            onClick={onNavigate}
            className={cn(
              "flex items-center gap-2.5 rounded-lg px-3 py-2.5 text-sm transition-colors",
              active
                ? "bg-sidebar-accent font-medium text-sidebar-accent-foreground"
                : "text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground",
            )}
          >
            <Icon className="size-4" />
            {copy.studentNav[navKey]}
          </Link>
        );
      })}
    </nav>
  );
}

function StudentMenu() {
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

  const chip = (
    <span className="flex w-full items-center gap-2.5 rounded-lg border border-border bg-card px-2 py-2 text-left transition-colors hover:bg-muted">
      <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-accent text-xs font-medium text-accent-foreground">
        {initials(name || "?")}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[13px]">{name || "—"}</span>
        <span className="block truncate text-[11px] text-muted-foreground">{subtitle}</span>
      </span>
      <ChevronUp className="size-3.5 shrink-0 text-muted-foreground" />
    </span>
  );

  return (
    <Popover trigger={chip} triggerClassName="w-full" side="top" align="center">
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

function SidebarFooter() {
  return (
    <div className="flex flex-col gap-2 border-t border-sidebar-border p-2">
      <LanguageToggle className="self-start" />
      <StudentMenu />
    </div>
  );
}

export function StudentSidebar() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <aside className="hidden w-56 shrink-0 flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground md:flex">
        <Brand />
        <NavList />
        <SidebarFooter />
      </aside>

      <div className="flex items-center gap-2 border-b border-sidebar-border bg-sidebar px-3 py-2.5 text-sidebar-foreground md:hidden">
        <Dialog.Root open={open} onOpenChange={setOpen}>
          <Dialog.Trigger
            aria-label="Menu"
            className="flex size-9 items-center justify-center rounded-lg outline-none hover:bg-sidebar-accent focus-visible:ring-3 focus-visible:ring-ring/50"
          >
            <Menu className="size-5" />
          </Dialog.Trigger>
          <Dialog.Portal>
            <Dialog.Backdrop className="fixed inset-0 z-50 bg-black/40 transition-opacity data-[ending-style]:opacity-0 data-[starting-style]:opacity-0" />
            <Dialog.Popup className="fixed inset-y-0 left-0 z-50 flex w-64 flex-col bg-sidebar text-sidebar-foreground shadow-xl transition-transform duration-200 data-[ending-style]:-translate-x-full data-[starting-style]:-translate-x-full">
              <Brand />
              <NavList onNavigate={() => setOpen(false)} />
              <SidebarFooter />
            </Dialog.Popup>
          </Dialog.Portal>
        </Dialog.Root>
        <BookOpen className="size-5 text-terracotta" />
        <span className="font-serif text-base font-medium tracking-[0.28em] uppercase">
          Medha
        </span>
        <NotificationBell className="ml-auto" />
        <LanguageToggle />
      </div>
    </>
  );
}
