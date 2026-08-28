/* eslint-disable @next/next/no-img-element -- editorial art; bare <img> keeps the aspect-ratio crop simple */
import { Reveal } from "./reveal";
import { Eyebrow } from "./section";

const exchange = [
  { who: "Student", text: "I read the chapter but I still don't understand it." },
  {
    who: "Medha",
    text: "Let's start with what you do understand. Tell me one line from the chapter that made sense to you.",
  },
  { who: "Student", text: "That light travels in a straight line." },
  {
    who: "Medha",
    text: "Good. Everything else in the chapter follows from that one idea. Let's build on it, one step at a time.",
  },
];

const habits = ["Understand a concept", "Plan the week's study", "Practise", "Revise before a test"];

export function StudentSection() {
  return (
    <section id="students" className="scroll-mt-20 bg-secondary px-6 py-24 sm:px-8 md:py-36">
      <div className="mx-auto grid w-full max-w-6xl gap-14 md:grid-cols-12 md:gap-16">
        <div className="md:col-span-5">
          <Reveal>
            <Eyebrow>The student experience</Eyebrow>
            <h2 className="display mt-6 text-[clamp(2rem,4vw,3rem)]">
              Help every student learn how to learn.
            </h2>
            <p className="mt-8 leading-relaxed text-muted-foreground">
              Medha never simply hands over the answer. It guides a student towards it — the way a
              patient teacher would, if there were enough hours in the day.
            </p>
          </Reveal>

          <Reveal delay={120} className="mt-10">
            <ul className="flex flex-wrap gap-2">
              {habits.map((h) => (
                <li
                  key={h}
                  className="border border-border px-4 py-2 text-xs tracking-wide text-muted-foreground"
                >
                  {h}
                </li>
              ))}
            </ul>
          </Reveal>

          <Reveal delay={180} className="mt-12">
            <img
              src="/landing/student-hands.jpg"
              alt="A student writing notes in a notebook beside an open textbook"
              width={1408}
              height={1008}
              loading="lazy"
              className="aspect-[4/3] w-full object-cover"
            />
          </Reveal>
        </div>

        <Reveal className="md:col-span-6 md:col-start-7" delay={100}>
          <div className="warm-frame p-6 sm:p-10">
            <ul className="space-y-8">
              {exchange.map((m, i) => (
                <li key={i} className={m.who === "Medha" ? "sm:pl-10" : "sm:pr-10"}>
                  <p className="eyebrow text-muted-foreground">{m.who}</p>
                  <p
                    className={
                      m.who === "Medha"
                        ? "mt-2 border-l border-terracotta pl-5 leading-relaxed text-foreground"
                        : "mt-2 leading-relaxed text-muted-foreground"
                    }
                  >
                    {m.text}
                  </p>
                </li>
              ))}
            </ul>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
