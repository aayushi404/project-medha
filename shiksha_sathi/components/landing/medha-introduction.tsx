import { Reveal } from "./reveal";

export function MedhaIntroduction() {
  return (
    <section
      id="medha"
      className="grain scroll-mt-20 bg-foreground px-6 py-28 text-background sm:px-8 md:py-40"
    >
      <div className="mx-auto w-full max-w-4xl text-center">
        <Reveal>
          <p className="eyebrow text-background/55">Chapter Two</p>
        </Reveal>
        <Reveal delay={80}>
          <h2 className="display mt-8 text-[clamp(2.25rem,6vw,4.5rem)]">
            This is where <span className="text-gold italic">Medha</span> begins.
          </h2>
        </Reveal>
        <Reveal delay={160}>
          <p className="mx-auto mt-10 max-w-2xl text-lg leading-relaxed text-background/70">
            Medha is an AI-powered teaching and learning companion, built to make classrooms more
            engaging, more personal and more effective — for the teacher standing at the board and
            the student sitting at the desk.
          </p>
        </Reveal>
        <Reveal delay={240}>
          <p className="mt-12 text-sm tracking-[0.18em] text-gold uppercase">
            Ancient knowledge. Modern intelligence.
          </p>
        </Reveal>
      </div>
    </section>
  );
}
