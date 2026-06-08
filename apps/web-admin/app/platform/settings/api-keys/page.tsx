import { requirePlatformPage } from "@aivo/admin-auth";
import { listAdminApiKeys } from "@aivo/admin-api/api-keys";
import { AdminCard, AdminPageFrame } from "@aivo/admin-ui";
import { formatDate, formatDateTime } from "@/components/admin-format";

function keyState(key: {
  revokedAt: string | null;
  expiresAt: string | null;
}): string {
  if (key.revokedAt) return "revoked";
  if (key.expiresAt && new Date(key.expiresAt).getTime() < Date.now()) return "expired";
  return "active";
}

export default async function ApiKeysPage() {
  const session = await requirePlatformPage("platform:read");
  const keys = await listAdminApiKeys(session);

  return (
    <AdminPageFrame
      eyebrow="Platform · Settings"
      title="API keys"
      description="Service and integration credentials, including rotation and grace-period status."
    >
      <AdminCard className="mt-6 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Prefix</th>
                <th>Scopes</th>
                <th>State</th>
                <th>Last used</th>
                <th>Expires</th>
                <th>Created</th>
              </tr>
            </thead>
            <tbody>
              {keys.map((key) => (
                <tr key={key.id}>
                  <td className="font-bold">{key.name}</td>
                  <td className="font-mono text-xs text-slate-500">{key.keyPrefix}</td>
                  <td className="text-sm">{key.scopes.length ? key.scopes.join(", ") : "—"}</td>
                  <td>
                    <span className="admin-status">{keyState(key)}</span>
                  </td>
                  <td className="text-sm">{formatDateTime(key.lastUsedAt)}</td>
                  <td className="text-sm">{formatDate(key.expiresAt)}</td>
                  <td className="text-sm">{formatDate(key.createdAt)}</td>
                </tr>
              ))}
              {keys.length === 0 ? (
                <tr>
                  <td className="py-10 text-center text-slate-500" colSpan={7}>
                    No API keys issued.
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
