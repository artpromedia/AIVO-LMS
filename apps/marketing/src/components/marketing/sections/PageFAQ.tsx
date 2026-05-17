import { useId } from "react";
import { ArrowRight } from "lucide-react";

export function PageFAQ({
  heading = "Frequently asked questions",
  items,
}: {
  heading?: string;
  items: { q: string; a: string }[];
}) {
  const headingId = useId();
  const faqJsonLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: items.map((f) => ({
      "@type": "Question",
      name: f.q,
      acceptedAnswer: { "@type": "Answer", text: f.a },
    })),
  };

  return (
    <section className="mb-14" aria-labelledby={headingId}>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }}
      />
      <h2
        id={headingId}
        className="text-2xl md:text-3xl font-heading font-bold text-slate-900 mb-6"
      >
        {heading}
      </h2>
      <div className="space-y-3">
        {items.map((f) => (
          <details
            key={f.q}
            className="group rounded-2xl border border-slate-100 bg-white p-5 open:border-purple-200 open:shadow-md transition"
          >
            <summary className="cursor-pointer font-heading font-bold text-slate-900 flex items-center justify-between gap-4">
              <span>{f.q}</span>
              <ArrowRight
                className="w-4 h-4 text-slate-400 group-open:rotate-90 transition-transform"
                aria-hidden="true"
              />
            </summary>
            <p className="text-slate-600 font-body mt-3 leading-relaxed text-sm">{f.a}</p>
          </details>
        ))}
      </div>
    </section>
  );
}
