/**
 * Sprint 18: Teacher learner roster. Tenant-scoped via repos; this page
 * cannot leak learners from other tenants.
 */
import Link from "next/link";
import { requirePageRole } from "@/lib/auth/server";
import { getTranslations } from "next-intl/server";
import { AppShell } from "@/components/layout/app-shell";
import { PageHeader } from "@/components/layout/page-header";
import { TEACHER_NAV } from "@/components/layout/role-shells";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { listLearnersForTeacher, findTeacherAssessmentDraft } from "@/lib/db/repos";

export const dynamic = "force-dynamic";

export default async function TeacherLearnersPage() {
  const t = await getTranslations("teacher.learners");
  const ta = await getTranslations("teacher.learner_assessment");
  const session = await requirePageRole(["teacher"]);
  const learners = await listLearnersForTeacher(session.userId, session.tenantId);
  const drafts = await Promise.all(
    learners.map((l) =>
      findTeacherAssessmentDraft(l.id, session.tenantId, session.userId).then((d) => ({
        learnerId: l.id,
        submitted: Boolean(d?.submittedAt),
        inProgress:
          !d?.submittedAt &&
          Boolean(d && Object.values(d.answers ?? {}).some((v) => v && Object.keys(v).length > 0)),
      })),
    ),
  );
  const taState = new Map(drafts.map((d) => [d.learnerId, d]));
  return (
    <AppShell
      role="teacher"
      roleLabel="Teacher"
      navItems={TEACHER_NAV}
      user={{ displayName: session.displayName, email: session.email }}
    >
      <PageHeader
        eyebrow="Learners"
        title={t("title")}
        description="Open a learner to see recent lessons, skill progress, and accommodations."
      />
      {learners.length === 0 ? (
        <Card className="p-6 text-sm text-muted-foreground">{t("empty")}</Card>
      ) : (
        <ul className="grid gap-3">
          {learners.map((l) => {
            const st = taState.get(l.id);
            const assessHref = st?.inProgress
              ? `/teacher/learners/${l.id}/assessment?step=1`
              : `/teacher/learners/${l.id}/assessment/intro`;
            return (
              <li key={l.id}>
                <Card className="p-4 hover:shadow-md transition-shadow">
                  <div className="flex items-start justify-between gap-3">
                    <Link
                      href={`/teacher/learners/${l.id}`}
                      className="min-w-0 flex-1 rounded-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                    >
                      <p className="font-semibold">{l.displayName}</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        Age {new Date().getFullYear() - l.birthYear} · Functioning level{" "}
                        {l.functioningLevel}
                      </p>
                    </Link>
                    <Badge tone="neutral">{l.readinessState}</Badge>
                  </div>
                  <div className="mt-3 flex items-center justify-between gap-3 border-t border-aivo-border pt-3">
                    <p className="text-xs text-muted-foreground">
                      {st?.submitted
                        ? ta("cta_done_body")
                        : ta("cta_body", { name: l.displayName })}
                    </p>
                    <Link
                      href={assessHref}
                      className="inline-flex shrink-0 items-center gap-1.5 rounded-md border border-aivo-accent px-3 py-1.5 text-xs font-semibold text-aivo-accent hover:bg-aivo-accent/5 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                    >
                      {st?.submitted
                        ? ta("cta_done")
                        : st?.inProgress
                          ? ta("cta_resume")
                          : ta("cta_action")}
                    </Link>
                  </div>
                </Card>
              </li>
            );
          })}
        </ul>
      )}
    </AppShell>
  );
}
