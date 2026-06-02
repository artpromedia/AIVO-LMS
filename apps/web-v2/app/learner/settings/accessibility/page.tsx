/**
 * Sprint 17: Accessibility settings — premium, integrated, never a
 * "special needs" skin.
 *
 * The form itself remains the existing AccessibilityForm component;
 * the redesign sits in the surrounding chrome — soft hero, learner-
 * facing copy, reassurance column that frames why each toggle helps.
 */
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { requirePageRole } from "@/lib/auth/server";
import { AppShell } from "@/components/layout/app-shell";
import { LEARNER_NAV } from "@/components/layout/role-shells";
import { AICompanionHero, PersonalizationChip, GlassCard, ReassuranceCard } from "@aivo/ui";
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
  const learner = await getLearner(learnerId, session.tenantId);
  if (!learner) redirect("/learner/select");
  if (
    session.role !== "learner" &&
    !(await parentCanAccessLearner(session.userId, learnerId, session.tenantId))
  ) {
    redirect("/learner/select");
  }
  const prefs = getAccessibilityPrefs(learnerId, session.tenantId);
  const t = await getTranslations("learner.settings_a11y");

  return (
    <AppShell
      role={session.role === "learner" ? "learner" : "parent"}
      roleLabel={session.role === "learner" ? "Learner" : "Parent · Learner view"}
      navItems={LEARNER_NAV}
      user={{ displayName: session.displayName, email: session.email }}
    >
      <AICompanionHero
        eyebrow={t("eyebrow", { name: learner.displayName })}
        title={t("title")}
        body={t("body")}
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
          title={t("card_title")}
          description={t("card_desc")}
        >
          <AccessibilityForm learnerId={learnerId} initial={prefs} />
        </GlassCard>

        <aside className="flex flex-col gap-3">
          <ReassuranceCard
            tone="info"
            title={t("reassure_wcag_title")}
            body={t("reassure_wcag_body")}
          />
          <ReassuranceCard
            tone="privacy"
            title={t("reassure_labels_title")}
            body={t("reassure_labels_body")}
          />
          <ReassuranceCard
            tone="safety"
            title={t("reassure_teachers_title")}
            body={t("reassure_teachers_body")}
          />
        </aside>
      </section>
    </AppShell>
  );
}
