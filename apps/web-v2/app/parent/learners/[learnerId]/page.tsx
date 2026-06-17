import Link from "next/link";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import {
  ArrowRight,
  Settings,
  Trophy,
  Sparkles,
  Users as UsersIcon,
  BookOpen,
  CalendarDays,
} from "lucide-react";
import { requirePageRole } from "@/lib/auth/server";
import { AppShell } from "@/components/layout/app-shell";
import { PageHeader, SectionHeader } from "@/components/layout/page-header";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { LearnerAvatar } from "@/components/learner/learner-avatar";
import { LearnerEntryButtons } from "@/components/parent/learner-entry-buttons";
import { PARENT_NAV } from "@/components/layout/role-shells";
import {
  getLearner,
  getOrCreateParentAssessment,
  parentCanAccessLearner,
  refreshLearnerReadiness,
} from "@/lib/db/repos";
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

  // Resume affordance for a part-finished parent assessment (Sprint C-11): the
  // same derivation the intro card uses, so the counts agree on both surfaces.
  const assessment = await getOrCreateParentAssessment(learnerId, session.tenantId);
  const assessmentProgress = deriveAssessmentProgress(
    assessment.answers as Partial<Record<AssessmentSectionId, Record<string, unknown>>>,
  );
  const showResume = !assessment.submittedAt;

  const next = nextStepFor(learner);
  const tone = READINESS_TONE[learner.readinessState];
  const age = new Date().getFullYear() - learner.birthYear;

  return (
    <AppShell
      role="parent"
      roleLabel="Parent"
      navItems={PARENT_NAV}
      user={{ displayName: session.displayName, email: session.email }}
    >
      <PageHeader
        eyebrow="Learner"
        title={learner.displayName}
        description={`Age ${age}${learner.gradeBand ? ` · Grade ${learner.gradeBand}` : ""}${
          learner.pronouns ? ` · ${learner.pronouns}` : ""
        }`}
        actions={
          <Button asChild variant="outline">
            <Link href={`/parent/learners/${learner.id}/settings`}>
              <Settings className="mr-1 h-4 w-4" /> {t("settings")}
            </Link>
          </Button>
        }
      />

      <Card className="flex flex-col gap-4 p-6 sm:flex-row sm:items-center">
        <LearnerAvatar name={learner.displayName} size="lg" />
        <div className="flex-1">
          <p className="text-xs text-iw-ink-muted">{t("next_step")}</p>
          <p className="font-display text-lg font-semibold">{tReadiness(next.labelKey)}</p>
          <div className="mt-2 flex flex-wrap gap-2">
            <Badge tone={tone}>{tReadiness(READINESS_LABEL_KEY[learner.readinessState])}</Badge>
            {learner.schoolContext ? (
              <Badge tone="neutral">{learner.schoolContext.replace("_", " ")}</Badge>
            ) : null}
            {learner.primaryLanguage ? (
              <Badge tone="neutral">{learner.primaryLanguage}</Badge>
            ) : null}
          </div>
        </div>
        {learner.readinessState === "ready_for_today_mission" ? (
          // A set-up learner: the parent explicitly chooses who is driving —
          // "Open in parent view" (keeps the parent session) or "Enter as
          // learner" (a true PIN-gated session swap). Both Server-Action paths
          // enforce parent↔learner authorization regardless of readiness.
          <LearnerEntryButtons learnerId={learner.id} />
        ) : (
          <Button asChild>
            <Link href={next.href}>
              {tReadiness(next.labelKey)} <ArrowRight className="ml-1 h-4 w-4" />
            </Link>
          </Button>
        )}
      </Card>

      {showResume ? (
        <AssessmentResumeCard
          learnerId={learner.id}
          progress={assessmentProgress}
          variant="panel"
        />
      ) : null}

      <SectionHeader title={t("whats_working")} />
      <Card className="p-[var(--aivo-density-card-pad)]">
        <WhatsWorkingPanel learnerId={learner.id} learnerName={learner.displayName} />
      </Card>

      <SectionHeader title={t("recommendations")} />
      <Card className="p-[var(--aivo-density-card-pad)]">
        <PendingRecommendationsPanel learnerId={learner.id} />
      </Card>

      <CalmSummaryCard
        learnerId={learner.id}
        tenantId={session.tenantId}
        learnerName={learner.displayName}
      />

      <TutorMemoryCard learnerId={learner.id} />

      <SectionHeader title={t("explore")} />
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {[
          {
            href: `/parent/learners/${learner.id}/milestones`,
            label: "Milestones",
            desc: "XP, streaks, and badges.",
            Icon: Trophy,
          },
          {
            href: `/parent/learners/${learner.id}/gradebook`,
            label: "Gradebook",
            desc: "Skill-by-skill mastery and sessions.",
            Icon: BookOpen,
          },
          {
            href: `/parent/learners/${learner.id}/sensory`,
            label: "Sensory profile",
            desc: "Sensory responses across modalities.",
            Icon: Sparkles,
          },
          {
            href: `/parent/learners/${learner.id}/team`,
            label: "Care team",
            desc: "Parents, teachers, therapists, caregivers.",
            Icon: UsersIcon,
          },
          {
            href: `/parent/learners/${learner.id}/curriculum`,
            label: "This week at school",
            desc: "Add the week's lessons so AIVO teaches in sync with class.",
            Icon: CalendarDays,
          },
        ].map((q) => (
          <Link key={q.href} href={q.href}>
            <Card className="h-full p-4 transition hover:border-iw-warm">
              <q.Icon className="h-5 w-5 text-iw-warm" />
              <p className="mt-2 font-medium">{q.label}</p>
              <p className="mt-0.5 text-xs text-iw-ink-muted">{q.desc}</p>
            </Card>
          </Link>
        ))}
      </div>

      <SectionHeader title={t("profile_basics")} />
      <div className="grid gap-4 sm:grid-cols-2">
        <Card className="p-[var(--aivo-density-card-pad)]">
          <p className="text-xs font-medium uppercase tracking-wide text-iw-ink-muted">
            {t("comfort_levels")}
          </p>
          <dl className="mt-2 grid grid-cols-2 gap-y-2 text-sm">
            <dt className="text-iw-ink-muted">{t("reading")}</dt>
            <dd>{learner.readingComfort ?? "—"}</dd>
            <dt className="text-iw-ink-muted">Math</dt>
            <dd>{learner.mathComfort ?? "—"}</dd>
          </dl>
        </Card>
        <Card className="p-[var(--aivo-density-card-pad)]">
          <p className="text-xs font-medium uppercase tracking-wide text-iw-ink-muted">
            {t("strengths")}
          </p>
          {learner.knownStrengths.length === 0 ? (
            <p className="mt-2 text-sm text-iw-ink-muted">{t("none_recorded")}</p>
          ) : (
            <ul className="mt-2 list-disc pl-5 text-sm">
              {learner.knownStrengths.map((s) => (
                <li key={s}>{s}</li>
              ))}
            </ul>
          )}
        </Card>
        <Card className="p-[var(--aivo-density-card-pad)]">
          <p className="text-xs font-medium uppercase tracking-wide text-iw-ink-muted">
            {t("challenges")}
          </p>
          {learner.knownChallenges.length === 0 ? (
            <p className="mt-2 text-sm text-iw-ink-muted">{t("none_recorded")}</p>
          ) : (
            <ul className="mt-2 list-disc pl-5 text-sm">
              {learner.knownChallenges.map((s) => (
                <li key={s}>{s}</li>
              ))}
            </ul>
          )}
        </Card>
        <Card className="p-[var(--aivo-density-card-pad)]">
          <p className="text-xs font-medium uppercase tracking-wide text-iw-ink-muted">
            {t("accessibility_defaults")}
          </p>
          <ul className="mt-2 space-y-1 text-sm">
            <li>Reduced motion: {learner.accessibilityDefaults.reducedMotion ? "On" : "Off"}</li>
            <li>High contrast: {learner.accessibilityDefaults.highContrast ? "On" : "Off"}</li>
            <li>Large text: {learner.accessibilityDefaults.largeText ? "On" : "Off"}</li>
            <li>Audio-first: {learner.accessibilityDefaults.audioFirst ? "On" : "Off"}</li>
            <li>
              Captions always on: {learner.accessibilityDefaults.captionsAlwaysOn ? "On" : "Off"}
            </li>
          </ul>
        </Card>
      </div>
    </AppShell>
  );
}
