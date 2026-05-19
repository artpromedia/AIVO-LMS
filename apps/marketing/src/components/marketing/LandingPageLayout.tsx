import { ArrowRight } from "lucide-react";
import Link from "next/link";
import { WEB_APP_URL } from "@/lib/constants";
import { Breadcrumbs, breadcrumbJsonLd, type Crumb } from "./Breadcrumbs";
import { StickyHeader } from "./StickyHeader";
import { Footer } from "./Footer";
import { getSensoryModeFromCookies } from "@/lib/sensory-mode.server";

interface LandingFinalCta {
  title: string;
  body: string;
  primary: { label: string; href: string };
  secondary: { label: string; href: string };
}

interface LandingPageLayoutProps {
  badge: string;
  badgeColor?: string;
  title: string;
  subtitle: string;
  primaryCtaLabel?: string;
  primaryCtaHref?: string;
  secondaryCtaLabel?: string;
  secondaryCtaHref?: string;
  breadcrumbs: Crumb[];
  children: React.ReactNode;
  /**
   * Optional override for the closing CTA section. When omitted, the
   * shared "Ready to give every learner..." block renders. Pages with
   * their own funnel goal (pricing, waitlist, thank-you) pass a custom
   * `finalCta` so the closer points where the page wants it to.
   */
  finalCta?: LandingFinalCta;
}

/**
 * Shared chrome for ~25 secondary marketing pages (audiences, features,
 * tutors, levels, subjects, compare, pricing, waitlist, thank-you, …).
 *
 * Wraps the page body in the Inclusive Lab — Warm StickyHeader + Footer
 * so the entire marketing surface inherits the same nav (with the
 * sensory-mode pill) and footer (with the COPPA · FERPA · SOC 2 lock
 * badge) as the home page. Server component so it can read the
 * sensory-mode cookie and forward the initial value to the header.
 */
export async function LandingPageLayout({
  badge,
  badgeColor = "#7c3aed",
  title,
  subtitle,
  primaryCtaLabel = "Start free trial",
  primaryCtaHref = `${WEB_APP_URL}/signup?plan=free`,
  secondaryCtaLabel = "Talk to our team",
  secondaryCtaHref = "/contact",
  breadcrumbs,
  children,
  finalCta,
}: LandingPageLayoutProps) {
  const sensoryMode = await getSensoryModeFromCookies();

  return (
    <div className="min-h-screen bg-[var(--aivo-color-surface-canvas,#fdf6ec)]">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(breadcrumbJsonLd(breadcrumbs)),
        }}
      />

      <StickyHeader initialSensoryMode={sensoryMode} />

      <div
        className="relative overflow-hidden py-12 md:py-16"
        style={{
          background: `linear-gradient(135deg, ${badgeColor}14 0%, ${badgeColor}06 50%, transparent 100%)`,
        }}
      >
        <div className="absolute inset-0 pointer-events-none">
          <div
            className="absolute -top-20 -right-20 w-80 h-80 rounded-full blur-3xl opacity-20"
            style={{ backgroundColor: badgeColor }}
          />
        </div>
        <div className="max-w-4xl mx-auto px-6 md:px-8 relative z-10">
          <Breadcrumbs items={breadcrumbs} />
          <span
            className="inline-block text-xs font-bold uppercase tracking-widest mb-4 px-3 py-1 rounded-full"
            style={{ color: badgeColor, backgroundColor: `${badgeColor}15` }}
          >
            {badge}
          </span>
          <h1 className="font-heading text-4xl md:text-5xl font-bold text-slate-900 mb-4 leading-tight">
            {title}
          </h1>
          <p className="text-lg text-slate-600 font-body max-w-2xl mb-6 leading-relaxed">
            {subtitle}
          </p>
          <div className="flex flex-col sm:flex-row gap-3">
            <a
              href={primaryCtaHref}
              className="group inline-flex items-center justify-center gap-2 px-7 py-3.5 rounded-full bg-[var(--aivo-sensory-primary,#7c3aed)] text-white font-bold hover:opacity-90 transition shadow-lg shadow-purple-200 min-h-[44px]"
            >
              {primaryCtaLabel}
              <ArrowRight
                className="w-4 h-4 group-hover:translate-x-1 transition-transform"
                aria-hidden="true"
              />
            </a>
            <Link
              href={secondaryCtaHref}
              className="inline-flex items-center justify-center px-7 py-3.5 rounded-full border border-slate-200 bg-white text-slate-700 font-bold hover:bg-slate-50 transition min-h-[44px]"
            >
              {secondaryCtaLabel}
            </Link>
          </div>
        </div>
      </div>

      <main className="max-w-4xl mx-auto px-6 md:px-8 py-12 md:py-16 prose-aivo">{children}</main>

      <section className="bg-white/50 border-t border-slate-200/70">
        <div className="max-w-4xl mx-auto px-6 md:px-8 py-14 text-center">
          <h2 className="font-heading text-2xl md:text-3xl font-bold text-slate-900 mb-3">
            {finalCta?.title ?? "Ready to give every learner a tutor that actually adapts?"}
          </h2>
          <p className="text-slate-600 font-body mb-6 max-w-2xl mx-auto">
            {finalCta?.body ??
              "Start free in under two minutes. No credit card. Cancel anytime. 30-day money-back guarantee on paid plans."}
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <a
              href={finalCta?.primary.href ?? primaryCtaHref}
              className="inline-flex items-center justify-center gap-2 px-7 py-3.5 rounded-full bg-[var(--aivo-sensory-primary,#7c3aed)] text-white font-bold hover:opacity-90 transition shadow-lg shadow-purple-200 min-h-[44px]"
            >
              {finalCta?.primary.label ?? primaryCtaLabel}
              <ArrowRight className="w-4 h-4" aria-hidden="true" />
            </a>
            <Link
              href={finalCta?.secondary.href ?? "/pricing"}
              className="inline-flex items-center justify-center px-7 py-3.5 rounded-full border border-slate-200 bg-white text-slate-700 font-bold hover:bg-slate-50 transition min-h-[44px]"
            >
              {finalCta?.secondary.label ?? "See pricing"}
            </Link>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
}
