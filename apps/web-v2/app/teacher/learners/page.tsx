/**
 * Sprint 18: Teacher learner roster. Tenant-scoped via repos; this page
 * cannot leak learners from other tenants.
 */
import Link from "next/link";
import { requirePageRole } from "@/lib/auth/server";
import { AppShell } from "@/components/layout/app-shell";
import { PageHeader } from "@/components/layout/page-header";
import { TEACHER_NAV } from "@/components/layout/role-shells";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { listLearnersForTeacher } from "@/lib/db/repos";

export const dynamic = "force-dynamic";

export default async function TeacherLearnersPage() {
  const session = await requirePageRole(["teacher"]);
  const learners = listLearnersForTeacher(session.userId, session.tenantId);
  return (
    <AppShell
      role="teacher"
      roleLabel="Teacher"
      navItems={TEACHER_NAV}
      user={{ displayName: session.displayName, email: session.email }}
    >
      <PageHeader
        eyebrow="Learners"
        title="Your roster"
        description="Open a learner to see recent lessons, skill progress, and accommodations."
      />
      {learners.length === 0 ? (
        <Card className="p-6 text-sm text-muted-foreground">
          No learners are assigned to you yet.
        </Card>
      ) : (
        <ul className="grid gap-3">
          {learners.map((l) => (
            <li key={l.id}>
              <Link
                href={`/teacher/learners/${l.id}`}
                className="block rounded-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
              >
                <Card className="p-4 hover:shadow-md transition-shadow">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-semibold">{l.displayName}</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        Age {new Date().getFullYear() - l.birthYear} · Functioning level{" "}
                        {l.functioningLevel}
                      </p>
                    </div>
                    <Badge tone="neutral">{l.readinessState}</Badge>
                  </div>
                </Card>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </AppShell>
  );
}
