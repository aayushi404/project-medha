import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, Quote, Sparkles, GraduationCap, Users, MapPinned } from "lucide-react";

const title = "Aditya Prabhakar — Founder, Medha";
const description =
  "Aditya Prabhakar, a student of IIT Madras, envisioned Project Medha with the belief that technology can empower teachers and transform the way students learn.";

export const metadata: Metadata = {
  title,
  description,
  openGraph: { title, description, type: "profile", images: ["/founder.jpeg"] },
  twitter: { card: "summary_large_image", title, description, images: ["/founder.jpeg"] },
};

const VISION_PILLARS = [
  { icon: Users, label: "Empower Teachers" },
  { icon: Sparkles, label: "Improve Learning" },
  { icon: MapPinned, label: "Transform Bihar" },
];

/**
 * Public "person behind the idea" page -- no sign-in required, same spirit as
 * /privacy and /delete-account. The poster in public/founder.jpeg is shown
 * whole (never cropped), and the content below it restates the same story as
 * real page text -- readable, accessible, and matched to the rest of Medha's
 * design system rather than a second copy of the graphic.
 */
export default function FounderPage() {
  return (
    <main className="medha-landing min-h-dvh bg-ivory text-ink">
      {/* thin brand-colour rule, echoes the poster's triangle motif */}
      <div className="flex h-1.5 w-full">
        <div className="flex-1 bg-terracotta" />
        <div className="flex-1 bg-gold" />
        <div className="flex-1 bg-violet" />
        <div className="flex-1 bg-earth" />
      </div>

      <div className="mx-auto w-full max-w-5xl px-4 py-8 sm:py-12">
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 text-sm font-medium text-ink/60 transition-colors hover:text-ink"
        >
          <ArrowLeft className="size-4" aria-hidden />
          Medha
        </Link>

        {/* The poster itself, shown complete -- no cropping, full width,
            its own 16:9 aspect ratio preserved at every screen size. */}
        <figure className="mt-6 overflow-hidden rounded-2xl border border-hairline shadow-lg">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/founder.jpeg"
            alt="Person Behind the Idea: Aditya Prabhakar, IIT Madras -- the vision, purpose, and driving force behind Project Medha. &quot;Education transforms when technology empowers the people who teach.&quot;"
            className="block w-full"
          />
        </figure>

        {/* ---- the same story again, as real text: readable, accessible,
            and in the site's own type system ---- */}
        <section className="mt-14">
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-terracotta">
            Person Behind the Idea
          </p>
          <h1 className="mt-3 font-heading text-4xl font-semibold leading-tight text-ink sm:text-5xl">
            Aditya Prabhakar
          </h1>

          <div className="mt-4 flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-terracotta px-3 py-1 text-[11px] font-bold uppercase tracking-wide text-ivory">
              <GraduationCap className="size-3.5" aria-hidden />
              IIT Madras
            </span>
            <span className="text-sm font-medium text-ink/70">
              The vision, purpose, and driving force behind Project Medha.
            </span>
          </div>

          <blockquote className="mt-8 flex gap-3 rounded-2xl border border-gold/40 bg-gold/10 p-5 sm:p-6">
            <Quote className="mt-1 size-6 shrink-0 text-gold" aria-hidden />
            <p className="font-heading text-xl italic leading-snug text-ink sm:text-2xl">
              Education transforms when technology empowers the people who teach.
            </p>
          </blockquote>

          <div className="mt-10 grid gap-10 sm:grid-cols-[1fr_1px_1fr]">
            <div className="space-y-4 text-base leading-relaxed text-ink/80 sm:text-lg">
              <p>
                <strong className="text-ink">Aditya Prabhakar</strong>, a student of{" "}
                <strong className="text-ink">IIT Madras</strong>, envisioned{" "}
                <strong className="text-ink">Project Medha</strong> with the belief that
                technology can empower teachers and transform the way students learn.
              </p>
            </div>
            <div className="hidden bg-hairline sm:block" aria-hidden />
            <div className="space-y-4 text-base leading-relaxed text-ink/80 sm:text-lg">
              <p>
                Driven by a passion for{" "}
                <strong className="text-ink">education, innovation, and technology</strong>,
                he aims to build a solution that connects teachers, students, and school
                administration through an intelligent, accessible platform.
              </p>
            </div>
          </div>
        </section>

        <section className="mt-12 rounded-3xl border border-hairline bg-parchment p-6 sm:p-10">
          <h2 className="text-xs font-bold uppercase tracking-[0.2em] text-terracotta">
            His Vision
          </h2>
          <p className="mt-3 font-heading text-2xl font-medium italic text-ink sm:text-3xl">
            Empower Teachers, Improve Learning &amp; Transform Bihar
          </p>

          <div className="mt-6 grid gap-3 sm:grid-cols-3">
            {VISION_PILLARS.map(({ icon: Icon, label }) => (
              <div
                key={label}
                className="flex items-center gap-3 rounded-xl border border-hairline bg-ivory px-4 py-3.5"
              >
                <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-terracotta/10 text-terracotta">
                  <Icon className="size-4.5" aria-hidden />
                </span>
                <span className="font-heading text-base font-medium text-ink">{label}</span>
              </div>
            ))}
          </div>
        </section>

        <div className="mt-12 flex justify-center">
          <Link
            href="/"
            className="inline-flex items-center gap-2 rounded-full bg-terracotta px-6 py-3 text-sm font-semibold text-ivory shadow-sm transition-transform hover:scale-[1.02]"
          >
            Explore Medha
          </Link>
        </div>
      </div>
    </main>
  );
}
