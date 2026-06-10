import Link from "next/link";
import { redirect } from "next/navigation";
import { requirePageRole } from "@aivo/admin-auth";
import { AdminApiError } from "@aivo/admin-api";
import { getSisConnection, listSisSyncLogs, triggerSisSync } from "@aivo/admin-api/sis";
import { AdminCard, AdminKpiCard, AdminPageFrame } from "@aivo/admin-ui";
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
    redirect(`/district/sis/${connectionId}?error=${encodeURIComponent(actionError(error))}`);
  }
  redirect(`/district/sis/${connectionId}?notice=Roster%20sync%20started.`);
}

export default async function SisConnectionPage({
  params,
  searchParams,
}: {
  params: Promise<{ connectionId: string }>;
  searchParams: Promise<{ notice?: string; error?: string }>;
}) {
  const session = await requirePageRole([...SIS_ROLES]);
  const { connectionId } = await params;
  const query = await searchParams;
  const [connection, logs] = await Promise.all([
    getSisConnection(session, connectionId),
    listSisSyncLogs(session, connectionId),
  ]);

  const lastRun = logs[0] ?? null;

  return (
    <AdminPageFrame
      eyebrow="District · SIS"
      title={connection.connectorName}
      description={`${connection.connectorType} · status ${connection.status}`}
      action={
        <Link className="admin-button admin-button-secondary" href="/district/sis">
          Back to connectors
        </Link>
      }
    >
      {query.notice ? <p className="admin-notice mt-8">{query.notice}</p> : null}
      {query.error ? <p className="admin-error mt-8">{query.error}</p> : null}

      <section className="mt-8 grid gap-4 md:grid-cols-3">
        <AdminCard className="p-5">
          <p className="text-sm font-semibold text-slate-500">Last sync</p>
          <p className="mt-2 text-2xl font-black">{formatDateTime(connection.lastSyncAt)}</p>
        </AdminCard>
        <AdminKpiCard label="Records synced (last run)" value={lastRun?.recordsSynced ?? 0} />
        <AdminKpiCard label="Records failed (last run)" value={lastRun?.recordsFailed ?? 0} />
      </section>

      <AdminCard className="mt-6 p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-xl font-black">Trigger a sync</h2>
            <p className="mt-1 text-slate-600">
              Runs a full roster sync via integration-svc. External org:{" "}
              {connection.externalOrgId ?? "—"}.
            </p>
          </div>
          <form action={syncAction}>
            <input name="connectionId" type="hidden" value={connection.id} />
            <button
              className="admin-button"
              disabled={connection.status === "syncing" || connection.status === "disconnected"}
              type="submit"
            >
              Sync now
            </button>
          </form>
        </div>
      </AdminCard>

      <h2 className="mt-8 text-xl font-black">Sync history</h2>
      <AdminCard className="mt-4 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Started</th>
                <th>Type</th>
                <th>Status</th>
                <th>Synced</th>
                <th>Failed</th>
                <th>Skipped</th>
                <th>Duration</th>
              </tr>
            </thead>
            <tbody>
              {logs.map((log) => (
                <tr key={log.id}>
                  <td className="text-sm">{formatDateTime(log.startedAt)}</td>
                  <td>{log.syncType}</td>
                  <td>
                    <span className="admin-status">{log.status}</span>
                  </td>
                  <td className="text-sm">{log.recordsSynced.toLocaleString()}</td>
                  <td className="text-sm">{log.recordsFailed.toLocaleString()}</td>
                  <td className="text-sm">{log.recordsSkipped.toLocaleString()}</td>
                  <td className="text-sm">{log.durationMs === null ? "—" : `${log.durationMs} ms`}</td>
                </tr>
              ))}
              {logs.length === 0 ? (
                <tr>
                  <td className="py-10 text-center text-slate-500" colSpan={7}>
                    No sync runs recorded yet.
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
