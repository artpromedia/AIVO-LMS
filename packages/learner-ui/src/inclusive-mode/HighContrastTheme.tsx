/**
 * HighContrastTheme — applies a WCAG AAA-tier palette to all descendant
 * surfaces via CSS variables. Mounted at the root layout when the learner
 * has `accessibility.highContrast === true`.
 *
 * We intentionally override the same `--lc-*` tokens the rest of the
 * learner UI already reads, so no component needs to special-case the
 * mode — switching the variable values cascades automatically. When the
 * provider unmounts, the variables are removed so nothing leaks across
 * surface boundaries.
 */
import { useEffect, type ReactNode } from "react";

/** AAA-tier high-contrast palette. Foreground / background pairs have
 *  contrast ratio >= 7:1 on every combination. */
const HIGH_CONTRAST_VARS: Record<string, string> = {
  "--lc-bg": "#000000",
  "--lc-bg-elevated": "#0a0a0a",
  "--lc-surface": "#111111",
  "--lc-fg": "#ffffff",
  "--lc-fg-muted": "#f5f5f5",
  "--lc-accent": "#ffd700",
  "--lc-accent-fg": "#000000",
  "--lc-link": "#7cc4ff",
  "--lc-link-visited": "#c4a3ff",
  "--lc-border": "#ffffff",
  "--lc-focus-ring": "#ffd700",
  "--lc-success": "#7fff7f",
  "--lc-warning": "#ffd700",
  "--lc-danger": "#ff6b6b",
};

export interface HighContrastThemeProps {
  active: boolean;
  children: ReactNode;
}

export function HighContrastTheme({
  active,
  children,
}: HighContrastThemeProps): JSX.Element {
  useEffect(() => {
    if (!active || typeof document === "undefined") return;
    const root = document.documentElement;
    const previous = new Map<string, string>();
    for (const [k, v] of Object.entries(HIGH_CONTRAST_VARS)) {
      previous.set(k, root.style.getPropertyValue(k));
      root.style.setProperty(k, v);
    }
    root.setAttribute("data-high-contrast", "true");
    return () => {
      for (const [k, prev] of previous.entries()) {
        if (prev) root.style.setProperty(k, prev);
        else root.style.removeProperty(k);
      }
      root.removeAttribute("data-high-contrast");
    };
  }, [active]);

  return <>{children}</>;
}

export default HighContrastTheme;
