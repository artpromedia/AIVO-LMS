import Link from "next/link";
import { redirect } from "next/navigation";
import { requirePageRole, requirePlatformPage } from "@aivo/admin-auth";
import { AdminApiError } from "@aivo/admin-api";
import {
  type AdminModerationStatus,
  getModerationStats,
  listModerationEvents,
  updateModerationEventStatus,
} from "@aivo/admin-api/moderation";
import { AdminCard, AdminMetricCard, AdminPageFrame } from "@aivo/admin-ui";
import { formatDateTime } from "@/components/admin-format";

const STATUSES: AdminModerationStatus[] = [
  "PENDING",
  "APPROVED",
  "REJECTED",
  "ESCALATED",
  "LOW_CONFIDENCE",
];

const DECISIONS: AdminModerationStatus[] = ["APPROVED", "REJECTED", "ESCALATED"];

function actionError(error: unknown): string {
  return error instanceof AdminApiError ? error.message : "Moderation update failed.";
}

async function reviewAction(formData: FormData) {
  "use server";
  const session = await requirePageRole(["platform_admin", "support"]);
  const id = String(formData.get("id") || "");
  const status = String(formData.get("status") || "") as AdminModerationStatus;
  if (!id || !STATUSES.includes(status)) {
    redirect("/platform/safety/moderation?error=Missing%20event%20or%20status.");
  }
  try {
    await updateModerationEventStatus(session, id, status);
  } catch (error) {
    redirect(`/platform/safety/moderation?error=${encodeURIComponent(actionError(error))}`);
  }
  redirect(`/platform/safety/moderation?notice=${encodeURIComponent(`Event marked ${status}.`)}`);
}

export default async function ModerationPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; notice?: string; error?: string }>;
}) {
  const session = await requirePlatformPage("platform:read");
  const params = await searchParams;
  const statusFilter = STATUSES.includes(params.status as AdminModerationStatus)
    ? (params.status as AdminModerationStatus)
    : undefined;

  const [events, stats] = await Promise.all([
    listModerationEvents(session, statusFilter ? { status: statusFilter } : {}),
    getModerationStats(session),
  ]);

  const total = stats.byStatus.reduce((sum, row) => sum + row.count, 0);
  const pending = stats.byStatus.find((row) => row.status.toUpperCase() === "PENDING")?.count ?? 0;
  const escalated =
    stats.byStatus.find((row) => row.status.toUpperCase() === "ESCALATED")?.count ?? 0;

  return (
    <AdminPageFrame
      eyebrow="Platform · Safety"
      title="Moderation queue"
      description="AI tutor content flagged for human review, with a full decision audit trail."
    >
      <section className="mt-8 grid gap-4 md:grid-cols-3">
        <AdminMetricCard label="Flagged total" value={total} />
        <AdminMetricCard label="Pending review" value={pending} />
        <AdminMetricCard label="Escalated" value={escalated} />
      </section>

      <nav className="mt-8 flex flex-wrap gap-2">
        <Link
          className={`admin-filter ${!statusFilter ? "admin-filter-active" : ""}`}
          href="/platform/safety/moderation"
        >
          All
        </Link>
        {STATUSES.map((status) => (
          <Link
            className={`admin-filter ${statusFilter === status ? "admin-filter-active" : ""}`}
            href={`/platform/safety/moderation?status=${status}`}
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
                <th>Flagged</th>
                <th>Reason</th>
                <th>Content</th>
                <th>Tutor / model</th>
                <th>Status</th>
                <th>Decision</th>
              </tr>
            </thead>
            <tbody>
              {events.map((event) => (
                <tr key={event.id}>
                  <td className="text-sm">{formatDateTime(event.createdAt)}</td>
                  <td>
                    <span className="block font-bold">{event.flagReason}</span>
                    {event.flagConfidence !== null ? (
                      <span className="text-sm text-slate-500">
                        {Math.round(event.flagConfidence * 100)}% confidence
                      </span>
                    ) : null}
                  </td>
                  <td className="max-w-sm truncate text-sm" title={event.content}>
                    {event.content || "—"}
                  </td>
                  <td className="text-sm">
                    {event.tutorSku ?? "—"}
                    {event.modelUsed ? (
                      <span className="block text-slate-500">{event.modelUsed}</span>
                    ) : null}
                  </td>
                  <td>
                    <span className="admin-status">{event.status}</span>
                  </td>
                  <td>
                    <form action={reviewAction} className="flex items-center gap-2">
                      <input name="id" type="hidden" value={event.id} />
                      <select className="admin-input" name="status" defaultValue={DECISIONS[0]}>
                        {DECISIONS.map((status) => (
                          <option key={status} value={status}>
                            {status}
                          </option>
                        ))}
                      </select>
                      <button className="admin-action" type="submit">
                        Apply
                      </button>
                    </form>
                  </td>
                </tr>
              ))}
              {events.length === 0 ? (
                <tr>
                  <td className="py-10 text-center text-slate-500" colSpan={6}>
                    No moderation events match this filter.
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
