"use client";

import { Dialog } from "@base-ui/react/dialog";
import {
  ClipboardCheck,
  Clock,
  GraduationCap,
  Home,
  Menu,
  MessageCircle,
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
import { useCopy } from "@/lib/copy";
import type { Copy } from "@/lib/copy";
import { cn } from "@/lib/utils";

const NAV: { href: string; navKey: keyof Copy["nav"]; icon: LucideIcon }[] = [
  { href: "/dashboard", navKey: "home", icon: Home },
  { href: "/ask", navKey: "askMedha", icon: MessageCircle },
  { href: "/history", navKey: "history", icon: Clock },
  { href: "/students", navKey: "students", icon: GraduationCap },
  { href: "/tools", navKey: "tools", icon: Wrench },
  { href: "/attendance", navKey: "attendance", icon: ClipboardCheck },
];

const COLLAPSE_KEY = "medha.sidebarCollapsed";

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
}: {
  onNavigate?: () => void;
  collapsed?: boolean;
}) {
  const copy = useCopy();
  const pathname = usePathname();
  return (
    <nav className="flex min-h-0 flex-col gap-1 overflow-y-auto p-2">
      {collapsed ? null : (
        <span className="eyebrow px-3 pt-1 pb-1 text-muted-foreground">{copy.navMain}</span>
      )}
      {NAV.map(({ href, navKey, icon: Icon }) => {
        const active = pathname === href || pathname.startsWith(`${href}/`);
        const label = copy.nav[navKey];
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

function SidebarFooter({ collapsed }: { collapsed?: boolean }) {
  return (
    <div
      className={cn(
        "flex flex-col gap-2 border-t border-sidebar-border p-2",
        collapsed && "items-center",
      )}
    >
      {collapsed ? null : <LanguageToggle className="self-start" />}
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
          "hidden shrink-0 flex-col bg-sidebar text-sidebar-foreground transition-[width] duration-200 md:flex",
          collapsed ? "w-16" : "w-60",
        )}
      >
        <Brand collapsed={collapsed} />
        <NavList collapsed={collapsed} />
        {collapsed ? null : (
          <div className="mt-3 flex min-h-0 flex-1 flex-col justify-end gap-0">
            <SidebarQuote />
            <SidebarArt />
          </div>
        )}
        {collapsed ? <div className="flex-1" /> : null}
        <SidebarFooter collapsed={collapsed} />
        <button
          type="button"
          onClick={() => setCollapsed((c) => !c)}
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          className={cn(
            "m-2 flex items-center justify-center gap-1.5 rounded-xl border border-sidebar-border py-1.5 text-xs text-sidebar-foreground/60 transition-colors hover:bg-sidebar-accent/50 hover:text-sidebar-foreground",
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
            <Dialog.Popup className="fixed inset-y-0 left-0 z-50 flex w-64 flex-col bg-sidebar text-sidebar-foreground shadow-xl transition-transform duration-200 data-[ending-style]:-translate-x-full data-[starting-style]:-translate-x-full">
              <Brand />
              <NavList onNavigate={() => setOpen(false)} />
              <div className="flex-1" />
              <SidebarFooter />
            </Dialog.Popup>
          </Dialog.Portal>
        </Dialog.Root>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/Logo.jpeg" alt="Medha" className="h-8 w-auto object-contain" />
        <LanguageToggle className="ml-auto" />
      </div>
    </>
  );
}
