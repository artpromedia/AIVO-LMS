import { useId } from "react";
import { ArrowRight } from "lucide-react";
import { JsonLd } from "@/components/seo/JsonLd";

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
      <JsonLd data={faqJsonLd} />
      <h2
        id={headingId}
        className="text-2xl md:text-3xl font-heading font-bold text-iw-ink mb-6"
      >
        {heading}
      </h2>
      <div className="space-y-3">
        {items.map((f) => (
          <details
            key={f.q}
            className="group rounded-iw-card border border-iw-border bg-white p-5 open:border-iw-purple-200 open:shadow-soft-3 transition"
          >
            <summary className="cursor-pointer font-heading font-bold text-iw-ink flex items-center justify-between gap-4">
              <span>{f.q}</span>
              <ArrowRight
                className="w-4 h-4 text-iw-ink-muted group-open:rotate-90 transition-transform"
                aria-hidden="true"
              />
            </summary>
            <p className="text-iw-ink-muted font-body mt-3 leading-relaxed text-sm">{f.a}</p>
          </details>
        ))}
      </div>
    </section>
  );
}
