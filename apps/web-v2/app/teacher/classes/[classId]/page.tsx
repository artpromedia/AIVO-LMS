import { notFound } from "next/navigation";
import { requirePageRole } from "@/lib/auth/server";
import { getTranslations } from "next-intl/server";
import { AppShell } from "@/components/layout/app-shell";
import { PageHeader } from "@/components/layout/page-header";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { TEACHER_NAV } from "@/components/layout/role-shells";
import { getClassroom, listEnrollments } from "@/lib/db/repos";

type Params = { params: Promise<{ classId: string }> };

export default async function Page({ params }: Params) {
  const t = await getTranslations("teacher.classes_class");
  const session = await requirePageRole(["teacher"]);
  const { classId } = await params;
  const classroom = await getClassroom(classId, session.tenantId);
  if (!classroom || classroom.teacherUserId !== session.userId) notFound();
  const enrollments = await listEnrollments(classroom.id);
  const learners = enrollments.filter((e) => e.role === "learner");

  return (
    <AppShell
      role="teacher"
      roleLabel="Teacher"
      navItems={TEACHER_NAV}
      user={{ displayName: session.displayName, email: session.email }}
    >
      <PageHeader
        eyebrow={classroom.gradeBand}
        title={classroom.name}
        description={`${learners.length} learner${learners.length === 1 ? "" : "s"} enrolled.`}
      />
      <Card className="p-[var(--aivo-density-card-pad)]">
        <p className="text-xs font-semibold uppercase tracking-wide text-iw-ink-muted">
          {t("roster")}
        </p>
        {learners.length === 0 ? (
          <p className="mt-2 text-sm text-iw-ink-muted">{t("no_learners")}</p>
        ) : (
          <ul className="mt-2 space-y-1 text-sm">
            {learners.map((e) => (
              <li key={e.id} className="flex items-center justify-between">
                <span className="font-mono text-xs">{e.subjectId}</span>
                <Badge tone="neutral">{e.role}</Badge>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </AppShell>
  );
}
