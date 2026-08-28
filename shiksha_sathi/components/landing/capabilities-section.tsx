import { Reveal } from "./reveal";
import { Eyebrow } from "./section";

const capabilities = [
  { title: "Teach better", body: "Generate practical teaching strategies for a real class." },
  { title: "Make it interactive", body: "Create activities, games and classroom discussions." },
  { title: "Explain simply", body: "Turn difficult concepts into clear, everyday explanations." },
  { title: "Create instantly", body: "Presentations, worksheets, quizzes and visual material." },
  { title: "Personalize learning", body: "Adapt explanations and practice to different learners." },
  { title: "Speak naturally", body: "Ask Medha out loud, in the middle of a busy day." },
];

export function CapabilitiesSection() {
  return (
    <section className="bg-secondary px-6 py-24 sm:px-8 md:py-36">
      <div className="mx-auto w-full max-w-6xl">
        <Reveal className="max-w-2xl">
          <Eyebrow>Capabilities</Eyebrow>
          <h2 className="display mt-6 text-[clamp(2rem,4.2vw,3.25rem)]">
            What Medha can do, in plain words.
          </h2>
        </Reveal>

        <div className="mt-14 grid gap-px border border-border bg-border sm:grid-cols-2 lg:grid-cols-3">
          {capabilities.map((c, i) => (
            <Reveal key={c.title} delay={(i % 3) * 80} className="bg-secondary p-8 md:p-10">
              <span className="block h-px w-8 bg-terracotta" />
              <h3 className="display mt-6 text-xl">{c.title}</h3>
              <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{c.body}</p>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
