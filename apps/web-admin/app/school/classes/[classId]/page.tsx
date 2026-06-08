import Link from "next/link";
import { requirePageRole } from "@aivo/admin-auth";
import { getAdminClassroom } from "@aivo/admin-api/classrooms";
import { AdminCard, AdminMetricCard, AdminPageFrame } from "@aivo/admin-ui";
import { formatDate, formatDateTime } from "@/components/admin-format";

function RosterCard({ title, ids, emptyLabel }: { title: string; ids: string[]; emptyLabel: string }) {
  return (
    <AdminCard className="p-5">
      <p className="text-sm font-semibold text-slate-500">{title}</p>
      {ids.length === 0 ? (
        <p className="mt-2 text-sm text-slate-500">{emptyLabel}</p>
      ) : (
        <ul className="mt-2 space-y-1">
          {ids.map((id) => (
            <li key={id} className="text-sm font-medium">
              {id}
            </li>
          ))}
        </ul>
      )}
    </AdminCard>
  );
}

export default async function SchoolClassDetailPage({
  params,
}: {
  params: Promise<{ classId: string }>;
}) {
  const session = await requirePageRole(["school_admin", "district_admin", "platform_admin"]);
  const { classId } = await params;
  const classroom = await getAdminClassroom(session, classId);

  return (
    <AdminPageFrame
      eyebrow="School · Class"
      title={classroom.name}
      description={`${classroom.grade ?? "No grade"} · created ${formatDate(classroom.createdAt)}`}
      action={
        <Link className="admin-button admin-button-secondary" href="/school/classes">
          Back to classes
        </Link>
      }
    >
      <section className="mt-8 grid gap-4 md:grid-cols-3">
        <AdminMetricCard label="Teachers" value={classroom.teacherCount} />
        <AdminMetricCard label="Learners" value={classroom.learnerCount} />
        <AdminCard className="p-5">
          <p className="text-sm font-semibold text-slate-500">Last updated</p>
          <p className="mt-2 text-2xl font-black">{formatDateTime(classroom.updatedAt)}</p>
        </AdminCard>
      </section>

      <section className="mt-8 grid gap-4 md:grid-cols-3">
        <RosterCard title="Teachers" ids={classroom.teacherIds} emptyLabel="No teachers assigned." />
        <RosterCard
          title="Co-teachers"
          ids={classroom.coTeacherIds}
          emptyLabel="No co-teachers assigned."
        />
        <RosterCard title="Learners" ids={classroom.learnerIds} emptyLabel="No learners enrolled." />
      </section>
    </AdminPageFrame>
  );
}
