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
import { PARENT_NAV } from "@/components/layout/role-shells";
import { getLearner, parentCanAccessLearner, refreshLearnerReadiness } from "@/lib/db/repos";
import { READINESS_LABEL, READINESS_TONE, nextStepFor } from "@/lib/learner/readiness";
import { WhatsWorkingPanel } from "@/components/parent/whats-working-panel";
import { PendingRecommendationsPanel } from "@/components/parent/pending-recommendations-panel";
import { CalmSummaryCard } from "./calm-summary-card";

export default async function LearnerDetailPage({
  params,
}: {
  params: Promise<{ learnerId: string }>;
}) {
  const t = await getTranslations("parent.learner_overview");
  const session = await requirePageRole(["parent"]);
  const { learnerId } = await params;
  if (!(await parentCanAccessLearner(session.userId, learnerId, session.tenantId))) {
    notFound();
  }
  await refreshLearnerReadiness(learnerId, session.tenantId);
  const learner = await getLearner(learnerId, session.tenantId);
  if (!learner) notFound();

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
          <p className="text-xs text-aivo-ink-soft">{t("next_step")}</p>
          <p className="font-display text-lg font-semibold">{next.label}</p>
          <div className="mt-2 flex flex-wrap gap-2">
            <Badge tone={tone}>{READINESS_LABEL[learner.readinessState]}</Badge>
            {learner.schoolContext ? (
              <Badge tone="neutral">{learner.schoolContext.replace("_", " ")}</Badge>
            ) : null}
            {learner.primaryLanguage ? (
              <Badge tone="neutral">{learner.primaryLanguage}</Badge>
            ) : null}
          </div>
        </div>
        <Button asChild>
          <Link href={next.href}>
            {next.label} <ArrowRight className="ml-1 h-4 w-4" />
          </Link>
        </Button>
      </Card>

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
            <Card className="h-full p-4 transition hover:border-aivo-accent">
              <q.Icon className="h-5 w-5 text-aivo-accent" />
              <p className="mt-2 font-medium">{q.label}</p>
              <p className="mt-0.5 text-xs text-aivo-ink-soft">{q.desc}</p>
            </Card>
          </Link>
        ))}
      </div>

      <SectionHeader title={t("profile_basics")} />
      <div className="grid gap-4 sm:grid-cols-2">
        <Card className="p-[var(--aivo-density-card-pad)]">
          <p className="text-xs font-medium uppercase tracking-wide text-aivo-ink-soft">
            {t("comfort_levels")}
          </p>
          <dl className="mt-2 grid grid-cols-2 gap-y-2 text-sm">
            <dt className="text-aivo-ink-soft">{t("reading")}</dt>
            <dd>{learner.readingComfort ?? "—"}</dd>
            <dt className="text-aivo-ink-soft">Math</dt>
            <dd>{learner.mathComfort ?? "—"}</dd>
          </dl>
        </Card>
        <Card className="p-[var(--aivo-density-card-pad)]">
          <p className="text-xs font-medium uppercase tracking-wide text-aivo-ink-soft">
            {t("strengths")}
          </p>
          {learner.knownStrengths.length === 0 ? (
            <p className="mt-2 text-sm text-aivo-ink-soft">{t("none_recorded")}</p>
          ) : (
            <ul className="mt-2 list-disc pl-5 text-sm">
              {learner.knownStrengths.map((s) => (
                <li key={s}>{s}</li>
              ))}
            </ul>
          )}
        </Card>
        <Card className="p-[var(--aivo-density-card-pad)]">
          <p className="text-xs font-medium uppercase tracking-wide text-aivo-ink-soft">
            {t("challenges")}
          </p>
          {learner.knownChallenges.length === 0 ? (
            <p className="mt-2 text-sm text-aivo-ink-soft">{t("none_recorded")}</p>
          ) : (
            <ul className="mt-2 list-disc pl-5 text-sm">
              {learner.knownChallenges.map((s) => (
                <li key={s}>{s}</li>
              ))}
            </ul>
          )}
        </Card>
        <Card className="p-[var(--aivo-density-card-pad)]">
          <p className="text-xs font-medium uppercase tracking-wide text-aivo-ink-soft">
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
