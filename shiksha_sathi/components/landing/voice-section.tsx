import { Reveal } from "./reveal";
import { Eyebrow } from "./section";

const bars = [8, 16, 28, 40, 26, 34, 18, 10, 22, 36, 14, 8, 20, 30, 12];

export function VoiceSection() {
  return (
    <section className="grain relative overflow-hidden bg-foreground px-6 py-28 text-background sm:px-8 md:py-40">
      <div
        aria-hidden="true"
        className="breathe pointer-events-none absolute top-1/2 -right-40 size-[36rem] -translate-y-1/2 rounded-full blur-3xl"
        style={{
          background:
            "radial-gradient(circle, color-mix(in oklab, var(--gold) 30%, transparent), transparent 65%)",
        }}
      />
      <div className="relative mx-auto grid w-full max-w-6xl gap-14 md:grid-cols-12 md:gap-16">
        <Reveal className="md:col-span-5">
          <Eyebrow className="text-background/55">Voice</Eyebrow>
          <h2 className="display mt-6 text-[clamp(2rem,4vw,3rem)]">
            Sometimes the easiest way to learn is to simply ask.
          </h2>
          <p className="mt-8 max-w-md leading-relaxed text-background/65">
            Between two periods, with chalk still in hand, a teacher can talk to Medha the way they
            would talk to a colleague.
          </p>
        </Reveal>

        <Reveal className="md:col-span-6 md:col-start-7" delay={100}>
          <div className="border border-background/15 p-8 sm:p-10">
            <div aria-hidden="true" className="flex h-10 items-end gap-1">
              {bars.map((h, i) => (
                <span key={i} className="w-1 bg-gold/70" style={{ height: `${h}px` }} />
              ))}
            </div>

            <div className="mt-10 space-y-8">
              <div>
                <p className="eyebrow text-background/50">Teacher</p>
                <p className="mt-2 text-lg leading-relaxed">
                  &ldquo;How should I explain this concept to my class?&rdquo;
                </p>
              </div>
              <div className="border-l border-gold pl-6">
                <p className="eyebrow text-background/50">Medha</p>
                <p className="mt-2 text-lg leading-relaxed text-background/85">
                  &ldquo;Let&apos;s make it simple. Start with a question your students already know
                  from everyday life, then connect it back to the chapter.&rdquo;
                </p>
              </div>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
