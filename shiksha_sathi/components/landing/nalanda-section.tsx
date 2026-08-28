/* eslint-disable @next/next/no-img-element -- editorial full-bleed art; bare <img> keeps the aspect-ratio crop simple */
import { Reveal } from "./reveal";
import { Eyebrow } from "./section";

export function NalandaSection() {
  return (
    <section className="bg-secondary px-6 py-24 sm:px-8 md:py-32">
      <div className="mx-auto w-full max-w-6xl">
        <Reveal className="max-w-2xl">
          <Eyebrow>Nalanda</Eyebrow>
          <h2 className="display mt-6 text-[clamp(2.25rem,5vw,4rem)]">
            A legacy of learning
            <br />
            that crossed borders.
          </h2>
        </Reveal>
      </div>

      <Reveal className="mt-14 md:mt-20" delay={100}>
        <figure className="mx-auto w-full max-w-[110rem]">
          <img
            src="/landing/nalanda.jpg"
            alt="The ancient brick ruins of Nalanda University in Bihar at golden hour"
            width={1600}
            height={1008}
            loading="lazy"
            className="aspect-[16/10] w-full object-cover md:aspect-[21/9]"
          />
          <figcaption className="mx-auto mt-4 max-w-6xl text-xs tracking-wide text-muted-foreground">
            The ruins of Nalanda, Bihar — one of the world&apos;s earliest residential universities.
          </figcaption>
        </figure>
      </Reveal>

      <div className="mx-auto mt-14 grid w-full max-w-6xl gap-10 md:mt-20 md:grid-cols-2 md:gap-20">
        <Reveal>
          <p className="text-lg leading-relaxed text-foreground">
            Centuries ago, learners travelled to Bihar in search of knowledge. Distance was the only
            thing standing between a curious mind and a great teacher.
          </p>
        </Reveal>
        <Reveal delay={100}>
          <p className="text-lg leading-relaxed text-muted-foreground">
            Today, that distance can close. The tools for better teaching and better learning can
            reach every classroom in the state — not as a privilege, but as a standard.
          </p>
        </Reveal>
      </div>
    </section>
  );
}
