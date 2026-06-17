"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Globe } from "lucide-react";
import { useTranslations } from "next-intl";
import { locales, localeNames, LOCALE_COOKIE_NAME, type Locale } from "@/lib/i18n/config";

const COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

function readCurrentLocale(): Locale {
  if (typeof document === "undefined") return "en";
  const match = document.cookie.split("; ").find((row) => row.startsWith(`${LOCALE_COOKIE_NAME}=`));
  const raw = match?.split("=")[1];
  if (raw && (locales as readonly string[]).includes(raw)) {
    return raw as Locale;
  }
  return "en";
}

function writeLocaleCookie(locale: Locale) {
  if (typeof document === "undefined") return;
  const secure = window.location.protocol === "https:" ? "; secure" : "";
  document.cookie = `${LOCALE_COOKIE_NAME}=${locale}; path=/; max-age=${COOKIE_MAX_AGE}; samesite=lax${secure}`;
}

export interface LanguageSwitcherProps {
  readonly className?: string;
}

/**
 * Compact locale selector. Persists the chosen locale to a cookie and
 * calls `router.refresh()` so the server re-renders the page with the
 * new `next-intl` messages from `lib/i18n/request.ts`.
 */
export function LanguageSwitcher({ className }: LanguageSwitcherProps) {
  const router = useRouter();
  const t = useTranslations("common");
  const [open, setOpen] = React.useState(false);
  const [current, setCurrent] = React.useState<Locale>("en");
  const containerRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    setCurrent(readCurrentLocale());
  }, []);

  React.useEffect(() => {
    if (!open) return;
    function onDocClick(e: MouseEvent) {
      if (!containerRef.current?.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, [open]);

  function selectLocale(locale: Locale) {
    writeLocaleCookie(locale);
    setCurrent(locale);
    setOpen(false);
    router.refresh();
  }

  return (
    <div ref={containerRef} className={`relative ${className ?? ""}`}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={t("language")}
        className="inline-flex min-h-10 items-center gap-1.5 rounded-full border border-iw-border bg-iw-bg px-3 py-1.5 text-sm font-semibold text-iw-ink-muted transition hover:bg-iw-warm-soft hover:text-iw-ink"
      >
        <Globe className="h-4 w-4" aria-hidden="true" />
        <span>{current.toUpperCase()}</span>
      </button>
      {open ? (
        <ul
          role="listbox"
          className="absolute right-0 z-50 mt-2 max-h-80 w-52 overflow-auto rounded-iw-card border border-iw-border bg-iw-bg p-1 shadow-soft-2"
        >
          {locales.map((locale) => {
            const isActive = locale === current;
            return (
              <li key={locale} role="none">
                <button
                  type="button"
                  role="option"
                  aria-selected={isActive}
                  onClick={() => selectLocale(locale)}
                  className={`flex w-full items-center gap-3 rounded-iw-control px-3 py-2 text-left text-sm font-medium transition ${
                    isActive
                      ? "bg-iw-warm-soft text-iw-ink"
                      : "text-iw-ink-muted hover:bg-iw-warm-soft hover:text-iw-ink"
                  }`}
                >
                  <span className="flex-1">{localeNames[locale]}</span>
                  <span className="text-xs uppercase opacity-60">{locale}</span>
                </button>
              </li>
            );
          })}
        </ul>
      ) : null}
    </div>
  );
}
