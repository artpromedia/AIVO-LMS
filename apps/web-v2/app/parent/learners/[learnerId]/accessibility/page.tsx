/**
 * Sprint 15: Parent · Accessibility for a specific learner. Server component
 * loads current prefs and hands them to the shared client form.
 */
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { requirePageRole } from "@/lib/auth/server";
import { AppShell } from "@/components/layout/app-shell";
import { PageHeader } from "@/components/layout/page-header";
import { PARENT_NAV } from "@/components/layout/role-shells";
import { getAccessibilityPrefs, getLearner, parentCanAccessLearner } from "@/lib/db/repos";
import { AccessibilityForm } from "@/components/learner/accessibility-form";

export const dynamic = "force-dynamic";

export default async function ParentAccessibilityPage({
  params,
}: {
  params: Promise<{ learnerId: string }>;
}) {
  const session = await requirePageRole(["parent"]);
  const { learnerId } = await params;
  const t = await getTranslations("parent.learner_accessibility");
  if (!await parentCanAccessLearner(session.userId, learnerId, session.tenantId)) {
    notFound();
  }
  const learner = await getLearner(learnerId, session.tenantId);
  if (!learner) notFound();
  const prefs = getAccessibilityPrefs(learnerId, session.tenantId);

  return (
    <AppShell
      role="parent"
      roleLabel="Parent"
      navItems={PARENT_NAV}
      user={{ displayName: session.displayName, email: session.email }}
    >
      <PageHeader
        eyebrow={learner.displayName}
        title={t("title")}
        description="These settings change how lessons look, sound, and pace for this learner."
      />
      <AccessibilityForm learnerId={learnerId} initial={prefs} />
    </AppShell>
  );
}
