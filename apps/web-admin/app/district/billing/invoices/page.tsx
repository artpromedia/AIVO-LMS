import Link from "next/link";
import { requirePageRole } from "@aivo/admin-auth";
import { listTenantInvoices } from "@aivo/admin-api/invoices";
import { AdminPageFrame } from "@aivo/admin-ui";
import { InvoicesTable } from "@/components/admin-tables";

export default async function DistrictInvoicesPage() {
  const session = await requirePageRole(["district_admin", "platform_admin"]);
  const invoices = await listTenantInvoices(session, session.tenantId);

  return (
    <AdminPageFrame
      eyebrow="District · Billing"
      title="Invoices"
      description="Stripe invoices for your district, synced to billing-svc."
      action={
        <Link className="admin-button admin-button-secondary" href="/district/billing">
          Back to billing
        </Link>
      }
    >
      <InvoicesTable invoices={invoices} />
    </AdminPageFrame>
  );
}
