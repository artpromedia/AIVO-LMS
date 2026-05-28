/**
 * Sprint 14: Learner-side Brain Clone Awakening sequence.
 *
 * Triggered post-baseline by `completeAction` in
 * `/learner/baseline/[baselineId]/page.tsx`. Renders a full-screen animated
 * "awakening" where the learner watches their personal AI brain come
 * together from the assessment + baseline they just finished. Spec source:
 * `attached_assets/AIVO_Brain_Clone_Awakening_Sequence_*.md`.
 *
 * Gating:
 *   - Requires the learner role and a valid brain profile.
 *   - If the clone hasn't happened yet (`cloneStage === "pre_clone"`), we
 *     route them back to the baseline.
 *   - If the clone is already approved, we route them straight to the
 *     learner home (the awakening is a once-per-learner moment).
 */
import { redirect } from "next/navigation";
import { requirePageRole } from "@/lib/auth/server";
import { getBrainProfile, getLearner } from "@/lib/db/repos";
import { AwakeningClient } from "./awakening-client";

export default async function BrainCloneAwakeningPage({
  params,
}: {
  params: Promise<{ learnerId: string }>;
}) {
  const session = await requirePageRole(["learner"]);
  const { learnerId } = await params;
  // The learner role is always scoped to a single learnerId via the session.
  // Defense-in-depth: never let a learner load some other learner's awakening.
  if (!session.learnerId || session.learnerId !== learnerId) {
    redirect("/learner/home");
  }
  const learner = await getLearner(learnerId, session.tenantId);
  if (!learner) redirect("/learner/home");
  const profile = await getBrainProfile(learnerId, session.tenantId);
  if (!profile) redirect("/learner/baseline");
  if (profile.cloneStage === "pre_clone") {
    redirect("/learner/baseline");
  }
  if (profile.cloneStage === "approved") {
    // Already lived this moment; skip.
    redirect("/learner/home");
  }

  const state = profile.state;
  // Top strongest subjects power the "memories" phase of the sequence.
  const topMemories = state.masteryOverview
    .filter((m) => m.estimate === "confident" || m.estimate === "advanced")
    .slice(0, 5)
    .map((m) => m.subjectName);
  const fallbackMemories = state.masteryOverview.slice(0, 5).map((m) => m.subjectName);
  const memories = topMemories.length > 0 ? topMemories : fallbackMemories;

  return (
    <AwakeningClient
      displayName={learner.displayName}
      primaryHue={state.visualIdentity.primaryHue}
      secondaryHues={state.visualIdentity.secondaryHues}
      pulseRate={state.visualIdentity.pulseRate}
      memories={memories}
    />
  );
}
