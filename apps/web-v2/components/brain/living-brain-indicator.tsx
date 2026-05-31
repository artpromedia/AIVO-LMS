"use client";

/**
 * LivingBrainIndicator
 * --------------------
 * The persistent "living brain" the spec calls for: a small, always-gently-
 * pulsing sphere in the learner's top bar, rendered with the learner's own
 * colour signature (`visualIdentity`). It is the same WebGL brain the learner
 * watched form during their Awakening, now living permanently in the chrome.
 *
 * Renders the shared `PixiBrainSphere` at indicator size with the CSS-orb
 * fallback baked in, so it stays lightweight and degrades gracefully. Purely
 * decorative + labelled; not a control.
 */
import PixiBrainSphere from "@/components/brain/pixi-brain-sphere";

export interface LivingBrainIndicatorProps {
  primaryHue: string;
  secondaryHues: string[];
  pulseRate?: "calm" | "steady" | "energetic";
  /** Learner display name, woven into the accessible label. */
  learnerName?: string;
  /** Indicator diameter in px. Default 36. */
  size?: number;
}

export default function LivingBrainIndicator({
  primaryHue,
  secondaryHues,
  pulseRate = "steady",
  learnerName,
  size = 36,
}: LivingBrainIndicatorProps) {
  const label = learnerName ? `${learnerName}'s brain` : "Your brain";
  return (
    <span
      className="inline-flex items-center justify-center rounded-full"
      style={{ width: size, height: size }}
      title={label}
    >
      <PixiBrainSphere
        primaryHue={primaryHue}
        secondaryHues={secondaryHues}
        pulseRate={pulseRate}
        intensity={1}
        size={size}
        ariaLabel={label}
      />
    </span>
  );
}
