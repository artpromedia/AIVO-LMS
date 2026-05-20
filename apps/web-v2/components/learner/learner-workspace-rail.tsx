"use client";

import * as React from "react";
import Link from "next/link";
import {
  LearnerProfileCard,
  SensoryControlGroup,
} from "@aivo/ui/learner-dashboard";
import { useSensoryMode } from "@/components/system/sensory-mode-provider";
import { Moon, Sun, Zap, VolumeX, Volume1, Volume2 } from "lucide-react";

/**
 * SensoryAdaptive workspace rail for the learner home. Mirrors the
 * reference design: profile card → My Workspace → Mood / Spacing /
 * Font Style / Sound segmented controls → More preferences link.
 *
 * The Mood control maps directly to the existing platform sensory
 * mode (calm / standard / high-contrast — re-labeled for the learner
 * audience as Calm / Balanced / Energizing). Spacing, Font Style,
 * and Sound are local UI state for now; persisting them is wired in
 * a follow-up against the learner preferences profile.
 */
export interface LearnerWorkspaceRailProps {
  learnerName: string;
  initials?: string;
  approvalStatus?: "approved" | "pending" | "review";
}

const moodOptions = [
  { value: "calm", label: "Calm", icon: <Moon size={18} /> },
  { value: "standard", label: "Balanced", icon: <Sun size={18} /> },
  { value: "high-contrast", label: "Energizing", icon: <Zap size={18} /> },
] as const;

const spacingOptions = [
  { value: "compact", label: "Compact" },
  { value: "comfortable", label: "Comfortable" },
  { value: "spacious", label: "Spacious" },
] as const;

const fontStyleOptions = [
  { value: "standard", label: "Standard" },
  { value: "dyslexia", label: "Dyslexia-friendly" },
] as const;

const soundOptions = [
  { value: "off", label: "Off", icon: <VolumeX size={18} /> },
  { value: "soft", label: "Soft", icon: <Volume1 size={18} /> },
  { value: "on", label: "On", icon: <Volume2 size={18} /> },
] as const;

export function LearnerWorkspaceRail({
  learnerName,
  initials,
  approvalStatus = "approved",
}: LearnerWorkspaceRailProps) {
  const { mode, setMode } = useSensoryMode();
  const [spacing, setSpacing] = React.useState<(typeof spacingOptions)[number]["value"]>(
    "comfortable",
  );
  const [fontStyle, setFontStyle] = React.useState<(typeof fontStyleOptions)[number]["value"]>(
    "standard",
  );
  const [sound, setSound] = React.useState<(typeof soundOptions)[number]["value"]>("soft");

  // Reflect spacing on the root via data attribute so other components
  // can respond. The CSS contract is opt-in (no required selector ships
  // yet); this primes the experience for follow-up token wiring.
  React.useEffect(() => {
    if (typeof document !== "undefined") {
      document.documentElement.setAttribute("data-spacing", spacing);
    }
  }, [spacing]);
  React.useEffect(() => {
    if (typeof document !== "undefined") {
      document.documentElement.setAttribute("data-typeface", fontStyle);
    }
  }, [fontStyle]);

  return (
    <aside className="flex flex-col gap-5" aria-label="Learner workspace preferences">
      <LearnerProfileCard
        name={learnerName}
        initials={initials}
        roleLabel="Learner"
        approvalStatus={approvalStatus}
      />

      <section className="flex flex-col gap-4 p-4 rounded-3xl bg-white border border-iw-border/60">
        <header className="flex items-center gap-2">
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
            className="text-[var(--color-aivo-primary)]"
          >
            <path d="M4 6h10" />
            <path d="M14 6a2 2 0 1 0 4 0 2 2 0 1 0-4 0" />
            <path d="M4 12h6" />
            <path d="M10 12a2 2 0 1 0 4 0 2 2 0 1 0-4 0" />
            <path d="M4 18h10" />
            <path d="M14 18a2 2 0 1 0 4 0 2 2 0 1 0-4 0" />
          </svg>
          <h2 className="text-base font-bold text-iw-text-strong">My Workspace</h2>
        </header>

        <SensoryControlGroup
          label="Mood"
          value={mode}
          onChange={(v) => setMode(v as typeof mode)}
          options={moodOptions as unknown as { value: string; label: string; icon: React.ReactNode }[]}
        />
        <SensoryControlGroup
          label="Spacing"
          value={spacing}
          onChange={(v) => setSpacing(v as typeof spacing)}
          options={spacingOptions as unknown as { value: string; label: string }[]}
        />
        <SensoryControlGroup
          label="Font Style"
          value={fontStyle}
          onChange={(v) => setFontStyle(v as typeof fontStyle)}
          options={fontStyleOptions as unknown as { value: string; label: string }[]}
          columns={2}
        />
        <SensoryControlGroup
          label="Sound"
          value={sound}
          onChange={(v) => setSound(v as typeof sound)}
          options={soundOptions as unknown as { value: string; label: string; icon: React.ReactNode }[]}
        />

        <Link
          href="/settings/accessibility"
          className="inline-flex items-center gap-2 text-sm font-semibold text-iw-text-muted hover:text-[var(--color-aivo-primary)]"
        >
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M4 6h16" />
            <path d="M4 12h10" />
            <path d="M4 18h16" />
          </svg>
          More preferences
        </Link>
      </section>
    </aside>
  );
}
