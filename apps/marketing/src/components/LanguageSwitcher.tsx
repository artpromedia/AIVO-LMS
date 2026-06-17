"use client";
import { useState, useRef, useEffect } from "react";
import { useLocale } from "@/providers/i18n-provider";
import type { Locale } from "@/i18n/config";

export function LanguageSwitcher({ compact = false }: { compact?: boolean }) {
  const { locale, setLocale, locales, localeNames } = useLocale();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(!open)}
        className={`flex items-center gap-1.5 rounded-lg border border-iw-border bg-white hover:bg-iw-raised transition text-sm font-medium text-iw-ink ${
          compact ? "px-2 py-1.5" : "px-3 py-2"
        }`}
        aria-label="Change language"
      >
        {compact ? (
          <span className="font-semibold uppercase">{locale}</span>
        ) : (
          <span>{localeNames[locale]}</span>
        )}
        <svg
          className="w-3 h-3 text-iw-ink-muted"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-1 w-48 bg-white rounded-iw-card border border-iw-border shadow-soft-3 z-50 py-1 max-h-72 overflow-y-auto">
          {locales.map((l) => (
            <button
              key={l}
              onClick={() => {
                setLocale(l as Locale);
                setOpen(false);
              }}
              className={`w-full flex items-center gap-2.5 px-3 py-2 text-sm hover:bg-iw-raised transition ${
                l === locale ? "bg-iw-purple-100 text-iw-primary font-semibold" : "text-iw-ink"
              }`}
            >
              <span className="w-6 text-xs font-semibold uppercase opacity-60">{l}</span>
              <span>{localeNames[l]}</span>
              {l === locale && (
                <svg
                  className="w-4 h-4 ml-auto text-iw-primary"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M5 13l4 4L19 7"
                  />
                </svg>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
