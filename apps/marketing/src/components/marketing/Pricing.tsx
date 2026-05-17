"use client";
import { useState } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { Check, ShieldCheck } from "lucide-react";
import { trackCTAClick, trackPricingSelection, trackSignupInitiation } from "@/lib/analytics";
import { WEB_APP_URL, SITE_URL } from "@/lib/constants";

const CHECK_ICON = (
  <svg className="w-5 h-5 text-emerald-500 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
  </svg>
);

const CHECK_WHITE = (
  <svg className="w-4 h-4 text-emerald-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
  </svg>
);

const ANNUAL_DISCOUNT = 0.8; // 20% discount when billed annually (customers pay 80% of monthly price)

function formatAnnual(monthlyPrice: number): string {
  const discounted = Math.round(monthlyPrice * ANNUAL_DISCOUNT * 100) / 100;
  return `$${discounted.toFixed(2)}`;
}

export function Pricing() {
  const t = useTranslations("marketing.pricing");
  const [billing, setBilling] = useState<"monthly" | "annual">("monthly");

  const PLANS = [
    {
      key: "free",
      nameKey: "free_name" as const,
      monthly: 0,
      perLearner: false,
      descKey: "free_desc" as const,
      featureKeys: ["free_f1", "free_f2", "free_f3", "free_f4"] as const,
      ctaKey: "free_cta" as const,
      href: `${WEB_APP_URL}/signup?plan=free`,
      popular: false,
      bg: "bg-white",
      border: "border-slate-200",
      ctaBg: "bg-slate-900 hover:bg-slate-800",
    },
    {
      key: "single",
      nameKey: "single_name" as const,
      monthly: 24.99,
      perLearner: true,
      descKey: "single_desc" as const,
      featureKeys: ["single_f1", "single_f2", "single_f3", "single_f4", "single_f5", "single_f6"] as const,
      ctaKey: "single_cta" as const,
      href: `${WEB_APP_URL}/signup?plan=single`,
      popular: false,
      bg: "bg-white",
      border: "border-slate-200",
      ctaBg: "bg-slate-900 hover:bg-slate-800",
    },
    {
      key: "family",
      nameKey: "family_name" as const,
      monthly: 19.99,
      perLearner: true,
      descKey: "family_desc" as const,
      featureKeys: ["family_f1", "family_f2", "family_f3", "family_f4", "family_f5", "family_f6", "family_f7"] as const,
      ctaKey: "family_cta" as const,
      href: `${WEB_APP_URL}/signup?plan=family`,
      popular: true,
      bg: "bg-gradient-to-b from-purple-50 to-white",
      border: "border-purple-200",
      ctaBg: "bg-gradient-to-r from-primary to-purple-600 hover:from-primary-dark hover:to-purple-700",
    },
  ];

  const DISTRICT_FEATURES = [
    "district_f1", "district_f2", "district_f3", "district_f4",
    "district_f5", "district_f6", "district_f7", "district_f8",
  ] as const;

  // Product / Offer JSON-LD for paid plans
  const productLd = {
    "@context": "https://schema.org",
    "@graph": PLANS.filter((p) => p.monthly > 0).map((plan) => ({
      "@type": "Product",
      name: `AIVO Learning – ${t(plan.nameKey)}`,
      description: t(plan.descKey),
      brand: { "@type": "Brand", name: "AIVO Learning" },
      url: `${SITE_URL}/#pricing`,
      offers: {
        "@type": "Offer",
        priceCurrency: "USD",
        price: billing === "annual"
          ? (Math.round(plan.monthly * ANNUAL_DISCOUNT * 100) / 100).toFixed(2)
          : plan.monthly.toFixed(2),
        priceSpecification: {
          "@type": "UnitPriceSpecification",
          price: billing === "annual"
            ? (Math.round(plan.monthly * ANNUAL_DISCOUNT * 100) / 100).toFixed(2)
            : plan.monthly.toFixed(2),
          priceCurrency: "USD",
          unitText: "MONTH",
          referenceQuantity: { "@type": "QuantitativeValue", value: 1, unitCode: "MON" },
        },
        availability: "https://schema.org/InStock",
        url: plan.href,
      },
    })),
  };

  return (
    <section className="py-24 bg-gradient-to-b from-white to-slate-50/50" id="pricing">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(productLd) }}
      />
      <div className="max-w-6xl mx-auto px-6 md:px-8">
        <div className="text-center mb-10">
          <p className="text-sm font-bold text-primary uppercase tracking-widest mb-3">
            {t("label")}
          </p>
          <h2 className="text-4xl md:text-5xl font-heading font-bold text-slate-900 mb-4">
            {t("title")}
          </h2>
          <p className="text-lg text-slate-500 max-w-2xl mx-auto font-body">
            {t("subtitle")}
          </p>
        </div>

        {/* Billing toggle */}
        <div
          className="flex justify-center mb-12"
          role="radiogroup"
          aria-label="Billing frequency"
        >
          <div className="inline-flex items-center bg-white border border-slate-200 rounded-full p-1 shadow-sm">
            <button
              type="button"
              role="radio"
              aria-checked={billing === "monthly"}
              onClick={() => setBilling("monthly")}
              className={`px-5 py-2 rounded-full text-sm font-bold transition min-h-[40px] ${
                billing === "monthly"
                  ? "bg-slate-900 text-white"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              {t("billing_monthly")}
            </button>
            <button
              type="button"
              role="radio"
              aria-checked={billing === "annual"}
              onClick={() => setBilling("annual")}
              className={`px-5 py-2 rounded-full text-sm font-bold transition inline-flex items-center gap-2 min-h-[40px] ${
                billing === "annual"
                  ? "bg-slate-900 text-white"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              {t("billing_annual")}
              <span
                className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold ${
                  billing === "annual"
                    ? "bg-emerald-400 text-emerald-950"
                    : "bg-emerald-100 text-emerald-700"
                }`}
              >
                {t("billing_save")}
              </span>
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-5xl mx-auto mb-10">
          {PLANS.map((plan) => {
            let monthlyDisplay = t("free_price");
            if (plan.monthly > 0) {
              monthlyDisplay = billing === "annual"
                ? formatAnnual(plan.monthly)
                : `$${plan.monthly.toFixed(2)}`;
            }

            let periodSuffix = "";
            if (plan.monthly > 0) {
              periodSuffix = billing === "annual" ? t("annual_suffix") : "/mo";
            }

            return (
              <div
                key={plan.key}
                className={`relative ${plan.bg} border ${plan.border} rounded-3xl p-8 ${plan.popular ? "shadow-xl shadow-purple-200/50 scale-[1.02] md:scale-105" : "hover:shadow-lg"} transition-all duration-300`}
              >
                {plan.popular && (
                  <div className="absolute -top-4 left-1/2 -translate-x-1/2 px-4 py-1 rounded-full bg-gradient-to-r from-primary to-purple-600 text-white text-xs font-bold shadow-lg">
                    {t("best_value")}
                  </div>
                )}
                <div className="mb-6">
                  <h3 className="text-xl font-heading font-bold text-slate-900 mb-2">
                    {t(plan.nameKey)}
                  </h3>
                  <div className="flex items-baseline gap-1 flex-wrap">
                    <span className="text-4xl font-heading font-bold text-slate-900">
                      {monthlyDisplay}
                    </span>
                    {periodSuffix && (
                      <span className="text-slate-500 font-body text-sm">{periodSuffix}</span>
                    )}
                  </div>
                  {plan.perLearner && (
                    <p className="text-xs text-primary font-semibold mt-1">{t("per_learner")}</p>
                  )}
                  <p className="text-sm text-slate-500 font-body mt-2">{t(plan.descKey)}</p>
                </div>

                <ul className="space-y-3 mb-8">
                  {plan.featureKeys.map((fk) => (
                    <li key={fk} className="flex items-start gap-2.5 text-sm text-slate-600 font-body">
                      {CHECK_ICON}
                      {t(fk)}
                    </li>
                  ))}
                </ul>

                <a
                  href={plan.href}
                  onClick={() => {
                    trackPricingSelection(`${plan.key}_${billing}`);
                    trackCTAClick(`pricing_${plan.key}_${billing}`, plan.href);
                    trackSignupInitiation("pricing");
                  }}
                  className={`block w-full py-3.5 rounded-full ${plan.ctaBg} text-white font-bold text-center transition shadow-lg min-h-[44px] flex items-center justify-center`}
                >
                  {t(plan.ctaKey)}
                </a>
              </div>
            );
          })}
        </div>

        {/* Money-back guarantee */}
        <div className="max-w-3xl mx-auto mb-10">
          <div className="flex items-start gap-4 rounded-3xl border border-emerald-200 bg-emerald-50/60 p-5 md:p-6">
            <span className="inline-flex w-10 h-10 rounded-2xl bg-emerald-100 text-emerald-700 items-center justify-center shrink-0">
              <ShieldCheck className="w-5 h-5" aria-hidden="true" />
            </span>
            <div>
              <p className="font-heading font-bold text-emerald-900">
                {t("guarantee_title")}
              </p>
              <p className="text-sm text-emerald-800/90 font-body mt-1 leading-relaxed">
                {t("guarantee_desc")}
              </p>
            </div>
          </div>
        </div>

        {/* Add-on note */}
        <div className="max-w-5xl mx-auto mb-16">
          <div className="flex items-center justify-center gap-2 text-sm text-slate-500 font-body text-center">
            <svg className="w-4 h-4 text-amber-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M12 2a10 10 0 100 20 10 10 0 000-20z" />
            </svg>
            {t("addon_note")}
          </div>
        </div>

        {/* Comparison matrix */}
        <div className="max-w-5xl mx-auto mb-16">
          <div className="text-center mb-8">
            <h3 className="text-2xl md:text-3xl font-heading font-bold text-slate-900 mb-2">
              {t("compare_title")}
            </h3>
            <p className="text-sm text-slate-500 font-body">{t("compare_subtitle")}</p>
          </div>
          <div className="overflow-x-auto rounded-3xl border border-slate-200 bg-white">
            <table className="w-full text-sm">
              <caption className="sr-only">{t("compare_title")}</caption>
              <thead className="bg-slate-50 text-slate-700">
                <tr>
                  <th scope="col" className="text-left font-heading font-bold p-4">
                    {t("compare_feature")}
                  </th>
                  <th scope="col" className="text-center font-heading font-bold p-4">
                    {t("free_name")}
                  </th>
                  <th scope="col" className="text-center font-heading font-bold p-4">
                    {t("single_name")}
                  </th>
                  <th scope="col" className="text-center font-heading font-bold p-4 text-primary">
                    {t("family_name")}
                  </th>
                  <th scope="col" className="text-center font-heading font-bold p-4">
                    {t("district_title")}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-600">
                <tr>
                  <th scope="row" className="text-left font-body p-4 font-semibold text-slate-700">
                    {t("compare_learners")}
                  </th>
                  <td className="text-center p-4">1</td>
                  <td className="text-center p-4">1</td>
                  <td className="text-center p-4">2&ndash;10</td>
                  <td className="text-center p-4">{t("compare_unlimited")}</td>
                </tr>
                <tr>
                  <th scope="row" className="text-left font-body p-4 font-semibold text-slate-700">
                    {t("compare_tutors")}
                  </th>
                  <td className="text-center p-4">{t("compare_tutors_free")}</td>
                  <td className="text-center p-4">{t("compare_tutors_paid")}</td>
                  <td className="text-center p-4">{t("compare_tutors_paid")}</td>
                  <td className="text-center p-4">14</td>
                </tr>
                <tr>
                  <th scope="row" className="text-left font-body p-4 font-semibold text-slate-700">
                    {t("compare_brain")}
                  </th>
                  <td className="text-center p-4">{t("compare_brain_basic")}</td>
                  <td className="text-center p-4">{t("compare_brain_full")}</td>
                  <td className="text-center p-4">{t("compare_brain_full")}</td>
                  <td className="text-center p-4">{t("compare_brain_full")}</td>
                </tr>
                <tr>
                  <th scope="row" className="text-left font-body p-4 font-semibold text-slate-700">
                    {t("compare_parent_dashboard")}
                  </th>
                  <td className="text-center p-4"><Check className="inline w-4 h-4 text-emerald-500" aria-label={t("compare_yes")} /></td>
                  <td className="text-center p-4"><Check className="inline w-4 h-4 text-emerald-500" aria-label={t("compare_yes")} /></td>
                  <td className="text-center p-4"><Check className="inline w-4 h-4 text-emerald-500" aria-label={t("compare_yes")} /></td>
                  <td className="text-center p-4"><Check className="inline w-4 h-4 text-emerald-500" aria-label={t("compare_yes")} /></td>
                </tr>
                <tr>
                  <th scope="row" className="text-left font-body p-4 font-semibold text-slate-700">
                    {t("compare_multi_learner_discount")}
                  </th>
                  <td className="text-center p-4 text-slate-300" aria-label={t("compare_no")}>{t("compare_no")}</td>
                  <td className="text-center p-4 text-slate-300" aria-label={t("compare_no")}>{t("compare_no")}</td>
                  <td className="text-center p-4"><Check className="inline w-4 h-4 text-emerald-500" aria-label={t("compare_yes")} /></td>
                  <td className="text-center p-4"><Check className="inline w-4 h-4 text-emerald-500" aria-label={t("compare_yes")} /></td>
                </tr>
                <tr>
                  <th scope="row" className="text-left font-body p-4 font-semibold text-slate-700">
                    {t("compare_addon_tutors")}
                  </th>
                  <td className="text-center p-4 text-slate-300" aria-label={t("compare_no")}>{t("compare_no")}</td>
                  <td className="text-center p-4">{t("compare_addon_price")}</td>
                  <td className="text-center p-4">{t("compare_addon_price")}</td>
                  <td className="text-center p-4">{t("compare_addon_included")}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <div className="bg-gradient-to-r from-indigo-600 via-purple-600 to-primary rounded-3xl p-10 md:p-14 text-center relative overflow-hidden">
          <div className="absolute inset-0 pointer-events-none">
            <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full blur-3xl" />
            <div className="absolute bottom-0 left-0 w-48 h-48 bg-white/5 rounded-full blur-3xl" />
          </div>
          <div className="relative z-10">
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white/10 mb-6">
              <span className="text-lg" aria-hidden="true">🏫</span>
              <span className="text-sm font-bold text-white/90">{t("district_badge")}</span>
            </div>
            <h3 className="text-3xl md:text-4xl font-heading font-bold text-white mb-4">
              {t("district_title")}
            </h3>
            <p className="text-lg text-white/80 max-w-2xl mx-auto font-body mb-4">
              {t("district_desc")}
            </p>
            <ul className="flex flex-wrap justify-center gap-x-6 gap-y-2 text-sm text-white/90 font-body mb-8">
              {DISTRICT_FEATURES.map((fk) => (
                <li key={fk} className="flex items-center gap-1.5">
                  {CHECK_WHITE}
                  {t(fk)}
                </li>
              ))}
            </ul>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link
                href="/contact#demo"
                onClick={() => trackCTAClick("pricing_district_demo", "/contact#demo")}
                className="inline-flex items-center justify-center px-8 py-3.5 rounded-full bg-white text-primary font-bold text-lg hover:bg-slate-50 transition shadow-lg min-h-[44px]"
              >
                {t("district_demo")}
              </Link>
              <Link
                href="/contact"
                onClick={() => trackCTAClick("pricing_district_sales", "/contact")}
                className="inline-flex items-center justify-center px-8 py-3.5 rounded-full border-2 border-white/30 text-white font-bold text-lg hover:bg-white/10 transition min-h-[44px]"
              >
                {t("district_sales")}
              </Link>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
