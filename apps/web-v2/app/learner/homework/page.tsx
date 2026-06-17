/**
 * Sprint 9: Homework Helper entry — calm soft-glass redesign on top
 * of @aivo/ui/homework primitives.
 */
import Link from "next/link";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { requirePageRole } from "@/lib/auth/server";
import { readActiveLearnerFromCookies } from "@/lib/auth/active-learner";
import { AppShell } from "@/components/layout/app-shell";
import {
  AICompanionHero,
  PersonalizationChip,
  GuidedStepCard,
  InsightChip,
  type PersonalizationVariant,
} from "@aivo/ui";
import { LEARNER_NAV } from "@/components/layout/role-shells";
import { getIEPForLearner, getLearner, listHomeworkSessionsForLearner } from "@/lib/db/repos";
import { StartHomeworkForm } from "./start-form";

export const dynamic = "force-dynamic";

export default async function LearnerHomeworkPage() {
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

  const recent = await listHomeworkSessionsForLearner(learnerId, session.tenantId, { limit: 10 });
  const iep = await getIEPForLearner(learnerId, session.tenantId);
  const t = await getTranslations("learner.homework");
  const chips: PersonalizationVariant[] = ["ai_companion", "no_grades"];
  if (iep?.confirmedAt) chips.unshift("iep");

  return (
    <AppShell
      role="learner"
      roleLabel="Learner"
      navItems={LEARNER_NAV}
      user={{ displayName: session.displayName, email: session.email }}
    >
      <AICompanionHero
        eyebrow={t("hero_eyebrow")}
        title={t("title")}
        body={t("hero_body")}
        chips={chips.map((v) => (
          <PersonalizationChip key={v} variant={v} />
        ))}
      />

      <section className="mt-6 rounded-iw-card-lg bg-white border border-iw-border p-5 md:p-8">
        <StartHomeworkForm learnerId={learnerId} />
      </section>

      <section className="mt-8 flex flex-col gap-3">
        <h2 className="text-lg font-semibold text-iw-text-strong">{t("section_how_i_help")}</h2>
        <div className="grid gap-3 md:grid-cols-3">
          <GuidedStepCard step={1} total={3} stage="try" title={t("card_try")}>
            <p className="text-sm">{t("card_try_body")}</p>
          </GuidedStepCard>
          <GuidedStepCard step={2} total={3} stage="hint" title={t("card_hint")}>
            <p className="text-sm">{t("card_hint_body")}</p>
          </GuidedStepCard>
          <GuidedStepCard step={3} total={3} stage="walk" title={t("card_walkthrough")}>
            <p className="text-sm">{t("card_walk_body")}</p>
          </GuidedStepCard>
        </div>
      </section>

      {recent.length > 0 ? (
        <section className="mt-8 flex flex-col gap-3">
          <h2 className="text-lg font-semibold text-iw-text-strong">{t("recent_sessions")}</h2>
          <ul className="grid gap-2 md:grid-cols-2">
            {recent.map((s) => (
              <li key={s.id}>
                <Link
                  href={`/learner/homework/${s.id}`}
                  className="block rounded-iw-card-lg bg-white border border-iw-border p-4 hover:shadow-soft-3 transition-shadow focus:outline-none focus:ring-2 focus:ring-[var(--aivo-sensory-ringFocus)] focus:ring-offset-2 focus:ring-offset-[var(--aivo-color-surface-canvas)]"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-iw-text-strong truncate">
                        {s.topic}
                      </p>
                      <p className="text-xs text-iw-text-muted mt-1">
                        {new Date(s.startedAt).toLocaleString()}
                      </p>
                    </div>
                    <InsightChip tone={s.endedAt ? "neutral" : "primary"} size="sm">
                      {s.endedAt ? t("status_done") : t("status_open")}
                    </InsightChip>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </AppShell>
  );
}
