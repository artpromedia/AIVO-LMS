"use client";

/**
 * Sprint 5 — Brain build pending surface.
 *
 * Shown when a completed baseline has not yet produced a `cloned` brain
 * profile. Instead of bouncing the parent to /baseline (which made the
 * visual build look broken), we render the living brain sphere + an
 * actionable rebuild control, so the parent always has a real next step.
 *
 * The sphere mounts here too so "no animation" can't regress unnoticed:
 * PixiBrainSphere falls back to the CSS orb under reduced-motion / no-WebGL.
 */
import Link from "next/link";
import { BRAIN_VISUAL_IDENTITY_PALETTE } from "@aivo/brand";
import PixiBrainSphere from "@/components/brain/pixi-brain-sphere";

// Default palette for the not-yet-cloned brain (clone will pick the
// functioning-level palette). Sourced from @aivo/brand so no hex is hardcoded.
const PALETTE = BRAIN_VISUAL_IDENTITY_PALETTE.STANDARD;

export function BrainBuildPending({
  learnerId,
  learnerName,
  title,
  description,
  rebuildLabel,
  backLabel,
  rebuildAction,
}: {
  learnerId: string;
  learnerName: string;
  title: string;
  description: string;
  rebuildLabel: string;
  backLabel: string;
  rebuildAction: (formData: FormData) => void | Promise<void>;
}) {
  return (
    <div data-testid="brain-build-pending" className="mx-auto max-w-[640px] px-0 py-8 text-center">
      <div className="mb-5 flex justify-center">
        <PixiBrainSphere
          primaryHue={PALETTE.primary}
          secondaryHues={[...PALETTE.secondaries]}
          pulseRate="steady"
          size={200}
          ariaLabel={`${learnerName}'s brain, still building`}
        />
      </div>
      <h1 className="text-[clamp(1.5rem,3vmin,2rem)] font-bold text-iw-text-strong">{title}</h1>
      <p className="mx-auto mb-6 mt-2 max-w-[480px] leading-relaxed text-iw-text-muted">
        {description}
      </p>
      <div className="flex flex-wrap justify-center gap-3">
        <form action={rebuildAction}>
          <input type="hidden" name="learnerId" value={learnerId} />
          <button
            type="submit"
            data-testid="brain-build-rebuild"
            className="rounded-iw-control bg-[var(--aivo-sensory-primary)] px-6 py-3 font-semibold text-white hover:opacity-90"
          >
            {rebuildLabel}
          </button>
        </form>
        <Link
          href={`/parent/learners/${learnerId}`}
          className="rounded-iw-control border border-iw-border px-6 py-3 font-semibold text-iw-text-strong hover:bg-iw-hover"
        >
          {backLabel}
        </Link>
      </div>
    </div>
  );
}
