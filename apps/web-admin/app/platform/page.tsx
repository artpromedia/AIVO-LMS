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
        <div className="flex flex-wrap gap-2">
          {session.role === "platform_admin" ? (
            <Link className="admin-button" href="/platform/districts/new">
              Onboard district
            </Link>
          ) : null}
          <Link className="admin-button admin-button-secondary" href="/login">
            Switch account
          </Link>
        </div>
      }
    >
      <section className="mt-8 grid gap-4 md:grid-cols-4">
        <AdminMetricCard label="Tenants" value={health.tenantsTotal} />
        <AdminMetricCard label="Users" value={health.usersTotal} />
        <AdminMetricCard label="Learners" value={health.learnersTotal} />
        <AdminMetricCard label="AI requests 24h" value={health.aiRequests24h} />
      </section>

      <AdminCard className="mt-6 p-6">
        <h2 className="text-xl font-black">Secure district onboarding</h2>
        <p className="mt-2 max-w-3xl text-slate-600">
          Platform admins can create a district, invite its first administrator without a temporary password,
          and manage the invitation lifecycle from this standalone console.
        </p>
        {session.role === "platform_admin" ? (
          <Link className="mt-4 inline-flex font-bold text-blue-700" href="/platform/districts">
            View district invitations
          </Link>
        ) : null}
      </AdminCard>
    </AdminPageFrame>
  );
}
