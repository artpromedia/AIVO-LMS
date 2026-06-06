import { LandingPageLayout } from "@/components/marketing/LandingPageLayout";
import { JsonLd } from "@/components/seo/JsonLd";
import type { Audience } from "@/lib/landing-content";
import { SITE_URL } from "@/lib/constants";
import Link from "next/link";
import { CheckCircle2, ArrowRight } from "lucide-react";

export function AudiencePage({ audience }: { audience: Audience }) {
  const faqJsonLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: audience.faqs.map((f) => ({
      "@type": "Question",
      name: f.q,
      acceptedAnswer: { "@type": "Answer", text: f.a },
    })),
  };

  return (
    <LandingPageLayout
      badge={audience.badge}
      badgeColor={audience.badgeColor}
      title={audience.title}
      subtitle={audience.subtitle}
      breadcrumbs={[
        { name: "Home", href: "/" },
        { name: audience.badge, href: `/${audience.slug}` },
      ]}
    >
      <JsonLd data={faqJsonLd} />

      <section className="mb-14" aria-labelledby="benefits-heading">
        <h2
          id="benefits-heading"
          className="text-2xl md:text-3xl font-heading font-bold text-slate-900 mb-6"
        >
          What you get with AIVO
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
          {audience.benefits.map((b) => (
            <div
              key={b.title}
              className="rounded-2xl border border-slate-100 bg-white p-6 hover:border-purple-200 hover:shadow-md transition"
            >
              <h3 className="font-heading font-bold text-slate-900 mb-2">{b.title}</h3>
              <p className="text-slate-600 font-body text-sm leading-relaxed">{b.desc}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="mb-14" aria-labelledby="outcomes-heading">
        <h2
          id="outcomes-heading"
          className="text-2xl md:text-3xl font-heading font-bold text-slate-900 mb-6"
        >
          Outcomes you can expect
        </h2>
        <ul className="space-y-3">
          {audience.outcomes.map((o) => (
            <li key={o} className="flex items-start gap-3 text-slate-700 font-body">
              <CheckCircle2
                className="w-5 h-5 text-emerald-500 mt-0.5 shrink-0"
                aria-hidden="true"
              />
              <span>{o}</span>
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="faq-heading" className="mb-4">
        <h2
          id="faq-heading"
          className="text-2xl md:text-3xl font-heading font-bold text-slate-900 mb-6"
        >
          Frequently asked questions
        </h2>
        <div className="space-y-3">
          {audience.faqs.map((f) => (
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

      <section aria-labelledby="related-heading" className="mt-14 pt-8 border-t border-slate-100">
        <h2 id="related-heading" className="text-xl font-heading font-bold text-slate-900 mb-4">
          Keep exploring
        </h2>
        <div className="flex flex-wrap gap-3">
          <Link
            href="/tutors"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-slate-100 text-slate-700 font-bold text-sm hover:bg-slate-200 transition"
          >
            Meet the 14 tutors
          </Link>
          <Link
            href="/levels"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-slate-100 text-slate-700 font-bold text-sm hover:bg-slate-200 transition"
          >
            See the 5 functioning levels
          </Link>
          <Link
            href="/#pricing"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-slate-100 text-slate-700 font-bold text-sm hover:bg-slate-200 transition"
          >
            Pricing
          </Link>
          <Link
            href="/compare/aivo-vs-ixl"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-slate-100 text-slate-700 font-bold text-sm hover:bg-slate-200 transition"
          >
            AIVO vs IXL
          </Link>
        </div>
      </section>
    </LandingPageLayout>
  );
}

export function audienceMetadata(audience: Audience) {
  const url = `${SITE_URL}/${audience.slug}`;
  return {
    title: audience.metaTitle,
    description: audience.metaDescription,
    openGraph: {
      title: audience.metaTitle,
      description: audience.metaDescription,
      url,
      type: "website",
    },
    twitter: {
      card: "summary_large_image" as const,
      title: audience.metaTitle,
      description: audience.metaDescription,
    },
    alternates: { canonical: url },
  };
}
