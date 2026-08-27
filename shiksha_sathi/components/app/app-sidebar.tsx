"use client";

import { Dialog } from "@base-ui/react/dialog";
import { BookOpen, FolderOpen, Home, Menu } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

import { ProfileMenu } from "@/components/app/profile-menu";
import { copy } from "@/lib/copy";
import { cn } from "@/lib/utils";

const NAV = [
  { href: "/dashboard", label: copy.nav.home, icon: Home },
  { href: "/modules", label: copy.nav.modules, icon: FolderOpen },
] as const;

function Brand() {
  return (
    <div className="flex items-center gap-2 border-b border-sidebar-border px-4 py-4">
      <BookOpen className="size-5 text-primary" />
      <span className="text-sm font-medium">{copy.brand}</span>
    </div>
  );
}

function NavList({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  return (
    <nav className="flex flex-1 flex-col gap-1 p-2">
      {NAV.map(({ href, label, icon: Icon }) => {
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
            {label}
          </Link>
        );
      })}
    </nav>
  );
}

export function AppSidebar() {
  // drawer closes via onNavigate (link click) and Base UI's own backdrop/esc
  const [open, setOpen] = useState(false);

  return (
    <>
      <aside className="hidden w-56 shrink-0 flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground md:flex">
        <Brand />
        <NavList />
        <div className="border-t border-sidebar-border p-2">
          <ProfileMenu />
        </div>
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
              <div className="border-t border-sidebar-border p-2">
                <ProfileMenu />
              </div>
            </Dialog.Popup>
          </Dialog.Portal>
        </Dialog.Root>
        <BookOpen className="size-5 text-primary" />
        <span className="text-sm font-medium">{copy.brand}</span>
      </div>
    </>
  );
}
