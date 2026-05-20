/**
 * Sprint 8: AI Tutor home.
 *
 * Calm landing for the AI tutor experience. Surfaces:
 *  - the active lesson run (Resume CTA) if any
 *  - a short tutor chat preview with safety + adapting status chips
 *  - subject quick-asks
 *  - parent/teacher visibility note so the learner knows who can see what
 */
import Link from "next/link";
import { redirect } from "next/navigation";
import { requirePageRole } from "@/lib/auth/server";
import { AppShell } from "@/components/layout/app-shell";
import { Button } from "@/components/ui/button";
import {
  AICompanionHero,
  PersonalizationChip,
  TutorMessage,
  TutorInsightChip,
  ExplanationCard,
  PracticeCard,
  LearnerChoiceCard,
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

export default async function LearnerTutorHome() {
  const session = await requirePageRole(["learner"]);
  if (!session.learnerId) redirect("/learner/home");
  const learner = getLearner(session.learnerId, session.tenantId);
  if (!learner) redirect("/learner/home");
  const subjects = listSubjects();
  const iep = getIEPForLearner(session.learnerId, session.tenantId);

  const chips: PersonalizationVariant[] = ["ai_companion", "no_grades", "calm_mode"];
  if (iep?.confirmedAt) chips.unshift("iep");

  return (
    <AppShell
      role="learner"
      roleLabel="Learner"
      navItems={LEARNER_NAV}
      user={{ displayName: session.displayName, email: session.email }}
    >
      <AICompanionHero
        eyebrow="AI tutor · always calm, always patient"
        title={`Hi ${learner.preferredName || learner.firstName} — ask me anything.`}
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
          <h2 className="text-lg font-semibold text-iw-text-strong">A peek at how I help</h2>
          <TutorMessage
            author="tutor"
            name="AIVO"
            avatar="✨"
            insight={<TutorInsightChip kind="cited" />}
          >
            <p className="text-base leading-relaxed">
              Think of a fraction like a pizza cut into slices. If you eat 3 of 8 slices, you've
              had three-eighths. The bottom number tells you how many slices the pizza was cut
              into.
            </p>
          </TutorMessage>
          <TutorMessage author="learner" name="You" avatar="🙂">
            <p>Got it! So 4/8 is the same as a half?</p>
          </TutorMessage>
          <TutorMessage
            author="tutor"
            name="AIVO"
            avatar="✨"
            insight={<TutorInsightChip kind="difficulty_adjusted" />}
          >
            <p className="text-base leading-relaxed">
              Exactly — you can simplify 4/8 by dividing top and bottom by 4. That gives you 1/2.
              Want to try one yourself?
            </p>
          </TutorMessage>
          <TutorMessage author="system">Read-aloud available · No grades on practice</TutorMessage>

          <ExplanationCard
            kind="example"
            step={1}
            title="Worked example: simplifying fractions"
            citation={
              <span>
                From your school's grade 3–5 Math unit · <Link href="#" className="font-semibold text-[var(--aivo-sensory-primary)] hover:underline">View source</Link>
              </span>
            }
          >
            <p className="mb-2">Let's simplify <span className="font-semibold">6/12</span>.</p>
            <ol className="list-decimal list-inside space-y-1">
              <li>Both 6 and 12 can be divided by 6.</li>
              <li>6 ÷ 6 = 1.</li>
              <li>12 ÷ 6 = 2.</li>
              <li>So <span className="font-semibold">6/12 = 1/2</span>.</li>
            </ol>
          </ExplanationCard>

          <PracticeCard
            kind="practice"
            subtitle="No grade. Just see how it feels."
            prompt="Simplify 4/10."
            actions={
              <>
                <Button type="button" variant="outline" size="sm">
                  Need a hint?
                </Button>
                <Button type="button" size="sm">
                  Submit
                </Button>
              </>
            }
          >
            <LearnerChoiceCard name="demo.tutor" value="2/5" label="2/5" index={0} />
            <LearnerChoiceCard name="demo.tutor" value="1/2" label="1/2" index={1} />
            <LearnerChoiceCard name="demo.tutor" value="4/10" label="4/10 (already simplest)" index={2} />
          </PracticeCard>
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
                    className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-iw-chip text-xs font-semibold border border-iw-border bg-white text-iw-text-strong hover:bg-[var(--aivo-color-aivoPurple-50)]/40"
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
