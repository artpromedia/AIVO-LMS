import Link from "next/link";
import { notFound, redirect } from "next/navigation";
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
  const { readMockSessionFromCookies } = await import("@/lib/auth/mock-session");
  const session = await readMockSessionFromCookies();
  if (!session || session.role !== "parent") redirect("/login");
  const learnerId = String(formData.get("learnerId") || "");
  if (!await parentCanAccessLearner(session.userId, learnerId, session.tenantId)) {
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
  redirect(`/parent/learners/${learnerId}/brain-profile`);
}

export default async function BrainProfilePage({
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
          title="Finish the parent assessment first"
          description="The brain profile is built from your assessment plus any IEP you share. Submit the assessment and we'll generate it automatically."
        />
        <EmptyState
          title="Assessment not yet submitted"
          action={
            <Button asChild>
              <Link href={`/parent/learners/${learner.id}/assessment`}>
                Continue assessment <ArrowRight className="ml-1 h-4 w-4" />
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
          title="We couldn't generate the profile"
          description="Something went wrong. Try again — we keep a deterministic fallback so this should always work."
        />
        <form action={regenerateAction}>
          <input type="hidden" name="learnerId" value={learner.id} />
          <Button type="submit">
            <RefreshCw className="mr-1 h-4 w-4" /> Try again
          </Button>
        </form>
      </AppShell>
    );
  }

  const s = profile.state;

  return (
    <AppShell
      role="parent"
      roleLabel="Parent"
      navItems={PARENT_NAV}
      user={{ displayName: session.displayName, email: session.email }}
    >
      <PageHeader
        eyebrow={`Brain profile for ${learner.displayName}`}
        title="How AIVO will work with your learner"
        description="Generated from your assessment and any IEP you shared. You can re-generate at any time after updating your inputs."
        actions={
          <form action={regenerateAction}>
            <input type="hidden" name="learnerId" value={learner.id} />
            <Button type="submit" variant="outline">
              <RefreshCw className="mr-1 h-4 w-4" /> Regenerate
            </Button>
          </form>
        }
      />

      <Card className="mb-4 flex items-start gap-3 p-4">
        <Sparkles className="h-5 w-5 shrink-0 text-aivo-primary" />
        <div className="text-sm">
          <p className="font-medium">Recommended tutor persona</p>
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

      <SectionHeader title="Parent assessment summary" />
      <Card className="p-[var(--aivo-density-card-pad)] text-sm">{s.parentAssessmentSummary}</Card>

      <SectionHeader title="Accommodation summary" className="mt-6" />
      <Card className="p-[var(--aivo-density-card-pad)] text-sm">{s.accommodationSummary}</Card>

      <SectionHeader title="Learning profile" className="mt-6" />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Card className="p-[var(--aivo-density-card-pad)]">
          <p className="text-xs font-medium uppercase tracking-wide text-aivo-ink-soft">
            Sensory profile
          </p>
          <dl className="mt-2 space-y-1 text-sm">
            <div className="flex justify-between gap-2">
              <dt className="text-aivo-ink-soft">Pattern</dt>
              <dd className="capitalize">{s.sensoryProfile.seekingOrAvoiding}</dd>
            </div>
            <div>
              <dt className="text-aivo-ink-soft">Sensitivities</dt>
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
            Attention
          </p>
          <dl className="mt-2 space-y-1 text-sm">
            <div className="flex justify-between gap-2">
              <dt className="text-aivo-ink-soft">Focus window</dt>
              <dd>{s.attentionProfile.focusWindowMinutes} min</dd>
            </div>
            <div className="flex justify-between gap-2">
              <dt className="text-aivo-ink-soft">Breaks</dt>
              <dd className="capitalize">{s.attentionProfile.breakStyle.replaceAll("_", " ")}</dd>
            </div>
            <div className="flex justify-between gap-2">
              <dt className="text-aivo-ink-soft">Movement helps</dt>
              <dd>{s.attentionProfile.movementHelps ? "Yes" : "No"}</dd>
            </div>
          </dl>
        </Card>

        <Card className="p-[var(--aivo-density-card-pad)]">
          <p className="text-xs font-medium uppercase tracking-wide text-aivo-ink-soft">Comfort</p>
          <dl className="mt-2 space-y-1 text-sm">
            <div className="flex justify-between gap-2">
              <dt className="text-aivo-ink-soft">Reading</dt>
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
            Preferred modalities
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
            Support defaults
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
            Motivation
          </p>
          <p className="mt-2 text-xs text-aivo-ink-soft">Rewards that help</p>
          <ul className="mt-1 list-disc pl-5 text-sm">
            {s.motivationProfile.rewardsThatHelp.length === 0 ? (
              <li className="list-none text-aivo-ink-soft">none recorded</li>
            ) : (
              s.motivationProfile.rewardsThatHelp.map((r) => <li key={r}>{r}</li>)
            )}
          </ul>
          {s.motivationProfile.avoidanceFactors.length > 0 ? (
            <>
              <p className="mt-3 text-xs text-aivo-ink-soft">Avoidance factors</p>
              <ul className="mt-1 list-disc pl-5 text-sm">
                {s.motivationProfile.avoidanceFactors.map((r) => (
                  <li key={r}>{r}</li>
                ))}
              </ul>
            </>
          ) : null}
        </Card>
      </div>

      <SectionHeader title="Subjects at a glance" className="mt-6" />
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
            Back to learner <ArrowRight className="ml-1 h-4 w-4" />
          </Link>
        </Button>
      </div>
    </AppShell>
  );
}
