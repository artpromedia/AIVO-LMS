import type { Metadata } from "next";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { COMPARISONS } from "@/lib/landing-content";
import { SITE_URL } from "@/lib/constants";

export const metadata: Metadata = {
  title: "Compare AIVO for your role",
  description:
    "AIVO adapts to every learner with a personal Brain Clone, IEP-aligned support, and 14 AI tutors. See how AIVO fits your role — parents, teachers, schools, districts, special education, and homeschool families.",
  alternates: { canonical: `${SITE_URL}/compare` },
};

export default async function ComparePage() {
  const t = await getTranslations("marketing.page_compare");
  return (
    <main id="main" className="mx-auto max-w-4xl px-6 py-16">
      <p className="text-sm font-medium uppercase tracking-wide text-aivo-purple">{t("eyebrow")}</p>
      <h1 className="mt-2 font-display text-4xl font-bold">
        {t("heading")}
      </h1>
      <p className="mt-3 text-aivo-ink-soft">
        Every learner is different and every role uses AIVO differently. Pick yours below to see the
        specific benefits, workflows, and outcomes that matter most to you.
      </p>

      <ul className="mt-10 grid gap-4 sm:grid-cols-2">
        {COMPARISONS.map((c) => {
          // Card title is the competitor pairing; the subtitle is the
          // first sentence of the comparison intro so the data model
          // stays single-source-of-truth (ComparisonSpec) — no parallel
          // copy to drift.
          const cardTitle = `AIVO vs ${c.competitor}`;
          const firstSentenceMatch = c.intro.match(/^([^.!?]+[.!?])\s*/);
          const cardSubtitle = firstSentenceMatch ? firstSentenceMatch[1] : c.intro;
          return (
            <li
              key={c.slug}
              className="rounded-2xl border border-aivo-border bg-white p-6 shadow-sm transition hover:shadow-md"
            >
              <Link
                href={`/compare/${c.slug}`}
                className="block focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-aivo-purple"
              >
                <h2 className="font-display text-xl font-semibold text-aivo-ink">{cardTitle}</h2>
                <p className="mt-2 text-sm text-aivo-ink-soft">{cardSubtitle}</p>
                <span className="mt-3 inline-block text-sm font-medium text-aivo-purple">
                  {t("see_comparison")}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </main>
  );
}
