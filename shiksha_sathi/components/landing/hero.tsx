import { ArrowDown } from "lucide-react";

export function Hero() {
  return (
    <section id="top" className="sun-wash grain relative overflow-hidden">
      <div
        aria-hidden="true"
        className="breathe pointer-events-none absolute top-[-18rem] left-1/2 size-[42rem] -translate-x-1/2 rounded-full opacity-60 blur-3xl"
        style={{
          background:
            "radial-gradient(circle, color-mix(in oklab, var(--gold) 45%, transparent), transparent 65%)",
        }}
      />

      <div className="relative mx-auto flex w-full max-w-6xl flex-col items-center px-6 pt-32 pb-0 text-center sm:px-8 md:pt-44">
        <p className="eyebrow text-muted-foreground">An education initiative for Bihar</p>

        <h1 className="display mt-8 max-w-4xl text-[clamp(2.6rem,8vw,5.75rem)] text-foreground">
          Reimagining the way
          <br />
          <span className="text-terracotta italic">Bihar learns.</span>
        </h1>

        <p className="mt-8 max-w-xl text-base leading-relaxed text-balance text-muted-foreground sm:text-lg">
          Medha is an AI companion that helps teachers teach better and students learn better —
          built on a land that has always believed in the power of knowledge.
        </p>

        <div className="mt-10 flex flex-col items-center gap-4 sm:flex-row">
          <a
            href="#get-started"
            className="w-full bg-foreground px-8 py-4 text-sm font-medium tracking-wide text-background transition-opacity hover:opacity-90 sm:w-auto"
          >
            Get started
          </a>
          <a
            href="#workflow"
            className="inline-flex items-center gap-2 px-2 py-4 text-sm text-muted-foreground transition-colors hover:text-foreground"
          >
            See how it works
            <ArrowDown className="size-4" />
          </a>
        </div>

        <div className="relative mt-20 w-full max-w-4xl md:mt-28">
          <div
            aria-hidden="true"
            className="absolute inset-x-8 -top-6 h-px bg-gradient-to-r from-transparent via-border to-transparent"
          />
          {/* eslint-disable-next-line @next/next/no-img-element -- CSS mask compositing needs a bare <img>, not the next/image wrapper */}
          <img
            src="/landing/hero-composition.jpg"
            alt="A minimal composition of Nalanda-inspired architecture beneath a rising golden sun"
            width={1408}
            height={1408}
            fetchPriority="high"
            className="mx-auto aspect-[4/3] w-full object-cover object-center"
            style={{
              maskImage:
                "linear-gradient(to bottom, black 0%, black 72%, transparent 100%), linear-gradient(to right, transparent 0%, black 8%, black 92%, transparent 100%)",
              maskComposite: "intersect",
              WebkitMaskImage:
                "linear-gradient(to bottom, black 0%, black 72%, transparent 100%), linear-gradient(to right, transparent 0%, black 8%, black 92%, transparent 100%)",
              WebkitMaskComposite: "source-in",
            }}
          />
        </div>
      </div>
    </section>
  );
}
