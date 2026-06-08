import Link from "next/link";
import { redirect } from "next/navigation";
import { requirePageRole } from "@aivo/admin-auth";
import { AdminApiError } from "@aivo/admin-api";
import {
  type EmailStatus,
  EMAIL_STATUSES,
  listOutboxEmails,
  retryOutboxEmail,
} from "@aivo/admin-api/platform-settings";
import { AdminCard, AdminMetricCard, AdminPageFrame } from "@aivo/admin-ui";
import { formatDateTime } from "@/components/admin-format";

function actionError(error: unknown): string {
  return error instanceof AdminApiError ? error.message : "Retry failed.";
}

async function retryAction(formData: FormData) {
  "use server";
  const session = await requirePageRole(["platform_admin"]);
  const id = String(formData.get("id") || "");
  if (!id) redirect("/platform/settings/emails?error=Missing%20email.");
  try {
    await retryOutboxEmail(session, id);
  } catch (error) {
    redirect(`/platform/settings/emails?error=${encodeURIComponent(actionError(error))}`);
  }
  redirect("/platform/settings/emails?notice=Email%20requeued.");
}

const STATUS_TONE: Record<EmailStatus, string> = {
  pending: "text-amber-700",
  sent: "text-emerald-700",
  failed: "text-red-700",
};

export default async function EmailsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; notice?: string; error?: string }>;
}) {
  const session = await requirePageRole(["platform_admin"]);
  const params = await searchParams;
  const statusFilter = EMAIL_STATUSES.includes(params.status as EmailStatus)
    ? (params.status as EmailStatus)
    : undefined;
  const { counts, emails } = await listOutboxEmails(session, statusFilter);

  return (
    <AdminPageFrame
      eyebrow="Platform · Settings"
      title="Email delivery"
      description="Transactional email outbox — delivery status, retries, and failures, read from email_outbox (Postgres)."
    >
      {params.notice ? <p className="admin-notice mt-8">{params.notice}</p> : null}
      {params.error ? <p className="admin-error mt-8">{params.error}</p> : null}

      <section className="mt-8 grid gap-4 md:grid-cols-3">
        <AdminMetricCard label="Pending" value={counts.pending ?? 0} />
        <AdminMetricCard label="Sent" value={counts.sent ?? 0} />
        <AdminMetricCard label="Failed" value={counts.failed ?? 0} />
      </section>

      <nav className="mt-8 flex flex-wrap gap-2">
        <Link
          className={`admin-filter ${!statusFilter ? "admin-filter-active" : ""}`}
          href="/platform/settings/emails"
        >
          All
        </Link>
        {EMAIL_STATUSES.map((status) => (
          <Link
            className={`admin-filter ${statusFilter === status ? "admin-filter-active" : ""}`}
            href={`/platform/settings/emails?status=${status}`}
            key={status}
          >
            {status}
          </Link>
        ))}
      </nav>

      <AdminCard className="mt-6 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="admin-table">
            <thead>
              <tr>
                <th>To</th>
                <th>Subject</th>
                <th>Kind</th>
                <th>Status</th>
                <th>Attempts</th>
                <th>Created</th>
                <th>Last error</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {emails.map((email) => (
                <tr key={email.id}>
                  <td className="font-bold">{email.toEmail}</td>
                  <td className="text-sm">{email.subject ?? email.templateAlias ?? "—"}</td>
                  <td className="text-sm">{email.sendKind}</td>
                  <td className={`font-bold uppercase ${STATUS_TONE[email.status]}`}>{email.status}</td>
                  <td className="text-sm">
                    {email.attempt}/{email.maxAttempts}
                  </td>
                  <td className="text-sm">{formatDateTime(email.createdAt)}</td>
                  <td className="max-w-xs truncate text-sm text-red-700" title={email.lastError ?? ""}>
                    {email.lastError ?? "—"}
                  </td>
                  <td>
                    {email.status === "failed" ? (
                      <form action={retryAction}>
                        <input name="id" type="hidden" value={email.id} />
                        <button className="admin-action" type="submit">
                          Retry
                        </button>
                      </form>
                    ) : null}
                  </td>
                </tr>
              ))}
              {emails.length === 0 ? (
                <tr>
                  <td className="py-10 text-center text-slate-500" colSpan={8}>
                    No emails match this filter.
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
