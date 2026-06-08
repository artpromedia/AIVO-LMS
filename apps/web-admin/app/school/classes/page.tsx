import Link from "next/link";
import { requirePageRole } from "@aivo/admin-auth";
import { listAdminClassrooms } from "@aivo/admin-api/classrooms";
import { AdminCard, AdminPageFrame } from "@aivo/admin-ui";
import { formatDate } from "@/components/admin-format";

export default async function SchoolClassesPage() {
  const session = await requirePageRole(["school_admin", "district_admin", "platform_admin"]);
  const classrooms = await listAdminClassrooms(session);

  return (
    <AdminPageFrame
      eyebrow="School"
      title="Classes"
      description={`${classrooms.length} classrooms at your school.`}
    >
      <AdminCard className="mt-6 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Class</th>
                <th>Grade</th>
                <th>Teachers</th>
                <th>Learners</th>
                <th>Created</th>
              </tr>
            </thead>
            <tbody>
              {classrooms.map((classroom) => (
                <tr key={classroom.id}>
                  <td className="font-bold">
                    <Link className="text-blue-700" href={`/school/classes/${classroom.id}`}>
                      {classroom.name}
                    </Link>
                  </td>
                  <td className="text-sm">{classroom.grade ?? "—"}</td>
                  <td className="text-sm">{classroom.teacherCount}</td>
                  <td className="text-sm">{classroom.learnerCount}</td>
                  <td className="text-sm">{formatDate(classroom.createdAt)}</td>
                </tr>
              ))}
              {classrooms.length === 0 ? (
                <tr>
                  <td className="py-10 text-center text-slate-500" colSpan={5}>
                    No classes found.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </AdminCard>
    </AdminPageFrame>
  );
}
