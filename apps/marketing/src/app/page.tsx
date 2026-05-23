import Image from "next/image";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import {
  ArrowRight,
  Building2,
  CheckCircle2,
  LineChart,
  ShieldCheck,
  Star,
} from "lucide-react";
import { StickyHeader } from "@/components/marketing/StickyHeader";
import { Footer } from "@/components/marketing/Footer";
import { WEB_APP_URL } from "@/lib/constants";
import { getSensoryModeFromCookies } from "@/lib/sensory-mode.server";

/**
 * Home page — Inclusive Lab — Warm rollout.
 *
 * All copy is sourced from `marketing.home.*` translations and is
 * locale-aware via the aivo_locale cookie (see apps/marketing/src/i18n).
 *
 * The hero headline "Learning that adapts to your child." is split into
 * three keys (hero_headline_pre / hero_headline_emph / hero_headline_post)
 * so the gradient/underline can sit around the emphasized word. The
 * production smoke check in scripts/marketing-markers.sh asserts the
 * two halves on either side of the emphasized word; keep the English
 * values of hero_headline_pre ("Learning that") and hero_headline_post
 * ("to your child.") in sync with that script.
 */
export default async function Home() {
  const sensoryMode = await getSensoryModeFromCookies();
  const t = await getTranslations("marketing.home");

  const heroFeatures = [
    {
      title: t("philosophy_feature_tutors_title"),
      desc: t("philosophy_feature_tutors_desc"),
    },
    {
      title: t("philosophy_feature_levels_title"),
      desc: t("philosophy_feature_levels_desc"),
    },
    {
      title: t("philosophy_feature_sensory_title"),
      desc: t("philosophy_feature_sensory_desc"),
    },
  ];

  return (
    <div className="min-h-screen bg-white text-slate-900">
      <StickyHeader initialSensoryMode={sensoryMode} />

      <main>
        {/* Hero */}
        <section className="pt-20 pb-24 md:pt-24 md:pb-32 overflow-hidden relative">
          <div
            className="absolute top-0 right-0 -translate-y-16 translate-x-1/4 w-[640px] h-[640px] rounded-full blur-3xl -z-10"
            style={{ backgroundColor: "rgba(124, 58, 237, 0.10)" }}
            aria-hidden="true"
          />
          <div
            className="absolute bottom-0 left-0 translate-y-1/3 -translate-x-1/3 w-[520px] h-[520px] rounded-full blur-3xl -z-10"
            style={{ backgroundColor: "rgba(59, 130, 246, 0.06)" }}
            aria-hidden="true"
          />

          <div className="max-w-6xl mx-auto px-6 md:px-8 grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">
            <div className="max-w-2xl relative z-10">
              <span className="inline-flex items-center gap-2 mb-7 py-1.5 px-3.5 rounded-full border border-slate-200 bg-white text-slate-700 font-semibold text-xs tracking-wide uppercase">
                <ShieldCheck className="w-3.5 h-3.5 text-[var(--aivo-sensory-primary)]" aria-hidden="true" />
                {t("hero_badge")}
              </span>
              <h1 className="font-heading text-4xl md:text-6xl font-bold tracking-tight leading-[1.05] mb-7 text-slate-900">
                {t("hero_headline_pre")}{" "}
                <span className="relative inline-block">
                  <span
                    className="relative z-10 bg-clip-text text-transparent"
                    style={{
                      backgroundImage: "linear-gradient(135deg, var(--aivo-calmSky-500) 0%, var(--aivo-aivoPurple-400) 100%)",
                    }}
                  >
                    {t("hero_headline_emph")}
                  </span>
                </span>{" "}
                {t("hero_headline_post")}
              </h1>
              <p className="text-lg md:text-xl text-slate-600 mb-9 leading-relaxed font-medium">
                {t("hero_body")}
              </p>
              <div className="flex flex-col sm:flex-row gap-3">
                <a
                  href={`${WEB_APP_URL}/signup?plan=family`}
                  className="inline-flex items-center justify-center h-12 px-6 text-[15px] rounded-xl bg-[var(--aivo-sensory-primary)] hover:brightness-110 text-white font-semibold shadow-[0_6px_20px_-6px_rgba(124,58,237,0.45)] transition min-h-[44px]"
                >
                  {t("hero_cta_primary")}
                  <ArrowRight className="ml-2 w-4 h-4" aria-hidden="true" />
                </a>
                <Link
                  href="/for-districts"
                  className="inline-flex items-center justify-center h-12 px-6 text-[15px] rounded-xl bg-white border border-slate-200 hover:border-slate-300 hover:bg-slate-50 text-slate-900 font-semibold transition min-h-[44px]"
                >
                  <Building2 className="w-4 h-4 mr-2" aria-hidden="true" />
                  {t("hero_cta_secondary")}
                </Link>
              </div>
              <div className="mt-9 flex items-center gap-4 text-sm font-medium text-slate-600">
                <div className="flex -space-x-3" aria-hidden="true">
                  <div className="w-10 h-10 rounded-full border-2 border-white bg-[var(--aivo-calmSky-100)] flex items-center justify-center text-[var(--aivo-calmSky-800)] font-bold text-xs">
                    S
                  </div>
                  <div className="w-10 h-10 rounded-full border-2 border-white bg-[var(--aivo-sunshine-100)] flex items-center justify-center text-[var(--aivo-sunshine-800)] font-bold text-xs">
                    M
                  </div>
                  <div className="w-10 h-10 rounded-full border-2 border-white bg-[var(--aivo-aivoPurple-100)] flex items-center justify-center text-[var(--aivo-aivoPurple-800)] font-bold text-xs">
                    J
                  </div>
                </div>
                <p>{t("hero_trusted")}</p>
              </div>
            </div>

            <div className="relative">
              <div
                className="absolute inset-0 rounded-[2rem] scale-[1.02] -z-10 bg-gradient-to-br from-indigo-100/50 via-white to-sky-100/40"
                aria-hidden="true"
              />
              <Image
                src="/images/hero/girl-laptop.png"
                alt={t("hero_image_alt")}
                width={720}
                height={720}
                priority
                className="rounded-[2rem] shadow-[0_30px_60px_-30px_rgba(15,23,42,0.30)] w-full object-cover border border-slate-200/60 aspect-square"
              />

              {/* Floating stat card */}
              <div className="absolute -bottom-5 -left-4 md:-bottom-7 md:-left-7 w-64 md:w-72 rounded-2xl bg-white shadow-[0_20px_45px_-20px_rgba(15,23,42,0.25)] border border-slate-200/80 p-5 flex items-start gap-4">
                <div className="w-11 h-11 rounded-xl bg-indigo-50 flex items-center justify-center shrink-0">
                  <LineChart className="w-5 h-5 text-indigo-600" aria-hidden="true" />
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-1">
                    {t("stat_focus_label")}
                  </p>
                  <p className="text-2xl md:text-3xl font-bold tracking-tight text-indigo-600 tabular-nums">
                    +47.2%
                  </p>
                  <p className="text-xs font-medium text-slate-500 mt-1">
                    {t("stat_focus_caption")}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Research banner */}
        <section
          className="py-14 border-y border-slate-200/70"
          aria-labelledby="research-heading"
        >
          <div className="max-w-6xl mx-auto px-6 md:px-8">
            <h2
              id="research-heading"
              className="text-center text-[11px] font-semibold tracking-[0.18em] text-slate-500 uppercase mb-8"
            >
              {t("research_heading")}
            </h2>
            <div className="flex flex-wrap justify-center items-center gap-x-12 gap-y-4 md:gap-x-20 text-slate-700/70">
              <span className="font-heading text-base md:text-lg font-semibold tracking-tight">
                Stanford University
              </span>
              <span className="font-heading text-base md:text-lg font-semibold tracking-tight">
                MIT Media Lab
              </span>
              <span className="font-heading text-base md:text-lg font-semibold tracking-tight">
                CAST
              </span>
              <span className="font-heading text-base md:text-lg font-semibold tracking-tight">
                Johns Hopkins
              </span>
            </div>
          </div>
        </section>

        {/* Philosophy */}
        <section className="py-24 md:py-32" id="features" aria-labelledby="philosophy-heading">
          <div className="max-w-6xl mx-auto px-6 md:px-8 grid md:grid-cols-2 gap-16 md:gap-20 items-center">
            <div className="relative order-2 md:order-1">
              <div
                className="absolute inset-0 rounded-[2rem] scale-[1.02] -z-10 bg-gradient-to-br from-sky-100/40 via-white to-indigo-100/40"
                aria-hidden="true"
              />
              <Image
                src="/images/hero/boy-tablet.png"
                alt={t("philosophy_image_alt")}
                width={640}
                height={640}
                className="rounded-[2rem] shadow-[0_30px_60px_-30px_rgba(15,23,42,0.25)] w-full object-cover border border-slate-200/60 aspect-square"
              />
            </div>
            <div className="order-1 md:order-2">
              <h2
                id="philosophy-heading"
                className="font-heading text-3xl md:text-5xl font-bold mb-8 leading-tight text-slate-900"
              >
                {t("philosophy_heading_line1")}
                <br />
                <span className="text-slate-500">{t("philosophy_heading_line2")}</span>
              </h2>
              <p className="text-lg md:text-xl text-slate-600 mb-10 leading-relaxed font-medium">
                {t("philosophy_body")}
              </p>

              <ul className="space-y-6">
                {heroFeatures.map((feature) => (
                  <li key={feature.title} className="flex gap-4">
                    <div className="mt-0.5 bg-indigo-50 p-2.5 rounded-xl h-fit shrink-0">
                      <CheckCircle2 className="w-5 h-5 text-indigo-600" aria-hidden="true" />
                    </div>
                    <div>
                      <h3 className="font-heading font-bold text-lg mb-1 text-slate-900">
                        {feature.title}
                      </h3>
                      <p className="text-slate-600 font-medium">{feature.desc}</p>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </section>

        {/* Testimonials */}
        <section className="py-24 md:py-32 bg-slate-50/60 border-y border-slate-200/70" aria-labelledby="testimonials-heading">
          <div className="max-w-6xl mx-auto px-6 md:px-8">
            <div className="flex flex-col items-center text-center mb-14 md:mb-16">
              <span className="mb-5 py-1 px-3 rounded-full bg-white border border-slate-200 text-slate-700 text-[11px] font-semibold tracking-wide uppercase">
                {t("testimonials_badge")}
              </span>
              <h2
                id="testimonials-heading"
                className="font-heading text-3xl md:text-5xl font-bold text-slate-900 tracking-tight"
              >
                {t("testimonials_heading")}
              </h2>
            </div>

            <div className="grid md:grid-cols-2 gap-6 md:gap-8 max-w-6xl mx-auto">
              <article className="bg-white border border-slate-200 shadow-[0_2px_8px_-2px_rgba(15,23,42,0.06)] rounded-2xl p-8 md:p-10">
                <div className="flex gap-1 mb-6" role="img" aria-label={t("testimonials_star_alt")}>
                  {[...Array(5)].map((_, i) => (
                    <Star
                      key={i}
                      className="w-4 h-4 fill-amber-400 text-amber-400"
                      aria-hidden="true"
                    />
                  ))}
                </div>
                <p className="text-base md:text-lg mb-8 leading-relaxed font-medium text-slate-700">
                  {t("testimonial_1_quote")}
                </p>
                <div className="flex items-center gap-3">
                  <div className="w-11 h-11 rounded-full bg-slate-100 flex items-center justify-center font-bold text-sm text-slate-700">
                    S.T.
                  </div>
                  <div>
                    <p className="font-bold text-slate-900">{t("testimonial_1_name")}</p>
                    <p className="text-sm font-medium text-slate-500">{t("testimonial_1_role")}</p>
                  </div>
                </div>
              </article>

              <article className="bg-white border border-slate-200 shadow-[0_2px_8px_-2px_rgba(15,23,42,0.06)] rounded-2xl p-8 md:p-10">
                <div className="flex gap-1 mb-6" role="img" aria-label={t("testimonials_star_alt")}>
                  {[...Array(5)].map((_, i) => (
                    <Star
                      key={i}
                      className="w-4 h-4 fill-amber-400 text-amber-400"
                      aria-hidden="true"
                    />
                  ))}
                </div>
                <p className="text-base md:text-lg mb-8 leading-relaxed font-medium text-slate-700">
                  {t("testimonial_2_quote")}
                </p>
                <div className="flex items-center gap-3">
                  <div className="w-11 h-11 rounded-full bg-indigo-50 flex items-center justify-center font-bold text-sm text-indigo-700">
                    M.R.
                  </div>
                  <div>
                    <p className="font-bold text-slate-900">{t("testimonial_2_name")}</p>
                    <p className="text-sm font-medium text-slate-500">
                      {t("testimonial_2_role")}
                    </p>
                  </div>
                </div>
              </article>
            </div>
          </div>
        </section>

        {/* CTA */}
        <section className="py-24 md:py-32" aria-labelledby="cta-heading">
          <div className="max-w-6xl mx-auto px-6 md:px-8">
            <div
              className="text-white shadow-[0_30px_80px_-30px_rgba(76,29,149,0.45)] rounded-3xl md:rounded-[2rem] overflow-hidden border-0 relative bg-gradient-to-br from-[var(--aivo-sensory-primary)] to-indigo-800"
            >
              <div
                className="absolute top-0 right-0 w-[600px] h-[600px] rounded-full blur-3xl -translate-y-1/2 translate-x-1/3"
                style={{ backgroundColor: "rgba(255, 255, 255, 0.10)" }}
                aria-hidden="true"
              />
              <div className="relative z-10 grid md:grid-cols-2">
                <div className="p-10 md:p-16 lg:p-20 flex flex-col justify-center">
                  <h2
                    id="cta-heading"
                    className="font-heading text-3xl md:text-5xl font-bold mb-6 leading-tight tracking-tight"
                  >
                    {t("cta_heading")}
                  </h2>
                  <p className="text-white/85 mb-9 text-base md:text-lg font-medium leading-relaxed">
                    {t("cta_body")}
                  </p>
                  <div className="flex flex-col sm:flex-row gap-3">
                    <a
                      href={`${WEB_APP_URL}/signup?plan=family`}
                      className="inline-flex items-center justify-center h-12 bg-white text-[var(--aivo-sensory-primary)] hover:bg-slate-50 rounded-xl text-[15px] font-bold px-6 min-h-[44px] transition"
                    >
                      {t("cta_primary")}
                    </a>
                    <Link
                      href="/for-districts"
                      className="inline-flex items-center justify-center h-12 text-white border border-white/30 hover:bg-white/10 rounded-xl text-[15px] font-semibold px-6 min-h-[44px] transition"
                    >
                      {t("cta_secondary")}
                    </Link>
                  </div>
                </div>
                <div className="hidden md:flex items-center justify-center p-12 lg:p-16 relative">
                  <Image
                    src="/images/hero/mother-son-sofa.webp"
                    alt={t("cta_image_alt")}
                    width={560}
                    height={560}
                    className="w-full max-w-md object-cover rounded-2xl shadow-[0_30px_60px_-20px_rgba(0,0,0,0.4)] aspect-square"
                  />
                </div>
              </div>
            </div>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}
