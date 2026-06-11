import Link from "next/link";
import { redirect } from "next/navigation";
import { requirePageRole } from "@aivo/admin-auth";
import {
  approveDsar,
  fulfillDsar,
  getDsarRequest,
  rejectDsar,
  verifyDsarIdentity,
} from "@aivo/admin-api/dsar";
import { recordAdminReadEvents } from "@aivo/admin-api/audit";
import { AdminCard, AdminPageFrame } from "@aivo/admin-ui";
import { formatDateTime } from "@/components/admin-format";
import { actionError } from "@/lib/action-errors";

const DSAR_ROLES = ["platform_admin", "district_admin"] as const;

async function runAction(
  id: string,
  fn: (session: Awaited<ReturnType<typeof requirePageRole>>) => Promise<void>,
  notice: string,
) {
  const session = await requirePageRole([...DSAR_ROLES]);
  try {
    await fn(session);
  } catch (error) {
    redirect(`/platform/compliance/dsar/${id}?error=${encodeURIComponent(actionError(error, "DSAR action failed."))}`);
  }
  redirect(`/platform/compliance/dsar/${id}?notice=${encodeURIComponent(notice)}`);
}

async function verifyAction(formData: FormData) {
  "use server";
  const id = String(formData.get("id") || "");
  await runAction(id, (session) => verifyDsarIdentity(session, id), "Identity verified.");
}

async function approveAction(formData: FormData) {
  "use server";
  const id = String(formData.get("id") || "");
  await runAction(id, (session) => approveDsar(session, id), "Request approved.");
}

async function rejectAction(formData: FormData) {
  "use server";
  const id = String(formData.get("id") || "");
  const reason = String(formData.get("reason") || "").trim() || "not specified";
  await runAction(id, (session) => rejectDsar(session, id, reason), "Request rejected.");
}

async function fulfillAction(formData: FormData) {
  "use server";
  const id = String(formData.get("id") || "");
  const note = String(formData.get("note") || "").trim();
  await runAction(id, (session) => fulfillDsar(session, id, note ? { note } : {}), "Request fulfilled.");
}

export default async function DsarDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ notice?: string; error?: string }>;
}) {
  const session = await requirePageRole([...DSAR_ROLES]);
  const { id } = await params;
  const query = await searchParams;
  const { request, timeline } = await getDsarRequest(session, id);

  // Sprint B4 — a DSAR file is data-subject PII; viewing it is audited.
  await recordAdminReadEvents(session, [
    {
      action: "admin.dsar.viewed",
      resourceType: "dsar_request",
      resourceId: request.id,
      tenantId: request.tenantId,
    },
  ]);

  return (
    <AdminPageFrame
      eyebrow="Platform · Compliance · DSAR"
      title={request.subjectEmail ?? request.subjectId}
      description={`${request.type} · ${request.regulation.toUpperCase()} · status ${request.status}`}
      action={
        <Link className="admin-button admin-button-secondary" href="/platform/compliance/dsar">
          Back to queue
        </Link>
      }
    >
      {query.notice ? <p className="admin-notice mt-8">{query.notice}</p> : null}
      {query.error ? <p className="admin-error mt-8">{query.error}</p> : null}

      <AdminCard className="mt-8 p-6">
        <dl className="grid gap-4 sm:grid-cols-3">
          <div>
            <dt className="text-sm font-semibold text-slate-500">Identity verified</dt>
            <dd className="text-lg font-bold">{request.identityVerified ? "Yes" : "No"}</dd>
          </div>
          <div>
            <dt className="text-sm font-semibold text-slate-500">SLA</dt>
            <dd className="text-lg font-bold uppercase">{request.sla.state.replace("_", " ")}</dd>
          </div>
          <div>
            <dt className="text-sm font-semibold text-slate-500">Fulfillment due</dt>
            <dd className="text-lg font-bold">{formatDateTime(request.fulfillmentDueAt)}</dd>
          </div>
          <div>
            <dt className="text-sm font-semibold text-slate-500">Assignee</dt>
            <dd className="text-lg font-bold">{request.assigneeId ?? "—"}</dd>
          </div>
          <div>
            <dt className="text-sm font-semibold text-slate-500">On behalf of minor</dt>
            <dd className="text-lg font-bold">{request.onBehalfOfMinor ? "Yes" : "No"}</dd>
          </div>
          <div>
            <dt className="text-sm font-semibold text-slate-500">Opened</dt>
            <dd className="text-lg font-bold">{formatDateTime(request.createdAt)}</dd>
          </div>
        </dl>
      </AdminCard>

      <AdminCard className="mt-6 p-6">
        <h2 className="text-xl font-black">Actions</h2>
        <div className="mt-4 flex flex-wrap items-start gap-3">
          {!request.identityVerified ? (
            <form action={verifyAction}>
              <input name="id" type="hidden" value={request.id} />
              <button className="admin-button" type="submit">
                Verify identity
              </button>
            </form>
          ) : null}
          {request.status !== "fulfilled" && request.status !== "rejected" ? (
            <>
              <form action={approveAction}>
                <input name="id" type="hidden" value={request.id} />
                <button className="admin-button" type="submit">
                  Approve
                </button>
              </form>
              <form action={fulfillAction} className="flex items-center gap-2">
                <input name="id" type="hidden" value={request.id} />
                <input className="admin-input" name="note" placeholder="fulfillment note" type="text" />
                <button className="admin-button" type="submit">
                  Mark fulfilled
                </button>
              </form>
              <form action={rejectAction} className="flex items-center gap-2">
                <input name="id" type="hidden" value={request.id} />
                <input className="admin-input" name="reason" placeholder="reject reason" type="text" />
                <button className="admin-button admin-button-secondary" type="submit">
                  Reject
                </button>
              </form>
            </>
          ) : null}
        </div>
      </AdminCard>

      <h2 className="mt-8 text-xl font-black">Timeline</h2>
      <AdminCard className="mt-4 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="admin-table">
            <thead>
              <tr>
                <th>When</th>
                <th>Event</th>
                <th>Actor</th>
              </tr>
            </thead>
            <tbody>
              {timeline.map((event) => (
                <tr key={event.id}>
                  <td className="text-sm">{formatDateTime(event.createdAt)}</td>
                  <td className="font-bold">{event.eventType}</td>
                  <td className="text-sm">
                    {event.actorRole ? `${event.actorRole}` : "system"}
                    {event.actorId ? <span className="block text-slate-500">{event.actorId}</span> : null}
                  </td>
                </tr>
              ))}
              {timeline.length === 0 ? (
                <tr>
                  <td className="py-10 text-center text-slate-500" colSpan={3}>
                    No events recorded.
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
