import Link from "next/link";
import { requirePageRole } from "@aivo/admin-auth";
import { listScimTokens } from "@aivo/admin-api/scim";
import { AdminCard, AdminPageFrame } from "@aivo/admin-ui";
import { StatusPill } from "@/components/status-pill";
import { formatDateTime } from "@/components/admin-format";

export default async function TenantScimPage({
  params,
}: {
  params: Promise<{ tenantId: string }>;
}) {
  const session = await requirePageRole(["platform_admin"]);
  const { tenantId } = await params;
  const tokens = await listScimTokens(session, tenantId);

  return (
    <AdminPageFrame
      title="SCIM provisioning tokens"
      description={`Directory-sync tokens issued for tenant ${tenantId}.`}
      action={
        <Link className="admin-button admin-button-secondary" href="/platform/identity">
          Back to identity
        </Link>
      }
    >
      <AdminCard className="mt-6 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Prefix</th>
                <th>State</th>
                <th>Last used</th>
                <th>Created</th>
              </tr>
            </thead>
            <tbody>
              {tokens.map((token) => (
                <tr key={token.id}>
                  <td className="font-bold">{token.name}</td>
                  <td className="font-mono text-xs text-slate-500">{token.prefix}</td>
                  <td>
                    <StatusPill status={token.revokedAt ? "revoked" : "active"} />
                  </td>
                  <td className="text-sm tabular-nums">{formatDateTime(token.lastUsedAt)}</td>
                  <td className="text-sm tabular-nums">{formatDateTime(token.createdAt)}</td>
                </tr>
              ))}
              {tokens.length === 0 ? (
                <tr>
                  <td className="py-10 text-center text-slate-500" colSpan={5}>
                    No SCIM tokens issued for this tenant.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </AdminCard>
    </AdminPageFrame>
  );
}
