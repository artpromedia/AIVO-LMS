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
import { SectionCard } from "./_components/SectionCard";

/**
 * /parent/home-v2 — REDESIGNED parent home.
 *
 * Non-destructive: the legacy /parent/home page is left in place;
 * this lives at a separate route. When the redesign passes QA the
 * team can flip the navigation to point here.
 *
 * Sprint-4 verbatim acceptance criteria enforced here:
 *
 *   "Parent home feels premium and calm. All cards have real
 *    destinations. Parent can add learner, upload IEP, review
 *    assessment status, and approve permissions."
 *
 *   Greeting: "Hi, [name]. [Child] is ready for today's learning."
 *
 * Now rendered inside the shared AppShell so this surface gets the
 * same top-bar + sidebar chrome (hamburger drawer on mobile, sensory
 * popover, Avatar) as every other parent screen. Previously the page
 * shipped its own bare `<main>` and bypassed AppShell entirely.
 */
export default async function ParentHomeV2() {
  const session = await requirePageRole(["parent"]);
  const t = await getTranslations("parent.home_v2");

  // Placeholder content data — wiring to listLearnersForParent is a
  // separate task and is intentionally out of scope here.
  const learnerFirstName = "Emma";
  const learnerHref = "/parent/learners/emma";
  const parentFirstName = session.displayName.split(" ")[0] ?? "there";

  const setupSteps: SetupStep[] = [
    { id: "verify", label: "Verify parent", status: "done", href: "/onboarding/parent-verify" },
    { id: "consent", label: "Review consent", status: "done", href: "/onboarding/consent" },
    { id: "iep", label: "Upload IEP / 504 (optional)", status: "active", href: "/parent/learners/new/iep" },
    { id: "approve", label: "Approve learner access", status: "upcoming", href: "/onboarding/child-approval" },
  ];

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
            <>
              Hi, {parentFirstName}.
              <br />
              <span className="text-iw-text-muted font-bold">
                {learnerFirstName} is ready for today's learning.
              </span>
            </>
          }
          subhead="Calm, personalized, and waiting for one quick check-in from you."
          actions={
            <>
              <Link
                href={`${learnerHref}/lessons`}
                className="inline-flex items-center gap-2 h-11 px-5 rounded-iw-control bg-[var(--aivo-sensory-primary)] text-white font-semibold shadow-sm hover:opacity-95"
              >
                <AivoIcon name="care" size={18} />
                Start with {learnerFirstName}
              </Link>
              <Link
                href="/parent/learners/new"
                className="inline-flex items-center gap-2 h-11 px-5 rounded-iw-control bg-white text-iw-text-strong font-semibold border border-iw-border hover:border-iw-text-muted"
              >
                <AivoIcon name="rosterStudents" size={18} />
                {t("add_another_learner")}
              </Link>
            </>
          }
        />

        <SetupProgressTrack steps={setupSteps} />

        <section aria-label={t("today_at_a_glance")}>
          <h2 className="iw-label uppercase tracking-wider text-iw-text-muted mb-3">
            {t("today_at_a_glance")}
          </h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <FloatingMetricCard
              label="Baseline status"
              value="In progress"
              description="Discovery adventure 60% complete."
              icon={<AivoIcon name="aiBrain" size={20} />}
              href={`${learnerHref}/assessment`}
              tone="info"
            />
            <FloatingMetricCard
              label="Stress / support signal"
              value="Calm"
              delta={{ value: "no flags this week", tone: "flat" }}
              description="Tutor pacing and break frequency look healthy."
              icon={<AivoIcon name="safetyOk" size={20} />}
              href={`${learnerHref}/summary`}
              tone="success"
            />
            <FloatingMetricCard
              label="Mastery trend"
              value="+4"
              delta={{ value: "skills this week", tone: "up" }}
              description="Reading and number sense both moving up."
              icon={<AivoIcon name="growth" size={20} />}
              href={`${learnerHref}/progress`}
              tone="success"
            />
            <FloatingMetricCard
              label="Today's learning time"
              value="22 min"
              description="Planned: 35 minutes. Emma can start whenever."
              icon={<AivoIcon name="goal" size={20} />}
              href={`${learnerHref}/lessons`}
            />
            <FloatingMetricCard
              label="Needs your approval"
              value="1 thing"
              description="Approve voice mode for the AI tutor."
              icon={<AivoIcon name="consentCheck" size={20} />}
              href="/onboarding/child-approval"
              tone="warning"
            />
            <FloatingMetricCard
              label="IEP support status"
              value="Active"
              description="3 accommodations applied. Update from learner profile."
              icon={<AivoIcon name="iep" size={20} />}
              href={`${learnerHref}/iep`}
              tone="info"
            />
          </div>
        </section>

        <section aria-label={t("details")} className="grid gap-4 lg:grid-cols-2">
          <SectionCard
            title={t("learning_readiness")}
            iconName="aiBrain"
            subtitle="How prepared today's plan is for Emma right now."
            badge="Ready"
            badgeTone="success"
            cta={{ href: `${learnerHref}/lessons`, label: "Open today's plan" }}
          >
            <ul className="space-y-2">
              <li className="flex justify-between gap-3">
                <span className="text-iw-text-muted">{t("plan_generated")}</span>
                <span>This morning, 6:42 AM</span>
              </li>
              <li className="flex justify-between gap-3">
                <span className="text-iw-text-muted">{t("pacing")}</span>
                <span>{t("calm_extended_time_on")}</span>
              </li>
              <li className="flex justify-between gap-3">
                <span className="text-iw-text-muted">{t("sensory_mode")}</span>
                <span>{t("warm_reduced_motion")}</span>
              </li>
            </ul>
          </SectionCard>

          <SectionCard
            title={t("assessment_status")}
            iconName="aiSparkle"
            subtitle="Where Emma is in the discovery adventure baseline."
            badge="60% done"
            badgeTone="info"
            cta={{ href: `${learnerHref}/assessment`, label: "Resume assessment" }}
          >
            <p className="text-iw-text-muted">
              No score is shown to Emma. You'll see the brain-profile
              summary as soon as she finishes the last 4 activities.
            </p>
          </SectionCard>

          <SectionCard
            title={t("iep_support_upload")}
            iconName="iep"
            subtitle="Extracted accommodations and goals."
            badge="3 accommodations"
            badgeTone="info"
            cta={{ href: `${learnerHref}/iep`, label: "Review IEP details" }}
          >
            <ul className="space-y-2">
              <li>• Extended time on timed activities</li>
              <li>• Audio supports for reading passages</li>
              <li>• Movement breaks every 15 minutes</li>
            </ul>
          </SectionCard>

          <SectionCard
            title={t("consent_checklist")}
            iconName="consentCheck"
            subtitle="What you've approved and what's still optional."
            badge="2 of 3"
            badgeTone="neutral"
            cta={{ href: "/onboarding/consent", label: "Review consent" }}
          >
            <ul className="space-y-2">
              <li className="flex justify-between gap-3">
                <span>{t("parent_guardian_consent")}</span>
                <span className="text-[var(--aivo-domain-completion-complete-strong)] font-semibold">{t("approved")}</span>
              </li>
              <li className="flex justify-between gap-3">
                <span>{t("ai_personalization")}</span>
                <span className="text-[var(--aivo-domain-completion-complete-strong)] font-semibold">{t("approved")}</span>
              </li>
              <li className="flex justify-between gap-3">
                <span>{t("school_data_sharing")}</span>
                <span className="text-iw-text-muted">{t("optional_not_set")}</span>
              </li>
            </ul>
          </SectionCard>

          <SectionCard
            title={t("todays_recommended_actions")}
            iconName="goal"
            subtitle="Just two small things. Both take under a minute."
            badge="2 items"
            badgeTone="warning"
            cta={{ href: "/onboarding/child-approval", label: "Open approvals" }}
          >
            <ul className="space-y-3">
              <li>
                <span className="font-semibold text-iw-text-strong">
                  {t("approve_voice_mode")}
                </span>
                <p className="text-iw-text-muted text-sm">
                  {t("approve_voice_mode_desc")}
                </p>
              </li>
              <li>
                <span className="font-semibold text-iw-text-strong">
                  {t("upload_iep_optional")}
                </span>
                <p className="text-iw-text-muted text-sm">
                  {t("upload_iep_desc")}
                </p>
              </li>
            </ul>
          </SectionCard>

          <SectionCard
            title={t("notifications_title")}
            iconName="aiWand"
            subtitle="Quiet, recent, parent-relevant only."
            badge="1 new"
            badgeTone="info"
            cta={{ href: "/parent/notifications", label: "Open notifications" }}
          >
            <ul className="space-y-2">
              <li>
                <span className="text-iw-text-strong font-semibold">{t("new_milestone")}</span>{" "}
                <span className="text-iw-text-muted">
                  {t("new_milestone_desc")}
                </span>
              </li>
              <li>
                <span className="text-iw-text-strong font-semibold">{t("tutor_note")}</span>{" "}
                <span className="text-iw-text-muted">
                  {t("tutor_note_desc")}
                </span>
              </li>
            </ul>
          </SectionCard>

          <SectionCard
            title={t("billing_title")}
            iconName="billingCard"
            subtitle="Plan + next renewal."
            badge="Family · monthly"
            badgeTone="neutral"
            cta={{ href: "/parent/billing", label: "Manage billing" }}
          >
            <ul className="space-y-2">
              <li className="flex justify-between gap-3">
                <span className="text-iw-text-muted">Plan</span>
                <span>{t("family_2_learners")}</span>
              </li>
              <li className="flex justify-between gap-3">
                <span className="text-iw-text-muted">{t("next_renewal")}</span>
                <span>Apr 14</span>
              </li>
              <li className="flex justify-between gap-3">
                <span className="text-iw-text-muted">{t("payment_method")}</span>
                <span>Visa · 4242</span>
              </li>
            </ul>
          </SectionCard>

          <SectionCard
            title={t("school_connection")}
            iconName="rosterSchool"
            subtitle="Sync with the classroom, if Emma's school uses AIVO."
            badge="Not linked"
            badgeTone="neutral"
            cta={{ href: "/onboarding/invite/school", label: "Connect a school" }}
          >
            <p className="text-iw-text-muted">
              Linking a school lets teachers see the same learning
              profile you do — and lets the AI tutor coordinate with
              classroom work. You stay in control of what's shared.
            </p>
          </SectionCard>
        </section>

        <p className="text-xs text-iw-text-muted text-center pt-2">
          This is the redesigned parent home. The legacy view is still available at{" "}
          <Link href="/parent/home" className="underline hover:text-iw-text-strong">
            /parent/home
          </Link>
          .
        </p>
      </div>
    </AppShell>
  );
}
