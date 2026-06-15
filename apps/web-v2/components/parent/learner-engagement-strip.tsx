/**
 * Learner engagement strip — the REAL "snapshot" numbers. Every value traces
 * to a write path: XP / level / streak come from `LearnerEngagement` (written
 * by `awardLessonEngagement` on each completed run); sessions + time-on-task
 * are aggregated from the learner's completed `LessonRun` rows. No seed-only
 * or hardcoded values. Before any session exists it shows an honest empty line.
 */
import type { ComponentType } from "react";
import { getTranslations } from "next-intl/server";
import { Trophy, Flame, Sparkles, Clock } from "lucide-react";
import { Card } from "@/components/ui/card";
import type { LearnerEngagement } from "@/lib/db/types";

export async function LearnerEngagementStrip({
  engagement,
  sessionsCompleted,
  minutesOnTask,
}: {
  engagement: LearnerEngagement | null;
  sessionsCompleted: number;
  minutesOnTask: number;
}) {
  const t = await getTranslations("parent.engagement");

  const totalXp = engagement?.totalXp ?? 0;
  const level = engagement?.level ?? 1;
  const streak = engagement?.currentStreakDays ?? 0;
  const longest = engagement?.longestStreakDays ?? 0;

  // Honest empty state: nothing has been earned and no session has completed.
  if (totalXp === 0 && sessionsCompleted === 0) {
    return <p className="text-sm text-aivo-ink-soft">{t("empty")}</p>;
  }

  const metrics: Array<{
    Icon: ComponentType<{ className?: string }>;
    tone: string;
    label: string;
    value: string;
    sub?: string;
  }> = [
    {
      Icon: Sparkles,
      tone: "text-aivo-accent",
      label: t("xp"),
      value: String(totalXp),
      sub: t("level", { level }),
    },
    {
      Icon: Flame,
      tone: "text-aivo-danger",
      label: t("streak"),
      value: t("days", { count: streak }),
      sub: t("longest", { count: longest }),
    },
    {
      Icon: Trophy,
      tone: "text-aivo-success",
      label: t("sessions"),
      value: String(sessionsCompleted),
    },
    {
      Icon: Clock,
      tone: "text-aivo-primary",
      label: t("time"),
      value: t("minutes", { count: minutesOnTask }),
    },
  ];

  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      {metrics.map((m) => (
        <Card key={m.label} className="p-4">
          <m.Icon className={`h-5 w-5 ${m.tone}`} aria-hidden />
          <p className="mt-2 text-xs font-medium uppercase tracking-wide text-aivo-ink-soft">
            {m.label}
          </p>
          <p className="mt-0.5 font-display text-2xl font-semibold text-iw-text-strong">{m.value}</p>
          {m.sub ? <p className="mt-0.5 text-xs text-aivo-ink-soft">{m.sub}</p> : null}
        </Card>
      ))}
    </div>
  );
}
