import Link from "next/link";
import { requirePageRole } from "@aivo/admin-auth";
import { listTenantInvoices } from "@aivo/admin-api/invoices";
import { AdminPageFrame } from "@aivo/admin-ui";
import { InvoicesTable } from "@/components/admin-tables";

export default async function SchoolInvoicesPage() {
  const session = await requirePageRole(["school_admin", "district_admin", "platform_admin"]);
  const invoices = await listTenantInvoices(session, session.tenantId);

  return (
    <AdminPageFrame
      eyebrow="School · Billing"
      title="Invoices"
      description="Stripe invoices for your school, synced to billing-svc."
      action={
        <Link className="admin-button admin-button-secondary" href="/school/billing">
          Back to billing
        </Link>
      }
    >
      <InvoicesTable invoices={invoices} />
    </AdminPageFrame>
  );
}
