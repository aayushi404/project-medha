import { Reveal } from "./reveal";
import { Eyebrow } from "./section";

const stages = [
  { step: "A topic", note: "“Photosynthesis, Class VIII.”" },
  { step: "Teaching strategy", note: "Start from a plant on the school windowsill." },
  { step: "Interactive activity", note: "Groups track a leaf in sun and in shade for a week." },
  { step: "Questions", note: "Five questions that move from recall to reasoning." },
  { step: "Visual explanation", note: "One clear diagram a teacher can draw in a minute." },
  { step: "A lesson", note: "Structured, timed and ready for the period." },
  { step: "A more engaging classroom", note: "Students who ask the next question themselves." },
];

export function WorkflowSection() {
  return (
    <section id="workflow" className="scroll-mt-20 px-6 py-24 sm:px-8 md:py-36">
      <div className="mx-auto w-full max-w-6xl">
        <Reveal className="max-w-2xl">
          <Eyebrow>From a topic to a classroom</Eyebrow>
          <h2 className="display mt-6 text-[clamp(2rem,4.2vw,3.25rem)]">
            One line of input. A full lesson in return.
          </h2>
        </Reveal>

        <ol className="mt-16 md:mt-24">
          {stages.map((s, i) => (
            <Reveal
              as="li"
              key={s.step}
              delay={40}
              className="group grid grid-cols-[3rem_1fr] items-baseline gap-x-4 border-t border-border py-7 sm:grid-cols-[5rem_minmax(0,22rem)_1fr] sm:gap-x-8 sm:py-9"
            >
              <span className="eyebrow text-muted-foreground">
                {String(i + 1).padStart(2, "0")}
              </span>
              <h3 className="display text-[clamp(1.35rem,2.6vw,2rem)] text-foreground">{s.step}</h3>
              <p className="col-start-2 mt-2 text-sm leading-relaxed text-muted-foreground sm:col-start-3 sm:mt-0 sm:text-right">
                {s.note}
              </p>
            </Reveal>
          ))}
        </ol>
      </div>
    </section>
  );
}
