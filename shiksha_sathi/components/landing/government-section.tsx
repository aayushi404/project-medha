import { Reveal } from "./reveal";
import { Eyebrow } from "./section";

export function GovernmentSection() {
  return (
    <section id="partnership" className="scroll-mt-20 px-6 py-24 sm:px-8 md:py-36">
      <div className="mx-auto grid w-full max-w-6xl gap-12 md:grid-cols-12">
        <Reveal className="md:col-span-4">
          <Eyebrow>Partnership</Eyebrow>
        </Reveal>
        <div className="md:col-span-8">
          <Reveal>
            <h2 className="display text-[clamp(2rem,4.4vw,3.5rem)]">
              Built for the classrooms that shape tomorrow.
            </h2>
          </Reveal>
          <Reveal delay={100}>
            <p className="mt-8 max-w-xl text-lg leading-relaxed text-muted-foreground">
              Medha is designed to work alongside teachers, schools and education systems to make
              high-quality teaching support more accessible — as shared infrastructure, not as
              another product a school has to manage.
            </p>
          </Reveal>
          <Reveal delay={180}>
            <a
              href="#get-started"
              className="mt-10 inline-block border border-foreground px-8 py-4 text-sm font-medium transition-colors hover:bg-foreground hover:text-background"
            >
              Explore the vision
            </a>
          </Reveal>
        </div>
      </div>
    </section>
  );
}
