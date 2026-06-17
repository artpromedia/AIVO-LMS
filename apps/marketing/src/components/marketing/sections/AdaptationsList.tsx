import { useId } from "react";
import { CheckCircle2 } from "lucide-react";

export function AdaptationsList({
  heading,
  subheading,
  items,
}: {
  heading: string;
  subheading?: string;
  items: { title: string; body?: string }[];
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
        {items.map((it) => (
          <li
            key={it.title}
            className="flex gap-3 rounded-iw-card border border-iw-border bg-white p-4"
          >
            <CheckCircle2 className="w-5 h-5 text-iw-success mt-0.5 shrink-0" aria-hidden="true" />
            <div>
              <p className="font-heading font-bold text-iw-ink text-sm">{it.title}</p>
              {it.body && (
                <p className="mt-1 text-sm text-iw-ink-muted font-body leading-relaxed">{it.body}</p>
              )}
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
