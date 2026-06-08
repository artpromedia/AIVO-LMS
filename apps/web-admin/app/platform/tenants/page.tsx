import { requirePlatformPage } from "@aivo/admin-auth";
import { listAdminTenants } from "@aivo/admin-api/platform";
import { AdminPageFrame } from "@aivo/admin-ui";
import { TenantsTable } from "@/components/admin-tables";

export default async function TenantsPage() {
  const session = await requirePlatformPage("platform:read");
  const tenants = await listAdminTenants(session);

  return (
    <AdminPageFrame
      eyebrow="Platform"
      title="Tenants"
      description={`${tenants.length} districts, schools, and family accounts.`}
    >
      <TenantsTable tenants={tenants} />
    </AdminPageFrame>
  );
}
