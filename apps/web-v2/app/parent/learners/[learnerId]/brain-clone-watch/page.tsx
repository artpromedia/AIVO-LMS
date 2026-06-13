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
import { TUTORS, type TutorKey } from "@aivo/brand";
import { requirePageRole } from "@/lib/auth/server";
import { AppShell } from "@/components/layout/app-shell";
import { PARENT_NAV } from "@/components/layout/role-shells";
import {
  approveBrainClone,
  cloneBrainFromBaseline,
  getActiveBaselineForLearner,
  getBrainProfile,
  getLearner,
  getOrCreateParentAssessment,
  parentCanAccessLearner,
  refreshLearnerReadiness,
} from "@/lib/db/repos";
import { assessmentSectionSchemas } from "@/lib/validators/parent-assessment";
import { MASTERY_ESTIMATE_LABEL_KEY, estimateForScore } from "@/lib/learner/mastery-estimate";
import { visualBrainBuildEnabled } from "@/lib/feature-flags";
import { audit } from "@/lib/bff/audit";
import { newRequestId } from "@/lib/observability/logger";
import { BrainBuildingClient } from "./building-client";
import { BrainBuildPending } from "./build-pending";

async function approveBrainCloneAction(formData: FormData) {
  "use server";
  const { getSession } = await import("@/lib/auth/session");
  const session = await getSession();
  if (!session || session.role !== "parent") redirect("/login");
  const learnerId = String(formData.get("learnerId") ?? "");
  if (!(await parentCanAccessLearner(session.userId, learnerId, session.tenantId))) {
    redirect("/parent/learners");
  }
  const amended = String(formData.get("amended") ?? "") === "true";
  const result = await approveBrainClone(learnerId, session.tenantId, { amended });
  audit(session, "brain_profile.approve", newRequestId(), {
    learnerId,
    metadata: { amended, ok: Boolean(result) },
  });
  redirect(`/parent/learners/${learnerId}`);
}

async function rebuildBrainCloneAction(formData: FormData) {
  "use server";
  const { getSession } = await import("@/lib/auth/session");
  const session = await getSession();
  if (!session || session.role !== "parent") redirect("/login");
  const learnerId = String(formData.get("learnerId") ?? "");
  if (!(await parentCanAccessLearner(session.userId, learnerId, session.tenantId))) {
    redirect("/parent/learners");
  }
  // Re-run the clone from the most recent completed baseline (Sprint 5: an
  // actionable retry instead of a dead end). Best-effort; refresh readiness
  // either way so the parent's next step reflects the outcome.
  const rebuilt = await cloneBrainFromBaseline(learnerId, session.tenantId);
  await refreshLearnerReadiness(learnerId, session.tenantId);
  audit(session, "brain_clone.rebuild", newRequestId(), {
    learnerId,
    metadata: { ok: Boolean(rebuilt) },
  });
  redirect(`/parent/learners/${learnerId}/brain-clone-watch`);
}

export default async function BrainCloneWatchPage({
  params,
}: {
  params: Promise<{ learnerId: string }>;
}) {
  const session = await requirePageRole(["parent"]);
  const { learnerId } = await params;
  if (!(await parentCanAccessLearner(session.userId, learnerId, session.tenantId))) {
    notFound();
  }
  const learner = await getLearner(learnerId, session.tenantId);
  if (!learner) notFound();
  const profile = await getBrainProfile(learnerId, session.tenantId);
  const t = await getTranslations("brain_clone");
  if (!profile || profile.cloneStage === "pre_clone") {
    // Sprint 5: a clone is expected here but missing. If the baseline isn't
    // complete yet, the parent genuinely needs to finish it first. If it IS
    // complete, don't bounce to /baseline (which makes the build look broken)
    // — render an actionable pending surface with a rebuild action. Flag OFF
    // preserves the prior bounce so the change is reversible.
    const baseline = await getActiveBaselineForLearner(learnerId, session.tenantId);
    const baselineComplete = baseline?.status === "complete";
    if (!baselineComplete || !visualBrainBuildEnabled()) {
      redirect(`/parent/learners/${learnerId}/baseline`);
    }
    return (
      <AppShell
        role="parent"
        roleLabel="Parent"
        navItems={PARENT_NAV}
        user={{ displayName: session.displayName, email: session.email }}
      >
        <BrainBuildPending
          learnerId={learner.id}
          learnerName={learner.displayName}
          title={t("pending_title", { name: learner.displayName })}
          description={t("pending_description")}
          rebuildLabel={t("pending_rebuild")}
          backLabel={t("watch_back")}
          rebuildAction={rebuildBrainCloneAction}
        />
      </AppShell>
    );
  }

  const s = profile.state;
  const alreadyApproved = profile.cloneStage === "approved";

  // Strengths-first reveal (C-03): the parent assessment's strengths section
  // (the parent's own words) plus the subjects where the baseline estimate is
  // already confident/advanced — mirroring the learner Awakening's "memories"
  // selection in `app/learner/brain-clone/[learnerId]/page.tsx`.
  const assessment = await getOrCreateParentAssessment(learnerId, session.tenantId);
  const strengthsParsed = assessmentSectionSchemas.strengths.safeParse(
    assessment.answers.strengths ?? {},
  );
  const strengthsAnswers = strengthsParsed.success ? strengthsParsed.data : {};
  const strengths = {
    loves: (strengthsAnswers.loves ?? "").trim(),
    goodAt: (strengthsAnswers.goodAt ?? []).map((g) => g.trim()).filter(Boolean),
    motivates: (strengthsAnswers.motivates ?? "").trim(),
    strongSubjects: s.masteryOverview
      .filter((m) => m.estimate === "confident" || m.estimate === "advanced")
      .slice(0, 5)
      .map((m) => m.subjectName),
  };

  // The cinematic BrainBuildingSequence prefers the rich `*Detailed` XAI
  // arrays (camelCase decision objects). When the deterministic fallback
  // path produced only flat string arrays, synthesise equivalents so the
  // sequence still renders meaningful cards. Levels are always passed as
  // qualitative estimates — never grade numbers (C-03, Decision D4): the
  // authoritative `masteryOverview` estimate wins when the domain matches a
  // subject; otherwise the normalised score maps through the same thresholds.
  const xai = s.xaiExplanation;
  const estimateBySubject = new Map(s.masteryOverview.map((m) => [m.subjectId, m.estimate]));
  const masteryDecisions =
    xai.masteryDecisionsDetailed?.map((d) => ({
      domain: d.domain,
      displayLabel: d.displayLabel,
      reasoning: d.reasoning,
      estimate: estimateBySubject.get(d.domain) ?? estimateForScore(d.score),
    })) ??
    s.masteryOverview.map((m) => ({
      domain: m.subjectId,
      displayLabel: m.subjectName,
      reasoning: "",
      estimate: m.estimate,
    }));
  const accommodationDecisions =
    xai.accommodationDecisionsDetailed?.map((d) => ({
      accommodation: d.accommodation,
      displayLabel: d.displayLabel,
      reasoning: d.reasoning,
      source: d.source,
    })) ??
    xai.accommodationDecisions.map((label, i) => ({
      accommodation: `acc_${i}`,
      displayLabel: label,
      reasoning: "",
    }));
  const tutorDecisions =
    xai.tutorDecisionsDetailed?.map((d) => ({
      tutorKey: d.tutorKey,
      reasoning: d.reasoning,
    })) ?? s.activeTutors.map((slug) => ({ tutorKey: slug, reasoning: "" }));

  const sequence = {
    strengths,
    masteryDecisions,
    accommodationDecisions,
    tutorDecisions,
    pulseRate: s.visualIdentity.pulseRate,
  };

  // Parents see tutor display names from the brand catalogue, never raw
  // slugs. Unknown slugs (future tutors) are humanised defensively.
  const tutorDisplayName = (slug: string): string =>
    TUTORS[slug as TutorKey]?.name ??
    slug.replace(/[-_]/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

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
        // Qualitative estimate, humanised — never the raw enum (C-03).
        value: t(MASTERY_ESTIMATE_LABEL_KEY[m.estimate]),
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
      swatches: [s.visualIdentity.primaryHue, ...s.visualIdentity.secondaryHues],
    },
    {
      key: "paths" as const,
      title: t("watch_step_paths"),
      items: s.activeTutors.map((slug) => ({ label: tutorDisplayName(slug) })),
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
        eyebrowLabel={t("watch_eyebrow", { name: learner.displayName })}
        sphereAriaLabel={t("clone_child_label", { name: learner.displayName })}
        doneLabel={t("watch_step_done")}
        approveLabel={t("watch_approve")}
        amendLabel={t("watch_amend")}
        backLabel={t("watch_back")}
        alreadyApprovedLabel={t("watch_already_approved")}
        replayCloneLabel={t("clone_replay")}
        privacyNoteLabel={t("privacy_family")}
        privacyLinkLabel={t("watch_privacy_link")}
        alreadyApproved={alreadyApproved}
        stages={stages}
        primaryHue={s.visualIdentity.primaryHue}
        secondaryHues={s.visualIdentity.secondaryHues}
        sequence={sequence}
        approveAction={approveBrainCloneAction}
      />
    </AppShell>
  );
}
