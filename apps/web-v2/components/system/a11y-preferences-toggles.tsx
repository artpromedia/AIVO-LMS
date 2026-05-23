"use client";

import * as React from "react";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { setTypefaceCookie, setReducedMotionCookie } from "@/lib/a11y/actions";
import { type Typeface, type ReducedMotion } from "@/lib/a11y/typeface";

/**
 * Wired accessibility checkbox group for the Settings → Accessibility
 * page. Mirrors each preference onto `<html data-typeface>` /
 * `<html data-reduced-motion>` so the page repaints immediately, and
 * fires-and-forgets a server action that writes the matching cookie so
 * the next SSR render starts from the right state (no FOUC).
 *
 * Initial values are passed in from the server reader in
 * `lib/a11y/server.ts` so SSR + client agree on the very first paint.
 *
 * "Read aloud by default" and "Always show captions" are intentionally
 * not persisted at the browser level — they belong on the learner
 * preference profile (per-learner override) and are configured from
 * each learner's accessibility profile page.
 */
export interface A11yPreferencesTogglesProps {
  initialTypeface: Typeface;
  initialReducedMotion: ReducedMotion;
}

export function A11yPreferencesToggles({
  initialTypeface,
  initialReducedMotion,
}: A11yPreferencesTogglesProps) {
  const [typeface, setTypeface] = React.useState<Typeface>(initialTypeface);
  const [reducedMotion, setReducedMotion] = React.useState<ReducedMotion>(initialReducedMotion);

  const onTypefaceChange = (next: boolean) => {
    const value: Typeface = next ? "dyslexia" : "standard";
    setTypeface(value);
    if (typeof document !== "undefined") {
      document.documentElement.setAttribute("data-typeface", value);
    }
    void setTypefaceCookie(value);
  };

  const onReducedMotionChange = (next: boolean) => {
    const value: ReducedMotion = next ? "reduce" : "auto";
    setReducedMotion(value);
    if (typeof document !== "undefined") {
      document.documentElement.setAttribute("data-reduced-motion", value);
    }
    void setReducedMotionCookie(value);
  };

  return (
    <fieldset className="flex flex-col gap-3">
      <Label>Other</Label>
      <label className="flex items-center gap-3 text-sm">
        <Checkbox
          id="reduce-motion"
          checked={reducedMotion === "reduce"}
          onCheckedChange={(c) => onReducedMotionChange(c === true)}
        />
        <span>
          <span className="font-medium">Reduce motion</span>
          <span className="ml-2 text-iw-ink-muted">
            Stops animations and transitions across the app.
          </span>
        </span>
      </label>
      <label className="flex items-center gap-3 text-sm">
        <Checkbox
          id="dyslexia-font"
          checked={typeface === "dyslexia"}
          onCheckedChange={(c) => onTypefaceChange(c === true)}
        />
        <span>
          <span className="font-medium">Dyslexia-friendly font</span>
          <span className="ml-2 text-iw-ink-muted">
            Switches body text to Atkinson Hyperlegible / OpenDyslexic.
          </span>
        </span>
      </label>
      <label className="flex items-center gap-3 text-sm opacity-60">
        <Checkbox id="read-aloud" disabled />
        <span>
          <span className="font-medium">Read aloud by default</span>
          <span className="ml-2 text-iw-ink-muted">
            Configure per learner from each learner&apos;s accessibility profile.
          </span>
        </span>
      </label>
      <label className="flex items-center gap-3 text-sm opacity-60">
        <Checkbox id="captions" disabled />
        <span>
          <span className="font-medium">Always show captions</span>
          <span className="ml-2 text-iw-ink-muted">
            Configure per learner from each learner&apos;s accessibility profile.
          </span>
        </span>
      </label>
    </fieldset>
  );
}
