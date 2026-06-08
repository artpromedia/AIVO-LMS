import { requirePlatformPage } from "@aivo/admin-auth";
import { listAdminUsers } from "@aivo/admin-api/platform";
import { AdminPageFrame } from "@aivo/admin-ui";
import { UsersTable } from "@/components/admin-tables";

export default async function UsersPage() {
  const session = await requirePlatformPage("platform:read");
  const users = await listAdminUsers(session);

  return (
    <AdminPageFrame
      eyebrow="Platform"
      title="Users"
      description={`${users.length} administrator, educator, and guardian accounts.`}
    >
      <UsersTable users={users} />
    </AdminPageFrame>
  );
}
