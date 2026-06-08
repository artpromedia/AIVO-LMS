import Link from "next/link";
import { requirePlatformPage } from "@aivo/admin-auth";
import { listTenantInvoices } from "@aivo/admin-api/invoices";
import { AdminCard, AdminPageFrame } from "@aivo/admin-ui";
import { InvoicesTable } from "@/components/admin-tables";

export default async function PlatformInvoicesPage({
  searchParams,
}: {
  searchParams: Promise<{ tenantId?: string }>;
}) {
  const session = await requirePlatformPage("billing:read");
  const { tenantId } = await searchParams;

  if (!tenantId) {
    return (
      <AdminPageFrame
        eyebrow="Platform · Billing"
        title="Invoices"
        description="Stripe invoices, synced to billing-svc."
      >
        <AdminCard className="mt-6 p-6">
          <p className="text-slate-600">
            Select a tenant to view its invoices. Open a tenant from the{" "}
            <Link className="font-bold text-blue-700" href="/platform/tenants">
              tenants list
            </Link>{" "}
            and use its &ldquo;Invoices&rdquo; link.
          </p>
        </AdminCard>
      </AdminPageFrame>
    );
  }

  const invoices = await listTenantInvoices(session, tenantId);

  return (
    <AdminPageFrame
      eyebrow="Platform · Billing"
      title="Invoices"
      description={`Stripe invoices for tenant ${tenantId}.`}
      action={
        <Link className="admin-button admin-button-secondary" href={`/platform/tenants/${tenantId}`}>
          Back to tenant
        </Link>
      }
    >
      <InvoicesTable invoices={invoices} />
    </AdminPageFrame>
  );
}
