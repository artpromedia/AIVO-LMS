import type { Metadata } from "next";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { LandingPageLayout } from "@/components/marketing/LandingPageLayout";
import { SITE_URL, WEB_APP_URL } from "@/lib/constants";

export const metadata: Metadata = {
  title: "Pricing — AIVO Learning",
  description:
    "Simple, honest pricing. Family plan is $39.99/month per child with a 30-day free trial. Schools and districts: request an Enterprise quote.",
  alternates: { canonical: `${SITE_URL}/pricing` },
};

const FAMILY_FEATURE_KEYS = [
  "family_feat_1",
  "family_feat_2",
  "family_feat_3",
  "family_feat_4",
  "family_feat_5",
  "family_feat_6",
  "family_feat_7",
  "family_feat_8",
] as const;

const SCHOOL_FEATURE_KEYS = [
  "school_feat_1",
  "school_feat_2",
  "school_feat_3",
  "school_feat_4",
  "school_feat_5",
] as const;

const DISTRICT_FEATURE_KEYS = [
  "district_feat_1",
  "district_feat_2",
  "district_feat_3",
  "district_feat_4",
  "district_feat_5",
] as const;

const FAQ_INDEXES = [1, 2, 3, 4, 5] as const;

const CHECK = (
  <svg
    className="mt-0.5 h-4 w-4 flex-shrink-0 text-emerald-600"
    fill="none"
    viewBox="0 0 24 24"
    stroke="currentColor"
    aria-hidden="true"
  >
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
  </svg>
);

export default async function PricingPage() {
  const t = await getTranslations("marketing.page_pricing");
  return (
    <LandingPageLayout
      badge="Pricing"
      title={t("hero_title")}
      subtitle={t("hero_subtitle")}
      breadcrumbs={[{ name: "Pricing", href: "/pricing" }]}
      finalCta={{
        title: t("final_cta_title"),
        body: t("final_cta_body"),
        primary: { label: t("final_cta_primary"), href: "/features/todays-mission" },
        secondary: { label: t("final_cta_secondary"), href: "/contact" },
      }}
    >
      <section aria-labelledby="family-pricing-heading">
        <h2 id="family-pricing-heading" className="font-heading text-2xl font-bold text-slate-900">
          {t("for_families")}
        </h2>
        <p className="mt-1 font-body text-slate-600">{t("family_disclaimer")}</p>
        <div className="mt-6 grid grid-cols-1 gap-5 sm:max-w-md">
          <article className="relative flex flex-col rounded-3xl border border-purple-300 bg-gradient-to-b from-purple-50 to-white p-6 shadow-sm">
            <span className="absolute -top-3 left-6 rounded-full bg-purple-600 px-3 py-1 text-xs font-bold uppercase tracking-wide text-white">
              {t("family_badge")}
            </span>
            <h3 className="font-heading text-xl font-bold text-slate-900">{t("family_name")}</h3>
            <p className="mt-1 font-body text-sm text-slate-600">{t("family_desc")}</p>
            <div className="mt-4">
              <span className="font-heading text-3xl font-bold text-slate-900">
                {t("family_price")}
              </span>
              <span className="ml-1 text-sm text-slate-500">{t("family_cadence")}</span>
            </div>
            <ul className="mt-4 flex-1 space-y-2">
              {FAMILY_FEATURE_KEYS.map((k) => (
                <li key={k} className="flex items-start gap-2 text-sm font-body text-slate-700">
                  {CHECK}
                  <span>{t(k)}</span>
                </li>
              ))}
            </ul>
            <Link
              href={`${WEB_APP_URL}/signup?plan=family`}
              className="mt-6 inline-flex items-center justify-center rounded-full bg-gradient-to-r from-primary to-purple-600 px-5 py-2.5 font-bold text-white shadow-sm transition hover:from-primary-dark hover:to-purple-700"
            >
              {t("family_cta")}
            </Link>
          </article>
        </div>
      </section>

      <section aria-labelledby="institutional-heading" className="mt-14">
        <h2 id="institutional-heading" className="font-heading text-2xl font-bold text-slate-900">
          {t("for_schools")}
        </h2>
        <p className="mt-1 font-body text-slate-600">{t("institutional_intro")}</p>
        <div className="mt-6 grid grid-cols-1 gap-5 md:grid-cols-2">
          <article className="flex flex-col rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <h3 className="font-heading text-xl font-bold text-slate-900">{t("school_name")}</h3>
            <p className="mt-1 font-body text-sm text-slate-600">{t("school_desc")}</p>
            <ul className="mt-4 flex-1 space-y-2">
              {SCHOOL_FEATURE_KEYS.map((k) => (
                <li key={k} className="flex items-start gap-2 text-sm font-body text-slate-700">
                  {CHECK}
                  <span>{t(k)}</span>
                </li>
              ))}
            </ul>
            <Link
              href="/demo"
              className="mt-6 inline-flex items-center justify-center rounded-full bg-gradient-to-r from-primary to-purple-600 px-5 py-2.5 font-bold text-white shadow-sm transition hover:from-primary-dark hover:to-purple-700"
            >
              {t("school_cta")}
            </Link>
          </article>
          <article className="flex flex-col rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <h3 className="font-heading text-xl font-bold text-slate-900">{t("district_name")}</h3>
            <p className="mt-1 font-body text-sm text-slate-600">{t("district_desc")}</p>
            <ul className="mt-4 flex-1 space-y-2">
              {DISTRICT_FEATURE_KEYS.map((k) => (
                <li key={k} className="flex items-start gap-2 text-sm font-body text-slate-700">
                  {CHECK}
                  <span>{t(k)}</span>
                </li>
              ))}
            </ul>
            <Link
              href="/demo"
              className="mt-6 inline-flex items-center justify-center rounded-full bg-gradient-to-r from-primary to-purple-600 px-5 py-2.5 font-bold text-white shadow-sm transition hover:from-primary-dark hover:to-purple-700"
            >
              {t("district_cta")}
            </Link>
          </article>
        </div>
      </section>

      <section aria-labelledby="pricing-faq-heading" className="mt-14">
        <h2 id="pricing-faq-heading" className="font-heading text-2xl font-bold text-slate-900">
          {t("pricing_faq_heading")}
        </h2>
        <dl className="mt-5 space-y-4">
          {FAQ_INDEXES.map((i) => (
            <div key={i} className="rounded-2xl border border-slate-200 bg-white p-5">
              <dt className="font-heading text-base font-bold text-slate-900">{t(`faq_${i}_q`)}</dt>
              <dd className="mt-1 font-body text-slate-700">{t(`faq_${i}_a`)}</dd>
            </div>
          ))}
        </dl>
      </section>
    </LandingPageLayout>
  );
}
