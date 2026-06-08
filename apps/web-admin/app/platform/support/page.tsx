import Link from "next/link";
import { redirect } from "next/navigation";
import { requirePageRole } from "@aivo/admin-auth";
import { AdminApiError } from "@aivo/admin-api";
import {
  type SupportTicketStatus,
  SUPPORT_TICKET_STATUSES,
  listSupportTickets,
  updateSupportTicket,
} from "@aivo/admin-api/support";
import { AdminCard, AdminMetricCard, AdminPageFrame } from "@aivo/admin-ui";
import { formatDateTime } from "@/components/admin-format";

const SUPPORT_ROLES = ["platform_admin", "support"] as const;

function actionError(error: unknown): string {
  return error instanceof AdminApiError ? error.message : "Ticket action failed.";
}

async function statusAction(formData: FormData) {
  "use server";
  const session = await requirePageRole([...SUPPORT_ROLES]);
  const id = String(formData.get("id") || "");
  const status = String(formData.get("status") || "") as SupportTicketStatus;
  if (!id || !SUPPORT_TICKET_STATUSES.includes(status)) {
    redirect("/platform/support?error=Missing%20ticket%20or%20status.");
  }
  try {
    await updateSupportTicket(session, id, { status });
  } catch (error) {
    redirect(`/platform/support?error=${encodeURIComponent(actionError(error))}`);
  }
  redirect("/platform/support?notice=Ticket%20updated.");
}

const STATUS_TONE: Record<SupportTicketStatus, string> = {
  open: "text-red-700",
  in_progress: "text-amber-700",
  resolved: "text-emerald-700",
};

export default async function SupportPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; notice?: string; error?: string }>;
}) {
  const session = await requirePageRole([...SUPPORT_ROLES]);
  const params = await searchParams;
  const statusFilter = SUPPORT_TICKET_STATUSES.includes(params.status as SupportTicketStatus)
    ? (params.status as SupportTicketStatus)
    : undefined;
  const tickets = await listSupportTickets(session, statusFilter);

  const open = tickets.filter((t) => t.status === "open").length;
  const inProgress = tickets.filter((t) => t.status === "in_progress").length;

  return (
    <AdminPageFrame
      eyebrow="Platform"
      title="Support tickets"
      description="Customer support queue, persisted in admin-svc (Postgres)."
    >
      {params.notice ? <p className="admin-notice mt-8">{params.notice}</p> : null}
      {params.error ? <p className="admin-error mt-8">{params.error}</p> : null}

      <section className="mt-8 grid gap-4 md:grid-cols-3">
        <AdminMetricCard label="Total" value={tickets.length} />
        <AdminMetricCard label="Open" value={open} />
        <AdminMetricCard label="In progress" value={inProgress} />
      </section>

      <nav className="mt-8 flex flex-wrap gap-2">
        <Link
          className={`admin-filter ${!statusFilter ? "admin-filter-active" : ""}`}
          href="/platform/support"
        >
          All
        </Link>
        {SUPPORT_TICKET_STATUSES.map((status) => (
          <Link
            className={`admin-filter ${statusFilter === status ? "admin-filter-active" : ""}`}
            href={`/platform/support?status=${status}`}
            key={status}
          >
            {status.replace("_", " ")}
          </Link>
        ))}
      </nav>

      <AdminCard className="mt-6 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Subject</th>
                <th>Tenant</th>
                <th>Status</th>
                <th>Opened</th>
                <th>Set status</th>
              </tr>
            </thead>
            <tbody>
              {tickets.map((ticket) => (
                <tr key={ticket.id}>
                  <td className="font-bold">
                    {ticket.subject}
                    {ticket.body ? (
                      <span className="block max-w-md truncate text-sm font-normal text-slate-500">
                        {ticket.body}
                      </span>
                    ) : null}
                  </td>
                  <td className="text-sm">{ticket.tenantId ?? "platform"}</td>
                  <td className={`font-bold uppercase ${STATUS_TONE[ticket.status]}`}>
                    {ticket.status.replace("_", " ")}
                  </td>
                  <td className="text-sm">{formatDateTime(ticket.createdAt)}</td>
                  <td>
                    <form action={statusAction} className="flex items-center gap-2">
                      <input name="id" type="hidden" value={ticket.id} />
                      <select className="admin-input" name="status" defaultValue={ticket.status}>
                        {SUPPORT_TICKET_STATUSES.map((status) => (
                          <option key={status} value={status}>
                            {status.replace("_", " ")}
                          </option>
                        ))}
                      </select>
                      <button className="admin-action" type="submit">
                        Save
                      </button>
                    </form>
                  </td>
                </tr>
              ))}
              {tickets.length === 0 ? (
                <tr>
                  <td className="py-10 text-center text-slate-500" colSpan={5}>
                    No support tickets match this filter.
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
