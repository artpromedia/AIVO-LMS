"use client";
import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { ArrowRight, CheckCircle2, Loader2 } from "lucide-react";
import { WEB_APP_URL } from "@/lib/constants";
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
    <form onSubmit={handleSubmit} className="mt-5" aria-label="Subscribe to AIVO newsletter">
      <p className="text-sm text-slate-300 font-body mb-2.5">Stay updated with AIVO news</p>
      <div className="flex items-center w-full max-w-sm rounded-full bg-slate-800/80 border border-slate-700 focus-within:border-purple-400 focus-within:ring-2 focus-within:ring-purple-400/30 transition overflow-hidden">
        <input
          type="email"
          required
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="your@email.com"
          disabled={status === "submitting" || status === "success"}
          className="flex-1 min-w-0 bg-transparent px-4 py-3 text-white text-sm font-body placeholder:text-slate-500 focus:outline-none disabled:opacity-60"
          aria-label="Email address"
        />
        <button
          type="submit"
          disabled={status === "submitting" || status === "success"}
          className="m-1 inline-flex items-center justify-center gap-1.5 rounded-full bg-linear-to-r from-primary to-primary-dark px-5 py-2.5 text-sm font-bold text-white hover:opacity-95 transition disabled:opacity-70 shrink-0 min-h-10"
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
        <p className="text-xs text-red-400 font-body mt-2">Something went wrong. Please try again.</p>
      )}
      {status === "success" && (
        <p className="text-xs text-emerald-400 font-body mt-2">You&apos;re subscribed — thanks!</p>
      )}
      <p className="text-[11px] text-slate-500 font-body mt-2">No spam. Unsubscribe any time.</p>
    </form>
  );
}

export function Footer() {
  const t = useTranslations("marketing.footer");

  const FOOTER_SECTIONS = [
    {
      titleKey: "platform" as const,
      links: [
        { labelKey: "features" as const, href: "#features" },
        { labelKey: "pricing" as const, href: "#pricing" },
        { labelKey: "ai_tutors" as const, href: "#tutors" },
        { labelKey: "brain_clone" as const, href: "#brain" },
        { labelKey: "functioning_levels" as const, href: "#levels" },
      ],
    },
    {
      titleKey: "solutions" as const,
      links: [
        { labelKey: "for_families" as const, href: `${WEB_APP_URL}/signup?plan=family` },
        { labelKey: "for_schools" as const, href: "/contact" },
        { labelKey: "for_districts" as const, href: "/contact#demo" },
        { labelKey: "special_education" as const, href: "#levels" },
        { labelKey: "iep_integration" as const, href: "#features" },
      ],
    },
    {
      titleKey: "company" as const,
      links: [
        { labelKey: "about_aivo" as const, href: "/about" },
        { labelKey: "blog" as const, href: "/blog" },
        { labelKey: "careers" as const, href: "/careers" },
        { labelKey: "contact" as const, href: "/contact" },
        { labelKey: "press_kit" as const, href: "/press-kit" },
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
        { labelKey: "subprocessors" as const, href: "/subprocessors" },
      ],
    },
  ];

  return (
    <footer className="bg-slate-900 pt-16 pb-8">
      <div className="max-w-6xl mx-auto px-6 md:px-8">
        <div className="grid grid-cols-2 md:grid-cols-6 gap-8 mb-12">
          <div className="col-span-2">
            <Image
              src="/images/aivo-logo-white.png"
              alt="AIVO Learning"
              width={120}
              height={36}
              className="mb-4"
              style={{ width: "auto", height: "auto" }}
            />
            <p className="text-sm text-slate-400 font-body leading-relaxed mb-4">
              {t("tagline")}
            </p>
            <div className="inline-flex items-center gap-2 bg-slate-800 px-4 py-2 rounded-xl">
              <svg className="w-4 h-4 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
              <span className="text-sm font-bold text-slate-200 whitespace-nowrap">Designed to support COPPA &amp; FERPA</span>
            </div>
            <NewsletterSignup />
          </div>

          {FOOTER_SECTIONS.map((section) => (
            <div key={section.titleKey}>
              <h4 className="text-sm font-heading font-bold text-white mb-4">{t(section.titleKey)}</h4>
              <ul className="space-y-2.5">
                {section.links.map((link) => (
                  <li key={link.labelKey}>
                    <Link
                      href={link.href}
                      className="text-sm text-slate-400 hover:text-white transition font-body"
                    >
                      {t(link.labelKey)}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="border-t border-slate-800 pt-6 flex flex-col md:flex-row items-center justify-between gap-4">
          <p className="text-sm text-slate-500 font-body">
            {t("copyright", { year: new Date().getFullYear() })}
          </p>
          <p className="text-xs text-slate-600 font-body">
            {t("built_with_care")}
          </p>
        </div>
      </div>
    </footer>
  );
}
