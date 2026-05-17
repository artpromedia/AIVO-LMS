/**
 * Tier-aware microcopy map.
 *
 * Centralises the K-5 / 6-8 / 9-12 wording variations so we don't sprinkle
 * `if (tier === "EARLY") ...` ladders through every component.
 *
 * Usage:
 *   import { tierCopy } from "@/lib/tier-copy";
 *   const t = tierCopy(useTierThemeOptional()?.tier);
 *   <h1>{t.welcomeBack("Sam")}</h1>
 *
 * The fallback (`undefined` tier) defaults to MIDDLE wording, which is the
 * neutral middle ground when the theme provider hasn't loaded yet — avoids
 * showing toddler-style copy to a 12th-grader during hydration.
 */
import type { AgeTier } from "@aivo/learner-ui";

export interface TierCopy {
  /** Greeting on the dashboard / home. */
  welcomeBack: (name: string) => string;
  /** Copy for the brain card heading. */
  brainHeading: (name: string) => string;
  /** Subtitle below the brain card. */
  brainSubheading: string;
  /** CTA on a baseline task. */
  baselineCta: string;
  /** Caption while the master→child clone animation is running. */
  cloningCaption: (name: string) => string;
  /** Encouragement copy shown on the chapter intro. */
  chapterEncourage: string;
  /** Final celebration headline. */
  finaleHeadline: (name: string) => string;
}

const EARLY: TierCopy = {
  welcomeBack: (name) => `Hi ${name}! Ready for an adventure?`,
  brainHeading: (name) => `${name}'s magical Brain Map`,
  brainSubheading: "Tap any glowing area to see what's growing inside!",
  baselineCta: "Let's go!",
  cloningCaption: (name) => `Sprinkling some learning magic into ${name}'s brain ✨`,
  chapterEncourage: "You're doing amazing — keep going!",
  finaleHeadline: (name) => `Wow, ${name}! Adventure complete!`,
};

const MIDDLE: TierCopy = {
  welcomeBack: (name) => `Welcome back, ${name}.`,
  brainHeading: (name) => `${name}'s Brain Map`,
  brainSubheading: "Hover or click any region to dig into the details.",
  baselineCta: "Start the adventure",
  cloningCaption: (name) => `Cloning AIVO's learning model into ${name}'s personal brain…`,
  chapterEncourage: "Stay curious — this part really matters.",
  finaleHeadline: (name) => `Nice work, ${name}. Adventure complete.`,
};

const HIGH: TierCopy = {
  welcomeBack: (name) => `Hey ${name}.`,
  brainHeading: (name) => `${name}'s learning profile`,
  brainSubheading: "Each region tracks a domain. Click for the breakdown.",
  baselineCta: "Begin",
  cloningCaption: (name) => `Building ${name}'s personalised learning profile…`,
  chapterEncourage: "Take your time. Quality over speed.",
  finaleHeadline: (name) => `Done, ${name}. Results are in.`,
};

const COPY: Record<AgeTier, TierCopy> = { EARLY, MIDDLE, HIGH };

export function tierCopy(tier: AgeTier | null | undefined): TierCopy {
  if (!tier) return MIDDLE;
  return COPY[tier] ?? MIDDLE;
}
