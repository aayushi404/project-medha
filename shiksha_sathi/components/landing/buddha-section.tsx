/* eslint-disable @next/next/no-img-element -- editorial portrait art; bare <img> keeps the aspect-ratio crop simple */
import { Reveal } from "./reveal";
import { Eyebrow } from "./section";

export function BuddhaSection() {
  return (
    <section className="px-6 py-24 sm:px-8 md:py-36">
      <div className="mx-auto grid w-full max-w-6xl items-center gap-14 md:grid-cols-12 md:gap-20">
        <Reveal className="md:col-span-5">
          <img
            src="/landing/buddha-detail.jpg"
            alt="Close detail of an ancient stone sculpture with lowered, contemplative eyes"
            width={1200}
            height={1408}
            loading="lazy"
            className="aspect-[4/5] w-full object-cover grayscale-[0.15]"
          />
        </Reveal>

        <div className="md:col-span-6 md:col-start-7">
          <Reveal>
            <Eyebrow>Curiosity</Eyebrow>
          </Reveal>
          <Reveal delay={80}>
            <blockquote className="display mt-8 text-[clamp(1.75rem,3.4vw,2.75rem)] text-foreground">
              Education is not only about knowing the answer. It is about learning how to ask better
              questions.
            </blockquote>
          </Reveal>
          <Reveal delay={160}>
            <p className="mt-10 max-w-md leading-relaxed text-muted-foreground">
              The idea that understanding begins with curiosity was shaped in this land. It remains
              the simplest description of what a good classroom does.
            </p>
          </Reveal>
        </div>
      </div>
    </section>
  );
}
