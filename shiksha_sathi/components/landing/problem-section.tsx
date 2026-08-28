/* eslint-disable @next/next/no-img-element -- editorial art; bare <img> keeps the aspect-ratio crop simple */
import { Reveal } from "./reveal";
import { Eyebrow } from "./section";

const pillars = [
  { title: "Knowledge exists", body: "The curriculum, the content and the standards are in place." },
  {
    title: "Teachers are capable",
    body: "What they need is time, ideas and support — not instruction.",
  },
  {
    title: "Students are curious",
    body: "Curiosity is never the missing part. It only needs an opening.",
  },
];

export function ProblemSection() {
  return (
    <section className="px-6 py-24 sm:px-8 md:py-36">
      <div className="mx-auto w-full max-w-6xl">
        <div className="grid gap-14 md:grid-cols-12 md:gap-16">
          <Reveal className="md:col-span-6">
            <Eyebrow>The opportunity</Eyebrow>
            <h2 className="display mt-6 text-[clamp(2rem,4.2vw,3.25rem)]">
              The challenge is not a lack of ambition.
            </h2>
            <p className="mt-8 max-w-lg text-lg leading-relaxed text-muted-foreground">
              It is giving every teacher the tools to turn knowledge into curiosity — reliably, in
              every classroom, on an ordinary Tuesday morning.
            </p>
          </Reveal>

          <Reveal className="md:col-span-5 md:col-start-8" delay={100}>
            <img
              src="/landing/classroom.jpg"
              alt="A teacher explaining a lesson at the blackboard to attentive students"
              width={1408}
              height={1008}
              loading="lazy"
              className="aspect-[4/3] w-full object-cover"
            />
          </Reveal>
        </div>

        <div className="mt-20 grid gap-px overflow-hidden border border-border bg-border md:mt-28 md:grid-cols-3">
          {pillars.map((p, i) => (
            <Reveal key={p.title} delay={i * 90} className="bg-background p-8 md:p-10">
              <span className="eyebrow text-muted-foreground">
                {String(i + 1).padStart(2, "0")}
              </span>
              <h3 className="display mt-5 text-2xl">{p.title}</h3>
              <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{p.body}</p>
            </Reveal>
          ))}
        </div>

        <Reveal className="mt-14 md:mt-20">
          <p className="display max-w-3xl text-[clamp(1.5rem,3vw,2.25rem)] text-foreground">
            Classrooms simply need better tools to connect all three.
          </p>
        </Reveal>
      </div>
    </section>
  );
}
