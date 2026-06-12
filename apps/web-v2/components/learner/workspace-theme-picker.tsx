"use client";

import * as React from "react";
import { Check, Lock } from "lucide-react";
import { useTranslations } from "next-intl";
import {
  WORKSPACE_THEMES,
  isThemeUnlocked,
  type WorkspaceThemeId,
} from "@/lib/learner/workspace-themes";
import { setWorkspaceThemeCookie } from "@/lib/a11y/actions";

/**
 * Unlockable workspace theme picker — progress buys personalization.
 *
 * Themes unlock at level milestones; an unlocked theme is selectable and
 * applies live by stamping `<html data-workspace-theme>` (and persisting the
 * cookie) exactly like the other workspace controls. Locked themes are shown
 * as calm, aspirational silhouettes with "Reach level N" — invitation, never
 * pressure. Cosmetic only: themes retint decorative accents, never gate any
 * learning content.
 */
export function WorkspaceThemePicker({
  learnerLevel,
  initialTheme,
}: {
  learnerLevel: number;
  initialTheme: WorkspaceThemeId;
}) {
  const t = useTranslations("learner.rewards");
  const [active, setActive] = React.useState<WorkspaceThemeId>(initialTheme);

  function choose(id: WorkspaceThemeId) {
    setActive(id);
    if (typeof document !== "undefined") {
      document.documentElement.setAttribute("data-workspace-theme", id);
    }
    void setWorkspaceThemeCookie(id);
  }

  return (
    <section className="mb-4">
      <div className="mb-1 flex items-center justify-between gap-3">
        <h2 className="text-xl font-bold text-iw-text-strong">{t("themes_title")}</h2>
      </div>
      <p className="mb-3 text-sm text-iw-text-muted">{t("themes_hint")}</p>
      <div
        role="radiogroup"
        aria-label={t("themes_title")}
        className="grid grid-cols-2 gap-3 sm:grid-cols-3"
      >
        {WORKSPACE_THEMES.map((theme) => {
          const unlocked = isThemeUnlocked(theme, learnerLevel);
          const isActive = active === theme.id;
          return (
            <button
              key={theme.id}
              type="button"
              role="radio"
              aria-checked={isActive}
              aria-disabled={!unlocked || undefined}
              aria-label={
                unlocked
                  ? theme.name
                  : `${theme.name} — ${t("theme_locked", { level: theme.unlockLevel })}`
              }
              tabIndex={isActive ? 0 : -1}
              onClick={() => unlocked && choose(theme.id)}
              className={`flex items-center gap-3 rounded-2xl border p-3 text-left transition ${
                isActive
                  ? "border-[var(--color-aivo-primary)] bg-[var(--color-aivo-primary-soft)]"
                  : "border-iw-border/60 bg-white hover:border-[var(--color-aivo-primary)]/40"
              } ${unlocked ? "cursor-pointer" : "cursor-not-allowed"}`}
            >
              <span
                className={`relative grid h-10 w-10 shrink-0 place-items-center overflow-hidden rounded-xl ${
                  unlocked ? "" : "opacity-40 grayscale"
                }`}
              >
                <span className="lx-theme-swatch" data-theme={theme.id} aria-hidden="true" />
                {isActive ? (
                  <Check size={18} strokeWidth={3} className="relative text-white drop-shadow" />
                ) : !unlocked ? (
                  <Lock size={16} className="relative text-white/90 drop-shadow" />
                ) : null}
              </span>
              <span className="flex min-w-0 flex-col">
                <span className="font-bold text-iw-text-strong">{theme.name}</span>
                <span className="text-xs font-semibold text-iw-text-muted">
                  {isActive
                    ? t("theme_active")
                    : unlocked
                      ? " "
                      : t("theme_locked", { level: theme.unlockLevel })}
                </span>
              </span>
            </button>
          );
        })}
      </div>
    </section>
  );
}
