import Link from "next/link";
import { requirePageRole } from "@/lib/auth/server";
import { AppShell } from "@/components/layout/app-shell";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { DISTRICT_NAV } from "@/components/layout/role-shells";
import { getDistrictPool } from "@/lib/billing/district-pool";
import { AllocateForm } from "./allocate-form";

export default async function Page() {
  const session = await requirePageRole(["district_admin"]);
  const districtId = session.tenantId;

  const poolData = getDistrictPool(districtId);

  // Shape pool data for the client component
  const initialPool = {
    pool: {
      districtId: poolData.pool.districtId,
      total: poolData.pool.total,
      allocated: poolData.pool.allocated,
      used: poolData.pool.used,
      unallocated: poolData.unallocated,
    },
    allocations: poolData.allocations,
    unallocated: poolData.unallocated,
  };

  return (
    <AppShell
      role="district_admin"
      roleLabel="District admin"
      navItems={DISTRICT_NAV}
      user={{ displayName: session.displayName, email: session.email }}
    >
      <PageHeader
        eyebrow="District admin · Billing"
        title="Manage Seat Allocations"
        description="Move seats between schools or grant from the unallocated pool."
        actions={
          <Button asChild variant="outline" size="sm">
            <Link href="/admin/district/billing">Back to billing</Link>
          </Button>
        }
      />

      <AllocateForm districtId={districtId} initialPool={initialPool} />
    </AppShell>
  );
}
