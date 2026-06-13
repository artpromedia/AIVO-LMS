/**
 * Sprint 14 / C-06: Parent-side Brain Clone "Building Sequence" + the approval
 * ceremony.
 *
 * Runs in parallel with the learner's Awakening sequence
 * (`/learner/brain-clone/[learnerId]`). The parent sees the same profile being
 * assembled, then performs the **approval ceremony** (C-06): the Responsible-AI
 * disclosures, an explicit consent checkbox, and a deliberate two-step approve
 * — after which the system writes a dedicated approval record (actor, consent
 * version, RAI version, profile revision, modifications, ipHash) and lands the
 * parent on the ignition + "what happens next" screen.
 *
 * Server actions:
 *   - approveBrainCloneAction — REQUIRES consentGiven + raiAcknowledged
 *     server-side (defense-in-depth; a forged POST without them is rejected),
 *     folds any C-05 staged corrections via `approveBrainClone`, writes the
 *     approval record, then redirects to the celebration screen.
 *   - rebuildBrainCloneAction — re-runs the clone from the latest baseline.
 */
import { notFound, redirect } from "next/navigation";
import { headers } from "next/headers";
import { getTranslations } from "next-intl/server";
import { TUTORS, type TutorKey } from "@aivo/brand";
import { requirePageRole } from "@/lib/auth/server";
import { AppShell } from "@/components/layout/app-shell";
import { PARENT_NAV } from "@/components/layout/role-shells";
import {
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
import { selectBrainExplainability } from "@/lib/learner/brain-explainability";
import { getContributionStatus } from "@/lib/collaboration/contribution-status";
import { pickTodaysMission } from "@/lib/learner/today";
import {
  assembleContributions,
  assembleOperatingInstructions,
  assembleStartingPoints,
  buildShareArtifact,
} from "@/lib/learner/reveal-assembly";
import { revealAction } from "@/lib/learner/reveal-telemetry";
import { getPersistence } from "@/lib/db/persistence";
import { SUPPORT_DEFAULT_BY_SLUG, type CoreSupportSlug } from "@/lib/db/brain-corrections";
import { hashIpFromHeaders } from "@/lib/bff/consent-guard";
import { visualBrainBuildEnabled } from "@/lib/feature-flags";
import { audit } from "@/lib/bff/audit";
import { newRequestId, logger } from "@/lib/observability/logger";
import type { LearnerBrainProfileState } from "@/lib/db/types";
import { BrainBuildingClient } from "./building-client";
import { BrainBuildPending } from "./build-pending";
import { performBrainApproval, BRAIN_CONSENT_VERSION } from "./approve-action";

/** The five core supports, with the translated label key used on the review
 *  screen (`parent.brain_review.support_*`) — reused here so screen 7's active
 *  supports list speaks the same language without new i18n keys. */
const CORE_SUPPORTS: Array<{ slug: CoreSupportSlug; labelKey: string }> = [
  { slug: "extended_time", labelKey: "support_extended_time" },
  { slug: "read_aloud", labelKey: "support_read_aloud" },
  { slug: "speech_to_text", labelKey: "support_speech_to_text" },
  { slug: "visual_schedules", labelKey: "support_visual_schedules" },
  { slug: "sensory_breaks", labelKey: "support_sensory_breaks" },
];
const EXTRA_SUPPORT_LABEL_KEY: Record<string, string> = {
  aac_communication_support: "support_aac_communication_support",
};

function humanizeSupport(value: string): string {
  const spaced = value.replace(/[-_]/g, " ").trim();
  return spaced.length === 0 ? value : spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

/** The active support labels for screen 7 (core supports that are ON + any
 *  non-core active accommodation), humanised via the review-screen catalog. */
function activeSupportLabels(
  state: LearnerBrainProfileState,
  tReview: Awaited<ReturnType<typeof getTranslations>>,
): string[] {
  const labels: string[] = [];
  for (const core of CORE_SUPPORTS) {
    const on =
      state.supportDefaults[SUPPORT_DEFAULT_BY_SLUG[core.slug]] ||
      state.activeAccommodations.includes(core.slug);
    if (on) labels.push(tReview(core.labelKey));
  }
  const coreSlugs = new Set<string>(CORE_SUPPORTS.map((c) => c.slug));
  for (const acc of state.activeAccommodations) {
    if (coreSlugs.has(acc)) continue;
    const labelKey = EXTRA_SUPPORT_LABEL_KEY[acc];
    labels.push(labelKey ? tReview(labelKey) : humanizeSupport(acc));
  }
  return labels;
}

async function approveBrainCloneAction(formData: FormData) {
  "use server";
  const { getSession } = await import("@/lib/auth/session");
  const session = await getSession();
  if (!session || session.role !== "parent") redirect("/login");
  const learnerId = String(formData.get("learnerId") ?? "");
  if (!(await parentCanAccessLearner(session.userId, learnerId, session.tenantId))) {
    redirect("/parent/learners");
  }

  // Sprint C-06 — the trust gate + fold + record live in `performBrainApproval`
  // (testable without Next's redirect machinery). The ceremony UI disables the
  // action until the RAI panel is opened and the consent box is checked, but a
  // forged POST that omits either field is REJECTED here regardless of the UI.
  const result = await performBrainApproval({
    tenantId: session.tenantId,
    actorUserId: session.userId,
    learnerId,
    consentGiven: String(formData.get("consentGiven") ?? "") === "true",
    raiAcknowledged: String(formData.get("raiAcknowledged") ?? "") === "true",
    consentVersion: String(formData.get("consentVersion") ?? "") || BRAIN_CONSENT_VERSION,
    raiVersion: String(formData.get("raiVersion") ?? "") || null,
    ipHash: hashIpFromHeaders(await headers()),
  });

  if (!result.ok) {
    logger.warn({ event: "brain_profile.approve_rejected", learnerId, reason: result.reason });
    // Bounce back to the ceremony — nothing was approved or recorded.
    redirect(`/parent/learners/${learnerId}/brain-clone-watch`);
  }

  audit(session, "brain_profile.approve", newRequestId(), {
    learnerId,
    metadata: {
      amended: result.profile.approvalStatus === "amended",
      approvalRecordId: result.record.id,
      profileRevision: result.record.profileRevision,
      consentVersion: result.record.consentVersion,
      raiVersion: result.record.raiVersion,
    },
  });
  // Sprint C-14 — the AUTHORITATIVE terminal reveal event (approved | amended),
  // recorded server-side from the approval result so a forged client POST can't
  // inflate the conversion funnel. `computeRevealFunnel` reads this back.
  audit(session, revealAction(result.record.action === "amended" ? "amended" : "approved"), newRequestId(), {
    learnerId,
    metadata: { surface: "reveal", approvalRecordId: result.record.id },
  });
  // Land on the ignition + "what happens next" celebration screen.
  redirect(`/parent/learners/${learnerId}/brain-clone-watch?celebrate=1`);
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
  searchParams,
}: {
  params: Promise<{ learnerId: string }>;
  searchParams: Promise<{ celebrate?: string }>;
}) {
  const session = await requirePageRole(["parent"]);
  const { learnerId } = await params;
  const { celebrate } = await searchParams;
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
  const celebrating = celebrate === "1" && alreadyApproved;
  // Sprint C-05: corrections the parent staged on the review screen are
  // applied when they approve here. Surface the count so the recap's Approve
  // button is honest about what it will do (the fold happens in
  // `approveBrainClone`, which reads the staged draft).
  const stagedCorrectionCount = s.parentCorrectionsDraft?.modifications.length ?? 0;

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

  // ── Sprint C-14: the stitched reveal (screens 1–4) + share artifact ──
  // All view-models are assembled server-side by the pure `reveal-assembly`
  // module so contribution counts, source chips, and the share artifact's
  // field surface are deterministic + tested. The baseline-answered count is
  // already on the profile (`confidenceSignals.baselineAttempts` ===
  // BaselineSummary.totalAnswered — see repos.ts), so no extra fetch is needed.
  // Best-effort read (mirrors repos' isolated insight fetch): an optional input
  // never blocks the reveal. Returns [] on any failure.
  const collaboratorInsights = await getPersistence()
    .collaboration.listInsightsForLearner(learnerId, session.tenantId)
    .catch(() => []);
  const baselineAnswered = s.confidenceSignals.baselineAttempts;
  const contributions = assembleContributions({
    parentCompletedSections: assessment.completedSections.length,
    parentSubmitted: s.confidenceSignals.parentAssessment,
    baselineAnswered,
    collaboratorInsights: collaboratorInsights.map((i) => ({ authorRole: i.authorRole })),
    iepOnFile: s.confidenceSignals.iep || Boolean(s.iepProfile?.uploaded),
  });
  const instructions = assembleOperatingInstructions({ state: s, baselineAnswered });
  const startingPoints = assembleStartingPoints(s);
  // First-name-only for the share artifact (never the display name, which may
  // carry a surname initial). Falls back through preferredName → firstName.
  const childFirstName =
    learner.preferredName?.trim() || learner.firstName?.trim() || learner.displayName.split(" ")[0];
  const shareContent = buildShareArtifact({
    firstName: childFirstName,
    goodAt: strengths.goodAt,
    strongSubjects: strengths.strongSubjects,
    loves: strengths.loves,
    motivates: strengths.motivates,
  });
  const reveal = {
    contributions,
    strengths: {
      goodAt: strengths.goodAt,
      loves: strengths.loves,
      strongSubjects: strengths.strongSubjects,
      // Web-v2 state carries no baseline process signals today; degrade
      // gracefully (no fabricated "self-corrected N times" line).
      observedStrength: null,
    },
    instructions,
    startingPoints,
    shareContent,
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

  // ── Sprint C-06: ceremony (screen 6) + "what happens next" (screen 7) ──
  const explain = selectBrainExplainability(s);

  // Sprint C-08 — "N of M voices": which invited teammates shaped the
  // profile. When nobody contributed (or nobody was invited), the chip is
  // honest about what the profile was built from; when contributed < invited,
  // a quiet link points the parent to the team hub to nudge the rest.
  const { voices: voiceCounts } = await getContributionStatus(learnerId, session.tenantId);
  const ceremonyVoices =
    voiceCounts.invited > 0
      ? {
          invited: voiceCounts.invited,
          contributed: voiceCounts.contributed,
          label: t("ceremony_voices_label", {
            contributed: voiceCounts.contributed,
            invited: voiceCounts.invited,
          }),
          zeroLabel: t("ceremony_voices_zero", { name: learner.displayName }),
          linkLabel: t("ceremony_voices_link"),
          hubHref: `/parent/learners/${learner.id}/team`,
        }
      : null;

  const ceremony = {
    rai: {
      sources: explain.raiComplianceDetail.dataSources,
      biasMitigations: explain.raiComplianceDetail.biasMitigations,
      transparency: explain.raiComplianceDetail.transparency,
      humanOversight: explain.raiComplianceDetail.humanOversight,
    },
    voices: ceremonyVoices,
    consentVersion: BRAIN_CONSENT_VERSION,
    // The RAI disclosures are pinned to the revision the parent is reviewing.
    raiVersion: String(profile.revision),
    strings: {
      recap: t("ceremony_recap"),
      raiToggle: t("ceremony_rai_toggle"),
      raiClose: t("ceremony_rai_close"),
      raiSourcesTitle: t("ceremony_rai_sources_title"),
      raiSourcesEmpty: t("ceremony_rai_sources_empty", { name: learner.displayName }),
      raiBiasTitle: t("ceremony_rai_bias_title"),
      raiTransparencyTitle: t("ceremony_rai_transparency_title"),
      raiOversightTitle: t("ceremony_rai_oversight_title"),
      consentTitle: t("ceremony_consent_title", { name: learner.displayName }),
      consentDesc: t("ceremony_consent_desc"),
      gateHint: t("ceremony_gate_hint"),
      review: t("ceremony_review"),
      confirmTitle: t("ceremony_confirm_title", { name: learner.displayName }),
      confirmBody: t("ceremony_confirm_body"),
      confirm: t("ceremony_confirm"),
      cancel: t("ceremony_cancel"),
      hold: t("ceremony_hold"),
      holdRelease: t("ceremony_hold_release"),
      holdProgress: t("ceremony_hold_progress"),
      submitting: t("ceremony_submitting"),
      amendLabel: t("watch_amend"),
      stagedCorrections:
        stagedCorrectionCount > 0
          ? t("watch_corrections_staged", { count: stagedCorrectionCount })
          : null,
    },
  };

  // Screen 7 is only rendered when celebrating; compute its data only then to
  // avoid the mission-picker work on the recap path.
  const tReview = await getTranslations("parent.brain_review");
  let nextSteps;
  const nextStepsStrings = {
    eyebrow: t("next_eyebrow"),
    title: t("next_title", { name: learner.displayName }),
    subtitle: t("next_subtitle"),
    missionTitle: t("next_mission_title", { name: learner.displayName }),
    missionBlocked: t("next_mission_blocked", { name: learner.displayName }),
    supportsTitle: t("next_supports_title"),
    supportsEmpty: t("next_supports_empty"),
    inviteTitle: t("next_invite_title", { name: learner.displayName }),
    inviteBody: t("next_invite_body"),
    inviteCta: t("next_invite_cta", { name: learner.displayName }),
    reassure: t("next_reassure", { name: learner.displayName }),
    done: t("next_done", { name: learner.displayName }),
    sphereAriaLabel: t("clone_child_label", { name: learner.displayName }),
  };
  if (celebrating) {
    const mission = await pickTodaysMission(learnerId, session.tenantId);
    nextSteps = {
      mission: mission.ready
        ? {
            ready: true as const,
            caption: t("next_mission_ready_caption", {
              name: learner.displayName,
              subject: mission.mission.subjectName,
            }),
          }
        : ({ ready: false as const }),
      supports: activeSupportLabels(s, tReview),
      strings: nextStepsStrings,
    };
  } else {
    // A non-celebrating render never mounts WhatHappensNext, but the client
    // prop is required — pass a cheap, fully-valid default bundle (the
    // not-ready mission is a real designed state, not an empty fill).
    nextSteps = {
      mission: { ready: false as const },
      supports: [] as string[],
      strings: nextStepsStrings,
    };
  }

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
        backLabel={t("watch_back")}
        alreadyApprovedLabel={t("watch_already_approved")}
        replayCloneLabel={t("clone_replay")}
        privacyNoteLabel={t("privacy_family")}
        privacyLinkLabel={t("watch_privacy_link")}
        detailsToggleLabel={t("reveal_details_toggle")}
        alreadyApproved={alreadyApproved}
        celebrate={celebrating}
        stages={stages}
        primaryHue={s.visualIdentity.primaryHue}
        secondaryHues={s.visualIdentity.secondaryHues}
        sequence={sequence}
        reveal={reveal}
        ceremony={ceremony}
        nextSteps={nextSteps}
        approveAction={approveBrainCloneAction}
      />
    </AppShell>
  );
}
