import { useId } from "react";

export function NumberedSteps({
  heading,
  subheading,
  steps,
  columns = 2,
}: {
  heading: string;
  subheading?: string;
  steps: { title: string; body: string }[];
  columns?: 2 | 3;
}) {
  const cols = columns === 3 ? "sm:grid-cols-3" : "sm:grid-cols-2";
  const headingId = useId();
  return (
    <section className="mb-14" aria-labelledby={headingId}>
      <h2
        id={headingId}
        className="text-2xl md:text-3xl font-heading font-bold text-slate-900 mb-3"
      >
        {heading}
      </h2>
      {subheading && <p className="text-slate-600 font-body mb-6 leading-relaxed">{subheading}</p>}
      <ol className={`grid grid-cols-1 ${cols} gap-4`}>
        {steps.map((s, i) => (
          <li key={s.title} className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
            <span className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-purple-600 to-blue-600 font-heading font-bold text-white">
              {i + 1}
            </span>
            <h3 className="mt-3 font-heading text-base font-bold text-slate-900">{s.title}</h3>
            <p className="mt-1 text-sm text-slate-600 font-body">{s.body}</p>
          </li>
        ))}
      </ol>
    </section>
  );
}
