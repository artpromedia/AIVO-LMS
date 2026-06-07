/**
 * Teacher rostering surface.
 *
 * Lets a teacher connect a roster source (Google Classroom — teacher
 * owned — or a district SIS such as Clever / ClassLink / OneRoster) so
 * their classes and learners sync into AIVO automatically, view sync
 * status, trigger a manual sync, and disconnect. All actions are bounded
 * to the teacher's own tenant by the `/api/bff/teacher/rostering` guard.
 */
import { requirePageRole } from "@/lib/auth/server";
import { AppShell } from "@/components/layout/app-shell";
import { TEACHER_NAV } from "@/components/layout/role-shells";
import { TeacherRostering } from "@/components/teacher/rostering/teacher-rostering";

export const dynamic = "force-dynamic";

export default async function TeacherRosteringPage() {
  const session = await requirePageRole(["teacher"]);

  return (
    <AppShell
      role="teacher"
      roleLabel="Teacher"
      navItems={TEACHER_NAV}
      user={{ displayName: session.displayName, email: session.email }}
    >
      <TeacherRostering />
    </AppShell>
  );
}
