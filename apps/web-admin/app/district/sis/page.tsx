import Link from "next/link";
import { redirect } from "next/navigation";
import { requirePageRole } from "@aivo/admin-auth";
import { listSisConnections, triggerSisSync } from "@aivo/admin-api/sis";
import {
  getScimActivity,
  listScimTokens,
  listScimUnmappedGroups,
} from "@aivo/admin-api/scim";
import { AdminCard, AdminPageFrame } from "@aivo/admin-ui";
import { formatDateTime } from "@/components/admin-format";
import { actionError } from "@/lib/action-errors";
import { ScimSection } from "./scim-section";

const SIS_ROLES = ["district_admin", "platform_admin"] as const;

async function syncAction(formData: FormData) {
  "use server";
  const session = await requirePageRole([...SIS_ROLES]);
  const connectionId = String(formData.get("connectionId") || "");
  if (!connectionId) redirect("/district/sis?error=Missing%20connection.");
  try {
    await triggerSisSync(session, connectionId);
  } catch (error) {
    redirect(`/district/sis?error=${encodeURIComponent(actionError(error, "Sync could not be started."))}`);
  }
  redirect("/district/sis?notice=Roster%20sync%20started.");
}

export default async function DistrictSisPage({
  searchParams,
}: {
  searchParams: Promise<{ notice?: string; error?: string }>;
}) {
  const session = await requirePageRole([...SIS_ROLES]);
  const params = await searchParams;
  // Connectors (integration-svc) and SCIM (admin-svc) are independent
  // backends — one being down must not blank the other's section, so
  // each fetch degrades to an explicit error panel instead of throwing.
  const [connectionsResult, scimTokens, scimUnmapped, scimActivity] = await Promise.all([
    listSisConnections(session, session.tenantId).then(
      (rows) => ({ ok: true as const, rows }),
      () => ({ ok: false as const, rows: [] }),
    ),
    listScimTokens(session, session.tenantId),
    listScimUnmappedGroups(session, session.tenantId),
    getScimActivity(session, session.tenantId),
  ]);
  const connections = connectionsResult.rows;

  return (
    <AdminPageFrame
      eyebrow="District"
      title="SIS connectors"
      description="Student information system roster connections (Clever, ClassLink, OneRoster) for your district, backed by integration-svc."
    >
      {params.notice ? <p className="admin-notice mt-8">{params.notice}</p> : null}
      {params.error ? <p className="admin-error mt-8">{params.error}</p> : null}
      {!connectionsResult.ok ? (
        <p className="admin-error mt-8">
          SIS connector status is unavailable right now (integration service unreachable). SCIM
          provisioning below is unaffected.
        </p>
      ) : null}

      <AdminCard className="mt-6 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Connector</th>
                <th>Type</th>
                <th>Status</th>
                <th>External org</th>
                <th>Last sync</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {connections.map((connection) => (
                <tr key={connection.id}>
                  <td className="font-bold">
                    <Link className="text-blue-700" href={`/district/sis/${connection.id}`}>
                      {connection.connectorName}
                    </Link>
                  </td>
                  <td>{connection.connectorType}</td>
                  <td>
                    <span className="admin-status">{connection.status}</span>
                  </td>
                  <td className="text-sm">{connection.externalOrgId ?? "—"}</td>
                  <td className="text-sm">{formatDateTime(connection.lastSyncAt)}</td>
                  <td>
                    <form action={syncAction}>
                      <input name="connectionId" type="hidden" value={connection.id} />
                      <button
                        className="admin-action"
                        disabled={connection.status === "syncing" || connection.status === "disconnected"}
                        type="submit"
                      >
                        Sync now
                      </button>
                    </form>
                  </td>
                </tr>
              ))}
              {connections.length === 0 ? (
                <tr>
                  <td className="py-10 text-center text-slate-500" colSpan={6}>
                    No SIS connectors configured for this district.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </AdminCard>

      <ScimSection tokens={scimTokens} unmappedGroups={scimUnmapped} activity={scimActivity} />
    </AdminPageFrame>
  );
}
