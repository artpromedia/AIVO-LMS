import { ParentHomeView } from "../_components/parent-home-view";

/**
 * /parent/home-v2 — kept as an alias of the canonical /parent/home while the
 * redesign is under QA, so the existing e2e/theming guards keep covering it.
 * Both routes render the same shared `ParentHomeView`, so they can never drift.
 */

export const dynamic = "force-dynamic";

export default async function ParentHomeV2({
  searchParams,
}: {
  searchParams: Promise<{ learner?: string }>;
}) {
  const { learner } = await searchParams;
  return <ParentHomeView selectedLearnerId={learner} />;
}
