import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { ArrowRight, RefreshCw, Sparkles } from "lucide-react";
import { requirePageRole } from "@/lib/auth/server";
import { AppShell } from "@/components/layout/app-shell";
import { PageHeader, SectionHeader } from "@/components/layout/page-header";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { PARENT_NAV } from "@/components/layout/role-shells";
import {
  getBrainProfile,
  getIEPForLearner,
  getLearner,
  getOrCreateParentAssessment,
  listPendingStructuralChanges,
  listSubjects,
  parentCanAccessLearner,
  refreshLearnerReadiness,
  upsertBrainProfile,
} from "@/lib/db/repos";
import { audit } from "@/lib/bff/audit";
import { newRequestId } from "@/lib/observability/logger";
import { buildBrainProfile } from "@/lib/learner/brain-profile";
import { brainProfileStateSchema } from "@/lib/validators/brain-profile";
import type { LearnerBrainProfileState } from "@/lib/db/types";
import { RegenerateConfirm } from "./regenerate-confirm";

const PERSONA_LABEL: Record<
  LearnerBrainProfileState["tutorPersonaRecommendation"]["style"],
  string
> = {
  warm_coach: "Warm coach",
  playful_friend: "Playful friend",
  calm_guide: "Calm guide",
  structured_mentor: "Structured mentor",
};

async function regenerateAction(formData: FormData) {
  "use server";
  const { getSession } = await import("@/lib/auth/session");
  const session = await getSession();
  if (!session || session.role !== "parent") redirect("/login");
  const learnerId = String(formData.get("learnerId") || "");
  if (!(await parentCanAccessLearner(session.userId, learnerId, session.tenantId))) {
    redirect("/parent/learners");
  }
  const learner = await getLearner(learnerId, session.tenantId);
  const assessment = await getOrCreateParentAssessment(learnerId, session.tenantId);
  if (!learner) redirect("/parent/learners");
  if (!assessment.submittedAt) {
    redirect(`/parent/learners/${learnerId}/assessment`);
  }
  const iep = await getIEPForLearner(learnerId, session.tenantId);
  const candidate = buildBrainProfile({
    learner: learner!,
    assessment,
    iepExtraction: iep?.extraction ?? null,
    iepUploaded: Boolean(iep),
    subjects: await listSubjects(),
    baselineAttempts: 0,
  });
  const v = brainProfileStateSchema.safeParse(candidate);
  if (v.success) {
    await upsertBrainProfile(learnerId, session.tenantId, v.data);
  }
  await refreshLearnerReadiness(learnerId, session.tenantId);
  audit(session, "brain_profile.regenerate", newRequestId(), {
    learnerId,
    metadata: { ok: v.success },
  });
  // Sprint C-05 (EDIT-2): regenerate resets the clone to `pre_clone`
  // (`upsertBrainProfile`), so route the parent forward to the brain-clone-watch
  // surface that owns the pending/rebuild flow — never silently strand them back
  // on this read-only page the way HEAD did.
  redirect(`/parent/learners/${learnerId}/brain-clone-watch`);
}

export default async function BrainProfilePage({
  params,
}: {
  params: Promise<{ learnerId: string }>;
}) {
  const session = await requirePageRole(["parent"]);
  const t = await getTranslations("parent.learner_brain_profile");
  const { learnerId } = await params;
  if (!(await parentCanAccessLearner(session.userId, learnerId, session.tenantId))) {
    notFound();
  }
  const learner = await getLearner(learnerId, session.tenantId);
  if (!learner) notFound();

  const assessment = await getOrCreateParentAssessment(learnerId, session.tenantId);
  if (!assessment.submittedAt) {
    return (
      <AppShell
        role="parent"
        roleLabel="Parent"
        navItems={PARENT_NAV}
        user={{ displayName: session.displayName, email: session.email }}
      >
        <PageHeader
          eyebrow={`Brain profile for ${learner.displayName}`}
          title={t("finish_assessment_first")}
          description="The brain profile is built from your assessment plus any IEP you share. Submit the assessment and we'll generate it automatically."
        />
        <EmptyState
          title={t("assessment_not_submitted")}
          action={
            <Button asChild>
              <Link href={`/parent/learners/${learner.id}/assessment`}>
                {t("continue_assessment")} <ArrowRight className="ml-1 h-4 w-4" />
              </Link>
            </Button>
          }
        />
      </AppShell>
    );
  }

  const iep = await getIEPForLearner(learnerId, session.tenantId);
  // Auto-generate on first visit: builds from the deterministic fallback so a
  // parent always sees content, never an empty page. Subsequent visits hit the
  // cache; regenerate is an explicit user action.
  let profile = await getBrainProfile(learnerId, session.tenantId);
  if (!profile) {
    const candidate = buildBrainProfile({
      learner,
      assessment,
      iepExtraction: iep?.extraction ?? null,
      iepUploaded: Boolean(iep),
      subjects: await listSubjects(),
      baselineAttempts: 0,
    });
    const v = brainProfileStateSchema.safeParse(candidate);
    if (v.success) {
      profile = await upsertBrainProfile(learnerId, session.tenantId, v.data);
      await refreshLearnerReadiness(learnerId, session.tenantId);
      audit(session, "brain_profile.auto_generate", newRequestId(), { learnerId });
    }
  }

  if (!profile) {
    return (
      <AppShell
        role="parent"
        roleLabel="Parent"
        navItems={PARENT_NAV}
        user={{ displayName: session.displayName, email: session.email }}
      >
        <PageHeader
          eyebrow={`Brain profile for ${learner.displayName}`}
          title={t("could_not_generate")}
          description="Something went wrong. Try again — we keep a deterministic fallback so this should always work."
        />
        <form action={regenerateAction}>
          <input type="hidden" name="learnerId" value={learner.id} />
          <Button type="submit">
            <RefreshCw className="mr-1 h-4 w-4" /> {t("try_again")}
          </Button>
        </form>
      </AppShell>
    );
  }

  const s = profile.state;

  // C-13: the persistent in-app badge — un-acked structural changes show a
  // count on the "what changed" link until the parent acknowledges them. This
  // is what the N-day window escalates to; it never blocks teaching.
  const pendingChanges =
    profile.cloneStage !== "pre_clone"
      ? (await listPendingStructuralChanges(learner.id, session.tenantId)).length
      : 0;

  return (
    <AppShell
      role="parent"
      roleLabel="Parent"
      navItems={PARENT_NAV}
      user={{ displayName: session.displayName, email: session.email }}
    >
      <PageHeader
        eyebrow={`Brain profile for ${learner.displayName}`}
        title={t("page_title")}
        description="Generated from your assessment and any IEP you shared. You can re-generate at any time after updating your inputs."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            {/* C-13: the change timeline is reachable once a clone exists. The
                pending-ack count is the persistent badge the N-day window
                escalates to — visible until the parent acknowledges. */}
            {profile.cloneStage !== "pre_clone" ? (
              <Button variant="outline" asChild>
                <Link href={`/parent/learners/${learner.id}/brain-timeline`}>
                  {t("what_changed")}
                  {pendingChanges > 0 ? (
                    <Badge tone="primary" className="ml-2">
                      {pendingChanges}
                    </Badge>
                  ) : null}
                </Link>
              </Button>
            ) : null}
            <RegenerateConfirm
              learnerId={learner.id}
              regenerateAction={regenerateAction}
              triggerLabel={t("regenerate")}
              title={t("regenerate_confirm_title")}
              body={t("regenerate_confirm_body", { name: learner.displayName })}
              confirmLabel={t("regenerate_confirm_cta")}
              cancelLabel={t("regenerate_confirm_cancel")}
            />
          </div>
        }
      />

      {/* Sprint C-05 (EDIT-3): once the brain is cloned and awaiting review,
          surface the review & correct screen prominently — the parent's path to
          confirm/adjust each inference before approving. Hidden once approved. */}
      {profile.cloneStage === "cloned" ? (
        <Card className="mb-4 flex flex-wrap items-center justify-between gap-3 border-aivo-primary/40 bg-aivo-primary/5 p-4">
          <p className="text-sm font-medium text-aivo-ink">
            {t("review_and_adjust_hint", { name: learner.displayName })}
          </p>
          <Button asChild>
            <Link href={`/parent/learners/${learner.id}/brain-review`}>
              {t("review_and_adjust")} <ArrowRight className="ml-1 h-4 w-4" />
            </Link>
          </Button>
        </Card>
      ) : null}

      <Card className="mb-4 flex items-start gap-3 p-4">
        <Sparkles className="h-5 w-5 shrink-0 text-aivo-primary" />
        <div className="text-sm">
          <p className="font-medium">{t("recommended_tutor_persona")}</p>
          <p className="mt-1 text-aivo-ink-soft">
            <span className="font-semibold text-aivo-ink">
              {PERSONA_LABEL[s.tutorPersonaRecommendation.style]}
            </span>{" "}
            — {s.tutorPersonaRecommendation.rationale}
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            <Badge tone={s.source === "ai_generated" ? "primary" : "neutral"}>
              {s.source === "ai_generated" ? "AI-generated" : "Deterministic"}
            </Badge>
            <Badge tone={s.confidenceSignals.parentAssessment ? "success" : "neutral"}>
              {s.confidenceSignals.parentAssessment ? "Assessment ✓" : "Assessment pending"}
            </Badge>
            <Badge tone={s.confidenceSignals.iep ? "success" : "neutral"}>
              {s.confidenceSignals.iep ? "IEP ✓" : "No IEP"}
            </Badge>
            <Badge
              tone={
                profile.cloneStage === "approved"
                  ? "success"
                  : profile.cloneStage === "cloned"
                    ? "primary"
                    : "neutral"
              }
            >
              {profile.cloneStage === "approved"
                ? "Brain clone approved"
                : profile.cloneStage === "cloned"
                  ? `Brain cloned (${s.confidenceSignals.baselineAttempts} baseline answers)`
                  : "Pre-clone (baseline pending)"}
            </Badge>
          </div>
        </div>
      </Card>

      <SectionHeader title={t("parent_assessment_summary")} />
      <Card className="p-[var(--aivo-density-card-pad)] text-sm">{s.parentAssessmentSummary}</Card>

      <SectionHeader title={t("accommodation_summary")} className="mt-6" />
      <Card className="p-[var(--aivo-density-card-pad)] text-sm">{s.accommodationSummary}</Card>

      <SectionHeader title={t("learning_profile")} className="mt-6" />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Card className="p-[var(--aivo-density-card-pad)]">
          <p className="text-xs font-medium uppercase tracking-wide text-aivo-ink-soft">
            {t("sensory_profile")}
          </p>
          <dl className="mt-2 space-y-1 text-sm">
            <div className="flex justify-between gap-2">
              <dt className="text-aivo-ink-soft">{t("pattern")}</dt>
              <dd className="capitalize">{s.sensoryProfile.seekingOrAvoiding}</dd>
            </div>
            <div>
              <dt className="text-aivo-ink-soft">{t("sensitivities")}</dt>
              <dd className="mt-1 flex flex-wrap gap-1">
                {s.sensoryProfile.sensitivities.length === 0
                  ? "none"
                  : s.sensoryProfile.sensitivities.map((x) => (
                      <Badge key={x} tone="neutral">
                        {x}
                      </Badge>
                    ))}
              </dd>
            </div>
          </dl>
        </Card>

        <Card className="p-[var(--aivo-density-card-pad)]">
          <p className="text-xs font-medium uppercase tracking-wide text-aivo-ink-soft">
            {t("attention")}
          </p>
          <dl className="mt-2 space-y-1 text-sm">
            <div className="flex justify-between gap-2">
              <dt className="text-aivo-ink-soft">{t("focus_window")}</dt>
              <dd>{s.attentionProfile.focusWindowMinutes} min</dd>
            </div>
            <div className="flex justify-between gap-2">
              <dt className="text-aivo-ink-soft">{t("breaks")}</dt>
              <dd className="capitalize">{s.attentionProfile.breakStyle.replaceAll("_", " ")}</dd>
            </div>
            <div className="flex justify-between gap-2">
              <dt className="text-aivo-ink-soft">{t("movement_helps")}</dt>
              <dd>{s.attentionProfile.movementHelps ? "Yes" : "No"}</dd>
            </div>
          </dl>
        </Card>

        <Card className="p-[var(--aivo-density-card-pad)]">
          <p className="text-xs font-medium uppercase tracking-wide text-aivo-ink-soft">
            {t("comfort")}
          </p>
          <dl className="mt-2 space-y-1 text-sm">
            <div className="flex justify-between gap-2">
              <dt className="text-aivo-ink-soft">{t("reading")}</dt>
              <dd className="capitalize">{s.readingComfort}</dd>
            </div>
            <div className="flex justify-between gap-2">
              <dt className="text-aivo-ink-soft">Math</dt>
              <dd className="capitalize">{s.mathComfort}</dd>
            </div>
          </dl>
        </Card>

        <Card className="p-[var(--aivo-density-card-pad)]">
          <p className="text-xs font-medium uppercase tracking-wide text-aivo-ink-soft">
            {t("preferred_modalities")}
          </p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {s.preferredModalities.map((m) => (
              <Badge key={m} tone="primary">
                {m.replaceAll("_", " ")}
              </Badge>
            ))}
          </div>
        </Card>

        <Card className="p-[var(--aivo-density-card-pad)]">
          <p className="text-xs font-medium uppercase tracking-wide text-aivo-ink-soft">
            {t("support_defaults")}
          </p>
          <ul className="mt-2 space-y-1 text-sm">
            <li>Extended time: {s.supportDefaults.extendedTime ? "Yes" : "No"}</li>
            <li>Read-aloud: {s.supportDefaults.readAloud ? "Yes" : "No"}</li>
            <li>Speech-to-text: {s.supportDefaults.speechToText ? "Yes" : "No"}</li>
            <li>Visual schedules: {s.supportDefaults.visualSchedules ? "Yes" : "No"}</li>
            <li>Sensory breaks: {s.supportDefaults.sensoryBreaks ? "Yes" : "No"}</li>
          </ul>
        </Card>

        <Card className="p-[var(--aivo-density-card-pad)]">
          <p className="text-xs font-medium uppercase tracking-wide text-aivo-ink-soft">
            {t("motivation")}
          </p>
          <p className="mt-2 text-xs text-aivo-ink-soft">{t("rewards_that_help")}</p>
          <ul className="mt-1 list-disc pl-5 text-sm">
            {s.motivationProfile.rewardsThatHelp.length === 0 ? (
              <li className="list-none text-aivo-ink-soft">none recorded</li>
            ) : (
              s.motivationProfile.rewardsThatHelp.map((r) => <li key={r}>{r}</li>)
            )}
          </ul>
          {s.motivationProfile.avoidanceFactors.length > 0 ? (
            <>
              <p className="mt-3 text-xs text-aivo-ink-soft">{t("avoidance_factors")}</p>
              <ul className="mt-1 list-disc pl-5 text-sm">
                {s.motivationProfile.avoidanceFactors.map((r) => (
                  <li key={r}>{r}</li>
                ))}
              </ul>
            </>
          ) : null}
        </Card>
      </div>

      <SectionHeader title={t("subjects_at_a_glance")} className="mt-6" />
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {s.masteryOverview.map((row) => (
          <Card key={row.subjectId} className="p-4">
            <p className="text-sm font-semibold">{row.subjectName}</p>
            <Badge tone="neutral" className="mt-1 capitalize">
              {row.estimate}
            </Badge>
          </Card>
        ))}
      </div>

      <div className="mt-8 flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs text-aivo-ink-soft">
          Last generated {new Date(profile.generatedAt).toLocaleString()}
          {" · "}
          schema v{s.schemaVersion}
        </p>
        <Button asChild>
          <Link href={`/parent/learners/${learner.id}`}>
            {t("back_to_learner")} <ArrowRight className="ml-1 h-4 w-4" />
          </Link>
        </Button>
      </div>
    </AppShell>
  );
}
