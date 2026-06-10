import Link from "next/link";
import { requirePlatformPage } from "@aivo/admin-auth";
import { getAdminTenant } from "@aivo/admin-api/platform";
import { AdminCard, AdminKpiCard, AdminPageFrame } from "@aivo/admin-ui";
import { LearnersTable, UsersTable } from "@/components/admin-tables";
import { formatDate } from "@/components/admin-format";

export default async function TenantDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await requirePlatformPage("platform:read");
  const { id } = await params;
  const tenant = await getAdminTenant(session, id);

  return (
    <AdminPageFrame
      eyebrow="Platform · Tenant"
      title={tenant.name}
      description={`${tenant.typeLabel} · created ${formatDate(tenant.createdAt)}`}
      action={
        <div className="flex flex-wrap gap-2">
          <Link className="admin-button" href={`/platform/billing/invoices?tenantId=${tenant.id}`}>
            Invoices
          </Link>
          <Link className="admin-button admin-button-secondary" href="/platform/tenants">
            Back to tenants
          </Link>
        </div>
      }
    >
      <section className="mt-8 grid gap-4 md:grid-cols-3">
        <AdminKpiCard label="Users" value={tenant.userCount} />
        <AdminKpiCard label="Learners" value={tenant.learnerCount} />
        <AdminCard className="p-5">
          <p className="text-sm font-semibold text-slate-500">Status</p>
          <p className="mt-2 text-2xl font-black">{tenant.status ?? "—"}</p>
        </AdminCard>
      </section>

      <h2 className="mt-8 text-xl font-black">Users</h2>
      <UsersTable users={tenant.users} />

      <h2 className="mt-8 text-xl font-black">Learners</h2>
      <LearnersTable learners={tenant.learners} />
    </AdminPageFrame>
  );
}
