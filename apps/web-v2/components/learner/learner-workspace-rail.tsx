"use client";

import * as React from "react";
import Link from "next/link";
import { LearnerProfileCard } from "@aivo/ui/learner-dashboard";
import { WorkspaceControl } from "@/components/learner/workspace-control";
import { useSensoryMode } from "@/components/system/sensory-mode-provider";
import { setTypefaceCookie, setSpacingCookie, setSoundCookie } from "@/lib/a11y/actions";
import {
  Moon,
  Sun,
  Zap,
  VolumeX,
  Volume1,
  Volume2,
  Type,
  BookOpenText,
  SlidersHorizontal,
  SlidersVertical,
} from "lucide-react";

/**
 * SensoryAdaptive workspace rail for the learner home. Profile card → My
 * Workspace → Mood / Spacing / Font Style / Sound segmented controls → More
 * preferences link.
 *
 * The Mood control maps to the platform sensory mode (calm / standard /
 * high-contrast — re-labeled Calm / Balanced / Energizing for learners) and
 * persists via the sensory-mode provider (cookie + cross-tab sync). Spacing,
 * Font Style, and Sound persist to their own cookies and stamp data-* on
 * <html> so the whole learner surface reflects the choice on the next paint.
 */
export interface LearnerWorkspaceRailProps {
  learnerName: string;
  initials?: string;
  approvalStatus?: "approved" | "pending" | "review";
  /** Hydrate the segmented controls from cookies so the rail and the
   *  settings pages stay in lockstep on first paint. */
  initialTypeface?: "standard" | "dyslexia";
  initialSpacing?: "compact" | "comfortable" | "spacious";
  initialSound?: "off" | "soft" | "on";
}

const moodOptions = [
  { value: "calm", label: "Calm", icon: <Moon size={18} /> },
  { value: "standard", label: "Balanced", icon: <Sun size={18} /> },
  { value: "high-contrast", label: "Energizing", icon: <Zap size={18} /> },
];

const spacingOptions = [
  { value: "compact", label: "Compact" },
  { value: "comfortable", label: "Comfortable" },
  { value: "spacious", label: "Spacious" },
];

const fontStyleOptions = [
  { value: "standard", label: "Standard", icon: <Type size={18} /> },
  { value: "dyslexia", label: "Dyslexia-friendly", icon: <BookOpenText size={18} /> },
];

const soundOptions = [
  { value: "off", label: "Off", icon: <VolumeX size={18} /> },
  { value: "soft", label: "Soft", icon: <Volume1 size={18} /> },
  { value: "on", label: "On", icon: <Volume2 size={18} /> },
];

export function LearnerWorkspaceRail({
  learnerName,
  initials,
  approvalStatus = "approved",
  initialTypeface = "standard",
  initialSpacing = "comfortable",
  initialSound = "soft",
}: LearnerWorkspaceRailProps) {
  const { mode, setMode } = useSensoryMode();
  const [spacing, setSpacing] = React.useState<string>(initialSpacing);
  const [fontStyle, setFontStyle] = React.useState<string>(initialTypeface);
  const [sound, setSound] = React.useState<string>(initialSound);

  React.useEffect(() => {
    if (typeof document !== "undefined") {
      document.documentElement.setAttribute("data-spacing", spacing);
    }
    void setSpacingCookie(spacing);
  }, [spacing]);
  React.useEffect(() => {
    if (typeof document !== "undefined") {
      document.documentElement.setAttribute("data-typeface", fontStyle);
    }
    void setTypefaceCookie(fontStyle);
  }, [fontStyle]);
  React.useEffect(() => {
    if (typeof document !== "undefined") {
      document.documentElement.setAttribute("data-sound", sound);
    }
    void setSoundCookie(sound);
  }, [sound]);

  return (
    <aside className="flex flex-col gap-5" aria-label="Learner workspace preferences">
      <LearnerProfileCard
        name={learnerName}
        initials={initials}
        roleLabel="Learner"
        approvalStatus={approvalStatus}
      />

      <section className="flex flex-col gap-5 p-5 rounded-iw-card-lg bg-white border border-iw-border/60">
        <header className="flex items-start gap-2.5">
          <span
            className="mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-iw-control"
            style={{
              background: "var(--color-aivo-primary-soft)",
              color: "var(--color-aivo-primary)",
            }}
            aria-hidden="true"
          >
            <SlidersHorizontal size={18} />
          </span>
          <span className="flex flex-col">
            <h2 className="text-base font-bold leading-tight text-iw-text-strong">My Workspace</h2>
            <span className="text-sm text-iw-text-muted">Make it feel right for you.</span>
          </span>
        </header>

        <WorkspaceControl
          label="Mood"
          value={mode}
          onChange={(v) => setMode(v as typeof mode)}
          options={moodOptions}
        />
        <WorkspaceControl
          label="Spacing"
          value={spacing}
          onChange={setSpacing}
          options={spacingOptions}
        />
        <WorkspaceControl
          label="Font Style"
          value={fontStyle}
          onChange={setFontStyle}
          options={fontStyleOptions}
          layout="inline"
        />
        <WorkspaceControl label="Sound" value={sound} onChange={setSound} options={soundOptions} />

        <Link
          href="/settings/accessibility"
          className="inline-flex items-center gap-2 text-sm font-semibold text-iw-text-muted hover:text-[var(--color-aivo-primary)]"
        >
          <SlidersVertical size={16} aria-hidden="true" />
          More preferences
        </Link>
      </section>
    </aside>
  );
}
