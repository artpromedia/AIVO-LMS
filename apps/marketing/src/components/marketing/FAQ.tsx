"use client";
import { useState } from "react";
import { useTranslations } from "next-intl";

const FAQ_KEYS = [
  { q: "q1", a: "a1" },
  { q: "q2", a: "a2" },
  { q: "q3", a: "a3" },
  { q: "q4", a: "a4" },
  { q: "q5", a: "a5" },
  { q: "q6", a: "a6" },
  { q: "q7", a: "a7" },
  { q: "q8", a: "a8" },
] as const;

export function FAQ() {
  const t = useTranslations("marketing.faq");
  const [open, setOpen] = useState<number | null>(null);

  return (
    <section className="py-24 bg-gradient-to-b from-slate-50/50 to-white" id="faq">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "FAQPage",
            mainEntity: FAQ_KEYS.map((faq) => ({
              "@type": "Question",
              name: t(faq.q),
              acceptedAnswer: {
                "@type": "Answer",
                text: t(faq.a),
              },
            })),
          }),
        }}
      />
      <div className="max-w-3xl mx-auto px-6 md:px-8">
        <div className="text-center mb-16">
          <p className="text-sm font-bold text-secondary uppercase tracking-widest mb-3">
            {t("label")}
          </p>
          <h2 className="text-4xl md:text-5xl font-heading font-bold text-slate-900 mb-4">
            {t("title")}
          </h2>
          <p className="text-lg text-slate-500 font-body">{t("subtitle")}</p>
        </div>

        <div className="space-y-3" role="list">
          {FAQ_KEYS.map((faq, i) => {
            const isOpen = open === i;
            const panelId = `faq-panel-${i}`;
            const triggerId = `faq-trigger-${i}`;
            return (
              <div
                key={faq.q}
                role="listitem"
                className={`bg-white border rounded-2xl overflow-hidden transition-all duration-300 ${isOpen ? "border-purple-200 shadow-md" : "border-slate-100 hover:border-slate-200"}`}
              >
                <button
                  id={triggerId}
                  onClick={() => setOpen(isOpen ? null : i)}
                  aria-expanded={isOpen}
                  aria-controls={panelId}
                  className="w-full flex items-center justify-between p-6 text-left"
                >
                  <span className="font-heading font-bold text-slate-900 pr-4">{t(faq.q)}</span>
                  <svg
                    className={`w-5 h-5 text-primary flex-shrink-0 transition-transform duration-300 motion-reduce:transition-none ${isOpen ? "rotate-180" : ""}`}
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    aria-hidden="true"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M19 9l-7 7-7-7"
                    />
                  </svg>
                </button>
                <div
                  id={panelId}
                  role="region"
                  aria-labelledby={triggerId}
                  hidden={!isOpen}
                  className={`overflow-hidden transition-all duration-300 motion-reduce:transition-none ${isOpen ? "max-h-96 opacity-100" : "max-h-0 opacity-0"}`}
                >
                  <p className="px-6 pb-6 text-slate-500 font-body leading-relaxed">{t(faq.a)}</p>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
