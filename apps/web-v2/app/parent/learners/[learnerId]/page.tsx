import Link from "next/link";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { ArrowRight, Settings, Sparkles } from "lucide-react";
import { requirePageRole } from "@/lib/auth/server";
import { AppShell } from "@/components/layout/app-shell";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { LearnerAvatar } from "@/components/learner/learner-avatar";
import { LearnerEntryButtons } from "@/components/parent/learner-entry-buttons";
import { PARENT_NAV } from "@/components/layout/role-shells";
import {
  getBrainProfile,
  getLearner,
  getOrCreateParentAssessment,
  parentCanAccessLearner,
  refreshLearnerReadiness,
} from "@/lib/db/repos";
import { getCareTeam } from "@/lib/db/team-invites";
import { READINESS_LABEL_KEY, READINESS_TONE, nextStepFor } from "@/lib/learner/readiness";
import {
  deriveAssessmentProgress,
  type AssessmentSectionId,
} from "@/lib/validators/parent-assessment";
import { AssessmentResumeCard } from "./assessment/assessment-resume-card";
import { WhatsWorkingPanel } from "@/components/parent/whats-working-panel";
import { PendingRecommendationsPanel } from "@/components/parent/pending-recommendations-panel";
import { TutorMemoryCard } from "@/components/parent/tutor-memory-card";
import { CalmSummaryCard } from "./calm-summary-card";

const PERSONA_KEY: Record<string, string> = {
  warm_coach: "persona_warm_coach",
  playful_friend: "persona_playful_friend",
  calm_guide: "persona_calm_guide",
  structured_mentor: "persona_structured_mentor",
};

export default async function LearnerDetailPage({
  params,
}: {
  params: Promise<{ learnerId: string }>;
}) {
  const t = await getTranslations("parent.learner_overview");
  const tReadiness = await getTranslations("parent.readiness");
  const session = await requirePageRole(["parent"]);
  const { learnerId } = await params;
  if (!(await parentCanAccessLearner(session.userId, learnerId, session.tenantId))) {
    notFound();
  }
  await refreshLearnerReadiness(learnerId, session.tenantId);
  const learner = await getLearner(learnerId, session.tenantId);
  if (!learner) notFound();

  const assessment = await getOrCreateParentAssessment(learnerId, session.tenantId);
  const assessmentProgress = deriveAssessmentProgress(
    assessment.answers as Partial<Record<AssessmentSectionId, Record<string, unknown>>>,
  );
  const showResume = !assessment.submittedAt;

  // Overview stats — real data only. The brain profile (when cloned) carries
  // mastery + subjects + the persona; the care team comes from collaboration.
  const profile = await getBrainProfile(learnerId, session.tenantId);
  const careTeam = await getCareTeam(learnerId, session.tenantId);
  const teamCount =
    careTeam.teachers.length + careTeam.caregivers.length + careTeam.therapists.length;

  const masteryValues = profile ? Object.values(profile.state.masteryLevels) : [];
  const masteryPct =
    masteryValues.length > 0
      ? Math.round((masteryValues.reduce((a, b) => a + b, 0) / masteryValues.length) * 100)
      : null;
  const goalCount = profile?.state.iepProfile?.goals.length ?? 0;
  const subjectCount = profile?.state.masteryOverview.length ?? 0;
  const personaStyle = profile?.state.tutorPersonaRecommendation.style;
  const personaName = personaStyle ? t(PERSONA_KEY[personaStyle] ?? "persona_warm_coach") : null;
  const personaRationale = profile?.state.tutorPersonaRecommendation.rationale ?? null;

  const next = nextStepFor(learner);
  const tone = READINESS_TONE[learner.readinessState];
  const age = new Date().getFullYear() - learner.birthYear;
  const isReady = learner.readinessState === "ready_for_today_mission";

  const tabs: Array<{ href: string; label: string; active?: boolean }> = [
    { href: `/parent/learners/${learner.id}`, label: t("tab_overview"), active: true },
    { href: `/parent/learners/${learner.id}/iep`, label: t("tab_goals") },
    { href: `/parent/learners/${learner.id}/progress`, label: t("tab_progress") },
    { href: `/parent/learners/${learner.id}/gradebook`, label: t("tab_gradebook") },
    { href: `/parent/learners/${learner.id}/homework`, label: t("tab_homework") },
    { href: `/parent/learners/${learner.id}/brain-profile`, label: t("tab_brain") },
    { href: `/parent/learners/${learner.id}/team`, label: t("tab_team") },
  ];

  const stats = profile
    ? [
        {
          label: t("stat_mastery"),
          value: masteryPct !== null ? `${masteryPct}%` : "—",
          color: "var(--aivo-color-aivoTeal-600)",
        },
        {
          label: t("stat_goals"),
          value: String(goalCount),
          color: "var(--aivo-sensory-primary)",
        },
        {
          label: t("stat_subjects"),
          value: String(subjectCount),
          color: "var(--aivo-color-status-info-strong)",
        },
        { label: t("stat_team"), value: String(teamCount), color: "var(--aivo-color-aivoPurple-600)" },
      ]
    : [];

  return (
    <AppShell
      role="parent"
      roleLabel="Parent"
      navItems={PARENT_NAV}
      user={{ displayName: session.displayName, email: session.email }}
    >
      {/* ── Profile header + tab strip (LearnerProfile.dc.html) ───────── */}
      <div className="flex flex-col gap-4 rounded-iw-card-lg border border-iw-border bg-white p-5 md:p-6">
        <div className="flex flex-wrap items-center gap-4">
          <LearnerAvatar name={learner.displayName} size="lg" />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2.5">
              <h1 className="font-iw-display text-2xl font-bold text-iw-text-strong">
                {learner.displayName}
              </h1>
              <Badge tone={isReady ? "success" : tone}>
                {isReady ? t("active_learning") : tReadiness(READINESS_LABEL_KEY[learner.readinessState])}
              </Badge>
            </div>
            <p className="mt-0.5 text-sm text-iw-text-muted">
              {`Age ${age}`}
              {learner.gradeBand ? ` · Grade ${learner.gradeBand}` : ""}
              {learner.primaryLanguage ? ` · ${learner.primaryLanguage}` : ""}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {isReady ? (
              <LearnerEntryButtons learnerId={learner.id} />
            ) : (
              <Button asChild>
                <Link href={next.href}>
                  {tReadiness(next.labelKey)} <ArrowRight className="ml-1 h-4 w-4" />
                </Link>
              </Button>
            )}
            <Button asChild variant="outline">
              <Link href={`/parent/learners/${learner.id}/settings`} aria-label={t("settings")}>
                <Settings className="h-4 w-4" />
              </Link>
            </Button>
          </div>
        </div>

        <nav
          aria-label={learner.displayName}
          className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-0.5"
        >
          {tabs.map((tab) => (
            <Link
              key={tab.href}
              href={tab.href}
              aria-current={tab.active ? "page" : undefined}
              className={
                tab.active
                  ? "shrink-0 rounded-[10px] bg-[var(--aivo-sensory-primary)] px-4 py-2 text-[13.5px] font-bold text-white"
                  : "shrink-0 rounded-[10px] border border-iw-border bg-white px-4 py-2 text-[13.5px] font-bold text-iw-text-strong hover:bg-[var(--aivo-color-surface-sunken)]"
              }
            >
              {tab.label}
            </Link>
          ))}
        </nav>
      </div>

      {showResume ? (
        <AssessmentResumeCard learnerId={learner.id} progress={assessmentProgress} variant="panel" />
      ) : null}

      {/* ── Overview ─────────────────────────────────────────────────── */}
      {stats.length > 0 ? (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          {stats.map((stat) => (
            <Card key={stat.label} className="p-4">
              <p className="text-xs font-bold text-iw-text-muted">{stat.label}</p>
              <p className="font-iw-display mt-1 text-2xl font-bold" style={{ color: stat.color }}>
                {stat.value}
              </p>
            </Card>
          ))}
        </div>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
        {personaName ? (
          <Card className="flex flex-col gap-3 bg-iw-primary-soft p-5">
            <div className="flex items-center gap-2 font-iw-display text-base font-bold text-iw-text-strong">
              <Sparkles className="h-5 w-5 text-[var(--aivo-sensory-primary)]" aria-hidden="true" />
              {t("persona_heading")}: {personaName}
            </div>
            {personaRationale ? (
              <p className="text-sm leading-relaxed text-iw-text-muted">{personaRationale}</p>
            ) : null}
            <Button asChild variant="outline" className="self-start">
              <Link href={`/parent/learners/${learner.id}/brain-profile`}>
                {t("view_brain_profile")} <ArrowRight className="ml-1 h-4 w-4" />
              </Link>
            </Button>
          </Card>
        ) : null}
        <Card className="p-[var(--aivo-density-card-pad)]">
          <p className="mb-2 font-iw-display text-base font-bold text-iw-text-strong">
            {t("whats_working")}
          </p>
          <WhatsWorkingPanel learnerId={learner.id} learnerName={learner.displayName} />
        </Card>
      </div>

      <Card className="p-[var(--aivo-density-card-pad)]">
        <p className="mb-2 font-iw-display text-base font-bold text-iw-text-strong">
          {t("recommendations")}
        </p>
        <PendingRecommendationsPanel learnerId={learner.id} />
      </Card>

      <CalmSummaryCard
        learnerId={learner.id}
        tenantId={session.tenantId}
        learnerName={learner.displayName}
      />

      <TutorMemoryCard learnerId={learner.id} />

      {/* ── Profile basics (kept from the existing overview) ──────────── */}
      <div className="grid gap-4 sm:grid-cols-2">
        <Card className="p-[var(--aivo-density-card-pad)]">
          <p className="text-xs font-medium uppercase tracking-wide text-iw-text-muted">
            {t("comfort_levels")}
          </p>
          <dl className="mt-2 grid grid-cols-2 gap-y-2 text-sm">
            <dt className="text-iw-text-muted">{t("reading")}</dt>
            <dd>{learner.readingComfort ?? "—"}</dd>
            <dt className="text-iw-text-muted">Math</dt>
            <dd>{learner.mathComfort ?? "—"}</dd>
          </dl>
        </Card>
        <Card className="p-[var(--aivo-density-card-pad)]">
          <p className="text-xs font-medium uppercase tracking-wide text-iw-text-muted">
            {t("strengths")}
          </p>
          {learner.knownStrengths.length === 0 ? (
            <p className="mt-2 text-sm text-iw-text-muted">{t("none_recorded")}</p>
          ) : (
            <ul className="mt-2 list-disc pl-5 text-sm">
              {learner.knownStrengths.map((sName) => (
                <li key={sName}>{sName}</li>
              ))}
            </ul>
          )}
        </Card>
        <Card className="p-[var(--aivo-density-card-pad)]">
          <p className="text-xs font-medium uppercase tracking-wide text-iw-text-muted">
            {t("challenges")}
          </p>
          {learner.knownChallenges.length === 0 ? (
            <p className="mt-2 text-sm text-iw-text-muted">{t("none_recorded")}</p>
          ) : (
            <ul className="mt-2 list-disc pl-5 text-sm">
              {learner.knownChallenges.map((c) => (
                <li key={c}>{c}</li>
              ))}
            </ul>
          )}
        </Card>
        <Card className="p-[var(--aivo-density-card-pad)]">
          <p className="text-xs font-medium uppercase tracking-wide text-iw-text-muted">
            {t("accessibility_defaults")}
          </p>
          <ul className="mt-2 space-y-1 text-sm">
            <li>Reduced motion: {learner.accessibilityDefaults.reducedMotion ? "On" : "Off"}</li>
            <li>High contrast: {learner.accessibilityDefaults.highContrast ? "On" : "Off"}</li>
            <li>Large text: {learner.accessibilityDefaults.largeText ? "On" : "Off"}</li>
            <li>Audio-first: {learner.accessibilityDefaults.audioFirst ? "On" : "Off"}</li>
            <li>Captions always on: {learner.accessibilityDefaults.captionsAlwaysOn ? "On" : "Off"}</li>
          </ul>
        </Card>
      </div>
    </AppShell>
  );
}
