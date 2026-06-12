import { redirect } from "next/navigation";

/**
 * Remediation Sprint 12 — the snapshot page was a hardcoded mockup
 * ("Emma", "2h 14m", static chips) with no data-layer reads; the audit
 * flagged it as the one fake parent surface. The REAL parent views are
 * `progress` (mastery + trajectory) and `gradebook`; this route now sends
 * parents there instead of showing invented numbers.
 */
export default async function ParentLearnerSnapshotPage({
  params,
}: {
  params: Promise<{ learnerId: string }>;
}) {
  const { learnerId } = await params;
  redirect(`/parent/learners/${learnerId}/progress`);
}
