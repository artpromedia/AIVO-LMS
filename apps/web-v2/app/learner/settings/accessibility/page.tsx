/**
 * Sprint 15: Learner · Accessibility settings. Same shared form, but in the
 * learner shell. Learners can adjust their own preferences; the route is
 * also reachable by parents shadowing a learner.
 */
import { redirect } from "next/navigation";
import { requirePageRole } from "@/lib/auth/server";
import { AppShell } from "@/components/layout/app-shell";
import { LEARNER_NAV } from "@/components/layout/role-shells";
import { PageHeader } from "@/components/layout/page-header";
import { getAccessibilityPrefs, getLearner, parentCanAccessLearner } from "@/lib/db/repos";
import { readActiveLearnerFromCookies } from "@/lib/auth/active-learner";
import { AccessibilityForm } from "@/components/learner/accessibility-form";

export const dynamic = "force-dynamic";

export default async function LearnerAccessibilitySettingsPage() {
  const session = await requirePageRole(["learner", "parent"]);
  let learnerId: string | null = null;
  if (session.role === "learner") {
    learnerId = session.learnerId ?? null;
    if (!learnerId) redirect("/learner/select");
  } else {
    learnerId = await readActiveLearnerFromCookies(session);
    if (!learnerId) redirect("/learner/select");
  }
  const learner = getLearner(learnerId, session.tenantId);
  if (!learner) redirect("/learner/select");
  // Parent path: ensure the active-learner cookie actually belongs to this
  // parent (defense in depth — `readActiveLearnerFromCookies` already
  // verifies but we re-check the repo-level ownership too).
  if (
    session.role !== "learner" &&
    !parentCanAccessLearner(session.userId, learnerId, session.tenantId)
  ) {
    redirect("/learner/select");
  }
  const prefs = getAccessibilityPrefs(learnerId, session.tenantId);

  return (
    <AppShell
      role={session.role === "learner" ? "learner" : "parent"}
      roleLabel={session.role === "learner" ? "Learner" : "Parent · Learner view"}
      navItems={LEARNER_NAV}
      user={{ displayName: session.displayName, email: session.email }}
    >
      <PageHeader
        eyebrow={learner.displayName}
        title="How you like to learn"
        description="Tweak these any time — your lessons will follow along."
      />
      <AccessibilityForm learnerId={learnerId} initial={prefs} />
    </AppShell>
  );
}
