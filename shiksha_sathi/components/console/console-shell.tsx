"use client";

import type { ReactNode } from "react";
import { BookOpen, LogOut } from "lucide-react";

import { NotificationBell } from "@/components/notifications/notification-bell";
import { useAuth } from "@/lib/auth-context";

import { cn } from "@/lib/utils";

/**
 * Chrome for the admin and principal consoles: a slim top bar (brand, section
 * label, signed-in email, log out) over a centered content column.
 */
export function ConsoleShell({
  title,
  maxWidth = "max-w-6xl",
  children,
}: {
  title: string;
  maxWidth?: string;
  children: ReactNode;
}) {
  const { teacher, logout } = useAuth();

  return (
    <div className="flex min-h-full flex-1 flex-col bg-background">
      <header className="border-b border-border">
        <div className={cn("mx-auto flex h-14 w-full items-center justify-between px-4 sm:px-6", maxWidth)}>
          <div className="flex items-center gap-2.5">
            <BookOpen className="size-5 text-terracotta" />
            <span className="font-serif text-sm font-medium tracking-[0.28em] uppercase">
              Medha
            </span>
            <span className="ml-1 rounded-md bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
              {title}
            </span>
          </div>
          <div className="flex items-center gap-3">
            <NotificationBell />
            {teacher?.email && (
              <span className="hidden text-xs text-muted-foreground sm:inline">
                {teacher.email}
              </span>
            )}
            <button
              type="button"
              onClick={() => void logout()}
              className="flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-xs text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              <LogOut className="size-3.5" />
              Log out
            </button>
          </div>
        </div>
      </header>

      <main className={cn("mx-auto w-full flex-1 px-4 py-8 sm:px-6", maxWidth)}>{children}</main>
    </div>
  );
}
