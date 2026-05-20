import Link from "next/link";
import {
  LearningHero,
  FloatingMetricCard,
  SetupProgressTrack,
  type SetupStep,
} from "@aivo/ui/hero";
import { AivoIcon } from "@aivo/ui/icon";
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
 * This page is server-rendered with placeholder data; a later
 * Sprint 4 commit wires it to the real `listLearnersForParent`
 * repo.
 */
export default function ParentHomeV2() {
  // Placeholder data — Sprint 4 commit 5 wires to real session.
  const parentFirstName = "Ofem";
  const learnerFirstName = "Emma";
  const learnerHref = "/parent/learners/emma";

  const setupSteps: SetupStep[] = [
    { id: "verify", label: "Verify parent", status: "done", href: "/onboarding/parent-verify" },
    { id: "consent", label: "Review consent", status: "done", href: "/onboarding/consent" },
    { id: "iep", label: "Upload IEP / 504 (optional)", status: "active", href: "/parent/learners/new/iep" },
    { id: "approve", label: "Approve learner access", status: "upcoming", href: "/onboarding/child-approval" },
  ];

  return (
    <main className="min-h-screen bg-[var(--aivo-color-surface-canvas,#f4f6f5)]">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-6 lg:py-10 flex flex-col gap-6">
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
                className="inline-flex items-center gap-2 h-11 px-5 rounded-iw-control bg-[var(--aivo-sensory-primary,#7c3aed)] text-white font-semibold shadow-sm hover:opacity-95"
              >
                <AivoIcon name="care" size={18} />
                Start with {learnerFirstName}
              </Link>
              <Link
                href="/parent/learners/new-v2"
                className="inline-flex items-center gap-2 h-11 px-5 rounded-iw-control bg-white text-iw-text-strong font-semibold border border-iw-border hover:border-iw-text-muted"
              >
                <AivoIcon name="rosterStudents" size={18} />
                Add another learner
              </Link>
            </>
          }
        />

        <SetupProgressTrack steps={setupSteps} />

        <section aria-label="Today at a glance">
          <h2 className="iw-label uppercase tracking-wider text-iw-text-muted mb-3">
            Today at a glance
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

        <section aria-label="Details" className="grid gap-4 lg:grid-cols-2">
          <SectionCard
            title="Learning readiness"
            iconName="aiBrain"
            subtitle="How prepared today's plan is for Emma right now."
            badge="Ready"
            badgeTone="success"
            cta={{ href: `${learnerHref}/lessons`, label: "Open today's plan" }}
          >
            <ul className="space-y-2">
              <li className="flex justify-between gap-3">
                <span className="text-iw-text-muted">Plan generated</span>
                <span>This morning, 6:42 AM</span>
              </li>
              <li className="flex justify-between gap-3">
                <span className="text-iw-text-muted">Pacing</span>
                <span>Calm — extended time on</span>
              </li>
              <li className="flex justify-between gap-3">
                <span className="text-iw-text-muted">Sensory mode</span>
                <span>Warm + reduced motion</span>
              </li>
            </ul>
          </SectionCard>

          <SectionCard
            title="Assessment status"
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
            title="IEP / support upload"
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
            title="Consent checklist"
            iconName="consentCheck"
            subtitle="What you've approved and what's still optional."
            badge="2 of 3"
            badgeTone="neutral"
            cta={{ href: "/onboarding/consent", label: "Review consent" }}
          >
            <ul className="space-y-2">
              <li className="flex justify-between gap-3">
                <span>Parent / guardian consent</span>
                <span className="text-[var(--aivo-domain-completion-completed-strong,#16a34a)] font-semibold">Approved</span>
              </li>
              <li className="flex justify-between gap-3">
                <span>AI personalization</span>
                <span className="text-[var(--aivo-domain-completion-completed-strong,#16a34a)] font-semibold">Approved</span>
              </li>
              <li className="flex justify-between gap-3">
                <span>School data sharing</span>
                <span className="text-iw-text-muted">Optional — not set</span>
              </li>
            </ul>
          </SectionCard>

          <SectionCard
            title="Today's recommended actions"
            iconName="goal"
            subtitle="Just two small things. Both take under a minute."
            badge="2 items"
            badgeTone="warning"
            cta={{ href: "/onboarding/child-approval", label: "Open approvals" }}
          >
            <ul className="space-y-3">
              <li>
                <span className="font-semibold text-iw-text-strong">
                  Approve voice mode
                </span>
                <p className="text-iw-text-muted text-sm">
                  Lets Emma talk to the AI tutor out loud during lessons.
                </p>
              </li>
              <li>
                <span className="font-semibold text-iw-text-strong">
                  Upload IEP (optional)
                </span>
                <p className="text-iw-text-muted text-sm">
                  Add accommodations so AIVO applies them from day one.
                </p>
              </li>
            </ul>
          </SectionCard>

          <SectionCard
            title="Notifications"
            iconName="aiWand"
            subtitle="Quiet, recent, parent-relevant only."
            badge="1 new"
            badgeTone="info"
            cta={{ href: "/parent/notifications", label: "Open notifications" }}
          >
            <ul className="space-y-2">
              <li>
                <span className="text-iw-text-strong font-semibold">New milestone:</span>{" "}
                <span className="text-iw-text-muted">
                  Read a 200-word passage independently.
                </span>
              </li>
              <li>
                <span className="text-iw-text-strong font-semibold">Tutor note:</span>{" "}
                <span className="text-iw-text-muted">
                  Pacing looks great this week.
                </span>
              </li>
            </ul>
          </SectionCard>

          <SectionCard
            title="Billing"
            iconName="billingCard"
            subtitle="Plan + next renewal."
            badge="Family · monthly"
            badgeTone="neutral"
            cta={{ href: "/parent/billing", label: "Manage billing" }}
          >
            <ul className="space-y-2">
              <li className="flex justify-between gap-3">
                <span className="text-iw-text-muted">Plan</span>
                <span>Family — 2 learners</span>
              </li>
              <li className="flex justify-between gap-3">
                <span className="text-iw-text-muted">Next renewal</span>
                <span>Apr 14</span>
              </li>
              <li className="flex justify-between gap-3">
                <span className="text-iw-text-muted">Payment method</span>
                <span>Visa · 4242</span>
              </li>
            </ul>
          </SectionCard>

          <SectionCard
            title="School connection"
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
    </main>
  );
}
