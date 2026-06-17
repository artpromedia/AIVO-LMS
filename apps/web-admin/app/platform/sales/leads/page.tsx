import Link from "next/link";
import { redirect } from "next/navigation";
import { requirePageRole } from "@aivo/admin-auth";
import {
  type LeadStatus,
  LEAD_STATUSES,
  listLeadsPage,
  nextLeadStatuses,
  updateLeadStatus,
} from "@aivo/admin-api/leads";
import { AdminPageFrame, DataTable, FlashRegion } from "@aivo/admin-ui";
import { StatusPill } from "@/components/status-pill";
import { actionError } from "@/lib/action-errors";

const PAGE_SIZE = 50;

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
    redirect(`/platform/sales/leads?error=${encodeURIComponent(actionError(error, "Lead update failed."))}`);
  }
  redirect(`/platform/sales/leads?notice=${encodeURIComponent(`Lead moved to ${status}.`)}`);
}

export default async function LeadsPage({
  searchParams,
}: {
  searchParams: Promise<{
    status?: string;
    page?: string;
    q?: string;
    notice?: string;
    error?: string;
  }>;
}) {
  const session = await requirePageRole(["platform_admin", "sales"]);
  const params = await searchParams;
  const statusFilter = (LEAD_STATUSES as readonly string[]).includes(params.status ?? "")
    ? (params.status as LeadStatus)
    : undefined;
  const page = Math.max(1, Number(params.page) || 1);
  const search = params.q?.trim() || undefined;
  const result = await listLeadsPage(session, {
    page,
    pageSize: PAGE_SIZE,
    search,
    status: statusFilter,
  });

  const chipHref = (status?: string) => {
    const qs = new URLSearchParams();
    if (status) qs.set("status", status);
    if (search) qs.set("q", search);
    const tail = qs.toString();
    return `/platform/sales/leads${tail ? `?${tail}` : ""}`;
  };

  return (
    <AdminPageFrame
      title="Leads"
      description={`${result.total.toLocaleString()} website demo, waitlist, and contact leads — with campaign attribution and a status lifecycle (new → contacted → qualified → pilot → won/lost).`}
    >
      <nav className="mt-8 flex flex-wrap gap-2" aria-label="Filter by status">
        <Link
          className={`admin-filter ${!statusFilter ? "admin-filter-active" : ""}`}
          aria-current={!statusFilter ? "true" : undefined}
          href={chipHref()}
        >
          All
        </Link>
        {LEAD_STATUSES.map((s) => (
          <Link
            className={`admin-filter ${statusFilter === s ? "admin-filter-active" : ""}`}
            aria-current={statusFilter === s ? "true" : undefined}
            href={chipHref(s)}
            key={s}
          >
            {s}
          </Link>
        ))}
      </nav>

      <FlashRegion className="mt-5" notice={params.notice} error={params.error} />

      <div className="mt-6">
        <DataTable
          basePath="/platform/sales/leads"
          rows={result.rows}
          rowKey={(row) => row.id}
          total={result.total}
          page={result.page}
          pageSize={result.pageSize}
          search={search}
          extraParams={statusFilter ? { status: statusFilter } : undefined}
          exportHref={`/platform/sales/leads/export${(() => {
            const qs = new URLSearchParams();
            if (search) qs.set("q", search);
            if (statusFilter) qs.set("status", statusFilter);
            const tail = qs.toString();
            return tail ? `?${tail}` : "";
          })()}`}
          emptyMessage="No leads match this filter."
          searchPlaceholder="Search name, email, or company…"
          columns={[
            {
              key: "lead",
              header: "Lead",
              render: (row) => (
                <span>
                  <span className="block font-bold">{row.name}</span>
                  <span className="text-sm font-normal text-slate-500">{row.email}</span>
                </span>
              ),
            },
            { key: "type", header: "Type", render: (row) => row.type },
            { key: "source", header: "Source", render: (row) => row.source },
            { key: "utm", header: "UTM", render: (row) => <span className="text-sm">{utmSummary(row)}</span> },
            {
              key: "coupon",
              header: "Coupon",
              render: (row) => <span className="text-sm">{row.couponCode ?? "—"}</span>,
            },
            {
              key: "status",
              header: "Status",
              render: (row) => <StatusPill status={row.status} />,
            },
            {
              key: "received",
              header: "Received",
              render: (row) => <span className="text-sm">{formatDate(row.createdAt)}</span>,
            },
            {
              key: "move",
              header: "Move to",
              render: (row) => {
                const nexts = nextLeadStatuses(row.status);
                return nexts.length > 0 ? (
                  <form action={changeStatusAction} className="flex items-center gap-2">
                    <input name="id" type="hidden" value={row.id} />
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
                );
              },
            },
          ]}
        />
      </div>
    </AdminPageFrame>
  );
}
