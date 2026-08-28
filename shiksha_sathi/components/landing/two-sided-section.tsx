import { Reveal } from "./reveal";

const teacher = {
  label: "For Teachers",
  title: "Teach with confidence.",
  items: [
    "Lesson planning",
    "Classroom activities",
    "Interactive questions",
    "Presentations & worksheets",
    "Teaching strategies",
  ],
};

const student = {
  label: "For Students",
  title: "Learn with curiosity.",
  items: [
    "Better study habits",
    "Concept explanations",
    "Personalized guidance",
    "Practice & revision",
    "Everyday learning support",
  ],
};

function Column({ data, align }: { data: typeof teacher; align: "left" | "right" }) {
  return (
    <div className={align === "right" ? "md:pl-16" : "md:pr-16"}>
      <Reveal>
        <p className="eyebrow text-muted-foreground">{data.label}</p>
        <h3 className="display mt-6 text-[clamp(1.9rem,3.4vw,2.75rem)]">{data.title}</h3>
      </Reveal>
      <ul className="mt-10">
        {data.items.map((item, i) => (
          <Reveal
            as="li"
            key={item}
            delay={i * 70}
            className="flex items-baseline justify-between border-b border-border py-4"
          >
            <span className="text-base text-foreground">{item}</span>
            <span className="eyebrow text-muted-foreground">
              {String(i + 1).padStart(2, "0")}
            </span>
          </Reveal>
        ))}
      </ul>
    </div>
  );
}

export function TwoSidedSection() {
  return (
    <section className="bg-secondary px-6 py-24 sm:px-8 md:py-36">
      <div className="mx-auto w-full max-w-6xl">
        <Reveal className="mx-auto max-w-2xl text-center">
          <h2 className="display text-[clamp(2rem,4.2vw,3.25rem)]">
            One companion. Two kinds of people.
          </h2>
        </Reveal>

        <div className="mt-16 grid gap-16 md:mt-24 md:grid-cols-2 md:gap-0 md:divide-x md:divide-border">
          <Column data={teacher} align="left" />
          <Column data={student} align="right" />
        </div>
      </div>
    </section>
  );
}
