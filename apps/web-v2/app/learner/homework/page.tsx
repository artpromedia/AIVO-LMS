/**
 * Sprint 9: Homework Helper entry — calm soft-glass redesign on top
 * of @aivo/ui/homework primitives.
 */
import Link from "next/link";
import { redirect } from "next/navigation";
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

  const recent = listHomeworkSessionsForLearner(learnerId, session.tenantId, { limit: 10 });
  const iep = getIEPForLearner(learnerId, session.tenantId);
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
        eyebrow="Homework Helper · I'll guide, not just give answers"
        title="Stuck on something? Show me."
        body="Snap a photo of your work, upload a file, or just type what you're working on. I'll walk you through it one step at a time."
        chips={chips.map((v) => (
          <PersonalizationChip key={v} variant={v} />
        ))}
      />

      <section className="mt-6 rounded-iw-card-lg bg-white border border-iw-border p-5 md:p-8">
        <StartHomeworkForm learnerId={learnerId} />
      </section>

      <section className="mt-8 flex flex-col gap-3">
        <h2 className="text-lg font-semibold text-iw-text-strong">How I help</h2>
        <div className="grid gap-3 md:grid-cols-3">
          <GuidedStepCard
            step={1}
            total={3}
            stage="try"
            title="First, I'll ask you to try"
          >
            <p className="text-sm">
              Even one guess helps. There's no wrong answer in the "try first" step.
            </p>
          </GuidedStepCard>
          <GuidedStepCard
            step={2}
            total={3}
            stage="hint"
            title="Then I give you a small hint"
          >
            <p className="text-sm">
              Just enough to nudge you forward, never the whole answer.
            </p>
          </GuidedStepCard>
          <GuidedStepCard
            step={3}
            total={3}
            stage="walk"
            title="If you're still stuck, we walk through it"
          >
            <p className="text-sm">
              We solve it together — one step at a time, in plain words.
            </p>
          </GuidedStepCard>
        </div>
      </section>

      {recent.length > 0 ? (
        <section className="mt-8 flex flex-col gap-3">
          <h2 className="text-lg font-semibold text-iw-text-strong">Recent sessions</h2>
          <ul className="grid gap-2 md:grid-cols-2">
            {recent.map((s) => (
              <li key={s.id}>
                <Link
                  href={`/learner/homework/${s.id}`}
                  className="block rounded-iw-card-lg bg-white border border-iw-border p-4 hover:shadow-[0_12px_32px_-12px_rgba(15,23,42,0.18)] transition-shadow focus:outline-none focus:ring-2 focus:ring-[var(--aivo-sensory-ringFocus)] focus:ring-offset-2 focus:ring-offset-[var(--aivo-color-surface-canvas)]"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-iw-text-strong truncate">{s.topic}</p>
                      <p className="text-xs text-iw-text-muted mt-1">
                        {new Date(s.startedAt).toLocaleString()}
                      </p>
                    </div>
                    <InsightChip tone={s.endedAt ? "neutral" : "primary"} size="sm">
                      {s.endedAt ? "Done" : "Open"}
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
