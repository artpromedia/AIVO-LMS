import Link from "next/link";
import { notFound } from "next/navigation";
import { requirePageRole } from "@/lib/auth/server";
import { AppShell } from "@/components/layout/app-shell";
import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { SCHOOL_NAV } from "@/components/layout/role-shells";
import { getClassroom } from "@/lib/admin/school-ops";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

const LEARNER_NAMES: Record<string, string> = {
  lrn_demo_sky: "Skyler Nguyen",
  lrn_demo_rio: "Rio Martinez",
  lrn_demo_ada: "Ada Chen",
  lrn_demo_kai: "Kai Brooks",
  lrn_demo_zoe: "Zoe Patel",
  lrn_demo_max: "Max Rivera",
};

const TEACHER_NAMES: Record<string, string> = {
  u_teacher_1: "Ms. Rivera",
  u_teacher_2: "Mr. Patel",
  u_teacher_3: "Ms. Chen",
  u_teacher_4: "Mr. Johnson",
};

export default async function Page({ params }: Params) {
  const session = await requirePageRole(["school_admin", "district_admin", "platform_admin"]);
  const { id } = await params;
  const classroom = getClassroom(id);
  if (!classroom) notFound();

  return (
    <AppShell
      role={session.role}
      roleLabel="School admin"
      navItems={SCHOOL_NAV}
      user={{ displayName: session.displayName, email: session.email }}
    >
      <PageHeader
        eyebrow="School admin · Classrooms"
        title={classroom.name}
        description={`Grade ${classroom.grade === "K" ? "Kindergarten" : classroom.grade}`}
        actions={
          <div className="flex gap-2">
            <Button asChild size="sm" variant="outline">
              <Link href={`/admin/school/classrooms/${id}/edit`}>Edit</Link>
            </Button>
            <Button asChild size="sm">
              <Link href={`/admin/school/classrooms/${id}/roster`}>Manage roster</Link>
            </Button>
          </div>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-iw-ink-muted">Grade</span>
              <Badge tone="neutral">
                {classroom.grade === "K" ? "Kindergarten" : `Grade ${classroom.grade}`}
              </Badge>
            </div>
            <div className="flex justify-between">
              <span className="text-iw-ink-muted">Primary teacher</span>
              <span>{TEACHER_NAMES[classroom.teacherId] ?? classroom.teacherId}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-iw-ink-muted">Co-teachers</span>
              <span>
                {classroom.coTeacherIds.length === 0
                  ? "None"
                  : classroom.coTeacherIds.map((t) => TEACHER_NAMES[t] ?? t).join(", ")}
              </span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Learners ({classroom.learnerIds.length})</CardTitle>
          </CardHeader>
          <CardContent>
            {classroom.learnerIds.length === 0 ? (
              <p className="text-sm text-iw-ink-muted">No learners enrolled.</p>
            ) : (
              <ul className="space-y-1 text-sm">
                {classroom.learnerIds.map((lid) => (
                  <li key={lid} className="flex items-center gap-2">
                    <span className="h-2 w-2 rounded-full bg-aivo-success" />
                    {LEARNER_NAMES[lid] ?? lid}
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}
