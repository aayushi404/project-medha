import { Reveal } from "./reveal";
import { Eyebrow } from "./section";

const outputs = [
  {
    label: "Lesson structure",
    body: "Open with a familiar question → build the idea in three steps → close with a group discussion.",
  },
  {
    label: "Classroom activity",
    body: "Pairs of students measure shadows outside for five minutes, then compare their results.",
  },
  {
    label: "Questions to ask",
    body: "Why does the shadow move? What would change indoors? Who can predict tomorrow at noon?",
  },
  {
    label: "Visual explanation",
    body: "A simple diagram of the sun's path across a school day, ready for the blackboard.",
  },
  {
    label: "Presentation",
    body: "Eight slides with the key idea, the activity, and two revision questions.",
  },
];

export function TeacherSection() {
  return (
    <section id="teachers" className="scroll-mt-20 px-6 py-24 sm:px-8 md:py-36">
      <div className="mx-auto w-full max-w-6xl">
        <Reveal className="max-w-2xl">
          <Eyebrow>The teacher experience</Eyebrow>
          <h2 className="display mt-6 text-[clamp(2rem,4.2vw,3.25rem)]">
            Give every teacher a creative teaching partner.
          </h2>
        </Reveal>

        <Reveal className="mt-14 md:mt-20" delay={80}>
          <div className="warm-frame overflow-hidden">
            <div className="flex items-center gap-3 border-b border-border px-5 py-3.5">
              <span className="display text-xs tracking-[0.3em] uppercase">Medha</span>
              <span className="text-xs text-muted-foreground">Class VII · Science · Shadows</span>
            </div>

            <div className="px-5 py-8 sm:px-10 sm:py-12">
              <p className="eyebrow text-muted-foreground">Teacher</p>
              <p className="mt-3 max-w-2xl text-lg leading-relaxed text-foreground sm:text-xl">
                &ldquo;How can I make this lesson more engaging?&rdquo;
              </p>

              <div className="mt-10 border-t border-border pt-8">
                <p className="eyebrow text-muted-foreground">Medha</p>
                <p className="mt-3 max-w-2xl leading-relaxed text-muted-foreground">
                  Here is a version of the lesson built around something your students already
                  notice every day.
                </p>

                <div className="mt-8 grid gap-px bg-border sm:grid-cols-2">
                  {outputs.map((o, i) => (
                    <Reveal key={o.label} delay={i * 70} className="bg-card p-6">
                      <p className="text-xs font-semibold tracking-[0.14em] text-terracotta uppercase">
                        {o.label}
                      </p>
                      <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{o.body}</p>
                    </Reveal>
                  ))}
                  <div className="hidden bg-card sm:block" />
                </div>
              </div>
            </div>
          </div>
        </Reveal>

        <Reveal className="mt-12" delay={120}>
          <p className="display max-w-2xl text-[clamp(1.35rem,2.4vw,1.875rem)]">
            Medha does not replace teachers. It gives them more possibilities.
          </p>
        </Reveal>
      </div>
    </section>
  );
}
