import { requirePageRole } from "@aivo/admin-auth";
import { listBillingAccounts } from "@aivo/admin-api/billing";
import { AdminPageFrame } from "@aivo/admin-ui";
import { BillingAccountsTable } from "@/components/admin-tables";

export default async function SchoolBillingPage() {
  const session = await requirePageRole(["school_admin", "district_admin", "platform_admin"]);
  const accounts = await listBillingAccounts(session);

  return (
    <AdminPageFrame
      eyebrow="School"
      title="Billing"
      description="Subscription and seat status for your school."
    >
      <BillingAccountsTable accounts={accounts} />
    </AdminPageFrame>
  );
}
