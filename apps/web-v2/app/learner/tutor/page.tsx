/**
 * Sprint 8: AI Tutor home.
 *
 * Calm landing for the AI tutor experience. Surfaces:
 *  - the active lesson run (Resume CTA) if any
 *  - a real Socratic chat (Sprint 4) backed by
 *    POST /api/bff/learners/[learnerId]/tutor/reply
 *  - subject quick-asks
 *  - parent/teacher visibility note so the learner knows who can see what
 */
import Link from "next/link";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { requirePageRole } from "@/lib/auth/server";
import { AppShell } from "@/components/layout/app-shell";
import {
  AICompanionHero,
  PersonalizationChip,
  TutorInsightChip,
  InsightChip,
  type PersonalizationVariant,
} from "@aivo/ui";
import { LEARNER_NAV } from "@/components/layout/role-shells";
import {
  getIEPForLearner,
  getLearner,
  listSubjects,
} from "@/lib/db/repos";
import { tutorForSubjectSlug } from "@/lib/learner/baseline-tutors";
import { LearnerTutorChat } from "./chat";

export default async function LearnerTutorHome() {
  const session = await requirePageRole(["learner"]);
  if (!session.learnerId) redirect("/learner/home");
  const learner = await getLearner(session.learnerId, session.tenantId);
  if (!learner) redirect("/learner/home");
  const subjects = await listSubjects();
  const iep = await getIEPForLearner(session.learnerId, session.tenantId);
  const t = await getTranslations("learner.tutor");

  const chips: PersonalizationVariant[] = ["ai_companion", "no_grades", "calm_mode"];
  if (iep?.confirmedAt) chips.unshift("iep");

  const preferredName = learner.preferredName || learner.firstName;
  const greeting = t("greeting", { name: preferredName });

  return (
    <AppShell
      role="learner"
      roleLabel="Learner"
      navItems={LEARNER_NAV}
      user={{ displayName: session.displayName, email: session.email }}
    >
      <AICompanionHero
        eyebrow={t("hero_eyebrow")}
        title={t("hero_title", { name: preferredName })}
        body={t("hero_body")}
        chips={chips.map((v) => (
          <PersonalizationChip key={v} variant={v} />
        ))}
        actions={
          <Link
            href="/learner/home"
            className="inline-flex items-center gap-2 rounded-iw-control px-5 py-3 text-base font-semibold text-white bg-[var(--aivo-sensory-primary)] hover:brightness-110 shadow-[0_4px_12px_rgb(from_var(--aivo-sensory-primary)_r_g_b_/_0.3)]"
          >
            {t("start_lesson")}
          </Link>
        }
      />

      <section className="mt-8 grid gap-4 lg:grid-cols-[1fr,320px]">
        <div className="flex flex-col gap-3">
          <h2 className="text-lg font-semibold text-iw-text-strong">{t("chat_heading")}</h2>
          <LearnerTutorChat
            learnerId={session.learnerId}
            greeting={greeting}
            preferredName={preferredName}
          />
        </div>

        <aside className="flex flex-col gap-3">
          <article className="rounded-iw-card-lg bg-white border border-iw-border p-5 flex flex-col gap-3">
            <h3 className="text-base font-semibold text-iw-text-strong">{t("quick_asks")}</h3>
            <div className="flex flex-wrap gap-2">
              {subjects.slice(0, 5).map((s) => {
                const tutor = tutorForSubjectSlug(s.slug);
                return (
                  <Link
                    key={s.id}
                    href={`/learner/subjects/${s.id}`}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-iw-chip text-xs font-semibold border border-iw-border bg-white text-iw-text-strong hover:bg-[var(--aivo-aivoPurple-50)]/40"
                  >
                    <span aria-hidden="true">{tutor?.emoji ?? "📘"}</span>
                    {t("help_with", { name: s.name })}
                  </Link>
                );
              })}
            </div>
          </article>

          <article className="rounded-iw-card-lg bg-white border border-iw-border p-5 flex flex-col gap-3">
            <h3 className="text-base font-semibold text-iw-text-strong">{t("who_sees")}</h3>
            <ul className="space-y-2 text-sm text-iw-text-strong">
              <li className="flex items-start gap-2">
                <InsightChip tone="primary" size="sm">
                  {t("who_grownup")}
                </InsightChip>
                <span className="text-iw-text-muted">{t("who_grownup_desc")}</span>
              </li>
              <li className="flex items-start gap-2">
                <InsightChip tone="accent" size="sm">
                  {t("who_teacher")}
                </InsightChip>
                <span className="text-iw-text-muted">{t("who_teacher_desc")}</span>
              </li>
              <li className="flex items-start gap-2">
                <InsightChip tone="neutral" size="sm">
                  {t("who_nobody")}
                </InsightChip>
                <span className="text-iw-text-muted">{t("who_nobody_desc")}</span>
              </li>
            </ul>
          </article>

          <article className="rounded-iw-card-lg bg-white border border-iw-border p-5 flex flex-col gap-2">
            <h3 className="text-base font-semibold text-iw-text-strong">{t("safety")}</h3>
            <p className="text-xs text-iw-text-muted leading-relaxed">
              {t("safety_body")}
            </p>
            <TutorInsightChip kind="safety_active" />
          </article>
        </aside>
      </section>
    </AppShell>
  );
}
