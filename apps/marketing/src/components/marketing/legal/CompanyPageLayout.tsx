"use client";
import Image from "next/image";
import Link from "next/link";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { trackCTAClick, trackSignupInitiation } from "@/lib/analytics";
import { WEB_APP_URL, SITE_URL } from "@/lib/constants";

interface CompanyPageLayoutProps {
  badge: string;
  title: string;
  subtitle: string;
  icon: string;
  accentColor: string;
  /** Slug for the current page, used to emit BreadcrumbList JSON-LD. Optional for backward-compat. */
  breadcrumbSlug?: string;
  /** Display label for the breadcrumb. Defaults to `badge`. */
  breadcrumbLabel?: string;
  children: React.ReactNode;
}

export function CompanyPageLayout({
  badge,
  title,
  subtitle,
  icon,
  accentColor,
  breadcrumbSlug,
  breadcrumbLabel,
  children,
}: CompanyPageLayoutProps) {
  const breadcrumbJsonLd = breadcrumbSlug
    ? {
        "@context": "https://schema.org",
        "@type": "BreadcrumbList",
        itemListElement: [
          {
            "@type": "ListItem",
            position: 1,
            name: "Home",
            item: SITE_URL,
          },
          {
            "@type": "ListItem",
            position: 2,
            name: breadcrumbLabel || badge,
            item: `${SITE_URL}/${breadcrumbSlug.replace(/^\//, "")}`,
          },
        ],
      }
    : null;

  return (
    <div className="min-h-screen bg-white">
      {breadcrumbJsonLd && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }}
        />
      )}
      <header className="bg-white border-b border-slate-100 sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-6 md:px-8 py-3 flex items-center justify-between">
          <Link href="/" className="flex items-center">
            <Image
              src="/images/aivo-logo-purple.png"
              alt="AIVO"
              width={130}
              height={40}
              priority
              style={{ width: "auto", height: "auto" }}
            />
          </Link>
          <div className="flex items-center gap-3">
            <LanguageSwitcher compact />
            <Link
              href="/"
              className="px-5 py-2 rounded-lg text-slate-600 font-semibold hover:text-primary transition hidden sm:inline-flex min-h-[44px] items-center"
            >
              Home
            </Link>
            <a
              href={`${WEB_APP_URL}/signup?plan=free`}
              onClick={() => {
                trackCTAClick("company_get_started", `${WEB_APP_URL}/signup?plan=free`);
                trackSignupInitiation("company_page");
              }}
              className="px-5 py-2.5 rounded-full bg-primary text-white font-bold hover:bg-primary-dark transition shadow-lg shadow-purple-200 min-h-[44px] inline-flex items-center"
            >
              Get Started
            </a>
          </div>
        </div>
      </header>

      <div
        className="relative overflow-hidden py-16 md:py-24"
        style={{
          background: `linear-gradient(135deg, ${accentColor}08 0%, ${accentColor}04 50%, #ffffff 100%)`,
        }}
      >
        <div className="absolute inset-0 pointer-events-none">
          <div
            className="absolute -top-20 -right-20 w-80 h-80 rounded-full blur-3xl opacity-20"
            style={{ backgroundColor: accentColor }}
          />
          <div
            className="absolute bottom-0 -left-20 w-60 h-60 rounded-full blur-3xl opacity-10"
            style={{ backgroundColor: accentColor }}
          />
        </div>
        <div className="max-w-4xl mx-auto px-6 md:px-8 relative z-10">
          <div className="flex items-center gap-3 mb-6">
            <div
              className="w-12 h-12 rounded-2xl flex items-center justify-center text-2xl shadow-lg"
              style={{ backgroundColor: `${accentColor}15` }}
            >
              {icon}
            </div>
            <span
              className="text-sm font-bold uppercase tracking-widest"
              style={{ color: accentColor }}
            >
              {badge}
            </span>
          </div>
          <h1 className="text-4xl md:text-5xl font-heading font-bold text-slate-900 mb-4 leading-tight">
            {title}
          </h1>
          <p className="text-lg text-slate-500 font-body max-w-2xl">{subtitle}</p>
        </div>
      </div>

      <main className="max-w-4xl mx-auto px-6 md:px-8 py-12 md:py-16">{children}</main>

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
              <Link href="/careers" className="text-sm text-slate-400 hover:text-white transition">
                Careers
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
