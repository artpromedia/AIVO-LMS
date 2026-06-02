import Link from "next/link";
import { requirePageRole } from "@/lib/auth/server";
import { AppShell } from "@/components/layout/app-shell";
import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { Button } from "@/components/ui/button";
import { SCHOOL_NAV } from "@/components/layout/role-shells";
import { listClassroomsFor, type GradeBand } from "@/lib/admin/school-ops";

export const dynamic = "force-dynamic";

type SearchParams = { searchParams: Promise<{ grade?: string; teacherId?: string }> };

export default async function Page({ searchParams }: SearchParams) {
  const session = await requirePageRole(["school_admin", "district_admin", "platform_admin"]);
  const sp = await searchParams;
  const schoolId = session.tenantId ?? "t_school_demo";

  const VALID_GRADES: GradeBand[] = [
    "K",
    "1",
    "2",
    "3",
    "4",
    "5",
    "6",
    "7",
    "8",
    "9",
    "10",
    "11",
    "12",
  ];
  const gradeFilter =
    sp.grade && (VALID_GRADES as string[]).includes(sp.grade) ? (sp.grade as GradeBand) : undefined;

  const classrooms = listClassroomsFor(schoolId, {
    grade: gradeFilter,
    teacherId: sp.teacherId,
  });

  return (
    <AppShell
      role={session.role}
      roleLabel="School admin"
      navItems={SCHOOL_NAV}
      user={{ displayName: session.displayName, email: session.email }}
    >
      <PageHeader
        eyebrow="School admin"
        title="Classrooms"
        description="Manage classrooms, rosters, and co-teachers."
        actions={
          <Button asChild size="sm">
            <Link href="/admin/school/classrooms/new">+ New classroom</Link>
          </Button>
        }
      />

      {/* Grade filter chips */}
      <div className="mb-4 flex flex-wrap gap-2">
        <Link
          href="/admin/school/classrooms"
          className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
            !gradeFilter
              ? "border-iw-primary bg-iw-accent-soft text-iw-primary"
              : "border-iw-border bg-iw-card text-iw-ink-muted hover:border-iw-primary"
          }`}
        >
          All grades
        </Link>
        {VALID_GRADES.map((g) => (
          <Link
            key={g}
            href={`/admin/school/classrooms?grade=${g}`}
            className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
              gradeFilter === g
                ? "border-iw-primary bg-iw-accent-soft text-iw-primary"
                : "border-iw-border bg-iw-card text-iw-ink-muted hover:border-iw-primary"
            }`}
          >
            {g === "K" ? "Kindergarten" : `Grade ${g}`}
          </Link>
        ))}
      </div>

      {classrooms.length === 0 ? (
        <EmptyState
          title="No classrooms yet"
          description="Create your first classroom to get started."
          action={
            <Button asChild size="sm">
              <Link href="/admin/school/classrooms/new">Create classroom</Link>
            </Button>
          }
        />
      ) : (
        <div className="grid gap-3">
          {classrooms.map((c) => (
            <div
              key={c.id}
              className="flex items-start justify-between gap-3 rounded-iw-card border border-iw-border bg-iw-card p-4"
            >
              <div>
                <Link
                  href={`/admin/school/classrooms/${c.id}`}
                  className="font-semibold text-iw-ink hover:underline"
                >
                  {c.name}
                </Link>
                <p className="text-xs text-iw-ink-muted mt-0.5">
                  Teacher: {c.teacherId} · {c.learnerIds.length} learners
                  {c.coTeacherIds.length > 0 && ` · ${c.coTeacherIds.length} co-teacher(s)`}
                </p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <Badge tone="neutral">
                  {c.grade === "K" ? "Kindergarten" : `Grade ${c.grade}`}
                </Badge>
                <Link
                  href={`/admin/school/classrooms/${c.id}/edit`}
                  className="text-xs text-iw-ink-muted hover:underline"
                >
                  Edit
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}
    </AppShell>
  );
}
