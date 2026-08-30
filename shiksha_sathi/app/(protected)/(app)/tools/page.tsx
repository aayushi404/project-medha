"use client";

import { ArrowRight } from "lucide-react";
import Link from "next/link";
import { motion } from "motion/react";

import { TOOL_CATEGORIES, TOOLS, type Tool } from "@/lib/tools";
import { cn } from "@/lib/utils";

function ToolCard({ tool }: { tool: Tool }) {
  const { icon: Icon, status } = tool;
  return (
    <Link
      href={`/tools/${tool.slug}`}
      className={cn(
        "group flex flex-col gap-2 rounded-xl border border-border bg-card p-4 transition-colors hover:bg-muted",
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <span className="flex size-9 items-center justify-center rounded-lg bg-accent text-terracotta">
          <Icon className="size-[18px]" />
        </span>
        {status === "soon" ? (
          <span className="rounded-full border border-border px-2 py-0.5 text-[10px] tracking-wide text-muted-foreground uppercase">
            Soon
          </span>
        ) : (
          <ArrowRight className="size-4 translate-x-0 text-muted-foreground opacity-0 transition-all group-hover:translate-x-0.5 group-hover:opacity-100" />
        )}
      </div>
      <div className="mt-1">
        <div className="text-sm font-medium">{tool.name}</div>
        <div className="mt-0.5 text-xs text-muted-foreground">{tool.tagline}</div>
      </div>
    </Link>
  );
}

export default function ToolsPage() {
  return (
    <main className="flex flex-1 flex-col overflow-hidden">
      <div className="border-b border-border px-5 py-4">
        <h1 className="text-[15px]">{"Tools"}</h1>
        <p className="mt-0.5 text-xs text-muted-foreground">
          Small helpers for planning, making material and running the room.
        </p>
      </div>

      <div className="flex-1 overflow-y-auto px-5 py-5">
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, ease: "easeOut" }}
          className="mx-auto flex max-w-3xl flex-col gap-8"
        >
          {TOOL_CATEGORIES.map(({ key, label, hint }) => {
            const items = TOOLS.filter((t) => t.category === key);
            if (items.length === 0) return null;
            return (
              <section key={key}>
                <div className="mb-3">
                  <h2 className="text-[11px] font-semibold tracking-[0.18em] text-muted-foreground uppercase">
                    {label}
                  </h2>
                  <p className="mt-0.5 text-xs text-muted-foreground/80">{hint}</p>
                </div>
                <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
                  {items.map((t) => (
                    <ToolCard key={t.slug} tool={t} />
                  ))}
                </div>
              </section>
            );
          })}
        </motion.div>
      </div>
    </main>
  );
}
