import Link from "next/link";
import { Container } from "./primitives/Container";
import { SectionHeader } from "./primitives/SectionHeader";

const audiences = [
  {
    audience: "Parents",
    href: "/for-parents",
    headline: "Personalized support your child actually needs",
    blurb:
      "See where your child is, what's next, and how learning is being adapted — in plain language, without jargon.",
    cta: "Explore for parents",
    gradient: "bg-iw-primary",
  },
  {
    audience: "Schools",
    href: "/for-schools",
    headline: "Classroom visibility with safe deployment",
    blurb:
      "Teacher dashboards, roster support, and progress views designed for everyday classroom workflow.",
    cta: "Explore for schools",
    gradient: "bg-iw-accent",
  },
  {
    audience: "Districts",
    href: "/for-districts",
    headline: "Scalable, privacy-aware personalized learning",
    blurb:
      "Designed for FERPA/COPPA-aware workflows with rostering readiness and procurement transparency.",
    cta: "Explore for districts",
    gradient: "bg-iw-accent",
  },
];

export function AudienceSelector() {
  return (
    <section className="py-20 sm:py-24 bg-iw-raised/50" aria-labelledby="audience-heading">
      <Container>
        <SectionHeader
          eyebrow="Built for everyone who supports the learner"
          title={<span id="audience-heading">Find your path</span>}
          subtitle="AIVO Learning adapts to parents, schools, and districts with role-specific tools and views."
        />
        <div className="mt-12 grid gap-6 md:grid-cols-3">
          {audiences.map((c) => (
            <Link
              key={c.audience}
              href={c.href}
              className="group relative flex flex-col rounded-iw-card border border-iw-border bg-white p-6 shadow-soft-1 transition hover:-translate-y-1 hover:shadow-soft-5 hover:border-iw-purple-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-iw-ring"
            >
              <span
                className={`inline-flex w-fit rounded-iw-chip ${c.gradient} px-3 py-1 text-xs font-semibold text-white shadow-soft-1`}
              >
                {c.audience}
              </span>
              <h3 className="mt-4 font-heading text-xl font-bold text-iw-ink">{c.headline}</h3>
              <p className="mt-2 flex-1 text-iw-ink-muted">{c.blurb}</p>
              <span className="mt-6 inline-flex items-center gap-1 font-semibold text-iw-primary transition-all group-hover:gap-2">
                {c.cta} <span aria-hidden>→</span>
              </span>
            </Link>
          ))}
        </div>
      </Container>
    </section>
  );
}
