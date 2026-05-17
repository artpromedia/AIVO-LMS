import Link from "next/link";
import { requirePageRole } from "@/lib/auth/server";
import { AppShell } from "@/components/layout/app-shell";
import { PageHeader } from "@/components/layout/page-header";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { SCHOOL_NAV } from "@/components/layout/role-shells";
import { listClassrooms, listEnrollments, listSchools } from "@/lib/db/repos";

type Params = { searchParams: Promise<{ schoolId?: string }> };

export default async function Page({ searchParams }: Params) {
  const session = await requirePageRole(["school_admin", "district_admin", "platform_admin"]);
  const params = await searchParams;
  const schools = listSchools(session.role === "platform_admin" ? undefined : session.tenantId);
  const classrooms = listClassrooms({ tenantId: session.tenantId, schoolId: params.schoolId });

  return (
    <AppShell
      role={session.role}
      roleLabel="School admin"
      navItems={SCHOOL_NAV}
      user={{ displayName: session.displayName, email: session.email }}
    >
      <PageHeader
        eyebrow="School admin"
        title="Classes"
        description="Every classroom in your tenant. Filter by school using the links below."
      />

      {schools.length > 1 ? (
        <div className="mb-4 flex flex-wrap gap-2">
          <Link href="/admin/school/classes" className="rounded-full border border-aivo-border bg-aivo-surface px-3 py-1 text-xs">All</Link>
          {schools.map((s) => (
            <Link
              key={s.id}
              href={`/admin/school/classes?schoolId=${s.id}`}
              className="rounded-full border border-aivo-border bg-aivo-surface px-3 py-1 text-xs"
            >
              {s.name}
            </Link>
          ))}
        </div>
      ) : null}

      {classrooms.length === 0 ? (
        <EmptyState
          title="No classes yet"
          description="Run a roster import or use the AIVO API to create classes."
        />
      ) : (
        <div className="grid gap-3">
          {classrooms.map((c) => {
            const learners = listEnrollments(c.id).filter((e) => e.role === "learner").length;
            return (
              <Link
                key={c.id}
                href={`/admin/school/classes/${c.id}`}
                className="block rounded-2xl border border-aivo-border bg-aivo-surface p-4 transition hover:border-aivo-primary"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-display text-base font-semibold">{c.name}</p>
                    <p className="text-xs text-aivo-muted">School {c.schoolId} · teacher {c.teacherUserId}</p>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <Badge tone="neutral">{c.gradeBand}</Badge>
                    <span className="text-xs text-aivo-muted">{learners} learners</span>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </AppShell>
  );
}
