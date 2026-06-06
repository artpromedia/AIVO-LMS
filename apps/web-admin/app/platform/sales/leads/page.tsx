import Link from "next/link";
import { redirect } from "next/navigation";
import { requirePageRole } from "@aivo/admin-auth";
import { AdminApiError } from "@aivo/admin-api";
import {
  type LeadStatus,
  LEAD_STATUSES,
  listLeads,
  nextLeadStatuses,
  updateLeadStatus,
} from "@aivo/admin-api/leads";
import { AdminCard, AdminPageFrame } from "@aivo/admin-ui";

function actionError(error: unknown): string {
  return error instanceof AdminApiError ? error.message : "Lead update failed.";
}

function formatDate(value: string | null): string {
  if (!value) return "—";
  return new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeStyle: "short" }).format(
    new Date(value),
  );
}

function utmSummary(lead: {
  utmSource: string | null;
  utmMedium: string | null;
  utmCampaign: string | null;
}): string {
  const parts = [lead.utmSource, lead.utmMedium, lead.utmCampaign].filter(Boolean);
  return parts.length ? parts.join(" / ") : "—";
}

async function changeStatusAction(formData: FormData) {
  "use server";
  const session = await requirePageRole(["platform_admin", "sales"]);
  const id = String(formData.get("id") || "");
  const status = String(formData.get("status") || "") as LeadStatus;
  if (!id || !status) {
    redirect("/platform/sales/leads?error=Missing%20lead%20or%20status.");
  }
  try {
    await updateLeadStatus(session, id, status);
  } catch (error) {
    redirect(`/platform/sales/leads?error=${encodeURIComponent(actionError(error))}`);
  }
  redirect(`/platform/sales/leads?notice=${encodeURIComponent(`Lead moved to ${status}.`)}`);
}

export default async function LeadsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; notice?: string; error?: string }>;
}) {
  const session = await requirePageRole(["platform_admin", "sales"]);
  const params = await searchParams;
  const statusFilter = (LEAD_STATUSES as readonly string[]).includes(params.status ?? "")
    ? (params.status as LeadStatus)
    : undefined;
  const leads = await listLeads(session, statusFilter ? { status: statusFilter } : undefined);

  return (
    <AdminPageFrame
      eyebrow="Sales"
      title="Leads"
      description="Website demo, waitlist, and contact leads — with campaign attribution and a status lifecycle (new → contacted → qualified → pilot → won/lost)."
    >
      <nav className="mt-8 flex flex-wrap gap-2">
        <Link
          className={`admin-filter ${!statusFilter ? "admin-filter-active" : ""}`}
          href="/platform/sales/leads"
        >
          All
        </Link>
        {LEAD_STATUSES.map((s) => (
          <Link
            className={`admin-filter ${statusFilter === s ? "admin-filter-active" : ""}`}
            href={`/platform/sales/leads?status=${s}`}
            key={s}
          >
            {s}
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
                <th>Lead</th>
                <th>Type</th>
                <th>Source</th>
                <th>UTM</th>
                <th>Coupon</th>
                <th>Status</th>
                <th>Received</th>
                <th>Move to</th>
              </tr>
            </thead>
            <tbody>
              {leads.map((lead) => {
                const nexts = nextLeadStatuses(lead.status);
                return (
                  <tr key={lead.id}>
                    <td className="font-bold">
                      <span className="block">{lead.name}</span>
                      <span className="text-sm font-normal text-slate-500">{lead.email}</span>
                    </td>
                    <td>{lead.type}</td>
                    <td>{lead.source}</td>
                    <td className="text-sm">{utmSummary(lead)}</td>
                    <td className="text-sm">{lead.couponCode ?? "—"}</td>
                    <td>
                      <span className={`admin-status admin-status-${lead.status}`}>
                        {lead.status}
                      </span>
                    </td>
                    <td className="text-sm">{formatDate(lead.createdAt)}</td>
                    <td>
                      {nexts.length > 0 ? (
                        <form action={changeStatusAction} className="flex items-center gap-2">
                          <input name="id" type="hidden" value={lead.id} />
                          <select className="admin-input" name="status" defaultValue={nexts[0]}>
                            {nexts.map((s) => (
                              <option key={s} value={s}>
                                {s}
                              </option>
                            ))}
                          </select>
                          <button className="admin-action" type="submit">
                            Update
                          </button>
                        </form>
                      ) : (
                        <span className="text-sm text-slate-400">Closed</span>
                      )}
                    </td>
                  </tr>
                );
              })}
              {leads.length === 0 ? (
                <tr>
                  <td className="py-10 text-center text-slate-500" colSpan={8}>
                    No leads match this filter.
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
