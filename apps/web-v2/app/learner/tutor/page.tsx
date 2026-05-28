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

  const chips: PersonalizationVariant[] = ["ai_companion", "no_grades", "calm_mode"];
  if (iep?.confirmedAt) chips.unshift("iep");

  const preferredName = learner.preferredName || learner.firstName;
  const greeting = `Hi ${preferredName}! Ask me anything — I'll guide you with hints and questions instead of just handing over the answer. What are you working on?`;

  return (
    <AppShell
      role="learner"
      roleLabel="Learner"
      navItems={LEARNER_NAV}
      user={{ displayName: session.displayName, email: session.email }}
    >
      <AICompanionHero
        eyebrow="AI tutor · always calm, always patient"
        title={`Hi ${preferredName} — ask me anything.`}
        body="I'll explain, give hints, walk you through examples, or just keep you company while you practice. No grades. Tap a subject to start, or pick up an open lesson."
        chips={chips.map((v) => (
          <PersonalizationChip key={v} variant={v} />
        ))}
        actions={
          <Link
            href="/learner/home"
            className="inline-flex items-center gap-2 rounded-iw-control px-5 py-3 text-base font-semibold text-white bg-[var(--aivo-sensory-primary)] hover:brightness-110 shadow-[0_4px_12px_rgb(from_var(--aivo-sensory-primary)_r_g_b_/_0.3)]"
          >
            Start today's lesson
          </Link>
        }
      />

      <section className="mt-8 grid gap-4 lg:grid-cols-[1fr,320px]">
        <div className="flex flex-col gap-3">
          <h2 className="text-lg font-semibold text-iw-text-strong">Chat with your tutor</h2>
          <LearnerTutorChat
            learnerId={session.learnerId}
            greeting={greeting}
            preferredName={preferredName}
          />
        </div>

        <aside className="flex flex-col gap-3">
          <article className="rounded-iw-card-lg bg-white border border-iw-border p-5 flex flex-col gap-3">
            <h3 className="text-base font-semibold text-iw-text-strong">Quick asks</h3>
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
                    Help with {s.name}
                  </Link>
                );
              })}
            </div>
          </article>

          <article className="rounded-iw-card-lg bg-white border border-iw-border p-5 flex flex-col gap-3">
            <h3 className="text-base font-semibold text-iw-text-strong">Who can see this?</h3>
            <ul className="space-y-2 text-sm text-iw-text-strong">
              <li className="flex items-start gap-2">
                <InsightChip tone="primary" size="sm">
                  Your grown-up
                </InsightChip>
                <span className="text-iw-text-muted">Sees a calm summary, not every message.</span>
              </li>
              <li className="flex items-start gap-2">
                <InsightChip tone="accent" size="sm">
                  Your teacher
                </InsightChip>
                <span className="text-iw-text-muted">Sees the skills you practised.</span>
              </li>
              <li className="flex items-start gap-2">
                <InsightChip tone="neutral" size="sm">
                  Nobody else
                </InsightChip>
                <span className="text-iw-text-muted">Tutor chat stays private to you.</span>
              </li>
            </ul>
          </article>

          <article className="rounded-iw-card-lg bg-white border border-iw-border p-5 flex flex-col gap-2">
            <h3 className="text-base font-semibold text-iw-text-strong">Safety</h3>
            <p className="text-xs text-iw-text-muted leading-relaxed">
              AIVO has safety filters always on. If something feels off, your grown-up will know.
              You can always pause or close the tutor — no questions asked.
            </p>
            <TutorInsightChip kind="safety_active" />
          </article>
        </aside>
      </section>
    </AppShell>
  );
}
