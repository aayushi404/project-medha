import { Reveal } from "./reveal";
import { Eyebrow } from "./section";

const chain = [
  "Better prepared teachers",
  "More engaging classrooms",
  "More curious students",
  "Stronger learning outcomes",
  "A stronger education system",
];

export function ImpactSection() {
  return (
    <section className="bg-secondary px-6 py-24 sm:px-8 md:py-36">
      <div className="mx-auto grid w-full max-w-6xl gap-14 md:grid-cols-12 md:gap-16">
        <Reveal className="md:col-span-5">
          <Eyebrow>Intended impact</Eyebrow>
          <h2 className="display mt-6 text-[clamp(2rem,4vw,3rem)]">
            Small changes in a classroom can create a larger change in learning.
          </h2>
          <p className="mt-8 max-w-md leading-relaxed text-muted-foreground">
            Improvement in education is rarely dramatic. It compounds, one well-taught lesson at a
            time.
          </p>
        </Reveal>

        <ol className="md:col-span-6 md:col-start-7">
          {chain.map((c, i) => (
            <Reveal
              as="li"
              key={c}
              delay={i * 90}
              className="flex items-center gap-6 border-b border-border py-6"
            >
              <span className="eyebrow w-8 shrink-0 text-muted-foreground">
                {String(i + 1).padStart(2, "0")}
              </span>
              <span className="display text-[clamp(1.2rem,2.2vw,1.6rem)] text-foreground">{c}</span>
            </Reveal>
          ))}
        </ol>
      </div>
    </section>
  );
}
