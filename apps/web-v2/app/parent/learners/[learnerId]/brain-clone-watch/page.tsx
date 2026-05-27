/**
 * Sprint 14: Parent-side Brain Clone "Building Sequence" + approval gate.
 *
 * Runs in parallel with the learner's Awakening sequence
 * (`/learner/brain-clone/[learnerId]`). The parent sees the same brain
 * being assembled, but with explainable-AI annotations and the ability
 * to approve / amend the clone before it activates. Spec source:
 * `attached_assets/AIVO_Brain_Clone_Building_Sequence_*.md`.
 *
 * Server actions:
 *   - approveBrainCloneAction — flips cloneStage to "approved" and audits.
 *   - amendBrainCloneAction   — re-routes the parent to the brain-profile
 *                                edit surface; flagged "amended" once they
 *                                confirm.
 */
import { notFound, redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { requirePageRole } from "@/lib/auth/server";
import { AppShell } from "@/components/layout/app-shell";
import { PARENT_NAV } from "@/components/layout/role-shells";
import {
  approveBrainClone,
  getBrainProfile,
  getLearner,
  parentCanAccessLearner,
} from "@/lib/db/repos";
import { audit } from "@/lib/bff/audit";
import { newRequestId } from "@/lib/observability/logger";
import { BrainBuildingClient } from "./building-client";

async function approveBrainCloneAction(formData: FormData) {
  "use server";
  const { readMockSessionFromCookies } = await import("@/lib/auth/mock-session");
  const session = await readMockSessionFromCookies();
  if (!session || session.role !== "parent") redirect("/login");
  const learnerId = String(formData.get("learnerId") ?? "");
  if (!await parentCanAccessLearner(session.userId, learnerId, session.tenantId)) {
    redirect("/parent/learners");
  }
  const amended = String(formData.get("amended") ?? "") === "true";
  const result = approveBrainClone(learnerId, session.tenantId, { amended });
  audit(session, "brain_profile.approve", newRequestId(), {
    learnerId,
    metadata: { amended, ok: Boolean(result) },
  });
  redirect(`/parent/learners/${learnerId}`);
}

export default async function BrainCloneWatchPage({
  params,
}: {
  params: Promise<{ learnerId: string }>;
}) {
  const session = await requirePageRole(["parent"]);
  const { learnerId } = await params;
  if (!await parentCanAccessLearner(session.userId, learnerId, session.tenantId)) {
    notFound();
  }
  const learner = await getLearner(learnerId, session.tenantId);
  if (!learner) notFound();
  const profile = getBrainProfile(learnerId, session.tenantId);
  if (!profile || profile.cloneStage === "pre_clone") {
    redirect(`/parent/learners/${learnerId}/baseline`);
  }
  const t = await getTranslations("brain_clone");

  const s = profile.state;
  const alreadyApproved = profile.cloneStage === "approved";

  // Hand the client component just the data it needs to render the seven
  // build stages with real XAI annotations. We keep the parent-facing
  // copy in the i18n bundle and only pass dynamic data here.
  const stages = [
    {
      key: "template" as const,
      title: t("watch_step_template"),
      detail: s.xaiExplanation.summary,
    },
    {
      key: "domains" as const,
      title: t("watch_step_domains"),
      items: s.masteryOverview.map((m) => ({
        label: m.subjectName,
        value: m.estimate,
      })),
    },
    {
      key: "accommodations" as const,
      title: t("watch_step_accommodations"),
      items: s.xaiExplanation.accommodationDecisions.map((d) => ({ label: d })),
    },
    {
      key: "signals" as const,
      title: t("watch_step_signals"),
      items: s.xaiExplanation.masteryDecisions.slice(0, 6).map((d) => ({ label: d })),
    },
    {
      key: "tutors" as const,
      title: t("watch_step_tutors"),
      items: s.xaiExplanation.tutorDecisions.map((d) => ({ label: d })),
    },
    {
      key: "identity" as const,
      title: t("watch_step_identity"),
      detail: `${s.visualIdentity.primaryHue} · ${s.visualIdentity.pulseRate}`,
      swatches: [s.visualIdentity.primaryHue, ...s.visualIdentity.secondaryHues],
    },
    {
      key: "paths" as const,
      title: t("watch_step_paths"),
      items: s.activeTutors.map((slug) => ({ label: slug })),
    },
  ];

  return (
    <AppShell
      role="parent"
      roleLabel="Parent"
      navItems={PARENT_NAV}
      user={{ displayName: session.displayName, email: session.email }}
    >
      <BrainBuildingClient
        learnerId={learner.id}
        learnerName={learner.displayName}
        title={t("watch_title", { name: learner.displayName })}
        description={t("watch_description")}
        doneLabel={t("watch_step_done")}
        approveLabel={t("watch_approve")}
        amendLabel={t("watch_amend")}
        backLabel={t("watch_back")}
        alreadyApprovedLabel={t("watch_already_approved")}
        alreadyApproved={alreadyApproved}
        stages={stages}
        primaryHue={s.visualIdentity.primaryHue}
        approveAction={approveBrainCloneAction}
      />
    </AppShell>
  );
}
