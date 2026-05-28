import { notFound } from "next/navigation";
import { requirePageRole } from "@/lib/auth/server";
import { AppShell } from "@/components/layout/app-shell";
import { PageHeader } from "@/components/layout/page-header";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { SCHOOL_NAV } from "@/components/layout/role-shells";
import { getClassroom, getSchool, listEnrollments } from "@/lib/db/repos";

type Params = { params: Promise<{ classId: string }> };

export default async function Page({ params }: Params) {
  const session = await requirePageRole(["school_admin", "district_admin", "platform_admin"]);
  const { classId } = await params;
  const classroom = await getClassroom(classId, session.tenantId);
  if (!classroom) notFound();
  const school = await getSchool(classroom.schoolId);
  const enrollments = await listEnrollments(classroom.id);
  const teachers = enrollments.filter((e) => e.role === "teacher" || e.role === "co_teacher");
  const learners = enrollments.filter((e) => e.role === "learner");

  return (
    <AppShell
      role={session.role}
      roleLabel="School admin"
      navItems={SCHOOL_NAV}
      user={{ displayName: session.displayName, email: session.email }}
    >
      <PageHeader
        eyebrow={school?.name ?? "Class"}
        title={classroom.name}
        description={`Grade band ${classroom.gradeBand} · primary teacher ${classroom.teacherUserId}`}
      />

      <div className="grid gap-4 md:grid-cols-2">
        <Card className="p-[var(--aivo-density-card-pad)]">
          <p className="text-xs font-semibold uppercase tracking-wide text-aivo-muted">Teachers</p>
          {teachers.length === 0 ? (
            <p className="mt-2 text-sm text-aivo-muted">None yet.</p>
          ) : (
            <ul className="mt-2 space-y-1 text-sm">
              {teachers.map((e) => (
                <li key={e.id} className="flex items-center justify-between">
                  <span className="font-mono text-xs">{e.subjectId}</span>
                  <Badge tone={e.role === "teacher" ? "primary" : "neutral"}>{e.role}</Badge>
                </li>
              ))}
            </ul>
          )}
        </Card>
        <Card className="p-[var(--aivo-density-card-pad)]">
          <p className="text-xs font-semibold uppercase tracking-wide text-aivo-muted">
            Learners <span className="text-aivo-ink-soft">({learners.length})</span>
          </p>
          {learners.length === 0 ? (
            <p className="mt-2 text-sm text-aivo-muted">No learners enrolled.</p>
          ) : (
            <ul className="mt-2 space-y-1 text-sm">
              {learners.slice(0, 50).map((e) => (
                <li key={e.id} className="font-mono text-xs">
                  {e.subjectId}
                </li>
              ))}
              {learners.length > 50 ? (
                <li className="text-aivo-muted">…and {learners.length - 50} more.</li>
              ) : null}
            </ul>
          )}
        </Card>
      </div>
    </AppShell>
  );
}
