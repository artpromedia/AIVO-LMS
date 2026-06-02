import Image from "next/image";
import Link from "next/link";
import { ShieldCheck } from "lucide-react";

/**
 * Inclusive-Warm footer for unauthenticated web-v2 surfaces. Mirrors
 * apps/marketing's Footer: brand wordmark, COPPA·FERPA·SOC 2 trust pill,
 * four-column link grid, copyright. Authenticated dashboards do not
 * render this footer (AppShell handles their chrome instead).
 *
 * Marketing routes (about, pricing, legal, etc.) live on the marketing
 * site, so those links resolve against NEXT_PUBLIC_MARKETING_URL (with
 * NEXT_PUBLIC_SITE_URL as a secondary fallback) and ship as external
 * links. App routes that exist inside web-v2 stay internal.
 */
const MARKETING_SITE = (
  process.env.NEXT_PUBLIC_MARKETING_URL ??
  process.env.NEXT_PUBLIC_SITE_URL ??
  "https://aivolearning.com"
).replace(/\/+$/, "");

function marketingHref(path: string) {
  return `${MARKETING_SITE}${path.startsWith("/") ? path : `/${path}`}`;
}

type FooterLink = { label: string; href: string; external?: boolean };
type FooterSection = { title: string; links: FooterLink[] };

export function SiteFooter() {
  const FOOTER_SECTIONS: FooterSection[] = [
    {
      title: "Platform",
      links: [
        { label: "Features", href: marketingHref("/#features"), external: true },
        { label: "Pricing", href: marketingHref("/pricing"), external: true },
        { label: "AI Tutors", href: marketingHref("/tutors"), external: true },
        { label: "Brain Clone", href: marketingHref("/#brain"), external: true },
        { label: "Functioning Levels", href: marketingHref("/levels"), external: true },
      ],
    },
    {
      title: "Solutions",
      links: [
        { label: "For Families", href: marketingHref("/for-parents"), external: true },
        { label: "For Schools", href: marketingHref("/for-schools"), external: true },
        { label: "For Districts", href: marketingHref("/for-districts"), external: true },
        {
          label: "Special Education",
          href: marketingHref("/for-special-education"),
          external: true,
        },
        { label: "IEP Integration", href: marketingHref("/for-teachers"), external: true },
      ],
    },
    {
      title: "Company",
      links: [
        { label: "About AIVO", href: marketingHref("/about"), external: true },
        { label: "Blog", href: marketingHref("/blog"), external: true },
        { label: "Careers", href: marketingHref("/careers"), external: true },
        { label: "Contact", href: marketingHref("/contact"), external: true },
      ],
    },
    {
      title: "Legal",
      links: [
        { label: "Privacy Policy", href: marketingHref("/privacy-policy"), external: true },
        { label: "Terms of Service", href: marketingHref("/terms-of-service"), external: true },
        { label: "Cookie Policy", href: marketingHref("/cookie-policy"), external: true },
        { label: "COPPA Compliance", href: marketingHref("/coppa-compliance"), external: true },
        { label: "FERPA Compliance", href: marketingHref("/ferpa-compliance"), external: true },
        { label: "Accessibility", href: marketingHref("/accessibility"), external: true },
        { label: "Security", href: marketingHref("/security"), external: true },
        { label: "Trust", href: marketingHref("/trust"), external: true },
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
              <span className="whitespace-nowrap text-sm font-semibold">COPPA · FERPA · SOC 2</span>
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
                    {link.external ? (
                      <a
                        href={link.href}
                        className="text-sm text-iw-ink-muted transition hover:text-iw-primary"
                      >
                        {link.label}
                      </a>
                    ) : (
                      <Link
                        href={link.href}
                        className="text-sm text-iw-ink-muted transition hover:text-iw-primary"
                      >
                        {link.label}
                      </Link>
                    )}
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
