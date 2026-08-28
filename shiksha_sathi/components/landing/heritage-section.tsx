import { Reveal } from "./reveal";
import { Section, Eyebrow } from "./section";

export function HeritageSection() {
  return (
    <Section id="heritage" className="py-28 md:py-36">
      <div className="grid gap-12 md:grid-cols-12 md:gap-16">
        <Reveal className="md:col-span-4">
          <Eyebrow>Chapter One</Eyebrow>
          <h2 className="display mt-6 text-[clamp(2rem,4vw,3rem)]">
            Bihar has always been a place of learning.
          </h2>
        </Reveal>

        <div className="md:col-span-7 md:col-start-6">
          <Reveal delay={80}>
            <p className="text-xl leading-relaxed text-foreground sm:text-2xl">
              For centuries, Bihar was home to seekers, scholars and ideas that travelled far beyond
              its borders.
            </p>
          </Reveal>
          <Reveal delay={160}>
            <p className="mt-8 max-w-xl leading-relaxed text-muted-foreground">
              Students crossed mountains and seas to study here. Teachers spent their lives turning
              questions into understanding. Long before the word existed, this was a place that
              treated education as infrastructure.
            </p>
          </Reveal>
          <Reveal delay={240}>
            <p className="mt-10 border-l border-terracotta pl-6 text-lg leading-relaxed text-foreground">
              That spirit of learning deserves a future built for every classroom.
            </p>
          </Reveal>
        </div>
      </div>
    </Section>
  );
}
