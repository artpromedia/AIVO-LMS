import { Container } from "./primitives/Container";
import { SectionHeader } from "./primitives/SectionHeader";

const steps = [
  { n: 1, title: "Create learner profile", body: "Add your child or class roster in minutes." },
  {
    n: 2,
    title: "Parent assessment",
    body: "Quick context on strengths, interests, and challenges.",
  },
  { n: 3, title: "Optional IEP context", body: "Add accommodation context if it exists." },
  {
    n: 4,
    title: "Personalized baseline",
    body: "A calm adaptive baseline — not a high-stakes test.",
  },
  { n: 5, title: "Today's Mission", body: "One clear next-best learning action, every day." },
  {
    n: 6,
    title: "LessonRuns",
    body: "Tutor-guided lessons with hints, scaffolds, and read-aloud.",
  },
  { n: 7, title: "Plain-language progress", body: "Clear summaries for parents and teachers." },
];

export function CoreProductLoop() {
  return (
    <section className="py-20 sm:py-24" aria-labelledby="loop-heading">
      <Container>
        <SectionHeader
          eyebrow="The AIVO Loop"
          title={<span id="loop-heading">Seven steps from setup to mastery</span>}
          subtitle="Every learner moves through the same calm, transparent flow — adapted to their pace and needs."
        />
        <ol className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {steps.map((s) => (
            <li
              key={s.n}
              className="relative rounded-iw-card border border-iw-border bg-white p-5 shadow-soft-1 transition hover:shadow-soft-3"
            >
              <span className="inline-flex h-9 w-9 items-center justify-center rounded-iw-chip bg-iw-primary font-heading font-bold text-white">
                {s.n}
              </span>
              <h3 className="mt-3 font-heading text-base font-bold text-iw-ink">{s.title}</h3>
              <p className="mt-1 text-sm text-iw-ink-muted">{s.body}</p>
            </li>
          ))}
        </ol>
      </Container>
    </section>
  );
}
