import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { LandingPageLayout } from "@/components/marketing/LandingPageLayout";
import { COMPARISONS } from "@/lib/landing-content";
import { SITE_URL } from "@/lib/constants";

export function generateStaticParams() {
  return COMPARISONS.map((c) => ({ slug: c.slug }));
}

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const comp = COMPARISONS.find((c) => c.slug === slug);
  if (!comp) return {};
  const url = `${SITE_URL}/compare/${slug}`;
  return {
    title: comp.metaTitle,
    description: comp.metaDescription,
    alternates: { canonical: url },
    openGraph: { title: comp.metaTitle, description: comp.metaDescription, url, type: "website" },
    twitter: {
      card: "summary_large_image",
      title: comp.metaTitle,
      description: comp.metaDescription,
    },
  };
}

export default async function ComparePage({ params }: Props) {
  const { slug } = await params;
  const comp = COMPARISONS.find((c) => c.slug === slug);
  if (!comp) notFound();

  return (
    <LandingPageLayout
      badge="Comparison"
      badgeColor="#7c3aed"
      title={`AIVO vs ${comp.competitor}`}
      subtitle="An honest, side-by-side look at how the two platforms differ — written by us, fact-checked against public information from both vendors."
      breadcrumbs={[
        { name: "Home", href: "/" },
        { name: `AIVO vs ${comp.competitor}`, href: `/compare/${comp.slug}` },
      ]}
    >
      <section className="mb-10">
        <p className="text-slate-700 font-body leading-relaxed">{comp.intro}</p>
      </section>

      <section className="grid grid-cols-1 md:grid-cols-2 gap-5 mb-12">
        <div className="rounded-3xl border border-purple-200 bg-purple-50/40 p-6">
          <h2 className="font-heading font-bold text-slate-900 mb-2">AIVO is best for</h2>
          <p className="text-slate-700 font-body text-sm leading-relaxed">{comp.bestFor.aivo}</p>
        </div>
        <div className="rounded-3xl border border-slate-200 bg-white p-6">
          <h2 className="font-heading font-bold text-slate-900 mb-2">
            {comp.competitor} is best for
          </h2>
          <p className="text-slate-700 font-body text-sm leading-relaxed">
            {comp.bestFor.competitor}
          </p>
        </div>
      </section>

      <section className="mb-12">
        <h2 className="text-2xl font-heading font-bold text-slate-900 mb-4">
          Side-by-side comparison
        </h2>
        <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white">
          <table className="w-full text-sm">
            <caption className="sr-only">AIVO vs {comp.competitor} feature comparison</caption>
            <thead className="bg-slate-50 text-slate-700">
              <tr>
                <th scope="col" className="text-left font-heading font-bold p-4">
                  Feature
                </th>
                <th scope="col" className="text-left font-heading font-bold p-4 text-primary">
                  AIVO
                </th>
                <th scope="col" className="text-left font-heading font-bold p-4">
                  {comp.competitor}
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              {comp.rows.map((row) => (
                <tr key={row.feature}>
                  <th
                    scope="row"
                    className="text-left font-body p-4 font-semibold text-slate-700 align-top"
                  >
                    {row.feature}
                  </th>
                  <td className="p-4 align-top">{row.aivo}</td>
                  <td className="p-4 align-top text-slate-600">{row.competitor}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="mb-12 rounded-3xl border border-slate-200 bg-slate-50 p-6">
        <h2 className="font-heading font-bold text-slate-900 mb-2">An honest note from us</h2>
        <p className="text-slate-700 font-body text-sm leading-relaxed">{comp.honest}</p>
      </section>

      <section className="mb-12">
        <p className="text-slate-700 font-body leading-relaxed">{comp.closer}</p>
      </section>

      <section className="mt-14 pt-8 border-t border-slate-100">
        <h2 className="text-xl font-heading font-bold text-slate-900 mb-4">Other comparisons</h2>
        <div className="flex flex-wrap gap-3">
          {COMPARISONS.filter((c) => c.slug !== comp.slug).map((other) => (
            <Link
              key={other.slug}
              href={`/compare/${other.slug}`}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-slate-100 text-slate-700 font-bold text-sm hover:bg-slate-200 transition"
            >
              AIVO vs {other.competitor}
            </Link>
          ))}
        </div>
      </section>
    </LandingPageLayout>
  );
}
