"use client";
import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { useTranslations } from "next-intl";
import { ShieldCheck } from "lucide-react";
import { trackCTAClick, trackSignupInitiation } from "@/lib/analytics";
import { WEB_APP_URL } from "@/lib/constants";

export function StickyHeader({ scrollY }: { scrollY: number }) {
  const t = useTranslations("marketing.header");
  const [menuOpen, setMenuOpen] = useState(false);
  const isScrolled = scrollY > 20;

  const NAV_LINKS = [
    { labelKey: "features" as const, href: "#features" },
    { labelKey: "tutors" as const, href: "#tutors" },
    { labelKey: "brain_clone" as const, href: "#brain" },
    { labelKey: "pricing" as const, href: "#pricing" },
    { labelKey: "faq" as const, href: "#faq" },
  ];

  return (
    <>
      <div className="bg-gradient-to-r from-primary to-primary-dark text-white py-2.5 px-4 text-center text-sm font-bold flex items-center justify-center gap-2">
        <ShieldCheck className="w-4 h-4 flex-shrink-0" aria-hidden="true" />
        <span>{t("compliance_banner")}</span>
      </div>

      <header
        className={`sticky top-0 z-50 bg-white/95 backdrop-blur transition-shadow duration-300 ${
          isScrolled ? "shadow-sm border-b border-slate-100" : "border-b border-transparent"
        }`}
      >
        <div className="max-w-6xl mx-auto px-6 md:px-8 h-20 flex items-center justify-between">
          <Link href="/" className="flex items-center relative w-[140px] h-[40px]">
            <Image
              src="/images/aivo-logo-purple.png"
              alt="AIVO Learning"
              fill
              priority
              sizes="140px"
              className="object-contain object-left"
            />
          </Link>

          <nav className="hidden md:flex items-center gap-8 text-base font-bold text-slate-600">
            {NAV_LINKS.map((link) => (
              <a
                key={link.labelKey}
                href={link.href}
                className="hover:text-primary transition-colors"
              >
                {t(link.labelKey)}
              </a>
            ))}
          </nav>

          <div className="flex items-center gap-3">
            <LanguageSwitcher compact />
            <a
              href={`${WEB_APP_URL}/login`}
              className="hidden sm:inline-flex items-center px-5 py-2 rounded-full text-primary font-bold text-base hover:bg-purple-50 transition min-h-[44px]"
            >
              {t("sign_in")}
            </a>
            <a
              href={`${WEB_APP_URL}/signup?plan=free`}
              onClick={() => {
                trackCTAClick("header_get_started", `${WEB_APP_URL}/signup?plan=free`);
                trackSignupInitiation("header");
              }}
              className="hidden sm:inline-flex items-center px-6 py-2.5 rounded-full bg-gradient-to-r from-primary to-primary-dark text-white font-bold text-base hover:opacity-95 transition shadow-md shadow-purple-200 min-h-[44px]"
            >
              {t("get_started")}
            </a>
            <button
              onClick={() => setMenuOpen(!menuOpen)}
              className="md:hidden p-2 min-w-[44px] min-h-[44px] flex items-center justify-center rounded-lg transition"
              aria-label="Toggle navigation menu"
              aria-expanded={menuOpen}
            >
              {menuOpen ? (
                <svg
                  className="w-6 h-6 text-slate-800"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  aria-hidden="true"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              ) : (
                <svg
                  className="w-6 h-6 text-slate-800"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  aria-hidden="true"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M4 6h16M4 12h16M4 18h16"
                  />
                </svg>
              )}
            </button>
          </div>
        </div>

        {menuOpen && (
          <div className="md:hidden bg-white border-t border-slate-100 shadow-lg">
            <nav className="max-w-6xl mx-auto px-6 py-4 flex flex-col gap-1">
              {NAV_LINKS.map((link) => (
                <a
                  key={link.labelKey}
                  href={link.href}
                  onClick={() => setMenuOpen(false)}
                  className="px-4 py-3 text-slate-700 font-semibold rounded-lg hover:bg-slate-50 transition min-h-[44px] flex items-center"
                >
                  {t(link.labelKey)}
                </a>
              ))}
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
                className="px-4 py-3 bg-gradient-to-r from-primary to-primary-dark text-white font-bold rounded-full text-center hover:opacity-95 transition min-h-[44px] flex items-center justify-center mt-2"
              >
                {t("get_started")}
              </a>
            </nav>
          </div>
        )}
      </header>
    </>
  );
}
