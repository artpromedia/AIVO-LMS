import { requirePageRole } from "@/lib/auth/server";
import { AppShell } from "@/components/layout/app-shell";
import { PageHeader } from "@/components/layout/page-header";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { PLATFORM_NAV } from "@/components/layout/role-shells";
import { listPlatformWebhookEndpoints } from "@/lib/db/repos";
import type { PlatformWebhookDeliveryStatus, PlatformWebhookStatus } from "@/lib/db/types";

export const dynamic = "force-dynamic";

const STATUS_TONE: Record<PlatformWebhookStatus, "success" | "neutral"> = {
  active: "success",
  disabled: "neutral",
};

const DELIVERY_TONE: Record<PlatformWebhookDeliveryStatus, "success" | "warning" | "danger"> = {
  success: "success",
  pending: "warning",
  failed: "danger",
};

function relativeTime(iso: string | null): string {
  if (!iso) return "never";
  const diffMs = Date.now() - new Date(iso).getTime();
  const mins = Math.round(diffMs / 60_000);
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  return `${days}d ago`;
}

export default async function Page() {
  const session = await requirePageRole(["platform_admin"]);
  const hooks = listPlatformWebhookEndpoints();

  const active = hooks.filter((h) => h.status === "active");
  const failing = hooks.filter((h) => h.lastStatus === "failed").length;
  const totalFailures = hooks.reduce((s, h) => s + h.failureCount, 0);

  const stats = [
    { k: "Active endpoints", v: active.length.toLocaleString() },
    { k: "Disabled", v: (hooks.length - active.length).toLocaleString() },
    { k: "Failing last call", v: failing.toLocaleString() },
    { k: "Total failures", v: totalFailures.toLocaleString() },
  ];

  return (
    <AppShell
      role="platform_admin"
      roleLabel="Platform admin"
      navItems={PLATFORM_NAV}
      user={{ displayName: session.displayName, email: session.email }}
    >
      <PageHeader
        eyebrow="Platform · Settings"
        title="Webhooks"
        description="Outbound HTTPS endpoints we POST to when platform events fire. Each delivery is signed with the endpoint's secret."
      />

      <div className="grid gap-4 md:grid-cols-4">
        {stats.map((s) => (
          <Card key={s.k} className="p-[var(--aivo-density-card-pad)]">
            <p className="text-xs uppercase tracking-wide text-aivo-ink-soft">{s.k}</p>
            <p className="mt-2 font-display text-3xl font-semibold">{s.v}</p>
          </Card>
        ))}
      </div>

      <Card className="mt-6 overflow-hidden p-0">
        {hooks.length === 0 ? (
          <EmptyState
            title="No webhook endpoints configured"
            description="Register an endpoint to receive platform events from systems outside AIVO."
          />
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-aivo-surface-2 text-xs uppercase tracking-wide text-aivo-ink-soft">
              <tr>
                <th className="px-4 py-3 text-left">Endpoint</th>
                <th className="px-4 py-3 text-left">Events</th>
                <th className="px-4 py-3 text-left">Secret</th>
                <th className="px-4 py-3 text-left">Status</th>
                <th className="px-4 py-3 text-left">Last delivery</th>
                <th className="px-4 py-3 text-right">Failures</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-aivo-border">
              {hooks.map((h) => (
                <tr key={h.id} className="hover:bg-aivo-surface-2/40">
                  <td className="px-4 py-3">
                    <div className="font-mono text-xs">{h.url}</div>
                    <div className="mt-1 text-xs text-aivo-ink-soft">{h.description}</div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-1">
                      {h.events.map((e) => (
                        <span
                          key={e}
                          className="rounded bg-aivo-surface-2 px-2 py-0.5 font-mono text-xs"
                        >
                          {e}
                        </span>
                      ))}
                    </div>
                  </td>
                  <td className="px-4 py-3 font-mono text-xs text-aivo-ink-soft">
                    {h.secretPrefix}••••
                  </td>
                  <td className="px-4 py-3">
                    <Badge tone={STATUS_TONE[h.status]}>{h.status}</Badge>
                  </td>
                  <td className="px-4 py-3 text-xs">
                    <div className="text-aivo-ink-soft">{relativeTime(h.lastDeliveryAt)}</div>
                    {h.lastStatus ? (
                      <Badge tone={DELIVERY_TONE[h.lastStatus]}>{h.lastStatus}</Badge>
                    ) : (
                      <span className="text-aivo-ink-soft">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums">
                    {h.failureCount > 0 ? (
                      <span className="text-aivo-danger">{h.failureCount.toLocaleString()}</span>
                    ) : (
                      <span className="text-aivo-ink-soft">0</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
    </AppShell>
  );
}
