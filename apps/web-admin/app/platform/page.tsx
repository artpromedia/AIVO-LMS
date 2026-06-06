import Link from "next/link";
import { ROLE_LABEL, requirePlatformPage } from "@aivo/admin-auth";
import { getPlatformSystemHealth } from "@aivo/admin-api/platform";
import { AdminCard, AdminMetricCard, AdminPageFrame } from "@aivo/admin-ui";

export default async function PlatformPage() {
  const session = await requirePlatformPage("platform:read");
  const health = await getPlatformSystemHealth(session);

  return (
    <AdminPageFrame
      eyebrow="AIVO Admin"
      title="Platform operations"
      description={`Signed in as ${session.displayName} (${ROLE_LABEL[session.role]}).`}
      action={
        <Link className="admin-button" href="/login">
          Switch account
        </Link>
      }
    >
      <section className="mt-8 grid gap-4 md:grid-cols-4">
        <AdminMetricCard label="Tenants" value={health.tenantsTotal} />
        <AdminMetricCard label="Users" value={health.usersTotal} />
        <AdminMetricCard label="Learners" value={health.learnersTotal} />
        <AdminMetricCard label="AI requests 24h" value={health.aiRequests24h} />
      </section>

      <AdminCard className="mt-6 p-6">
        <h2 className="text-xl font-black">Standalone admin app cutover</h2>
        <p className="mt-2 max-w-3xl text-slate-600">
          This app is isolated from the learner/parent web host and uses identity-svc cookies plus admin-svc reads.
          Remaining admin route relocation should only move screens after their mock data dependencies are removed.
        </p>
      </AdminCard>
    </AdminPageFrame>
  );
}
