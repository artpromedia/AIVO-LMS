import { MARKETING_ACCENTS } from "@aivo/brand";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
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
  const t = await getTranslations("marketing.page_compare_detail");

  return (
    <LandingPageLayout
      badge="Comparison"
      badgeColor={MARKETING_ACCENTS.purple}
      title={`AIVO vs ${comp.competitor}`}
      subtitle="An honest, side-by-side look at how the two platforms differ — written by us, fact-checked against public information from both vendors."
      breadcrumbs={[
        { name: "Home", href: "/" },
        { name: `AIVO vs ${comp.competitor}`, href: `/compare/${comp.slug}` },
      ]}
    >
      <section className="mb-10">
        <p className="text-iw-ink font-body leading-relaxed">{comp.intro}</p>
      </section>

      <section className="grid grid-cols-1 md:grid-cols-2 gap-5 mb-12">
        <div className="rounded-iw-card-lg border border-iw-purple-200 bg-iw-purple-100/40 p-6">
          <h2 className="font-heading font-bold text-iw-ink mb-2">{t("aivo_best_for")}</h2>
          <p className="text-iw-ink font-body text-sm leading-relaxed">{comp.bestFor.aivo}</p>
        </div>
        <div className="rounded-iw-card-lg border border-iw-border bg-white p-6">
          <h2 className="font-heading font-bold text-iw-ink mb-2">
            {comp.competitor} is best for
          </h2>
          <p className="text-iw-ink font-body text-sm leading-relaxed">
            {comp.bestFor.competitor}
          </p>
        </div>
      </section>

      <section className="mb-12">
        <h2 className="text-2xl font-heading font-bold text-iw-ink mb-4">{t("side_by_side")}</h2>
        <div className="overflow-x-auto rounded-iw-card border border-iw-border bg-white">
          <table className="w-full text-sm">
            <caption className="sr-only">AIVO vs {comp.competitor} feature comparison</caption>
            <thead className="bg-iw-raised text-iw-ink">
              <tr>
                <th scope="col" className="text-left font-heading font-bold p-4">
                  {t("col_feature")}
                </th>
                <th scope="col" className="text-left font-heading font-bold p-4 text-primary">
                  AIVO
                </th>
                <th scope="col" className="text-left font-heading font-bold p-4">
                  {comp.competitor}
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-iw-border text-iw-ink">
              {comp.rows.map((row) => (
                <tr key={row.feature}>
                  <th
                    scope="row"
                    className="text-left font-body p-4 font-semibold text-iw-ink align-top"
                  >
                    {row.feature}
                  </th>
                  <td className="p-4 align-top">{row.aivo}</td>
                  <td className="p-4 align-top text-iw-ink-muted">{row.competitor}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="mb-12 rounded-iw-card-lg border border-iw-border bg-iw-raised p-6">
        <h2 className="font-heading font-bold text-iw-ink mb-2">{t("honest_note")}</h2>
        <p className="text-iw-ink font-body text-sm leading-relaxed">{comp.honest}</p>
      </section>

      <section className="mb-12">
        <p className="text-iw-ink font-body leading-relaxed">{comp.closer}</p>
      </section>

      <section className="mt-14 pt-8 border-t border-iw-border">
        <h2 className="text-xl font-heading font-bold text-iw-ink mb-4">
          {t("other_comparisons")}
        </h2>
        <div className="flex flex-wrap gap-3">
          {COMPARISONS.filter((c) => c.slug !== comp.slug).map((other) => (
            <Link
              key={other.slug}
              href={`/compare/${other.slug}`}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-iw-chip bg-iw-raised text-iw-ink font-bold text-sm hover:bg-iw-border transition"
            >
              AIVO vs {other.competitor}
            </Link>
          ))}
        </div>
      </section>
    </LandingPageLayout>
  );
}
