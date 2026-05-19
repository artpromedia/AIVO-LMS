import Image from "next/image";
import Link from "next/link";
import { ShieldCheck } from "lucide-react";

/**
 * Inclusive-Warm footer for unauthenticated web-v2 surfaces. Mirrors
 * apps/marketing's Footer: brand wordmark, COPPA·FERPA·SOC 2 trust pill,
 * four-column link grid, copyright. Authenticated dashboards do not
 * render this footer (AppShell handles their chrome instead).
 */
export function SiteFooter() {
  const FOOTER_SECTIONS: { title: string; links: { label: string; href: string }[] }[] = [
    {
      title: "Platform",
      links: [
        { label: "AI Tutors", href: "/learner/home" },
        { label: "Adaptive Learning", href: "/parent/home" },
        { label: "Brain Clone", href: "/parent/home" },
        { label: "Sensory Modes", href: "/settings/accessibility" },
      ],
    },
    {
      title: "Solutions",
      links: [
        { label: "For Families", href: "/parent/home" },
        { label: "For Teachers", href: "/teacher/home" },
        { label: "For Schools", href: "/admin/school" },
        { label: "For Districts", href: "/admin/district" },
      ],
    },
    {
      title: "Company",
      links: [
        { label: "About", href: "/" },
        { label: "Trust Center", href: "/" },
        { label: "Contact", href: "/" },
      ],
    },
    {
      title: "Legal",
      links: [
        { label: "Privacy Policy", href: "/" },
        { label: "Terms of Service", href: "/" },
        { label: "COPPA Compliance", href: "/" },
        { label: "FERPA Compliance", href: "/" },
        { label: "Accessibility", href: "/settings/accessibility" },
      ],
    },
  ];

  return (
    <footer className="mt-24 border-t border-iw-border bg-iw-raised/60 pb-10 pt-16">
      <div className="mx-auto max-w-6xl px-6 md:px-8">
        <div className="mb-12 grid grid-cols-2 gap-10 md:grid-cols-6">
          <div className="col-span-2">
            <Link href="/" aria-label="AIVO Learning home" className="inline-flex items-center">
              <Image
                src="/images/aivo-logo-purple.png"
                alt="AIVO Learning"
                width={160}
                height={48}
                className="h-10 w-auto"
              />
            </Link>
            <p className="mt-5 max-w-xs text-sm leading-relaxed text-iw-ink-muted">
              Engineered for the margins. Transformative for everyone.
            </p>
            <div className="mt-5 inline-flex items-center gap-2 rounded-full border border-iw-border bg-iw-accent-soft px-4 py-2 text-iw-primary">
              <ShieldCheck className="h-4 w-4" aria-hidden="true" />
              <span className="whitespace-nowrap text-sm font-semibold">
                COPPA · FERPA · SOC 2
              </span>
            </div>
          </div>

          {FOOTER_SECTIONS.map((section) => (
            <div key={section.title}>
              <h3 className="mb-4 font-iw-display text-sm font-bold text-iw-ink">
                {section.title}
              </h3>
              <ul className="space-y-2.5">
                {section.links.map((link) => (
                  <li key={`${section.title}-${link.label}`}>
                    <Link
                      href={link.href}
                      className="text-sm text-iw-ink-muted transition hover:text-iw-primary"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="flex flex-col items-center justify-between gap-4 border-t border-iw-border pt-6 md:flex-row">
          <p className="text-sm text-iw-ink-muted">
            © {new Date().getFullYear()} AIVO Learning. All rights reserved.
          </p>
          <div className="inline-flex items-center gap-2 rounded-full bg-iw-accent-soft px-4 py-2 text-iw-primary">
            <ShieldCheck className="h-4 w-4" aria-hidden="true" />
            <span className="text-sm font-semibold">Secure &amp; Compliant</span>
          </div>
        </div>
      </div>
    </footer>
  );
}
