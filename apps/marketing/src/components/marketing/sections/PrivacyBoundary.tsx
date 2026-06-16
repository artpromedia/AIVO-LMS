import { useId } from "react";

export function PrivacyBoundary({
  heading,
  subheading,
  parent,
  learner,
}: {
  heading: string;
  subheading?: string;
  parent: { title: string; items: string[] };
  learner: { title: string; items: string[] };
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
      <div className="grid gap-4 md:grid-cols-2">
        <div className="rounded-iw-card border border-iw-purple-100 bg-gradient-to-br from-iw-purple-50/80 to-white p-5">
          <p className="text-xs font-bold uppercase tracking-wider text-iw-primary">Parent view</p>
          <h3 className="mt-1 font-heading text-lg font-bold text-iw-ink">{parent.title}</h3>
          <ul className="mt-3 space-y-2 text-sm text-iw-ink font-body">
            {parent.items.map((p) => (
              <li key={p} className="flex gap-2">
                <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-iw-primary" />
                {p}
              </li>
            ))}
          </ul>
        </div>
        <div className="rounded-iw-card border border-iw-teal-100 bg-gradient-to-br from-iw-teal-50/80 to-white p-5">
          <p className="text-xs font-bold uppercase tracking-wider text-iw-teal-700">Learner view</p>
          <h3 className="mt-1 font-heading text-lg font-bold text-iw-ink">{learner.title}</h3>
          <ul className="mt-3 space-y-2 text-sm text-iw-ink font-body">
            {learner.items.map((l) => (
              <li key={l} className="flex gap-2">
                <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-iw-accent" />
                {l}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}
