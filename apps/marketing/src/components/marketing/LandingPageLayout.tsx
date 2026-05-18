import Image from "next/image";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { WEB_APP_URL } from "@/lib/constants";
import { Breadcrumbs, breadcrumbJsonLd, type Crumb } from "./Breadcrumbs";

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

export function LandingPageLayout({
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
  return (
    <div className="min-h-screen bg-white">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(breadcrumbJsonLd(breadcrumbs)),
        }}
      />

      <header className="bg-white border-b border-slate-100 sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-6 md:px-8 py-3 flex items-center justify-between">
          <Link href="/" className="flex items-center" aria-label="AIVO Learning home">
            <Image
              src="/images/aivo-logo-purple.png"
              alt=""
              width={130}
              height={40}
              priority
              style={{ width: "auto", height: "auto" }}
            />
          </Link>
          <nav className="hidden md:flex items-center gap-6 text-sm font-bold text-slate-600">
            <Link href="/#features" className="hover:text-primary transition">
              Features
            </Link>
            <Link href="/tutors" className="hover:text-primary transition">
              Tutors
            </Link>
            <Link href="/levels" className="hover:text-primary transition">
              Levels
            </Link>
            <Link href="/#pricing" className="hover:text-primary transition">
              Pricing
            </Link>
            <Link href="/contact" className="hover:text-primary transition">
              Contact
            </Link>
          </nav>
          <a
            href={primaryCtaHref}
            className="px-5 py-2.5 rounded-full bg-primary text-white font-bold hover:bg-primary-dark transition shadow-lg shadow-purple-200 min-h-[44px] inline-flex items-center"
          >
            Get Started
          </a>
        </div>
      </header>

      <div
        className="relative overflow-hidden py-12 md:py-16"
        style={{
          background: `linear-gradient(135deg, ${badgeColor}10 0%, ${badgeColor}05 50%, #ffffff 100%)`,
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
          <h1 className="text-4xl md:text-5xl font-heading font-bold text-slate-900 mb-4 leading-tight">
            {title}
          </h1>
          <p className="text-lg text-slate-600 font-body max-w-2xl mb-6 leading-relaxed">
            {subtitle}
          </p>
          <div className="flex flex-col sm:flex-row gap-3">
            <a
              href={primaryCtaHref}
              className="group inline-flex items-center justify-center gap-2 px-7 py-3.5 rounded-full bg-gradient-to-r from-primary to-primary-dark text-white font-bold hover:opacity-95 transition shadow-lg shadow-purple-200 min-h-[44px]"
            >
              {primaryCtaLabel}
              <ArrowRight
                className="w-4 h-4 group-hover:translate-x-1 transition-transform"
                aria-hidden="true"
              />
            </a>
            <Link
              href={secondaryCtaHref}
              className="inline-flex items-center justify-center px-7 py-3.5 rounded-full border-2 border-slate-200 bg-white text-slate-700 font-bold hover:bg-slate-50 transition min-h-[44px]"
            >
              {secondaryCtaLabel}
            </Link>
          </div>
        </div>
      </div>

      <main className="max-w-4xl mx-auto px-6 md:px-8 py-12 md:py-16 prose-aivo">{children}</main>

      <section className="bg-gradient-to-br from-purple-50 to-white border-t border-slate-100">
        <div className="max-w-4xl mx-auto px-6 md:px-8 py-14 text-center">
          <h2 className="text-2xl md:text-3xl font-heading font-bold text-slate-900 mb-3">
            {finalCta?.title ?? "Ready to give every learner a tutor that actually adapts?"}
          </h2>
          <p className="text-slate-600 font-body mb-6 max-w-2xl mx-auto">
            {finalCta?.body ??
              "Start free in under two minutes. No credit card. Cancel anytime. 30-day money-back guarantee on paid plans."}
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <a
              href={finalCta?.primary.href ?? primaryCtaHref}
              className="inline-flex items-center justify-center gap-2 px-7 py-3.5 rounded-full bg-gradient-to-r from-primary to-primary-dark text-white font-bold hover:opacity-95 transition shadow-lg shadow-purple-200 min-h-[44px]"
            >
              {finalCta?.primary.label ?? primaryCtaLabel}
              <ArrowRight className="w-4 h-4" aria-hidden="true" />
            </a>
            <Link
              href={finalCta?.secondary.href ?? "/#pricing"}
              className="inline-flex items-center justify-center px-7 py-3.5 rounded-full border-2 border-slate-200 bg-white text-slate-700 font-bold hover:bg-slate-50 transition min-h-[44px]"
            >
              {finalCta?.secondary.label ?? "See pricing"}
            </Link>
          </div>
        </div>
      </section>

      <footer className="bg-slate-900 py-8">
        <div className="max-w-6xl mx-auto px-6 md:px-8 flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-6">
            <Image
              src="/images/aivo-logo-white.png"
              alt="AIVO"
              width={100}
              height={30}
              style={{ width: "auto", height: "auto" }}
            />
            <nav className="hidden md:flex items-center gap-4">
              <Link href="/about" className="text-sm text-slate-400 hover:text-white transition">
                About
              </Link>
              <Link href="/blog" className="text-sm text-slate-400 hover:text-white transition">
                Blog
              </Link>
              <Link href="/contact" className="text-sm text-slate-400 hover:text-white transition">
                Contact
              </Link>
              <Link
                href="/privacy-policy"
                className="text-sm text-slate-400 hover:text-white transition"
              >
                Privacy
              </Link>
              <Link
                href="/terms-of-service"
                className="text-sm text-slate-400 hover:text-white transition"
              >
                Terms
              </Link>
            </nav>
          </div>
          <p className="text-sm text-slate-500 font-body">
            &copy; {new Date().getFullYear()} AIVO Learning Platform
          </p>
        </div>
      </footer>
    </div>
  );
}
