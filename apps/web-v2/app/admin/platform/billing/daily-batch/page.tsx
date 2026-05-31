import { getTranslations } from "next-intl/server";
import { requirePageRole } from "@/lib/auth/server";
import { AppShell } from "@/components/layout/app-shell";
import { PageHeader } from "@/components/layout/page-header";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { PLATFORM_NAV } from "@/components/layout/role-shells";
import { listDailyBillingBatches } from "@/lib/db/repos";
import type { DailyBillingBatchStatus } from "@/lib/db/types";

export const dynamic = "force-dynamic";

const STATUS_TONE: Record<DailyBillingBatchStatus, "success" | "warning" | "danger" | "neutral"> = {
  scheduled: "neutral",
  running: "warning",
  success: "success",
  partial: "warning",
  failed: "danger",
};

function formatCents(cents: number): string {
  return `$${(cents / 100).toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
}

function formatRunDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

function formatRange(startIso: string, endIso: string | null): string {
  const start = new Date(startIso);
  const startStr = start.toLocaleTimeString(undefined, {
    hour: "2-digit",
    minute: "2-digit",
  });
  if (!endIso) return `${startStr} → still running`;
  const end = new Date(endIso);
  const durMs = end.getTime() - start.getTime();
  const mins = Math.round(durMs / 60_000);
  return `${startStr} · ${mins} min`;
}

export default async function Page() {
  const session = await requirePageRole(["platform_admin"]);
  const t = await getTranslations("admin.platform_billing_daily_batch");
  const batches = listDailyBillingBatches();

  const last30 = batches.slice(0, 30);
  const successCount = last30.filter((b) => b.status === "success").length;
  const failedCount = last30.filter((b) => b.status === "failed" || b.status === "partial").length;
  const totalInvoices = last30.reduce((s, b) => s + b.invoicesGenerated, 0);
  const totalAmount = last30.reduce((s, b) => s + b.totalAmountCents, 0);

  const stats = [
    { k: "Recent runs", v: last30.length.toLocaleString() },
    { k: "Clean successes", v: successCount.toLocaleString() },
    { k: "Failed / partial", v: failedCount.toLocaleString() },
    { k: "Invoices generated", v: totalInvoices.toLocaleString() },
    { k: "Total billed", v: formatCents(totalAmount) },
  ];

  return (
    <AppShell
      role="platform_admin"
      roleLabel="Platform admin"
      navItems={PLATFORM_NAV}
      user={{ displayName: session.displayName, email: session.email }}
    >
      <PageHeader
        eyebrow="Platform · Billing"
        title={t("title")}
        description="The 02:00 UTC job that closes the previous day's metered usage and generates invoices for every active subscription."
      />

      <div className="grid gap-4 md:grid-cols-5">
        {stats.map((s) => (
          <Card key={s.k} className="p-[var(--aivo-density-card-pad)]">
            <p className="text-xs uppercase tracking-wide text-aivo-ink-soft">{s.k}</p>
            <p className="mt-2 font-display text-2xl font-semibold">{s.v}</p>
          </Card>
        ))}
      </div>

      <Card className="mt-6 overflow-hidden p-0">
        {batches.length === 0 ? (
          <EmptyState
            title={t("empty_title")}
            description="The first daily batch will appear once the 02:00 UTC scheduler has fired."
          />
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-aivo-surface-2 text-xs uppercase tracking-wide text-aivo-ink-soft">
              <tr>
                <th className="px-4 py-3 text-left">{t("col_run_date")}</th>
                <th className="px-4 py-3 text-left">{t("col_window")}</th>
                <th className="px-4 py-3 text-left">{t("col_status")}</th>
                <th className="px-4 py-3 text-right">{t("col_generated")}</th>
                <th className="px-4 py-3 text-right">{t("col_failed")}</th>
                <th className="px-4 py-3 text-right">{t("col_total_billed")}</th>
                <th className="px-4 py-3 text-left">Notes</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-aivo-border">
              {batches.map((b) => (
                <tr key={b.id} className="hover:bg-aivo-surface-2/40">
                  <td className="px-4 py-3 font-medium">{formatRunDate(b.runDate)}</td>
                  <td className="px-4 py-3 text-xs text-aivo-ink-soft">
                    {formatRange(b.startedAt, b.finishedAt)}
                  </td>
                  <td className="px-4 py-3">
                    <Badge tone={STATUS_TONE[b.status]}>{b.status}</Badge>
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums">
                    {b.invoicesGenerated.toLocaleString()}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums">
                    {b.invoicesFailed > 0 ? (
                      <span className="text-aivo-danger">{b.invoicesFailed.toLocaleString()}</span>
                    ) : (
                      <span className="text-aivo-ink-soft">0</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums">
                    {formatCents(b.totalAmountCents)}
                  </td>
                  <td className="px-4 py-3 text-xs text-aivo-ink-soft">{b.errorMessage ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
    </AppShell>
  );
}
