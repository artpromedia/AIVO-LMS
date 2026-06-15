import Image from "next/image";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import {
  Accessibility,
  ArrowRight,
  Brain,
  Building2,
  ClipboardCheck,
  FileCheck2,
  GraduationCap,
  LayoutDashboard,
  LineChart,
  Lock,
  MessagesSquare,
  PlayCircle,
  Presentation,
  School,
  ShieldCheck,
  Target,
  UserCheck,
  Users,
} from "lucide-react";
import { StickyHeader } from "@/components/marketing/StickyHeader";
import { Footer } from "@/components/marketing/Footer";
import { HomeHeroDevice } from "@/components/marketing/home/HomeHeroDevice";
import { LearnerFunctionShowcase } from "@/components/marketing/home/LearnerFunctionShowcase";
import { WEB_APP_URL } from "@/lib/constants";
import { getSensoryModeFromCookies } from "@/lib/sensory-mode.server";

/**
 * Home page — "A calmer, more personal way to learn" redesign.
 *
 * All marketing copy is sourced from `marketing.home.*` translations and is
 * locale-aware via the aivo_locale cookie (see apps/marketing/src/i18n).
 *
 * The hero headline is split into hero_headline_pre / hero_headline_emph /
 * hero_headline_post so the gradient can sit around the emphasized word. The
 * production smoke check in scripts/marketing-markers.sh asserts the stable
 * substrings "calmer, more personal way to" (hero) and "Everything needed to
 * support" (features section); keep those English values in sync with it.
 */
export default async function Home() {
  const sensoryMode = await getSensoryModeFromCookies();
  const t = await getTranslations("marketing.home");

  const signupHref = `${WEB_APP_URL}/signup?plan=free`;

  const adultViews = [
    {
      Icon: Users,
      title: t("view_parents_title"),
      desc: t("view_parents_desc"),
      cta: t("view_parents_cta"),
      href: "/for-parents",
    },
    {
      Icon: GraduationCap,
      title: t("view_teachers_title"),
      desc: t("view_teachers_desc"),
      cta: t("view_teachers_cta"),
      href: "/for-teachers",
    },
    {
      Icon: School,
      title: t("view_schools_title"),
      desc: t("view_schools_desc"),
      cta: t("view_schools_cta"),
      href: "/for-schools",
    },
  ];

  const steps = [1, 2, 3, 4].map((n) => ({
    n,
    title: t(`step_${n}_title`),
    desc: t(`step_${n}_desc`),
  }));

  const featureIcons = [
    Brain,
    ClipboardCheck,
    Target,
    LayoutDashboard,
    Presentation,
    Building2,
    LineChart,
    MessagesSquare,
  ];
  const features = featureIcons.map((Icon, i) => ({
    Icon,
    title: t(`feat_${i + 1}_title`),
    desc: t(`feat_${i + 1}_desc`),
  }));

  const showcasePanels = [1, 2, 3, 4].map((n) => ({
    title: t(`panel_${n}_title`),
    caption: t(`panel_${n}_caption`),
  })) as [
    { title: string; caption: string },
    { title: string; caption: string },
    { title: string; caption: string },
    { title: string; caption: string },
  ];

  const testimonials = [1, 2, 3].map((n) => ({
    quote: t(`testimonial_${n}_quote`),
    author: t(`testimonial_${n}_author`),
  }));

  const trustItems = [
    { Icon: UserCheck, n: 1, href: "/privacy-policy" },
    { Icon: ShieldCheck, n: 2, href: "/coppa-compliance" },
    { Icon: FileCheck2, n: 3, href: "/ferpa-compliance" },
    { Icon: Lock, n: 4, href: "/security" },
    { Icon: Accessibility, n: 5, href: "/accessibility" },
  ].map(({ Icon, n, href }) => ({
    Icon,
    href,
    title: t(`trust_${n}_title`),
    desc: t(`trust_${n}_desc`),
    cta: t(`trust_${n}_cta`),
  }));

  const faqs = [1, 2, 3, 4, 5, 6].map((n) => ({
    q: t(`faq_${n}_q`),
    a: t(`faq_${n}_a`),
  }));

  const trustBadges = [
    { Icon: ShieldCheck, label: "COPPA-Aware" },
    { Icon: FileCheck2, label: "FERPA-Aware" },
    { Icon: Lock, label: "SOC 2 Aligned" },
    { Icon: Accessibility, label: "WCAG 2.2 AA" },
  ];

  return (
    <div className="min-h-screen bg-white text-slate-900">
      <StickyHeader initialSensoryMode={sensoryMode} />

      <main>
        {/* Hero */}
        <section className="relative overflow-hidden bg-gradient-to-b from-[var(--aivo-aivoPurple-100)]/40 via-white to-white pt-16 pb-28 md:pt-24">
          <div
            className="absolute right-0 top-0 -z-10 h-[640px] w-[640px] -translate-y-24 translate-x-1/3 rounded-full bg-purple-200/30 blur-3xl"
            aria-hidden="true"
          />
          <div className="mx-auto grid max-w-6xl items-center gap-16 px-6 md:px-8 lg:grid-cols-2">
            <div className="max-w-xl">
              <span className="mb-6 inline-flex items-center gap-2 rounded-full border border-purple-100 bg-white px-3.5 py-1.5 text-xs font-semibold uppercase tracking-wide text-[var(--aivo-sensory-primary)]">
                <Brain className="h-3.5 w-3.5" aria-hidden="true" />
                {t("hero_eyebrow")}
              </span>
              <h1 className="font-heading text-4xl font-bold leading-[1.08] tracking-tight text-slate-900 md:text-6xl">
                {t("hero_headline_pre")}{" "}
                <span
                  className="bg-clip-text text-transparent"
                  style={{
                    backgroundImage:
                      "linear-gradient(135deg, var(--aivo-aivoPurple-400) 0%, var(--aivo-aivoPurple-600) 100%)",
                  }}
                >
                  {t("hero_headline_emph")}
                </span>
                {t("hero_headline_post")}
              </h1>
              <p className="mt-6 text-lg font-medium leading-relaxed text-slate-600 md:text-xl">
                {t("hero_body")}
              </p>
              <div className="mt-9 flex flex-col gap-3 sm:flex-row">
                <a
                  href={signupHref}
                  className="inline-flex min-h-[44px] items-center justify-center rounded-xl bg-[var(--aivo-sensory-primary)] px-6 text-[15px] font-semibold text-white shadow-[0_10px_30px_-8px_rgba(124,58,237,0.55)] transition hover:brightness-110"
                >
                  {t("hero_cta_primary")}
                  <ArrowRight className="ml-2 h-4 w-4" aria-hidden="true" />
                </a>
                <Link
                  href="/demo"
                  className="inline-flex min-h-[44px] items-center justify-center rounded-xl border border-slate-200 bg-white px-6 text-[15px] font-semibold text-slate-900 transition hover:border-slate-300 hover:bg-slate-50"
                >
                  <PlayCircle className="mr-2 h-4 w-4" aria-hidden="true" />
                  {t("hero_cta_secondary")}
                </Link>
              </div>
              <p className="mt-7 text-sm font-medium text-slate-500">{t("hero_trust_line")}</p>
            </div>

            <div className="lg:pl-6">
              <HomeHeroDevice />
            </div>
          </div>
        </section>

        {/* Trust badge strip */}
        <section aria-label="Privacy and accessibility commitments" className="border-y border-slate-100 bg-white py-8">
          <div className="mx-auto max-w-6xl px-6 md:px-8">
            <ul className="grid grid-cols-2 gap-4 md:grid-cols-4">
              {trustBadges.map(({ Icon, label }) => (
                <li
                  key={label}
                  className="flex items-center justify-center gap-2.5 rounded-2xl border border-slate-100 bg-slate-50/70 px-4 py-3"
                >
                  <Icon className="h-5 w-5 text-[var(--aivo-sensory-primary)]" aria-hidden="true" />
                  <span className="text-sm font-bold text-slate-800">{label}</span>
                </li>
              ))}
            </ul>
            <p className="mt-5 text-center text-sm font-medium text-slate-500">
              {t("trust_strip_caption")}
            </p>
          </div>
        </section>

        {/* Three adult views */}
        <section className="py-20 md:py-28" aria-labelledby="views-heading">
          <div className="mx-auto max-w-6xl px-6 md:px-8">
            <h2
              id="views-heading"
              className="mx-auto max-w-3xl text-center font-heading text-3xl font-bold tracking-tight text-slate-900 md:text-4xl"
            >
              {t("views_heading")}
            </h2>
            <div className="mt-14 grid gap-6 md:grid-cols-3">
              {adultViews.map(({ Icon, title, desc, cta, href }) => (
                <article
                  key={title}
                  className="flex flex-col rounded-3xl border border-slate-200/70 bg-white p-7 shadow-[0_18px_50px_-32px_rgba(15,23,42,0.3)]"
                >
                  <span className="mb-5 inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-purple-50 text-[var(--aivo-sensory-primary)]">
                    <Icon className="h-6 w-6" aria-hidden="true" />
                  </span>
                  <h3 className="font-heading text-xl font-bold text-slate-900">{title}</h3>
                  <p className="mt-3 flex-1 font-medium leading-relaxed text-slate-600">{desc}</p>
                  <Link
                    href={href}
                    className="mt-6 inline-flex items-center gap-1.5 text-sm font-semibold text-[var(--aivo-sensory-primary)] hover:gap-2.5 transition-all"
                  >
                    {cta}
                    <ArrowRight className="h-4 w-4" aria-hidden="true" />
                  </Link>
                </article>
              ))}
            </div>
          </div>
        </section>

        {/* How AIVO adapts support — 4 steps */}
        <section
          className="bg-[var(--aivo-cloud-50)] py-20 md:py-28"
          aria-labelledby="steps-heading"
        >
          <div className="mx-auto max-w-6xl px-6 md:px-8">
            <h2
              id="steps-heading"
              className="mx-auto max-w-3xl text-center font-heading text-3xl font-bold tracking-tight text-slate-900 md:text-4xl"
            >
              {t("steps_heading")}
            </h2>
            <ol className="mt-14 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
              {steps.map(({ n, title, desc }) => (
                <li
                  key={n}
                  className="relative rounded-3xl border border-slate-200/70 bg-white p-7"
                >
                  <span className="mb-5 inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-[var(--aivo-sensory-primary)] font-heading text-lg font-bold text-white">
                    {n}
                  </span>
                  <h3 className="font-heading text-lg font-bold text-slate-900">{title}</h3>
                  <p className="mt-2 text-sm font-medium leading-relaxed text-slate-600">{desc}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        {/* Features — 8 cards */}
        <section className="py-20 md:py-28" aria-labelledby="features-heading">
          <div className="mx-auto max-w-6xl px-6 md:px-8">
            <div className="mx-auto max-w-3xl text-center">
              <h2
                id="features-heading"
                className="font-heading text-3xl font-bold tracking-tight text-slate-900 md:text-4xl"
              >
                {t("features_heading")}
              </h2>
              <p className="mt-4 text-lg font-medium text-slate-600">{t("features_subheading")}</p>
            </div>
            <div className="mt-14 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
              {features.map(({ Icon, title, desc }) => (
                <article
                  key={title}
                  className="rounded-3xl border border-slate-200/70 bg-white p-6 transition hover:border-purple-200 hover:shadow-[0_18px_50px_-32px_rgba(124,58,237,0.4)]"
                >
                  <span className="mb-4 inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-purple-50 text-[var(--aivo-sensory-primary)]">
                    <Icon className="h-5 w-5" aria-hidden="true" />
                  </span>
                  <h3 className="font-heading text-base font-bold text-slate-900">{title}</h3>
                  <p className="mt-2 text-sm font-medium leading-relaxed text-slate-600">{desc}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        {/* Built around how each learner functions */}
        <section
          className="bg-[var(--aivo-cloud-50)] py-20 md:py-28"
          aria-labelledby="functions-heading"
        >
          <div className="mx-auto max-w-6xl px-6 md:px-8">
            <div className="mx-auto max-w-3xl text-center">
              <h2
                id="functions-heading"
                className="font-heading text-3xl font-bold tracking-tight text-slate-900 md:text-4xl"
              >
                {t("functions_heading")}
              </h2>
              <p className="mt-4 text-lg font-medium text-slate-600">{t("functions_subheading")}</p>
            </div>
            <div className="mt-14">
              <LearnerFunctionShowcase panels={showcasePanels} />
            </div>
          </div>
        </section>

        {/* Testimonials */}
        <section className="py-20 md:py-28" aria-labelledby="testimonials-heading">
          <div className="mx-auto max-w-6xl px-6 md:px-8">
            <h2
              id="testimonials-heading"
              className="mx-auto max-w-3xl text-center font-heading text-3xl font-bold tracking-tight text-slate-900 md:text-4xl"
            >
              {t("testimonials_heading")}
            </h2>
            <div className="mt-14 grid gap-6 md:grid-cols-3">
              {testimonials.map(({ quote, author }) => (
                <figure
                  key={author}
                  className="flex flex-col rounded-3xl border border-slate-200/70 bg-white p-7 shadow-[0_18px_50px_-32px_rgba(15,23,42,0.25)]"
                >
                  <blockquote className="flex-1 text-base font-medium leading-relaxed text-slate-700">
                    &ldquo;{quote}&rdquo;
                  </blockquote>
                  <figcaption className="mt-6 flex items-center gap-3">
                    <span className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-purple-50 text-[var(--aivo-sensory-primary)]">
                      <UserCheck className="h-5 w-5" aria-hidden="true" />
                    </span>
                    <span className="text-sm font-semibold text-slate-600">{author}</span>
                  </figcaption>
                </figure>
              ))}
            </div>
          </div>
        </section>

        {/* Trust details */}
        <section
          className="bg-[var(--aivo-cloud-50)] py-20 md:py-28"
          aria-labelledby="trust-heading"
        >
          <div className="mx-auto max-w-6xl px-6 md:px-8">
            <h2
              id="trust-heading"
              className="mx-auto max-w-3xl text-center font-heading text-3xl font-bold tracking-tight text-slate-900 md:text-4xl"
            >
              {t("trust_heading")}
            </h2>
            <div className="mt-14 grid gap-6 sm:grid-cols-2 lg:grid-cols-5">
              {trustItems.map(({ Icon, title, desc, cta, href }) => (
                <article
                  key={title}
                  className="flex flex-col rounded-3xl border border-slate-200/70 bg-white p-6"
                >
                  <span className="mb-4 inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-purple-50 text-[var(--aivo-sensory-primary)]">
                    <Icon className="h-5 w-5" aria-hidden="true" />
                  </span>
                  <h3 className="font-heading text-base font-bold text-slate-900">{title}</h3>
                  <p className="mt-2 flex-1 text-sm font-medium leading-relaxed text-slate-600">
                    {desc}
                  </p>
                  <Link
                    href={href}
                    className="mt-4 inline-flex items-center gap-1.5 text-sm font-semibold text-[var(--aivo-sensory-primary)] hover:gap-2.5 transition-all"
                  >
                    {cta}
                    <ArrowRight className="h-4 w-4" aria-hidden="true" />
                  </Link>
                </article>
              ))}
            </div>
          </div>
        </section>

        {/* FAQ */}
        <section className="py-20 md:py-28" aria-labelledby="faq-heading">
          <div className="mx-auto max-w-6xl px-6 md:px-8">
            <h2
              id="faq-heading"
              className="mx-auto max-w-3xl text-center font-heading text-3xl font-bold tracking-tight text-slate-900 md:text-4xl"
            >
              {t("faq_heading")}
            </h2>
            <div className="mx-auto mt-14 grid max-w-5xl gap-6 md:grid-cols-2">
              {faqs.map(({ q, a }) => (
                <div key={q} className="rounded-3xl border border-slate-200/70 bg-white p-6">
                  <h3 className="font-heading text-base font-bold text-slate-900">{q}</h3>
                  <p className="mt-2 text-sm font-medium leading-relaxed text-slate-600">{a}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Final CTA */}
        <section className="px-6 pb-24 md:px-8" aria-labelledby="cta-heading">
          <div className="relative mx-auto max-w-6xl overflow-hidden rounded-[2rem] bg-gradient-to-br from-[var(--aivo-sensory-primary)] to-indigo-800 px-8 py-16 text-white shadow-[0_40px_90px_-40px_rgba(76,29,149,0.6)] md:px-16 md:py-20">
            <div
              className="absolute right-0 top-0 h-[480px] w-[480px] -translate-y-1/3 translate-x-1/4 rounded-full bg-white/10 blur-3xl"
              aria-hidden="true"
            />
            <div className="relative z-10 flex flex-col items-center gap-10 text-center md:flex-row md:justify-between md:text-left">
              <div className="max-w-xl">
                <h2
                  id="cta-heading"
                  className="font-heading text-3xl font-bold leading-tight tracking-tight md:text-5xl"
                >
                  {t("cta_heading")}
                </h2>
                <p className="mt-5 text-base font-medium leading-relaxed text-white/85 md:text-lg">
                  {t("cta_body")}
                </p>
                <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row md:justify-start">
                  <a
                    href={signupHref}
                    className="inline-flex min-h-[44px] items-center justify-center rounded-xl bg-white px-6 text-[15px] font-bold text-[var(--aivo-sensory-primary)] transition hover:bg-slate-50"
                  >
                    {t("cta_primary")}
                  </a>
                  <Link
                    href="/demo"
                    className="inline-flex min-h-[44px] items-center justify-center rounded-xl border border-white/30 px-6 text-[15px] font-semibold text-white transition hover:bg-white/10"
                  >
                    {t("cta_secondary")}
                  </Link>
                </div>
              </div>
              <Image
                src="/images/mascot/virtual-brain-robot.png"
                alt=""
                width={220}
                height={220}
                className="h-40 w-40 shrink-0 drop-shadow-[0_25px_40px_rgba(0,0,0,0.35)] md:h-52 md:w-52"
              />
            </div>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}
