/* eslint-disable @next/next/no-img-element -- full-bleed background image; bare <img> is simplest here */
import { Reveal } from "./reveal";

export function SunSection() {
  return (
    <section className="relative">
      <div className="relative h-[70vh] min-h-[26rem] w-full overflow-hidden">
        <img
          src="/landing/sunrise.jpg"
          alt="Sunrise over the river plains of Bihar"
          width={1600}
          height={912}
          loading="lazy"
          className="absolute inset-0 size-full object-cover"
        />
        <div
          aria-hidden="true"
          className="absolute inset-0"
          style={{
            background:
              "linear-gradient(to bottom, oklch(0.2 0.02 55 / 0.28), oklch(0.2 0.02 55 / 0.05) 45%, var(--ivory) 100%)",
          }}
        />
        <div className="relative mx-auto flex h-full w-full max-w-6xl items-center px-6 sm:px-8">
          <Reveal className="max-w-2xl">
            <h2 className="display text-[clamp(2rem,5vw,4rem)] text-background drop-shadow-sm">
              Every learner deserves
              <br />a chance to rise.
            </h2>
            <p className="mt-6 max-w-md text-base leading-relaxed text-background/85">
              Like the first light of morning, every lesson can open a new possibility.
            </p>
          </Reveal>
        </div>
      </div>
    </section>
  );
}
