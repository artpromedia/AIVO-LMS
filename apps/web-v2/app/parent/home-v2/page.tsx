import Link from "next/link";
import {
  LearningHero,
  FloatingMetricCard,
  SetupProgressTrack,
  type SetupStep,
} from "@aivo/ui/hero";
import { AivoIcon } from "@aivo/ui/icon";
import { getTranslations } from "next-intl/server";
import { requirePageRole } from "@/lib/auth/server";
import { AppShell } from "@/components/layout/app-shell";
import { PARENT_NAV } from "@/components/layout/role-shells";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import {
  listLearnersForParent,
  refreshLearnerReadiness,
  listConsentsForLearner,
} from "@/lib/db/repos";
import {
  READINESS_LABEL_KEY,
  READINESS_NEXT_STEP,
  READINESS_TONE,
  nextStepFor,
} from "@/lib/learner/readiness";
import type { ConsentRecord, ConsentType, LearnerProfile, ReadinessState } from "@/lib/db/types";
import { SectionCard } from "./_components/SectionCard";

/**
 * /parent/home-v2 — REDESIGNED parent home.
 *
 * Non-destructive: the legacy /parent/home page is left in place;
 * this lives at a separate route. When the redesign passes QA the
 * team can flip the navigation to point here.
 *
 * Every value on this page is read from the same repos the legacy
 * home uses — the hero learner, the setup track, the glance metrics
 * and the secondary cards all derive from `listLearnersForParent`,
 * the readiness engine and the consent ledger. Nothing is invented:
 * a card with no real backing read does not render.
 */

const READY_STATES = new Set<ReadinessState>(["ready_for_today_mission", "active_learning"]);

/** Journey order used to derive setup-track status from the readiness cache. */
const READINESS_ORDER: ReadinessState[] = [
  "profile_created",
  "assessment_needed",
  "team_invite_optional",
  "iep_optional",
  "baseline_needed",
  "brain_build_pending",
  "brain_clone_review_needed",
  "ready_for_today_mission",
  "active_learning",
];
const rank = (s: ReadinessState) => READINESS_ORDER.indexOf(s);

function stepStatus(
  state: ReadinessState,
  activeStates: ReadinessState[],
  lastCoveredState: ReadinessState,
): SetupStep["status"] {
  if (activeStates.includes(state)) return "active";
  return rank(state) > rank(lastCoveredState) ? "done" : "upcoming";
}

function buildSetupSteps(
  learner: Pick<LearnerProfile, "id" | "readinessState">,
  t: Awaited<ReturnType<typeof getTranslations<"parent.home_v2">>>,
): SetupStep[] {
  const s = learner.readinessState;
  const href = (state: ReadinessState) =>
    READINESS_NEXT_STEP[state].hrefTemplate.replace("{learnerId}", learner.id);
  return [
    {
      id: "assessment",
      label: t("step_assessment"),
      status: stepStatus(s, ["profile_created", "assessment_needed"], "assessment_needed"),
      href: href("assessment_needed"),
    },
    {
      id: "supports",
      label: t("step_supports"),
      status: stepStatus(s, ["team_invite_optional", "iep_optional"], "iep_optional"),
      href: href("iep_optional"),
    },
    {
      id: "baseline",
      label: t("step_baseline"),
      status: stepStatus(s, ["baseline_needed"], "baseline_needed"),
      href: href("baseline_needed"),
    },
    {
      id: "review",
      label: t("step_review"),
      status: stepStatus(
        s,
        ["brain_build_pending", "brain_clone_review_needed"],
        "brain_clone_review_needed",
      ),
      href: href("brain_clone_review_needed"),
    },
  ];
}

/** Latest non-revoked consent record per type. */
function activeConsentTypes(records: ConsentRecord[]): Set<ConsentType> {
  const latest = new Map<ConsentType, ConsentRecord>();
  for (const r of records) {
    const prev = latest.get(r.consentType);
    if (!prev || r.acceptedAt > prev.acceptedAt) latest.set(r.consentType, r);
  }
  const active = new Set<ConsentType>();
  for (const [type, rec] of latest) if (!rec.revokedAt) active.add(type);
  return active;
}

const METRIC_TONE: Record<
  (typeof READINESS_TONE)[ReadinessState],
  "neutral" | "success" | "warning" | "info"
> = { neutral: "neutral", warning: "warning", primary: "info", success: "success" };

/** Consent types surfaced on the card — the three a parent asks about first. */
const CONSENT_CARD_TYPES = [
  "child_data_collection",
  "ai_personalization",
  "school_roster_import",
] as const satisfies readonly ConsentType[];

export default async function ParentHomeV2() {
  const session = await requirePageRole(["parent"]);
  const t = await getTranslations("parent.home_v2");
  const tHome = await getTranslations("parent.home");
  const tReadiness = await getTranslations("parent.readiness");

  const initial = await listLearnersForParent(session.userId, session.tenantId);
  for (const l of initial) await refreshLearnerReadiness(l.id, session.tenantId);
  const learners = await listLearnersForParent(session.userId, session.tenantId);

  const parentFirstName = session.displayName.split(" ")[0] ?? "";

  if (learners.length === 0) {
    return (
      <AppShell
        role="parent"
        roleLabel="Parent"
        navItems={PARENT_NAV}
        user={{ displayName: session.displayName, email: session.email }}
      >
        <div className="flex flex-col gap-6" data-testid="home-v2-empty">
          <LearningHero
            greeting={
              <>
                Hi, {parentFirstName}.
                <br />
                <span className="text-iw-text-muted font-bold">{t("hero_add_first")}</span>
              </>
            }
            subhead={t("subhead")}
            actions={
              <Button asChild size="lg" data-testid="home-v2-primary-cta">
                <Link href="/parent/learners/new">{tHome("add_your_first_learner")}</Link>
              </Button>
            }
          />
          <EmptyState
            title={tHome("no_learners_yet")}
            description={t("empty_description")}
            action={
              <Button asChild>
                <Link href="/parent/learners/new">{tHome("add_your_first_learner")}</Link>
              </Button>
            }
          />
        </div>
      </AppShell>
    );
  }

  // Feature the learner with the most actionable next step; fall back to the
  // first learner when everyone is ready.
  const featured = learners.find((l) => !READY_STATES.has(l.readinessState)) ?? learners[0];
  const featuredFirst = featured.displayName.split(" ")[0];
  const featuredNext = nextStepFor(featured);
  const featuredReady = READY_STATES.has(featured.readinessState);

  const readyCount = learners.filter((l) => READY_STATES.has(l.readinessState)).length;
  const needsActionCount = learners.length - readyCount;

  const setupSteps = buildSetupSteps(featured, t);
  const consentRecords = await listConsentsForLearner(
    session.userId,
    featured.id,
    session.tenantId,
  );
  const grantedTypes = activeConsentTypes(consentRecords);

  return (
    <AppShell
      role="parent"
      roleLabel="Parent"
      navItems={PARENT_NAV}
      user={{ displayName: session.displayName, email: session.email }}
    >
      <div className="flex flex-col gap-6">
        <LearningHero
          greeting={
            <span data-testid="home-v2-greeting">
              Hi, {parentFirstName}.
              <br />
              <span className="text-iw-text-muted font-bold">
                {featuredReady
                  ? t("hero_ready", { name: featuredFirst })
                  : t("hero_next", { name: featuredFirst })}
              </span>
            </span>
          }
          subhead={t("subhead")}
          actions={
            <>
              <Button asChild size="lg" data-testid="home-v2-primary-cta">
                <Link href={featuredNext.href}>
                  <AivoIcon name="care" size={18} />
                  {tReadiness(featuredNext.labelKey)}
                </Link>
              </Button>
              <Button asChild variant="outline" size="lg">
                <Link href="/parent/learners/new">
                  <AivoIcon name="rosterStudents" size={18} />
                  {t("add_another_learner")}
                </Link>
              </Button>
            </>
          }
        />

        <section aria-label={t("setup_for", { name: featuredFirst })}>
          <h2 className="iw-label uppercase tracking-wider text-iw-text-muted mb-3">
            {t("setup_for", { name: featuredFirst })}
          </h2>
          <SetupProgressTrack steps={setupSteps} />
        </section>

        <section aria-label={t("today_at_a_glance")}>
          <h2 className="iw-label uppercase tracking-wider text-iw-text-muted mb-3">
            {t("today_at_a_glance")}
          </h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <FloatingMetricCard
              label={t("metric_learners")}
              value={learners.length}
              description={
                learners.length === 1
                  ? t("metric_learners_desc_one")
                  : t("metric_learners_desc_other", { count: learners.length })
              }
              icon={<AivoIcon name="rosterStudents" size={20} />}
              href="/parent/learners"
              tone="info"
            />
            <FloatingMetricCard
              label={t("metric_ready")}
              value={readyCount}
              description={
                readyCount === learners.length
                  ? t("metric_ready_desc_all")
                  : t("metric_ready_desc_partial")
              }
              icon={<AivoIcon name="aiSparkle" size={20} />}
              tone={readyCount === learners.length ? "success" : "neutral"}
            />
            <FloatingMetricCard
              label={t("metric_action")}
              value={needsActionCount}
              description={
                needsActionCount === 0
                  ? t("metric_action_desc_zero")
                  : t("metric_action_desc_some")
              }
              icon={<AivoIcon name="consentCheck" size={20} />}
              tone={needsActionCount === 0 ? "success" : "warning"}
            />
            <FloatingMetricCard
              label={t("metric_status", { name: featuredFirst })}
              value={tReadiness(READINESS_LABEL_KEY[featured.readinessState])}
              description={tReadiness(featuredNext.labelKey)}
              icon={<AivoIcon name="aiBrain" size={20} />}
              href={featuredNext.href}
              tone={METRIC_TONE[READINESS_TONE[featured.readinessState]]}
            />
          </div>
        </section>

        <section aria-label={t("details")} className="grid gap-4 lg:grid-cols-2">
          <SectionCard
            title={t("next_steps_title")}
            iconName="goal"
            subtitle={t("next_steps_subtitle")}
            badge={needsActionCount > 0 ? String(needsActionCount) : undefined}
            badgeTone={needsActionCount > 0 ? "warning" : "success"}
            cta={{ href: "/parent/learners", label: t("view_all_learners") }}
          >
            <ul className="space-y-3">
              {learners.map((l) => {
                const next = nextStepFor(l);
                return (
                  <li key={l.id} className="flex items-center justify-between gap-3">
                    <span className="font-semibold text-iw-text-strong">
                      {l.displayName.split(" ")[0]}
                    </span>
                    <Link
                      href={next.href}
                      className="text-sm font-semibold text-[var(--aivo-sensory-primary)] hover:underline"
                    >
                      {tReadiness(next.labelKey)}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </SectionCard>

          <SectionCard
            title={t("consent_checklist")}
            iconName="consentCheck"
            subtitle={t("consent_subtitle", { name: featuredFirst })}
            badge={t("consent_of_total", {
              granted: CONSENT_CARD_TYPES.filter((c) => grantedTypes.has(c)).length,
              total: CONSENT_CARD_TYPES.length,
            })}
            badgeTone="info"
            cta={{ href: `/parent/consent/${featured.id}`, label: t("review_consent") }}
          >
            <ul className="space-y-2">
              {CONSENT_CARD_TYPES.map((type) => (
                <li key={type} className="flex justify-between gap-3">
                  <span>{t(`consent_type.${type}`)}</span>
                  {grantedTypes.has(type) ? (
                    <span className="text-[var(--aivo-domain-completion-complete-strong)] font-semibold">
                      {t("approved")}
                    </span>
                  ) : (
                    <span className="text-iw-text-muted">{t("optional_not_set")}</span>
                  )}
                </li>
              ))}
            </ul>
          </SectionCard>

          <SectionCard
            title={t("school_connection")}
            iconName="rosterSchool"
            subtitle={t("school_subtitle")}
            cta={{ href: "/onboarding/invite/school", label: t("connect_a_school") }}
          >
            <p className="text-iw-text-muted">{t("school_body")}</p>
          </SectionCard>
        </section>

        <p className="text-xs text-iw-text-muted text-center pt-2">
          {t("legacy_note")}{" "}
          <Link href="/parent/home" className="underline hover:text-iw-text-strong">
            /parent/home
          </Link>
          .
        </p>
      </div>
    </AppShell>
  );
}
