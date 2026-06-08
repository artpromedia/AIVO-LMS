import { requirePageRole } from "@aivo/admin-auth";
import { listAdminLearners } from "@aivo/admin-api/platform";
import { AdminPageFrame } from "@aivo/admin-ui";
import { LearnersTable } from "@/components/admin-tables";

export default async function SchoolLearnersPage() {
  const session = await requirePageRole(["school_admin", "district_admin", "platform_admin"]);
  const learners = await listAdminLearners(session);

  return (
    <AdminPageFrame
      eyebrow="School"
      title="Learners"
      description="Learner profiles enrolled at your school."
    >
      <LearnersTable learners={learners} />
    </AdminPageFrame>
  );
}
