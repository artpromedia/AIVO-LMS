"use client";
import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { ArrowRight, CheckCircle2, Loader2, ShieldCheck } from "lucide-react";
import { trackFormSubmission } from "@/lib/analytics";

function NewsletterSignup() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "submitting" | "success" | "error">("idle");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (status === "submitting") return;
    setStatus("submitting");
    try {
      const res = await fetch("/api/newsletter", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      if (!res.ok) throw new Error("Newsletter subscription failed");
      setStatus("success");
      trackFormSubmission("newsletter_signup");
      setEmail("");
    } catch {
      setStatus("error");
    }
  }

  return (
    <form onSubmit={handleSubmit} className="mt-6" aria-label="Subscribe to AIVO newsletter">
      <p className="text-sm text-iw-ink-muted font-medium mb-2.5">Stay updated with AIVO news</p>
      <div className="flex items-center w-full max-w-sm rounded-iw-control bg-white border border-iw-border focus-within:border-[var(--aivo-sensory-primary)] focus-within:ring-2 focus-within:ring-iw-ring/30 transition overflow-hidden">
        <input
          type="email"
          required
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="your@email.com"
          disabled={status === "submitting" || status === "success"}
          className="flex-1 min-w-0 bg-transparent px-4 py-3 text-iw-ink text-sm placeholder:text-iw-ink-muted focus:outline-none disabled:opacity-60"
          aria-label="Email address"
        />
        <button
          type="submit"
          disabled={status === "submitting" || status === "success"}
          className="m-1 inline-flex items-center justify-center gap-1.5 rounded-iw-control bg-[var(--aivo-sensory-primary)] px-5 py-2.5 text-sm font-semibold text-white hover:opacity-90 transition disabled:opacity-70 shrink-0 min-h-10"
        >
          {status === "submitting" && (
            <>
              <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
              <span className="sr-only">Submitting</span>
            </>
          )}
          {status === "success" && (
            <>
              <CheckCircle2 className="w-4 h-4" aria-hidden="true" />
              Subscribed
            </>
          )}
          {status !== "submitting" && status !== "success" && (
            <>
              Subscribe
              <ArrowRight className="w-4 h-4" aria-hidden="true" />
            </>
          )}
        </button>
      </div>
      {status === "error" && (
        <p className="text-xs text-iw-error-strong mt-2">Something went wrong. Please try again.</p>
      )}
      {status === "success" && (
        <p className="text-xs text-iw-success-strong mt-2">You&apos;re subscribed — thanks!</p>
      )}
      <p className="text-[11px] text-iw-ink-muted mt-2">No spam. Unsubscribe any time.</p>
    </form>
  );
}

/**
 * Shared marketing-site footer for the Inclusive Lab — Warm system.
 *
 * The "COPPA · FERPA · SOC 2" trust badge below the wordmark is the
 * production smoke-check marker for "/" (see scripts/marketing-markers.sh);
 * keep that exact wording when iterating on the footer copy.
 */
export function Footer() {
  const t = useTranslations("marketing.footer");

  const FOOTER_SECTIONS = [
    {
      titleKey: "platform" as const,
      links: [
        { labelKey: "features" as const, href: "/#features" },
        { labelKey: "pricing" as const, href: "/pricing" },
        { labelKey: "ai_tutors" as const, href: "/tutors" },
        { labelKey: "brain_clone" as const, href: "/#brain" },
        { labelKey: "functioning_levels" as const, href: "/levels" },
      ],
    },
    {
      titleKey: "solutions" as const,
      links: [
        { labelKey: "for_families" as const, href: "/for-parents" },
        { labelKey: "for_schools" as const, href: "/for-schools" },
        { labelKey: "for_districts" as const, href: "/for-districts" },
        { labelKey: "special_education" as const, href: "/for-special-education" },
        { labelKey: "iep_integration" as const, href: "/for-teachers" },
      ],
    },
    {
      titleKey: "company" as const,
      links: [
        { labelKey: "about_aivo" as const, href: "/about" },
        { labelKey: "blog" as const, href: "/blog" },
        { labelKey: "careers" as const, href: "/careers" },
        { labelKey: "contact" as const, href: "/contact" },
      ],
    },
    {
      titleKey: "legal" as const,
      links: [
        { labelKey: "privacy_policy" as const, href: "/privacy-policy" },
        { labelKey: "terms_of_service" as const, href: "/terms-of-service" },
        { labelKey: "cookie_policy" as const, href: "/cookie-policy" },
        { labelKey: "coppa_compliance" as const, href: "/coppa-compliance" },
        { labelKey: "ferpa_compliance" as const, href: "/ferpa-compliance" },
        { labelKey: "accessibility" as const, href: "/accessibility" },
        { labelKey: "security" as const, href: "/security" },
        { labelKey: "trust" as const, href: "/trust" },
      ],
    },
  ];

  return (
    <footer className="border-t border-iw-border/70 bg-white/60 backdrop-blur-sm pt-16 pb-10">
      <div className="max-w-6xl mx-auto px-6 md:px-8">
        <div className="grid grid-cols-2 md:grid-cols-6 gap-10 mb-12">
          <div className="col-span-2">
            <Image
              src="/images/aivo-logo-purple.png"
              alt="AIVO Learning"
              width={130}
              height={40}
              className="mb-5"
              style={{ width: "auto", height: "auto" }}
            />
            <p className="text-sm text-iw-ink-muted leading-relaxed mb-5 max-w-xs">
              Engineered for the margins. Transformative for everyone.
            </p>
            <div className="inline-flex items-center gap-2 bg-iw-purple-100 border border-iw-purple-100 px-4 py-2 rounded-iw-chip text-[var(--aivo-sensory-primary)]">
              <ShieldCheck className="w-4 h-4" aria-hidden="true" />
              <span className="text-sm font-semibold whitespace-nowrap">COPPA · FERPA · SOC 2</span>
            </div>
            <NewsletterSignup />
          </div>

          {FOOTER_SECTIONS.map((section) => (
            <div key={section.titleKey}>
              <h3 className="text-sm font-heading font-bold text-iw-ink mb-4">
                {t(section.titleKey)}
              </h3>
              <ul className="space-y-2.5">
                {section.links.map((link) => (
                  <li key={link.labelKey}>
                    <Link
                      href={link.href}
                      className="text-sm text-iw-ink-muted hover:text-[var(--aivo-sensory-primary)] transition"
                    >
                      {t(link.labelKey)}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="border-t border-iw-border/70 pt-6 flex flex-col md:flex-row items-center justify-between gap-4">
          <p className="text-sm text-iw-ink-muted">
            {t("copyright", { year: new Date().getFullYear() })}
          </p>
          <div className="inline-flex items-center gap-2 bg-iw-purple-100 px-4 py-2 rounded-iw-chip text-[var(--aivo-sensory-primary)]">
            <ShieldCheck className="w-4 h-4" aria-hidden="true" />
            <span className="text-sm font-semibold">Secure &amp; Compliant</span>
          </div>
        </div>
      </div>
    </footer>
  );
}
