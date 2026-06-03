import Link from "next/link";
import { requirePageRole } from "@/lib/auth/server";
import { AppShell } from "@/components/layout/app-shell";
import { PageHeader } from "@/components/layout/page-header";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { PLATFORM_NAV } from "@/components/layout/role-shells";
import { listSchedules } from "@/lib/services/reports-svc";

export const dynamic = "force-dynamic";

function fmt(iso?: string): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export default async function Page() {
  const session = await requirePageRole(["platform_admin"]);
  const scope = { role: session.role, tenantId: session.tenantId, actorId: session.userId };
  const schedules = await listSchedules(scope);

  return (
    <AppShell
      role={session.role}
      roleLabel="Platform admin"
      navItems={PLATFORM_NAV}
      user={{ displayName: session.displayName, email: session.email }}
    >
      <PageHeader
        eyebrow="Platform · Reports"
        title="Report schedules"
        description="Recurring report deliveries across your scope."
        actions={
          <Link
            href="/admin/platform/reports"
            className="inline-flex h-11 items-center rounded-full border border-iw-border bg-iw-raised px-5 text-sm font-semibold"
          >
            Back to reports
          </Link>
        }
      />
      <Card className="overflow-hidden p-0">
        {schedules.length === 0 ? (
          <EmptyState
            title="No schedules"
            description="No recurring report deliveries are configured yet."
          />
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-iw-card-soft text-xs uppercase tracking-wide text-iw-ink-muted">
              <tr>
                <th className="px-4 py-3 text-left">Report</th>
                <th className="px-4 py-3 text-left">Cron</th>
                <th className="px-4 py-3 text-left">Recipients</th>
                <th className="px-4 py-3 text-left">Format</th>
                <th className="px-4 py-3 text-left">Created</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-iw-border">
              {schedules.map((s, i: number) => (
                <tr key={s?.id ?? i} className="hover:bg-iw-card-soft/40">
                  <td className="px-4 py-3 font-medium text-iw-ink">
                    {s?.reportId ?? s?.report ?? "—"}
                  </td>
                  <td className="px-4 py-3 font-mono text-xs text-iw-ink-muted">
                    {s?.cron ?? "—"}
                  </td>
                  <td className="px-4 py-3 tabular-nums text-iw-ink-muted">
                    {Array.isArray(s?.recipients) ? s.recipients.length : 0}
                  </td>
                  <td className="px-4 py-3 uppercase text-iw-ink-muted">{s?.format ?? "—"}</td>
                  <td className="px-4 py-3 text-xs text-iw-ink-muted">{fmt(s?.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
    </AppShell>
  );
}
