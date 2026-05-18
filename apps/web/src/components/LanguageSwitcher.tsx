"use client";
import { useState, useRef, useEffect } from "react";
import { useLocale } from "@/providers/i18n-provider";
import type { Locale } from "@/i18n/config";

export function LanguageSwitcher({ compact = false }: { compact?: boolean }) {
  const { locale, setLocale, locales, localeNames, localeFlags } = useLocale();
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
        className={`flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 transition text-sm font-medium text-slate-700 ${
          compact ? "px-2 py-1.5" : "px-3 py-2"
        }`}
        aria-label="Change language"
      >
        <span className="text-base">{localeFlags[locale]}</span>
        {!compact && <span>{localeNames[locale]}</span>}
        <svg
          className="w-3 h-3 text-slate-400"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-1 w-48 bg-white rounded-xl border border-slate-200 shadow-lg z-50 py-1 max-h-72 overflow-y-auto">
          {locales.map((l) => (
            <button
              key={l}
              onClick={() => {
                setLocale(l as Locale);
                setOpen(false);
              }}
              className={`w-full flex items-center gap-2.5 px-3 py-2 text-sm hover:bg-slate-50 transition ${
                l === locale ? "bg-purple-50 text-purple-700 font-semibold" : "text-slate-700"
              }`}
            >
              <span className="text-base">{localeFlags[l]}</span>
              <span>{localeNames[l]}</span>
              {l === locale && (
                <svg
                  className="w-4 h-4 ml-auto text-purple-600"
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
