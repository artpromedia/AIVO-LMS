/**
 * Sprint 18: New assignment form. Server renders the subject + learner
 * picker data; client component submits to the BFF.
 */
import { requirePageRole } from "@/lib/auth/server";
import { AppShell } from "@/components/layout/app-shell";
import { PageHeader } from "@/components/layout/page-header";
import { TEACHER_NAV } from "@/components/layout/role-shells";
import { listLearnersForTeacher, listSkills, listSubjects } from "@/lib/db/repos";
import { NewAssignmentForm } from "./new-form";

export const dynamic = "force-dynamic";

export default async function NewAssignmentPage() {
  const session = await requirePageRole(["teacher"]);
  const subjects = await listSubjects();
  const learners = await listLearnersForTeacher(session.userId, session.tenantId);
  const subjectsWithSkills = await Promise.all(
    subjects.map(async (s) => ({
      id: s.id,
      name: s.name,
      skills: (await listSkills(s.id)).map((sk) => ({ id: sk.id, name: sk.name })),
    })),
  );

  return (
    <AppShell
      role="teacher"
      roleLabel="Teacher"
      navItems={TEACHER_NAV}
      user={{ displayName: session.displayName, email: session.email }}
    >
      <PageHeader
        eyebrow="Assignments"
        title="New assignment"
        description="Pick a subject and skills, choose learners, and add instructions."
      />
      <NewAssignmentForm
        subjects={subjectsWithSkills}
        learners={learners.map((l) => ({ id: l.id, displayName: l.displayName }))}
      />
    </AppShell>
  );
}
