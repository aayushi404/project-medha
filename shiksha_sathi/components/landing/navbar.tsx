"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { Menu, X } from "lucide-react";

import { useAuth } from "@/lib/auth-context";
import { cn } from "@/lib/utils";

const links = [
  { label: "Vision", href: "#heritage" },
  { label: "For Teachers", href: "#teachers" },
  { label: "For Students", href: "#students" },
  { label: "About", href: "#partnership" },
];

export function Navbar() {
  const { status } = useAuth();
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);

  const authed = status === "authenticated";

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header
      className={cn(
        "fixed inset-x-0 top-0 z-50 transition-all duration-500",
        scrolled
          ? "border-b border-border bg-background/85 backdrop-blur-md"
          : "border-b border-transparent",
      )}
    >
      <nav
        aria-label="Primary"
        className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between px-6 sm:px-8 md:h-20"
      >
        <a href="#top" className="flex items-center gap-3 text-foreground" aria-label="Medha home">
          <Image
            src="/Logo.jpeg"
            alt="Medha logo"
            width={40}
            height={40}
            className="size-9 shrink-0 rounded-sm object-contain md:size-10"
          />
          <span className="display text-xl tracking-[0.32em] uppercase">Medha</span>
        </a>

        <div className="hidden items-center gap-10 md:flex">
          {links.map((l) => (
            <a
              key={l.href}
              href={l.href}
              className="text-sm text-muted-foreground transition-colors hover:text-foreground"
            >
              {l.label}
            </a>
          ))}
          {authed ? (
            <Link
              href="/home"
              className="border border-foreground px-5 py-2.5 text-sm font-medium text-foreground transition-colors hover:bg-foreground hover:text-background"
            >
              Go to dashboard
            </Link>
          ) : (
            <>
              <Link
                href="/login"
                className="text-sm text-muted-foreground transition-colors hover:text-foreground"
              >
                Log in
              </Link>
              <a
                href="#get-started"
                className="border border-foreground px-5 py-2.5 text-sm font-medium text-foreground transition-colors hover:bg-foreground hover:text-background"
              >
                Get started
              </a>
            </>
          )}
        </div>

        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="-mr-2 p-2 text-foreground md:hidden"
          aria-expanded={open}
          aria-label={open ? "Close menu" : "Open menu"}
        >
          {open ? <X className="size-5" /> : <Menu className="size-5" />}
        </button>
      </nav>

      {open ? (
        <div className="border-t border-border bg-background px-6 pt-4 pb-8 md:hidden">
          <ul className="space-y-1">
            {links.map((l) => (
              <li key={l.href}>
                <a
                  href={l.href}
                  onClick={() => setOpen(false)}
                  className="block border-b border-border py-4 text-base text-foreground"
                >
                  {l.label}
                </a>
              </li>
            ))}
          </ul>
          {authed ? (
            <Link
              href="/home"
              onClick={() => setOpen(false)}
              className="mt-6 block bg-foreground px-5 py-3.5 text-center text-sm font-medium text-background"
            >
              Go to dashboard
            </Link>
          ) : (
            <div className="mt-6 flex flex-col gap-3">
              <a
                href="#get-started"
                onClick={() => setOpen(false)}
                className="block bg-foreground px-5 py-3.5 text-center text-sm font-medium text-background"
              >
                Get started
              </a>
              <Link
                href="/login"
                onClick={() => setOpen(false)}
                className="block border border-border px-5 py-3.5 text-center text-sm font-medium text-foreground"
              >
                Log in
              </Link>
            </div>
          )}
        </div>
      ) : null}
    </header>
  );
}
