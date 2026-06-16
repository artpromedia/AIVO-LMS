import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { requirePageRole } from "@/lib/auth/server";
import { AppShell } from "@/components/layout/app-shell";
import { PageHeader } from "@/components/layout/page-header";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { AivoMascot } from "@/components/learner/art/aivo-mascot";
import { LEARNER_NAV } from "@/components/layout/role-shells";
import { listLessonRunsForLearner } from "@/lib/db/repos";

export default async function Page() {
  const session = await requirePageRole(["learner"]);
  const t = await getTranslations("learner.library");
  const tc = await getTranslations("learner.common");
  const learnerId = session.learnerId;
  if (!learnerId) {
    return (
      <AppShell
        role="learner"
        roleLabel="Learner"
        navItems={LEARNER_NAV}
        user={{ displayName: session.displayName, email: session.email }}
      >
        <EmptyState title={tc("no_profile")} />
      </AppShell>
    );
  }
  const allRuns = await listLessonRunsForLearner(learnerId, session.tenantId);
  const runs = allRuns
    .filter((r) => r.status === "completed")
    .sort((a, b) => (b.completedAt ?? "").localeCompare(a.completedAt ?? ""));

  return (
    <AppShell
      role="learner"
      roleLabel="Learner"
      navItems={LEARNER_NAV}
      user={{ displayName: session.displayName, email: session.email }}
    >
      <PageHeader
        eyebrow={tc("learner_eyebrow")}
        title={t("title")}
        description={t("description")}
      />
      {runs.length === 0 ? (
        <EmptyState
          icon={<AivoMascot expression="resting" size={72} />}
          title={t("nothing_finished")}
          description={t("nothing_finished_desc")}
        />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {runs.map((r) => (
            <Card key={r.id} className="p-4">
              <p className="font-medium">{t("lesson")}</p>
              <p className="text-sm text-iw-ink-muted">
                {tc("source", { source: r.source })}
                {r.completedAt
                  ? ` · ${t("completed", { date: new Date(r.completedAt).toLocaleDateString() })}`
                  : ""}
              </p>
              <Link
                href={`/learner/lesson-runs/${r.id}`}
                className="mt-2 inline-block text-xs font-medium text-iw-primary hover:underline"
              >
                {t("replay")}
              </Link>
            </Card>
          ))}
        </div>
      )}
    </AppShell>
  );
}
