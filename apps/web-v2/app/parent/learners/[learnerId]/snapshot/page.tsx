import Link from "next/link";
import { FloatingMetricCard, LearningHero } from "@aivo/ui/hero";
import { AivoIcon } from "@aivo/ui/icon";
import { requirePageRole } from "@/lib/auth/server";
import { getTranslations } from "next-intl/server";

interface SnapshotProps {
  params: { learnerId: string };
}

/**
 * /parent/learners/[learnerId]/snapshot — a calm, one-glance
 * weekly-style snapshot of a single learner. Designed for
 * skim-reading on a phone over breakfast.
 *
 * Verbatim acceptance: "Parent home feels premium and calm.
 * All cards have real destinations."
 */
export default async function LearnerSnapshot({ params }: SnapshotProps) {
  const t = await getTranslations("parent.learner_snapshot");
  await requirePageRole(["parent"]);
  const { learnerId } = params;
  const learnerName = "Emma";
  const base = `/parent/learners/${learnerId}`;

  return (
    <main className="min-h-screen bg-[var(--aivo-color-surface-canvas)]">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 py-6 lg:py-10 flex flex-col gap-6">
        <LearningHero
          greeting={<>This week with {learnerName}</>}
          subhead="A calm snapshot — nothing here needs your attention unless it's flagged."
          actions={
            <Link
              href={`${base}/profile-v2`}
              className="inline-flex items-center gap-2 h-11 px-5 rounded-iw-control bg-[var(--aivo-sensory-primary)] text-white font-semibold shadow-sm hover:opacity-95"
            >
              <AivoIcon name="aiBrain" size={18} />
              {t("open_full_profile")}
            </Link>
          }
        />

        <section>
          <h2 className="iw-label uppercase tracking-wider text-iw-text-muted mb-3">
            {t("this_week")}
          </h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <FloatingMetricCard
              label="Learning time"
              value="2h 14m"
              delta={{ value: "+18m vs last week", tone: "up" }}
              icon={<AivoIcon name="goal" size={20} />}
              href={`${base}/lessons`}
              tone="success"
            />
            <FloatingMetricCard
              label="Skills mastered"
              value="4"
              delta={{ value: "this week", tone: "up" }}
              icon={<AivoIcon name="mastery" size={20} />}
              href={`${base}/progress`}
              tone="success"
            />
            <FloatingMetricCard
              label="Homework on track"
              value="On time"
              icon={<AivoIcon name="curriculum" size={20} />}
              href={`${base}/homework`}
            />
            <FloatingMetricCard
              label="Wellbeing"
              value="Calm"
              description="No stress flags from the AI tutor this week."
              icon={<AivoIcon name="safetyOk" size={20} />}
              href={`${base}/summary`}
              tone="success"
            />
            <FloatingMetricCard
              label="Milestones"
              value="1 unlocked"
              description="Read a 200-word passage independently."
              icon={<AivoIcon name="growth" size={20} />}
              href={`${base}/milestones`}
              tone="info"
            />
            <FloatingMetricCard
              label="Approvals waiting"
              value="0"
              description="Nothing waiting for your sign-off."
              icon={<AivoIcon name="consentCheck" size={20} />}
              href="/parent/home-v2"
            />
          </div>
        </section>
      </div>
    </main>
  );
}
