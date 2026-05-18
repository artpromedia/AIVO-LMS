"use client";
import { useTranslations } from "next-intl";

const STEPS = [
  { num: "1", titleKey: "step1_title" as const, descKey: "step1_desc" as const },
  { num: "2", titleKey: "step2_title" as const, descKey: "step2_desc" as const },
  { num: "3", titleKey: "step3_title" as const, descKey: "step3_desc" as const },
  { num: "4", titleKey: "step4_title" as const, descKey: "step4_desc" as const },
];

export function HowItWorks() {
  const t = useTranslations("marketing.how_it_works");

  return (
    <section className="py-24 bg-white">
      <div className="max-w-6xl mx-auto px-6 md:px-8">
        <div className="text-center mb-16 max-w-2xl mx-auto">
          <span className="inline-flex items-center px-4 py-1.5 rounded-full bg-amber-100 text-amber-700 font-bold text-sm mb-4">
            {t("label")}
          </span>
          <h2 className="text-4xl md:text-5xl font-heading font-bold text-slate-900 mb-4 leading-tight">
            {t("title")}
          </h2>
          <p className="text-lg text-slate-600 font-body">{t("subtitle")}</p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {STEPS.map((step) => (
            <div
              key={step.num}
              className="bg-white border-2 border-slate-100 rounded-3xl p-6 hover:border-primary hover:shadow-md transition-all duration-300 h-full"
            >
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-primary to-primary-dark text-white font-heading font-bold flex items-center justify-center text-xl mb-4 shadow-lg shadow-purple-200">
                {step.num}
              </div>
              <h3 className="font-heading font-bold text-lg text-slate-900 mb-2">
                {t(step.titleKey)}
              </h3>
              <p className="text-sm text-slate-600 font-body leading-relaxed">{t(step.descKey)}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
