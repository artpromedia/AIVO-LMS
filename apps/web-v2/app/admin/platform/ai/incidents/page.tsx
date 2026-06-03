import Link from "next/link";
import { requirePageRole } from "@/lib/auth/server";
import { AppShell } from "@/components/layout/app-shell";
import { PageHeader } from "@/components/layout/page-header";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { PLATFORM_NAV } from "@/components/layout/role-shells";
import { listIncidents, listModels } from "@/lib/services/responsible-ai-svc";

export const dynamic = "force-dynamic";

function severityTone(s: string): "danger" | "warning" | "neutral" {
  if (s === "critical" || s === "high") return "danger";
  if (s === "medium") return "warning";
  return "neutral";
}

function stateTone(s: string): "success" | "warning" | "neutral" {
  if (s === "resolved" || s === "closed") return "success";
  if (s === "investigating" || s === "open") return "warning";
  return "neutral";
}

export default async function Page() {
  const session = await requirePageRole(["platform_admin"]);
  const [incidents, models] = await Promise.all([listIncidents(), listModels()]);
  const modelName = new Map(models.map((m) => [m.id, m.name]));

  return (
    <AppShell
      role={session.role}
      roleLabel="Platform admin"
      navItems={PLATFORM_NAV}
      user={{ displayName: session.displayName, email: session.email }}
    >
      <PageHeader
        eyebrow="Platform · Responsible AI"
        title="AI incidents"
        description="Reported model safety incidents and their resolution state."
        actions={
          <span className="inline-flex h-11 items-center rounded-full bg-iw-primary px-5 text-sm font-semibold text-iw-primary-fg">
            File incident
          </span>
        }
      />

      <Card className="overflow-hidden p-0">
        {incidents.length === 0 ? (
          <EmptyState title="No incidents" description="No AI incidents have been reported." />
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-aivo-surface-2 text-xs uppercase tracking-wide text-aivo-ink-soft">
              <tr>
                <th className="px-4 py-3 text-left">Title</th>
                <th className="px-4 py-3 text-left">Severity</th>
                <th className="px-4 py-3 text-left">State</th>
                <th className="px-4 py-3 text-left">Model</th>
                <th className="px-4 py-3 text-left">Reported by</th>
                <th className="px-4 py-3 text-left">Created</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-aivo-border">
              {incidents.map((inc) => (
                <tr key={inc.id} className="hover:bg-aivo-surface-2/40">
                  <td className="px-4 py-3 font-medium">
                    <Link
                      href={`/admin/platform/ai/incidents/${inc.id}`}
                      className="hover:underline"
                    >
                      {inc.title}
                    </Link>
                  </td>
                  <td className="px-4 py-3">
                    <Badge tone={severityTone(inc.severity)}>{inc.severity}</Badge>
                  </td>
                  <td className="px-4 py-3">
                    <Badge tone={stateTone(inc.state)}>{inc.state}</Badge>
                  </td>
                  <td className="px-4 py-3 text-aivo-ink-soft">
                    {inc.modelId ? (modelName.get(inc.modelId) ?? inc.modelId) : "—"}
                  </td>
                  <td className="px-4 py-3 text-aivo-ink-soft">{inc.reportedByRole}</td>
                  <td className="px-4 py-3 text-xs text-aivo-ink-soft">
                    {new Date(inc.createdAt).toLocaleDateString()}
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
