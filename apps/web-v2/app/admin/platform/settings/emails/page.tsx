import { requirePageRole } from "@/lib/auth/server";
import { AppShell } from "@/components/layout/app-shell";
import { PageHeader } from "@/components/layout/page-header";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { PLATFORM_NAV } from "@/components/layout/role-shells";
import { listPlatformEmailTemplates } from "@/lib/db/repos";

export const dynamic = "force-dynamic";

function relativeTime(iso: string | null): string {
  if (!iso) return "never";
  const diffMs = Date.now() - new Date(iso).getTime();
  const mins = Math.round(diffMs / 60_000);
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(iso).toLocaleDateString();
}

export default async function Page() {
  const session = await requirePageRole(["platform_admin"]);
  const templates = listPlatformEmailTemplates();

  const active = templates.filter((t) => t.status === "active");
  const totalSends = templates.reduce((s, t) => s + t.sendCount, 0);
  const draftCount = templates.filter((t) => t.status === "draft").length;

  const stats = [
    { k: "Active templates", v: active.length.toLocaleString() },
    { k: "Drafts", v: draftCount.toLocaleString() },
    { k: "All-time sends", v: totalSends.toLocaleString() },
    { k: "Templates", v: templates.length.toLocaleString() },
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
        title="Email templates"
        description="Transactional + lifecycle messages sent through Postmark. Editing copy or routing is reserved for the comms team."
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
        {templates.length === 0 ? (
          <EmptyState
            title="No email templates configured"
            description="Register templates in comms-svc to make them available here."
          />
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-aivo-surface-2 text-xs uppercase tracking-wide text-aivo-ink-soft">
              <tr>
                <th className="px-4 py-3 text-left">Template</th>
                <th className="px-4 py-3 text-left">From</th>
                <th className="px-4 py-3 text-left">Subject</th>
                <th className="px-4 py-3 text-left">Status</th>
                <th className="px-4 py-3 text-right">Sends</th>
                <th className="px-4 py-3 text-left">Last sent</th>
                <th className="px-4 py-3 text-left">Updated</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-aivo-border">
              {templates.map((t) => (
                <tr key={t.id} className="hover:bg-aivo-surface-2/40">
                  <td className="px-4 py-3">
                    <div className="font-medium">{t.name}</div>
                    <div className="font-mono text-xs text-aivo-ink-soft">{t.key}</div>
                    <div className="mt-1 text-xs text-aivo-ink-soft">{t.description}</div>
                  </td>
                  <td className="px-4 py-3 text-xs text-aivo-ink-soft">
                    <div>{t.fromName}</div>
                    <div className="font-mono">{t.fromEmail}</div>
                  </td>
                  <td className="px-4 py-3 text-xs text-aivo-ink-soft">{t.subject}</td>
                  <td className="px-4 py-3">
                    <Badge tone={t.status === "active" ? "success" : "neutral"}>{t.status}</Badge>
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums">
                    {t.sendCount.toLocaleString()}
                  </td>
                  <td className="px-4 py-3 text-xs text-aivo-ink-soft">
                    {relativeTime(t.lastSentAt)}
                  </td>
                  <td className="px-4 py-3 text-xs text-aivo-ink-soft">
                    {new Date(t.updatedAt).toLocaleDateString()}
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
