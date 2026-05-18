"use client";
import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { useTranslations } from "next-intl";
import { Menu, X } from "lucide-react";
import { trackCTAClick, trackSignupInitiation } from "@/lib/analytics";
import { WEB_APP_URL } from "@/lib/constants";
import { SensoryModeToggle } from "./SensoryModeToggle";
import type { SensoryMode } from "@/lib/sensory-mode";

/**
 * Shared marketing-site top navigation for the Inclusive Lab — Warm
 * design system.
 *
 * Used by:
 *  - apps/marketing/src/app/page.tsx (home)
 *  - LandingPageLayout (audience + feature + tutor + level + subject pages)
 *  - LegalPageLayout (privacy / terms / COPPA / FERPA / accessibility / …)
 *
 * Hosts the sensory-mode pill (standard → calm → high-contrast) so the
 * choice is reachable from every marketing surface.
 *
 * `scrollY` is optional and currently unused by the chrome; it is kept
 * for backwards compatibility with older callers that still pass it.
 */
export function StickyHeader({
  scrollY = 0,
  initialSensoryMode,
}: {
  scrollY?: number;
  initialSensoryMode?: SensoryMode;
}) {
  const t = useTranslations("marketing.header");
  const [menuOpen, setMenuOpen] = useState(false);
  const isScrolled = scrollY > 20;

  const NAV_LINKS = [
    { label: "Platform", href: "/#features" },
    { label: "Research", href: "/trust" },
    { label: "For Districts", href: "/for-districts" },
    { label: "Families", href: "/for-parents" },
  ];

  return (
    <header
      className={`sticky top-0 z-50 w-full bg-[var(--aivo-color-background,#fdf6ec)]/85 backdrop-blur-xl border-b transition-shadow duration-300 ${
        isScrolled
          ? "shadow-sm border-slate-200/70"
          : "border-slate-200/40"
      }`}
    >
      <div className="max-w-6xl mx-auto px-6 md:px-8 h-20 flex items-center justify-between gap-4">
        <div className="flex items-center gap-8">
          <Link href="/" className="flex items-center relative w-[140px] h-[40px]" aria-label="AIVO Learning home">
            <Image
              src="/images/aivo-logo-purple.png"
              alt=""
              fill
              priority
              sizes="140px"
              className="object-contain object-left"
            />
          </Link>
          <nav className="hidden md:flex items-center gap-8 text-sm font-semibold text-slate-500">
            {NAV_LINKS.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="hover:text-slate-900 transition-colors"
              >
                {link.label}
              </Link>
            ))}
          </nav>
        </div>

        <div className="flex items-center gap-3">
          <div className="hidden sm:block">
            <SensoryModeToggle initialMode={initialSensoryMode ?? "standard"} />
          </div>
          <LanguageSwitcher compact />
          <a
            href={`${WEB_APP_URL}/login`}
            className="hidden md:inline-flex items-center px-4 py-2 rounded-full text-slate-700 font-semibold text-sm hover:bg-slate-100 transition min-h-[44px]"
          >
            {t("sign_in")}
          </a>
          <a
            href={`${WEB_APP_URL}/signup?plan=free`}
            onClick={() => {
              trackCTAClick("header_get_started", `${WEB_APP_URL}/signup?plan=free`);
              trackSignupInitiation("header");
            }}
            className="hidden sm:inline-flex items-center px-5 py-2.5 rounded-full bg-[var(--aivo-color-primary,#7c3aed)] text-white font-semibold text-sm hover:opacity-90 transition shadow-md shadow-purple-200 min-h-[44px]"
          >
            {t("get_started")}
          </a>
          <button
            onClick={() => setMenuOpen(!menuOpen)}
            className="md:hidden p-2 min-w-[44px] min-h-[44px] flex items-center justify-center rounded-full hover:bg-slate-100 transition"
            aria-label="Toggle navigation menu"
            aria-expanded={menuOpen}
          >
            {menuOpen ? (
              <X className="w-5 h-5 text-slate-800" aria-hidden="true" />
            ) : (
              <Menu className="w-5 h-5 text-slate-800" aria-hidden="true" />
            )}
          </button>
        </div>
      </div>

      {menuOpen && (
        <div className="md:hidden bg-white border-t border-slate-100 shadow-lg">
          <nav className="max-w-6xl mx-auto px-6 py-4 flex flex-col gap-1">
            {NAV_LINKS.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setMenuOpen(false)}
                className="px-4 py-3 text-slate-700 font-semibold rounded-lg hover:bg-slate-50 transition min-h-[44px] flex items-center"
              >
                {link.label}
              </Link>
            ))}
            <div className="px-4 py-3 sm:hidden">
              <SensoryModeToggle initialMode={initialSensoryMode ?? "standard"} compact />
            </div>
            <hr className="my-2 border-slate-100" />
            <a
              href={`${WEB_APP_URL}/login`}
              onClick={() => setMenuOpen(false)}
              className="px-4 py-3 text-slate-700 font-semibold rounded-lg hover:bg-slate-50 transition min-h-[44px] flex items-center"
            >
              {t("sign_in")}
            </a>
            <a
              href={`${WEB_APP_URL}/signup?plan=free`}
              onClick={() => {
                setMenuOpen(false);
                trackCTAClick("mobile_menu_get_started", `${WEB_APP_URL}/signup?plan=free`);
                trackSignupInitiation("mobile_menu");
              }}
              className="px-4 py-3 bg-[var(--aivo-color-primary,#7c3aed)] text-white font-semibold rounded-full text-center hover:opacity-90 transition min-h-[44px] flex items-center justify-center mt-2"
            >
              {t("get_started")}
            </a>
          </nav>
        </div>
      )}
    </header>
  );
}
