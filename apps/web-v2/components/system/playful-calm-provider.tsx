"use client";

import { useEffect, useState } from "react";
import {
  resolvePlayfulAgeMode,
  resolvePlayfulTheme,
  type PlayfulAgeMode,
  type PlayfulTheme,
} from "@/lib/playful-calm/settings";

const THEMES: PlayfulTheme[] = ["light", "dark", "high-contrast"];
const AGES: PlayfulAgeMode[] = ["sprout", "spark", "scholar"];

function safeGet<T extends string>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  const value = window.localStorage.getItem(key);
  return (value as T) ?? fallback;
}

export function PlayfulCalmProvider({ children }: { children: React.ReactNode }) {
  const [theme, setTheme] = useState<PlayfulTheme>("light");
  const [ageMode, setAgeMode] = useState<PlayfulAgeMode>("spark");
  const [dyslexia, setDyslexia] = useState(false);

  useEffect(() => {
    const nextTheme = safeGet("aivo.theme", "light");
    const nextAge = safeGet("aivo.ageMode", "spark");
    const nextDyslexia = safeGet<"on" | "off">("aivo.dyslexia", "off") === "on";
    setTheme(resolvePlayfulTheme(nextTheme));
    setAgeMode(resolvePlayfulAgeMode(nextAge));
    setDyslexia(nextDyslexia);
  }, []);

  useEffect(() => {
    const root = document.documentElement;
    root.setAttribute("data-theme", theme);
    root.setAttribute("data-age-mode", ageMode);
    if (dyslexia) root.setAttribute("data-dyslexia-font", "on");
    else root.removeAttribute("data-dyslexia-font");
    window.localStorage.setItem("aivo.theme", theme);
    window.localStorage.setItem("aivo.ageMode", ageMode);
    window.localStorage.setItem("aivo.dyslexia", dyslexia ? "on" : "off");
  }, [ageMode, dyslexia, theme]);

  return (
    <>
      {children}
      <div className="fixed bottom-3 right-3 z-[var(--aivo-zIndex-toast,1400)] rounded-iw-card border border-iw-border bg-iw-card p-3 shadow-soft-3">
        <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-iw-ink-muted">
          Display preferences
        </p>
        <label className="mb-1 block text-xs text-iw-ink">Theme</label>
        <select className="mb-2 w-full rounded-md border border-iw-border bg-iw-raised px-2 py-1 text-xs text-iw-ink" value={theme} onChange={(e) => setTheme(e.target.value as PlayfulTheme)}>
          {THEMES.map((t) => <option key={t} value={t}>{t}</option>)}
        </select>
        <label className="mb-1 block text-xs text-iw-ink">Age mode</label>
        <select className="mb-2 w-full rounded-md border border-iw-border bg-iw-raised px-2 py-1 text-xs text-iw-ink" value={ageMode} onChange={(e) => setAgeMode(e.target.value as PlayfulAgeMode)}>
          {AGES.map((a) => <option key={a} value={a}>{a}</option>)}
        </select>
        <label className="flex items-center gap-2 text-xs text-iw-ink">
          <input type="checkbox" checked={dyslexia} onChange={(e) => setDyslexia(e.target.checked)} />
          Dyslexia font
        </label>
      </div>
    </>
  );
}
