import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

export function Section({
  id,
  children,
  className,
  tone = "ivory",
}: {
  id?: string;
  children: ReactNode;
  className?: string;
  tone?: "ivory" | "parchment" | "ink";
}) {
  return (
    <section
      id={id}
      className={cn(
        "scroll-mt-20 px-6 py-24 sm:px-8 md:py-32 lg:py-40",
        tone === "parchment" && "bg-secondary",
        tone === "ink" && "bg-foreground text-background",
        className,
      )}
    >
      <div className="mx-auto w-full max-w-6xl">{children}</div>
    </section>
  );
}

export function Eyebrow({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <p className={cn("eyebrow text-muted-foreground", className)}>
      <span className="mr-3 inline-block h-px w-6 bg-current align-middle opacity-40" />
      {children}
    </p>
  );
}
