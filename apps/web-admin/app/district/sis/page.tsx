import Link from "next/link";
import { redirect } from "next/navigation";
import { requirePageRole } from "@aivo/admin-auth";
import { AdminApiError } from "@aivo/admin-api";
import { listSisConnections, triggerSisSync } from "@aivo/admin-api/sis";
import { AdminCard, AdminPageFrame } from "@aivo/admin-ui";
import { formatDateTime } from "@/components/admin-format";

const SIS_ROLES = ["district_admin", "platform_admin"] as const;

function actionError(error: unknown): string {
  return error instanceof AdminApiError ? error.message : "Sync could not be started.";
}

async function syncAction(formData: FormData) {
  "use server";
  const session = await requirePageRole([...SIS_ROLES]);
  const connectionId = String(formData.get("connectionId") || "");
  if (!connectionId) redirect("/district/sis?error=Missing%20connection.");
  try {
    await triggerSisSync(session, connectionId);
  } catch (error) {
    redirect(`/district/sis?error=${encodeURIComponent(actionError(error))}`);
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
  const connections = await listSisConnections(session, session.tenantId);

  return (
    <AdminPageFrame
      eyebrow="District"
      title="SIS connectors"
      description="Student information system roster connections (Clever, ClassLink, OneRoster) for your district, backed by integration-svc."
    >
      {params.notice ? <p className="admin-notice mt-8">{params.notice}</p> : null}
      {params.error ? <p className="admin-error mt-8">{params.error}</p> : null}

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
    </AdminPageFrame>
  );
}
