import Link from "next/link";
import { requirePageRole } from "@/lib/auth/server";
import { AppShell } from "@/components/layout/app-shell";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { DISTRICT_NAV } from "@/components/layout/role-shells";
import { listDistrictInvoices } from "@/lib/billing/district-pool";
import { InvoiceTable } from "@/components/admin/billing/invoice-table";

export default async function Page() {
  const session = await requirePageRole(["district_admin"]);
  const districtId = session.tenantId;

  const invoices = listDistrictInvoices(districtId);

  return (
    <AppShell
      role="district_admin"
      roleLabel="District admin"
      navItems={DISTRICT_NAV}
      user={{ displayName: session.displayName, email: session.email }}
    >
      <PageHeader
        eyebrow="District admin · Billing"
        title="Invoices"
        description={`All invoices for your district. ${invoices.length} invoice${invoices.length === 1 ? "" : "s"} found.`}
        actions={
          <Button asChild variant="outline" size="sm">
            <Link href="/admin/district/billing">Back to billing</Link>
          </Button>
        }
      />

      <InvoiceTable invoices={invoices} districtId={districtId} />
    </AppShell>
  );
}
