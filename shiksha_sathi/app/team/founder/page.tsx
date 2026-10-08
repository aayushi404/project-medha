import type { Metadata } from "next";
import Link from "next/link";
import { Quote } from "lucide-react";

const title = "Aditya Prabhakar — Founder, Medha";
const description =
  "Aditya Prabhakar, a student of IIT Madras, envisioned Project Medha with the belief that technology can empower teachers and transform the way students learn.";

export const metadata: Metadata = {
  title,
  description,
  openGraph: { title, description, type: "profile" },
  twitter: { card: "summary_large_image", title, description },
};

/**
 * Public "person behind the idea" page -- no sign-in required, same spirit as
 * /privacy and /delete-account. Content and photo are lifted from the
 * founder's own "Person Behind the Idea" poster; the photo here is a cropped
 * headshot cut from that poster (public/team/aditya-prabhakar.jpg).
 */
export default function FounderPage() {
  return (
    <main className="medha-landing min-h-dvh bg-ivory text-ink">
      <div className="mx-auto w-full max-w-4xl px-4 py-10 sm:py-16">
        <Link href="/" className="text-sm text-ink/60 transition-colors hover:text-ink">
          ← Medha
        </Link>

        <div className="mt-8 grid items-start gap-10 sm:grid-cols-[1.1fr_0.9fr] sm:gap-14">
          {/* Text column */}
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-terracotta">
              Person Behind the Idea
            </p>
            <h1 className="mt-3 font-heading text-4xl font-semibold leading-tight text-ink sm:text-5xl">
              Aditya Prabhakar
            </h1>

            <div className="mt-4 flex flex-wrap items-center gap-2">
              <span className="rounded-full bg-terracotta px-3 py-1 text-[11px] font-bold uppercase tracking-wide text-ivory">
                IIT Madras
              </span>
              <span className="text-sm font-medium text-ink/70">
                The vision, purpose, and driving force behind Project Medha.
              </span>
            </div>

            <blockquote className="mt-6 flex gap-3 border-l-2 border-gold pl-4">
              <Quote className="mt-0.5 size-5 shrink-0 text-gold" aria-hidden />
              <p className="font-heading text-lg italic leading-snug text-ink">
                Education transforms when technology empowers the people who teach.
              </p>
            </blockquote>
          </div>

          {/* Photo column */}
          <div className="relative mx-auto w-full max-w-[320px] sm:mx-0">
            <div
              aria-hidden
              className="absolute -right-3 -top-3 size-full rounded-2xl bg-gold/30"
            />
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/team/aditya-prabhakar.jpg"
              alt="Aditya Prabhakar, founder of Project Medha"
              width={330}
              height={420}
              className="relative w-full rounded-2xl border border-hairline object-cover shadow-md"
            />
          </div>
        </div>

        <section className="mt-10 space-y-4 text-base leading-relaxed text-ink/80">
          <p>
            <strong className="text-ink">Aditya Prabhakar</strong>, a student of{" "}
            <strong className="text-ink">IIT Madras</strong>, envisioned{" "}
            <strong className="text-ink">Project Medha</strong> with the belief that
            technology can empower teachers and transform the way students learn.
          </p>
          <p>
            Driven by a passion for{" "}
            <strong className="text-ink">education, innovation, and technology</strong>,
            he aims to build a solution that connects teachers, students, and school
            administration through an intelligent, accessible platform.
          </p>
        </section>

        <section className="mt-10 rounded-2xl border border-hairline bg-parchment p-6 sm:p-8">
          <h2 className="text-xs font-bold uppercase tracking-[0.2em] text-terracotta">
            His Vision
          </h2>
          <p className="mt-2 font-heading text-xl font-medium italic text-ink sm:text-2xl">
            Empower Teachers, Improve Learning &amp; Transform Bihar
          </p>
        </section>
      </div>
    </main>
  );
}
