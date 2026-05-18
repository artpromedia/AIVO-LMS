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
        className="text-2xl md:text-3xl font-heading font-bold text-slate-900 mb-3"
      >
        {heading}
      </h2>
      {subheading && <p className="text-slate-600 font-body mb-6 leading-relaxed">{subheading}</p>}
      <div className="grid gap-4 md:grid-cols-2">
        <div className="rounded-2xl border border-purple-100 bg-gradient-to-br from-purple-50/80 to-white p-5">
          <p className="text-xs font-bold uppercase tracking-wider text-purple-700">Parent view</p>
          <h3 className="mt-1 font-heading text-lg font-bold text-slate-900">{parent.title}</h3>
          <ul className="mt-3 space-y-2 text-sm text-slate-700 font-body">
            {parent.items.map((p) => (
              <li key={p} className="flex gap-2">
                <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-purple-600" />
                {p}
              </li>
            ))}
          </ul>
        </div>
        <div className="rounded-2xl border border-blue-100 bg-gradient-to-br from-blue-50/80 to-white p-5">
          <p className="text-xs font-bold uppercase tracking-wider text-blue-700">Learner view</p>
          <h3 className="mt-1 font-heading text-lg font-bold text-slate-900">{learner.title}</h3>
          <ul className="mt-3 space-y-2 text-sm text-slate-700 font-body">
            {learner.items.map((l) => (
              <li key={l} className="flex gap-2">
                <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-blue-600" />
                {l}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}
