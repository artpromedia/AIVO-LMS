import { notFound } from "next/navigation";
import { requirePageRole } from "@/lib/auth/server";
import { AppShell } from "@/components/layout/app-shell";
import { PageHeader } from "@/components/layout/page-header";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { TEACHER_NAV } from "@/components/layout/role-shells";
import { getClassroom, listEnrollments } from "@/lib/db/repos";

type Params = { params: Promise<{ classId: string }> };

export default async function Page({ params }: Params) {
  const session = await requirePageRole(["teacher"]);
  const { classId } = await params;
  const classroom = getClassroom(classId, session.tenantId);
  if (!classroom || classroom.teacherUserId !== session.userId) notFound();
  const enrollments = listEnrollments(classroom.id);
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
        <p className="text-xs font-semibold uppercase tracking-wide text-aivo-muted">Roster</p>
        {learners.length === 0 ? (
          <p className="mt-2 text-sm text-aivo-muted">No learners yet. Ask your school admin to assign learners or run a roster import.</p>
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
