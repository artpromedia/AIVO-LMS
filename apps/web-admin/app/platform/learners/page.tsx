import { requirePlatformPage } from "@aivo/admin-auth";
import { listAdminLearners } from "@aivo/admin-api/platform";
import { AdminPageFrame } from "@aivo/admin-ui";
import { LearnersTable } from "@/components/admin-tables";

export default async function PlatformLearnersPage() {
  const session = await requirePlatformPage("platform:read");
  const learners = await listAdminLearners(session);

  return (
    <AdminPageFrame
      eyebrow="Platform"
      title="Learners"
      description={`${learners.length} learner profiles across all tenants.`}
    >
      <LearnersTable learners={learners} />
    </AdminPageFrame>
  );
}
