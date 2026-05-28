import Link from "next/link";
import { requirePageRole } from "@/lib/auth/server";
import { AppShell } from "@/components/layout/app-shell";
import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { TEACHER_NAV } from "@/components/layout/role-shells";
import { listClassrooms, listEnrollments } from "@/lib/db/repos";

export default async function Page() {
  const session = await requirePageRole(["teacher"]);
  const classrooms = await listClassrooms({ tenantId: session.tenantId, teacherUserId: session.userId });

  return (
    <AppShell
      role="teacher"
      roleLabel="Teacher"
      navItems={TEACHER_NAV}
      user={{ displayName: session.displayName, email: session.email }}
    >
      <PageHeader
        eyebrow="Teacher"
        title="Your classes"
        description="Every classroom assigned to you. Tap a class to see its roster."
      />
      {classrooms.length === 0 ? (
        <EmptyState
          title="No classes assigned"
          description="Your school admin can assign you classes from the Rostering page."
        />
      ) : (
        <div className="grid gap-3">
          {await Promise.all(
            classrooms.map(async (c) => {
              const enrollments = await listEnrollments(c.id);
              const learners = enrollments.filter((e) => e.role === "learner").length;
              return (
              <Link
                key={c.id}
                href={`/teacher/classes/${c.id}`}
                className="block rounded-2xl border border-aivo-border bg-aivo-surface p-4 transition hover:border-aivo-primary"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-display text-base font-semibold">{c.name}</p>
                    <p className="text-xs text-aivo-muted">
                      {c.gradeBand} · {learners} learners
                    </p>
                  </div>
                  <Badge tone="primary">{c.gradeBand}</Badge>
                </div>
              </Link>
              );
            }),
          )}
        </div>
      )}
    </AppShell>
  );
}
