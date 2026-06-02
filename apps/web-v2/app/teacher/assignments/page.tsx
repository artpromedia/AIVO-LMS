/**
 * Sprint 18: Teacher assignments list — now backed by real data.
 */
import Link from "next/link";
import { requirePageRole } from "@/lib/auth/server";
import { getTranslations } from "next-intl/server";
import { AppShell } from "@/components/layout/app-shell";
import { PageHeader } from "@/components/layout/page-header";
import { TEACHER_NAV } from "@/components/layout/role-shells";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { listSubjects, listTeacherAssignments } from "@/lib/db/repos";

export const dynamic = "force-dynamic";

export default async function TeacherAssignmentsPage() {
  const t = await getTranslations("teacher.assignments");
  const session = await requirePageRole(["teacher"]);
  const assignments = await listTeacherAssignments(session.userId, session.tenantId);
  const subjectsById = new Map((await listSubjects()).map((s) => [s.id, s]));

  return (
    <AppShell
      role="teacher"
      roleLabel="Teacher"
      navItems={TEACHER_NAV}
      user={{ displayName: session.displayName, email: session.email }}
    >
      <PageHeader
        eyebrow="Assignments"
        title={t("title")}
        description="Set work for individual learners. Assigned work appears on the learner's Today screen."
      />
      <div className="mb-4">
        <Button asChild>
          <Link href="/teacher/assignments/new">{t("new_assignment")}</Link>
        </Button>
      </div>
      {assignments.length === 0 ? (
        <Card className="p-6 text-sm text-muted-foreground">{t("empty")}</Card>
      ) : (
        <ul className="grid gap-3">
          {assignments.map((a) => (
            <li key={a.id}>
              <Card className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-semibold">{a.title}</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {subjectsById.get(a.subjectId)?.name ?? a.subjectId} · {a.learnerIds.length}{" "}
                      learner{a.learnerIds.length === 1 ? "" : "s"} · created{" "}
                      {new Date(a.createdAt).toLocaleDateString()}
                    </p>
                    {a.instructions && <p className="text-sm mt-2">{a.instructions}</p>}
                  </div>
                  <Badge tone={a.status === "active" ? "primary" : "neutral"}>{a.status}</Badge>
                </div>
              </Card>
            </li>
          ))}
        </ul>
      )}
    </AppShell>
  );
}
