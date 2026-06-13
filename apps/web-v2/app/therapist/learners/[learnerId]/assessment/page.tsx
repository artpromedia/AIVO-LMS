/**
 * Therapist · learner assessment page (adaptive-learning E2E Sprint 6).
 *
 * The therapist counterpart of the parent assessment wizard: collects the
 * therapist's discipline, focus areas, strengths/challenges, regulation
 * strategies, accommodations and narrative notes, all OPTIONAL enrichments
 * for the baseline generator. Caseload-scoped: only learners on this
 * therapist's accepted care-team list resolve.
 */
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { requirePageRole } from "@/lib/auth/server";
import { AppShell } from "@/components/layout/app-shell";
import { PageHeader } from "@/components/layout/page-header";
import { THERAPIST_NAV } from "@/components/layout/role-shells";
import { Card } from "@/components/ui/card";
import { listLearnersForMember } from "@/lib/db/team-invites";
import { getLearner } from "@/lib/db/repos";
import { TherapistAssessmentForm } from "@/components/therapist/therapist-assessment-form";

export const dynamic = "force-dynamic";

export default async function TherapistAssessmentPage({
  params,
}: {
  params: Promise<{ learnerId: string }>;
}) {
  const session = await requirePageRole(["therapist", "platform_admin"]);
  const { learnerId } = await params;
  const t = await getTranslations("therapist.assessment");

  const caseload = await listLearnersForMember(
    session.userId,
    session.email,
    "therapist",
    session.tenantId,
  );
  if (!caseload.includes(learnerId)) notFound();
  const learner = await getLearner(learnerId, session.tenantId);
  if (!learner) notFound();

  return (
    <AppShell
      role="therapist"
      roleLabel="Therapist"
      navItems={THERAPIST_NAV}
      user={{ displayName: session.displayName, email: session.email }}
    >
      <PageHeader
        eyebrow={learner.displayName}
        title={t("title")}
        description={t("description", { name: learner.displayName })}
      />
      <Card className="max-w-5xl p-[var(--aivo-density-card-pad)]">
        <TherapistAssessmentForm learnerId={learnerId} />
      </Card>
    </AppShell>
  );
}
