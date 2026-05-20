/**
 * Sprint 17: Accessibility settings — premium, integrated, never a
 * "special needs" skin.
 *
 * The form itself remains the existing AccessibilityForm component;
 * the redesign sits in the surrounding chrome — soft hero, learner-
 * facing copy, reassurance column that frames why each toggle helps.
 */
import { redirect } from "next/navigation";
import { requirePageRole } from "@/lib/auth/server";
import { AppShell } from "@/components/layout/app-shell";
import { LEARNER_NAV } from "@/components/layout/role-shells";
import {
  AICompanionHero,
  PersonalizationChip,
  GlassCard,
  ReassuranceCard,
} from "@aivo/ui";
import { getAccessibilityPrefs, getLearner, parentCanAccessLearner } from "@/lib/db/repos";
import { readActiveLearnerFromCookies } from "@/lib/auth/active-learner";
import { AccessibilityForm } from "@/components/learner/accessibility-form";

export const dynamic = "force-dynamic";

export default async function LearnerAccessibilitySettingsPage() {
  const session = await requirePageRole(["learner", "parent"]);
  let learnerId: string | null = null;
  if (session.role === "learner") {
    learnerId = session.learnerId ?? null;
    if (!learnerId) redirect("/learner/select");
  } else {
    learnerId = await readActiveLearnerFromCookies(session);
    if (!learnerId) redirect("/learner/select");
  }
  const learner = getLearner(learnerId, session.tenantId);
  if (!learner) redirect("/learner/select");
  if (
    session.role !== "learner" &&
    !parentCanAccessLearner(session.userId, learnerId, session.tenantId)
  ) {
    redirect("/learner/select");
  }
  const prefs = getAccessibilityPrefs(learnerId, session.tenantId);

  return (
    <AppShell
      role={session.role === "learner" ? "learner" : "parent"}
      roleLabel={session.role === "learner" ? "Learner" : "Parent · Learner view"}
      navItems={LEARNER_NAV}
      user={{ displayName: session.displayName, email: session.email }}
    >
      <AICompanionHero
        eyebrow={`Settings · for ${learner.displayName}`}
        title="How you like to learn"
        body="Tweak these any time — your lessons will follow along. Every option is built into the calm AIVO experience, never a separate mode."
        chips={
          <>
            <PersonalizationChip variant="calm_mode" />
            <PersonalizationChip variant="read_aloud" />
            <PersonalizationChip variant="pacing" />
          </>
        }
      />

      <section className="mt-6 grid gap-4 lg:grid-cols-[1fr,320px]">
        <GlassCard
          elevation="raised"
          density="comfortable"
          title="Reading & display"
          description="Big text, dyslexia-friendly font, extra spacing, high contrast."
        >
          <AccessibilityForm learnerId={learnerId} initial={prefs} />
        </GlassCard>

        <aside className="flex flex-col gap-3">
          <ReassuranceCard
            tone="info"
            title="WCAG 2.2 AA"
            body="Every AIVO screen meets WCAG 2.2 AA out of the box. These settings let you push further when you need to."
          />
          <ReassuranceCard
            tone="privacy"
            title="Same product, no labels"
            body="Turning on supports never marks your learner as different — the interface stays calm and premium."
          />
          <ReassuranceCard
            tone="safety"
            title="Teachers honour these"
            body="Whatever you turn on here is applied during lessons, homework, and the AI tutor — no extra setup."
          />
        </aside>
      </section>
    </AppShell>
  );
}
