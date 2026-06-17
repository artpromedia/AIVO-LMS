import { StickyHeader } from "@/components/marketing/StickyHeader";
import { Footer } from "@/components/marketing/Footer";
import { getSensoryModeFromCookies } from "@/lib/sensory-mode.server";

interface Section {
  title: string;
  content: string | string[];
  list?: string[];
}

interface LegalPageLayoutProps {
  badge: string;
  title: string;
  subtitle: string;
  icon: string;
  accentColor: string;
  lastUpdated: string;
  sections: Section[];
  contactEmail?: string;
}

/**
 * Shared chrome for legal / compliance pages (privacy, terms, COPPA,
 * FERPA, accessibility, security, trust, cookie policy, subprocessors).
 *
 * Uses the same StickyHeader + Footer as the rest of the marketing site
 * so the Inclusive Lab — Warm chrome (and the sensory-mode pill) is
 * available from every compliance surface. The page is intentionally
 * a server component now (no more `"use client"`) so it can server-read
 * the sensory-mode cookie and pass the initial mode to the header.
 *
 * Production smoke checks rely on this page surface keeping the
 * compliance vocabulary intact (see scripts/marketing-markers.sh):
 *   /privacy-policy    — COPPA + FERPA + "Online Privacy Protection Act"
 *   /coppa-compliance  — compliance@aivolearning.com + "verifiable parental consent"
 *   /ferpa-compliance  — "FERPA Compliance Statement" + "SOC 2 Type II"
 * Those markers come from the page content passed in via `sections`, not
 * from the chrome — the chrome rewrite must not strip them.
 */
export async function LegalPageLayout({
  badge,
  title,
  subtitle,
  icon,
  accentColor,
  lastUpdated,
  sections,
  contactEmail = "legal@aivolearning.com",
}: LegalPageLayoutProps) {
  const sensoryMode = await getSensoryModeFromCookies();

  return (
    <div className="min-h-screen bg-[var(--aivo-color-surface-canvas)]">
      <StickyHeader initialSensoryMode={sensoryMode} />

      <div
        className="relative overflow-hidden py-16 md:py-24"
        style={{
          background: `linear-gradient(135deg, ${accentColor}10 0%, ${accentColor}05 50%, transparent 100%)`,
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
              className="w-12 h-12 rounded-iw-control flex items-center justify-center text-2xl shadow-soft-3"
              style={{ backgroundColor: `${accentColor}15` }}
              aria-hidden="true"
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
          <h1 className="font-heading text-4xl md:text-5xl font-bold text-iw-ink mb-4 leading-tight">
            {title}
          </h1>
          <p className="text-lg text-iw-ink-muted font-body max-w-2xl">{subtitle}</p>
          <p className="text-sm text-iw-ink-muted font-body mt-4">Last updated: {lastUpdated}</p>
        </div>
      </div>

      <main className="max-w-4xl mx-auto px-6 md:px-8 py-12 md:py-16">
        <div className="space-y-10">
          {sections.map((section, i) => (
            <section key={section.title} className="scroll-mt-24" id={`section-${i + 1}`}>
              <h2 className="font-heading text-2xl font-bold text-iw-ink mb-4 flex items-center gap-3">
                <span
                  className="w-8 h-8 rounded-lg flex items-center justify-center text-sm font-bold text-white"
                  style={{ backgroundColor: accentColor }}
                  aria-hidden="true"
                >
                  {i + 1}
                </span>
                {section.title}
              </h2>
              {Array.isArray(section.content) ? (
                section.content.map((paragraph, pi) => (
                  <p key={pi} className="text-iw-ink-muted font-body leading-relaxed mb-4">
                    {paragraph}
                  </p>
                ))
              ) : (
                <p className="text-iw-ink-muted font-body leading-relaxed mb-4">{section.content}</p>
              )}
              {section.list && (
                <ul className="space-y-2 mt-4">
                  {section.list.map((item) => (
                    <li key={item} className="flex items-start gap-3 text-iw-ink-muted font-body">
                      <svg
                        className="w-5 h-5 mt-0.5 flex-shrink-0"
                        style={{ color: accentColor }}
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                        aria-hidden="true"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M5 13l4 4L19 7"
                        />
                      </svg>
                      {item}
                    </li>
                  ))}
                </ul>
              )}
            </section>
          ))}
        </div>

        <div
          className="mt-16 p-8 rounded-iw-card-lg border"
          style={{
            backgroundColor: `${accentColor}05`,
            borderColor: `${accentColor}20`,
          }}
        >
          <h3 className="font-heading text-xl font-bold text-iw-ink mb-2">Questions?</h3>
          <p className="text-iw-ink-muted font-body mb-4">
            If you have any questions about this policy, please reach out to our team.
          </p>
          <a
            href={`mailto:${contactEmail}`}
            className="group inline-flex min-h-[52px] items-center gap-2 rounded-iw-control px-7 text-base font-semibold text-white shadow-soft-3 transition hover:-translate-y-0.5 hover:brightness-110"
            style={{ backgroundColor: accentColor }}
          >
            <svg
              className="w-5 h-5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
              />
            </svg>
            {contactEmail}
          </a>
        </div>
      </main>

      <Footer />
    </div>
  );
}
