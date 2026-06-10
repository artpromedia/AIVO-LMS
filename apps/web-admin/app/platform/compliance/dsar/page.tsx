import Link from "next/link";
import { redirect } from "next/navigation";
import { requirePageRole } from "@aivo/admin-auth";
import { AdminApiError } from "@aivo/admin-api";
import {
  type DsarStatus,
  DSAR_STATUSES,
  approveDsar,
  listDsarRequests,
  rejectDsar,
} from "@aivo/admin-api/dsar";
import { AdminCard, AdminKpiCard, AdminPageFrame } from "@aivo/admin-ui";
import { formatDateTime } from "@/components/admin-format";

const DSAR_ROLES = ["platform_admin", "district_admin"] as const;

function actionError(error: unknown): string {
  return error instanceof AdminApiError ? error.message : "DSAR action failed.";
}

async function approveAction(formData: FormData) {
  "use server";
  const session = await requirePageRole([...DSAR_ROLES]);
  const id = String(formData.get("id") || "");
  if (!id) redirect("/platform/compliance/dsar?error=Missing%20request.");
  try {
    await approveDsar(session, id);
  } catch (error) {
    redirect(`/platform/compliance/dsar?error=${encodeURIComponent(actionError(error))}`);
  }
  redirect("/platform/compliance/dsar?notice=Request%20approved.");
}

async function rejectAction(formData: FormData) {
  "use server";
  const session = await requirePageRole([...DSAR_ROLES]);
  const id = String(formData.get("id") || "");
  const reason = String(formData.get("reason") || "").trim() || "not specified";
  if (!id) redirect("/platform/compliance/dsar?error=Missing%20request.");
  try {
    await rejectDsar(session, id, reason);
  } catch (error) {
    redirect(`/platform/compliance/dsar?error=${encodeURIComponent(actionError(error))}`);
  }
  redirect("/platform/compliance/dsar?notice=Request%20rejected.");
}

const SLA_TONE: Record<string, string> = {
  on_track: "text-emerald-700",
  due_soon: "text-amber-700",
  overdue: "text-red-700",
  met: "text-slate-500",
};

const TERMINAL: DsarStatus[] = ["fulfilled", "rejected"];

export default async function DsarQueuePage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; notice?: string; error?: string }>;
}) {
  const session = await requirePageRole([...DSAR_ROLES]);
  const params = await searchParams;
  const statusFilter = DSAR_STATUSES.includes(params.status as DsarStatus)
    ? (params.status as DsarStatus)
    : undefined;
  const { requests, kpis } = await listDsarRequests(session, statusFilter);

  return (
    <AdminPageFrame
      eyebrow="Platform · Compliance"
      title="DSAR queue"
      description="Data subject access requests with statutory SLA timers, backed by data-governance-svc (Postgres)."
    >
      <section className="mt-8 grid gap-4 md:grid-cols-4">
        <AdminKpiCard label="Open" value={kpis.open} />
        <AdminKpiCard label="Overdue" value={kpis.overdue} />
        <AdminKpiCard label="Fulfilled" value={kpis.fulfilled} />
        <AdminCard className="p-5">
          <p className="text-sm font-semibold text-slate-500">Avg fulfillment</p>
          <p className="mt-2 text-3xl font-black">
            {kpis.avgFulfillmentHours === null ? "—" : `${kpis.avgFulfillmentHours}h`}
          </p>
        </AdminCard>
      </section>

      <nav className="mt-8 flex flex-wrap gap-2">
        <Link
          className={`admin-filter ${!statusFilter ? "admin-filter-active" : ""}`}
          href="/platform/compliance/dsar"
        >
          All
        </Link>
        {DSAR_STATUSES.map((status) => (
          <Link
            className={`admin-filter ${statusFilter === status ? "admin-filter-active" : ""}`}
            href={`/platform/compliance/dsar?status=${status}`}
            key={status}
          >
            {status}
          </Link>
        ))}
      </nav>

      {params.notice ? <p className="admin-notice mt-5">{params.notice}</p> : null}
      {params.error ? <p className="admin-error mt-5">{params.error}</p> : null}

      <AdminCard className="mt-6 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Subject</th>
                <th>Type</th>
                <th>Reg.</th>
                <th>Status</th>
                <th>SLA</th>
                <th>Due</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {requests.map((request) => (
                <tr key={request.id}>
                  <td className="font-bold">
                    <Link className="text-blue-700" href={`/platform/compliance/dsar/${request.id}`}>
                      {request.subjectEmail ?? request.subjectId}
                    </Link>
                    {request.onBehalfOfMinor ? (
                      <span className="block text-sm font-normal text-amber-700">on behalf of minor</span>
                    ) : null}
                  </td>
                  <td>{request.type}</td>
                  <td className="text-sm uppercase">{request.regulation}</td>
                  <td>
                    <span className="admin-status">{request.status}</span>
                  </td>
                  <td className={`font-bold uppercase ${SLA_TONE[request.sla.state] ?? ""}`}>
                    {request.sla.state.replace("_", " ")}
                  </td>
                  <td className="text-sm">{formatDateTime(request.fulfillmentDueAt)}</td>
                  <td>
                    {!TERMINAL.includes(request.status) ? (
                      <div className="flex items-center gap-2">
                        <form action={approveAction}>
                          <input name="id" type="hidden" value={request.id} />
                          <button className="admin-action" type="submit">
                            Approve
                          </button>
                        </form>
                        <form action={rejectAction} className="flex items-center gap-1">
                          <input name="id" type="hidden" value={request.id} />
                          <input
                            className="admin-input"
                            name="reason"
                            placeholder="reason"
                            type="text"
                          />
                          <button className="admin-action admin-action-danger" type="submit">
                            Reject
                          </button>
                        </form>
                      </div>
                    ) : (
                      <span className="text-sm text-slate-400">—</span>
                    )}
                  </td>
                </tr>
              ))}
              {requests.length === 0 ? (
                <tr>
                  <td className="py-10 text-center text-slate-500" colSpan={7}>
                    No DSAR requests match this filter.
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
