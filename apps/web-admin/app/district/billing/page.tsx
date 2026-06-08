import { requirePageRole } from "@aivo/admin-auth";
import { getTrialConversion, listBillingAccounts } from "@aivo/admin-api/billing";
import { AdminPageFrame } from "@aivo/admin-ui";
import { BillingAccountsTable, TrialMetrics } from "@/components/admin-tables";

export default async function DistrictBillingPage() {
  const session = await requirePageRole(["district_admin", "platform_admin"]);
  const [accounts, trials] = await Promise.all([
    listBillingAccounts(session),
    getTrialConversion(session),
  ]);

  return (
    <AdminPageFrame
      eyebrow="District"
      title="Billing"
      description="Subscription accounts and trial conversion for your district."
    >
      <TrialMetrics report={trials} />
      <BillingAccountsTable accounts={accounts} />
    </AdminPageFrame>
  );
}
