import Link from "next/link";
import { requirePlatformPage } from "@aivo/admin-auth";
import { getTrialConversion, listBillingAccounts } from "@aivo/admin-api/billing";
import { AdminPageFrame } from "@aivo/admin-ui";
import { BillingAccountsTable, TrialMetrics } from "@/components/admin-tables";

export default async function PlatformBillingPage() {
  const session = await requirePlatformPage("billing:read");
  const [accounts, trials] = await Promise.all([
    listBillingAccounts(session),
    getTrialConversion(session),
  ]);

  return (
    <AdminPageFrame
      title="Billing"
      description="Subscription accounts and trial conversion, backed by billing-svc."
      action={
        <Link className="admin-button admin-button-secondary" href="/platform/billing/coupons">
          Manage coupons
        </Link>
      }
    >
      <TrialMetrics report={trials} />
      <BillingAccountsTable accounts={accounts} />
    </AdminPageFrame>
  );
}
