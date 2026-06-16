"use client";
import { useTranslations } from "next-intl";
import { ArrowRight } from "lucide-react";
import { trackCTAClick, trackSignupInitiation } from "@/lib/analytics";
import { WEB_APP_URL } from "@/lib/constants";

export function CTASection() {
  const t = useTranslations("marketing.cta");

  return (
    <section className="py-24 px-6 bg-white">
      <div className="max-w-4xl mx-auto text-center bg-gradient-to-br from-iw-purple-100 via-iw-purple-50 to-white rounded-[3rem] p-12 md:p-16 border-2 border-iw-border relative overflow-hidden">
        <div className="absolute top-0 right-0 -translate-y-1/2 translate-x-1/4 w-64 h-64 bg-iw-warm/30 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-0 translate-y-1/2 -translate-x-1/4 w-72 h-72 bg-iw-accent/20 rounded-full blur-3xl pointer-events-none" />
        <div className="relative space-y-6">
          <h2 className="text-4xl md:text-5xl font-heading font-bold text-iw-ink leading-tight">
            {t("title_line1")}
            <br className="hidden md:block" /> {t("title_line2")}
          </h2>
          <p className="text-lg text-iw-ink-muted font-body max-w-xl mx-auto">{t("subtitle")}</p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center pt-2">
            <a
              href={`${WEB_APP_URL}/signup?plan=free`}
              onClick={() => {
                trackCTAClick("cta_section_trial", `${WEB_APP_URL}/signup?plan=free`);
                trackSignupInitiation("cta_section");
              }}
              className="group inline-flex items-center justify-center gap-2 px-10 py-4 rounded-iw-control bg-gradient-to-r from-primary to-primary-dark text-white font-bold text-lg hover:opacity-95 transition-all shadow-soft-5 hover:-translate-y-0.5 min-h-[44px]"
            >
              {t("cta_trial")}
              <ArrowRight
                className="w-5 h-5 group-hover:translate-x-1 transition-transform"
                aria-hidden="true"
              />
            </a>
            <a
              href="#pricing"
              className="inline-flex items-center justify-center px-10 py-4 rounded-iw-control border-2 border-iw-border bg-white text-iw-ink font-bold text-lg hover:border-iw-border hover:bg-iw-raised transition-all hover:-translate-y-0.5 min-h-[44px]"
            >
              {t("cta_pricing")}
            </a>
          </div>
          <p className="text-sm text-iw-ink-muted font-bold pt-2">{t("trust_line")}</p>
        </div>
      </div>
    </section>
  );
}
