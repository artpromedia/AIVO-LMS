import Link from "next/link";
import { requirePlatformPage } from "@aivo/admin-auth";
import { getAdminUser } from "@aivo/admin-api/platform";
import { recordAdminReadEvents, type AdminReadEvent } from "@aivo/admin-api/audit";
import { AdminCard, AdminPageFrame } from "@aivo/admin-ui";
import { LearnersTable } from "@/components/admin-tables";
import { formatDate, formatDateTime } from "@/components/admin-format";

export default async function UserDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await requirePlatformPage("platform:read");
  const { id } = await params;
  const user = await getAdminUser(session, id);

  // Sprint B4 — this page renders PII (and the linked learners' rows), so
  // the view itself is audited: one user event plus one per child shown.
  await recordAdminReadEvents(session, [
    {
      action: "admin.user.viewed",
      resourceType: "user",
      resourceId: user.id,
      tenantId: user.tenantId,
    },
    ...user.learners.map(
      (learner): AdminReadEvent => ({
        action: "admin.learner.viewed",
        resourceType: "learner",
        resourceId: learner.id,
        tenantId: learner.tenantId ?? user.tenantId,
      }),
    ),
  ]);

  return (
    <AdminPageFrame
      eyebrow="Platform · User"
      title={user.name}
      description={`${user.roleLabel} · ${user.email ?? "no email"}`}
      action={
        <Link className="admin-button admin-button-secondary" href="/platform/users">
          Back to users
        </Link>
      }
    >
      <AdminCard className="mt-8 p-6">
        <dl className="grid gap-4 sm:grid-cols-3">
          <div>
            <dt className="text-sm font-semibold text-slate-500">Email verified</dt>
            <dd className="text-lg font-bold">{user.emailVerified ? "Yes" : "No"}</dd>
          </div>
          <div>
            <dt className="text-sm font-semibold text-slate-500">Active sessions</dt>
            <dd className="text-lg font-bold">{user.activeSessions ?? 0}</dd>
          </div>
          <div>
            <dt className="text-sm font-semibold text-slate-500">Tenant</dt>
            <dd className="text-lg font-bold">{user.tenant?.name ?? user.tenantId ?? "—"}</dd>
          </div>
          <div>
            <dt className="text-sm font-semibold text-slate-500">Last login</dt>
            <dd className="text-lg font-bold">{formatDateTime(user.lastLoginAt)}</dd>
          </div>
          <div>
            <dt className="text-sm font-semibold text-slate-500">Last login IP</dt>
            <dd className="text-lg font-bold">{user.lastLoginIp ?? "—"}</dd>
          </div>
          <div>
            <dt className="text-sm font-semibold text-slate-500">Created</dt>
            <dd className="text-lg font-bold">{formatDate(user.createdAt)}</dd>
          </div>
        </dl>
      </AdminCard>

      {user.learners.length > 0 ? (
        <>
          <h2 className="mt-8 text-xl font-black">Linked learners</h2>
          <LearnersTable learners={user.learners} />
        </>
      ) : null}
    </AdminPageFrame>
  );
}
