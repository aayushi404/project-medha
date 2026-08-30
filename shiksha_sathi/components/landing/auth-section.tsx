"use client";

import Link from "next/link";
import { ArrowRight, GraduationCap, School } from "lucide-react";

import { useAuth } from "@/lib/auth-context";
import { Reveal } from "./reveal";

type Path = {
  role: "principal" | "teacher";
  icon: typeof School;
  title: string;
  blurb: string;
};

const PATHS: Path[] = [
  {
    role: "principal",
    icon: School,
    title: "I'm a Principal",
    blurb:
      "Register your school, then approve the teachers who join it. An administrator approves your account first.",
  },
  {
    role: "teacher",
    icon: GraduationCap,
    title: "I'm a Teacher",
    blurb:
      "Build lessons with Medha. Your principal approves your account before you start.",
  },
];

export function AuthSection() {
  const { status } = useAuth();

  return (
    <section
      id="get-started"
      className="sun-wash grain scroll-mt-20 border-t border-border px-6 py-28 sm:px-8 md:py-40"
    >
      <div className="mx-auto grid w-full max-w-6xl items-center gap-14 md:grid-cols-2 md:gap-20">
        <Reveal>
          <p className="eyebrow text-muted-foreground">Get started</p>
          <h2 className="display mt-6 text-[clamp(2.25rem,5vw,3.75rem)]">
            Every classroom holds possibility.
          </h2>
          <p className="mt-8 max-w-md text-lg leading-relaxed text-muted-foreground">
            Medha is rolled out school by school. A principal signs up first; teachers
            then join under a principal who can vouch for them.
          </p>
        </Reveal>

        <Reveal delay={100}>
          {status === "authenticated" ? (
            <div className="warm-frame p-8 text-center sm:p-10">
              <p className="text-base leading-relaxed text-foreground">
                You&apos;re already signed in.
              </p>
              <Link
                href="/home"
                className="mt-6 inline-flex items-center gap-2 bg-foreground px-8 py-4 text-sm font-medium tracking-wide text-background transition-opacity hover:opacity-90"
              >
                Go to your dashboard
                <ArrowRight className="size-4" />
              </Link>
            </div>
          ) : (
            <div className="flex flex-col gap-4">
              {PATHS.map(({ role, icon: Icon, title, blurb }) => (
                <div key={role} className="warm-frame p-6 sm:p-7">
                  <div className="flex items-center gap-3">
                    <Icon className="size-5 text-terracotta" />
                    <h3 className="font-serif text-lg font-medium text-foreground">
                      {title}
                    </h3>
                  </div>
                  <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                    {blurb}
                  </p>
                  <div className="mt-5 flex flex-wrap items-center gap-3">
                    <Link
                      href={`/register?role=${role}`}
                      className="inline-flex items-center gap-2 bg-foreground px-6 py-3 text-sm font-medium tracking-wide text-background transition-opacity hover:opacity-90"
                    >
                      Register as {role}
                      <ArrowRight className="size-4" />
                    </Link>
                    <Link
                      href="/login"
                      className="text-sm text-terracotta underline-offset-2 hover:underline"
                    >
                      Log in
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Reveal>
      </div>
    </section>
  );
}
