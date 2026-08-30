"use client";

import type { ReactNode } from "react";
import { BookOpen, LogOut } from "lucide-react";

import { useAuth } from "@/lib/auth-context";

/**
 * Chrome for the admin and principal consoles: a slim top bar (brand, section
 * label, signed-in email, log out) over a centered content column. No sidebar
 * -- these screens are a single dashboard.
 */
export function ConsoleShell({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  const { teacher, logout } = useAuth();

  return (
    <div className="flex min-h-full flex-1 flex-col bg-background">
      <header className="border-b border-border">
        <div className="mx-auto flex h-14 w-full max-w-5xl items-center justify-between px-4 sm:px-6">
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

      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-8 sm:px-6">{children}</main>
    </div>
  );
}
