import { useId } from "react";

export function PainPointsGrid({
  heading,
  subheading,
  points,
}: {
  heading: string;
  subheading?: string;
  points: string[];
}) {
  const headingId = useId();
  return (
    <section className="mb-14" aria-labelledby={headingId}>
      <h2
        id={headingId}
        className="text-2xl md:text-3xl font-heading font-bold text-iw-ink mb-3"
      >
        {heading}
      </h2>
      {subheading && <p className="text-iw-ink-muted font-body mb-6 leading-relaxed">{subheading}</p>}
      <ul className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {points.map((p) => (
          <li
            key={p}
            className="rounded-iw-card border border-iw-border bg-iw-raised/60 p-5 text-iw-ink font-body"
          >
            <span
              className="block text-iw-primary font-heading text-lg leading-none mb-2"
              aria-hidden
            >
              &ldquo;
            </span>
            <span className="leading-relaxed">{p}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
