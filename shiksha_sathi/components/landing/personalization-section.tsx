import { Reveal } from "./reveal";
import { Eyebrow } from "./section";

const inputs = ["Class", "Subject", "Topic"];

export function PersonalizationSection() {
  return (
    <section className="px-6 py-24 sm:px-8 md:py-36">
      <div className="mx-auto w-full max-w-6xl">
        <Reveal className="max-w-2xl">
          <Eyebrow>Personalization</Eyebrow>
          <h2 className="display mt-6 text-[clamp(2rem,4.2vw,3.25rem)]">
            The best lesson is not the same for every classroom.
          </h2>
          <p className="mt-8 max-w-lg leading-relaxed text-muted-foreground">
            Medha adapts ideas to the teacher, the topic and the classroom in front of them.
          </p>
        </Reveal>

        <Reveal className="mt-16 md:mt-24" delay={100}>
          <div className="mx-auto max-w-3xl text-center">
            <div className="grid grid-cols-3 gap-px bg-border">
              {inputs.map((label) => (
                <div key={label} className="bg-background px-3 py-6">
                  <p className="eyebrow text-muted-foreground">{label}</p>
                </div>
              ))}
            </div>

            <div aria-hidden="true" className="mx-auto h-14 w-px bg-border" />

            <div className="mx-auto inline-block border border-border px-8 py-5">
              <p className="text-sm text-muted-foreground">Classroom context &amp; resources</p>
            </div>

            <div aria-hidden="true" className="mx-auto h-14 w-px bg-border" />

            <div className="mx-auto inline-block border border-foreground bg-foreground px-10 py-6 text-background">
              <p className="display text-xl tracking-[0.28em] uppercase">Medha</p>
            </div>

            <div aria-hidden="true" className="mx-auto h-14 w-px bg-terracotta" />

            <p className="display text-[clamp(1.5rem,3vw,2.25rem)] text-terracotta">
              A personalized strategy
            </p>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
