"use client";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { ShieldCheck } from "lucide-react";
import { trackCTAClick, trackPricingSelection, trackSignupInitiation } from "@/lib/analytics";
import { WEB_APP_URL, SITE_URL } from "@/lib/constants";

const CHECK_ICON = (
  <svg
    className="w-5 h-5 text-emerald-500 flex-shrink-0 mt-0.5"
    fill="none"
    viewBox="0 0 24 24"
    stroke="currentColor"
    aria-hidden="true"
  >
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
  </svg>
);

const CHECK_WHITE = (
  <svg
    className="w-4 h-4 text-emerald-300"
    fill="none"
    viewBox="0 0 24 24"
    stroke="currentColor"
    aria-hidden="true"
  >
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
  </svg>
);

// Flat, listed B2C price: $39.99/mo per child on the Family plan.
const FAMILY_PRICE = 39.99;

export function Pricing() {
  const t = useTranslations("marketing.pricing");

  const FAMILY_FEATURES = [
    "family_f1",
    "family_f2",
    "family_f3",
    "family_f4",
    "family_f5",
    "family_f6",
  ] as const;

  const ENTERPRISE_FEATURES = [
    "district_f1",
    "district_f2",
    "district_f3",
    "district_f4",
    "district_f5",
    "district_f6",
    "district_f7",
    "district_f8",
  ] as const;

  // Product / Offer JSON-LD for the one self-serve plan.
  const productLd = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: `AIVO Learning – ${t("family_name")}`,
    description: t("family_desc"),
    brand: { "@type": "Brand", name: "AIVO Learning" },
    url: `${SITE_URL}/#pricing`,
    offers: {
      "@type": "Offer",
      priceCurrency: "USD",
      price: FAMILY_PRICE.toFixed(2),
      priceSpecification: {
        "@type": "UnitPriceSpecification",
        price: FAMILY_PRICE.toFixed(2),
        priceCurrency: "USD",
        unitText: "MONTH",
        referenceQuantity: { "@type": "QuantitativeValue", value: 1, unitCode: "MON" },
      },
      availability: "https://schema.org/InStock",
      url: `${WEB_APP_URL}/signup?plan=family`,
    },
  };

  return (
    <section className="py-24 bg-gradient-to-b from-white to-slate-50/50" id="pricing">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(productLd) }}
      />
      <div className="max-w-6xl mx-auto px-6 md:px-8">
        <div className="text-center mb-12">
          <p className="text-sm font-bold text-primary uppercase tracking-widest mb-3">
            {t("label")}
          </p>
          <h2 className="text-4xl md:text-5xl font-heading font-bold text-slate-900 mb-4">
            {t("title")}
          </h2>
          <p className="text-lg text-slate-500 max-w-2xl mx-auto font-body">{t("subtitle")}</p>
        </div>

        {/* Two tiers: Family (self-serve, listed price) and Enterprise (contact sales). */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-4xl mx-auto items-stretch">
          {/* Family — B2C */}
          <div className="relative bg-gradient-to-b from-purple-50 to-white border border-purple-200 rounded-3xl p-8 shadow-xl shadow-purple-200/50 flex flex-col">
            <div className="absolute -top-4 left-1/2 -translate-x-1/2 px-4 py-1 rounded-full bg-gradient-to-r from-primary to-purple-600 text-white text-xs font-bold shadow-lg">
              {t("best_value")}
            </div>
            <div className="mb-6">
              <h3 className="text-xl font-heading font-bold text-slate-900 mb-2">
                {t("family_name")}
              </h3>
              <div className="flex items-baseline gap-1 flex-wrap">
                <span className="text-4xl font-heading font-bold text-slate-900">
                  ${FAMILY_PRICE.toFixed(2)}
                </span>
                <span className="text-slate-500 font-body text-sm">/mo</span>
              </div>
              <p className="text-xs text-primary font-semibold mt-1">{t("per_learner")}</p>
              <p className="text-sm text-slate-500 font-body mt-2">{t("family_desc")}</p>
            </div>

            <ul className="space-y-3 mb-8 flex-1">
              {FAMILY_FEATURES.map((fk) => (
                <li key={fk} className="flex items-start gap-2.5 text-sm text-slate-600 font-body">
                  {CHECK_ICON}
                  {t(fk)}
                </li>
              ))}
            </ul>

            <a
              href={`${WEB_APP_URL}/signup?plan=family`}
              onClick={() => {
                trackPricingSelection("family_monthly");
                trackCTAClick("pricing_family", `${WEB_APP_URL}/signup?plan=family`);
                trackSignupInitiation("pricing");
              }}
              className="block w-full py-3.5 rounded-full bg-gradient-to-r from-primary to-purple-600 hover:from-primary-dark hover:to-purple-700 text-white font-bold text-center transition shadow-lg min-h-[44px] flex items-center justify-center"
            >
              {t("family_cta")}
            </a>
          </div>

          {/* Enterprise — B2B / district */}
          <div className="relative bg-white border border-slate-200 rounded-3xl p-8 hover:shadow-lg transition-all duration-300 flex flex-col">
            <div className="mb-6">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-slate-100 mb-3">
                <span className="text-base" aria-hidden="true">
                  🏫
                </span>
                <span className="text-xs font-bold text-slate-600">{t("district_badge")}</span>
              </div>
              <h3 className="text-xl font-heading font-bold text-slate-900 mb-2">
                {t("district_title")}
              </h3>
              <div className="flex items-baseline gap-1 flex-wrap">
                <span className="text-4xl font-heading font-bold text-slate-900">
                  {t("district_sales")}
                </span>
              </div>
              <p className="text-sm text-slate-500 font-body mt-2">{t("district_desc")}</p>
            </div>

            <ul className="space-y-3 mb-8 flex-1">
              {ENTERPRISE_FEATURES.map((fk) => (
                <li key={fk} className="flex items-start gap-2.5 text-sm text-slate-600 font-body">
                  {CHECK_ICON}
                  {t(fk)}
                </li>
              ))}
            </ul>

            <div className="flex flex-col sm:flex-row gap-3">
              <Link
                href="/contact#demo"
                onClick={() => trackCTAClick("pricing_enterprise_demo", "/contact#demo")}
                className="flex-1 inline-flex items-center justify-center px-6 py-3.5 rounded-full bg-slate-900 hover:bg-slate-800 text-white font-bold text-center transition shadow-lg min-h-[44px]"
              >
                {t("district_demo")}
              </Link>
              <Link
                href="/contact"
                onClick={() => trackCTAClick("pricing_enterprise_sales", "/contact")}
                className="flex-1 inline-flex items-center justify-center px-6 py-3.5 rounded-full border-2 border-slate-200 text-slate-700 font-bold text-center hover:bg-slate-50 transition min-h-[44px]"
              >
                {t("district_sales")}
              </Link>
            </div>
          </div>
        </div>

        {/* Money-back guarantee */}
        <div className="max-w-3xl mx-auto mt-12">
          <div className="flex items-start gap-4 rounded-3xl border border-emerald-200 bg-emerald-50/60 p-5 md:p-6">
            <span className="inline-flex w-10 h-10 rounded-2xl bg-emerald-100 text-emerald-700 items-center justify-center shrink-0">
              <ShieldCheck className="w-5 h-5" aria-hidden="true" />
            </span>
            <div>
              <p className="font-heading font-bold text-emerald-900">{t("guarantee_title")}</p>
              <p className="text-sm text-emerald-800/90 font-body mt-1 leading-relaxed">
                {t("guarantee_desc")}
              </p>
            </div>
          </div>
        </div>

        {/* Enterprise contact band */}
        <div className="max-w-4xl mx-auto mt-10">
          <div className="bg-gradient-to-r from-indigo-600 via-purple-600 to-primary rounded-3xl p-8 md:p-10 text-center relative overflow-hidden">
            <div className="absolute inset-0 pointer-events-none">
              <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full blur-3xl" />
              <div className="absolute bottom-0 left-0 w-48 h-48 bg-white/5 rounded-full blur-3xl" />
            </div>
            <div className="relative z-10 flex flex-wrap items-center justify-center gap-x-6 gap-y-3 text-sm text-white/90 font-body">
              {ENTERPRISE_FEATURES.slice(0, 5).map((fk) => (
                <span key={fk} className="flex items-center gap-1.5">
                  {CHECK_WHITE}
                  {t(fk)}
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
